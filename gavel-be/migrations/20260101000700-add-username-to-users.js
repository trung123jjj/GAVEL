module.exports.up = async function up(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable('users');

    if (!columns.username && columns.name) {
        await queryInterface.renameColumn('users', 'name', 'username');
    } else if (!columns.username) {
        throw new Error('Bảng users không có cột name hoặc username để tạo tên đăng nhập');
    } else if (columns.name) {
        throw new Error('Bảng users có cả name và username; cần xử lý dữ liệu trước khi tiếp tục');
    }

    const indexes = await queryInterface.showIndex('users');
    const hasUniqueUsername = indexes.some((index) => (
        index.unique &&
        index.fields.length === 1 &&
        index.fields[0].attribute === 'username'
    ));

    if (!hasUniqueUsername) {
        await queryInterface.addIndex('users', ['username'], {
            name: 'uq_users_username',
            unique: true
        });
    }
};
