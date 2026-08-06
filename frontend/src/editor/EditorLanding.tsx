import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

import { ApiError, apiRequest } from "../api/client";
import {
  clearSelection,
  copySelection,
  cutSelection,
  createEditorState,
  deleteSelection,
  duplicateSelection,
  EditableComposition,
  execute,
  fillPatternRow,
  clearPatternRow,
  isDirty,
  markSaveFailed,
  markSaved,
  markSaving,
  paste,
  redo,
  renamePattern,
  select,
  selectAll,
  setGrid,
  setPatternColor,
  setPatternLength,
  setStepFieldCells,
  setSteps,
  setTrackChannelFlag,
  undo,
  varyPattern,
  duplicatePattern,
} from "./editorStore";
import { ChannelRackRow } from "./ChannelRack";
import {
  addClip,
  addMarker,
  addTrack,
  deleteMarker,
  deleteTime,
  insertTime,
  moveClip,
  moveMarker,
  moveTrack,
  renameMarker,
  renameTrack,
  resizeClip,
  rippleMoveClip,
  setClipLocked,
  setClipMute,
  setClipRepeat,
  setClipTransposition,
  splitClip,
} from "./clipCommands";
import {
  addNote,
  buildChord,
  deleteNotes,
  duplicateNotes,
  humanizeNotes,
  invertNotes,
  legatoNotes,
  moveNotes,
  quantizeNotes,
  resizeNotes,
  selectNotes,
  setNoteFields,
  swingNotes,
  transposeNotes,
  uniformDuration,
} from "./noteCommands";
import { PatternEditor } from "./PatternEditor";
import { Playlist } from "./Playlist";
import { TransportBar } from "./TransportBar";
import { VirtualList } from "./VirtualList";

type ProjectSummary = { id: string; name: string; compositions: { id: string; title: string }[] };
type GalleryComposition = { id: string; title: string; tempo_bpm: number; time_signature: [number, number] };

type EditorLandingProps = {
  search: string;
  onNavigate: (path: string) => void;
  onDirtyChange: (dirty: boolean) => void;
};

function editorPath(projectId: string, compositionId: string) {
  return `/editor?project=${encodeURIComponent(projectId)}&composition=${encodeURIComponent(compositionId)}`;
}

export function EditorLanding({ search, onNavigate, onDirtyChange }: EditorLandingProps) {
  const params = new URLSearchParams(search);
  const projectId = params.get("project");
  const compositionId = params.get("composition");
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [gallery, setGallery] = useState<GalleryComposition[]>([]);
  const [editor, setEditor] = useState<ReturnType<typeof createEditorState> | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedExampleId, setSelectedExampleId] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "error" | "missing">("loading");
  const [message, setMessage] = useState("");
  const [offline, setOffline] = useState(!navigator.onLine);
  const [selectedPatternId, setSelectedPatternId] = useState<string | null>(null);
  const [stepsPerBeat, setStepsPerBeat] = useState(2);
  const [patternRequest, setPatternRequest] = useState<{ patternId: string; requestId: number } | null>(null);
  const [trackRequest, setTrackRequest] = useState<{ trackId: string; requestId: number } | null>(null);
  const varySeedRef = useRef(1);

  useEffect(() => {
    const refreshOnlineState = () => setOffline(!navigator.onLine);
    window.addEventListener("online", refreshOnlineState);
    window.addEventListener("offline", refreshOnlineState);
    return () => {
      window.removeEventListener("online", refreshOnlineState);
      window.removeEventListener("offline", refreshOnlineState);
    };
  }, []);

  useEffect(() => {
    onDirtyChange(Boolean(editor && isDirty(editor)));
  }, [editor, onDirtyChange]);

  useEffect(() => {
    setState("loading");
    setMessage("");
    setEditor(null);
    void Promise.all([
      apiRequest<ProjectSummary[]>("/api/projects"),
      apiRequest<GalleryComposition[]>("/api/composition-gallery"),
    ])
      .then(async ([loadedProjects, loadedGallery]) => {
        setProjects(loadedProjects);
        setGallery(loadedGallery);
        setSelectedProjectId((current) => current || projectId || loadedProjects[0]?.id || "");
        setSelectedExampleId((current) => current || loadedGallery[0]?.id || "");
        if (!projectId || !compositionId) {
          setState("ready");
          return;
        }
        if (!loadedProjects.some((project) => project.id === projectId)) {
          setState("missing");
          setMessage("Projet introuvable.");
          return;
        }
        const composition = await apiRequest<EditableComposition>(
          `/api/projects/${projectId}/compositions/${compositionId}`,
        );
        setEditor(createEditorState(composition));
        setState("ready");
      })
      .catch((error: unknown) => {
        setState(error instanceof ApiError && error.status === 404 ? "missing" : "error");
        setMessage(error instanceof Error ? error.message : "Impossible de charger l’éditeur.");
      });
  }, [compositionId, projectId]);

  const saveInFlightRef = useRef<Promise<EditableComposition | null> | null>(null);

  const save = useCallback(async (): Promise<EditableComposition | null> => {
    if (!editor || !projectId || !compositionId) return null;
    if (!isDirty(editor)) return editor.composition;
    if (saveInFlightRef.current) return saveInFlightRef.current;
    const pending = markSaving(editor);
    setEditor(pending);
    const request = (async (): Promise<EditableComposition | null> => {
      try {
        const saved = await apiRequest<EditableComposition>(`/api/projects/${projectId}/compositions/${compositionId}`, {
          method: "PUT",
          body: JSON.stringify({ expected_revision: editor.composition.revision, composition: editor.composition }),
        });
        setEditor(markSaved(pending, saved));
        return saved;
      } catch (error) {
        setEditor(markSaveFailed(pending, error instanceof Error ? error.message : "Sauvegarde impossible."));
        return null;
      } finally {
        saveInFlightRef.current = null;
      }
    })();
    saveInFlightRef.current = request;
    return request;
  }, [compositionId, editor, projectId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!editor) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void save();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        setEditor((current) => (current ? (event.shiftKey ? redo(current) : undo(current)) : current));
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
        event.preventDefault();
        setEditor((current) => (current ? redo(current) : current));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editor, save]);

  async function copyExample(event: FormEvent) {
    event.preventDefault();
    if (!selectedProjectId || !selectedExampleId) return;
    try {
      const copied = await apiRequest<EditableComposition>(`/api/projects/${selectedProjectId}/compositions`, {
        method: "POST",
        body: JSON.stringify({ example_id: selectedExampleId }),
      });
      onNavigate(editorPath(selectedProjectId, copied.id));
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Impossible de créer la copie.");
    }
  }

  if (state === "loading")
    return (
      <p className="page-state" role="status">
        Chargement de l’éditeur…
      </p>
    );
  if (state === "missing")
    return (
      <p className="page-state page-state--error" role="alert">
        {message}
      </p>
    );
  if (state === "error")
    return (
      <p className="page-state page-state--error" role="alert">
        Erreur : {message}
      </p>
    );

  return (
    <section className="editor-page" aria-labelledby="editor-title">
      <header className="editor-page__header">
        <div>
          <p className="eyebrow">Projet local</p>
          <h1 id="editor-title">Éditeur musical</h1>
        </div>
        {offline && (
          <p className="offline-notice" role="status">
            Hors ligne : les données déjà chargées restent disponibles.
          </p>
        )}
      </header>
      {!editor ? (
        <section className="editor-page__empty">
          <h2>Ouvrir Lignes de nuit</h2>
          <p>Créez une copie éditable dans un projet. L’exemple de galerie reste inchangé.</p>
          {projects.length === 0 || gallery.length === 0 ? (
            <p role="status">Aucun projet ou exemple disponible.</p>
          ) : (
            <form onSubmit={copyExample}>
              <label>
                Projet
                <select
                  aria-label="Projet de destination"
                  value={selectedProjectId}
                  onChange={(event) => setSelectedProjectId(event.target.value)}
                >
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Exemple
                <select
                  aria-label="Exemple de composition"
                  value={selectedExampleId}
                  onChange={(event) => setSelectedExampleId(event.target.value)}
                >
                  {gallery.map((example) => (
                    <option key={example.id} value={example.id}>
                      {example.title}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit">Créer une copie éditable</button>
            </form>
          )}
        </section>
      ) : (
        <section className="editor-workspace" aria-label="Composition ouverte">
          <div className="editor-toolbar">
            <p className="eyebrow">Révision {editor.composition.revision}</p>
            <span aria-live="polite">{isDirty(editor) ? "Modifications non enregistrées" : "Enregistré"}</span>
            <button
              type="button"
              disabled={!editor.undoStack.length}
              onClick={() => setEditor((current) => (current ? undo(current) : current))}
            >
              Annuler
            </button>
            <button
              type="button"
              disabled={!editor.redoStack.length}
              onClick={() => setEditor((current) => (current ? redo(current) : current))}
            >
              Rétablir
            </button>
            <button type="button" disabled={!isDirty(editor) || editor.saving} onClick={() => void save()}>
              {editor.saving ? "Sauvegarde…" : "Sauvegarder"}
            </button>
          </div>
          <TransportBar
            composition={editor.composition}
            projectId={projectId ?? ""}
            compositionId={compositionId ?? ""}
            ensureSaved={save}
            patternRequest={patternRequest}
            trackRequest={trackRequest}
          />
          <h2 className="editor-workspace__title">{editor.composition.title}</h2>
          {editor.saveError && (
            <p className="error" role="alert">
              {editor.saveError}
            </p>
          )}
          <div className="editor-properties">
            <label>
              Titre
              <input
                aria-label="Titre de la composition"
                value={editor.composition.title}
                onChange={(event) =>
                  setEditor((current) =>
                    current
                      ? execute(
                          current,
                          "Modifier le titre",
                          (draft) => {
                            draft.title = event.target.value;
                          },
                          true,
                        )
                      : current,
                  )
                }
              />
            </label>
            <label>
              Tempo
              <input
                aria-label="Tempo"
                type="number"
                min="20"
                max="400"
                value={editor.composition.tempo_bpm}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (Number.isFinite(value) && value >= 20 && value <= 400)
                    setEditor((current) =>
                      current
                        ? execute(current, "Modifier le tempo", (draft) => {
                            draft.tempo_bpm = value;
                          })
                        : current,
                    );
                }}
              />
            </label>
            <label>
              Snap
              <select
                aria-label="Grille temporelle"
                value={editor.grid.snapBeats}
                onChange={(event) =>
                  setEditor((current) =>
                    current ? setGrid(current, { snapBeats: Number(event.target.value) }) : current,
                  )
                }
              >
                <option value="1">1 temps</option>
                <option value="0.5">1/2 temps</option>
                <option value="0.25">1/4 temps</option>
                <option value="0.125">1/8 temps</option>
              </select>
            </label>
            <label>
              Zoom horizontal
              <input
                aria-label="Zoom horizontal"
                type="number"
                min="0.25"
                max="8"
                step="0.25"
                value={editor.grid.horizontalZoom}
                onChange={(event) =>
                  setEditor((current) =>
                    current ? setGrid(current, { horizontalZoom: Number(event.target.value) }) : current,
                  )
                }
              />
            </label>
            <label>
              Défilement
              <input
                aria-label="Défilement temporel"
                type="number"
                min="0"
                step="1"
                value={editor.grid.scrollBeat}
                onChange={(event) =>
                  setEditor((current) =>
                    current ? setGrid(current, { scrollBeat: Number(event.target.value) }) : current,
                  )
                }
              />
            </label>
          </div>
          <section className="track-browser" aria-labelledby="tracks-heading">
            <div className="track-browser__header">
              <h2 id="tracks-heading">Channel Rack ({editor.composition.tracks.length})</h2>
              <div>
                <button type="button" onClick={() => setEditor((current) => current && selectAll(current, "tracks"))}>
                  Tout sélectionner
                </button>
                <button
                  type="button"
                  disabled={!editor.selection.tracks.length}
                  onClick={() => setEditor((current) => (current ? clearSelection(current) : current))}
                >
                  Désélectionner
                </button>
                <button
                  type="button"
                  disabled={!editor.selection.tracks.length}
                  onClick={() => setEditor((current) => current && cutSelection(current, "tracks"))}
                >
                  Couper
                </button>
                <button
                  type="button"
                  disabled={!editor.selection.tracks.length}
                  onClick={() => setEditor((current) => current && copySelection(current, "tracks"))}
                >
                  Copier
                </button>
                <button
                  type="button"
                  disabled={!editor.clipboard}
                  onClick={() => setEditor((current) => current && paste(current))}
                >
                  Coller
                </button>
                <button
                  type="button"
                  disabled={!editor.selection.tracks.length}
                  onClick={() => setEditor((current) => current && duplicateSelection(current, "tracks"))}
                >
                  Dupliquer
                </button>
                <button
                  type="button"
                  disabled={!editor.selection.tracks.length}
                  onClick={() => setEditor((current) => current && deleteSelection(current, "tracks"))}
                >
                  Supprimer
                </button>
              </div>
            </div>
            <VirtualList
              items={editor.composition.tracks}
              idFor={(track) => track.id}
              height={280}
              rowHeight={48}
              overscan={4}
              ariaLabel="Pistes de la composition"
              renderRow={(track) => (
                <ChannelRackRow
                  track={track}
                  channel={editor.composition.mixer_channels?.find((c) => c.track_id === track.id)}
                  selected={editor.selection.tracks.includes(track.id)}
                  onSelect={(trackId, additive) =>
                    setEditor((current) => current && select(current, "tracks", [trackId], additive))
                  }
                  onToggleMute={(trackId) =>
                    setEditor((current) =>
                      current &&
                      setTrackChannelFlag(
                        current,
                        trackId,
                        "mute",
                        !(current.composition.mixer_channels?.find((c) => c.track_id === trackId)?.mute ?? false),
                      ),
                    )
                  }
                  onToggleSolo={(trackId) =>
                    setEditor((current) =>
                      current &&
                      setTrackChannelFlag(
                        current,
                        trackId,
                        "solo",
                        !(current.composition.mixer_channels?.find((c) => c.track_id === trackId)?.solo ?? false),
                      ),
                    )
                  }
                />
              )}
            />
          </section>
          <Playlist
            editor={editor}
            onSelect={(collection, ids, additive) =>
              setEditor((current) => (current ? select(current, collection, ids, additive) : current))
            }
            onMoveClip={(clipId, deltaBeats, groupWithPrevious) =>
              setEditor((current) =>
                current ? moveClip(current, clipId, deltaBeats, groupWithPrevious) : current,
              )
            }
            onResizeClip={(clipId, deltaBeats, groupWithPrevious) =>
              setEditor((current) =>
                current ? resizeClip(current, clipId, deltaBeats, groupWithPrevious) : current,
              )
            }
            onRippleMoveClip={(clipId, deltaBeats, groupWithPrevious) =>
              setEditor((current) =>
                current ? rippleMoveClip(current, clipId, deltaBeats, groupWithPrevious) : current,
              )
            }
            onSplitClip={(clipId, atBeat) =>
              setEditor((current) => (current ? splitClip(current, clipId, atBeat) : current))
            }
            onAddClip={(patternId, startBeat) =>
              setEditor((current) =>
                current
                  ? addClip(current, patternId, startBeat, current.composition.patterns.find((p) => p.id === patternId)?.length_beats ?? 4)
                  : current,
              )
            }
            onToggleMute={(clipId) =>
              setEditor((current) => {
                if (!current) return current;
                const clip = current.composition.clips.find((item) => item.id === clipId);
                return clip ? setClipMute(current, clipId, !(clip.mute ?? false)) : current;
              })
            }
            onToggleLock={(clipId) =>
              setEditor((current) => {
                if (!current) return current;
                const clip = current.composition.clips.find((item) => item.id === clipId);
                return clip ? setClipLocked(current, clipId, !(clip.locked ?? false)) : current;
              })
            }
            onSetRepeat={(clipId, repeat) =>
              setEditor((current) => (current ? setClipRepeat(current, clipId, repeat) : current))
            }
            onSetTransposition={(clipId, semitones) =>
              setEditor((current) => (current ? setClipTransposition(current, clipId, semitones) : current))
            }
            onInsertTime={(beat, lengthBeats) =>
              setEditor((current) => (current ? insertTime(current, beat, lengthBeats) : current))
            }
            onDeleteTime={(beat, lengthBeats) =>
              setEditor((current) => (current ? deleteTime(current, beat, lengthBeats) : current))
            }
            onAddMarker={(beat) =>
              setEditor((current) => (current ? addMarker(current, beat, "repère") : current))
            }
            onMoveMarker={(markerId, beat) =>
              setEditor((current) => (current ? moveMarker(current, markerId, beat) : current))
            }
            onRenameMarker={(markerId, label) =>
              setEditor((current) => (current ? renameMarker(current, markerId, label) : current))
            }
            onDeleteMarker={(markerId) =>
              setEditor((current) => (current ? deleteMarker(current, markerId) : current))
            }
            onAddTrack={(name, kind) =>
              setEditor((current) => (current ? addTrack(current, name, kind) : current))
            }
            onRenameTrack={(trackId, name) =>
              setEditor((current) => (current ? renameTrack(current, trackId, name) : current))
            }
            onMoveTrack={(trackId, offset) =>
              setEditor((current) => (current ? moveTrack(current, trackId, offset) : current))
            }
          />
          <PatternEditor
            editor={editor}
            selectedPatternId={selectedPatternId}
            onSelectPattern={setSelectedPatternId}
            stepsPerBeat={stepsPerBeat}
            onStepsPerBeatChange={setStepsPerBeat}
            onSetSteps={(patternId, cells, enabled) =>
              setEditor((current) =>
                current ? setSteps(current, patternId, cells, stepsPerBeat, enabled) : current,
              )
            }
            onSetStepField={(patternId, cells, field, value) =>
              setEditor((current) =>
                current ? setStepFieldCells(current, patternId, cells, stepsPerBeat, field, value) : current,
              )
            }
            onFill={(patternId, midiNote, kind) =>
              setEditor((current) =>
                current ? fillPatternRow(current, patternId, midiNote, stepsPerBeat, kind) : current,
              )
            }
            onClearRow={(patternId, midiNote) =>
              setEditor((current) => (current ? clearPatternRow(current, patternId, midiNote) : current))
            }
            onPreview={(patternId) =>
              setPatternRequest((current) => ({ patternId, requestId: (current?.requestId ?? 0) + 1 }))
            }
            onSelectNotes={(noteIds, additive) =>
              setEditor((current) => (current ? selectNotes(current, noteIds, additive) : current))
            }
            onAddNote={(patternId, startBeat, durationBeats, midiNote) =>
              setEditor((current) =>
                current ? addNote(current, patternId, startBeat, durationBeats, midiNote) : current,
              )
            }
            onMoveNotes={(patternId, noteIds, deltaBeats, deltaMidi, groupWithPrevious) =>
              setEditor((current) =>
                current
                  ? moveNotes(current, patternId, noteIds, deltaBeats, deltaMidi, groupWithPrevious)
                  : current,
              )
            }
            onResizeNotes={(patternId, noteIds, deltaBeats, groupWithPrevious) =>
              setEditor((current) =>
                current ? resizeNotes(current, patternId, noteIds, deltaBeats, groupWithPrevious) : current,
              )
            }
            onDeleteNotes={(patternId, noteIds) =>
              setEditor((current) => (current ? deleteNotes(current, patternId, noteIds) : current))
            }
            onSetNoteFields={(patternId, noteIds, field, value, groupWithPrevious) =>
              setEditor((current) =>
                current
                  ? setNoteFields(current, patternId, noteIds, field, value, groupWithPrevious)
                  : current,
              )
            }
            onQuantize={(patternId, noteIds) =>
              setEditor((current) =>
                current
                  ? quantizeNotes(current, patternId, noteIds, current.grid.snapBeats)
                  : current,
              )
            }
            onSwing={(patternId, noteIds, amount) =>
              setEditor((current) => (current ? swingNotes(current, patternId, noteIds, amount) : current))
            }
            onHumanize={(patternId, noteIds) =>
              setEditor((current) => (current ? humanizeNotes(current, patternId, noteIds, 42, 0.5) : current))
            }
            onTranspose={(patternId, noteIds, semitones) =>
              setEditor((current) =>
                current ? transposeNotes(current, patternId, noteIds, semitones) : current,
              )
            }
            onLegato={(patternId, noteIds) =>
              setEditor((current) => (current ? legatoNotes(current, patternId, noteIds) : current))
            }
            onUniformDuration={(patternId, noteIds, durationBeats) =>
              setEditor((current) =>
                current ? uniformDuration(current, patternId, noteIds, durationBeats) : current,
              )
            }
            onInvert={(patternId, noteIds, axisMidi) =>
              setEditor((current) => (current ? invertNotes(current, patternId, noteIds, axisMidi) : current))
            }
            onBuildChord={(patternId, rootNoteId, type) =>
              setEditor((current) => (current ? buildChord(current, patternId, rootNoteId, type) : current))
            }
            onDuplicateNotes={(patternId, noteIds, deltaBeats, deltaMidi) =>
              setEditor((current) =>
                current ? duplicateNotes(current, patternId, noteIds, deltaBeats, deltaMidi) : current,
              )
            }
            onPreviewTrack={(trackId) =>
              setTrackRequest((current) => ({ trackId, requestId: (current?.requestId ?? 0) + 1 }))
            }
            onRename={(patternId, name) =>
              setEditor((current) => (current ? renamePattern(current, patternId, name, true) : current))
            }
            onSetColor={(patternId, color) =>
              setEditor((current) => (current ? setPatternColor(current, patternId, color) : current))
            }
            onSetLength={(patternId, lengthBeats) =>
              setEditor((current) => (current ? setPatternLength(current, patternId, lengthBeats, true) : current))
            }
            onDuplicate={(patternId) =>
              setEditor((current) => (current ? duplicatePattern(current, patternId) : current))
            }
            onVary={(patternId) =>
              setEditor((current) =>
                current ? varyPattern(current, patternId, varySeedRef.current++) : current,
              )
            }
            onDelete={(patternId) =>
              setEditor((current) =>
                current ? deleteSelection(select(current, "patterns", [patternId]), "patterns") : current,
              )
            }
          />
        </section>
      )}
    </section>
  );
}
