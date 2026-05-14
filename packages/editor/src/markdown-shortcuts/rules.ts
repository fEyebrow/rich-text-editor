import { textblockTypeInputRule, wrappingInputRule, type InputRule } from "prosemirror-inputrules";
import type { Schema } from "prosemirror-model";

export function headingRule(schema: Schema): InputRule {
  return textblockTypeInputRule(/^(#{1,6})\s$/, schema.nodes.heading, (match) => ({
    level: match[1].length,
  }));
}

export function bulletListRule(schema: Schema): InputRule {
  return wrappingInputRule(/^\s*([-+*])\s$/, schema.nodes.bullet_list);
}

export function blockquoteRule(schema: Schema): InputRule {
  return wrappingInputRule(/^\s*>\s$/, schema.nodes.blockquote);
}

export function orderedListRule(schema: Schema): InputRule {
  return wrappingInputRule(/^(\d+)\.\s$/, schema.nodes.ordered_list, (match) => ({
    order: +match[1],
  }));
}
