/**
 * Logging utility for structured logging in Cloudflare Workers
 */

export interface LogContext {
    requestId?: string;
    userId?: string;
    action?: string;
    duration?: number;
    [key: string]: any;
}

export class Logger {
    private static generateRequestId(): string {
        return Math.random().toString(36).substring(2, 15);
    }

    private static formatMessage(level: string, message: string, context?: LogContext): string {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            message,
            ...context
        };
        return JSON.stringify(logEntry);
    }

    static info(message: string, context?: LogContext): void {
        console.log(this.formatMessage('INFO', message, context));
    }

    static warn(message: string, context?: LogContext): void {
        console.warn(this.formatMessage('WARN', message, context));
    }

    static error(message: string, error?: Error, context?: LogContext): void {
        const errorContext = {
            ...context,
            error: error ? {
                name: error.name,
                message: error.message,
                stack: error.stack
            } : undefined
        };
        console.error(this.formatMessage('ERROR', message, errorContext));
    }

    static debug(message: string, context?: LogContext): void {
        console.debug(this.formatMessage('DEBUG', message, context));
    }

    static createRequestLogger(request: Request): {
        requestId: string;
        log: (message: string, context?: LogContext) => void;
        warn: (message: string, context?: LogContext) => void;
        error: (message: string, error?: Error, context?: LogContext) => void;
        debug: (message: string, context?: LogContext) => void;
    } {
        const requestId = this.generateRequestId();
        const baseContext = {
            requestId,
            method: request.method,
            url: request.url,
            userAgent: request.headers.get('user-agent') || undefined
        };

        return {
            requestId,
            log: (message: string, context?: LogContext) => 
                this.info(message, { ...baseContext, ...context }),
            warn: (message: string, context?: LogContext) => 
                this.warn(message, { ...baseContext, ...context }),
            error: (message: string, error?: Error, context?: LogContext) => 
                this.error(message, error, { ...baseContext, ...context }),
            debug: (message: string, context?: LogContext) => 
                this.debug(message, { ...baseContext, ...context })
        };
    }
}