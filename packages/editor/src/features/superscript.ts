import type { MarkSpec, Schema } from "prosemirror-model";
import type { Command } from "prosemirror-state";
import { liveInlineMark, reopenPendingInlineMarkOnBackspace } from "./live-inline-mark.ts";

export const superscriptMarkSpecs = {
  superscript: {
    parseDOM: [{ tag: "sup" }],
    toDOM() {
      return ["sup"];
    },
  } as MarkSpec,
};

export const superscriptMarkdownParseSpecs = {
  sup: { mark: "superscript" },
};

export const superscriptMarkdownSerializeSpecs = {
  superscript: { open: "^", close: "^", expelEnclosingWhitespace: true },
};

export const superscriptMarkRankEntries: [string, number][] = [["superscript", 2.65]];

const CONFIG = {
  mark: "superscript",
  open: "^",
  close: "^",
  pending: /(?<!\^)\^([^^\s]+)\^(?!\^)/g,
  commit: /(?<!\^)\^([^^\s]+)\^(?!\^)([ \u00a0]|[^^])$/,
  liveClass: "md-live-superscript",
};

const ESCAPED_PENDING_MARKER = /\\?\^([^^\s\\]+)\\?\^/g;

export function serializeLiveSuperscriptPendingMarkdown(markdown: string): string {
  return markdown.replace(ESCAPED_PENDING_MARKER, "^$1^");
}

export function superscriptKeymap(schema: Schema): Record<string, Command> {
  return {
    Backspace: reopenPendingInlineMarkOnBackspace(schema, CONFIG),
  };
}

export function liveSuperscript(schema: Schema) {
  return liveInlineMark(schema, CONFIG);
}
