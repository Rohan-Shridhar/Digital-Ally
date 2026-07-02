const isDebug = import.meta.env.DEV || false;

type LoggerFn = (...args: unknown[]) => void;

const noop: LoggerFn = () => undefined;

export const log: LoggerFn = isDebug ? (...args) => console.log(...args) : noop;
export const warn: LoggerFn = isDebug ? (...args) => console.warn(...args) : noop;
export const error: LoggerFn = isDebug ? (...args) => console.error(...args) : noop;
export const info: LoggerFn = isDebug ? (...args) => console.info(...args) : noop;
export const debug: LoggerFn = isDebug ? (...args) => console.debug(...args) : noop;
