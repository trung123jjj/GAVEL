const nodemailer = require('nodemailer');
const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASSWORD, SMTP_FROM, NODE_ENV } = require('../config/env');

async function sendMail({ to, subject, text, html }) {
    if (NODE_ENV === 'test') return;
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD || !SMTP_FROM) {
        const error = new Error('Dịch vụ email chưa được cấu hình SMTP');
        error.status = 503;
        throw error;
    }

    const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_SECURE,
        auth: { user: SMTP_USER, pass: SMTP_PASSWORD }
    });

    try {
        await transporter.sendMail({ from: SMTP_FROM, to, subject, text, html });
    } catch (cause) {
        console.error('[email] Không gửi được email:', cause.message);
        const error = new Error('Không thể gửi email lúc này. Vui lòng thử lại sau.');
        error.status = 503;
        throw error;
    }
}

module.exports = { sendMail };
