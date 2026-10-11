// Chạy trước mỗi file test: đảm bảo dùng DB test riêng, không đụng DB thật.
process.env.NODE_ENV = 'test';
process.env.DB_NAME = process.env.TEST_DB_NAME || 'gavel_db_test';
process.env.PORT = '3999';
if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'test_secret_that_is_long_enough_for_ci';
}
