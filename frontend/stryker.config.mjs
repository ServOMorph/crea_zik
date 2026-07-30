export default {
  testRunner: "vitest",
  reporters: ["clear-text", "progress"],
  mutate: ["src/**/*.{ts,tsx}"],
  coverageAnalysis: "perTest",
};
