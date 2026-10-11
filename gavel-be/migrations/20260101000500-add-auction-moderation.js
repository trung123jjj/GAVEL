module.exports.up = async function up(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable('auctions');
    if (!columns.removed_at) {
        await queryInterface.addColumn('auctions', 'removed_at', {
            type: Sequelize.DATE,
            allowNull: true
        });
    }
    if (!columns.removed_by) {
        await queryInterface.addColumn('auctions', 'removed_by', {
            type: Sequelize.INTEGER,
            allowNull: true
        });
    }
    const [foreignKeys] = await queryInterface.sequelize.query(
        "SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE " +
        "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'auctions' " +
        "AND COLUMN_NAME = 'removed_by' AND REFERENCED_TABLE_NAME = 'users' " +
        "AND REFERENCED_COLUMN_NAME = 'id'"
    );
    if (foreignKeys.length === 0) {
        await queryInterface.addConstraint('auctions', {
            fields: ['removed_by'],
            type: 'foreign key',
            name: 'fk_auctions_removed_by_user',
            references: { table: 'users', field: 'id' },
            onDelete: 'SET NULL'
        });
    }
    if (!columns.removal_reason) {
        await queryInterface.addColumn('auctions', 'removal_reason', {
            type: Sequelize.STRING(1000),
            allowNull: true
        });
    }
};
