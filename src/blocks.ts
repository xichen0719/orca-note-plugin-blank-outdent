import { TEXT_REPR_TYPES } from "./constants.js"
import type { Block, CursorData, DbId } from "./orca.js"

export function isCursorData(value: unknown): value is CursorData {
  if (typeof value !== "object" || value == null) return false
  return (
    isCursorNode(readProperty(value, "anchor")) &&
    isCursorNode(readProperty(value, "focus")) &&
    typeof readProperty(value, "isForward") === "boolean"
  )
}

export function findCursorData(values: readonly unknown[]): CursorData | null {
  for (const value of values) {
    const cursor = findCursorInValue(value, 0)
    if (cursor != null) return cursor
  }
  return null
}

export function isSingleCursor(cursor: CursorData): boolean {
  return (
    cursor.anchor.blockId === cursor.focus.blockId &&
    cursor.anchor.index === cursor.focus.index &&
    cursor.anchor.offset === cursor.focus.offset &&
    cursor.anchor.isInline === cursor.focus.isInline
  )
}

export function isEditableTextBlock(block: Block): boolean {
  const repr = block.properties.find((prop) => prop.name === "_repr")?.value
  const reprType = readStringProperty(repr, "type")
  if (reprType == null) return true

  return isTextReprType(reprType)
}

export function isTextReprType(type: string | undefined): boolean {
  return type == null || TEXT_REPR_TYPES.includes(type)
}

export function getBlockText(block: Block): string {
  if (block.text !== undefined) return block.text
  if (block.content == null) return ""

  return block.content.map((fragment) => fragmentToText(fragment.v)).join("")
}

export function parseDbId(value: string | undefined): DbId | null {
  if (value == null) return null
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : null
}

function findCursorInValue(value: unknown, depth: number): CursorData | null {
  if (isCursorData(value)) return value
  if (depth >= 2 || !Array.isArray(value)) return null

  for (const item of value) {
    const cursor = findCursorInValue(item, depth + 1)
    if (cursor != null) return cursor
  }
  return null
}

function isCursorNode(value: unknown): value is CursorData["anchor"] {
  if (typeof value !== "object" || value == null) return false
  return (
    typeof readProperty(value, "blockId") === "number" &&
    typeof readProperty(value, "index") === "number" &&
    typeof readProperty(value, "offset") === "number"
  )
}

function fragmentToText(value: unknown): string {
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }
  return ""
}

function readStringProperty(value: unknown, key: string): string | null {
  if (typeof value !== "object" || value == null) return null
  const propertyValue = readProperty(value, key)
  return typeof propertyValue === "string" ? propertyValue : null
}

function readProperty(value: object, key: string): unknown {
  return Reflect.get(value, key)
}
