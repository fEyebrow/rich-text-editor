import type { Schema } from "prosemirror-model";
import { InputRule, inputRules } from "prosemirror-inputrules";
import { Plugin, TextSelection } from "prosemirror-state";
import type { Command, Transaction } from "prosemirror-state";
import { liftListItem, sinkListItem, splitListItem } from "prosemirror-schema-list";
import { Decoration, DecorationSet } from "prosemirror-view";

const TASK_MARKER = /^\[([xX ])\] $/;

export function taskItemInputRules(schema: Schema) {
  return inputRules({
    rules: [
      new InputRule(TASK_MARKER, (state, match) => {
        const { $from } = state.selection;
        if ($from.parent.type !== schema.nodes.paragraph) return null;
        const grandParent = $from.node($from.depth - 1);
        if (grandParent.type !== schema.nodes.list_item) return null;

        const checked = match[1] !== " ";
        const listItemPos = $from.before($from.depth - 1);

        const tr = state.tr.replaceWith(
          listItemPos,
          listItemPos + grandParent.nodeSize,
          schema.nodes.task_item.create({ checked }, schema.nodes.paragraph.create()),
        );
        tr.setSelection(TextSelection.create(tr.doc, listItemPos + 2));
        return tr;
      }),
    ],
  });
}

function enterTaskItem(schema: Schema): Command {
  const splitFn = splitListItem(schema.nodes.task_item);
  return (state, dispatch) => {
    let captured: Transaction | null = null;
    const fired = splitFn(state, (tr) => {
      captured = tr;
    });
    if (!fired || !captured) return false;
    if (!dispatch) return true;

    const tr = captured as Transaction;
    const $sel = tr.selection.$from;
    if ($sel.depth >= 2) {
      const depth = $sel.depth - 1;
      const node = $sel.node(depth);
      if (node && node.type === schema.nodes.task_item && node.attrs.checked) {
        tr.setNodeMarkup($sel.before(depth), schema.nodes.task_item, { checked: false });
      }
    }
    dispatch(tr);
    return true;
  };
}

export function taskItemKeymap(schema: Schema): Record<string, Command> {
  return {
    Enter: enterTaskItem(schema),
    Tab: sinkListItem(schema.nodes.task_item),
    "Shift-Tab": liftListItem(schema.nodes.task_item),
  };
}

export function liveTaskItem(schema: Schema) {
  return new Plugin({
    props: {
      decorations(state) {
        const decos: Decoration[] = [];
        state.doc.descendants((node, pos) => {
          if (node.type !== schema.nodes.task_item) return true;
          const checked = !!node.attrs.checked;
          decos.push(
            Decoration.widget(
              pos + 1,
              (view) => {
                const checkbox = document.createElement("input");
                checkbox.type = "checkbox";
                checkbox.checked = checked;
                checkbox.contentEditable = "false";
                checkbox.className = "md-task-checkbox";
                checkbox.addEventListener("mousedown", (e) => {
                  e.preventDefault();
                  view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, { checked: !checked }));
                });
                return checkbox;
              },
              { marks: [], side: -1, stopEvent: () => true },
            ),
          );
          return true;
        });
        return DecorationSet.create(state.doc, decos);
      },
    },
  });
}
