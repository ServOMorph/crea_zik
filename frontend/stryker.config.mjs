export default {
  testRunner: "vitest",
  reporters: ["clear-text", "progress", "json"],
  // Phase V4 : le store d'édition et les conversions temporelles critiques sont mutés.
  mutate: ["src/editor/editorStore.ts", "src/editor/transport.ts"],
  coverageAnalysis: "perTest",
  thresholds: {
    high: 80,
    low: 60,
    break: 60,
  },
};
