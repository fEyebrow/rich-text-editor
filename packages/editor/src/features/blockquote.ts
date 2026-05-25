import type { Schema } from "prosemirror-model";
import { inputRules, wrappingInputRule } from "prosemirror-inputrules";

export function blockquoteInputRules(schema: Schema) {
  return inputRules({
    rules: [wrappingInputRule(/^>\s$/, schema.nodes.blockquote)],
  });
}
