import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PluginBench } from "./PluginBench";

const plugins = [{ plugin_id: "kick", name: "Kick", version: "v0.1.0", presets: ["techno", "808_sub"] }];
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
  presets: ["techno", "808_sub"],
};
const technoParams = { pitch_start: 180, sub_enabled: true, click_type: "noise" };
const artifact = {
  wav: "plugins/kick/render.wav",
  sha256: "abc123",
  duration_seconds: 0.9,
  peak: 0.98,
  dc_offset: 0,
  is_clipping: false,
  sample_rate: 48000,
  channels: 2,
};

function jsonResponse(payload: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  } as Response;
}

describe("PluginBench", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL | Request, init?: RequestInit) => {
        const path = String(input);
        if (path === "/api/plugins") return Promise.resolve(jsonResponse(plugins));
        if (path === "/api/plugins/kick/manifest") return Promise.resolve(jsonResponse(manifest));
        if (path === "/api/plugins/kick/presets/techno") return Promise.resolve(jsonResponse(technoParams));
        if (path === "/api/plugins/kick/render" && init?.method === "POST") {
          return Promise.resolve(jsonResponse(artifact));
        }
        return Promise.resolve(jsonResponse({ detail: "Introuvable" }, 404));
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("charge le manifeste et génère les contrôles du preset par défaut", async () => {
    render(<PluginBench />);

    expect(await screen.findByRole("group", { name: "Corps" })).toBeVisible();
    expect(screen.getByLabelText(/pitch_start/)).toHaveValue("180");
    expect(screen.getByLabelText("sub_enabled")).toBeChecked();
    expect(screen.getByLabelText("click_type")).toHaveValue("noise");
  });

  it("déclenche un rendu et affiche le lecteur audio", async () => {
    const user = userEvent.setup();
    render(<PluginBench />);

    await screen.findByLabelText(/pitch_start/);
    await user.click(screen.getByRole("button", { name: "Rendre" }));

    expect(await screen.findByRole("link", { name: "Télécharger le WAV" })).toHaveAttribute(
      "href",
      "/projects/plugins/kick/render.wav",
    );
  });

  it("réinitialise les paramètres depuis le preset courant", async () => {
    const user = userEvent.setup();
    render(<PluginBench />);

    const pitchInput = await screen.findByLabelText(/pitch_start/);
    fireEvent.change(pitchInput, { target: { value: "250" } });
    expect(pitchInput).toHaveValue("250");

    await user.click(screen.getByRole("button", { name: "Réinitialiser" }));

    expect(await screen.findByLabelText(/pitch_start/)).toHaveValue("180");
  });
});
