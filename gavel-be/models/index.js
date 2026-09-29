const sequelize = require('../config/sequelize');
const User = require('./User');
const Category = require('./Category');
const Auction = require('./Auction');
const Bid = require('./Bid');
const AuctionCategory = require('./AuctionCategory');
const Review = require('./Review');
const Conversation = require('./Conversation');
const Message = require('./Message');
const Order = require('./Order');
const Notification = require('./Notification');

// User → Auction (seller)
User.hasMany(Auction, { foreignKey: 'seller_id', as: 'auctions' });
Auction.belongsTo(User, { foreignKey: 'seller_id', as: 'seller' });

// Auction ↔ Category (many-to-many)
Auction.belongsToMany(Category, { through: AuctionCategory, foreignKey: 'auction_id', as: 'categories' });
Category.belongsToMany(Auction, { through: AuctionCategory, foreignKey: 'category_id', as: 'auctions' });

// User → Bid (bidder)
User.hasMany(Bid, { foreignKey: 'user_id', as: 'bids' });
Bid.belongsTo(User, { foreignKey: 'user_id', as: 'bidder' });

// Auction → Bid
Auction.hasMany(Bid, { foreignKey: 'auction_id', as: 'bids' });
Bid.belongsTo(Auction, { foreignKey: 'auction_id', as: 'auction' });

// Auction → Order (1-1)
Auction.hasOne(Order, { foreignKey: 'auction_id', as: 'order' });
Order.belongsTo(Auction, { foreignKey: 'auction_id', as: 'auction' });

// Order → Seller / Buyer
Order.belongsTo(User, { foreignKey: 'seller_id', as: 'seller' });
Order.belongsTo(User, { foreignKey: 'buyer_id', as: 'buyer' });

// Review → Order (1-1, mỗi giao dịch chỉ 1 đánh giá)
Review.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });
Order.hasOne(Review, { foreignKey: 'order_id', as: 'review' });

// User → Review (received reviews)
User.hasMany(Review, { foreignKey: 'user_id', as: 'reviews' });
Review.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// User → Review (buyer)
User.hasMany(Review, { foreignKey: 'buyer_id', as: 'givenReviews' });
Review.belongsTo(User, { foreignKey: 'buyer_id', as: 'buyer' });

// User → Notification
User.hasMany(Notification, { foreignKey: 'user_id', as: 'notifications' });
Notification.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Conversation ↔ User (participants)
Conversation.belongsTo(User, { foreignKey: 'user1_id', as: 'user1' });
Conversation.belongsTo(User, { foreignKey: 'user2_id', as: 'user2' });

// Conversation → Message
Conversation.hasMany(Message, { foreignKey: 'conversation_id', as: 'messages' });
Message.belongsTo(Conversation, { foreignKey: 'conversation_id', as: 'conversation' });
Message.belongsTo(User, { foreignKey: 'sender_id', as: 'sender' });

module.exports = {
    sequelize,
    User,
    Category,
    Auction,
    Bid,
    AuctionCategory,
    Review,
    Conversation,
    Message,
    Order,
    Notification
};
