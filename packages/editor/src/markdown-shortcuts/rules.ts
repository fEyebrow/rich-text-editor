import { InputRule, textblockTypeInputRule, wrappingInputRule } from "prosemirror-inputrules";
import type { Schema } from "prosemirror-model";

export function headingRule(schema: Schema): InputRule {
  return textblockTypeInputRule(/^(#{1,6})\s$/, schema.nodes.heading, (match) => ({
    level: match[1].length,
  }));
}

export function bulletListRule(schema: Schema): InputRule {
  return wrappingInputRule(/^\s*([-+*])\s$/, schema.nodes.bullet_list);
}

export function codeFenceRule(schema: Schema): InputRule {
  return new InputRule(/^```([a-zA-Z0-9]*)\s$/, (state, match, start, end) => {
    const { tr } = state;
    const attrs = { params: match[1] ?? "" };
    return tr.replaceWith(start - 1, end, schema.nodes.code_block.create(attrs));
  });
}

export function blockquoteRule(schema: Schema): InputRule {
  return wrappingInputRule(/^\s*>\s$/, schema.nodes.blockquote);
}

export function orderedListRule(schema: Schema): InputRule {
  return wrappingInputRule(/^(\d+)\.\s$/, schema.nodes.ordered_list, (match) => ({
    order: +match[1],
  }));
}
