// constants.js
const ENTER_COMMANDS = [
    "core.editor.appendBlockAfterCursor",
    "core.editor.newRootChild",
    "core.editor.splitBlock",
];
const OUTDENT_SELECTION_COMMAND = "core.editor.outdentSelection";
const BLANK_OUTDENT_VERSION = "0.1.0";
const DEBUG_LOGS_ENABLED = false;
const PLUGIN_LABEL = "Blank Outdent";
const LOG_PREFIX = "[blank-outdent]";
const TEXT_REPR_TYPES = [
    "heading",
    "ol",
    "task",
    "text",
    "ul",
];

// blocks.js
function isCursorData(value) {
    if (typeof value !== "object" || value == null)
        return false;
    return (isCursorNode(readProperty(value, "anchor")) &&
        isCursorNode(readProperty(value, "focus")) &&
        typeof readProperty(value, "isForward") === "boolean");
}
function findCursorData(values) {
    for (const value of values) {
        const cursor = findCursorInValue(value, 0);
        if (cursor != null)
            return cursor;
    }
    return null;
}
function isSingleCursor(cursor) {
    return (cursor.anchor.blockId === cursor.focus.blockId &&
        cursor.anchor.index === cursor.focus.index &&
        cursor.anchor.offset === cursor.focus.offset &&
        cursor.anchor.isInline === cursor.focus.isInline);
}
function isEditableTextBlock(block) {
    const repr = block.properties.find((prop) => prop.name === "_repr")?.value;
    const reprType = readStringProperty(repr, "type");
    if (reprType == null)
        return true;
    return isTextReprType(reprType);
}
function isTextReprType(type) {
    return type == null || TEXT_REPR_TYPES.includes(type);
}
function getBlockText(block) {
    if (block.text !== undefined)
        return block.text;
    if (block.content == null)
        return "";
    return block.content.map((fragment) => fragmentToText(fragment.v)).join("");
}
function parseDbId(value) {
    if (value == null)
        return null;
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
}
function findCursorInValue(value, depth) {
    if (isCursorData(value))
        return value;
    if (depth >= 2 || !Array.isArray(value))
        return null;
    for (const item of value) {
        const cursor = findCursorInValue(item, depth + 1);
        if (cursor != null)
            return cursor;
    }
    return null;
}
function isCursorNode(value) {
    if (typeof value !== "object" || value == null)
        return false;
    return (typeof readProperty(value, "blockId") === "number" &&
        typeof readProperty(value, "index") === "number" &&
        typeof readProperty(value, "offset") === "number");
}
function fragmentToText(value) {
    if (typeof value === "string")
        return value;
    if (typeof value === "number" || typeof value === "boolean") {
        return String(value);
    }
    return "";
}
function readStringProperty(value, key) {
    if (typeof value !== "object" || value == null)
        return null;
    const propertyValue = readProperty(value, key);
    return typeof propertyValue === "string" ? propertyValue : null;
}
function readProperty(value, key) {
    return Reflect.get(value, key);
}

// dom.js
function getDomBlockText(blockEl) {
    const contentEl = blockEl.querySelector(".orca-repr-main-content");
    if (!(contentEl instanceof HTMLElement))
        return null;
    return contentEl.textContent ?? "";
}
function findCurrentBlockElement(target) {
    const targetBlock = findBlockFromTarget(target);
    if (targetBlock != null)
        return targetBlock;
    const selection = window.getSelection();
    const anchorBlock = findBlockFromNode(selection?.anchorNode ?? null);
    if (anchorBlock != null)
        return anchorBlock;
    return findBlockFromNode(selection?.focusNode ?? null);
}
function findBlockFromTarget(target) {
    if (!(target instanceof Node))
        return null;
    return findBlockFromNode(target);
}
function findBlockFromNode(node) {
    if (node == null)
        return null;
    const element = node instanceof Element ? node : node.parentElement;
    if (element == null)
        return null;
    const closestBlock = element.closest(".orca-block");
    return closestBlock instanceof HTMLElement ? closestBlock : null;
}
function isPlainEnter(event) {
    return (event.key === "Enter" &&
        !event.shiftKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.metaKey &&
        !event.isComposing);
}
function describeKeyboardEvent(event) {
    return {
        key: event.key,
        code: event.code,
        target: describeTarget(event.target),
        defaultPrevented: event.defaultPrevented,
    };
}
function describeSelection() {
    const selection = window.getSelection();
    if (selection == null)
        return null;
    return {
        isCollapsed: selection.isCollapsed,
        anchorNode: selection.anchorNode?.nodeName,
        focusNode: selection.focusNode?.nodeName,
        textLength: selection.toString().length,
    };
}
function describeTarget(target) {
    if (!(target instanceof HTMLElement))
        return null;
    return {
        tag: target.tagName,
        className: target.className,
        contentEditable: target.contentEditable,
    };
}

// decisions.js
function decideFromCursor(value) {
    if (!isCursorData(value))
        return passDecision("no cursor");
    const blockId = value.anchor.blockId;
    if (!isSingleCursor(value))
        return passDecision("selection", { blockId });
    const block = orca.state.blocks[blockId];
    if (block == null)
        return passDecision("block missing", { blockId });
    if (!isEditableTextBlock(block))
        return passDecision("unsupported block", { blockId });
    const blockText = getBlockText(block);
    if (blockText.trim().length > 0) {
        return passDecision("not blank", { blockId, blockText });
    }
    const blockEl = findBlockElementById(blockId);
    if (isVisibleTopLevel(blockEl?.dataset.indent)) {
        return passDecision("top-level blank block", {
            blockId,
            blockText,
            indent: blockEl?.dataset.indent,
        });
    }
    return {
        kind: "outdent",
        source: "command",
        commandId: OUTDENT_SELECTION_COMMAND,
        blockId,
        blockText,
        cursor: value,
    };
}
function decideFromDom(event) {
    const selection = window.getSelection();
    if (selection == null)
        return passDecision("no selection");
    if (!selection.isCollapsed)
        return passDecision("selection is not collapsed");
    const blockEl = findCurrentBlockElement(event.target);
    if (blockEl == null)
        return passDecision("no block element");
    if (blockEl.dataset.editable === "false")
        return passDecision("not editable");
    if (!isTextReprType(blockEl.dataset.type)) {
        return passDecision("unsupported dom type", { indent: blockEl.dataset.indent });
    }
    const blockId = parseDbId(blockEl.dataset.id);
    if (blockId == null) {
        return passDecision("missing block id", { indent: blockEl.dataset.indent });
    }
    return decideDomBlock(blockId, blockEl);
}
function decideDomBlock(blockId, blockEl) {
    const block = orca.state.blocks[blockId];
    if (block == null) {
        return passDecision("block missing", { blockId, indent: blockEl.dataset.indent });
    }
    if (!isEditableTextBlock(block)) {
        return passDecision("unsupported block", { blockId, indent: blockEl.dataset.indent });
    }
    const blockText = getBlockText(block);
    const domText = getDomBlockText(blockEl);
    const textToCheck = domText ?? blockText;
    if (textToCheck.trim().length > 0) {
        return passDecision("not blank", {
            blockId,
            blockText,
            domText,
            indent: blockEl.dataset.indent,
        });
    }
    if (isVisibleTopLevel(blockEl.dataset.indent)) {
        return passDecision("top-level blank block", {
            blockId,
            blockText,
            domText,
            indent: blockEl.dataset.indent,
        });
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
    };
}
function passDecision(reason, details = {}) {
    return { kind: "pass", reason, ...details };
}
function isVisibleTopLevel(indent) {
    if (indent == null)
        return false;
    const parsed = Number.parseInt(indent, 10);
    return Number.isFinite(parsed) && parsed <= 1;
}
function findBlockElementById(blockId) {
    const blockEl = document.querySelector(`.orca-block[data-id="${blockId}"]`);
    return blockEl instanceof HTMLElement ? blockEl : null;
}

// logging.js
function describeDecision(decision) {
    return {
        kind: decision.kind,
        reason: decision.kind === "pass" ? decision.reason : undefined,
        source: decision.kind === "pass" ? undefined : decision.source,
        blockId: decision.blockId,
        indent: decision.indent,
        blockTextLength: decision.blockText?.length,
        domTextLength: decision.domText?.length,
    };
}
function describeArg(value) {
    if (isCursorData(value)) {
        return describeCursor(value);
    }
    if (Array.isArray(value)) {
        const cursor = findCursorData(value);
        if (cursor != null)
            return `array(${value.length},${describeCursor(cursor)})`;
        return `array(${value.length})`;
    }
    if (typeof value === "object" && value != null) {
        return `object(${Object.keys(value).slice(0, 6).join(",")})`;
    }
    return `${typeof value}:${String(value)}`;
}
function describeCursor(cursor) {
    const anchor = cursor.anchor;
    const focus = cursor.focus;
    return `cursor(${anchor.blockId}:${anchor.index}:${anchor.offset}->${focus.blockId}:${focus.index}:${focus.offset})`;
}
function describeError(error) {
    if (!(error instanceof Error))
        return error;
    return {
        name: error.name,
        message: error.message,
        stack: error.stack,
    };
}
function log(message, details) {
    if (!DEBUG_LOGS_ENABLED)
        return;
    writeLog(message, details);
}
function logLifecycle(message, details) {
    writeLog(`${PLUGIN_LABEL} ${message}`, details);
}
function writeLog(message, details) {
    if (details === undefined) {
        console.log(`${LOG_PREFIX} ${message}`);
    }
    else {
        console.log(`${LOG_PREFIX} ${message}`, details);
    }
}

// index.js
// Keep the exact handler references so unload() can remove everything cleanly.
let beforeEnterCommand = null;
let keydownHandler = null;
export function load(_name) {
    beforeEnterCommand = makeBeforeEnterCommand();
    keydownHandler = handleKeydown;
    // Orca can trigger Enter through editor commands, so we hook those commands too.
    for (const command of ENTER_COMMANDS) {
        orca.commands.registerBeforeCommand(command, beforeEnterCommand);
    }
    // The DOM keydown path is the reliable fallback for the editable block surface.
    document.addEventListener("keydown", keydownHandler, true);
    logLifecycle(`loaded v${BLANK_OUTDENT_VERSION}`);
}
export function unload(_name) {
    if (beforeEnterCommand != null) {
        for (const command of ENTER_COMMANDS) {
            orca.commands.unregisterBeforeCommand(command, beforeEnterCommand);
        }
        beforeEnterCommand = null;
    }
    if (keydownHandler != null) {
        document.removeEventListener("keydown", keydownHandler, true);
        keydownHandler = null;
    }
    logLifecycle(`unloaded v${BLANK_OUTDENT_VERSION}`);
}
function makeBeforeEnterCommand() {
    return (id, ...args) => {
        // Returning true means "let Orca continue"; returning false cancels the command.
        const decision = decideFromCursor(findCursorData(args));
        log("before command", {
            id,
            args: args.map(describeArg),
            decision: describeDecision(decision),
        });
        if (decision.kind !== "outdent")
            return true;
        void outdentBlankBlock(decision);
        return false;
    };
}
function handleKeydown(event) {
    // Ignore Shift+Enter, Ctrl+Enter, IME composition, and other non-plain Enter cases.
    if (!isPlainEnter(event))
        return;
    const decision = decideFromDom(event);
    log("keydown enter", {
        event: describeKeyboardEvent(event),
        selection: describeSelection(),
        decision: describeDecision(decision),
    });
    if (decision.kind !== "outdent")
        return;
    event.preventDefault();
    event.stopImmediatePropagation();
    void outdentBlankBlock(decision);
}
async function outdentBlankBlock(decision) {
    log(`${decision.source} fallback outdent`, describeDecision(decision));
    try {
        // The plugin only decides when to outdent; Orca still performs the real edit.
        await orca.commands.invokeEditorCommand(decision.commandId, decision.cursor, [decision.blockId]);
        log(`${decision.source} outdent done`, describeDecision(decision));
    }
    catch (error) {
        log(`${decision.source} outdent error`, describeError(error));
    }
}
