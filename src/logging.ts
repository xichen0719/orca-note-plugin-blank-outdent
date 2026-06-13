import {
  DEBUG_LOGS_ENABLED,
  LOG_PREFIX,
  PLUGIN_LABEL,
} from "./constants.js"
import { findCursorData, isCursorData } from "./blocks.js"
import type { CursorData } from "./orca.js"
import type { EnterDecision } from "./types.js"

export function describeDecision(
  decision: EnterDecision,
): Record<string, unknown> {
  return {
    kind: decision.kind,
    reason: decision.kind === "pass" ? decision.reason : undefined,
    source: decision.kind === "pass" ? undefined : decision.source,
    blockId: decision.blockId,
    indent: decision.indent,
    blockTextLength: decision.blockText?.length,
    domTextLength: decision.domText?.length,
  }
}

export function describeArg(value: unknown): string {
  if (isCursorData(value)) {
    return describeCursor(value)
  }
  if (Array.isArray(value)) {
    const cursor = findCursorData(value)
    if (cursor != null) return `array(${value.length},${describeCursor(cursor)})`
    return `array(${value.length})`
  }
  if (typeof value === "object" && value != null) {
    return `object(${Object.keys(value).slice(0, 6).join(",")})`
  }
  return `${typeof value}:${String(value)}`
}

function describeCursor(cursor: CursorData): string {
  const anchor = cursor.anchor
  const focus = cursor.focus
  return `cursor(${anchor.blockId}:${anchor.index}:${anchor.offset}->${focus.blockId}:${focus.index}:${focus.offset})`
}

export function describeError(error: unknown): Record<string, unknown> | unknown {
  if (!(error instanceof Error)) return error
  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
  }
}

export function log(message: string, details?: unknown): void {
  if (!DEBUG_LOGS_ENABLED) return

  writeLog(message, details)
}

export function logLifecycle(message: string, details?: unknown): void {
  writeLog(`${PLUGIN_LABEL} ${message}`, details)
}

function writeLog(message: string, details?: unknown): void {
  if (details === undefined) {
    console.log(`${LOG_PREFIX} ${message}`)
  } else {
    console.log(`${LOG_PREFIX} ${message}`, details)
  }
}
