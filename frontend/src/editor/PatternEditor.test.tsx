import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createEditorState } from "./editorStore";
import { PatternEditor } from "./PatternEditor";

const composition = {
  id: "composition-1",
  revision: 1,
  title: "Lignes de nuit",
  tempo_bpm: 120,
  time_signature: [4, 4] as [number, number],
  tracks: [
    { id: "track-1", name: "Batterie", kind: "drums" },
    { id: "track-2", name: "Basse", kind: "bass" },
  ],
  patterns: [
    { id: "pattern-1", track_id: "track-1", events: [] },
    { id: "pattern-2", track_id: "track-2", events: [] },
  ],
  clips: [
    { id: "clip-1", pattern_id: "pattern-1", start_beat: 0, length_beats: 4 },
    { id: "clip-2", pattern_id: "pattern-1", start_beat: 4, length_beats: 4 },
  ],
};

function renderEditor(overrides: Partial<Parameters<typeof PatternEditor>[0]> = {}) {
  const editor = createEditorState(composition);
  const props: Parameters<typeof PatternEditor>[0] = {
    editor,
    selectedPatternId: null,
    onSelectPattern: vi.fn(),
    stepsPerBeat: 4,
    onStepsPerBeatChange: vi.fn(),
    onSetSteps: vi.fn(),
    onSetStepField: vi.fn(),
    onFill: vi.fn(),
    onClearRow: vi.fn(),
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
    onPreviewTrack: vi.fn(),
    onRename: vi.fn(),
    onSetColor: vi.fn(),
    onSetLength: vi.fn(),
    onDuplicate: vi.fn(),
    onVary: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  };
  render(<PatternEditor {...props} />);
  return props;
}

describe("PatternEditor", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("affiche le pattern de batterie par défaut avec ses propriétés", () => {
    renderEditor();

    expect(screen.getByRole("heading", { name: "Pattern 1" })).toBeInTheDocument();
    expect(screen.getByLabelText("Pattern de la piste")).toHaveValue("pattern-1");
    expect(screen.getByLabelText("Nom du pattern")).toHaveValue("Pattern 1");
    expect(screen.getByLabelText("Longueur du pattern")).toHaveValue(4);
    expect(screen.getByRole("button", { name: "Dupliquer" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Varier" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Supprimer" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Préécouter la piste" })).toBeInTheDocument();
  });

  it("indique les clips qui utilisent le pattern", () => {
    renderEditor();

    expect(screen.getByRole("status")).toHaveTextContent("Utilisé par 2 clips dans l’arrangement.");
  });

  it("indique qu’un pattern sans clip est inutilisé", () => {
    renderEditor({
      editor: createEditorState({ ...composition, clips: [] }),
    });

    expect(screen.getByRole("status")).toHaveTextContent("Ce pattern n’est utilisé par aucun clip.");
  });

  it("affiche le Piano Roll pour un pattern de piste non-batterie", () => {
    renderEditor({
      editor: createEditorState({
        ...composition,
        tracks: [{ id: "track-2", name: "Basse", kind: "bass" }],
        patterns: [composition.patterns[1]],
        clips: [],
      }),
    });

    expect(screen.getByRole("heading", { name: "Piano Roll" })).toBeInTheDocument();
    expect(screen.getByLabelText("Pattern de la piste")).toHaveValue("pattern-2");
  });

  it("affiche une invitation quand aucune piste n’existe", () => {
    renderEditor({
      editor: createEditorState({
        ...composition,
        tracks: [],
        patterns: [],
        clips: [],
      }),
    });

    expect(screen.getByText("Sélectionnez une piste pour éditer ses patterns.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Dupliquer" })).not.toBeInTheDocument();
  });

  it("renomme, colore et allonge le pattern", () => {
    const props = renderEditor();

    fireEvent.change(screen.getByLabelText("Nom du pattern"), { target: { value: "Groove" } });
    expect(props.onRename).toHaveBeenCalledWith("pattern-1", "Groove");
    fireEvent.change(screen.getByLabelText("Couleur du pattern"), { target: { value: "#a1b2c3" } });
    expect(props.onSetColor).toHaveBeenCalledWith("pattern-1", "#a1b2c3");
    fireEvent.change(screen.getByLabelText("Longueur du pattern"), { target: { value: "8" } });
    expect(props.onSetLength).toHaveBeenCalledWith("pattern-1", 8);
  });

  it("ignore une longueur invalide", () => {
    const props = renderEditor();

    fireEvent.change(screen.getByLabelText("Longueur du pattern"), { target: { value: "0" } });
    expect(props.onSetLength).not.toHaveBeenCalled();
  });

  it("duplique, varie et préécoute la piste", () => {
    const props = renderEditor();

    fireEvent.click(screen.getByRole("button", { name: "Dupliquer" }));
    expect(props.onDuplicate).toHaveBeenCalledWith("pattern-1");
    fireEvent.click(screen.getByRole("button", { name: "Varier" }));
    expect(props.onVary).toHaveBeenCalledWith("pattern-1");
    fireEvent.click(screen.getByRole("button", { name: "Préécouter la piste" }));
    expect(props.onPreviewTrack).toHaveBeenCalledWith("track-1");
  });

  it("supprime sans confirmation quand le pattern n’est utilisé par aucun clip", () => {
    const props = renderEditor({
      editor: createEditorState({ ...composition, clips: [] }),
    });
    const confirmSpy = vi.spyOn(window, "confirm");

    fireEvent.click(screen.getByRole("button", { name: "Supprimer" }));

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(props.onDelete).toHaveBeenCalledWith("pattern-1");
  });

  it("demande confirmation avant de supprimer un pattern utilisé par des clips", () => {
    const props = renderEditor();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    fireEvent.click(screen.getByRole("button", { name: "Supprimer" }));

    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining("2 clips"));
    expect(props.onDelete).not.toHaveBeenCalled();

    confirmSpy.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Supprimer" }));

    expect(props.onDelete).toHaveBeenCalledWith("pattern-1");
  });

  it("sélectionne un autre pattern de batterie", () => {
    const editor = createEditorState({
      ...composition,
      patterns: [
        ...composition.patterns,
        { id: "pattern-3", track_id: "track-1", events: [], name: "Fill" },
      ],
    });
    const props = renderEditor({ editor });

    fireEvent.change(screen.getByLabelText("Pattern de la piste"), { target: { value: "pattern-3" } });

    expect(props.onSelectPattern).toHaveBeenCalledWith("pattern-3");
  });

  it("affiche le pattern sélectionné par la prop", () => {
    const editor = createEditorState({
      ...composition,
      patterns: [
        ...composition.patterns,
        { id: "pattern-3", track_id: "track-1", events: [], name: "Fill" },
      ],
    });
    renderEditor({ editor, selectedPatternId: "pattern-3" });

    expect(screen.getByLabelText("Nom du pattern")).toHaveValue("Fill");
    expect(screen.getByRole("heading", { name: "Fill" })).toBeInTheDocument();
  });
});
