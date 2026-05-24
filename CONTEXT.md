# Rich Text Editor

A Typora-style Markdown editor context for describing how Markdown source text is represented while editing.

## Language

**Inline mark**:
A Markdown-delimited inline style that applies to text within a block.
_Avoid_: inline feature, inline style

**Live inline mark**:
An **Inline mark** that shows its Markdown delimiters while rendering its content as styled text before commit.
_Avoid_: realtime mark, live display

**Pending marker**:
A visible Markdown delimiter belonging to an uncommitted **Live inline mark**.
_Avoid_: syntax marker, hidden marker

## Relationships

- A **Live inline mark** contains zero or more **Pending markers** before it is committed.
- A **Live inline mark** renders its content as styled text both before and after commit.
- A committed **Live inline mark** removes its **Pending markers**.

## Example dialogue

> **Dev:** "Should `**text**` become bold immediately when the second `**` is typed?"
> **Domain expert:** "Yes — it remains a **Live inline mark** with **Pending markers**, but `text` is already bold before the commit keystroke."

## Flagged ambiguities

- "Other inline mark" was narrowed to the existing strong and inline code marks for this slice; strikethrough and highlight remain out of scope until they become domain terms.
