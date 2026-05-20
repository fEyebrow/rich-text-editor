import { liftListItem, sinkListItem, splitListItem } from "prosemirror-schema-list";
import type { Schema } from "prosemirror-model";

export function listKeymap(schema: Schema) {
  const { list_item } = schema.nodes;
  return {
    Enter: splitListItem(list_item),
    Tab: sinkListItem(list_item),
    "Shift-Tab": liftListItem(list_item),
  };
}
