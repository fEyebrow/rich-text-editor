import { expect, test } from "vite-plus/test";
import { createEditor, EDITOR_SPEC_FEATURES, type EditorHandle } from "../src/index.ts";
import { typeText } from "./helpers.ts";

const maybeLiveItalicCase = EDITOR_SPEC_FEATURES.find(
  (feature) => feature.id === "live-italic",
)?.cases.find((specCase) => specCase.id === "live-italic-basic");

if (!maybeLiveItalicCase) {
  throw new Error("Missing shared live italic spec case.");
}

const liveItalicCase = maybeLiveItalicCase;

// Models the Typora-like live italic transform, step-by-step.
// `|` = cursor; `<pending>` = pending marker decoration.
//   1. `*|`     → `<p>*|</p>`                                      (plain)
//   2. `*1|`    → `<p>*1|</p>`                                     (plain)
//   3. `*1*|`   → `<p><pending>*</pending>1<pending>*</pending>|</p>` (preview)
//   4. `*1* |`  → `<p><i>1</i> |</p>`                              (commit)

test("live italic replays the shared spec step-by-step in one editor session", () => {
  const mount = document.createElement("div");
  const editor = createEditor({ mount });

  try {
    liveItalicCase.steps.forEach((step, index) => {
      typeText(editor.view, step.input);
      assertStep(index + 1, editor, mount);
    });
  } finally {
    editor.destroy();
  }
});

function assertStep(stepNumber: number, editor: EditorHandle, mount: HTMLElement): void {
  if (stepNumber === 1) {
    const para = editor.view.state.doc.firstChild!;
    expect(para.textContent).toBe("*");
    expect(para.firstChild?.marks.length ?? 0).toBe(0);
    expect(mount.querySelectorAll(".md-pending").length).toBe(0);
    return;
  }

  if (stepNumber === 2) {
    const para = editor.view.state.doc.firstChild!;
    expect(para.textContent).toBe("*1");
    para.descendants((node) => {
      expect(node.marks.length).toBe(0);
      return true;
    });
    expect(mount.querySelectorAll(".md-pending").length).toBe(0);
    return;
  }

  if (stepNumber === 3) {
    const para = editor.view.state.doc.firstChild!;
    // markers stay in the doc verbatim during preview
    expect(para.textContent).toBe("*1*");
    // and no em mark is applied yet
    para.descendants((node) => {
      expect(node.marks.some((m) => m.type.name === "em")).toBe(false);
      return true;
    });
    // both '*' get a pending-marker decoration
    const pending = mount.querySelectorAll(".md-pending");
    expect(pending.length).toBe(2);
    for (const el of pending) expect(el.textContent).toBe("*");
    return;
  }

  const para = editor.view.state.doc.firstChild!;
  expect(stepNumber).toBe(4);
  expect(para.textContent).toBe("1 ");

  const one = para.firstChild!;
  expect(one.text).toBe("1");
  expect(one.marks.some((m) => m.type.name === "em")).toBe(true);

  const space = para.child(1);
  expect(space.text).toBe(" ");
  expect(space.marks.some((m) => m.type.name === "em")).toBe(false);

  expect(mount.querySelectorAll(".md-pending").length).toBe(0);
}
