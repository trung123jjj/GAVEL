const { NODE_ENV } = require('../config/env');

module.exports = function errorHandler(err, req, res, next) {
    console.error(err.stack);

    const status = err.status || 500;
    const message = status >= 500 && NODE_ENV === 'production'
        ? 'Internal Server Error'
        : err.message || 'Internal Server Error';

    res.status(status).json({ message });
};
