import { expect, test } from "vite-plus/test";
import { TextSelection } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import { createEditor } from "../src/index.ts";
import { pressKey, typeText } from "./helpers.ts";

function moveToEnd(view: EditorView): void {
  view.dispatch(view.state.tr.setSelection(TextSelection.atEnd(view.state.doc)));
}

test("createEditor mounts and round-trips markdown", () => {
  const mount = document.createElement("div");
  const editor = createEditor({ mount, initialMarkdown: "# Hello\n\nworld" });
  expect(editor.getMarkdown()).toBe("# Hello\n\nworld");
  editor.destroy();
});

test("pasting markdown text parses it as schema nodes", () => {
  const mount = document.createElement("div");
  const editor = createEditor({ mount });
  const result = editor.view.someProp("clipboardTextParser", (f) =>
    f("# Title\n\n- a\n- b", editor.view.state.doc.resolve(0), false, editor.view),
  );
  expect(result).not.toBeNull();
  const slice = result as import("prosemirror-model").Slice;
  expect(slice.content.firstChild?.type.name).toBe("heading");
  editor.destroy();
});

test("pasting empty string returns falsy (PM handles as plain)", () => {
  const mount = document.createElement("div");
  const editor = createEditor({ mount });
  const result = editor.view.someProp("clipboardTextParser", (f) =>
    f("", editor.view.state.doc.resolve(0), false, editor.view),
  );
  expect(result).toBeFalsy();
  editor.destroy();
});

test("Enter on '---' inside a list item does NOT make a top-level hr", () => {
  const mount = document.createElement("div");
  const editor = createEditor({ mount, initialMarkdown: "- a" });
  moveToEnd(editor.view);
  pressKey(editor.view, "Enter");
  typeText(editor.view, "---");
  pressKey(editor.view, "Enter");
  expect(editor.view.state.doc.firstChild?.type.name).toBe("bullet_list");
  editor.destroy();
});
