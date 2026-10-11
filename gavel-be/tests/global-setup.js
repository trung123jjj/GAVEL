const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { DB_SSL, DB_SSL_CA } = require('../config/env');
const TEST_DB = process.env.TEST_DB_NAME || 'gavel_db_test';

module.exports = async () => {
    const useDatabaseTls = DB_SSL || Boolean(DB_SSL_CA);
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        ...(useDatabaseTls
            ? {
                ssl: {
                    ...(process.env.DB_SSL_CA ? { ca: process.env.DB_SSL_CA } : {}),
                    minVersion: 'TLSv1.2',
                    rejectUnauthorized: true
                }
            }
            : {})
    });
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${TEST_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await conn.end();
    console.log(`[test] Đã đảm bảo DB test: ${TEST_DB}`);
};
