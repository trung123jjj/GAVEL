const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const auth = require('../middleware/auth');
const { sniffFileType } = require('../utils/fileMagic');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/ogg'];
const MAX_SIZE = 5 * 1024 * 1024;

if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname) || '.jpg';
        const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
        cb(null, filename);
    }
});

const fileFilter = (req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error(`File "${file.originalname}" không phải ảnh/video hợp lệ`), false);
    }
};

const upload = multer({ storage, fileFilter, limits: { fileSize: MAX_SIZE } });

// Bảo vệ endpoint upload bằng auth middleware — chặn upload trái phép
router.post('/', auth, upload.array('files', 10), (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: 'Không có file nào được chọn' });
    }

    // Kiểm tra magic bytes thực tế của file thay vì tin mimetype do client khai báo
    for (const f of req.files) {
        const sniffed = sniffFileType(f.path);
        if (!sniffed) {
            req.files.forEach((x) => fs.unlink(x.path, () => {}));
            return res.status(400).json({ message: `File "${f.originalname}" không đúng định dạng (kiểm tra nội dung thực tế)` });
        }
    }

    const urls = req.files.map(f => `/uploads/${f.filename}`);
    res.json({ urls });
});

module.exports = router;
