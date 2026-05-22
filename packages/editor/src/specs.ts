export interface EditorSpecStep {
  title: string;
  input: string;
  expectation: string;
  expectedProjection: string;
}

export interface EditorSpecCase {
  id: string;
  title: string;
  summary: string;
  steps: EditorSpecStep[];
}

export interface EditorSpecFeature {
  id: string;
  title: string;
  description: string;
  cases: EditorSpecCase[];
}

export const EDITOR_SPEC_FEATURES: EditorSpecFeature[] = [
  {
    id: "live-italic",
    title: "Live Italic",
    description: "Typora-style pending marker preview and commit flow.",
    cases: [
      {
        id: "live-italic-basic",
        title: "Basic commit flow",
        summary: "Type from * to committed italic text.",
        steps: [
          {
            title: "step 1",
            input: "*",
            expectation: "plain text, no preview",
            expectedProjection: "<p>*|</p>",
          },
          {
            title: "step 2",
            input: "1",
            expectation: "plain text, no preview",
            expectedProjection: "<p>*1|</p>",
          },
          {
            title: "step 3",
            input: "*",
            expectation: "preview only, markers pending",
            expectedProjection: "<p><pending>*</pending>1<pending>*</pending>|</p>",
          },
          {
            title: "step 4",
            input: " ",
            expectation: "commit, markers removed, text italic",
            expectedProjection: "<p><i>1</i> |</p>",
          },
        ],
      },
    ],
  },
];
