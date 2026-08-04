import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EditableComposition } from "./editorStore";
import { TransportBar } from "./TransportBar";

const baseComposition = {
  id: "composition-1",
  revision: 1,
  title: "Test",
  tempo_bpm: 120,
  time_signature: [4, 4] as [number, number],
  render_settings: { duration_seconds: 30 },
  tracks: [],
  patterns: [],
  clips: [],
};

let audioClock = 0;
let pendingFrames: FrameRequestCallback[] = [];
type MockSource = {
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  connect?: (node: unknown) => unknown;
  loop: boolean;
  onended: (() => void) | null;
};
let sources: MockSource[] = [];

class MockAudioContext {
  destination = {};
  resume = vi.fn(async () => undefined);
  close = vi.fn(async () => undefined);
  createGain = vi.fn(() => ({ gain: { value: 0 }, connect: vi.fn() }));
  createBufferSource = vi.fn(() => {
    const source: MockSource = { start: vi.fn(), stop: vi.fn(), loop: false, onended: null };
    (source as { connect?: ReturnType<typeof vi.fn> }).connect = vi.fn(() => source);
    sources.push(source);
    return source;
  });
  decodeAudioData = vi.fn(async () => ({
    numberOfChannels: 1,
    getChannelData: () => new Float32Array(480),
  }));

  get currentTime() {
    return audioClock;
  }
}

function jsonResponse(payload: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => payload } as Response;
}

function wavResponse() {
  return { ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(8) } as Response;
}

function stubApi(options?: { pollState?: "queued" | "running" | "completed" }) {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const path = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      calls.push(`${method} ${path}`);
      if (path === "/api/projects/p1/compositions/c1/render") {
        return jsonResponse({ id: "job-1", state: "running" });
      }
      if (path === "/api/jobs/job-1") {
        return jsonResponse({
          id: "job-1",
          state: options?.pollState ?? "completed",
          wav: options?.pollState ? undefined : "preview.wav",
        });
      }
      if (path === "/api/jobs/job-1/cancel") return jsonResponse({ ok: true });
      if (path === "/projects/preview.wav") return wavResponse();
      return jsonResponse({ detail: "Introuvable" }, 404);
    }),
  );
  return calls;
}

function tickFrames(count = 1) {
  for (let index = 0; index < count && pendingFrames.length; index += 1) {
    const callback = pendingFrames.shift();
    if (callback) act(() => callback(performance.now()));
  }
}

function renderBar(composition: EditableComposition = baseComposition) {
  return render(
    <TransportBar
      composition={composition}
      projectId="p1"
      compositionId="c1"
      ensureSaved={vi.fn(async () => composition as EditableComposition)}
    />,
  );
}

async function playAndWaitReady() {
  fireEvent.click(screen.getByRole("button", { name: "Lire" }));
  await screen.findByText("Préécoute prête.");
  expect(await screen.findByRole("button", { name: "Relancer" })).toBeInTheDocument();
}

describe("TransportBar", () => {
  beforeEach(() => {
    audioClock = 0;
    pendingFrames = [];
    sources = [];
    vi.stubGlobal("AudioContext", MockAudioContext);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      pendingFrames.push(callback);
      return pendingFrames.length;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("synchronise la tête de lecture avec l’horloge audio simulée", async () => {
    stubApi();
    renderBar();

    await playAndWaitReady();
    audioClock = 1;
    tickFrames(2);

    expect(screen.getByText("1.3")).toBeInTheDocument();
  });

  it("met en pause la lecture et fige la position", async () => {
    stubApi();
    renderBar();

    await playAndWaitReady();
    audioClock = 1;
    tickFrames(2);

    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    audioClock = 3;
    tickFrames(2);

    expect(screen.getByRole("button", { name: "Lire" })).toBeInTheDocument();
    expect(screen.getByText("1.3")).toBeInTheDocument();
    expect(screen.queryByText("3.3")).toBeNull();
  });

  it("réutilise une préécoute en cache sans redemander un rendu", async () => {
    const calls = stubApi();
    renderBar();

    await playAndWaitReady();
    fireEvent.click(screen.getByRole("button", { name: "Stop" }));

    fireEvent.click(screen.getByRole("button", { name: "Lire" }));
    await screen.findByText("Préécoute chargée depuis le cache.");

    const renderCalls = calls.filter((call) => call === "POST /api/projects/p1/compositions/c1/render");
    expect(renderCalls).toHaveLength(1);
  });

  it("interrompt la lecture et invalide le cache quand la composition change", async () => {
    stubApi();
    const { rerender } = renderBar();

    await playAndWaitReady();
    rerender(
      <TransportBar
        composition={{ ...baseComposition, title: "Modifié" }}
        projectId="p1"
        compositionId="c1"
        ensureSaved={vi.fn(async () => ({ ...baseComposition, title: "Modifié" }) as EditableComposition)}
      />,
    );

    expect(screen.getByText("Préécoute interrompue : la composition a été modifiée.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lire" })).toBeInTheDocument();
  });

  it("annule une préécoute restée en file quand on s’arrête", async () => {
    const calls = stubApi({ pollState: "queued" });
    renderBar();

    fireEvent.click(screen.getByRole("button", { name: "Lire" }));
    await waitFor(() => expect(calls).toContain("POST /api/projects/p1/compositions/c1/render"));

    fireEvent.click(screen.getByRole("button", { name: "Stop" }));

    await waitFor(() => expect(calls).toContain("POST /api/jobs/job-1/cancel"));
  });

  it("repasse à l’arrêt et positionne la tête à la fin quand la lecture se termine", async () => {
    stubApi();
    renderBar();

    await playAndWaitReady();
    expect(sources.length).toBeGreaterThan(0);
    act(() => {
      sources.at(-1)?.onended?.();
    });

    expect(screen.getByRole("button", { name: "Lire" })).toBeInTheDocument();
    expect(screen.getByText("16.1")).toBeInTheDocument();
  });
});