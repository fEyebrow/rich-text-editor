import type { Fragment, Node, Schema } from "prosemirror-model";
import type { Command } from "prosemirror-state";
import { Plugin, PluginKey, TextSelection } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";

const COMPLETE_IMAGE_SOURCE = /!\[([^\]\n]*)\]\(([^)\n]*)\)/g;
const IMAGE_SOURCE_BEFORE_CURSOR = /!\[([^\]\n]*)\]\(([^)\n]*)\)$/;

export type ImageLoadStatus = "empty" | "loading" | "loaded" | "broken";

export interface ImageLoadInfo {
  status: ImageLoadStatus;
  width?: number;
  height?: number;
}

export const imagePluginKey = new PluginKey<Map<string, ImageLoadInfo>>("live-image");

export function imageKeymap(schema: Schema): Record<string, Command> {
  return {
    Backspace: deleteImageSourceClosingParen(),
    Space: commitImageSourceOnSpace(schema),
  };
}

export function liveImage(schema: Schema) {
  return new Plugin<Map<string, ImageLoadInfo>>({
    key: imagePluginKey,
    state: {
      init: () => new Map(),
      apply(tr, value) {
        const meta = tr.getMeta(imagePluginKey) as ImageLoadMeta | undefined;
        if (!meta) return value;
        const next = new Map(value);
        next.set(meta.src, meta.info);
        return next;
      },
    },
    props: {
      clipboardTextSerializer(slice) {
        return serializeImageMarkdownFragment(slice.content);
      },
      handleClickOn(view, pos, node) {
        if (node.type.name !== "image") return false;
        const alt = typeof node.attrs.alt === "string" ? node.attrs.alt : "";
        const src = typeof node.attrs.src === "string" ? node.attrs.src : "";
        const tr = view.state.tr.replaceWith(
          pos,
          pos + node.nodeSize,
          schema.text(imageSource(alt, src)),
        );
        tr.setSelection(TextSelection.create(tr.doc, pos + 2 + alt.length));
        view.dispatch(tr);
        return true;
      },
      decorations(state) {
        const loadStates = imagePluginKey.getState(state) ?? new Map();
        const decos: Decoration[] = [];
        state.doc.descendants((node, pos) => {
          if (!node.isTextblock) return true;

          const text = node.textBetween(0, node.content.size, "\n", "\ufffc");
          for (const match of text.matchAll(COMPLETE_IMAGE_SOURCE)) {
            const offset = match.index ?? 0;
            if (textRangeHasMarkName(node, offset, match[0].length, "code")) continue;

            const from = pos + 1 + offset;
            const alt = match[1];
            const src = match[2];
            const altFrom = from + 2;
            const altTo = altFrom + alt.length;
            const srcFrom = altTo + 2;
            const srcTo = srcFrom + src.length;
            const to = from + match[0].length;
            const loadInfo = imageLoadInfo(src, loadStates);

            decos.push(imageStateWidget(from, loadInfo.status, -1));
            decos.push(Decoration.inline(from, altFrom, { class: "md-pending" }));
            if (altFrom < altTo) {
              decos.push(
                Decoration.inline(
                  altFrom,
                  altTo,
                  { class: "md-live-image-alt" },
                  { inclusiveEnd: true },
                ),
              );
            }
            decos.push(Decoration.inline(altTo, srcFrom, { class: "md-pending" }));
            if (srcFrom < srcTo) {
              decos.push(Decoration.inline(srcFrom, srcTo, { class: "md-live-image-src" }));
            }
            decos.push(Decoration.inline(srcTo, to, { class: "md-pending" }));
            if (loadInfo.status === "loading" || loadInfo.status === "broken") {
              decos.push(imageStatusWidget(to, loadInfo, -1));
            }
            if (loadInfo.status === "loaded")
              decos.push(imagePreviewWidget(to, src, alt, loadInfo));
          }

          return false;
        });
        return DecorationSet.create(state.doc, decos);
      },
    },
    view(view) {
      const pending = new Set<string>();
      const ensureLoads = () => {
        const state = view.state;
        const loadStates = imagePluginKey.getState(state) ?? new Map();
        state.doc.descendants((node) => {
          if (!node.isTextblock) return true;
          const text = node.textBetween(0, node.content.size, "\n", "\ufffc");
          for (const match of text.matchAll(COMPLETE_IMAGE_SOURCE)) {
            const src = match[2];
            if (!src || loadStates.has(src) || pending.has(src)) continue;
            pending.add(src);
            const img = new Image();
            img.onload = () => {
              pending.delete(src);
              view.dispatch(
                view.state.tr.setMeta(imagePluginKey, {
                  src,
                  info: { status: "loaded", width: img.naturalWidth, height: img.naturalHeight },
                } satisfies ImageLoadMeta),
              );
            };
            img.onerror = () => {
              pending.delete(src);
              view.dispatch(
                view.state.tr.setMeta(imagePluginKey, {
                  src,
                  info: { status: "broken" },
                } satisfies ImageLoadMeta),
              );
            };
            img.src = src;
          }
          return false;
        });
      };
      ensureLoads();
      return { update: ensureLoads };
    },
    appendTransaction(_transactions, oldState, newState) {
      const { selection } = newState;
      if (!oldState.selection.empty || !selection.empty) return null;
      if (!oldState.doc.eq(newState.doc)) return null;

      const range = imageSourceRangeContainingPosition(newState.doc, oldState.selection.from);
      if (range) {
        const loadInfo = imageLoadInfo(range.src, imagePluginKey.getState(newState) ?? new Map());
        if (loadInfo.status !== "loaded") return null;
        if (selection.from > range.from && selection.from < range.to) return null;

        const tr = newState.tr.replaceWith(
          range.from,
          range.to,
          schema.nodes.image.create({ src: range.src, alt: range.alt, title: null }),
        );
        const leavingRight = selection.from >= range.to;
        const cursor = leavingRight ? range.from + 1 : range.from;
        tr.setSelection(TextSelection.create(tr.doc, cursor));
        return tr;
      }

      const imageRange = imageNodeRangeContainingPosition(newState.doc, selection.from);
      if (!imageRange) return null;
      const source = imageSource(imageRange.alt, imageRange.src);
      const tr = newState.tr.replaceWith(imageRange.from, imageRange.to, schema.text(source));
      const cursor = imageRange.from + 2 + imageRange.alt.length;
      tr.setSelection(TextSelection.create(tr.doc, cursor));
      return tr;
    },
  });
}

export function imageLoadInfo(
  src: string,
  known: ReadonlyMap<string, ImageLoadInfo>,
): ImageLoadInfo {
  if (src === "") return { status: "empty" };
  return known.get(src) ?? { status: "loading" };
}

export function imageSource(alt: string, src: string): string {
  return `![${alt}](${src})`;
}

export function serializeImageMarkdownFragment(fragment: Fragment): string {
  const parts: string[] = [];
  fragment.forEach((node) => {
    if (node.type.name === "image") {
      const alt = typeof node.attrs.alt === "string" ? node.attrs.alt : "";
      const src = typeof node.attrs.src === "string" ? node.attrs.src : "";
      parts.push(imageSource(alt, src));
      return;
    }
    if (node.isText) {
      parts.push(node.text ?? "");
      return;
    }
    if (node.content.size) {
      parts.push(serializeImageMarkdownFragment(node.content));
      if (node.isBlock) parts.push("\n\n");
    }
  });
  return parts.join("").replace(/\n\n$/, "");
}

interface ImageSourceRange {
  from: number;
  to: number;
  alt: string;
  src: string;
}

interface ImageNodeRange {
  from: number;
  to: number;
  alt: string;
  src: string;
}

interface ImageLoadMeta {
  src: string;
  info: ImageLoadInfo;
}

function commitImageSourceOnSpace(schema: Schema): Command {
  return (state, dispatch) => {
    const { $from, empty } = state.selection;
    if (!empty || !$from.parent.isTextblock) return false;

    const before = $from.parent.textBetween(0, $from.parentOffset, "\n", "\ufffc");
    const match = IMAGE_SOURCE_BEFORE_CURSOR.exec(before);
    if (!match) return false;
    const loadInfo = imageLoadInfo(match[2], imagePluginKey.getState(state) ?? new Map());
    if (loadInfo.status !== "loaded") return false;

    const from = $from.pos - match[0].length;
    if (
      textRangeHasMarkName(
        $from.parent,
        $from.parentOffset - match[0].length,
        match[0].length,
        "code",
      )
    ) {
      return false;
    }

    if (dispatch) {
      const tr = state.tr.replaceWith(from, $from.pos, [
        schema.nodes.image.create({ src: match[2], alt: match[1], title: null }),
        schema.text("\u00a0"),
      ]);
      tr.setSelection(TextSelection.create(tr.doc, from + 2));
      dispatch(tr);
    }

    return true;
  };
}

function deleteImageSourceClosingParen(): Command {
  return (state, dispatch) => {
    const { $from, empty } = state.selection;
    if (!empty || !$from.parent.isTextblock || $from.parentOffset === 0) return false;

    const before = $from.parent.textBetween(0, $from.parentOffset, "\n", "\ufffc");
    if (!IMAGE_SOURCE_BEFORE_CURSOR.test(before)) return false;

    if (dispatch) dispatch(state.tr.delete($from.pos - 1, $from.pos));
    return true;
  };
}

function imageSourceRangeContainingPosition(doc: Node, position: number): ImageSourceRange | null {
  let result: ImageSourceRange | null = null;

  doc.descendants((node, pos) => {
    if (result) return false;
    if (!node.isTextblock) return true;

    const text = node.textBetween(0, node.content.size, "\n", "\ufffc");
    for (const match of text.matchAll(COMPLETE_IMAGE_SOURCE)) {
      const offset = match.index ?? 0;
      if (textRangeHasMarkName(node, offset, match[0].length, "code")) continue;
      const from = pos + 1 + offset;
      const to = from + match[0].length;
      if (position > from && position < to) {
        result = { from, to, alt: match[1], src: match[2] };
        return false;
      }
    }

    return false;
  });

  return result;
}

function imageNodeRangeContainingPosition(doc: Node, position: number): ImageNodeRange | null {
  let result: ImageNodeRange | null = null;

  doc.descendants((node, pos) => {
    if (result) return false;
    if (node.type.name !== "image") return true;

    const from = pos;
    const to = pos + node.nodeSize;
    if (position >= from && position <= to) {
      result = {
        from,
        to,
        alt: typeof node.attrs.alt === "string" ? node.attrs.alt : "",
        src: typeof node.attrs.src === "string" ? node.attrs.src : "",
      };
      return false;
    }

    return true;
  });

  return result;
}

function textRangeHasMarkName(node: Node, from: number, length: number, markName: string): boolean {
  const to = from + length;
  let offset = 0;
  let hasMark = false;

  node.forEach((child) => {
    if (hasMark) return;
    const childFrom = offset;
    const childTo = offset + child.nodeSize;
    offset = childTo;
    if (childTo <= from || childFrom >= to) return;
    if (child.marks.some((mark) => mark.type.name === markName)) hasMark = true;
  });

  return hasMark;
}

function imageStateWidget(pos: number, _status: ImageLoadStatus, side: number): Decoration {
  return Decoration.widget(pos, () => imageStatusElement("md-live-image-state", "image"), {
    marks: [],
    side,
  });
}

function imageStatusWidget(pos: number, info: ImageLoadInfo, side: number): Decoration {
  return Decoration.widget(
    pos,
    () => imageStatusElement(`md-live-image-${info.status}`, info.status),
    {
      marks: [],
      side,
    },
  );
}

function imagePreviewWidget(
  pos: number,
  src: string,
  alt: string,
  info: ImageLoadInfo,
): Decoration {
  return Decoration.widget(
    pos,
    () => {
      const preview = document.createElement("img");
      preview.className = "md-live-image-preview";
      preview.src = src;
      preview.alt = alt;
      preview.draggable = false;
      preview.contentEditable = "false";
      if (info.width && info.height) {
        preview.dataset.width = String(info.width);
        preview.dataset.height = String(info.height);
      }
      return preview;
    },
    { marks: [], side: 2 },
  );
}

function imageStatusElement(className: string, text: ImageLoadStatus | "image"): HTMLElement {
  const element = document.createElement("span");
  element.className = className;
  element.contentEditable = "false";
  element.textContent = text === "empty" ? "image" : text;
  return element;
}
