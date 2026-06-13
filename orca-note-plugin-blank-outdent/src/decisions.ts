import {
  getBlockText,
  isCursorData,
  isEditableTextBlock,
  isSingleCursor,
  isTextReprType,
  parseDbId,
} from "./blocks.js"
import { OUTDENT_SELECTION_COMMAND } from "./constants.js"
import { findCurrentBlockElement, getDomBlockText } from "./dom.js"
import type { DbId } from "./orca.js"
import type { DecisionDetails, EnterDecision, PassDecision } from "./types.js"

export function decideFromCursor(value: unknown): EnterDecision {
  if (!isCursorData(value)) return passDecision("no cursor")
  const blockId = value.anchor.blockId
  if (!isSingleCursor(value)) return passDecision("selection", { blockId })

  const block = orca.state.blocks[blockId]
  if (block == null) return passDecision("block missing", { blockId })
  if (!isEditableTextBlock(block)) return passDecision("unsupported block", { blockId })

  const blockText = getBlockText(block)
  if (blockText.trim().length > 0) {
    return passDecision("not blank", { blockId, blockText })
  }
  const blockEl = findBlockElementById(blockId)
  if (isVisibleTopLevel(blockEl?.dataset.indent)) {
    return passDecision("top-level blank block", {
      blockId,
      blockText,
      indent: blockEl?.dataset.indent,
    })
  }

  return {
    kind: "outdent",
    source: "command",
    commandId: OUTDENT_SELECTION_COMMAND,
    blockId,
    blockText,
    cursor: value,
  }
}

export function decideFromDom(event: KeyboardEvent): EnterDecision {
  const selection = window.getSelection()
  if (selection == null) return passDecision("no selection")
  if (!selection.isCollapsed) return passDecision("selection is not collapsed")

  const blockEl = findCurrentBlockElement(event.target)
  if (blockEl == null) return passDecision("no block element")
  if (blockEl.dataset.editable === "false") return passDecision("not editable")
  if (!isTextReprType(blockEl.dataset.type)) {
    return passDecision("unsupported dom type", { indent: blockEl.dataset.indent })
  }

  const blockId = parseDbId(blockEl.dataset.id)
  if (blockId == null) {
    return passDecision("missing block id", { indent: blockEl.dataset.indent })
  }
  return decideDomBlock(blockId, blockEl)
}

function decideDomBlock(blockId: DbId, blockEl: HTMLElement): EnterDecision {
  const block = orca.state.blocks[blockId]
  if (block == null) {
    return passDecision("block missing", { blockId, indent: blockEl.dataset.indent })
  }
  if (!isEditableTextBlock(block)) {
    return passDecision("unsupported block", { blockId, indent: blockEl.dataset.indent })
  }

  const blockText = getBlockText(block)
  const domText = getDomBlockText(blockEl)
  const textToCheck = domText ?? blockText
  if (textToCheck.trim().length > 0) {
    return passDecision("not blank", {
      blockId,
      blockText,
      domText,
      indent: blockEl.dataset.indent,
    })
  }
  if (isVisibleTopLevel(blockEl.dataset.indent)) {
    return passDecision("top-level blank block", {
      blockId,
      blockText,
      domText,
      indent: blockEl.dataset.indent,
    })
  }

  return {
    kind: "outdent",
    source: "keydown",
    commandId: OUTDENT_SELECTION_COMMAND,
    blockId,
    blockText,
    domText,
    indent: blockEl.dataset.indent,
    cursor: null,
  }
}

function passDecision(
  reason: string,
  details: DecisionDetails = {},
): PassDecision {
  return { kind: "pass", reason, ...details }
}

function isVisibleTopLevel(indent: string | undefined): boolean {
  if (indent == null) return false
  const parsed = Number.parseInt(indent, 10)
  return Number.isFinite(parsed) && parsed <= 1
}

function findBlockElementById(blockId: DbId): HTMLElement | null {
  const blockEl = document.querySelector(`.orca-block[data-id="${blockId}"]`)
  return blockEl instanceof HTMLElement ? blockEl : null
}
