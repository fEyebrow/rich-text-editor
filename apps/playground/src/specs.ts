import {
  createEditor,
  EDITOR_SPEC_FEATURES,
  type EditorHandle,
  type EditorSpecCase,
} from "@rte/editor";
import { EditorState, TextSelection } from "prosemirror-state";

interface Snapshot {
  index: number;
  projection: string;
  expectedProjection: string | null;
  passed: boolean | null;
}

const FEATURES = EDITOR_SPEC_FEATURES;

export function renderSpecs(root: HTMLElement): void {
  let activeFeatureId = FEATURES[0]?.id ?? "";

  root.innerHTML = `
    <div class="shell shell-soft">
      <header class="topbar topbar-minimal">
        <div class="brandrow">
          <a class="brandmark" href="/">Typora</a>
          <nav class="topnav topnav-minimal" aria-label="Sections">
            <a class="navlink navlink-minimal" href="/">Editor</a>
            <a class="navlink navlink-minimal active" href="/specs">Specs</a>
          </nav>
        </div>
      </header>
      <main class="page-wrap page-wrap-top">
        <section class="specs-shell">
          <aside class="specs-sidebar">
            <div class="specs-sidebar-head">
              <h2>Features</h2>
            </div>
            <nav id="feature-list" class="feature-list" aria-label="Feature specs"></nav>
          </aside>
          <section class="specs-content">
            <div class="specs-content-head">
              <div>
                <h2 id="feature-title"></h2>
                <p id="feature-description" class="hint"></p>
              </div>
            </div>
            <div id="spec-case-list" class="spec-case-list"></div>
          </section>
        </section>
      </main>
    </div>
  `;

  const featureList = root.querySelector<HTMLElement>("#feature-list")!;
  const featureTitle = root.querySelector<HTMLElement>("#feature-title")!;
  const featureDescription = root.querySelector<HTMLElement>("#feature-description")!;
  const caseList = root.querySelector<HTMLElement>("#spec-case-list")!;

  renderFeatureList();
  renderActiveFeature();

  root.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const featureId = target.dataset.featureId;
    if (featureId && featureId !== activeFeatureId) {
      activeFeatureId = featureId;
      renderFeatureList();
      renderActiveFeature();
    }
  });

  function renderFeatureList(): void {
    featureList.innerHTML = FEATURES.map((feature) => {
      const isActive = feature.id === activeFeatureId;
      return `
        <button
          type="button"
          class="feature-item${isActive ? " active" : ""}"
          data-feature-id="${feature.id}"
        >
          <span class="feature-item-title">${feature.title}</span>
          <span class="feature-item-copy">${feature.description}</span>
        </button>
      `;
    }).join("");
  }

  function renderActiveFeature(): void {
    const feature = FEATURES.find((item) => item.id === activeFeatureId) ?? FEATURES[0];
    if (!feature) return;

    featureTitle.textContent = feature.title;
    featureDescription.textContent = feature.description;
    caseList.innerHTML = "";

    for (const specCase of feature.cases) {
      const mount = document.createElement("section");
      mount.className = "spec-case-card";
      caseList.append(mount);
      mountSpecCase(mount, specCase);
    }
  }
}

function mountSpecCase(root: HTMLElement, specCase: EditorSpecCase): void {
  root.innerHTML = `
    <div class="spec-case-head">
      <div>
        <h3>${specCase.title}</h3>
        <p class="hint">${specCase.summary}</p>
        <p class="hint" data-role="step-summary"></p>
      </div>
      <div class="player-meta">
        <span data-role="progress-text">0/${specCase.steps.length}</span>
        <div class="toolbar toolbar-tight">
          <button type="button" data-action="reset">Reset</button>
          <button type="button" data-action="step">Step</button>
          <button type="button" data-action="play" data-role="play-button">Play</button>
        </div>
      </div>
    </div>

    <section class="editor-stage">
      <div class="editor-stage-surface">
        <div data-role="editor"></div>
      </div>
    </section>

    <section class="projection-card">
      <div class="projection-head">
        <span>editorview dom</span>
        <button type="button" class="copylink" data-action="copy-projection">copy</button>
      </div>
      <pre data-role="projection-out" class="projection-output"></pre>
    </section>

    <section class="history-card">
      <div class="history-head">
        <span>checkpoints</span>
        <span data-role="checkpoint-text">0/${specCase.steps.length}</span>
      </div>
      <ol data-role="history-out" class="history-list"></ol>
    </section>
  `;

  const mount = root.querySelector<HTMLElement>('[data-role="editor"]')!;
  const stepSummary = root.querySelector<HTMLElement>('[data-role="step-summary"]')!;
  const projectionOut = root.querySelector<HTMLElement>('[data-role="projection-out"]')!;
  const historyOut = root.querySelector<HTMLOListElement>('[data-role="history-out"]')!;
  const playButton = root.querySelector<HTMLButtonElement>('[data-role="play-button"]')!;
  const progressText = root.querySelector<HTMLElement>('[data-role="progress-text"]')!;
  const checkpointText = root.querySelector<HTMLElement>('[data-role="checkpoint-text"]')!;

  const editor = createEditor({
    mount,
    onChange: updateOutputs,
  });

  let currentStep = 0;
  let playTimer: number | null = null;
  let snapshots: Snapshot[] = [];

  root.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const action = target.dataset.action;
    if (!action) return;

    if (action === "reset") resetEditor();
    if (action === "step") runNextStep();
    if (action === "play") togglePlay();
    if (action === "copy-projection") {
      await navigator.clipboard.writeText(projectionOut.textContent ?? "");
    }
  });

  resetEditor();

  function resetEditor(): void {
    stopPlay();
    setLiteralParagraph(editor, "");
    currentStep = 0;
    snapshots = [makeSnapshot(0)];
    updateOutputs();
  }

  function runNextStep(): void {
    if (currentStep >= specCase.steps.length) {
      stopPlay();
      return;
    }

    const step = specCase.steps[currentStep];
    typeText(editor.view, step.input);
    currentStep += 1;
    snapshots = [...snapshots, makeSnapshot(currentStep)];
    updateOutputs();

    if (currentStep >= specCase.steps.length) stopPlay();
  }

  function togglePlay(): void {
    if (playTimer !== null) {
      stopPlay();
      return;
    }

    if (currentStep >= specCase.steps.length) resetEditor();

    playButton.textContent = "Pause";
    playTimer = window.setInterval(() => {
      runNextStep();
      if (currentStep >= specCase.steps.length) stopPlay();
    }, 900);
  }

  function stopPlay(): void {
    if (playTimer !== null) {
      window.clearInterval(playTimer);
      playTimer = null;
    }
    playButton.textContent = "Play";
  }

  function updateOutputs(): void {
    const activeStep = currentStep === 0 ? null : specCase.steps[currentStep - 1];

    stepSummary.textContent =
      currentStep === 0
        ? "Ready. Start from an empty paragraph and replay the test sequence."
        : `${activeStep?.title}: ${activeStep?.expectation}`;

    progressText.textContent = `${currentStep}/${specCase.steps.length}`;
    const passedCount = snapshots.filter((snapshot) => snapshot.passed === true).length;
    const failedCount = snapshots.filter((snapshot) => snapshot.passed === false).length;
    checkpointText.textContent =
      failedCount > 0
        ? `${passedCount} passed, ${failedCount} failed`
        : `${passedCount}/${specCase.steps.length} passed`;
    projectionOut.textContent = projectEditorView(editor);
    historyOut.innerHTML = snapshots
      .map((snapshot) => renderSnapshot(snapshot, snapshot.index === currentStep))
      .join("");
  }

  function makeSnapshot(index: number): Snapshot {
    const projection = projectEditorView(editor);
    const expectedProjection =
      index === 0 ? null : (specCase.steps[index - 1]?.expectedProjection ?? null);

    return {
      index,
      projection,
      expectedProjection,
      passed: expectedProjection === null ? null : projection === expectedProjection,
    };
  }
}

function renderSnapshot(snapshot: Snapshot, isActive: boolean): string {
  const label = `@${snapshot.index}`;
  const status = snapshot.passed === null ? "ready" : snapshot.passed ? "pass" : "fail";
  const statusLabel = status.toUpperCase();
  const expected = snapshot.expectedProjection;

  return `
    <li class="history-item ${status}${isActive ? " active" : ""}">
      <span class="history-index">${label}</span>
      <div class="history-body">
        <span class="history-status">${statusLabel}</span>
        ${
          expected === null
            ? `<pre class="history-value">${escapeHtml(snapshot.projection)}</pre>`
            : `
              <dl class="assertion">
                <div>
                  <dt>expected</dt>
                  <dd><pre class="history-value">${escapeHtml(expected)}</pre></dd>
                </div>
                <div>
                  <dt>actual</dt>
                  <dd><pre class="history-value">${escapeHtml(snapshot.projection)}</pre></dd>
                </div>
              </dl>
            `
        }
      </div>
    </li>
  `;
}

function setLiteralParagraph(editor: EditorHandle, text: string): void {
  const { schema } = editor.view.state;
  const content = text ? [schema.text(text)] : undefined;
  const paragraph = schema.nodes.paragraph.create(null, content);
  const doc = schema.topNodeType.createAndFill(null, [paragraph]);

  if (!doc) return;

  let next = EditorState.create({
    doc,
    schema,
    plugins: editor.view.state.plugins,
  });
  next = next.apply(next.tr.setSelection(TextSelection.atEnd(next.doc)));
  editor.view.updateState(next);
}

function typeText(view: EditorHandle["view"], text: string): void {
  for (const ch of text) {
    const { from, to } = view.state.selection;
    view.dispatch(view.state.tr.insertText(ch, from, to));
  }
}

function projectEditorView(editor: EditorHandle): string {
  const viewRoot = editor.view.dom;
  const cursor = editor.view.domAtPos(editor.view.state.selection.from);
  return serializeNode(viewRoot, cursor).trimEnd() || "|";
}

function serializeNode(node: Node, cursor: { node: Node; offset: number }): string {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = normalizeText(node.textContent ?? "");
    if (node === cursor.node) {
      return `${text.slice(0, cursor.offset)}|${text.slice(cursor.offset)}`;
    }
    return text;
  }

  if (!(node instanceof HTMLElement)) return "";

  const children = Array.from(node.childNodes);
  const parts: string[] = [];

  if (node === cursor.node && cursor.offset === 0) parts.push("|");

  children.forEach((child, index) => {
    parts.push(serializeNode(child, cursor));
    if (node === cursor.node && cursor.offset === index + 1) parts.push("|");
  });

  const content = parts.join("");

  if (node.classList.contains("ProseMirror")) return content;
  if (node.classList.contains("md-pending")) return `<pending>${content}</pending>`;
  if (node.tagName === "EM" || node.tagName === "I") return `<i>${content}</i>`;
  if (node.tagName === "P") return `<p>${content}</p>`;
  return content;
}

function normalizeText(value: string): string {
  return value.replaceAll("\u00a0", " ").replaceAll("\n", "");
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
