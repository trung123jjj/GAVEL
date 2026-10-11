const { Category } = require('../models');

const CategoryController = {
    async findAll(req, res, next) {
        try {
            const categories = await Category.findAll();
            res.json(categories);
        } catch (err) {
            next(err);
        }
    }
};

module.exports = CategoryController;
