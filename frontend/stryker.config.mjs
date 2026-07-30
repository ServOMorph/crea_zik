export default {
  testRunner: "vitest",
  reporters: ["clear-text", "progress", "json"],
  // Scope V0 : preuve de câblage sur une fonction temporelle critique déjà testée.
  // Extension à l'ensemble du store et des transformations critiques prévue en phase V4.
  mutate: ["src/editor/transport.ts"],
  coverageAnalysis: "perTest",
  thresholds: {
    high: 80,
    low: 60,
    break: 60,
  },
};
