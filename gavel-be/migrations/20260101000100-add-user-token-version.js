// Thêm cot token_version cho bang users.
//
// Hang 01 da tao san cot nay neu DB moi, nhung database cu (tao boi
// sequelize.sync truoc day) thi chua co — migration nay bo sung cho ho.
module.exports.up = async function up(queryInterface, Sequelize) {
    const tables = (await queryInterface.showAllTables()).map((t) => (typeof t === 'string' ? t : t.tableName));
    if (!tables.includes('users')) {
        // Bang users chua ton tai — migration 01 se lo phan nay.
        return;
    }

    const columns = await queryInterface.describeTable('users');
    if (columns.token_version) return;

    await queryInterface.addColumn('users', 'token_version', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
    });
};
