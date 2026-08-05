import { useRef, useState } from "react";

import type { NoteEvent, Pattern, StepField } from "./editorStore";
import { patternLengthBeats, stepBeat, stepEvent } from "./editorStore";

type StepSequencerProps = {
  pattern: Pattern;
  stepsPerBeat: number;
  onStepsPerBeatChange: (value: number) => void;
  onSetStep: (midiNote: number, stepIndex: number, enabled: boolean) => void;
  onSetStepField: (midiNote: number, stepIndex: number, field: StepField, value: number) => void;
  onPreview: () => void;
};

const PERCUSSION_NAMES: Record<number, string> = {
  36: "Kick",
  38: "Caisse claire",
  39: "Clap",
  42: "Charleston fermé",
  44: "Pédale de charleston",
  46: "Charleston ouvert",
  49: "Cymbale crash",
  51: "Cymbale ride",
};

function percussionName(midiNote: number) {
  return PERCUSSION_NAMES[midiNote] ?? `Note ${midiNote}`;
}

function normalise(event: NoteEvent | undefined) {
  return {
    velocity: event?.velocity ?? 0.7,
    probability: event?.probability ?? 1,
    microTiming: event?.micro_timing_beats ?? 0,
  };
}

type Cell = { midiNote: number; stepIndex: number };

export function StepSequencer({
  pattern,
  stepsPerBeat,
  onStepsPerBeatChange,
  onSetStep,
  onSetStepField,
  onPreview,
}: StepSequencerProps) {
  const midiNotes = [...new Set(pattern.events.map((event) => event.midi_note))].sort((a, b) => a - b);
  const rows = midiNotes.length ? midiNotes : [36];
  const stepCount = Math.ceil(patternLengthBeats(pattern) * stepsPerBeat);
  const [selected, setSelected] = useState<Cell | null>(null);
  const paintModeRef = useRef<"paint" | "erase" | null>(null);

  const eventsByCell = (midiNote: number, stepIndex: number) =>
    stepEvent(pattern.events, midiNote, stepBeat(stepIndex, stepsPerBeat));

  const applyCell = (midiNote: number, stepIndex: number) => {
    const mode = paintModeRef.current;
    if (!mode) return;
    const active = Boolean(eventsByCell(midiNote, stepIndex));
    if ((mode === "paint" && !active) || (mode === "erase" && active)) {
      onSetStep(midiNote, stepIndex, mode === "paint");
    }
  };

  const selectedEvent = selected
    ? eventsByCell(selected.midiNote, selected.stepIndex)
    : undefined;
  const selectedValues = selectedEvent ? normalise(selectedEvent) : null;

  return (
    <section className="step-sequencer" aria-labelledby="sequencer-heading">
      <div className="step-sequencer__toolbar">
        <h3 id="sequencer-heading">Séquenceur pas à pas</h3>
        <label>
          Résolution
          <select
            aria-label="Résolution du séquenceur"
            value={stepsPerBeat}
            onChange={(event) => onStepsPerBeatChange(Number(event.target.value))}
          >
            <option value="1">1 pas / temps</option>
            <option value="2">1/2 temps</option>
            <option value="4">1/4 temps</option>
            <option value="8">1/8 temps</option>
          </select>
        </label>
        <button type="button" onClick={onPreview}>
          Préécouter le pattern
        </button>
      </div>
      <div className="step-sequencer__grid">
        {rows.map((midiNote) => (
          <div
            key={midiNote}
            className="step-sequencer__row"
            style={{ gridTemplateColumns: `130px repeat(${stepCount}, 28px)` }}
          >
            <span className="step-sequencer__row-label">{percussionName(midiNote)}</span>
            {Array.from({ length: stepCount }, (_, stepIndex) => {
              const beat = stepBeat(stepIndex, stepsPerBeat);
              const event = eventsByCell(midiNote, stepIndex);
              const values = normalise(event);
              const isSelected = selected?.midiNote === midiNote && selected?.stepIndex === stepIndex;
              return (
                <button
                  key={stepIndex}
                  type="button"
                  aria-label={`${percussionName(midiNote)}, pas ${stepIndex + 1}, temps ${beat} : ${
                    event ? "actif" : "inactif"
                  }${event ? `, vélocité ${Math.round(values.velocity * 100)} %, probabilité ${Math.round(
                    values.probability * 100,
                  )} %` : ""}`}
                  className={[
                    "step-sequencer__step",
                    event ? "is-active" : undefined,
                    event && values.velocity >= 0.9 ? "is-accent" : undefined,
                    isSelected ? "is-selected" : undefined,
                    beat % 1 === 0 ? "is-beat" : undefined,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  style={event ? { opacity: 0.35 + values.velocity * 0.65 } : undefined}
                  onPointerDown={(pointerEvent) => {
                    pointerEvent.preventDefault();
                    paintModeRef.current = event ? "erase" : "paint";
                    setSelected({ midiNote, stepIndex });
                    applyCell(midiNote, stepIndex);
                  }}
                  onPointerEnter={() => applyCell(midiNote, stepIndex)}
                  onPointerUp={() => {
                    paintModeRef.current = null;
                  }}
                  onKeyDown={(keyEvent) => {
                    if (keyEvent.key === "Enter" || keyEvent.key === " ") {
                      keyEvent.preventDefault();
                      paintModeRef.current = event ? "erase" : "paint";
                      setSelected({ midiNote, stepIndex });
                      applyCell(midiNote, stepIndex);
                      paintModeRef.current = null;
                    }
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="step-sequencer__editor">
        {selectedValues && selected ? (
          <>
            <p>
              {percussionName(selected.midiNote)} · pas {selected.stepIndex + 1} · temps{" "}
              {stepBeat(selected.stepIndex, stepsPerBeat)}
            </p>
            <label>
              Vélocité
              <input
                aria-label="Vélocité du pas"
                type="range"
                min="0.05"
                max="1"
                step="0.01"
                value={selectedValues.velocity}
                onChange={(event) =>
                  onSetStepField(selected.midiNote, selected.stepIndex, "velocity", Number(event.target.value))
                }
              />
              <output>{Math.round(selectedValues.velocity * 100)} %</output>
            </label>
            <label>
              Probabilité
              <input
                aria-label="Probabilité du pas"
                type="range"
                min="0.05"
                max="1"
                step="0.01"
                value={selectedValues.probability}
                onChange={(event) =>
                  onSetStepField(selected.midiNote, selected.stepIndex, "probability", Number(event.target.value))
                }
              />
              <output>{Math.round(selectedValues.probability * 100)} %</output>
            </label>
            <label>
              Micro-décalage
              <input
                aria-label="Micro-décalage du pas"
                type="range"
                min="-1"
                max="1"
                step="0.05"
                value={selectedValues.microTiming}
                onChange={(event) =>
                  onSetStepField(
                    selected.midiNote,
                    selected.stepIndex,
                    "micro_timing_beats",
                    Number(event.target.value),
                  )
                }
              />
              <output>{selectedValues.microTiming} temps</output>
            </label>
            <button
              type="button"
              aria-pressed={selectedValues.velocity >= 0.9}
              onClick={() =>
                onSetStepField(
                  selected.midiNote,
                  selected.stepIndex,
                  "velocity",
                  selectedValues.velocity >= 0.9 ? 0.7 : 1,
                )
              }
            >
              {selectedValues.velocity >= 0.9 ? "Retirer l’accent" : "Accent"}
            </button>
          </>
        ) : (
          <p className="step-sequencer__hint">Cliquez sur un pas pour l’activer, puis réglez-le ici.</p>
        )}
      </div>
    </section>
  );
}
