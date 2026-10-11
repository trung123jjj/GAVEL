module.exports = function admin(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ message: 'Vui lòng đăng nhập' });
    }
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Bạn không có quyền quản trị' });
    }
    return next();
};
