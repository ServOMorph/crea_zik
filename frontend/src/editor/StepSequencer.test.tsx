import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { NoteEvent, Pattern, StepCell } from "./editorStore";
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
  onSetSteps?: ReturnType<typeof vi.fn>;
  onSetStepField?: ReturnType<typeof vi.fn>;
  onFill?: ReturnType<typeof vi.fn>;
  onClearRow?: ReturnType<typeof vi.fn>;
  onPreview?: ReturnType<typeof vi.fn>;
  onStepsPerBeatChange?: ReturnType<typeof vi.fn>;
}) {
  const props = {
    pattern,
    stepsPerBeat: overrides?.stepsPerBeat ?? 2,
    onStepsPerBeatChange: overrides?.onStepsPerBeatChange ?? vi.fn(),
    onSetSteps: overrides?.onSetSteps ?? vi.fn(),
    onSetStepField: overrides?.onSetStepField ?? vi.fn(),
    onFill: overrides?.onFill ?? vi.fn(),
    onClearRow: overrides?.onClearRow ?? vi.fn(),
    onPreview: overrides?.onPreview ?? vi.fn(),
  };
  render(<StepSequencer {...props} />);
  return props;
}

const cell = (midiNote: number, stepIndex: number): StepCell => ({ midiNote, stepIndex });

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
    const onSetSteps = vi.fn();
    renderSequencer({ onSetSteps });
    const kickAtBeat3 = screen.getByRole("button", { name: /Kick, pas 7, temps 3 : inactif/ });
    fireEvent.pointerDown(kickAtBeat3);
    expect(onSetSteps).toHaveBeenCalledWith([cell(36, 6)], true);
    const kickAtBeat1 = screen.getByRole("button", { name: /Kick, pas 3, temps 1 : actif/ });
    fireEvent.pointerDown(kickAtBeat1);
    expect(onSetSteps).toHaveBeenCalledWith([cell(36, 2)], false);
  });

  it("peint en continu en glissant sur les pas suivants", () => {
    const onSetSteps = vi.fn();
    renderSequencer({ onSetSteps });
    const empty = screen.getByRole("button", { name: /Kick, pas 5, temps 2 : inactif/ });
    fireEvent.pointerDown(empty);
    const next = screen.getByRole("button", { name: /Kick, pas 6, temps 2.5 : inactif/ });
    fireEvent.pointerEnter(next);
    expect(onSetSteps).toHaveBeenCalledWith([cell(36, 4)], true);
    expect(onSetSteps).toHaveBeenCalledWith([cell(36, 5)], true);
  });

  it("efface en glissant depuis un pas occupé", () => {
    const onSetSteps = vi.fn();
    renderSequencer({ onSetSteps });
    const active = screen.getByRole("button", { name: /Kick, pas 1, temps 0 : actif/ });
    fireEvent.pointerDown(active);
    const occupied = screen.getByRole("button", { name: /Kick, pas 3, temps 1 : actif/ });
    fireEvent.pointerEnter(occupied);
    expect(onSetSteps).toHaveBeenCalledWith([cell(36, 0)], false);
    expect(onSetSteps).toHaveBeenCalledWith([cell(36, 2)], false);
  });

  it("édite vélocité, probabilité et accent du pas sélectionné", () => {
    const onSetStepField = vi.fn();
    renderSequencer({ onSetStepField });
    fireEvent.pointerDown(screen.getByRole("button", { name: /Kick, pas 1, temps 0 : actif/ }));
    fireEvent.change(screen.getByRole("slider", { name: "Vélocité des pas" }), { target: { value: "0.35" } });
    expect(onSetStepField).toHaveBeenCalledWith([cell(36, 0)], "velocity", 0.35);
    fireEvent.click(screen.getByRole("button", { name: "Accent" }));
    expect(onSetStepField).toHaveBeenCalledWith([cell(36, 0)], "velocity", 1);
    fireEvent.change(screen.getByRole("slider", { name: "Probabilité des pas" }), { target: { value: "0.5" } });
    expect(onSetStepField).toHaveBeenCalledWith([cell(36, 0)], "probability", 0.5);
  });

  it("applique les réglages à toute la sélection multiple", () => {
    const onSetStepField = vi.fn();
    renderSequencer({ onSetStepField });
    const kickAtBeat3 = screen.getByRole("button", { name: /Kick, pas 7, temps 3 : inactif/ });
    fireEvent.pointerDown(kickAtBeat3);
    const kickAtBeat1 = screen.getByRole("button", { name: /Kick, pas 3, temps 1 : actif/ });
    fireEvent(
      kickAtBeat1,
      new MouseEvent("pointerdown", { bubbles: true, cancelable: true, ctrlKey: true }),
    );
    expect(screen.getByText(/2 pas sélectionnés/)).toBeInTheDocument();
    fireEvent.change(screen.getByRole("slider", { name: "Vélocité des pas" }), { target: { value: "0.2" } });
    expect(onSetStepField).toHaveBeenCalledWith([cell(36, 6), cell(36, 2)], "velocity", 0.2);
  });

  it("sélectionne la cellule au clavier et bascule le pas", () => {
    const onSetSteps = vi.fn();
    renderSequencer({ onSetSteps });
    const kickAtBeat3 = screen.getByRole("button", { name: /Kick, pas 7, temps 3 : inactif/ });
    fireEvent.keyDown(kickAtBeat3, { key: "Enter" });
    expect(onSetSteps).toHaveBeenCalledWith([cell(36, 6)], true);
  });

  it("remplit la rangée du pas sélectionné et vide une rangée", () => {
    const onFill = vi.fn();
    const onClearRow = vi.fn();
    renderSequencer({ onFill, onClearRow });
    const kickAtBeat1 = screen.getByRole("button", { name: /Kick, pas 3, temps 1 : actif/ });
    fireEvent.pointerDown(kickAtBeat1);
    fireEvent.click(screen.getByRole("button", { name: "Remplir" }));
    expect(onFill).toHaveBeenCalledWith(36, "all");
    fireEvent.click(screen.getByRole("button", { name: "Remplir aux temps" }));
    expect(onFill).toHaveBeenCalledWith(36, "beats");
    fireEvent.click(screen.getByRole("button", { name: "Vider la rangée" }));
    expect(onClearRow).toHaveBeenCalledWith(36);
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
      onSetSteps: vi.fn(),
      onSetStepField: vi.fn(),
      onFill: vi.fn(),
      onClearRow: vi.fn(),
      onPreview: vi.fn(),
    };
    render(<StepSequencer {...props} />);
    expect(screen.getByText("Kick")).toBeInTheDocument();
    const inactive = screen.getAllByRole("button").filter((button) => button.className.includes("is-active"));
    expect(inactive).toHaveLength(0);
  });
});
