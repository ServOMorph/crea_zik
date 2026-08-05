import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";

import { createEditorState } from "./editorStore";
import type { EditorState, Pattern } from "./editorStore";
import { PianoRoll } from "./PianoRoll";

function makePattern(): Pattern {
  return {
    id: "pattern-1",
    track_id: "track-1",
    events: [
      {
        id: "note-45",
        start_beat: 1,
        duration_beats: 0.5,
        midi_note: 45,
        velocity: 0.7,
        probability: 1,
        micro_timing_beats: 0,
        pan: 0,
      },
      {
        id: "note-48",
        start_beat: 2.5,
        duration_beats: 1,
        midi_note: 48,
        velocity: 0.5,
        probability: 0.8,
        micro_timing_beats: 0.25,
        pan: -0.5,
      },
    ],
  };
}

function makeState(): EditorState {
  return createEditorState({
    id: "composition-1",
    revision: 0,
    title: "Lignes de nuit",
    tempo_bpm: 120,
    time_signature: [4, 4] as [number, number],
    tracks: [{ id: "track-1", name: "Basse", kind: "bass" }],
    patterns: [makePattern()],
    clips: [],
  });
}

type Harness = {
  onSelectNotes: ReturnType<typeof vi.fn>;
  onAddNote: ReturnType<typeof vi.fn>;
  onMoveNotes: ReturnType<typeof vi.fn>;
  onResizeNotes: ReturnType<typeof vi.fn>;
  onDeleteNotes: ReturnType<typeof vi.fn>;
  onSetNoteFields: ReturnType<typeof vi.fn>;
  onQuantize: ReturnType<typeof vi.fn>;
  onSwing: ReturnType<typeof vi.fn>;
  onHumanize: ReturnType<typeof vi.fn>;
  onTranspose: ReturnType<typeof vi.fn>;
  onLegato: ReturnType<typeof vi.fn>;
  onUniformDuration: ReturnType<typeof vi.fn>;
  onInvert: ReturnType<typeof vi.fn>;
  onBuildChord: ReturnType<typeof vi.fn>;
  onDuplicateNotes: ReturnType<typeof vi.fn>;
  onPreview: ReturnType<typeof vi.fn>;
  editor: EditorState;
  pattern: Pattern;
};

function renderPianoRoll(overrides: Partial<Harness> = {}): Harness {
  const editor = overrides.editor ?? makeState();
  const pattern = overrides.pattern ?? editor.composition.patterns[0];
  const harness: Harness = {
    onSelectNotes: vi.fn(),
    onAddNote: vi.fn(),
    onMoveNotes: vi.fn(),
    onResizeNotes: vi.fn(),
    onDeleteNotes: vi.fn(),
    onSetNoteFields: vi.fn(),
    onQuantize: vi.fn(),
    onSwing: vi.fn(),
    onHumanize: vi.fn(),
    onTranspose: vi.fn(),
    onLegato: vi.fn(),
    onUniformDuration: vi.fn(),
    onInvert: vi.fn(),
    onBuildChord: vi.fn(),
    onDuplicateNotes: vi.fn(),
    onPreview: vi.fn(),
    editor,
    pattern,
    ...overrides,
  };
  const props: Parameters<typeof PianoRoll>[0] = {
    pattern,
    grid: editor.grid,
    selectedNoteIds: [],
    onSelectNotes: harness.onSelectNotes,
    onAddNote: harness.onAddNote,
    onMoveNotes: harness.onMoveNotes,
    onResizeNotes: harness.onResizeNotes,
    onDeleteNotes: harness.onDeleteNotes,
    onSetNoteFields: harness.onSetNoteFields,
    onQuantize: harness.onQuantize,
    onSwing: harness.onSwing,
    onHumanize: harness.onHumanize,
    onTranspose: harness.onTranspose,
    onLegato: harness.onLegato,
    onUniformDuration: harness.onUniformDuration,
    onInvert: harness.onInvert,
    onBuildChord: harness.onBuildChord,
    onDuplicateNotes: harness.onDuplicateNotes,
    onPreview: harness.onPreview,
  };
  function Shell() {
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    return (
      <PianoRoll
        {...props}
        selectedNoteIds={selectedIds}
        onSelectNotes={(ids, additive) => {
          setSelectedIds((current) =>
            additive ? [...new Set([...current, ...ids])] : ids,
          );
          props.onSelectNotes(ids, additive);
        }}
      />
    );
  }
  render(<Shell />);
  const board = screen.getByRole("application", { name: "Piano roll" });
  vi.spyOn(board, "getBoundingClientRect").mockReturnValue({
    left: 0,
    top: 0,
    right: 1300,
    bottom: 900,
    width: 1300,
    height: 900,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  return harness;
}

function pointer(element: Element, type: string, clientX: number, clientY: number, options: MouseEventInit = {}) {
  fireEvent(element, new MouseEvent(type, { bubbles: true, cancelable: true, clientX, clientY, ...options }));
}

const topMidi = 59;

describe("PianoRoll", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("affiche le clavier, les notes et la barre d’outils", () => {
    renderPianoRoll();

    expect(screen.getByRole("heading", { name: "Piano Roll" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Note La2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Note Do3" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Note La2, temps 1, durée 0.5, vélocité 70 %",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Note Do3, temps 2.5, durée 1, vélocité 50 %",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Quantifier" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Préécouter le pattern" })).toBeEnabled();
  });

  it("sélectionne une note au clic et affiche ses réglages", () => {
    const harness = renderPianoRoll();

    pointer(screen.getByRole("button", { name: "Note La2, temps 1, durée 0.5, vélocité 70 %" }), "pointerdown", 175, 346);
    expect(harness.onSelectNotes).toHaveBeenCalledWith(["note-45"], false);
  });

  it("crée une note au clic dans la grille, snappée", () => {
    const harness = renderPianoRoll();

    pointer(screen.getByRole("application", { name: "Piano roll" }), "pointerdown", 230, 100);
    pointer(screen.getByRole("application", { name: "Piano roll" }), "pointerup", 230, 100);

    expect(harness.onAddNote).toHaveBeenCalledWith(2.5, 0.5, Math.round(topMidi - 100 / 24));
  });

  it("ne crée rien quand le clic démarre sur le clavier", () => {
    const harness = renderPianoRoll();

    pointer(screen.getByRole("application", { name: "Piano roll" }), "pointerdown", 60, 100);
    pointer(screen.getByRole("application", { name: "Piano roll" }), "pointerup", 60, 100);

    expect(harness.onAddNote).not.toHaveBeenCalled();
  });

  it("déplace la note par glisser en temps et en hauteur", () => {
    const harness = renderPianoRoll();
    const board = screen.getByRole("application", { name: "Piano roll" });
    const note = screen.getByRole("button", { name: "Note La2, temps 1, durée 0.5, vélocité 70 %" });

    pointer(note, "pointerdown", 130 + 40 + 10, 336 + 10);
    pointer(board, "pointermove", 130 + 40 + 50, 336 - 14);
    pointer(board, "pointerup", 130 + 40 + 50, 336 - 14);

    expect(harness.onMoveNotes).toHaveBeenCalledWith(["note-45"], 1, 1, true);
  });

  it("redimensionne la note par le bord droit", () => {
    const harness = renderPianoRoll();
    const board = screen.getByRole("application", { name: "Piano roll" });
    const note = screen.getByRole("button", { name: "Note La2, temps 1, durée 0.5, vélocité 70 %" });

    pointer(note, "pointerdown", 130 + 40 + 18, 336 + 10);
    pointer(board, "pointermove", 130 + 40 + 58, 336 + 10);
    pointer(board, "pointerup", 130 + 40 + 58, 336 + 10);

    expect(harness.onResizeNotes).toHaveBeenCalledWith(["note-45"], 1, true);
  });

  it("sélectionne les notes englobées par un rectangle", () => {
    const harness = renderPianoRoll();
    const board = screen.getByRole("application", { name: "Piano roll" });

    pointer(board, "pointerdown", 140, 200);
    pointer(board, "pointermove", 280, 400);
    pointer(board, "pointerup", 280, 400);

    expect(harness.onSelectNotes).toHaveBeenCalledWith(["note-45", "note-48"], false);
  });

  it("sélectionne les notes d’une rangée via une touche du clavier", () => {
    const harness = renderPianoRoll();

    fireEvent.click(screen.getByRole("button", { name: "Note La2" }));
    expect(harness.onSelectNotes).toHaveBeenCalledWith(["note-45"], false);
  });

  it("applique les transformations de la barre d’outils aux notes sélectionnées", () => {
    const harness = renderPianoRoll();
    const note = screen.getByRole("button", { name: "Note La2, temps 1, durée 0.5, vélocité 70 %" });
    pointer(note, "pointerdown", 175, 346);
    const ids = ["note-45"];

    fireEvent.click(screen.getByRole("button", { name: "Quantifier" }));
    expect(harness.onQuantize).toHaveBeenCalledWith(ids);
    fireEvent.click(screen.getByRole("button", { name: "Humaniser" }));
    expect(harness.onHumanize).toHaveBeenCalledWith(ids);
    fireEvent.click(screen.getByRole("button", { name: "Transposer +12" }));
    expect(harness.onTranspose).toHaveBeenCalledWith(ids, 12);
    fireEvent.click(screen.getByRole("button", { name: "Transposer −12" }));
    expect(harness.onTranspose).toHaveBeenCalledWith(ids, -12);
    fireEvent.click(screen.getByRole("button", { name: "Legato" }));
    expect(harness.onLegato).toHaveBeenCalledWith(ids);
    fireEvent.click(screen.getByRole("button", { name: "Accord majeur" }));
    expect(harness.onBuildChord).toHaveBeenCalledWith("note-45", "majeur");
    fireEvent.click(screen.getByRole("button", { name: "Accord mineur" }));
    expect(harness.onBuildChord).toHaveBeenCalledWith("note-45", "mineur");
    fireEvent.click(screen.getByRole("button", { name: "Accord septième" }));
    expect(harness.onBuildChord).toHaveBeenCalledWith("note-45", "septieme");
    fireEvent.click(screen.getByRole("button", { name: "Inverser" }));
    expect(harness.onInvert).toHaveBeenCalledWith(ids, 45);
    fireEvent.click(screen.getByRole("button", { name: "Dupliquer" }));
    expect(harness.onDuplicateNotes).toHaveBeenCalledWith(ids, 0.5, 0);
    fireEvent.click(screen.getByRole("button", { name: "Supprimer" }));
    expect(harness.onDeleteNotes).toHaveBeenCalledWith(ids);
  });

  it("supprime avec la touche Suppr", () => {
    const harness = renderPianoRoll();
    const note = screen.getByRole("button", { name: "Note La2, temps 1, durée 0.5, vélocité 70 %" });
    pointer(note, "pointerdown", 175, 346);

    fireEvent.keyDown(screen.getByRole("application", { name: "Piano roll" }), { key: "Delete" });
    expect(harness.onDeleteNotes).toHaveBeenCalledWith(["note-45"]);
  });

  it("règle les champs de la note focalisée", () => {
    const harness = renderPianoRoll();
    pointer(
      screen.getByRole("button", { name: "Note Do3, temps 2.5, durée 1, vélocité 50 %" }),
      "pointerdown",
      240,
      274,
    );

    fireEvent.change(screen.getByLabelText("Vélocité des notes"), { target: { value: "0.3" } });
    expect(harness.onSetNoteFields).toHaveBeenCalledWith(["note-48"], "velocity", 0.3);
    fireEvent.change(screen.getByLabelText("Probabilité des notes"), { target: { value: "0.9" } });
    expect(harness.onSetNoteFields).toHaveBeenCalledWith(["note-48"], "probability", 0.9);
    fireEvent.change(screen.getByLabelText("Micro-décalage des notes"), { target: { value: "-0.5" } });
    expect(harness.onSetNoteFields).toHaveBeenCalledWith(["note-48"], "micro_timing_beats", -0.5);
    fireEvent.change(screen.getByLabelText("Pan des notes"), { target: { value: "0.25" } });
    expect(harness.onSetNoteFields).toHaveBeenCalledWith(["note-48"], "pan", 0.25);
  });

  it("désactive les transformations sans sélection, le swing reste disponible", () => {
    renderPianoRoll();

    expect(screen.getByRole("button", { name: "Quantifier" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Legato" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Supprimer" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Appliquer le swing" })).toBeEnabled();
  });
});
