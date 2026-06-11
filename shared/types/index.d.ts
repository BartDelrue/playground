/// <reference types="vite/client" />

enum LogType { ERROR = 'error', WARNING = 'warning', INFO = 'info', LOG = 'log'}

type LogLine = { text: string; type: LogType };
type DividerType = 'sidebar' | 'preview' | 'terminal';
type DragState = { type: DividerType; x: number; y: number; sw: number; pw: number; th: number };
