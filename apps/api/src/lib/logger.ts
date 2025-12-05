import pino from 'pino';

const level = process.env.LOG_LEVEL || 'info';

// Simple logger without pino-pretty for now
export const logger = pino({
  level,
  base: {
    env: process.env.NODE_ENV,
  },
  redact: {
    paths: ['req.headers.authorization', 'req.body.password', 'req.body.secret'],
    remove: true,
  },
});

export const createChildLogger = (name: string) => {
  return logger.child({ module: name });
};

export default logger;
