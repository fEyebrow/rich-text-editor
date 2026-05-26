import type { Schema } from "prosemirror-model";
import type { Command } from "prosemirror-state";
import { Plugin, PluginKey, TextSelection } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";
import { type EmojiEntry, filterCandidates, lookupShortcode } from "./emoji-catalog.ts";

interface PopupState {
  active: boolean;
  query: string;
  candidates: EmojiEntry[];
  selectedIndex: number;
  triggerPos: number;
}

const INACTIVE: PopupState = {
  active: false,
  query: "",
  candidates: [],
  selectedIndex: 0,
  triggerPos: -1,
};

export const emojiPluginKey = new PluginKey<PopupState>("live-emoji");

const SHORTCODE_RE = /:([\w]+):$/;

export function liveEmoji(schema: Schema) {
  return new Plugin<PopupState>({
    key: emojiPluginKey,
    state: {
      init: () => INACTIVE,
      apply(tr, prev) {
        const meta = tr.getMeta(emojiPluginKey) as PopupState | undefined;
        if (meta !== undefined) return meta;
        if (tr.docChanged || tr.selectionSet) return INACTIVE;
        return prev;
      },
    },
    props: {
      clipboardTextSerializer(slice) {
        const parts: string[] = [];
        slice.content.forEach((node) => {
          if (node.type.name === "emoji") {
            parts.push(`:${node.attrs.shortcode as string}:`);
          } else if (node.isText) {
            parts.push(node.text ?? "");
          }
        });
        return parts.join("") || slice.content.textBetween(0, slice.content.size);
      },
      handleTextInput(view, from, to, text) {
        const { state } = view;
        const $from = state.selection.$from;
        if (!$from.parent.isTextblock) return false;

        const before = $from.parent.textBetween(0, $from.parentOffset, "\n", "\ufffc");

        const popup = emojiPluginKey.getState(state);

        if (popup?.active) {
          const newQuery = popup.query + text;
          const colonPos = before.lastIndexOf(":");
          if (colonPos === -1) {
            view.dispatch(state.tr.setMeta(emojiPluginKey, INACTIVE));
            return false;
          }

          const entry = lookupShortcode(popup.query);
          if (entry && !/\w/.test(text)) {
            const triggerDocPos = from - popup.query.length - 1;
            const tr = state.tr.replaceWith(
              triggerDocPos,
              from,
              schema.nodes.emoji.create({ shortcode: entry.shortcode, emoji: entry.emoji }),
            );
            tr.insertText(text, triggerDocPos + 1);
            tr.setMeta(emojiPluginKey, INACTIVE);
            view.dispatch(tr);
            return true;
          }

          const candidates = filterCandidates(newQuery);
          if (candidates.length === 0) {
            view.dispatch(state.tr.setMeta(emojiPluginKey, INACTIVE));
            return false;
          }

          view.dispatch(
            state.tr.setMeta(emojiPluginKey, {
              active: true,
              query: newQuery,
              candidates,
              selectedIndex: 0,
              triggerPos: popup.triggerPos,
            } satisfies PopupState),
          );
          return false;
        }

        if (text === ":") return false;

        const triggerMatch = /:([\w]*)$/.exec(before);
        if (!triggerMatch) return false;
        const query = triggerMatch[1] + text;
        const candidates = filterCandidates(query);
        if (candidates.length === 0) return false;

        view.dispatch(
          state.tr.setMeta(emojiPluginKey, {
            active: true,
            query,
            candidates,
            selectedIndex: 0,
            triggerPos: from - triggerMatch[1].length - 1,
          } satisfies PopupState),
        );
        return false;
      },
      handleKeyDown(view, event) {
        const popup = emojiPluginKey.getState(view.state);
        if (!popup?.active) return false;

        if (event.key === "ArrowDown") {
          const next = (popup.selectedIndex + 1) % popup.candidates.length;
          view.dispatch(view.state.tr.setMeta(emojiPluginKey, { ...popup, selectedIndex: next }));
          return true;
        }
        if (event.key === "ArrowUp") {
          const next =
            (popup.selectedIndex - 1 + popup.candidates.length) % popup.candidates.length;
          view.dispatch(view.state.tr.setMeta(emojiPluginKey, { ...popup, selectedIndex: next }));
          return true;
        }
        if (event.key === "Enter" || event.key === "Tab") {
          commitCandidate(view, popup, schema);
          return true;
        }
        if (event.key === "Escape") {
          view.dispatch(view.state.tr.setMeta(emojiPluginKey, INACTIVE));
          return true;
        }
        return false;
      },
      decorations(state) {
        const decos: Decoration[] = [];

        state.doc.descendants((node, pos) => {
          if (node.type !== schema.nodes.emoji) return true;
          decos.push(
            Decoration.widget(
              pos,
              () => {
                const icon = document.createElement("span");
                icon.className = "md-emoji-icon";
                icon.textContent = node.attrs.emoji as string;
                icon.contentEditable = "false";
                return icon;
              },
              { marks: [], side: -1 },
            ),
          );
          return false;
        });

        state.doc.descendants((node, pos) => {
          if (!node.isTextblock) return true;
          const text = node.textBetween(0, node.content.size, "\n", "\ufffc");
          const re = /:([\w]+):/g;
          let m: RegExpExecArray | null;
          while ((m = re.exec(text))) {
            const entry = lookupShortcode(m[1]);
            if (!entry) continue;
            const from = pos + 1 + m.index;
            const to = from + m[0].length;

            decos.push(
              Decoration.widget(
                from,
                () => {
                  const icon = document.createElement("span");
                  icon.className = "md-emoji-source-icon";
                  icon.textContent = entry.emoji;
                  icon.contentEditable = "false";
                  return icon;
                },
                { marks: [], side: -1 },
              ),
            );
            decos.push(
              Decoration.inline(
                from,
                to,
                { class: "md-live-emoji-shortcode" },
                { inclusiveEnd: true },
              ),
            );
          }
          return false;
        });

        const popup = emojiPluginKey.getState(state);
        if (popup?.active && popup.candidates.length > 0) {
          const { selection } = state;
          decos.push(
            Decoration.widget(
              selection.from,
              (view) => {
                const container = document.createElement("div");
                container.className = "md-emoji-popup";
                container.contentEditable = "false";
                popup.candidates.forEach((entry, i) => {
                  const item = document.createElement("div");
                  item.className =
                    i === popup.selectedIndex
                      ? "md-emoji-candidate md-emoji-candidate-selected"
                      : "md-emoji-candidate";
                  item.dataset.index = String(i);
                  const icon = document.createElement("span");
                  icon.textContent = entry.emoji;
                  const label = document.createElement("span");
                  label.textContent = `:${entry.shortcode}:`;
                  item.appendChild(icon);
                  item.appendChild(label);
                  item.addEventListener("mousedown", (e) => {
                    e.preventDefault();
                    commitCandidate(view, { ...popup, selectedIndex: i }, schema);
                  });
                  container.appendChild(item);
                });
                return container;
              },
              { marks: [], side: 1, stopEvent: () => true },
            ),
          );
        }

        return DecorationSet.create(state.doc, decos);
      },
    },
    appendTransaction(_trs, oldState, newState) {
      const { selection } = newState;
      if (!selection.empty) return null;

      if (oldState.selection.eq(newState.selection) && oldState.doc.eq(newState.doc)) return null;

      const $pos = selection.$from;
      if (!$pos.parent.isTextblock) return null;

      const nodePos = findEmojiNodeAt(newState.doc, selection.from);
      if (nodePos !== null) {
        const emojiNode = newState.doc.nodeAt(nodePos);
        if (!emojiNode) return null;
        const source = `:${emojiNode.attrs.shortcode as string}:`;
        const tr = newState.tr.replaceWith(
          nodePos,
          nodePos + emojiNode.nodeSize,
          schema.text(source),
        );
        tr.setSelection(TextSelection.create(tr.doc, nodePos + source.length));
        return tr;
      }

      const before = $pos.parent.textBetween(0, $pos.parentOffset, "\n", "\ufffc");
      const match = SHORTCODE_RE.exec(before);
      if (match) {
        const entry = lookupShortcode(match[1]);
        if (entry) {
          const from = $pos.pos - match[0].length;
          const tr = newState.tr.replaceWith(
            from,
            $pos.pos,
            schema.nodes.emoji.create({ shortcode: entry.shortcode, emoji: entry.emoji }),
          );
          tr.setSelection(TextSelection.create(tr.doc, from + 1));
          return tr;
        }
      }

      return null;
    },
  });
}

export function emojiKeymap(_schema: Schema): Record<string, Command> {
  return {};
}

function commitCandidate(
  view: import("prosemirror-view").EditorView,
  popup: PopupState,
  schema: Schema,
): void {
  const { state } = view;
  const entry = popup.candidates[popup.selectedIndex];
  if (!entry) return;

  const { from } = state.selection;
  const queryLen = popup.query.length;
  const triggerLen = queryLen + 1;
  const replaceFrom = from - triggerLen;

  const tr = state.tr.replaceWith(
    replaceFrom,
    from,
    schema.nodes.emoji.create({ shortcode: entry.shortcode, emoji: entry.emoji }),
  );
  tr.setMeta(emojiPluginKey, INACTIVE);
  tr.setSelection(TextSelection.create(tr.doc, replaceFrom + 1));
  view.dispatch(tr);
}

function findEmojiNodeAt(doc: import("prosemirror-model").Node, position: number): number | null {
  let found: number | null = null;
  doc.descendants((node, pos) => {
    if (found !== null) return false;
    if (node.type.name === "emoji") {
      if (position >= pos && position <= pos + node.nodeSize) {
        found = pos;
        return false;
      }
    }
    return true;
  });
  return found;
}
