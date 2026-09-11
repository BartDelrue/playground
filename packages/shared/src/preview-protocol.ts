/**
 * The postMessage contract between the playground app and the browser-mode preview shim.
 *
 * Two origins now, so both ends must be explicit about the other. Rules, in one place so
 * they cannot drift apart:
 *
 *   - Every send names a targetOrigin. Never '*'. A wildcard here would hand a student's
 *     code and console output to any page that managed to frame either end.
 *   - Every receive checks event.origin against the origin it expects, and drops anything
 *     else without reply.
 *
 * The shim learns the app's origin from the first message it receives rather than being
 * built with it baked in, so one deployed shim serves dev and production unchanged.
 */

import type { FileSnapshot } from './hash'

/** App -> shim: render this snapshot. */
export interface RenderMessage {
  source: 'playground-preview'
  type: 'render'
  files: FileSnapshot
  /** Which file to treat as the document. Falls back to the first .html in the snapshot. */
  entry?: string
}

/** Shim -> app: ready for a first render, or a render finished/failed. */
export interface ShimStatusMessage {
  source: 'playground-preview'
  type: 'ready' | 'rendered' | 'error'
  message?: string
}

export type PreviewMessage = RenderMessage | ShimStatusMessage

export function isPreviewMessage(data: unknown): data is PreviewMessage {
  return !!data && typeof data === 'object' && (data as PreviewMessage).source === 'playground-preview'
}

/** A console line relayed out of a previewed document by consoleRelayScript. */
export interface ConsoleMessage {
  source: 'playground-console'
  type: 'info' | 'warn' | 'error'
  message: string
}

export function isConsoleMessage(data: unknown): data is ConsoleMessage {
  return !!data && typeof data === 'object' && (data as ConsoleMessage).source === 'playground-console'
}

/**
 * Compare two origins for equality.
 *
 * Written out rather than inlined as `a === b` because the mistake this guards against -
 * comparing against a URL with a path or trailing slash, so the check silently never
 * matches and the preview goes blank with no error - is easy to make and hard to spot.
 */
export function sameOrigin(a: string, b: string): boolean {
  try {
    return new URL(a).origin === new URL(b).origin
  } catch {
    return false
  }
}
