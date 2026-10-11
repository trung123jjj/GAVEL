module.exports.up = async function up(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable('auctions');
    if (columns.images) return;

    await queryInterface.addColumn('auctions', 'images', {
        type: Sequelize.JSON,
        allowNull: true
    });
};
