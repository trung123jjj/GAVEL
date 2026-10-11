const { verifySmtp } = require('../services/emailService');

verifySmtp()
    .then(() => {
        console.log('[smtp] Connection and authentication verified.');
    })
    .catch((err) => {
        console.error('[smtp] Verification failed:', err.message);
        process.exitCode = 1;
    });
