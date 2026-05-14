import { inputRules } from "prosemirror-inputrules";
import type { Schema } from "prosemirror-model";
import type { Plugin } from "prosemirror-state";
import {
  blockquoteRule,
  bulletListRule,
  codeFenceRule,
  headingRule,
  orderedListRule,
} from "./rules.ts";

export function markdownShortcutsPlugin(schema: Schema): Plugin {
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
