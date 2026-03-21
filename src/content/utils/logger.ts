import { LOG_PREFIX } from '../../shared/constants.js';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

function timestamp(): string {
  return new Date().toLocaleTimeString('zh-CN', { hour12: false });
}

function log(level: LogLevel, ...args: unknown[]): void {
  const prefix = `${LOG_PREFIX}[${timestamp()}]`;
  switch (level) {
    case 'info':
      console.log(prefix, ...args);
      break;
    case 'warn':
      console.warn(prefix, ...args);
      break;
    case 'error':
      console.error(prefix, ...args);
      break;
    case 'debug':
      console.debug(prefix, ...args);
      break;
  }
}

export const logger = {
  info: (...args: unknown[]) => log('info', ...args),
  warn: (...args: unknown[]) => log('warn', ...args),
  error: (...args: unknown[]) => log('error', ...args),
  debug: (...args: unknown[]) => log('debug', ...args),
};
