module.exports.up = async function up(queryInterface, Sequelize) {
    const tables = (await queryInterface.showAllTables()).map((t) => (typeof t === 'string' ? t : t.tableName));
    if (!tables.includes('users')) {
        throw new Error('Bảng users chưa tồn tại để thêm email khôi phục');
    }

    const columns = await queryInterface.describeTable('users');
    if (!columns.email) {
        await queryInterface.addColumn('users', 'email', {
            type: Sequelize.STRING(254),
            allowNull: true
        });
    }
    if (!columns.email_verified_at) {
        await queryInterface.addColumn('users', 'email_verified_at', {
            type: Sequelize.DATE,
            allowNull: true
        });
    }

    const indexes = await queryInterface.showIndex('users');
    if (!indexes.some((index) => index.name === 'uq_users_email')) {
        await queryInterface.addIndex('users', ['email'], {
            name: 'uq_users_email',
            unique: true
        });
    }

    if (tables.includes('user_account_tokens')) return;
    await queryInterface.createTable('user_account_tokens', {
        user_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            primaryKey: true,
            references: { model: 'users', key: 'id' },
            onDelete: 'CASCADE'
        },
        purpose: {
            type: Sequelize.STRING(40),
            allowNull: false,
            primaryKey: true
        },
        email: {
            type: Sequelize.STRING(254),
            allowNull: true
        },
        token_hash: {
            type: Sequelize.STRING(64),
            allowNull: false
        },
        expires_at: {
            type: Sequelize.DATE,
            allowNull: false
        },
        created_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        }
    });
};
