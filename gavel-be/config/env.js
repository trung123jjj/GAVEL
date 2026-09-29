require('dotenv').config();

const REQUIRED = ['DB_NAME', 'DB_USER', 'DB_PASSWORD', 'JWT_SECRET'];
const missing = REQUIRED.filter((key) => !process.env[key]);

if (missing.length > 0) {
    console.error(`[env] Thiếu biến môi trường bắt buộc: ${missing.join(', ')}`);
    console.error('[env] Sao chép .env.example thành .env và điền giá trị trước khi chạy.');
    process.exit(1);
}

const MIN_SECRET_LENGTH = 32;

// Các giá trị placeholder dễ đoán — so khớp theo mẫu để chặn được cả biến thể
// (ví dụ "gavel_secret_key_change_me" cũng phải bị chặn, không chỉ "gavel_secret_key").
const WEAK_SECRET_PATTERNS = [
    /^gavel_secret_key/i,
    /change[_-]?me/i,
    /^(secret|password|test|admin|12345)/i,
    /^\$\{.*\}$/ // chưa được env expansion (ví dụ docker compose chưa set)
];

function isWeakSecret(secret) {
    if (!secret) return true;
    if (secret.length < MIN_SECRET_LENGTH) return true;
    // Môi trường test dùng secret cố định để chạy CI, không phải bí mật thật.
    if (process.env.NODE_ENV === 'test') return false;
    return WEAK_SECRET_PATTERNS.some((re) => re.test(secret));
}

if (isWeakSecret(process.env.JWT_SECRET)) {
    console.error('[env] JWT_SECRET quá yếu hoặc còn là giá trị mẫu.');
    console.error(`[env] Yêu cầu chuỗi ngẫu nhiên tối thiểu ${MIN_SECRET_LENGTH} ký tự, ví dụ:`);
    console.error('[env]   node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"');
    process.exit(1);
}

module.exports = {
    JWT_SECRET: process.env.JWT_SECRET,
    CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:3000',
    // Origin backend nhìn từ phía trình duyệt — dùng để dựng CSP (img/connect-src).
    PUBLIC_API_URL: process.env.PUBLIC_API_URL || 'http://localhost:3001',
    REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
    NODE_ENV: process.env.NODE_ENV || 'development'
};
