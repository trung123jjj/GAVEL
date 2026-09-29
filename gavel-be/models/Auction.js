const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const Auction = sequelize.define('Auction', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    title: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    image: {
        type: DataTypes.STRING(500),
        defaultValue: null
    },
    images: {
        type: DataTypes.JSON,
        defaultValue: []
    },
    starting_price: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false
    },
    current_price: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false
    },
    min_increment: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false
    },
    status: {
        type: DataTypes.ENUM('pending', 'active', 'ended'),
        defaultValue: 'pending'
    },
    start_time: {
        type: DataTypes.DATE,
        allowNull: false
    },
    end_time: {
        type: DataTypes.DATE,
        allowNull: false
    }
}, {
    tableName: 'auctions'
});

module.exports = Auction;
