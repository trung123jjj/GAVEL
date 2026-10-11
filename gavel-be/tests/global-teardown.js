const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const TEST_DB = process.env.TEST_DB_NAME || 'gavel_db_test';

module.exports = async () => {
    try {
        const conn = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD
        });
        await conn.query(`DROP DATABASE IF EXISTS \`${TEST_DB}\``);
        await conn.end();
        console.log(`[test] Đã xóa DB test: ${TEST_DB}`);
    } catch (err) {
        console.warn('[test] Không thể xóa DB test:', err.message);
    }
};
