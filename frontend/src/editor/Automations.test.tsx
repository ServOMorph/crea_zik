import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createEditorState, select } from "./editorStore";
import type { EditorState } from "./editorStore";
import { Automations } from "./Automations";
import type { AutomationsProps } from "./Automations";

function makeState(overrides: Partial<EditorState["composition"]> = {}): EditorState {
  return createEditorState({
    id: "composition-1",
    revision: 0,
    title: "Lignes de nuit",
    tempo_bpm: 120,
    time_signature: [4, 4] as [number, number],
    tracks: [
      { id: "track-1", name: "Pad", kind: "pad", gain: 1, pan: 0 },
      { id: "track-2", name: "Basse", kind: "bass", gain: 1, pan: 0 },
    ],
    patterns: [],
    clips: [],
    markers: [],
    automation_lanes: [
      {
        id: "lane-1",
        target: "track.track-1.gain",
        points: [
          { beat: 0, value: 0.2, interpolation: "step" },
          { beat: 8, value: 1, interpolation: "linear" },
        ],
      },
    ],
    ...overrides,
  });
}

type Harness = {
  onSelect: ReturnType<typeof vi.fn>;
  onAddLane: ReturnType<typeof vi.fn>;
  onRemoveLane: ReturnType<typeof vi.fn>;
  onDuplicateLane: ReturnType<typeof vi.fn>;
  onCopyLanes: ReturnType<typeof vi.fn>;
  onScaleLane: ReturnType<typeof vi.fn>;
  onInvertLane: ReturnType<typeof vi.fn>;
  onAddPoint: ReturnType<typeof vi.fn>;
  onMovePoint: ReturnType<typeof vi.fn>;
  onUpdatePoint: ReturnType<typeof vi.fn>;
  onRemovePoint: ReturnType<typeof vi.fn>;
};

function renderAutomations(state: EditorState, playheadBeat = 0): Harness {
  const harness: Harness = {
    onSelect: vi.fn(),
    onAddLane: vi.fn(),
    onRemoveLane: vi.fn(),
    onDuplicateLane: vi.fn(),
    onCopyLanes: vi.fn(),
    onScaleLane: vi.fn(),
    onInvertLane: vi.fn(),
    onAddPoint: vi.fn(),
    onMovePoint: vi.fn(),
    onUpdatePoint: vi.fn(),
    onRemovePoint: vi.fn(),
  };
  const props: AutomationsProps = { editor: state, registry: null, playheadBeat, ...harness };
  render(<Automations {...props} />);
  return harness;
}

function pointer(element: Element | Window, type: string, clientX: number, clientY = 0) {
  fireEvent(
    element,
    new MouseEvent(type, { bubbles: true, cancelable: true, clientX, clientY }),
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Automations", () => {
  it("affiche les lanes existantes avec leur libellé et la valeur évaluée au playhead", () => {
    renderAutomations(makeState(), 4);
    expect(screen.getByText("Pad · Gain")).toBeInTheDocument();
    expect(screen.getByText(/valeur au playhead : 0.200/)).toBeInTheDocument();
  });

  it("affiche un état vide sans lane", () => {
    renderAutomations(makeState({ automation_lanes: [] }));
    expect(screen.getByText(/Aucune automation/)).toBeInTheDocument();
  });

  it("crée une automation pour la piste et le paramètre choisis", () => {
    const harness = renderAutomations(makeState({ automation_lanes: [] }));
    fireEvent.change(screen.getByRole("combobox", { name: "Piste à automatiser" }), {
      target: { value: "track-2" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Paramètre à automatiser" }), {
      target: { value: "pan" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Créer l’automation" }));
    expect(harness.onAddLane).toHaveBeenCalledWith("track.track-2.pan");
  });

  it("désactive la création si l’automation existe déjà pour cette cible", () => {
    renderAutomations(makeState());
    fireEvent.change(screen.getByRole("combobox", { name: "Piste à automatiser" }), {
      target: { value: "track-1" },
    });
    expect(screen.getByRole("button", { name: "Créer l’automation" })).toBeDisabled();
  });

  it("supprime et duplique une lane", () => {
    const harness = renderAutomations(makeState());
    fireEvent.click(screen.getByRole("button", { name: "Dupliquer" }));
    expect(harness.onDuplicateLane).toHaveBeenCalledWith("lane-1");
    fireEvent.click(screen.getByRole("button", { name: "Supprimer" }));
    expect(harness.onRemoveLane).toHaveBeenCalledWith("lane-1");
  });

  it("met à l’échelle, inverse et copie les lanes", () => {
    const harness = renderAutomations(makeState());
    fireEvent.click(screen.getByRole("button", { name: "×2" }));
    expect(harness.onScaleLane).toHaveBeenCalledWith("lane-1", 2);
    fireEvent.click(screen.getByRole("button", { name: "÷2" }));
    expect(harness.onScaleLane).toHaveBeenCalledWith("lane-1", 0.5);
    fireEvent.click(screen.getByRole("button", { name: "Inverser" }));
    expect(harness.onInvertLane).toHaveBeenCalledWith("lane-1");
    fireEvent.click(screen.getByRole("button", { name: "Copier les automations" }));
    expect(harness.onCopyLanes).toHaveBeenCalled();
  });

  it("sélectionne la lane au clic sur son nom", () => {
    const harness = renderAutomations(makeState());
    fireEvent.click(screen.getByRole("button", { name: "Pad · Gain" }));
    expect(harness.onSelect).toHaveBeenCalledWith(["lane-1"], false);
  });

  it("ajoute un point en cliquant sur la courbe hors d’un point existant", () => {
    const harness = renderAutomations(makeState());
    const svg = screen.getByRole("img", { name: /Courbe d’automation/ });
    vi.spyOn(svg, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      right: 2000,
      bottom: 90,
      width: 2000,
      height: 90,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
    pointer(svg, "pointerdown", 96, 0);
    expect(harness.onAddPoint).toHaveBeenCalledTimes(1);
    const [laneId, point] = harness.onAddPoint.mock.calls[0];
    expect(laneId).toBe("lane-1");
    expect(point.beat).toBeCloseTo(1);
    expect(point.interpolation).toBe("linear");
  });

  it("déplace un point existant par glisser", () => {
    const harness = renderAutomations(makeState());
    const svg = screen.getByRole("img", { name: /Courbe d’automation/ });
    vi.spyOn(svg, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      right: 2000,
      bottom: 90,
      width: 2000,
      height: 90,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
    const points = svg.querySelectorAll("circle");
    pointer(points[0], "pointerdown", 0, 0);
    pointer(window, "pointermove", 96, 0);
    pointer(window, "pointerup", 96, 0);
    expect(harness.onMovePoint).toHaveBeenCalledWith("lane-1", 0, 1, true);
  });

  it("édite le point sélectionné via le panneau et le supprime", () => {
    const harness = renderAutomations(makeState());
    const svg = screen.getByRole("img", { name: /Courbe d’automation/ });
    const points = svg.querySelectorAll("circle");
    pointer(points[0], "pointerdown", 0, 0);
    pointer(window, "pointerup", 0, 0);
    fireEvent.change(screen.getByRole("spinbutton", { name: "Valeur du point sélectionné" }), {
      target: { value: "0.5" },
    });
    expect(harness.onUpdatePoint).toHaveBeenCalledWith("lane-1", 0, { value: 0.5 }, false);
    fireEvent.change(screen.getByRole("combobox", { name: "Interpolation du point sélectionné" }), {
      target: { value: "smooth" },
    });
    expect(harness.onUpdatePoint).toHaveBeenCalledWith("lane-1", 0, { interpolation: "smooth" }, false);
    fireEvent.click(screen.getByRole("button", { name: "Supprimer le point" }));
    expect(harness.onRemovePoint).toHaveBeenCalledWith("lane-1", 0);
  });

  it("désactive la suppression du dernier point restant", () => {
    const state = makeState({
      automation_lanes: [
        { id: "lane-1", target: "track.track-1.gain", points: [{ beat: 0, value: 1, interpolation: "step" }] },
      ],
    });
    renderAutomations(state);
    const circle = screen.getByRole("img", { name: /Courbe d’automation/ }).querySelector("circle") as Element;
    pointer(circle, "pointerdown", 0, 0);
    pointer(window, "pointerup", 0, 0);
    expect(screen.getByRole("button", { name: "Supprimer le point" })).toBeDisabled();
  });

  it("marque la lane sélectionnée dans l’état d’édition comme sélectionnée visuellement", () => {
    const base = makeState();
    const selected = select(base, "automation_lanes", ["lane-1"]);
    renderAutomations(selected);
    expect(screen.getByText("Pad · Gain").closest(".automations__lane")).toHaveClass("is-selected");
  });
});
