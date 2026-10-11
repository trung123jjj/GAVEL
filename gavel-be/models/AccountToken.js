const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const AccountToken = sequelize.define('AccountToken', {
    user_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        allowNull: false
    },
    purpose: {
        type: DataTypes.STRING(40),
        primaryKey: true,
        allowNull: false
    },
    email: {
        type: DataTypes.STRING(254),
        allowNull: true
    },
    token_hash: {
        type: DataTypes.STRING(64),
        allowNull: false
    },
    expires_at: {
        type: DataTypes.DATE,
        allowNull: false
    }
}, {
    tableName: 'user_account_tokens',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
});

module.exports = AccountToken;
