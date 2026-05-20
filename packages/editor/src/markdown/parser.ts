import { defaultMarkdownParser } from "prosemirror-markdown";

// Step 1 placeholder: still using prosemirror-markdown's parser. Step 3 will
// replace this with a hand-written CommonMark-subset parser bound to our schema.
export const markdownParser = defaultMarkdownParser;
