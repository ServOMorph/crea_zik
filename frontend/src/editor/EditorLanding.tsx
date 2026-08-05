import { FormEvent, useCallback, useEffect, useState } from "react";

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
  isDirty,
  markSaveFailed,
  markSaved,
  markSaving,
  paste,
  redo,
  select,
  selectAll,
  setGrid,
  setStep,
  setStepField,
  setTrackChannelFlag,
  undo,
} from "./editorStore";
import { ChannelRackRow } from "./ChannelRack";
import { StepSequencer } from "./StepSequencer";
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

  const save = useCallback(async (): Promise<EditableComposition | null> => {
    if (!editor || !projectId || !compositionId || editor.saving) return null;
    if (!isDirty(editor)) return editor.composition;
    const pending = markSaving(editor);
    setEditor(pending);
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
    }
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
          <SequencerPanel
            editor={editor}
            selectedPatternId={selectedPatternId}
            onSelectPattern={setSelectedPatternId}
            stepsPerBeat={stepsPerBeat}
            onStepsPerBeatChange={setStepsPerBeat}
            onPreview={(patternId) =>
              setPatternRequest((current) => ({ patternId, requestId: (current?.requestId ?? 0) + 1 }))
            }
            onSetStep={(patternId, midiNote, stepIndex, enabled) =>
              setEditor((current) => (current ? setStep(current, patternId, midiNote, stepIndex, stepsPerBeat, enabled) : current))
            }
            onSetStepField={(patternId, midiNote, stepIndex, field, value) =>
              setEditor((current) => (current ? setStepField(current, patternId, midiNote, stepIndex, stepsPerBeat, field, value) : current))
            }
          />
        </section>
      )}
    </section>
  );
}

type SequencerPanelProps = {
  editor: ReturnType<typeof createEditorState>;
  selectedPatternId: string | null;
  onSelectPattern: (patternId: string) => void;
  stepsPerBeat: number;
  onStepsPerBeatChange: (value: number) => void;
  onPreview: (patternId: string) => void;
  onSetStep: (patternId: string, midiNote: number, stepIndex: number, enabled: boolean) => void;
  onSetStepField: (
    patternId: string,
    midiNote: number,
    stepIndex: number,
    field: "velocity" | "probability" | "micro_timing_beats" | "duration_beats",
    value: number,
  ) => void;
};

function SequencerPanel({
  editor,
  selectedPatternId,
  onSelectPattern,
  stepsPerBeat,
  onStepsPerBeatChange,
  onPreview,
  onSetStep,
  onSetStepField,
}: SequencerPanelProps) {
  const selectedTrack =
    editor.composition.tracks.find((track) => editor.selection.tracks.includes(track.id)) ??
    editor.composition.tracks.find((track) => track.kind === "drums");
  const drumPatterns =
    selectedTrack?.kind === "drums"
      ? editor.composition.patterns.filter((pattern) => pattern.track_id === selectedTrack.id)
      : [];
  const activePattern = drumPatterns.find((pattern) => pattern.id === selectedPatternId) ?? drumPatterns[0] ?? null;
  if (!activePattern) {
    return (
      <section className="step-sequencer" aria-labelledby="sequencer-heading">
        <h3 id="sequencer-heading">Séquenceur pas à pas</h3>
        <p className="step-sequencer__hint">
          {selectedTrack
            ? "Seuls les patterns des pistes de batterie sont éditables au pas à pas."
            : "Sélectionnez une piste de batterie pour éditer ses patterns."}
        </p>
      </section>
    );
  }
  return (
    <>
      {drumPatterns.length > 1 && (
        <label>
          Pattern
          <select
            aria-label="Pattern de batterie"
            value={activePattern.id}
            onChange={(event) => onSelectPattern(event.target.value)}
          >
            {drumPatterns.map((pattern, index) => (
              <option key={pattern.id} value={pattern.id}>
                Pattern {index + 1}
              </option>
            ))}
          </select>
        </label>
      )}
      <StepSequencer
        pattern={activePattern}
        stepsPerBeat={stepsPerBeat}
        onStepsPerBeatChange={onStepsPerBeatChange}
        onSetStep={(midiNote, stepIndex, enabled) =>
          onSetStep(activePattern.id, midiNote, stepIndex, enabled)
        }
        onSetStepField={(midiNote, stepIndex, field, value) =>
          onSetStepField(activePattern.id, midiNote, stepIndex, field, value)
        }
        onPreview={() => onPreview(activePattern.id)}
      />
    </>
  );
}
