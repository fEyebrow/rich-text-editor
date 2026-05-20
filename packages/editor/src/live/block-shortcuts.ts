import {
  InputRule,
  inputRules,
  textblockTypeInputRule,
  wrappingInputRule,
} from "prosemirror-inputrules";
import type { Schema } from "prosemirror-model";
import type { Plugin } from "prosemirror-state";

export function blockShortcutsPlugin(schema: Schema): Plugin {
  return inputRules({
    rules: [
      headingRule(schema),
      bulletListRule(schema),
      orderedListRule(schema),
      blockquoteRule(schema),
      codeFenceRule(schema),
    ],
  });
}

function headingRule(schema: Schema): InputRule {
  return textblockTypeInputRule(/^(#{1,6})\s$/, schema.nodes.heading, (match) => ({
    level: match[1].length,
  }));
}

function bulletListRule(schema: Schema): InputRule {
  return wrappingInputRule(/^\s*([-+*])\s$/, schema.nodes.bullet_list);
}

function orderedListRule(schema: Schema): InputRule {
  return wrappingInputRule(/^(\d+)\.\s$/, schema.nodes.ordered_list, (match) => ({
    order: +match[1],
  }));
}

function blockquoteRule(schema: Schema): InputRule {
  return wrappingInputRule(/^\s*>\s$/, schema.nodes.blockquote);
}

function codeFenceRule(schema: Schema): InputRule {
  return new InputRule(/^```([a-zA-Z0-9]*)\s$/, (state, match, start, end) => {
    const { tr } = state;
    const attrs = { params: match[1] ?? "" };
    return tr.replaceWith(start - 1, end, schema.nodes.code_block.create(attrs));
  });
}
