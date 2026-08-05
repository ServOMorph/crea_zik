import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { NoteEvent, Pattern } from "./editorStore";
import { StepSequencer } from "./StepSequencer";

const kickEvent = (start_beat: number, velocity = 0.7): NoteEvent => ({
  id: `kick-${start_beat}`,
  start_beat,
  duration_beats: 0.25,
  midi_note: 36,
  velocity,
  probability: 1,
  micro_timing_beats: 0,
  pan: 0,
});

const pattern: Pattern = {
  id: "pattern-1",
  track_id: "track-1",
  events: [
    kickEvent(0),
    kickEvent(1, 1),
    { ...kickEvent(0.5), midi_note: 39, id: "clap-1", velocity: 0.5 },
  ],
};

function renderSequencer(overrides?: {
  stepsPerBeat?: number;
  onSetStep?: ReturnType<typeof vi.fn>;
  onSetStepField?: ReturnType<typeof vi.fn>;
  onPreview?: ReturnType<typeof vi.fn>;
  onStepsPerBeatChange?: ReturnType<typeof vi.fn>;
}) {
  const props = {
    pattern,
    stepsPerBeat: overrides?.stepsPerBeat ?? 2,
    onStepsPerBeatChange: overrides?.onStepsPerBeatChange ?? vi.fn(),
    onSetStep: overrides?.onSetStep ?? vi.fn(),
    onSetStepField: overrides?.onSetStepField ?? vi.fn(),
    onPreview: overrides?.onPreview ?? vi.fn(),
  };
  render(<StepSequencer {...props} />);
  return props;
}

describe("StepSequencer", () => {
  afterEach(cleanup);

  it("affiche une rangée par percussion et le nombre de pas attendu", () => {
    renderSequencer();
    expect(screen.getByText("Kick")).toBeInTheDocument();
    expect(screen.getByText("Clap")).toBeInTheDocument();
    const activeSteps = screen.getAllByRole("button").filter((button) => button.className.includes("is-active"));
    expect(activeSteps).toHaveLength(3);
  });

  it("active un pas vide et désactive un pas occupé", () => {
    const onSetStep = vi.fn();
    renderSequencer({ onSetStep });
    const kickAtBeat3 = screen.getByRole("button", { name: /Kick, pas 7, temps 3 : inactif/ });
    fireEvent.pointerDown(kickAtBeat3);
    expect(onSetStep).toHaveBeenCalledWith(36, 6, true);
    const kickAtBeat1 = screen.getByRole("button", { name: /Kick, pas 3, temps 1 : actif/ });
    fireEvent.pointerDown(kickAtBeat1);
    expect(onSetStep).toHaveBeenCalledWith(36, 2, false);
  });

  it("peint en continu en glissant sur les pas suivants", () => {
    const onSetStep = vi.fn();
    renderSequencer({ onSetStep });
    const empty = screen.getByRole("button", { name: /Kick, pas 5, temps 2 : inactif/ });
    fireEvent.pointerDown(empty);
    const next = screen.getByRole("button", { name: /Kick, pas 6, temps 2.5 : inactif/ });
    fireEvent.pointerEnter(next);
    expect(onSetStep).toHaveBeenCalledWith(36, 4, true);
    expect(onSetStep).toHaveBeenCalledWith(36, 5, true);
  });

  it("efface en glissant depuis un pas occupé", () => {
    const onSetStep = vi.fn();
    renderSequencer({ onSetStep });
    const active = screen.getByRole("button", { name: /Kick, pas 1, temps 0 : actif/ });
    fireEvent.pointerDown(active);
    const occupied = screen.getByRole("button", { name: /Kick, pas 3, temps 1 : actif/ });
    fireEvent.pointerEnter(occupied);
    expect(onSetStep).toHaveBeenCalledWith(36, 0, false);
    expect(onSetStep).toHaveBeenCalledWith(36, 2, false);
  });

  it("édite vélocité, probabilité et accent du pas sélectionné", () => {
    const onSetStepField = vi.fn();
    renderSequencer({ onSetStepField });
    fireEvent.pointerDown(screen.getByRole("button", { name: /Kick, pas 1, temps 0 : actif/ }));
    fireEvent.change(screen.getByRole("slider", { name: "Vélocité du pas" }), { target: { value: "0.35" } });
    expect(onSetStepField).toHaveBeenCalledWith(36, 0, "velocity", 0.35);
    fireEvent.click(screen.getByRole("button", { name: "Accent" }));
    expect(onSetStepField).toHaveBeenCalledWith(36, 0, "velocity", 1);
    fireEvent.change(screen.getByRole("slider", { name: "Probabilité du pas" }), { target: { value: "0.5" } });
    expect(onSetStepField).toHaveBeenCalledWith(36, 0, "probability", 0.5);
  });

  it("marque un pas de vélocité maximale comme accent", () => {
    renderSequencer();
    const accent = screen.getByRole("button", { name: /Kick, pas 3, temps 1 : actif/ });
    expect(accent.className).toContain("is-accent");
  });

  it("change la résolution et préécoute le pattern", () => {
    const onStepsPerBeatChange = vi.fn();
    const onPreview = vi.fn();
    renderSequencer({ onStepsPerBeatChange, onPreview });
    fireEvent.change(screen.getByRole("combobox", { name: "Résolution du séquenceur" }), {
      target: { value: "4" },
    });
    expect(onStepsPerBeatChange).toHaveBeenCalledWith(4);
    fireEvent.click(screen.getByRole("button", { name: "Préécouter le pattern" }));
    expect(onPreview).toHaveBeenCalled();
  });

  it("fonctionne sur un pattern vide avec une rangée par défaut", () => {
    const emptyPattern: Pattern = { ...pattern, events: [] };
    const props = {
      pattern: emptyPattern,
      stepsPerBeat: 4,
      onStepsPerBeatChange: vi.fn(),
      onSetStep: vi.fn(),
      onSetStepField: vi.fn(),
      onPreview: vi.fn(),
    };
    render(<StepSequencer {...props} />);
    expect(screen.getByText("Kick")).toBeInTheDocument();
    const inactive = screen.getAllByRole("button").filter((button) => button.className.includes("is-active"));
    expect(inactive).toHaveLength(0);
  });
});
