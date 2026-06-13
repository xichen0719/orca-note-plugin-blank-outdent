export function getDomBlockText(blockEl: HTMLElement): string | null {
  const contentEl = blockEl.querySelector(".orca-repr-main-content")
  if (!(contentEl instanceof HTMLElement)) return null
  return contentEl.textContent ?? ""
}

export function findCurrentBlockElement(
  target: EventTarget | null,
): HTMLElement | null {
  const targetBlock = findBlockFromTarget(target)
  if (targetBlock != null) return targetBlock

  const selection = window.getSelection()
  const anchorBlock = findBlockFromNode(selection?.anchorNode ?? null)
  if (anchorBlock != null) return anchorBlock

  return findBlockFromNode(selection?.focusNode ?? null)
}

function findBlockFromTarget(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Node)) return null
  return findBlockFromNode(target)
}

function findBlockFromNode(node: Node | null): HTMLElement | null {
  if (node == null) return null

  const element = node instanceof Element ? node : node.parentElement
  if (element == null) return null

  const closestBlock = element.closest(".orca-block")
  return closestBlock instanceof HTMLElement ? closestBlock : null
}

export function isPlainEnter(event: KeyboardEvent): boolean {
  return (
    event.key === "Enter" &&
    !event.shiftKey &&
    !event.ctrlKey &&
    !event.altKey &&
    !event.metaKey &&
    !event.isComposing
  )
}

export function describeKeyboardEvent(
  event: KeyboardEvent,
): Record<string, unknown> {
  return {
    key: event.key,
    code: event.code,
    target: describeTarget(event.target),
    defaultPrevented: event.defaultPrevented,
  }
}

export function describeSelection(): Record<string, unknown> | null {
  const selection = window.getSelection()
  if (selection == null) return null
  return {
    isCollapsed: selection.isCollapsed,
    anchorNode: selection.anchorNode?.nodeName,
    focusNode: selection.focusNode?.nodeName,
    textLength: selection.toString().length,
  }
}

function describeTarget(target: EventTarget | null): Record<string, unknown> | null {
  if (!(target instanceof HTMLElement)) return null
  return {
    tag: target.tagName,
    className: target.className,
    contentEditable: target.contentEditable,
  }
}
