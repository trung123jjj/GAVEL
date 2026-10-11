const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const Conversation = sequelize.define('Conversation', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    user1_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    user2_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    }
}, {
    tableName: 'conversations',
    indexes: [
        { unique: true, fields: ['user1_id', 'user2_id'] }
    ]
});

module.exports = Conversation;
