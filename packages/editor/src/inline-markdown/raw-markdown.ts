import type { Mark, Node as ProseMirrorNode } from "prosemirror-model";

const markRank = new Map([
  ["link", 0],
  ["strong", 1],
  ["em", 2],
  ["code", 3],
]);

export function serializeTextblockToRawMarkdown(node: ProseMirrorNode): string {
  if (!node.type.isTextblock || node.type.spec.code) return "";

  const inline = serializeInlineContent(node);
  if (node.type.name === "heading") {
    return `${"#".repeat(node.attrs.level)} ${inline}`;
  }

  return inline;
}

function serializeInlineContent(node: ProseMirrorNode): string {
  let out = "";
  let active: Mark[] = [];

  node.forEach((child) => {
    if (!child.isInline) return;

    const marks = sortMarks(child.marks);
    let shared = 0;
    while (shared < active.length && shared < marks.length && active[shared].eq(marks[shared])) {
      shared += 1;
    }

    for (let index = active.length - 1; index >= shared; index -= 1) {
      out += closeMark(active[index]);
    }

    for (let index = shared; index < marks.length; index += 1) {
      out += openMark(marks[index]);
    }

    active = marks;

    if (child.isText) {
      out += child.text ?? "";
      return;
    }

    if (child.type.name === "hard_break") {
      out += "\\\n";
    }
  });

  for (let index = active.length - 1; index >= 0; index -= 1) {
    out += closeMark(active[index]);
  }

  return out;
}

function sortMarks(marks: readonly Mark[]): Mark[] {
  return [...marks].sort(
    (left, right) => (markRank.get(left.type.name) ?? 99) - (markRank.get(right.type.name) ?? 99),
  );
}

function openMark(mark: Mark): string {
  switch (mark.type.name) {
    case "strong":
      return "**";
    case "em":
      return "*";
    case "code":
      return "`";
    case "link":
      return "[";
    default:
      return "";
  }
}

function closeMark(mark: Mark): string {
  switch (mark.type.name) {
    case "strong":
      return "**";
    case "em":
      return "*";
    case "code":
      return "`";
    case "link":
      return `](${escapeLinkDestination(mark.attrs.href)})`;
    default:
      return "";
  }
}

function escapeLinkDestination(href: string): string {
  return href.replace(/[()]/g, "\\$&");
}
