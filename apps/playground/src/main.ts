import "@rte/editor/style.css";
import "./style.css";
import { createEditor } from "@rte/editor";
import { renderSpecs } from "./specs.ts";

const initial = `# Hello, ProseMirror

This is a **Typora-style** markdown editor playground built on \`prosemirror-markdown\`.

- bullet one
- bullet two

> Quote block

---

\`\`\`ts
const x: number = 42;
\`\`\`
`;

const app = document.querySelector<HTMLElement>("#app")!;

if (window.location.pathname === "/specs") {
  renderSpecs(app);
} else {
  renderEditor(app);
}

function renderEditor(root: HTMLElement): void {
  root.innerHTML = `
    <div class="shell shell-soft">
      ${renderTopbar("editor")}
      <main class="page-wrap">
        <section class="workbench">
          <div class="workbench-head">
            <div>
              <h2>Editor Playground</h2>
              <p class="hint">A shared surface for editing on the left and inspecting markdown on the right.</p>
            </div>
          </div>
          <div class="editor-grid">
            <section class="editor-card">
              <div id="editor"></div>
            </section>
            <section class="side-card side-card-muted">
              <div class="side-card-head">
                <span>markdown</span>
              </div>
              <pre><code id="source"></code></pre>
            </section>
          </div>
        </section>
      </main>
    </div>
  `;

  const mount = root.querySelector<HTMLElement>("#editor")!;
  const source = root.querySelector<HTMLElement>("#source")!;

  const editor = createEditor({
    mount,
    initialMarkdown: initial,
    onChange: (md) => {
      source.textContent = md;
    },
  });

  source.textContent = editor.getMarkdown();
}

function renderTopbar(active: "editor" | "specs"): string {
  return `
    <header class="topbar topbar-minimal">
      <div class="brandrow">
        <a class="brandmark" href="/">Typora</a>
        <nav class="topnav topnav-minimal" aria-label="Sections">
          <a class="navlink navlink-minimal${active === "editor" ? " active" : ""}" href="/">Editor</a>
          <a class="navlink navlink-minimal${active === "specs" ? " active" : ""}" href="/specs">Specs</a>
        </nav>
      </div>
    </header>
  `;
}
