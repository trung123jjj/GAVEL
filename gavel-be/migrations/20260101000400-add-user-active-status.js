module.exports.up = async function up(queryInterface, Sequelize) {
    const tables = (await queryInterface.showAllTables()).map((table) => (
        typeof table === 'string' ? table : table.tableName
    ));
    if (!tables.includes('users')) {
        throw new Error('Bảng users chưa tồn tại để thêm trạng thái tài khoản');
    }

    const columns = await queryInterface.describeTable('users');
    if (!columns.is_active) {
        await queryInterface.addColumn('users', 'is_active', {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: true
        });
    }
};
