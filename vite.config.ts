import { defineConfig } from "vite-plus";

export default defineConfig({
  staged: {
    "packages/editor/**/*": () => [
      "vp run --filter ./packages/editor check --fix",
      "vp run --filter ./packages/editor test --run",
    ],
    "*": "vp check --fix",
  },
  fmt: {},
  lint: { options: { typeAware: true, typeCheck: true } },
  run: {
    cache: true,
  },
  test: {
    environment: "jsdom",
  },
});
