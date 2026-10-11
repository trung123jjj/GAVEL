const { Sequelize } = require('sequelize');
const { NODE_ENV, DB_SSL, DB_SSL_CA } = require('./env');

const isDev = NODE_ENV === 'development';
const useDatabaseTls = DB_SSL || Boolean(DB_SSL_CA);

const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        dialect: 'mysql',
        dialectOptions: useDatabaseTls
            ? {
                ssl: {
                    ...(DB_SSL_CA ? { ca: DB_SSL_CA } : {}),
                    minVersion: 'TLSv1.2',
                    rejectUnauthorized: true
                }
            }
            : {},
        logging: isDev ? (sql) => console.log('[SQL]', sql) : false,
        define: {
            timestamps: true,
            underscored: true
        },
        pool: {
            max: 10,
            min: 0,
            acquire: 30000,
            idle: 10000
        }
    }
);

module.exports = sequelize;
