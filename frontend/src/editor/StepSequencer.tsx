import { useRef, useState } from "react";

import type { NoteEvent, Pattern, StepCell, StepField } from "./editorStore";
import { patternLengthBeats, stepBeat, stepEvent } from "./editorStore";

type StepSequencerProps = {
  pattern: Pattern;
  stepsPerBeat: number;
  onStepsPerBeatChange: (value: number) => void;
  onSetSteps: (cells: StepCell[], enabled: boolean) => void;
  onSetStepField: (cells: StepCell[], field: StepField, value: number) => void;
  onFill: (midiNote: number, kind: "all" | "beats") => void;
  onClearRow: (midiNote: number) => void;
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

function sameCell(first: StepCell, second: StepCell) {
  return first.midiNote === second.midiNote && first.stepIndex === second.stepIndex;
}

export function StepSequencer({
  pattern,
  stepsPerBeat,
  onStepsPerBeatChange,
  onSetSteps,
  onSetStepField,
  onFill,
  onClearRow,
  onPreview,
}: StepSequencerProps) {
  const midiNotes = [...new Set(pattern.events.map((event) => event.midi_note))].sort((a, b) => a - b);
  const rows = midiNotes.length ? midiNotes : [36];
  const stepCount = Math.ceil(patternLengthBeats(pattern) * stepsPerBeat);
  const [selected, setSelected] = useState<StepCell[]>([]);
  const paintModeRef = useRef<"paint" | "erase" | null>(null);

  const eventsByCell = (midiNote: number, stepIndex: number) =>
    stepEvent(pattern.events, midiNote, stepBeat(stepIndex, stepsPerBeat));

  const applyCell = (cell: StepCell) => {
    const mode = paintModeRef.current;
    if (!mode) return;
    const active = Boolean(eventsByCell(cell.midiNote, cell.stepIndex));
    if ((mode === "paint" && !active) || (mode === "erase" && active)) {
      onSetSteps([cell], mode === "paint");
    }
  };

  const focus = selected.at(-1) ?? null;
  const focusEvent = focus ? eventsByCell(focus.midiNote, focus.stepIndex) : undefined;
  const focusValues = focusEvent ? normalise(focusEvent) : null;

  const fillDisabled = !focus;

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
        <button
          type="button"
          disabled={!focus}
          onClick={() => focus && onFill(focus.midiNote, "all")}
        >
          Remplir
        </button>
        <button
          type="button"
          disabled={!focus}
          onClick={() => focus && onFill(focus.midiNote, "beats")}
        >
          Remplir aux temps
        </button>
        <button type="button" disabled={!focus} onClick={() => focus && onClearRow(focus.midiNote)}>
          Vider la rangée
        </button>
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
              const cell: StepCell = { midiNote, stepIndex };
              const isSelected = selected.some((item) => sameCell(item, cell));
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
                    if (pointerEvent.ctrlKey || pointerEvent.metaKey) {
                      setSelected((current) =>
                        current.some((item) => sameCell(item, cell))
                          ? current.filter((item) => !sameCell(item, cell))
                          : [...current, cell],
                      );
                    } else {
                      setSelected([cell]);
                    }
                    applyCell(cell);
                  }}
                  onPointerEnter={() => applyCell(cell)}
                  onPointerUp={() => {
                    paintModeRef.current = null;
                  }}
                  onKeyDown={(keyEvent) => {
                    if (keyEvent.key === "Enter" || keyEvent.key === " ") {
                      keyEvent.preventDefault();
                      paintModeRef.current = event ? "erase" : "paint";
                      setSelected([cell]);
                      applyCell(cell);
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
        {focusValues && focus ? (
          <>
            <p>
              {percussionName(focus.midiNote)} · pas {focus.stepIndex + 1} · temps{" "}
              {stepBeat(focus.stepIndex, stepsPerBeat)}
              {selected.length > 1 ? ` · ${selected.length} pas sélectionnés` : ""}
            </p>
            <label>
              Vélocité
              <input
                aria-label="Vélocité des pas"
                type="range"
                min="0.05"
                max="1"
                step="0.01"
                value={focusValues.velocity}
                onChange={(event) =>
                  onSetStepField(selected, "velocity", Number(event.target.value))
                }
              />
              <output>{Math.round(focusValues.velocity * 100)} %</output>
            </label>
            <label>
              Probabilité
              <input
                aria-label="Probabilité des pas"
                type="range"
                min="0.05"
                max="1"
                step="0.01"
                value={focusValues.probability}
                onChange={(event) =>
                  onSetStepField(selected, "probability", Number(event.target.value))
                }
              />
              <output>{Math.round(focusValues.probability * 100)} %</output>
            </label>
            <label>
              Micro-décalage
              <input
                aria-label="Micro-décalage des pas"
                type="range"
                min="-1"
                max="1"
                step="0.05"
                value={focusValues.microTiming}
                onChange={(event) =>
                  onSetStepField(selected, "micro_timing_beats", Number(event.target.value))
                }
              />
              <output>{focusValues.microTiming} temps</output>
            </label>
            <button
              type="button"
              aria-pressed={focusValues.velocity >= 0.9}
              onClick={() =>
                onSetStepField(selected, "velocity", focusValues.velocity >= 0.9 ? 0.7 : 1)
              }
            >
              {focusValues.velocity >= 0.9 ? "Retirer l’accent" : "Accent"}
            </button>
            <span className="step-sequencer__fill-hint">
              {fillDisabled ? "Sélectionnez un pas pour remplir sa rangée." : `Remplissages sur ${percussionName(focus.midiNote)}.`}
            </span>          </>
        ) : (
          <p className="step-sequencer__hint">Cliquez sur un pas pour l’activer, puis réglez-le ici.</p>
        )}
      </div>
    </section>
  );
}
