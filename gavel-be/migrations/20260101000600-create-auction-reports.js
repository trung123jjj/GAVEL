module.exports.up = async function up(queryInterface, Sequelize) {
    const tables = (await queryInterface.showAllTables()).map((table) => (
        typeof table === 'string' ? table : table.tableName
    ));
    if (tables.includes('auction_reports')) return;

    await queryInterface.createTable('auction_reports', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
        auction_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: 'auctions', key: 'id' },
            onDelete: 'CASCADE'
        },
        reporter_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: 'users', key: 'id' },
            onDelete: 'CASCADE'
        },
        reason: {
            type: Sequelize.ENUM('inappropriate', 'fraud', 'prohibited', 'misleading', 'other'),
            allowNull: false
        },
        details: { type: Sequelize.STRING(1000), allowNull: false, defaultValue: '' },
        status: {
            type: Sequelize.ENUM('pending', 'resolved', 'dismissed'),
            allowNull: false,
            defaultValue: 'pending'
        },
        created_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        },
        updated_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        }
    });
    await queryInterface.addIndex('auction_reports', ['auction_id', 'reporter_id'], {
        unique: true,
        name: 'uniq_auction_reporter'
    });
};
