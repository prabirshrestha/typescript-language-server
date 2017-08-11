import * as pino from 'pino';
import * as fs from 'fs';

export type ILogger = pino.Logger;

export function createLogger(logFile?: string): ILogger {
    if (logFile) {
        return pino(fs.createWriteStream(logFile));
    } else {
        const logger = pino();
        logger.level = 'silent';
        return logger;
    }
}