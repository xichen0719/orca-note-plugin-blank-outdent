# Blank Outdent 开发记录

这份记录用于后续开发虎鲸笔记插件时快速回忆关键点。

## 这个插件做了什么

`Blank Outdent` 修改空白块上的 Enter 行为：

- 非空块按 Enter：完全交给虎鲸笔记默认逻辑。
- 空白且有缩进的块按 Enter：退出一层缩进。
- 顶层空白块按 Enter：插件不接管，交给虎鲸笔记默认逻辑。
- 有选区、组合键、输入法组合输入时：插件不接管。

核心原则是：插件只判断“什么时候该退缩进”，真正移动块仍然调用虎鲸笔记自己的 `core.editor.outdentSelection`。

## 这次最重要的几个经验

### 1. 先用官方模板和类型文件起步

虎鲸插件的基本结构来自官方模板。开发时保留 `src/orca.d.ts` 很重要，它能帮助我们查 `orca.commands`、`orca.state.blocks`、`CursorData` 等类型。

本项目已把旧模板里的 671 行 `orca.d.ts` 升级为新版 5365 行类型文件，来源是官方新插件 `clean-editor` 包。旧版已备份到：

- `docs/orca.d.legacy-2025-template.d.ts`

后续开发其他插件时，建议先从这些位置查：

- `src/orca.d.ts`
- 官方 Quick Start https://www.orca-studio.com/orcanote-docs/documents/Quick_Start.html
- 官方插件模板或已有插件的 `dist/index.js`

### 2. `dist/index.js` 是运行文件，`src` 是开发文件

虎鲸实际加载的是插件目录里的 `dist/index.js`。  
但平时不要直接改 `dist/index.js`，因为它是构建生成的文件，重新 `pnpm build` 后会被覆盖。

本项目的主要开发入口是：

- `src/index.ts`：加载、卸载、监听 Enter、调用退缩进命令。
- `src/decisions.ts`：判断是否接管这次 Enter。
- `src/dom.ts`：从虎鲸界面元素中找到当前块。
- `docs/annotated-index.js`：学习用 JS 阅读版，不参与构建。

### 3. `keydown` 比命令钩子更可靠，但两者可以配合

一开始只挂 `core.editor.splitBlock` 的前置钩子，实际测试没有效果，因为 Orca 在某些 Enter 场景下不会把足够的 cursor 参数传给插件。

后面加入 DOM `keydown` 监听后才稳定生效。现在的策略是：

- 命令前置钩子：能抓到时就提前处理。
- `keydown` 监听：作为可靠主路径。

### 4. 顶层空白块不能继续强制 outdent

旧逻辑在顶层空白块也会拦截 Enter，然后调用 outdent。  
但顶层已经无法再退出缩进，Orca 会 no-op；因为插件已经阻止默认 Enter，所以用户会感觉“按了没反应”。

最后的处理是：

- `data-indent > 1`：插件接管，调用 outdent。
- `data-indent <= 1`：插件放行，让 Orca 默认处理。

### 5. 性能关键是快速放行

插件确实监听 Enter，但性能影响很小，因为：

- 监听只在 Orca 渲染页面里存在。
- 第一步就过滤非普通 Enter。
- 有选区、组合键、输入法输入、非文本块会立即放行。
- 平时调试日志关闭，只保留加载和卸载提示。
- 不额外计算聚焦根层级，边界交给 Orca 处理。

### 6. 虎鲸测试目录保持轻量

开发目录可以保留源码、依赖、候选图标、文档。  
虎鲸插件目录建议只放发布运行文件：

- `dist`
- `icon.png`
- `LICENSE`
- `package.json`
- `README.md`

官方文档说最低运行文件是 `dist/index.js` 和 `icon.png`，但保留 `package.json`、`README.md`、`LICENSE` 更适合作为发布包。

测试目录命名可以比开发目录更短。比如开发目录叫 `orca-note-plugin-blank-outdent`，虎鲸测试目录可以叫 `enter-blank-outdent`，不必保留 `orca-note-plugin-` 前缀。

### 7. 单文件构建更适合当前测试

为了减少 Electron/Orca 对子模块缓存的干扰，本项目构建后会把运行代码合并成一个 `dist/index.js`。这样测试时不用担心某个拆分模块还在旧缓存里。

## 后续开发插件的推荐流程

1. 先明确插件名、文件夹名和功能边界。
2. 从官方模板复制最小结构。
3. 保留开发目录，虎鲸插件目录只同步轻量发布版。
4. 先实现最小可测试功能。
5. 在 Console 打开少量诊断日志，确认触发路径。
6. 稳定后关闭详细日志，只保留 loaded/unloaded。
7. 写 README 和开发记录。
8. 构建后同步 `dist`、`icon.png`、`LICENSE`、`package.json`、`README.md`。

## 官方开发文档如何更快读

官方 Quick Start 最值得优先看的顺序：

1. `File Structure`：了解插件目录、`dist/index.js`、`icon.png`。
2. `Entry File`：确认必须导出 `load` 和 `unload`。
3. `Lifecycle`：加载时注册，卸载时清理。
4. `Command System`：学习 `registerCommand`、`invokeCommand`、`invokeEditorCommand`。
5. `Main Data Models`：看 `Block`、`Panel` 等数据结构。
6. `Conventions`：命名、唯一前缀、不要干扰系统行为。

快速查 API 时，优先在本地类型文件里搜索：

```bash
rg "invokeEditorCommand|registerBeforeCommand|CursorData|Block" src/orca.d.ts
```

新版 `orca.d.ts` 里有大量注释和示例，比旧模板更适合作为 API 字典。  
不过不同官方插件包携带的 `orca.d.ts` 可能略有差异，例如 `share-card` 包里出现过 `get-tags`，但 `clean-editor` 这份没有。因此遇到不确定的 API 时，最好同时对照几个官方插件包和运行时 Console。

如果想看虎鲸界面结构，打开开发者工具的 Elements，重点看：

- `.orca-block`
- `data-id`
- `data-indent`
- `data-type`
- `.orca-repr-main-content`

这些 DOM 信息对“编辑器行为类插件”非常有帮助。

## 关于 Super Tags 的术语

用户界面和产品介绍里会看到 `Super Tags` 这个功能名，含义大致是“带属性的标签”。

但插件 API 文档和类型文件里，通常不会直接用 `supertag` 这个词，而是拆成更具体的概念：

- `tag`
- `tags`
- `tag properties`
- `BlockTag`
- `BlockProperty`
- `BlockRef`
- `QueryTag`
- `QueryTagProperty`

所以后续开发相关插件时，代码和文档里的命名建议优先贴近官方 API：

- 面向用户的功能名：可以写 `Super Tags` 或中文“超级标签”。
- 面向代码的变量名：优先写 `tag`、`tagProperty`、`blockProperty`。
- 查官方类型时：优先搜索 `tag`、`property`、`ref-data`，不要只搜 `supertag`。
