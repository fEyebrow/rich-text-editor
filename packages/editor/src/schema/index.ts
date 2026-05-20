import { schema } from "prosemirror-markdown";

// Step 1 placeholder: re-export prosemirror-markdown's schema unchanged so the
// directory structure is in place while we still rely on the upstream parser
// and serializer. Step 3 will replace this with an in-repo schema literal.
export const editorSchema = schema;
