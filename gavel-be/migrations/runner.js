const path = require('path');
const fs = require('fs');

// Bảng lịch sử migration (đặt tên giống sequelize-cli để có thể chuyển sang
// sequelize-cli/umzug sau nếu dự án lớn lên).
const META_TABLE = 'SequelizeMeta';

// Tên migration lấy từ tên file: <timestamp>-<slug>.js
function discover() {
    return fs
        .readdirSync(__dirname)
        .filter((f) => /^\d{6,}-[a-z0-9-]+\.js$/.test(f))
        .sort()
        .map((file) => ({
            file,
            name: file.replace(/\.js$/, ''),
            path: path.join(__dirname, file)
        }));
}

function getQueryInterface() {
    const sequelize = require('../config/sequelize');
    return sequelize.getQueryInterface();
}

async function ensureMetaTable(queryInterface) {
    const tables = await queryInterface.showAllTables();
    const names = tables.map((t) => (typeof t === 'string' ? t : t.tableName));
    if (!names.includes(META_TABLE)) {
        const { Sequelize } = require('sequelize');
        await queryInterface.createTable(META_TABLE, {
            name: { type: Sequelize.STRING(255), primaryKey: true, allowNull: false }
        });
    }
}

async function getApplied(queryInterface) {
    const [rows] = await queryInterface.sequelize.query('SELECT name FROM `' + META_TABLE + '`');
    return new Set(rows.map((r) => r.name));
}

/**
 * Chạy các migration chưa áp dụng theo thứ tự tên file.
 * Mỗi migration nằm trong transaction riêng — lỗi giữa chừng không để lại
 * trạng thái nửa vời (đã chạy thì rollback, chưa chạy thì giữ nguyên).
 */
async function runMigrations({ log = console.log } = {}) {
    const queryInterface = getQueryInterface();
    const { Sequelize } = require('sequelize');

    await ensureMetaTable(queryInterface);

    const already = await getApplied(queryInterface);
    const all = discover();
    const pending = all.filter((m) => !already.has(m.name));

    if (pending.length === 0) {
        log('[migrate] Khong co migration nao moi.');
        return { applied: [], total: all.length };
    }

    const applied = [];
    for (const migration of pending) {
        // eslint-disable-next-line global-require, import/no-dynamic-require
        const mod = require(migration.path);
        const up = mod.up || mod.default;
        if (typeof up !== 'function') {
            throw new Error(`Migration ${migration.file} khong export ham up()`);
        }

        log(`[migrate] Dang ap dung ${migration.name} ...`);
        const transaction = await queryInterface.sequelize.transaction();
        try {
            await up(queryInterface, Sequelize, transaction);
            await queryInterface.bulkInsert(META_TABLE, [{ name: migration.name }], { transaction });
            await transaction.commit();
        } catch (err) {
            await transaction.rollback().catch(() => {});
            throw new Error(`Migration ${migration.name} that bai: ${err.message}`);
        }
        applied.push(migration.name);
    }

    log(`[migrate] Xong - da ap dung ${applied.length}/${all.length} migration.`);
    return { applied, total: all.length };
}

async function migrationStatus() {
    const queryInterface = getQueryInterface();
    const { Sequelize } = require('sequelize');
    await ensureMetaTable(queryInterface);
    const already = await getApplied(queryInterface);
    return discover().map((m) => ({ name: m.name, applied: already.has(m.name) }));
}

module.exports = { runMigrations, migrationStatus, META_TABLE };
