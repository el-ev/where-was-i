import { Logger } from '../utils/logger';

export const requestLoggingMiddleware = () => {
    return async (c: any, next: any) => {
        const startTime = Date.now();
        const logger = Logger.createRequestLogger(c.req.raw);
        
        c.logger = logger;
        
        logger.log('Request started', {
            action: 'request_start'
        });

        await next();

        const duration = Date.now() - startTime;
        const status = c.res?.status || 'unknown';
        
        logger.log('Request completed', {
            action: 'request_complete',
            status,
            duration
        });
    };
};