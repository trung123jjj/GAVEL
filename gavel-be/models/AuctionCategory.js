const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const AuctionCategory = sequelize.define('AuctionCategory', {
    auction_id: {
        type: DataTypes.INTEGER,
        primaryKey: true
    },
    category_id: {
        type: DataTypes.INTEGER,
        primaryKey: true
    }
}, {
    tableName: 'auction_categories',
    timestamps: false
});

module.exports = AuctionCategory;
