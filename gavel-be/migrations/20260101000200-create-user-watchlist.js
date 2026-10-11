module.exports.up = async function up(queryInterface, Sequelize) {
    const tables = (await queryInterface.showAllTables()).map((t) => (typeof t === 'string' ? t : t.tableName));
    if (tables.includes('user_watchlist')) return;

    await queryInterface.createTable('user_watchlist', {
        user_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            primaryKey: true,
            references: { model: 'users', key: 'id' },
            onDelete: 'CASCADE'
        },
        auction_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            primaryKey: true,
            references: { model: 'auctions', key: 'id' },
            onDelete: 'CASCADE'
        },
        created_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        }
    });
};
