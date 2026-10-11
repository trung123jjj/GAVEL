const config = {
    SMTP_HOST: 'smtp.example.test',
    SMTP_PORT: 587,
    SMTP_SECURE: false,
    SMTP_USER: 'user',
    SMTP_PASSWORD: 'password',
    SMTP_FROM: 'GAVEL <no-reply@example.test>',
    NODE_ENV: 'production'
};

let transport;

function loadEmailService(overrides = {}) {
    jest.resetModules();
    transport = {
        sendMail: jest.fn(),
        verify: jest.fn()
    };
    jest.doMock('nodemailer', () => ({
        createTransport: jest.fn(() => transport)
    }));
    jest.doMock('../config/env', () => ({ ...config, ...overrides }));
    return require('../services/emailService');
}

describe('emailService', () => {
    afterEach(() => {
        jest.dontMock('nodemailer');
        jest.dontMock('../config/env');
        jest.restoreAllMocks();
    });

    test('uses bounded SMTP timeouts and sends from the configured address', async () => {
        const { sendMail } = loadEmailService();
        transport.sendMail.mockResolvedValue({});

        await sendMail({ to: 'buyer@example.test', subject: 'Test', text: 'Test' });

        expect(transport.sendMail).toHaveBeenCalledWith({
            from: config.SMTP_FROM,
            to: 'buyer@example.test',
            subject: 'Test',
            text: 'Test',
            html: undefined
        });
        const nodemailer = require('nodemailer');
        expect(nodemailer.createTransport).toHaveBeenCalledWith(expect.objectContaining({
            connectionTimeout: 10000,
            greetingTimeout: 10000,
            socketTimeout: 20000
        }));
    });

    test('reports mail outages as an explicit service-unavailable error', async () => {
        const { sendMail } = loadEmailService();
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
        transport.sendMail.mockRejectedValue(new Error('SMTP unavailable'));

        await expect(sendMail({ to: 'buyer@example.test', subject: 'Test', text: 'Test' }))
            .rejects.toMatchObject({ status: 503, message: 'Không thể gửi email lúc này. Vui lòng thử lại sau.' });
        expect(consoleError).toHaveBeenCalled();
    });

    test('verifies configured SMTP and rejects missing production configuration', async () => {
        const { verifySmtp } = loadEmailService();
        transport.verify.mockResolvedValue(true);
        await expect(verifySmtp()).resolves.toBeUndefined();

        const missingConfig = loadEmailService({ SMTP_HOST: undefined });
        await expect(missingConfig.verifySmtp())
            .rejects.toMatchObject({ status: 503, message: 'Dịch vụ email chưa được cấu hình SMTP' });
    });
});
