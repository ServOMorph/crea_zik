import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createEditorState } from "./editorStore";
import type { EditorState } from "./editorStore";
import { Playlist } from "./Playlist";
import type { PlaylistProps } from "./Playlist";

function makeState(overrides: Partial<EditorState["composition"]> = {}): EditorState {
  return createEditorState({
    id: "composition-1",
    revision: 0,
    title: "Lignes de nuit",
    tempo_bpm: 120,
    time_signature: [4, 4] as [number, number],
    tracks: [
      { id: "track-1", name: "Batterie", kind: "drums" },
      { id: "track-2", name: "Basse", kind: "bass" },
    ],
    patterns: [
      {
        id: "pattern-1",
        track_id: "track-1",
        name: "Rythme",
        events: [],
        length_beats: 4,
      },
      {
        id: "pattern-2",
        track_id: "track-2",
        name: "Groove",
        events: [],
        length_beats: 4,
      },
    ],
    clips: [
      { id: "clip-1", pattern_id: "pattern-1", start_beat: 0, length_beats: 4 },
      { id: "clip-2", pattern_id: "pattern-2", start_beat: 8, length_beats: 4 },
    ],
    markers: [],
    ...overrides,
  });
}

type Harness = {
  onSelect: ReturnType<typeof vi.fn>;
  onMoveClip: ReturnType<typeof vi.fn>;
  onResizeClip: ReturnType<typeof vi.fn>;
  onRippleMoveClip: ReturnType<typeof vi.fn>;
  onSplitClip: ReturnType<typeof vi.fn>;
  onAddClip: ReturnType<typeof vi.fn>;
  onToggleMute: ReturnType<typeof vi.fn>;
  onToggleLock: ReturnType<typeof vi.fn>;
  onSetRepeat: ReturnType<typeof vi.fn>;
  onSetTransposition: ReturnType<typeof vi.fn>;
  onInsertTime: ReturnType<typeof vi.fn>;
  onDeleteTime: ReturnType<typeof vi.fn>;
  onAddMarker: ReturnType<typeof vi.fn>;
  onMoveMarker: ReturnType<typeof vi.fn>;
  onRenameMarker: ReturnType<typeof vi.fn>;
  onDeleteMarker: ReturnType<typeof vi.fn>;
  onAddTrack: ReturnType<typeof vi.fn>;
  onRenameTrack: ReturnType<typeof vi.fn>;
  onMoveTrack: ReturnType<typeof vi.fn>;
};

function renderPlaylist(state: EditorState): Harness {
  const harness: Harness = {
    onSelect: vi.fn(),
    onMoveClip: vi.fn(),
    onResizeClip: vi.fn(),
    onRippleMoveClip: vi.fn(),
    onSplitClip: vi.fn(),
    onAddClip: vi.fn(),
    onToggleMute: vi.fn(),
    onToggleLock: vi.fn(),
    onSetRepeat: vi.fn(),
    onSetTransposition: vi.fn(),
    onInsertTime: vi.fn(),
    onDeleteTime: vi.fn(),
    onAddMarker: vi.fn(),
    onMoveMarker: vi.fn(),
    onRenameMarker: vi.fn(),
    onDeleteMarker: vi.fn(),
    onAddTrack: vi.fn(),
    onRenameTrack: vi.fn(),
    onMoveTrack: vi.fn(),
  };
  const props: PlaylistProps = {
    editor: state,
    onSelect: harness.onSelect,
    onMoveClip: harness.onMoveClip,
    onResizeClip: harness.onResizeClip,
    onRippleMoveClip: harness.onRippleMoveClip,
    onSplitClip: harness.onSplitClip,
    onAddClip: harness.onAddClip,
    onToggleMute: harness.onToggleMute,
    onToggleLock: harness.onToggleLock,
    onSetRepeat: harness.onSetRepeat,
    onSetTransposition: harness.onSetTransposition,
    onInsertTime: harness.onInsertTime,
    onDeleteTime: harness.onDeleteTime,
    onAddMarker: harness.onAddMarker,
    onMoveMarker: harness.onMoveMarker,
    onRenameMarker: harness.onRenameMarker,
    onDeleteMarker: harness.onDeleteMarker,
    onAddTrack: harness.onAddTrack,
    onRenameTrack: harness.onRenameTrack,
    onMoveTrack: harness.onMoveTrack,
  };
  render(<Playlist {...props} />);
  return harness;
}

function pointer(element: Element | Window, type: string, clientX: number, options: MouseEventInit = {}) {
  fireEvent(element, new MouseEvent(type, { bubbles: true, cancelable: true, clientX, ...options }));
}

afterEach(cleanup);

describe("Playlist — pistes, clips et marqueurs", () => {
  it("affiche les pistes, les clips positionnés et les marqueurs", () => {
    const state = makeState({ markers: [{ id: "marker-1", beat: 8, label: "groove" }] });
    renderPlaylist(state);
    expect(screen.getByRole("button", { name: "Batterie" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rythme (piste Batterie)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Groove (piste Basse)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Marqueur groove à 8" })).toBeInTheDocument();
  });

  it("sélectionne un clip au clic, avec ajout si la touche Ctrl est enfoncée", () => {
    const harness = renderPlaylist(makeState());
    const clip = screen.getByRole("button", { name: "Rythme (piste Batterie)" });
    pointer(clip, "pointerdown", 100);
    expect(harness.onSelect).toHaveBeenCalledWith("clips", ["clip-1"], false);
    pointer(window, "pointerup", 196);
  });

  it("déplace un clip au drag avec un delta aligné sur la grille", () => {
    const harness = renderPlaylist(makeState());
    const clip = screen.getByRole("button", { name: "Rythme (piste Batterie)" });
    pointer(clip, "pointerdown", 100);
    pointer(window, "pointermove", 148);
    pointer(window, "pointermove", 196);
    pointer(window, "pointerup", 196);
    expect(harness.onMoveClip).toHaveBeenCalledWith("clip-1", 0.5, true);
    expect(harness.onMoveClip).toHaveBeenCalledWith("clip-1", 0.5, true);
    expect(harness.onMoveClip).toHaveBeenCalledTimes(2);
  });

  it("redimensionne un clip via sa poignée", () => {
    const harness = renderPlaylist(makeState());
    const handle = screen.getByRole("button", { name: "Redimensionner le clip Rythme" });
    pointer(handle, "pointerdown", 384);
    pointer(window, "pointermove", 480);
    pointer(window, "pointerup", 196);
    expect(harness.onResizeClip).toHaveBeenCalledWith("clip-1", 1, true);
    expect(harness.onMoveClip).not.toHaveBeenCalled();
  });

  it("utilise le déplacement ripple quand l’option est activée", () => {
    const harness = renderPlaylist(makeState());
    fireEvent.click(screen.getByRole("checkbox", { name: "Ripple" }));
    const clip = screen.getByRole("button", { name: "Rythme (piste Batterie)" });
    pointer(clip, "pointerdown", 100);
    pointer(window, "pointermove", 196);
    pointer(window, "pointerup", 196);
    expect(harness.onRippleMoveClip).toHaveBeenCalledWith("clip-1", 1, true);
    expect(harness.onMoveClip).not.toHaveBeenCalled();
  });

  it("découpe un clip au double-clic à la position cliquée", () => {
    const harness = renderPlaylist(makeState());
    const clip = screen.getByRole("button", { name: "Rythme (piste Batterie)" });
    fireEvent.dblClick(clip, { clientX: 240 });
    expect(harness.onSplitClip).toHaveBeenCalledWith("clip-1", 2.5);
  });

  it("n’initie pas le déplacement d’un clip verrouillé", () => {
    const harness = renderPlaylist(makeState({ clips: [{ id: "clip-1", pattern_id: "pattern-1", start_beat: 0, length_beats: 4, locked: true }] }));
    const clip = screen.getByRole("button", { name: "Rythme verrouillé (piste Batterie)" });
    pointer(clip, "pointerdown", 100);
    pointer(window, "pointermove", 196);
    pointer(window, "pointerup", 196);
    expect(harness.onMoveClip).not.toHaveBeenCalled();
  });

  it("marque le clip muet et le clip recouvert", () => {
    const state = makeState({
      clips: [
        { id: "clip-1", pattern_id: "pattern-1", start_beat: 0, length_beats: 4, mute: true },
        { id: "clip-3", pattern_id: "pattern-1", start_beat: 2, length_beats: 4 },
      ],
    });
    renderPlaylist(state);
    const covered = screen.getByRole("button", { name: "Rythme muet (piste Batterie)" });
    expect(covered).toHaveClass("is-muted");
    expect(covered).toHaveClass("is-obscured");
    expect(screen.getByRole("button", { name: "Rythme (piste Batterie)" })).not.toHaveClass("is-obscured");
  });

  it("ajoute un clip à la fin de la composition", () => {
    const harness = renderPlaylist(makeState());
    fireEvent.click(screen.getByRole("button", { name: "Ajouter un clip" }));
    expect(harness.onAddClip).toHaveBeenCalledWith("pattern-1", 12);
  });
});

describe("Playlist — marqueurs", () => {
  it("ajoute un marqueur à la fin de la composition", () => {
    const harness = renderPlaylist(makeState());
    fireEvent.click(screen.getByRole("button", { name: "Ajouter un marqueur" }));
    expect(harness.onAddMarker).toHaveBeenCalledWith(12);
  });

  it("déplace un marqueur par glisser-déposer", () => {
    const harness = renderPlaylist(makeState({ markers: [{ id: "marker-1", beat: 0, label: "intro" }] }));
    const marker = screen.getByRole("button", { name: "Marqueur intro à 0" });
    pointer(marker, "pointerdown", 0);
    pointer(window, "pointermove", 120);
    pointer(window, "pointerup", 196);
    expect(harness.onMoveMarker).toHaveBeenCalledWith("marker-1", 1.25);
  });

  it("renomme un marqueur au double-clic", () => {
    const harness = renderPlaylist(makeState({ markers: [{ id: "marker-1", beat: 0, label: "intro" }] }));
    const marker = screen.getByRole("button", { name: "Marqueur intro à 0" });
    fireEvent.dblClick(marker);
    const input = screen.getByRole("textbox", { name: "Libellé du marqueur" });
    fireEvent.change(input, { target: { value: "climax" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);
    expect(harness.onRenameMarker).toHaveBeenCalledWith("marker-1", "climax");
  });

  it("supprime un marqueur", () => {
    const harness = renderPlaylist(makeState({ markers: [{ id: "marker-1", beat: 0, label: "intro" }] }));
    fireEvent.click(screen.getByRole("button", { name: "Supprimer le marqueur intro" }));
    expect(harness.onDeleteMarker).toHaveBeenCalledWith("marker-1");
  });
});

describe("Playlist — temps et pistes", () => {
  it("insère et supprime du temps d’une mesure", () => {
    const harness = renderPlaylist(makeState());
    const beat = screen.getByRole("spinbutton", { name: "Beat pour insérer ou supprimer du temps" });
    fireEvent.change(beat, { target: { value: "2" } });
    fireEvent.submit(beat.closest("form") as HTMLFormElement);
    expect(harness.onInsertTime).toHaveBeenCalledWith(2, 4);
    fireEvent.click(screen.getByRole("button", { name: "Supprimer du temps" }));
    expect(harness.onDeleteTime).toHaveBeenCalledWith(2, 4);
  });

  it("ajoute une piste", () => {
    const harness = renderPlaylist(makeState());
    fireEvent.change(screen.getByRole("textbox", { name: "Nom de la nouvelle piste" }), {
      target: { value: "Arpège" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Type de piste" }), { target: { value: "arp" } });
    fireEvent.click(screen.getByRole("button", { name: "Ajouter une piste" }));
    expect(harness.onAddTrack).toHaveBeenCalledWith("Arpège", "arp");
  });

  it("renomme une piste au double-clic et la réorganise", () => {
    const harness = renderPlaylist(makeState());
    fireEvent.dblClick(screen.getByRole("button", { name: "Batterie" }));
    const input = screen.getByRole("textbox", { name: "Nom de la piste" });
    fireEvent.change(input, { target: { value: "Drums" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);
    expect(harness.onRenameTrack).toHaveBeenCalledWith("track-1", "Drums");
    fireEvent.click(screen.getByRole("button", { name: "Descendre la piste Batterie" }));
    expect(harness.onMoveTrack).toHaveBeenCalledWith("track-1", 1);
  });

  it("affiche un avertissement quand la densité dépasse la limite", () => {
    const many = Array.from({ length: 301 }, (_, index) => ({
      id: `clip-${index}`,
      pattern_id: "pattern-1",
      start_beat: index * 4,
      length_beats: 4,
    }));
    renderPlaylist(makeState({ clips: many }));
    expect(screen.getByRole("alert")).toHaveTextContent("Trop de clips");
  });
});
