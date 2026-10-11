// Tao toan bo schema ban dau cho he thong GAVEL.
//
// Idempotent: bang da ton tai thi bo qua, nen chay tren DB cu (duoc tao boi
// sequelize.sync({ alter: true }) truoc day) van an toan.
module.exports.up = async function up(queryInterface, Sequelize) {
    const existing = new Set(
        (await queryInterface.showAllTables()).map((t) => (typeof t === 'string' ? t : t.tableName))
    );

    const create = async (table, attributes, options = {}) => {
        if (existing.has(table)) return false;
        await queryInterface.createTable(table, attributes, options);
        existing.add(table);
        return true;
    };

    const timestamps = {
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    };

    const fk = (table) => ({ model: table, key: 'id' });
    const pk = { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true };

    await create('users', {
        id: pk,
        username: { type: Sequelize.STRING(100), allowNull: false, unique: true },
        password: { type: Sequelize.STRING(255), allowNull: false },
        avatar: { type: Sequelize.STRING(500), allowNull: true },
        role: { type: Sequelize.ENUM('user', 'admin'), allowNull: false, defaultValue: 'user' },
        // Tang so phien dang dang nhap -> tang len de vo hieu hoa tat ca token da cap.
        // Lam muc dich thu hoi token ma khong can bang session rieng.
        token_version: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        ...timestamps
    });

    await create('categories', {
        id: pk,
        name: { type: Sequelize.STRING(100), allowNull: false, unique: true },
        ...timestamps
    });

    await create('auctions', {
        id: pk,
        seller_id: { type: Sequelize.INTEGER, allowNull: false, references: fk('users') },
        title: { type: Sequelize.STRING(255), allowNull: false },
        description: { type: Sequelize.TEXT, allowNull: false },
        image: { type: Sequelize.STRING(500), allowNull: true },
        images: { type: Sequelize.JSON, allowNull: true },
        starting_price: { type: Sequelize.DECIMAL(15, 2), allowNull: false },
        current_price: { type: Sequelize.DECIMAL(15, 2), allowNull: false },
        min_increment: { type: Sequelize.DECIMAL(15, 2), allowNull: false },
        status: { type: Sequelize.ENUM('pending', 'active', 'ended'), allowNull: false, defaultValue: 'pending' },
        start_time: { type: Sequelize.DATE, allowNull: false },
        end_time: { type: Sequelize.DATE, allowNull: false },
        ...timestamps
    });

    await create('auction_categories', {
        auction_id: { type: Sequelize.INTEGER, primaryKey: true, references: fk('auctions'), onDelete: 'CASCADE' },
        category_id: { type: Sequelize.INTEGER, primaryKey: true, references: fk('categories'), onDelete: 'CASCADE' }
    }, { timestamps: false });

    await create('bids', {
        id: pk,
        auction_id: { type: Sequelize.INTEGER, allowNull: false, references: fk('auctions'), onDelete: 'CASCADE' },
        user_id: { type: Sequelize.INTEGER, allowNull: false, references: fk('users') },
        amount: { type: Sequelize.DECIMAL(15, 2), allowNull: false },
        ...timestamps
    });
    await queryInterface.addIndex('bids', ['auction_id', 'amount'], { name: 'idx_bids_auction_amount' });

    await create('orders', {
        id: pk,
        auction_id: { type: Sequelize.INTEGER, allowNull: false, unique: true, references: fk('auctions') },
        seller_id: { type: Sequelize.INTEGER, allowNull: false, references: fk('users') },
        buyer_id: { type: Sequelize.INTEGER, allowNull: false, references: fk('users') },
        amount: { type: Sequelize.DECIMAL(15, 2), allowNull: false },
        status: {
            type: Sequelize.ENUM('pending', 'paid', 'shipped', 'completed', 'cancelled'),
            allowNull: false,
            defaultValue: 'pending'
        },
        ...timestamps
    });

    await create('reviews', {
        id: pk,
        user_id: { type: Sequelize.INTEGER, allowNull: false, references: fk('users') },
        buyer_id: { type: Sequelize.INTEGER, allowNull: false, references: fk('users') },
        order_id: { type: Sequelize.INTEGER, allowNull: true, unique: true, references: fk('orders') },
        rating: { type: Sequelize.INTEGER, allowNull: false },
        comment: { type: Sequelize.TEXT, allowNull: true },
        media: { type: Sequelize.JSON, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });

    await create('notifications', {
        id: pk,
        user_id: { type: Sequelize.INTEGER, allowNull: false, references: fk('users'), onDelete: 'CASCADE' },
        type: { type: Sequelize.ENUM('outbid', 'won', 'auction_closed', 'system'), allowNull: false },
        title: { type: Sequelize.STRING(255), allowNull: false },
        message: { type: Sequelize.TEXT, allowNull: true },
        auction_id: { type: Sequelize.INTEGER, allowNull: true, references: fk('auctions') },
        read: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });
    await queryInterface.addIndex('notifications', ['user_id', 'read'], { name: 'idx_notifications_user_read' });

    await create('conversations', {
        id: pk,
        user1_id: { type: Sequelize.INTEGER, allowNull: false, references: fk('users'), onDelete: 'CASCADE' },
        user2_id: { type: Sequelize.INTEGER, allowNull: false, references: fk('users'), onDelete: 'CASCADE' },
        ...timestamps
    }, { indexes: [{ unique: true, fields: ['user1_id', 'user2_id'], name: 'uniq_conversation_pair' }] });

    await create('messages', {
        id: pk,
        conversation_id: { type: Sequelize.INTEGER, allowNull: false, references: fk('conversations'), onDelete: 'CASCADE' },
        sender_id: { type: Sequelize.INTEGER, allowNull: false, references: fk('users') },
        content: { type: Sequelize.TEXT, allowNull: false },
        read: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });
    await queryInterface.addIndex('messages', ['conversation_id', 'created_at'], { name: 'idx_messages_conv_created' });
};
