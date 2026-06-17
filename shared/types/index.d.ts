/// <reference types="vite/client" />

enum LogType { ERROR = 'error', WARNING = 'warning', INFO = 'info', LOG = 'log'}

type LogLine = { text: string; type: LogType };

enum DisplayMode { MIMIMAL = 'minimal', FULL = 'full', HORIZONTAL = 'horizontal', VERTICAL = 'vertical'}
