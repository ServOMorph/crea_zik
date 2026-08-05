import type { EditorState, StepCell, StepField } from "./editorStore";
import { patternLengthBeats, patternName } from "./editorStore";
import type { ChordType, NoteField } from "./noteCommands";
import { PianoRoll } from "./PianoRoll";
import { StepSequencer } from "./StepSequencer";

type PatternEditorProps = {
  editor: EditorState;
  selectedPatternId: string | null;
  onSelectPattern: (patternId: string) => void;
  stepsPerBeat: number;
  onStepsPerBeatChange: (value: number) => void;
  onSetSteps: (patternId: string, cells: StepCell[], enabled: boolean) => void;
  onSetStepField: (patternId: string, cells: StepCell[], field: StepField, value: number) => void;
  onFill: (patternId: string, midiNote: number, kind: "all" | "beats") => void;
  onClearRow: (patternId: string, midiNote: number) => void;
  onSelectNotes: (noteIds: string[], additive: boolean) => void;
  onAddNote: (patternId: string, startBeat: number, durationBeats: number, midiNote: number) => void;
  onMoveNotes: (patternId: string, noteIds: string[], deltaBeats: number, deltaMidi: number, groupWithPrevious?: boolean) => void;
  onResizeNotes: (patternId: string, noteIds: string[], deltaBeats: number, groupWithPrevious?: boolean) => void;
  onDeleteNotes: (patternId: string, noteIds: string[]) => void;
  onSetNoteFields: (patternId: string, noteIds: string[], field: NoteField, value: number, groupWithPrevious?: boolean) => void;
  onQuantize: (patternId: string, noteIds: string[]) => void;
  onSwing: (patternId: string, noteIds: string[], amount: number) => void;
  onHumanize: (patternId: string, noteIds: string[]) => void;
  onTranspose: (patternId: string, noteIds: string[], semitones: number) => void;
  onLegato: (patternId: string, noteIds: string[]) => void;
  onUniformDuration: (patternId: string, noteIds: string[], durationBeats: number) => void;
  onInvert: (patternId: string, noteIds: string[], axisMidi: number) => void;
  onBuildChord: (patternId: string, rootNoteId: string, type: ChordType) => void;
  onDuplicateNotes: (patternId: string, noteIds: string[], deltaBeats: number, deltaMidi: number) => void;
  onPreview: (patternId: string) => void;
  onPreviewTrack: (trackId: string) => void;
  onRename: (patternId: string, name: string) => void;
  onSetColor: (patternId: string, color: string) => void;
  onSetLength: (patternId: string, lengthBeats: number) => void;
  onDuplicate: (patternId: string) => void;
  onVary: (patternId: string) => void;
  onDelete: (patternId: string) => void;
};

export function PatternEditor({
  editor,
  selectedPatternId,
  onSelectPattern,
  stepsPerBeat,
  onStepsPerBeatChange,
  onSetSteps,
  onSetStepField,
  onFill,
  onClearRow,
  onSelectNotes,
  onAddNote,
  onMoveNotes,
  onResizeNotes,
  onDeleteNotes,
  onSetNoteFields,
  onQuantize,
  onSwing,
  onHumanize,
  onTranspose,
  onLegato,
  onUniformDuration,
  onInvert,
  onBuildChord,
  onDuplicateNotes,
  onPreview,
  onPreviewTrack,
  onRename,
  onSetColor,
  onSetLength,
  onDuplicate,
  onVary,
  onDelete,
}: PatternEditorProps) {
  const selectedTrack =
    editor.composition.tracks.find((track) => editor.selection.tracks.includes(track.id)) ??
    editor.composition.tracks.find((track) => track.kind === "drums") ??
    editor.composition.tracks[0] ??
    null;
  const patterns = selectedTrack
    ? editor.composition.patterns.filter((pattern) => pattern.track_id === selectedTrack.id)
    : [];
  const activePattern = patterns.find((pattern) => pattern.id === selectedPatternId) ?? patterns[0] ?? null;
  if (!activePattern) {
    return (
      <section className="step-sequencer" aria-labelledby="sequencer-heading">
        <h3 id="sequencer-heading">Éditeur de pattern</h3>
        <p className="step-sequencer__hint">
          {selectedTrack
            ? "Ce pattern ne contient aucun événement à éditer."
            : "Sélectionnez une piste pour éditer ses patterns."}
        </p>
      </section>
    );
  }
  const clipCount = editor.composition.clips.filter((clip) => clip.pattern_id === activePattern.id).length;
  const displayName = patternName(editor, activePattern.id);
  const color = activePattern.color ?? "#8d99ae";
  const isDrumTrack = selectedTrack?.kind === "drums";
  const ghostNotes = editor.composition.patterns
    .filter((pattern) => pattern.track_id !== activePattern.track_id)
    .flatMap((pattern) => {
      const track = editor.composition.tracks.find((item) => item.id === pattern.track_id);
      return track && track.kind !== "drums" ? pattern.events : [];
    });

  const requestDelete = () => {
    if (
      clipCount > 0 &&
      !window.confirm(
        `Ce pattern est utilisé par ${clipCount} clip${clipCount > 1 ? "s" : ""}. Supprimer le pattern et ses clips ?`,
      )
    )
      return;
    onDelete(activePattern.id);
  };

  return (
    <>
      <div className="pattern-editor__header">
        <label>
          Pattern
          <select
            aria-label="Pattern de la piste"
            value={activePattern.id}
            onChange={(event) => onSelectPattern(event.target.value)}
          >
            {patterns.map((pattern) => (
              <option key={pattern.id} value={pattern.id}>
                {patternName(editor, pattern.id)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {isDrumTrack ? (
        <StepSequencer
          pattern={activePattern}
          stepsPerBeat={stepsPerBeat}
          onStepsPerBeatChange={onStepsPerBeatChange}
          onSetSteps={(cells, enabled) => onSetSteps(activePattern.id, cells, enabled)}
          onSetStepField={(cells, field, value) => onSetStepField(activePattern.id, cells, field, value)}
          onFill={(midiNote, kind) => onFill(activePattern.id, midiNote, kind)}
          onClearRow={(midiNote) => onClearRow(activePattern.id, midiNote)}
          onPreview={() => onPreview(activePattern.id)}
        />
      ) : (
        <PianoRoll
          pattern={activePattern}
          grid={editor.grid}
          selectedNoteIds={editor.selection.notes}
          onSelectNotes={(noteIds, additive) => onSelectNotes(noteIds, additive)}
          onAddNote={(startBeat, durationBeats, midiNote) =>
            onAddNote(activePattern.id, startBeat, durationBeats, midiNote)
          }
          onMoveNotes={(noteIds, deltaBeats, deltaMidi, groupWithPrevious) =>
            onMoveNotes(activePattern.id, noteIds, deltaBeats, deltaMidi, groupWithPrevious)
          }
          onResizeNotes={(noteIds, deltaBeats, groupWithPrevious) =>
            onResizeNotes(activePattern.id, noteIds, deltaBeats, groupWithPrevious)
          }
          onDeleteNotes={(noteIds) => onDeleteNotes(activePattern.id, noteIds)}
          onSetNoteFields={(noteIds, field, value, groupWithPrevious) =>
            onSetNoteFields(activePattern.id, noteIds, field, value, groupWithPrevious)
          }
          onQuantize={(noteIds) => onQuantize(activePattern.id, noteIds)}
          onSwing={(noteIds, amount) => onSwing(activePattern.id, noteIds, amount)}
          onHumanize={(noteIds) => onHumanize(activePattern.id, noteIds)}
          onTranspose={(noteIds, semitones) => onTranspose(activePattern.id, noteIds, semitones)}
          onLegato={(noteIds) => onLegato(activePattern.id, noteIds)}
          onUniformDuration={(noteIds, durationBeats) =>
            onUniformDuration(activePattern.id, noteIds, durationBeats)
          }
          onInvert={(noteIds, axisMidi) => onInvert(activePattern.id, noteIds, axisMidi)}
          onBuildChord={(rootNoteId, type) => onBuildChord(activePattern.id, rootNoteId, type)}
          onDuplicateNotes={(noteIds, deltaBeats, deltaMidi) =>
            onDuplicateNotes(activePattern.id, noteIds, deltaBeats, deltaMidi)
          }
          onPreview={() => onPreview(activePattern.id)}
          ghostNotes={ghostNotes}
        />
      )}
      <section className="pattern-editor" aria-label="Propriétés du pattern">
        <h4>{displayName}</h4>
        <label>
          Nom du pattern
          <input
            aria-label="Nom du pattern"
            value={displayName}
            onChange={(event) => onRename(activePattern.id, event.target.value)}
          />
        </label>
        <label>
          Couleur
          <input
            aria-label="Couleur du pattern"
            type="color"
            value={color}
            onChange={(event) => onSetColor(activePattern.id, event.target.value)}
          />
        </label>
        <label>
          Longueur (temps)
          <input
            aria-label="Longueur du pattern"
            type="number"
            min="0.25"
            max="1024"
            step="0.25"
            value={activePattern.length_beats ?? patternLengthBeats(activePattern)}
            onChange={(event) => {
              const value = Number(event.target.value);
              if (Number.isFinite(value) && value > 0) onSetLength(activePattern.id, value);
            }}
          />
        </label>
        <div className="pattern-editor__actions">
          <button type="button" onClick={() => onDuplicate(activePattern.id)}>
            Dupliquer
          </button>
          <button type="button" onClick={() => onVary(activePattern.id)}>
            Varier
          </button>
          <button type="button" onClick={requestDelete}>
            Supprimer
          </button>
          {selectedTrack && (
            <button type="button" onClick={() => onPreviewTrack(selectedTrack.id)}>
              Préécouter la piste
            </button>
          )}
        </div>
        <p className="pattern-editor__usage" role="status">
          {clipCount === 0
            ? "Ce pattern n’est utilisé par aucun clip."
            : `Utilisé par ${clipCount} clip${clipCount > 1 ? "s" : ""} dans l’arrangement.`}
        </p>
      </section>
    </>
  );
}
