const nodemailer = require('nodemailer');
const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASSWORD, SMTP_FROM, NODE_ENV } = require('../config/env');

let transporter;

function getTransporter() {
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD || !SMTP_FROM) {
        const error = new Error('Dịch vụ email chưa được cấu hình SMTP');
        error.status = 503;
        throw error;
    }

    if (!transporter) {
        transporter = nodemailer.createTransport({
            host: SMTP_HOST,
            port: SMTP_PORT,
            secure: SMTP_SECURE,
            auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
            connectionTimeout: 10000,
            greetingTimeout: 10000,
            socketTimeout: 20000
        });
    }

    return transporter;
}

function smtpUnavailable(cause) {
    console.error('[email] SMTP không khả dụng:', cause.message);
    const error = new Error('Không thể gửi email lúc này. Vui lòng thử lại sau.');
    error.status = 503;
    return error;
}

async function sendMail({ to, subject, text, html }) {
    if (NODE_ENV === 'test') return;
    const activeTransporter = getTransporter();
    try {
        await activeTransporter.sendMail({ from: SMTP_FROM, to, subject, text, html });
    } catch (cause) {
        throw smtpUnavailable(cause);
    }
}

async function verifySmtp() {
    const activeTransporter = getTransporter();
    try {
        await activeTransporter.verify();
    } catch (cause) {
        throw smtpUnavailable(cause);
    }
}

module.exports = { sendMail, verifySmtp };
