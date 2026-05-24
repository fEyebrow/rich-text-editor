# Phase 1 Scope

Typora-style live preview editor. First phase locks in the live inline mark loop and basic block structure; everything else is deferred.

## In scope

### Inline marks

- Bold `**`
- Italic `*`
- Inline code `` ` ``
- Strikethrough `~~`

### Block structure

- ATX heading `#`–`######` + space
- Paragraph (blank-line separated)
- Unordered list `-` / `*` / `+`
- Ordered list `1.`
- Blockquote `>`
- Thematic break `---`
- Fenced code block ` ``` `

### Interaction

- Pending markers show when caret enters a live inline mark; hide on exit
- Closing delimiter triggers immediate render
- List continuation on Enter; empty item exits list
- Tab / Shift+Tab indent and outdent

## Deferred to later phases

- Tables, task lists, links, images, autolinks
- Highlight `==`, sub/superscript, emoji shortcodes, inline/block math
- Setext headings, indented code blocks, footnotes, YAML front matter, `[TOC]`, Mermaid
- Smart punctuation, paste-URL-to-link, drag-in images

## Out of scope

- HTML blocks / inline HTML
- Reference-style links
- `_` / `__` intra-word boundary rules (only `*` / `**` supported)

## Rationale

Phase 1 keeps the focus on the live inline mark domain model (pending markers, commit) and core block scaffolding. Features with independent interaction complexity (tables, links) wait until the core loop is stable.
