const { runMigrations, migrationStatus } = require('./migrations/runner');

const command = process.argv[2] || 'up';

if (command === 'status') {
    migrationStatus()
        .then((rows) => {
            rows.forEach((r) => {
                console.log(`[${r.applied ? 'x' : ' '}] ${r.name}`);
            });
            process.exit(0);
        })
        .catch((err) => {
            console.error('[migrate] That bai:', err.message);
            process.exit(1);
        });
} else {
    runMigrations()
        .then(() => process.exit(0))
        .catch((err) => {
            console.error('[migrate] That bai:', err.message);
            process.exit(1);
        });
}
