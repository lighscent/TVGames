const log = require('logxpert');

log.settings({
    level: process.env.LOG_LEVEL || 'debug',
    files: {
        folder: 'logs',
        datePattern: 'YYYY_MM_DD',
        runNumber: true,
        maxFile: '14d',
        maxSize: '20m',
        zippedArchive: true,
    }
});

module.exports = log;
