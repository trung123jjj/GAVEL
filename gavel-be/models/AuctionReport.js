const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const AuctionReport = sequelize.define('AuctionReport', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    auction_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    reporter_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    reason: {
        type: DataTypes.ENUM('inappropriate', 'fraud', 'prohibited', 'misleading', 'other'),
        allowNull: false
    },
    details: {
        type: DataTypes.STRING(1000),
        allowNull: false,
        defaultValue: ''
    },
    status: {
        type: DataTypes.ENUM('pending', 'resolved', 'dismissed'),
        allowNull: false,
        defaultValue: 'pending'
    }
}, {
    tableName: 'auction_reports',
    timestamps: true,
    indexes: [{ unique: true, fields: ['auction_id', 'reporter_id'] }]
});

module.exports = AuctionReport;
