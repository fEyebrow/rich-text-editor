import {
  defaultMarkdownSerializer,
  MarkdownSerializer,
  MarkdownSerializerState,
} from "prosemirror-markdown";
import type { Mark, Node as ProseMirrorNode } from "prosemirror-model";

// Step 1 placeholder: keeps the existing RichTextMarkdownSerializer hack that
// patches MarkdownSerializerState to honor a stable mark order. Step 2 will
// replace this with a hand-written serializer that does not subclass
// MarkdownSerializerState at all.

const BaseMarkdownSerializerState = MarkdownSerializerState as unknown as new (
  nodes: MarkdownSerializer["nodes"],
  marks: MarkdownSerializer["marks"],
  options: MarkdownSerializer["options"],
) => any;

const markdownMarkRank = new Map([
  ["link", 0],
  ["strong", 1],
  ["em", 2],
  ["code", 3],
]);

class RichTextMarkdownSerializer extends MarkdownSerializer {
  override serialize(content: ProseMirrorNode, options: { tightLists?: boolean } = {}) {
    const mergedOptions = Object.assign({}, this.options, options);
    const state = new RichTextMarkdownSerializerState(this.nodes, this.marks, mergedOptions) as any;
    state.renderContent(content);
    return state.out;
  }
}

class RichTextMarkdownSerializerState extends BaseMarkdownSerializerState {
  renderInline(parent: ProseMirrorNode, fromBlockStart = true) {
    this.atBlockStart = fromBlockStart;
    let active: Mark[] = [];
    let trailing = "";

    const progress = (node: ProseMirrorNode | null, offset: number, index: number) => {
      let marks = node ? sortMarksForMarkdown(node.marks) : [];

      if (node && node.type.name === this.options.hardBreakNodeName) {
        marks = marks.filter((mark) => {
          if (index + 1 === parent.childCount) return false;
          const next = parent.child(index + 1);
          return mark.isInSet(next.marks) && (!next.isText || /\S/.test(next.text ?? ""));
        });
      }

      let leading = trailing;
      trailing = "";

      if (
        node &&
        node.isText &&
        marks.some((mark) => {
          const info = this.getMark(mark.type.name);
          return info && info.expelEnclosingWhitespace && !mark.isInSet(active);
        })
      ) {
        const [, lead, rest] = /^(\s*)(.*)$/m.exec(node.text ?? "") ?? [];
        if (lead) {
          leading += lead;
          node = rest
            ? (node as typeof node & { withText(text: string): ProseMirrorNode }).withText(rest)
            : null;
          if (!node) marks = active;
        }
      }

      if (
        node &&
        node.isText &&
        marks.some((mark) => {
          const info = this.getMark(mark.type.name);
          return (
            info && info.expelEnclosingWhitespace && !this.isMarkAhead(parent, index + 1, mark)
          );
        })
      ) {
        const [, rest, trail] = /^(.*?)(\s*)$/m.exec(node.text ?? "") ?? [];
        if (trail) {
          trailing = trail;
          node = rest
            ? (node as typeof node & { withText(text: string): ProseMirrorNode }).withText(rest)
            : null;
          if (!node) marks = active;
        }
      }

      const inner = marks.length ? marks[marks.length - 1] : null;
      const noEsc = inner && this.getMark(inner.type.name).escape === false;
      const len = marks.length - (noEsc ? 1 : 0);

      let keep = 0;
      while (keep < Math.min(active.length, len) && marks[keep].eq(active[keep])) keep += 1;

      while (keep < active.length) {
        this.text(this.markString(active.pop()!, false, parent, index), false);
      }

      if (leading) this.text(leading);

      if (node) {
        while (active.length < len) {
          const add = marks[active.length];
          active.push(add);
          this.text(this.markString(add, true, parent, index), false);
          this.atBlockStart = false;
        }

        if (noEsc && node.isText) {
          this.text(
            this.markString(inner!, true, parent, index) +
              (node.text ?? "") +
              this.markString(inner!, false, parent, index + 1),
            false,
          );
        } else {
          this.render(node, parent, index);
        }
        this.atBlockStart = false;
      }

      if (node?.isText && node.text) {
        this.atBlockStart = false;
      }
    };

    parent.forEach(progress);
    progress(null, 0, parent.childCount);
    if (trailing) this.text(trailing);
  }
}

function sortMarksForMarkdown(marks: readonly Mark[]): Mark[] {
  return [...marks].sort(
    (left, right) =>
      (markdownMarkRank.get(left.type.name) ?? 99) - (markdownMarkRank.get(right.type.name) ?? 99),
  );
}

export const markdownSerializer = new RichTextMarkdownSerializer(
  defaultMarkdownSerializer.nodes,
  defaultMarkdownSerializer.marks,
  defaultMarkdownSerializer.options,
);
