const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const Order = sequelize.define('Order', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    auction_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true
    },
    seller_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    buyer_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false
    },
    status: {
        type: DataTypes.ENUM('pending', 'paid', 'shipped', 'completed', 'cancelled'),
        defaultValue: 'pending'
    }
}, {
    tableName: 'orders',
    timestamps: true
});

module.exports = Order;
