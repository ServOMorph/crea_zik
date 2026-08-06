import { PointerEvent, useRef, useState } from "react";

import type { AutomationLane, AutomationPoint, EditorState } from "./editorStore";
import { automationLaneLabel, automationLaneBaseValue, automationTarget, evaluateAutomation, snapBeat } from "./editorStore";
import { compositionEndBeat } from "./clipCommands";
import type { InstrumentRegistryPayload } from "./instrumentRegistry";

const PX_PER_BEAT = 96;
const LANE_HEIGHT = 90;
const CURVE_SAMPLES_PER_BEAT = 4;
const MAX_CURVE_SAMPLES = 1200;

export type AutomationsProps = {
  editor: EditorState;
  registry: InstrumentRegistryPayload | null;
  playheadBeat: number;
  onSelect: (ids: string[], additive: boolean) => void;
  onAddLane: (target: string) => void;
  onRemoveLane: (laneId: string) => void;
  onDuplicateLane: (laneId: string) => void;
  onCopyLanes: () => void;
  onScaleLane: (laneId: string, factor: number) => void;
  onInvertLane: (laneId: string) => void;
  onAddPoint: (laneId: string, point: AutomationPoint) => void;
  onMovePoint: (laneId: string, fromBeat: number, toBeat: number, groupWithPrevious: boolean) => void;
  onUpdatePoint: (
    laneId: string,
    beat: number,
    patch: Partial<Omit<AutomationPoint, "beat">>,
    groupWithPrevious: boolean,
  ) => void;
  onRemovePoint: (laneId: string, beat: number) => void;
};

type Domain = { minimum: number; maximum: number };

type PointDrag = {
  laneId: string;
  currentBeat: number;
  domain: Domain;
  svgLeft: number;
  svgTop: number;
  pxPerBeat: number;
};

function domainFor(lane: AutomationLane, registry: InstrumentRegistryPayload | null, trackKind: string | undefined): Domain {
  const property = lane.target.split(".").slice(2).join(".");
  if (property === "gain") return { minimum: 0, maximum: 2 };
  if (property === "pan") return { minimum: -1, maximum: 1 };
  const path = property.replace(/^parameter\./, "");
  const scalar = trackKind
    ? registry?.[trackKind]?.groups
        .flatMap((group) => group.parameters)
        .find((parameter): parameter is Extract<typeof parameter, { type: "scalar" }> => parameter.type === "scalar" && parameter.path === path)
    : undefined;
  if (scalar && scalar.minimum !== null && scalar.maximum !== null && scalar.minimum < scalar.maximum) {
    return { minimum: scalar.minimum, maximum: scalar.maximum };
  }
  const values = lane.points.map((point) => point.value);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  if (minimum === maximum) return { minimum: minimum - 1, maximum: maximum + 1 };
  const padding = (maximum - minimum) * 0.1;
  return { minimum: minimum - padding, maximum: maximum + padding };
}

function valueToY(value: number, domain: Domain, height: number): number {
  const clamped = Math.min(domain.maximum, Math.max(domain.minimum, value));
  const ratio = (clamped - domain.minimum) / (domain.maximum - domain.minimum);
  return height - ratio * height;
}

function yToValue(y: number, domain: Domain, height: number): number {
  const ratio = Math.min(1, Math.max(0, y / height));
  return domain.maximum - ratio * (domain.maximum - domain.minimum);
}

function curvePath(lane: AutomationLane, totalBeats: number, domain: Domain, pxPerBeat: number, height: number): string {
  const samples = Math.min(MAX_CURVE_SAMPLES, Math.max(2, Math.round(totalBeats * CURVE_SAMPLES_PER_BEAT)));
  const points: string[] = [];
  for (let index = 0; index <= samples; index += 1) {
    const beat = (index / samples) * totalBeats;
    const value = evaluateAutomation(lane, beat);
    const x = beat * pxPerBeat;
    const y = valueToY(value, domain, height);
    points.push(`${x},${y}`);
  }
  return points.join(" ");
}

function propertyLabel(path: string): string {
  return path
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function Automations({
  editor,
  registry,
  playheadBeat,
  onSelect,
  onAddLane,
  onRemoveLane,
  onDuplicateLane,
  onCopyLanes,
  onScaleLane,
  onInvertLane,
  onAddPoint,
  onMovePoint,
  onUpdatePoint,
  onRemovePoint,
}: AutomationsProps) {
  const composition = editor.composition;
  const lanes = composition.automation_lanes ?? [];
  const pxPerBeat = PX_PER_BEAT * editor.grid.horizontalZoom;
  const totalBeats = Math.max(compositionEndBeat(composition), 16) + 4;
  const totalWidth = totalBeats * pxPerBeat;
  const [selectedTrackId, setSelectedTrackId] = useState(composition.tracks[0]?.id ?? "");
  const [selectedProperty, setSelectedProperty] = useState("gain");
  const [selectedPoint, setSelectedPoint] = useState<{ laneId: string; beat: number } | null>(null);
  const dragRef = useRef<PointDrag | null>(null);

  const selectedTrack = composition.tracks.find((track) => track.id === selectedTrackId);
  const scalarParameters = selectedTrack
    ? (registry?.[selectedTrack.kind]?.groups.flatMap((group) => group.parameters).filter((parameter) => parameter.type === "scalar") ?? [])
    : [];
  const existingTargets = new Set(lanes.map((lane) => lane.target));
  const candidateTarget = selectedTrackId
    ? automationTarget(selectedTrackId, selectedProperty === "gain" || selectedProperty === "pan" ? selectedProperty : `parameter.${selectedProperty}`)
    : "";
  const canAddLane = Boolean(selectedTrackId) && !existingTargets.has(candidateTarget);

  function stopDrag() {
    dragRef.current = null;
    window.removeEventListener("pointermove", handleDragMove);
    window.removeEventListener("pointerup", stopDrag);
  }

  function handleDragMove(event: globalThis.PointerEvent) {
    const current = dragRef.current;
    if (!current) return;
    const beatRaw = (event.clientX - current.svgLeft) / current.pxPerBeat;
    const nextBeat = Math.max(0, snapBeat(beatRaw, editor.grid.snapBeats));
    const nextValue = yToValue(event.clientY - current.svgTop, current.domain, LANE_HEIGHT);
    if (nextBeat !== current.currentBeat) {
      onMovePoint(current.laneId, current.currentBeat, nextBeat, true);
      setSelectedPoint({ laneId: current.laneId, beat: nextBeat });
    }
    onUpdatePoint(current.laneId, nextBeat, { value: nextValue }, true);
    dragRef.current = { ...current, currentBeat: nextBeat };
  }

  function startPointDrag(event: PointerEvent<SVGCircleElement>, lane: AutomationLane, point: AutomationPoint, domain: Domain) {
    event.stopPropagation();
    const svg = event.currentTarget.ownerSVGElement;
    const rect = svg?.getBoundingClientRect();
    setSelectedPoint({ laneId: lane.id, beat: point.beat });
    dragRef.current = {
      laneId: lane.id,
      currentBeat: point.beat,
      domain,
      svgLeft: rect?.left ?? 0,
      svgTop: rect?.top ?? 0,
      pxPerBeat,
    };
    window.addEventListener("pointermove", handleDragMove);
    window.addEventListener("pointerup", stopDrag);
  }

  function addPointFromClick(event: PointerEvent<SVGSVGElement>, lane: AutomationLane, domain: Domain) {
    if ((event.target as SVGElement).tagName === "circle") return;
    const rect = event.currentTarget.getBoundingClientRect();
    const beat = Math.max(0, snapBeat((event.clientX - rect.left) / pxPerBeat, editor.grid.snapBeats));
    const value = yToValue(event.clientY - rect.top, domain, LANE_HEIGHT);
    onAddPoint(lane.id, { beat, value, interpolation: "linear" });
  }

  const selectedLane = selectedPoint ? lanes.find((lane) => lane.id === selectedPoint.laneId) : undefined;
  const selectedLanePoint = selectedLane?.points.find((point) => point.beat === selectedPoint?.beat);

  return (
    <section className="automations" aria-labelledby="automations-heading">
      <div className="automations__header">
        <h2 id="automations-heading">Automations ({lanes.length})</h2>
        <div className="automations__toolbar">
          <label>
            Piste
            <select
              aria-label="Piste à automatiser"
              value={selectedTrackId}
              onChange={(event) => {
                setSelectedTrackId(event.target.value);
                setSelectedProperty("gain");
              }}
            >
              {composition.tracks.map((track) => (
                <option key={track.id} value={track.id}>
                  {track.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Paramètre
            <select
              aria-label="Paramètre à automatiser"
              value={selectedProperty}
              onChange={(event) => setSelectedProperty(event.target.value)}
            >
              <option value="gain">Gain</option>
              <option value="pan">Pan</option>
              {scalarParameters.map((parameter) => (
                <option key={parameter.path} value={parameter.path}>
                  {propertyLabel(parameter.path)}
                </option>
              ))}
            </select>
          </label>
          <button type="button" disabled={!canAddLane} onClick={() => onAddLane(candidateTarget)}>
            Créer l’automation
          </button>
          <button type="button" disabled={lanes.length === 0} onClick={onCopyLanes}>
            Copier les automations
          </button>
        </div>
      </div>
      {lanes.length === 0 ? (
        <p className="automations__empty">Aucune automation. Choisissez une piste et un paramètre pour en créer une.</p>
      ) : (
        <div className="automations__scroll">
          {lanes.map((lane) => {
            const track = composition.tracks.find((item) => item.id === lane.target.split(".")[1]);
            const domain = domainFor(lane, registry, track?.kind);
            const baseValue = automationLaneBaseValue(composition, lane.target);
            const evaluatedValue = evaluateAutomation(lane, playheadBeat);
            return (
              <div
                className={`automations__lane${editor.selection.automation_lanes.includes(lane.id) ? " is-selected" : ""}`}
                key={lane.id}
              >
                <div className="automations__lane-header">
                  <button
                    type="button"
                    className="automations__lane-name"
                    onClick={(event) => onSelect([lane.id], event.ctrlKey || event.metaKey)}
                  >
                    {automationLaneLabel(composition, lane.target)}
                  </button>
                  <span className="automations__lane-value" aria-live="polite">
                    valeur au playhead : {evaluatedValue.toFixed(3)} (base {baseValue.toFixed(3)})
                  </span>
                  <div className="automations__lane-actions">
                    <button type="button" onClick={() => onDuplicateLane(lane.id)}>
                      Dupliquer
                    </button>
                    <button type="button" onClick={() => onScaleLane(lane.id, 2)}>
                      ×2
                    </button>
                    <button type="button" onClick={() => onScaleLane(lane.id, 0.5)}>
                      ÷2
                    </button>
                    <button type="button" onClick={() => onInvertLane(lane.id)}>
                      Inverser
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedPoint?.laneId === lane.id) setSelectedPoint(null);
                        onRemoveLane(lane.id);
                      }}
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
                <svg
                  className="automations__curve"
                  width={totalWidth}
                  height={LANE_HEIGHT}
                  role="img"
                  aria-label={`Courbe d’automation ${automationLaneLabel(composition, lane.target)}`}
                  onPointerDown={(event) => addPointFromClick(event, lane, domain)}
                >
                  <line
                    className="automations__playhead"
                    x1={playheadBeat * pxPerBeat}
                    x2={playheadBeat * pxPerBeat}
                    y1={0}
                    y2={LANE_HEIGHT}
                  />
                  <polyline className="automations__polyline" points={curvePath(lane, totalBeats, domain, pxPerBeat, LANE_HEIGHT)} />
                  {lane.points.map((point) => (
                    <circle
                      key={point.beat}
                      className={`automations__point${
                        selectedPoint?.laneId === lane.id && selectedPoint.beat === point.beat ? " is-selected" : ""
                      }`}
                      cx={point.beat * pxPerBeat}
                      cy={valueToY(point.value, domain, LANE_HEIGHT)}
                      r={5}
                      onPointerDown={(event) => startPointDrag(event, lane, point, domain)}
                      onDoubleClick={(event) => {
                        event.stopPropagation();
                        if (lane.points.length <= 1) return;
                        if (selectedPoint?.laneId === lane.id && selectedPoint.beat === point.beat) setSelectedPoint(null);
                        onRemovePoint(lane.id, point.beat);
                      }}
                    />
                  ))}
                </svg>
              </div>
            );
          })}
        </div>
      )}
      {selectedLane && selectedLanePoint && (
        <div className="automations__point-editor" aria-label="Point d’automation sélectionné">
          <span>{automationLaneLabel(composition, selectedLane.target)}</span>
          <label>
            Temps
            <input
              aria-label="Temps du point sélectionné"
              type="number"
              min="0"
              step="0.05"
              value={selectedLanePoint.beat}
              onChange={(event) => {
                const beat = Math.max(0, Number(event.target.value));
                onMovePoint(selectedLane.id, selectedLanePoint.beat, beat, false);
                setSelectedPoint({ laneId: selectedLane.id, beat });
              }}
            />
          </label>
          <label>
            Valeur
            <input
              aria-label="Valeur du point sélectionné"
              type="number"
              step="0.01"
              value={selectedLanePoint.value}
              onChange={(event) =>
                onUpdatePoint(selectedLane.id, selectedLanePoint.beat, { value: Number(event.target.value) }, false)
              }
            />
          </label>
          <label>
            Interpolation
            <select
              aria-label="Interpolation du point sélectionné"
              value={selectedLanePoint.interpolation}
              onChange={(event) =>
                onUpdatePoint(
                  selectedLane.id,
                  selectedLanePoint.beat,
                  { interpolation: event.target.value as AutomationPoint["interpolation"] },
                  false,
                )
              }
            >
              <option value="step">Palier</option>
              <option value="linear">Linéaire</option>
              <option value="smooth">Lissée</option>
            </select>
          </label>
          <button
            type="button"
            disabled={selectedLane.points.length <= 1}
            onClick={() => {
              onRemovePoint(selectedLane.id, selectedLanePoint.beat);
              setSelectedPoint(null);
            }}
          >
            Supprimer le point
          </button>
        </div>
      )}
      <p className="automations__hint">
        Clic sur la courbe : ajouter un point, glisser un point : déplacer, double-clic : supprimer.
      </p>
    </section>
  );
}
