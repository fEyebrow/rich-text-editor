import type { Schema } from "prosemirror-model";
import { InputRule, inputRules } from "prosemirror-inputrules";
import { Plugin } from "prosemirror-state";
import { TextSelection } from "prosemirror-state";
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
              () => {
                const el = document.createElement("span");
                el.className = "md-task-checkbox";
                el.contentEditable = "false";
                el.setAttribute("data-checked", String(checked));
                return el;
              },
              { marks: [], side: -1 },
            ),
          );
          return true;
        });
        return DecorationSet.create(state.doc, decos);
      },
    },
  });
}
