// Blank Outdent learning notes
//
// This file is for reading only. It mirrors the main plugin entry in plain
// JavaScript style, with extra Chinese comments. The real source file is
// ../src/index.ts, and Orca runs the built file at ../dist/index.js.

import { findCursorData } from "../src/blocks.js"
import { BLANK_OUTDENT_VERSION, ENTER_COMMANDS } from "../src/constants.js"
import { decideFromCursor, decideFromDom } from "../src/decisions.js"
import { describeKeyboardEvent, describeSelection, isPlainEnter } from "../src/dom.js"
import {
  describeArg,
  describeDecision,
  describeError,
  log,
  logLifecycle,
} from "../src/logging.js"

// 保存监听器引用。
// 为什么要保存？因为卸载插件时，必须拿同一个函数引用去注销监听器。
let beforeEnterCommand = null
let keydownHandler = null

// Orca 加载插件时会调用 load()。
// 这里做两件事：
// 1. 注册 Orca 命令前置钩子。
// 2. 监听普通 Enter 按键。
export function load(_name) {
  beforeEnterCommand = makeBeforeEnterCommand()
  keydownHandler = handleKeydown

  // 有些 Enter 行为会走 Orca 的编辑器命令，而不是直接暴露成 DOM 按键。
  // 所以这里对几个 Enter 相关命令加 before hook，提前判断要不要接管。
  for (const command of ENTER_COMMANDS) {
    orca.commands.registerBeforeCommand(command, beforeEnterCommand)
  }

  // 第三个参数 true 表示 capture 阶段监听，能更早看到按键事件。
  document.addEventListener("keydown", keydownHandler, true)

  logLifecycle(`loaded v${BLANK_OUTDENT_VERSION}`)
}

// Orca 卸载插件时会调用 unload()。
// 加载时注册了什么，这里就要对应清理什么，避免重复监听。
export function unload(_name) {
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

// 创建 Orca 命令前置钩子。
// 返回 true：放行，继续执行 Orca 默认行为。
// 返回 false：拦截，Orca 默认行为不再继续。
function makeBeforeEnterCommand() {
  return (id, ...args) => {
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

// 处理键盘 Enter。
// 真正的判断逻辑不写在这里，而是交给 decideFromDom()：
// 入口文件只负责“收到事件 -> 得到决定 -> 执行动作”。
function handleKeydown(event) {
  if (!isPlainEnter(event)) return

  const decision = decideFromDom(event)
  log("keydown enter", {
    event: describeKeyboardEvent(event),
    selection: describeSelection(),
    decision: describeDecision(decision),
  })

  if (decision.kind !== "outdent") return

  // 走到这里说明插件决定接管本次 Enter。
  // preventDefault() 阻止浏览器/Orca 的默认按键行为。
  // stopImmediatePropagation() 阻止后续监听器继续处理这次 Enter。
  event.preventDefault()
  event.stopImmediatePropagation()

  void outdentBlankBlock(decision)
}

// 真正修改大纲结构的地方。
// 插件不自己移动块，只调用 Orca 官方编辑器命令：
// core.editor.outdentSelection
async function outdentBlankBlock(decision) {
  log(`${decision.source} fallback outdent`, describeDecision(decision))

  try {
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
