const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const User = sequelize.define('User', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    username: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true
    },
    password: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    avatar: {
        type: DataTypes.STRING(500),
        defaultValue: null
    },
    role: {
        type: DataTypes.ENUM('user', 'admin'),
        defaultValue: 'user'
    },
    // Tăng giá trị này để vô hiệu hoá toàn bộ phiên đang đăng nhập của user
    // (dùng cho logout-everywhere / đổi mật khẩu).
    token_version: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    }
}, {
    tableName: 'users'
});

User.findByUsername = function (username) {
    return this.findAll({ where: { username } });
};

module.exports = User;
