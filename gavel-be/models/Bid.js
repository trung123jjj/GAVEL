const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const Bid = sequelize.define('Bid', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false
    }
}, {
    tableName: 'bids'
});

Bid.findByAuction = function (auctionId) {
    return this.findAll({
        where: { auction_id: auctionId },
        include: [{ model: require('./User'), as: 'bidder', attributes: ['id', 'username'] }],
        order: [['amount', 'DESC']]
    });
};

module.exports = Bid;
