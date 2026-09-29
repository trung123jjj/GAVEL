module.exports = {
    testEnvironment: 'node',
    setupFiles: ['<rootDir>/tests/setup-env.js'],
    globalSetup: '<rootDir>/tests/global-setup.js',
    globalTeardown: '<rootDir>/tests/global-teardown.js',
    testMatch: ['**/tests/**/*.test.js'],
    verbose: true
};
