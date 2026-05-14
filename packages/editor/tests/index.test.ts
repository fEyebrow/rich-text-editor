import { expect, test } from "vite-plus/test";
import { defaultMarkdownSerializer } from "prosemirror-markdown";
import { createEditor } from "../src/index.ts";

test("createEditor mounts and round-trips markdown", () => {
  const mount = document.createElement("div");
  const editor = createEditor({ mount, initialMarkdown: "# Hello\n\nworld" });
  expect(editor.getMarkdown()).toBe(defaultMarkdownSerializer.serialize(editor.view.state.doc));
  expect(editor.getMarkdown()).toContain("# Hello");
  editor.destroy();
});
