export const ENTER_COMMANDS = [
  "core.editor.appendBlockAfterCursor",
  "core.editor.newRootChild",
  "core.editor.splitBlock",
] as const

export const OUTDENT_SELECTION_COMMAND = "core.editor.outdentSelection"
export const BLANK_OUTDENT_VERSION = "0.1.0"
export const DEBUG_LOGS_ENABLED = false
export const PLUGIN_LABEL = "Blank Outdent"
export const LOG_PREFIX = "[blank-outdent]"
export const TEXT_REPR_TYPES: readonly string[] = [
  "heading",
  "ol",
  "task",
  "text",
  "ul",
]
