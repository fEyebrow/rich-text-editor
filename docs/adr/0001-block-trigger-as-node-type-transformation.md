# Block trigger commit 采用节点类型替换

当一个 Block trigger（ATX heading、list、blockquote、thematic break）被识别并完成 commit 时，所在段落被替换为另一种 ProseMirror 节点，trigger 字符（`#`、`>`、`- `、`1. `、`---`）被消耗，不再出现在文档中。备选方案是保留段落、用"显示状态"隐藏 trigger（即光标重新进入该行时 pending marker 会复现）；我们选择节点替换，因为 ProseMirror 的惯用模型就是通过节点类型表达结构，现有 `packages/editor/src/features/thematic-break.ts` 已经采用这种方式，且 markdown 序列化器可以在输出时反向合成 trigger 字符。

## 后果

- ATX heading 的 block pending marker 与 inline pending marker 由两套不同机制驱动：inline 在光标重新进入时复现（显示状态），heading 不会（一次性的文档转换）。其他 block trigger 无 pending 阶段。
- Markdown round-trip 要求序列化器知道如何从对应节点类型生成 `#`、`>`、`- ` 等 trigger 字符。
