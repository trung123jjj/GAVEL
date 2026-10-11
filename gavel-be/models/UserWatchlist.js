const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const UserWatchlist = sequelize.define('UserWatchlist', {
    user_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        allowNull: false
    },
    auction_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        allowNull: false
    }
}, {
    tableName: 'user_watchlist',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
});

module.exports = UserWatchlist;
