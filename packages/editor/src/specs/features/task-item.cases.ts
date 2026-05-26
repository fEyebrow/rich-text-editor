import type { EditorSpecFeatureDefinition } from "../types.ts";

export const taskItemSpec = {
  id: "task-item",
  title: "Task Item",
  cases: [
    {
      id: "task-item-unchecked-trigger",
      title: "[ ]  at list item start creates unchecked task item",
      initialMarkdown: "- |",
      keyevents: ["[", " ", "]", " "],
      checkpoints: [
        {
          step: 4,
          expectedProjection: '<ul><task-item checked="false"><p>|</p></task-item></ul>',
          expectedMarkdown: "* [ ] ",
        },
      ],
    },
    {
      id: "task-item-checked-trigger",
      title: "[x]  at list item start creates checked task item",
      initialMarkdown: "- |",
      keyevents: ["[", "x", "]", " "],
      checkpoints: [
        {
          step: 4,
          expectedProjection: '<ul><task-item checked="true"><p>|</p></task-item></ul>',
          expectedMarkdown: "* [x] ",
        },
      ],
    },
    {
      id: "task-item-checked-uppercase-trigger",
      title: "[X]  at list item start creates checked task item (normalized to [x])",
      initialMarkdown: "- |",
      keyevents: ["[", "X", "]", " "],
      checkpoints: [
        {
          step: 4,
          expectedProjection: '<ul><task-item checked="true"><p>|</p></task-item></ul>',
          expectedMarkdown: "* [x] ",
        },
      ],
    },
    {
      id: "task-item-markdown-round-trip",
      title: "task list markdown parses and serializes correctly",
      initialMarkdown: "- [ ] todo\n- [x] done|",
      keyevents: ["ArrowLeft", "ArrowRight"],
      checkpoints: [
        {
          step: 2,
          expectedProjection:
            '<ul><task-item checked="false"><p>todo</p></task-item><task-item checked="true"><p>done|</p></task-item></ul>',
          expectedMarkdown: "* [ ] todo\n* [x] done",
        },
      ],
    },
  ],
} satisfies EditorSpecFeatureDefinition;
