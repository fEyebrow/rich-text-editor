import { baseKeymap } from "prosemirror-commands";
import { history, redo, undo } from "prosemirror-history";
import { undoInputRule } from "prosemirror-inputrules";
import { keymap } from "prosemirror-keymap";
import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { markdownClipboardTextParser } from "./clipboard/markdown-paste.ts";
import { liveInlineMarkdownPlugin, undoLiveInlineMarkdown } from "./inline-markdown/index.ts";
import { horizontalRuleOnEnter } from "./keymap/horizontal-rule-on-enter.ts";
import { listKeymap } from "./keymap/list-keymap.ts";
import { markdownParser, markdownSchema, markdownSerializer } from "./markdown.ts";
import { markdownShortcutsPlugin } from "./markdown-shortcuts/index.ts";

export interface EditorOptions {
  mount: HTMLElement;
  initialMarkdown?: string;
  onChange?: (markdown: string) => void;
}

export interface EditorHandle {
  view: EditorView;
  getMarkdown: () => string;
  setMarkdown: (markdown: string) => void;
  destroy: () => void;
}

export function createEditor(options: EditorOptions): EditorHandle {
  const { mount, initialMarkdown = "", onChange } = options;

  const state = EditorState.create({
    doc: markdownParser.parse(initialMarkdown) ?? undefined,
    schema: markdownSchema,
    plugins: [
      history(),
      keymap({ "Mod-z": undo, "Mod-y": redo, "Mod-Shift-z": redo }),
      keymap({ Backspace: undoLiveInlineMarkdown }),
      keymap({ Backspace: undoInputRule }),
      keymap({ Enter: horizontalRuleOnEnter }),
      keymap(listKeymap(markdownSchema)),
      liveInlineMarkdownPlugin(),
      markdownShortcutsPlugin(markdownSchema),
      keymap(baseKeymap),
    ],
  });

  const view = new EditorView(mount, {
    state,
    clipboardTextParser: markdownClipboardTextParser(markdownSchema),
    dispatchTransaction(tr) {
      const next = view.state.apply(tr);
      view.updateState(next);
      if (tr.docChanged && onChange) {
        onChange(markdownSerializer.serialize(next.doc));
      }
    },
  });

  return {
    view,
    getMarkdown: () => markdownSerializer.serialize(view.state.doc),
    setMarkdown(markdown) {
      const doc = markdownParser.parse(markdown);
      if (!doc) return;
      const newState = EditorState.create({
        doc,
        schema: markdownSchema,
        plugins: view.state.plugins,
      });
      view.updateState(newState);
    },
    destroy: () => view.destroy(),
  };
}

export { markdownSchema };
