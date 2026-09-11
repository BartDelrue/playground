// Enum = value + type in one, no naming conflicts, auto-imported by Nuxt
export enum LogType { INFO = 'info', WARN = 'warn', ERROR = 'error' }
export interface LogLine { text: string; type: LogType }
