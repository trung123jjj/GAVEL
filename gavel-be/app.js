require('./config/env');
const express = require('express');
const http = require('http');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const cookieParser = require('cookie-parser');
const corsMiddleware = require('./middleware/cors');
const errorHandler = require('./middleware/errorHandler');
const { sequelize } = require('./models');
const { runMigrations } = require('./migrations/runner');
const setupSocket = require('./socket');
const { initScheduler, rescheduleAllActiveAuctions, getMode } = require('./services/auctionScheduler');
const { helmetOptions } = require('./config/security');

const authRoutes = require('./routes/auth');
const auctionRoutes = require('./routes/auctions');
const bidRoutes = require('./routes/bids');
const categoryRoutes = require('./routes/categories');
const uploadRoutes = require('./routes/upload');
const userRoutes = require('./routes/users');
const reviewRoutes = require('./routes/reviews');
const chatRoutes = require('./routes/chat');
const adminRoutes = require('./routes/admin');
const orderRoutes = require('./routes/orders');

const app = express();

// Cookie `secure` chỉ hoạt động đúng khi request đi qua HTTPS terminator
// (reverse proxy). Không bật thì cookie vẫn bị gửi sai ở production.
if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
}

// Global middleware
app.use(helmet(helmetOptions()));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(corsMiddleware);
app.use(express.json());
app.use(cookieParser());

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/auctions', auctionRoutes);
app.use('/api/bids', bidRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/users', userRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/orders', orderRoutes);

app.get('/health', async (req, res) => {
    try {
        await sequelize.authenticate();
        return res.json({
            status: 'ok',
            components: {
                database: 'ok',
                scheduler: getMode()
            }
        });
    } catch (err) {
        console.error('[health] Database readiness check failed:', err.message);
        return res.status(503).json({
            status: 'unavailable',
            components: {
                database: 'unavailable',
                scheduler: getMode()
            }
        });
    }
});

app.get('/', (req, res) => {
    res.send('API Running');
});

// Error handler (must be last)
app.use(errorHandler);

const PORT = process.env.PORT || 3001;

const server = http.createServer(app);
setupSocket(server);

async function start() {
    // Dùng migration thay vì sequelize.sync({ alter: true }): `alter` tự ý đổi
    // cấu trúc bảng và có thể mất dữ liệu khi chạy lại trên production.
    await runMigrations();
    console.log('Database schema up to date');

    // Khởi động message queue (BullMQ) hoặc bộ lập lịch in-process
    await initScheduler();
    await rescheduleAllActiveAuctions();

    server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

if (require.main === module) {
    start().catch((err) => {
        console.error('Failed to start server:', err);
        process.exit(1);
    });
}

module.exports = { app, server, start };
