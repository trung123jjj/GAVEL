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
            allowNull: true,
            references: { model: 'users', key: 'id' },
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
