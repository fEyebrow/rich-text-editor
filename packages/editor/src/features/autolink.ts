import type { Node, Schema } from "prosemirror-model";
import type { Command } from "prosemirror-state";
import { Plugin, TextSelection } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";

const COMPLETE_AUTOLINK_SOURCE = /<([^<>\s\n]+)>/g;
const AUTOLINK_SOURCE_BEFORE_CURSOR = /<([^<>\s\n]+)>$/;
const UNFINISHED_AUTOLINK_SOURCE = /<([^<>\s\n]+)$/g;

interface AutolinkSourceRange {
  from: number;
  to: number;
  url: string;
}

interface LinkMarkRange {
  from: number;
  to: number;
  url: string;
}

export function isValidAutolinkUrl(value: string): boolean {
  return /^https?:\/\/[^\s<>]+$/i.test(value);
}

export function isRenderedAutolink(label: string, href: string | null, title: unknown): boolean {
  return title == null && href === label && href !== null && isValidAutolinkUrl(href);
}

export function autolinkKeymap(schema: Schema): Record<string, Command> {
  return {
    Backspace: deleteAutolinkSourceClosingDelimiter(),
    Space: commitAutolinkSourceOnSpace(schema),
  };
}

export function liveAutolink(schema: Schema) {
  return new Plugin({
    props: {
      decorations(state) {
        const decos: Decoration[] = [];
        state.doc.descendants((node, pos) => {
          if (!node.isTextblock) return true;

          const text = node.textBetween(0, node.content.size, "\n", "\ufffc");
          for (const match of text.matchAll(COMPLETE_AUTOLINK_SOURCE)) {
            const url = match[1];
            if (!isValidAutolinkUrl(url)) continue;

            const offset = match.index ?? 0;
            if (textRangeHasMarkName(node, offset, match[0].length, "code")) continue;

            const from = pos + 1 + offset;
            const urlFrom = from + 1;
            const urlTo = urlFrom + url.length;
            const to = from + match[0].length;

            decos.push(Decoration.inline(from, urlFrom, { class: "md-pending" }));
            decos.push(Decoration.inline(urlFrom, urlTo, { class: "md-live-autolink-url" }));
            decos.push(Decoration.inline(urlTo, to, { class: "md-pending" }));
          }

          for (const match of text.matchAll(UNFINISHED_AUTOLINK_SOURCE)) {
            const url = match[1];
            if (!isValidAutolinkUrl(url)) continue;

            const offset = match.index ?? 0;
            if (textRangeHasMarkName(node, offset, match[0].length, "code")) continue;

            const urlFrom = pos + 1 + offset + 1;
            decos.push(
              Decoration.inline(urlFrom, urlFrom + url.length, {
                class: "md-live-autolink-url",
              }),
            );
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

      const range = autolinkSourceRangeContainingPosition(newState.doc, oldState.selection.from);
      if (range) {
        if (selection.from > range.from && selection.from < range.to) return null;

        const link = schema.marks.link.create({ href: range.url, title: null });
        const tr = newState.tr.replaceWith(range.from, range.to, schema.text(range.url, [link]));
        const leavingRight = selection.from >= range.to;
        const cursor = leavingRight ? range.from + range.url.length : range.from;
        tr.setSelection(TextSelection.create(tr.doc, cursor));
        tr.removeStoredMark(schema.marks.link);
        return tr;
      }

      const linkRange = autolinkMarkRangeContainingPosition(
        newState.doc,
        selection.from,
        schema.marks.link.name,
      );
      if (!linkRange) return null;

      const source = `<${linkRange.url}>`;
      const urlOffset = Math.max(
        0,
        Math.min(selection.from - linkRange.from, linkRange.url.length),
      );
      const tr = newState.tr.replaceWith(linkRange.from, linkRange.to, schema.text(source));
      tr.setSelection(TextSelection.create(tr.doc, linkRange.from + 1 + urlOffset));
      tr.removeStoredMark(schema.marks.link);
      return tr;
    },
  });
}

function commitAutolinkSourceOnSpace(schema: Schema): Command {
  return (state, dispatch) => {
    const { $from, empty } = state.selection;
    if (!empty || !$from.parent.isTextblock) return false;

    const before = $from.parent.textBetween(0, $from.parentOffset, "\n", "\ufffc");
    const match = AUTOLINK_SOURCE_BEFORE_CURSOR.exec(before);
    if (!match || !isValidAutolinkUrl(match[1])) return false;

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
      const link = schema.marks.link.create({ href: match[1], title: null });
      const tr = state.tr.replaceWith(from, $from.pos, [
        schema.text(match[1], [link]),
        schema.text("\u00a0"),
      ]);
      tr.setSelection(TextSelection.create(tr.doc, from + match[1].length + 1));
      tr.removeStoredMark(schema.marks.link);
      dispatch(tr);
    }

    return true;
  };
}

function deleteAutolinkSourceClosingDelimiter(): Command {
  return (state, dispatch) => {
    const { $from, empty } = state.selection;
    if (!empty || !$from.parent.isTextblock || $from.parentOffset === 0) return false;

    const before = $from.parent.textBetween(0, $from.parentOffset, "\n", "\ufffc");
    const match = AUTOLINK_SOURCE_BEFORE_CURSOR.exec(before);
    if (!match || !isValidAutolinkUrl(match[1])) return false;

    if (dispatch) dispatch(state.tr.delete($from.pos - 1, $from.pos));
    return true;
  };
}

function autolinkSourceRangeContainingPosition(
  doc: Node,
  position: number,
): AutolinkSourceRange | null {
  let result: AutolinkSourceRange | null = null;

  doc.descendants((node, pos) => {
    if (result) return false;
    if (!node.isTextblock) return true;

    const text = node.textBetween(0, node.content.size, "\n", "\ufffc");
    for (const match of text.matchAll(COMPLETE_AUTOLINK_SOURCE)) {
      const url = match[1];
      if (!isValidAutolinkUrl(url)) continue;

      const offset = match.index ?? 0;
      if (textRangeHasMarkName(node, offset, match[0].length, "code")) continue;

      const from = pos + 1 + offset;
      const to = from + match[0].length;
      if (position > from && position < to) {
        result = { from, to, url };
        return false;
      }
    }

    return false;
  });

  return result;
}

function autolinkMarkRangeContainingPosition(
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

    const href = typeof mark.attrs.href === "string" ? mark.attrs.href : null;
    if (!isRenderedAutolink(node.text, href, mark.attrs.title)) return true;

    const from = pos;
    const to = pos + node.nodeSize;
    if (position > from && position < to) {
      result = { from, to, url: node.text };
      return false;
    }

    return true;
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
