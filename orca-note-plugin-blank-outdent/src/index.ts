import { findCursorData } from "./blocks.js"
import { BLANK_OUTDENT_VERSION, ENTER_COMMANDS } from "./constants.js"
import { decideFromCursor, decideFromDom } from "./decisions.js"
import { describeKeyboardEvent, describeSelection, isPlainEnter } from "./dom.js"
import {
  describeArg,
  describeDecision,
  describeError,
  log,
  logLifecycle,
} from "./logging.js"
import type { BeforeHookPred } from "./orca.js"
import type { OutdentDecision } from "./types.js"

// Keep the exact handler references so unload() can remove everything cleanly.
let beforeEnterCommand: BeforeHookPred | null = null
let keydownHandler: ((event: KeyboardEvent) => void) | null = null

export function load(_name: string): void {
  beforeEnterCommand = makeBeforeEnterCommand()
  keydownHandler = handleKeydown

  // Orca can trigger Enter through editor commands, so we hook those commands too.
  for (const command of ENTER_COMMANDS) {
    orca.commands.registerBeforeCommand(command, beforeEnterCommand)
  }
  // The DOM keydown path is the reliable fallback for the editable block surface.
  document.addEventListener("keydown", keydownHandler, true)

  logLifecycle(`loaded v${BLANK_OUTDENT_VERSION}`)
}

export function unload(_name: string): void {
  if (beforeEnterCommand != null) {
    for (const command of ENTER_COMMANDS) {
      orca.commands.unregisterBeforeCommand(command, beforeEnterCommand)
    }
    beforeEnterCommand = null
  }
  if (keydownHandler != null) {
    document.removeEventListener("keydown", keydownHandler, true)
    keydownHandler = null
  }

  logLifecycle(`unloaded v${BLANK_OUTDENT_VERSION}`)
}

function makeBeforeEnterCommand(): BeforeHookPred {
  return (id: string, ...args: unknown[]): boolean => {
    // Returning true means "let Orca continue"; returning false cancels the command.
    const decision = decideFromCursor(findCursorData(args))
    log("before command", {
      id,
      args: args.map(describeArg),
      decision: describeDecision(decision),
    })

    if (decision.kind !== "outdent") return true
    void outdentBlankBlock(decision)
    return false
  }
}

function handleKeydown(event: KeyboardEvent): void {
  // Ignore Shift+Enter, Ctrl+Enter, IME composition, and other non-plain Enter cases.
  if (!isPlainEnter(event)) return

  const decision = decideFromDom(event)
  log("keydown enter", {
    event: describeKeyboardEvent(event),
    selection: describeSelection(),
    decision: describeDecision(decision),
  })

  if (decision.kind !== "outdent") return
  event.preventDefault()
  event.stopImmediatePropagation()
  void outdentBlankBlock(decision)
}

async function outdentBlankBlock(decision: OutdentDecision): Promise<void> {
  log(`${decision.source} fallback outdent`, describeDecision(decision))
  try {
    // The plugin only decides when to outdent; Orca still performs the real edit.
    await orca.commands.invokeEditorCommand(
      decision.commandId,
      decision.cursor,
      [decision.blockId],
    )
    log(`${decision.source} outdent done`, describeDecision(decision))
  } catch (error) {
    log(`${decision.source} outdent error`, describeError(error))
  }
}
