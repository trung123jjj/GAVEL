const { Sequelize } = require('sequelize');
const { NODE_ENV } = require('./env');

const isDev = NODE_ENV === 'development';

const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        dialect: 'mysql',
        logging: isDev ? (sql) => console.log('[SQL]', sql) : false,
        define: {
            timestamps: true,
            underscored: true
        },
        pool: {
            max: 10,
            min: 0,
            acquire: 30000,
            idle: 10000
        }
    }
);

module.exports = sequelize;
