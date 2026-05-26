import type { Node, Schema } from "prosemirror-model";
import type { Command } from "prosemirror-state";
import { Plugin, TextSelection } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";
import { isRenderedAutolink } from "./autolink.ts";

const COMPLETE_LINK_SOURCE = /\[([^\]\n]*)\]\(([^)\n]*)\)/g;
const LINK_SOURCE_BEFORE_CURSOR = /\[([^\]\n]+)\]\(([^)\n]*)\)$/;
const ESCAPED_LINK_SOURCE = /\\\[([^\]\n]*)\\\]\(([^)\n]*)\)/g;

export function serializeLiveLinkPendingMarkdown(markdown: string): string {
  return markdown.replace(ESCAPED_LINK_SOURCE, "[$1]($2)");
}

export function linkKeymap(schema: Schema): Record<string, Command> {
  return {
    Backspace: deleteLinkSourceClosingParen(),
    Space: commitLinkSourceOnSpace(schema),
  };
}

export function liveLink(_schema: Schema) {
  return new Plugin({
    props: {
      decorations(state) {
        const decos: Decoration[] = [];
        state.doc.descendants((node, pos) => {
          if (!node.isTextblock) return true;

          const text = node.textBetween(0, node.content.size, "\n", "\ufffc");
          for (const match of text.matchAll(COMPLETE_LINK_SOURCE)) {
            const offset = match.index ?? 0;
            const from = pos + 1 + offset;
            const label = match[1];
            const href = match[2];
            const labelFrom = from + 1;
            const labelTo = labelFrom + label.length;
            const hrefFrom = labelTo + 2;
            const hrefTo = hrefFrom + href.length;
            const to = from + match[0].length;
            if (textRangeHasMarkName(node, offset, match[0].length, "code")) continue;

            decos.push(Decoration.inline(from, labelFrom, { class: "md-pending" }));
            if (labelFrom < labelTo) {
              decos.push(Decoration.inline(labelFrom, labelTo, { class: "md-live-link-label" }));
            }
            decos.push(Decoration.inline(labelTo, hrefFrom, { class: "md-pending" }));
            if (hrefFrom < hrefTo) {
              decos.push(Decoration.inline(hrefFrom, hrefTo, { class: "md-live-link-url" }));
            }
            decos.push(Decoration.inline(hrefTo, to, { class: "md-pending" }));
          }

          return false;
        });
        return DecorationSet.create(state.doc, decos);
      },
    },
    appendTransaction(_transactions, oldState, newState) {
      const { selection } = newState;
      if (!oldState.selection.empty || !selection.empty) return null;
      if (!oldState.doc.eq(newState.doc)) return null;

      const range = linkSourceRangeContainingPosition(newState.doc, oldState.selection.from);
      if (range) {
        if (range.label === "") return null;
        if (selection.from > range.from && selection.from < range.to) return null;

        const link = newState.schema.marks.link.create({ href: range.href, title: null });
        const tr = newState.tr.replaceWith(
          range.from,
          range.to,
          newState.schema.text(range.label, [link]),
        );
        const leavingRight = selection.from >= range.to;
        const cursor = leavingRight ? range.from + range.label.length : range.from;
        tr.setSelection(TextSelection.create(tr.doc, cursor));
        tr.removeStoredMark(newState.schema.marks.link);
        return tr;
      }

      const linkRange = linkMarkRangeContainingPosition(
        newState.doc,
        selection.from,
        newState.schema.marks.link.name,
      );
      if (!linkRange || linkRange.href === null) return null;
      if (isRenderedAutolink(linkRange.label, linkRange.href, linkRange.title)) return null;

      const source = `[${linkRange.label}](${linkRange.href})`;
      const labelOffset = Math.max(
        0,
        Math.min(selection.from - linkRange.from, linkRange.label.length),
      );
      const tr = newState.tr.replaceWith(
        linkRange.from,
        linkRange.to,
        newState.schema.text(source),
      );
      tr.setSelection(TextSelection.create(tr.doc, linkRange.from + 1 + labelOffset));
      tr.removeStoredMark(newState.schema.marks.link);
      return tr;
    },
  });
}

function commitLinkSourceOnSpace(schema: Schema): Command {
  return (state, dispatch) => {
    const { $from, empty } = state.selection;
    if (!empty || !$from.parent.isTextblock) return false;

    const before = $from.parent.textBetween(0, $from.parentOffset, "\n", "\ufffc");
    const match = LINK_SOURCE_BEFORE_CURSOR.exec(before);
    if (!match) return false;

    const label = match[1];
    const href = match[2];
    const from = $from.pos - match[0].length;
    if (
      textRangeHasMarkName(
        $from.parent,
        $from.parentOffset - match[0].length,
        match[0].length,
        "code",
      )
    ) {
      return false;
    }

    if (dispatch) {
      const link = schema.marks.link.create({ href, title: null });
      const tr = state.tr.replaceWith(from, $from.pos, [
        schema.text(label, [link]),
        schema.text("\u00a0"),
      ]);
      tr.setSelection(TextSelection.create(tr.doc, from + label.length + 1));
      tr.removeStoredMark(schema.marks.link);
      dispatch(tr);
    }

    return true;
  };
}

function deleteLinkSourceClosingParen(): Command {
  return (state, dispatch) => {
    const { $from, empty } = state.selection;
    if (!empty || !$from.parent.isTextblock || $from.parentOffset === 0) return false;

    const before = $from.parent.textBetween(0, $from.parentOffset, "\n", "\ufffc");
    if (!/\[[^\]\n]*\]\([^)\n]*\)$/.test(before)) return false;

    if (dispatch) dispatch(state.tr.delete($from.pos - 1, $from.pos));
    return true;
  };
}

interface LinkSourceRange {
  from: number;
  to: number;
  label: string;
  href: string;
}

interface LinkMarkRange {
  from: number;
  to: number;
  label: string;
  href: string | null;
  title: unknown;
}

function linkSourceRangeContainingPosition(doc: Node, position: number): LinkSourceRange | null {
  let result: LinkSourceRange | null = null;

  doc.descendants((node, pos) => {
    if (result) return false;
    if (!node.isTextblock) return true;

    const text = node.textBetween(0, node.content.size, "\n", "\ufffc");
    for (const match of text.matchAll(COMPLETE_LINK_SOURCE)) {
      const from = pos + 1 + (match.index ?? 0);
      const to = from + match[0].length;
      if (textRangeHasMarkName(node, from - pos - 1, match[0].length, "code")) continue;
      if (position > from && position < to) {
        result = { from, to, label: match[1], href: match[2] };
        return false;
      }
    }

    return false;
  });

  return result;
}

function textRangeHasMarkName(node: Node, from: number, length: number, markName: string): boolean {
  const to = from + length;
  let offset = 0;
  let hasMark = false;

  node.forEach((child) => {
    if (hasMark) return;
    const childFrom = offset;
    const childTo = offset + child.nodeSize;
    offset = childTo;
    if (childTo <= from || childFrom >= to) return;
    if (child.marks.some((mark) => mark.type.name === markName)) hasMark = true;
  });

  return hasMark;
}

function linkMarkRangeContainingPosition(
  doc: Node,
  position: number,
  markName: string,
): LinkMarkRange | null {
  let result: LinkMarkRange | null = null;

  doc.descendants((node, pos) => {
    if (result) return false;
    if (!node.isText || !node.text) return true;

    const mark = node.marks.find((candidate) => candidate.type.name === markName);
    if (!mark) return true;

    const from = pos;
    const to = pos + node.nodeSize;
    if (position > from && position < to) {
      result = {
        from,
        to,
        label: node.text,
        href: typeof mark.attrs.href === "string" ? mark.attrs.href : null,
        title: mark.attrs.title,
      };
      return false;
    }

    return true;
  });

  return result;
}
