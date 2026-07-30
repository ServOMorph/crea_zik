import { cleanup, render, screen } from "@testing-library/react";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PluginBench } from "./PluginBench";

const plugins = [{ plugin_id: "kick", name: "Kick", version: "v0.1.0", presets: ["techno"] }];
const manifest = {
  schema_version: 1,
  plugin_id: "kick",
  name: "Kick",
  version: "v0.1.0",
  kind: "one_shot",
  engine: { module: "engine", function: "render", sample_rate: 48000 },
  parameter_groups: [
    {
      id: "corps",
      label: "Corps",
      parameters: [
        { id: "pitch_start", type: "float", min: 20, max: 400, default: 180, unit: "hz", curve: "linear" },
        { id: "sub_enabled", type: "bool", default: true },
        { id: "click_type", type: "enum", default: "noise", values: ["noise", "sine", "impulse"] },
      ],
    },
  ],
  presets: ["techno"],
};
const technoParams = { pitch_start: 180, sub_enabled: true, click_type: "noise" };

function jsonResponse(payload: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  } as Response;
}

describe("PluginBench accessibility", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL | Request) => {
        const path = String(input);
        if (path === "/api/plugins") return Promise.resolve(jsonResponse(plugins));
        if (path === "/api/plugins/kick/manifest") return Promise.resolve(jsonResponse(manifest));
        if (path === "/api/plugins/kick/presets/techno") return Promise.resolve(jsonResponse(technoParams));
        return Promise.resolve(jsonResponse({ detail: "Introuvable" }, 404));
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("has no automatically detectable accessibility violations once controls are loaded", async () => {
    const { container } = render(<PluginBench />);
    await screen.findByLabelText(/pitch_start/);

    const results = await axe.run(container, {
      rules: {
        "color-contrast": { enabled: false },
      },
    });

    expect(results.violations).toEqual([]);
  });
});
