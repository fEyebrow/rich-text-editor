# Rich Text Editor

类 Typora 的 Markdown 编辑器，本文档描述编辑过程中 Markdown 源文本的表示方式。

## 术语

**Inline mark（行内标记）**：
用 Markdown delimiter 包裹、作用于块内文本的行内样式。
_避免_：inline feature、inline style

**Live inline mark（实时行内标记）**：
一种 **Inline mark**，在 commit 前同时显示其 Markdown delimiter 并把内容渲染为带样式的文本。范围内实例：italic、strong、inline code、strikethrough。
_避免_：realtime mark、live display

**Block trigger（块触发器）**：
位于行首的一种 Markdown 模式，被识别时把所在段落变换为另一个块级节点。变换时机随 trigger 不同：

- **Heading trigger**（`#{1,6} ` + 非空内容）：段落保持，`#` 显示为 **Block pending marker**，Enter 或光标离开行时 **Commit**，段落被替换为 heading 节点。
- **输入即变 trigger**（`> `、`- ` / `* ` / `+ `、`1. `）：模式输入完整的那一刻立刻把段落替换为目标节点，无 pending 阶段，无独立 commit 步骤。
- **内容检查 trigger**（`---`）：段落保持纯文本，Enter 或光标离开行时检查行内容是否恰为 `---`，匹配则替换为 thematic break 节点；无 pending marker。
  范围内实例：ATX heading、unordered list、ordered list、blockquote、thematic break。
  _避免_：block syntax、block prefix、live block mark

**Pending marker（待定标记）**：
在 **Commit** 之前可见的 Markdown delimiter。两种变体：

- **Inline pending marker** — 属于 **Live inline mark**。mark 的内容已经渲染为带样式的文本；commit 之后光标重新进入该 mark 范围时，pending marker 会重新出现。
- **Block pending marker** — 仅 ATX heading 在内容非空时使用，`#` 字符以灰色显示；commit 后 trigger 字符被消耗，pending 不再出现。其他 block trigger 无 pending 阶段。
  _避免_：syntax marker、hidden marker

**Commit（提交）**：
**Live inline mark**、Heading trigger 或 Thematic break trigger 完成最终化的状态转换。行为有别：

- **Inline commit** — 由输入闭合 delimiter（或尾随空格）触发。隐藏 inline pending marker；光标重新进入时可逆复现。
- **Heading commit** — 由 Enter 或光标离开该行（ArrowDown / ArrowUp / 点击其他块）触发。段落被替换为 heading 节点；`#` 字符被消耗并从文档中移除。不可逆。
- **Thematic break commit** — 由 Enter 或光标离开该行触发，且行内容恰为 `---` 时段落被替换为 `<hr>` 节点。不可逆。
- 输入即变 trigger（blockquote、list）无独立 commit 步骤，模式输入完成即同时完成转换。

## 关系

- 一个 **Live inline mark** 在 commit 之前包含零或多个 **Inline pending marker**。
- 一个 **Live inline mark** 在 commit 前后都会把内容渲染为带样式的文本。
- 已 commit 的 **Live inline mark** 隐藏其 **Inline pending marker**；光标重新进入 mark 范围时它们会重新出现。
- ATX heading 在 `#{1,6} ` 后内容非空时显示 **Block pending marker**；commit 后段落被替换为 heading 节点，`#` 被消耗，pending 不再出现。
- 其他 **Block trigger** 在模式完整时立刻把段落替换为目标节点，无 pending 阶段。

## 示例对话

> **Dev：** "`**text**` 在第二个 `**` 敲下时就应该立刻变粗体吗？"
> **领域专家：** "是的 — 它依然是一个带 **Inline pending marker** 的 **Live inline mark**，但 `text` 在 commit 之前就已经是粗体了。"

> **Dev：** "`# ` 后还没打字，`#` 是 pending 吗？"
> **领域专家：** "不是 — `# ` 后必须开始打内容，`#` 才变灰成为 **Block pending marker**。`# |` 单独存在时 `#` 是普通字符。"

> **Dev：** "`> quote` 也是同样的 pending 模型吗？"
> **领域专家：** "不是 — blockquote 是输入即变。`> ` 输入完那一刻段落立刻替换为 `<blockquote>`，无 pending 阶段。"

## 暂存歧义

- Highlight `==` 与 inline / block math 仍属于范围外，等成为领域术语再纳入。
- Fenced code block 已从 phase 1 移除，留待后续 phase 再设计触发模型。
