import { FormEvent, KeyboardEvent, PointerEvent, useRef, useState } from "react";

import type { Clip, EditorState, Marker, Pattern, Track } from "./editorStore";
import {
  clipEnd,
  clipStart,
  clipTrackId,
  compositionEndBeat,
  obscuredClipIds,
  snapBeat,
} from "./clipCommands";

const LANE_HEIGHT = 56;
const CLIP_HEIGHT = 44;
const PX_PER_BEAT = 96;
const RENDER_CLIP_LIMIT = 300;
const TRACK_KINDS = ["drums", "bass", "pad", "arp", "lead", "audio", "midi"];

export type PlaylistProps = {
  editor: EditorState;
  onSelect: (collection: "clips" | "markers", ids: string[], additive: boolean) => void;
  onMoveClip: (clipId: string, deltaBeats: number, groupWithPrevious: boolean) => void;
  onResizeClip: (clipId: string, deltaBeats: number, groupWithPrevious: boolean) => void;
  onRippleMoveClip: (clipId: string, deltaBeats: number, groupWithPrevious: boolean) => void;
  onSplitClip: (clipId: string, atBeat: number) => void;
  onAddClip: (patternId: string, startBeat: number) => void;
  onToggleMute: (clipId: string) => void;
  onToggleLock: (clipId: string) => void;
  onSetRepeat: (clipId: string, repeat: number) => void;
  onSetTransposition: (clipId: string, semitones: number) => void;
  onInsertTime: (beat: number, lengthBeats: number) => void;
  onDeleteTime: (beat: number, lengthBeats: number) => void;
  onAddMarker: (beat: number) => void;
  onMoveMarker: (markerId: string, beat: number) => void;
  onRenameMarker: (markerId: string, label: string) => void;
  onDeleteMarker: (markerId: string) => void;
  onAddTrack: (name: string, kind: string) => void;
  onRenameTrack: (trackId: string, name: string) => void;
  onMoveTrack: (trackId: string, offset: -1 | 1) => void;
};

type DragState = {
  id: string;
  startX: number;
  lastApplied: number;
  resize: boolean;
};

function beatFromClientX(clientX: number, gridLeft: number, pxPerBeat: number) {
  return (clientX - gridLeft) / pxPerBeat;
}

export function Playlist({
  editor,
  onSelect,
  onMoveClip,
  onResizeClip,
  onRippleMoveClip,
  onSplitClip,
  onAddClip,
  onToggleMute,
  onToggleLock,
  onSetRepeat,
  onSetTransposition,
  onInsertTime,
  onDeleteTime,
  onAddMarker,
  onMoveMarker,
  onRenameMarker,
  onDeleteMarker,
  onAddTrack,
  onRenameTrack,
  onMoveTrack,
}: PlaylistProps) {
  const composition = editor.composition;
  const gridRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const [ripple, setRipple] = useState(false);
  const [patternId, setPatternId] = useState(composition.patterns[0]?.id ?? "");
  const [timeBeat, setTimeBeat] = useState(0);
  const [newTrackName, setNewTrackName] = useState("");
  const [newTrackKind, setNewTrackKind] = useState(TRACK_KINDS[0]);
  const [editingTrackId, setEditingTrackId] = useState<string | null>(null);
  const [editingTrackName, setEditingTrackName] = useState("");
  const [editingMarkerId, setEditingMarkerId] = useState<string | null>(null);
  const [editingMarkerLabel, setEditingMarkerLabel] = useState("");

  const pxPerBeat = PX_PER_BEAT * editor.grid.horizontalZoom;
  const totalBeats = Math.max(compositionEndBeat(composition), 16) + 4;
  const totalWidth = totalBeats * pxPerBeat;
  const obscured = obscuredClipIds(composition);
  const selectedClipId = editor.selection.clips[0];

  const stopDrag = () => {
    dragRef.current = null;
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", stopDrag);
  };

  const startClipDrag = (event: PointerEvent<Element>, clip: Clip, resize: boolean) => {
    if (clip.locked) return;
    dragRef.current = {
      id: clip.id,
      startX: event.clientX,
      lastApplied: 0,
      resize,
    };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopDrag);
    event.preventDefault();
    onSelect("clips", [clip.id], event.ctrlKey || event.metaKey);
  };

  const startMarkerDrag = (event: PointerEvent<Element>, marker: Marker) => {
    const gridLeft = gridRef.current?.getBoundingClientRect().left ?? 0;
    const move = (moveEvent: globalThis.PointerEvent) => {
      const beat = snapBeat(
        beatFromClientX(moveEvent.clientX, gridLeft, pxPerBeat),
        editor.grid.snapBeats,
      );
      onMoveMarker(marker.id, Math.max(0, beat));
    };
    const finish = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
    event.preventDefault();
    onSelect("markers", [marker.id], event.ctrlKey || event.metaKey);
  };

  function handlePointerMove(event: globalThis.PointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;
    const totalDelta = (event.clientX - drag.startX) / pxPerBeat;
    const snapped = snapBeat(totalDelta, editor.grid.snapBeats);
    const delta = snapped - drag.lastApplied;
    if (delta === 0) return;
    drag.lastApplied = snapped;
    const clip = composition.clips.find((item) => item.id === drag.id);
    if (!clip) return;
    if (drag.resize) onResizeClip(clip.id, delta, true);
    else if (ripple) onRippleMoveClip(clip.id, delta, true);
    else onMoveClip(clip.id, delta, true);
  }

  const measureBeats = composition.time_signature[0];

  const addClipAtEnd = () => {
    const pattern = composition.patterns.find((item) => item.id === patternId);
    if (!pattern) return;
    onAddClip(pattern.id, compositionEndBeat(composition));
  };

  const submitTimeEdit = (event: FormEvent) => {
    event.preventDefault();
    onInsertTime(Number(timeBeat), measureBeats);
  };

  const submitTrackRename = (event: FormEvent, trackId: string) => {
    event.preventDefault();
    onRenameTrack(trackId, editingTrackName);
    setEditingTrackId(null);
  };

  const submitMarkerRename = (event: FormEvent, markerId: string) => {
    event.preventDefault();
    onRenameMarker(markerId, editingMarkerLabel);
    setEditingMarkerId(null);
  };

  const handleTrackRenameKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") setEditingTrackId(null);
  };

  const handleMarkerRenameKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") setEditingMarkerId(null);
  };

  const addTrackNow = () => {
    onAddTrack(newTrackName, newTrackKind);
    setNewTrackName("");
  };

  const clipLabel = (clip: Clip, pattern: Pattern | undefined, track: Track | undefined) => {
    const parts = [pattern?.name ?? "Pattern sans nom"];
    if (clip.repeat_count && clip.repeat_count > 1) parts.push(`×${clip.repeat_count}`);
    if (clip.mute) parts.push("muet");
    if (clip.locked) parts.push("verrouillé");
    return `${parts.join(" ")} (piste ${track?.name ?? "?"})`;
  };

  return (
    <section className="playlist" aria-labelledby="playlist-heading">
      <div className="playlist__header">
        <h2 id="playlist-heading">Playlist ({composition.clips.length} clips)</h2>
        <div className="playlist__toolbar">
          <label>
            Pattern
            <select aria-label="Pattern à placer" value={patternId} onChange={(event) => setPatternId(event.target.value)}>
              {composition.patterns.map((pattern) => {
                const track = composition.tracks.find((item) => item.id === pattern.track_id);
                return (
                  <option key={pattern.id} value={pattern.id}>
                    {track?.name ?? "?"} — {pattern.name ?? "sans nom"}
                  </option>
                );
              })}
            </select>
          </label>
          <button type="button" onClick={addClipAtEnd}>
            Ajouter un clip
          </button>
          <form className="playlist__time-form" onSubmit={submitTimeEdit}>
            <label>
              Beat
              <input
                aria-label="Beat pour insérer ou supprimer du temps"
                type="number"
                min="0"
                step="0.25"
                value={timeBeat}
                onChange={(event) => setTimeBeat(Number(event.target.value))}
              />
            </label>
            <button type="submit">Insérer du temps</button>
            <button type="button" onClick={() => onDeleteTime(Number(timeBeat), measureBeats)}>
              Supprimer du temps
            </button>
          </form>
          <label className="playlist__toggle">
            <input type="checkbox" checked={ripple} onChange={(event) => setRipple(event.target.checked)} />
            Ripple
          </label>
          <button type="button" onClick={() => onAddMarker(compositionEndBeat(composition))}>
            Ajouter un marqueur
          </button>
        </div>
      </div>
      {selectedClipId && (() => {
        const clip = composition.clips.find((item) => item.id === selectedClipId);
        if (!clip) return null;
        return (
          <div className="playlist__clip-actions" aria-label="Actions du clip sélectionné">
            <button type="button" onClick={() => onToggleMute(clip.id)}>
              {clip.mute ? "Réactiver" : "Muet"}
            </button>
            <button type="button" onClick={() => onToggleLock(clip.id)}>
              {clip.locked ? "Déverrouiller" : "Verrouiller"}
            </button>
            <label>
              Répétitions
              <input
                aria-label="Répétitions du clip"
                type="number"
                min="1"
                max="10000"
                value={clip.repeat_count ?? 1}
                onChange={(event) => onSetRepeat(clip.id, Number(event.target.value))}
              />
            </label>
            <label>
              Transposition
              <input
                aria-label="Transposition du clip"
                type="number"
                min="-48"
                max="48"
                value={clip.transposition ?? 0}
                onChange={(event) => onSetTransposition(clip.id, Number(event.target.value))}
              />
            </label>
            <button
              type="button"
              onClick={() => onSplitClip(clip.id, snapBeat(editor.grid.scrollBeat, editor.grid.snapBeats))}
            >
              Découper
            </button>
          </div>
        );
      })()}
      <div className="playlist__add-track">
        <input
          aria-label="Nom de la nouvelle piste"
          value={newTrackName}
          placeholder="Nouvelle piste"
          onChange={(event) => setNewTrackName(event.target.value)}
        />
        <select
          aria-label="Type de piste"
          value={newTrackKind}
          onChange={(event) => setNewTrackKind(event.target.value)}
        >
          {TRACK_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {kind}
            </option>
          ))}
        </select>
        <button type="button" onClick={addTrackNow}>
          Ajouter une piste
        </button>
      </div>
      {composition.clips.length > RENDER_CLIP_LIMIT ? (
        <p className="playlist__density" role="alert">
          Trop de clips pour l’affichage (limite de {RENDER_CLIP_LIMIT}). Réduisez le nombre de clips ou le zoom.
        </p>
      ) : (
        <div className="playlist__scroll">
          <div className="playlist__grid" style={{ width: `${totalWidth}px` }}>
            <div className="playlist__side" style={{ width: "220px" }}>
              <div className="playlist__side-header">Pistes</div>
              {composition.tracks.map((track) => (
                <div className="playlist__lane-head" key={track.id} style={{ height: `${LANE_HEIGHT}px` }}>
                  {editingTrackId === track.id ? (
                    <form onSubmit={(event) => submitTrackRename(event, track.id)}>
                      <input
                        aria-label="Nom de la piste"
                        value={editingTrackName}
                        autoFocus
                        onChange={(event) => setEditingTrackName(event.target.value)}
                        onKeyDown={handleTrackRenameKey}
                      />
                    </form>
                  ) : (
                    <button
                      type="button"
                      className="playlist__lane-name"
                      onDoubleClick={() => {
                        setEditingTrackId(track.id);
                        setEditingTrackName(track.name);
                      }}
                    >
                      {track.name}
                    </button>
                  )}
                  <div className="playlist__lane-actions">
                    <button
                      type="button"
                      aria-label={`Monter la piste ${track.name}`}
                      disabled={composition.tracks.indexOf(track) === 0}
                      onClick={() => onMoveTrack(track.id, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label={`Descendre la piste ${track.name}`}
                      disabled={composition.tracks.indexOf(track) === composition.tracks.length - 1}
                      onClick={() => onMoveTrack(track.id, 1)}
                    >
                      ↓
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="playlist__timeline" ref={gridRef}>
              <div className="playlist__ruler" style={{ height: "28px" }}>
                {Array.from({ length: totalBeats + 1 }, (_, beat) => (
                  <div
                    key={beat}
                    className={`playlist__beat-tick${beat % measureBeats === 0 ? " playlist__beat-tick--measure" : ""}`}
                    style={{ left: `${beat * pxPerBeat}px` }}
                  >
                    {beat % measureBeats === 0 ? beat : ""}
                  </div>
                ))}
              </div>
              <div className="playlist__markers-lane" style={{ height: "32px" }}>
                {composition.markers?.map((marker) => (
                  <div
                    key={marker.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Marqueur ${marker.label} à ${marker.beat}`}
                    className={`playlist__marker${editor.selection.markers.includes(marker.id) ? " is-selected" : ""}`}
                    style={{ left: `${marker.beat * pxPerBeat}px` }}
                    onPointerDown={(event) => startMarkerDrag(event, marker)}
                    onDoubleClick={() => {
                      setEditingMarkerId(marker.id);
                      setEditingMarkerLabel(marker.label);
                    }}
                  >
                    {editingMarkerId === marker.id ? (
                      <form onSubmit={(event) => submitMarkerRename(event, marker.id)}>
                        <input
                          aria-label="Libellé du marqueur"
                          value={editingMarkerLabel}
                          autoFocus
                          onChange={(event) => setEditingMarkerLabel(event.target.value)}
                          onKeyDown={handleMarkerRenameKey}
                        />
                      </form>
                    ) : (
                      marker.label
                    )}
                    <button
                      type="button"
                      aria-label={`Supprimer le marqueur ${marker.label}`}
                      onClick={() => onDeleteMarker(marker.id)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              {composition.tracks.map((track) => (
                <div className="playlist__lane" key={track.id} style={{ height: `${LANE_HEIGHT}px` }}>
                  {composition.clips
                    .filter((clip) => clipTrackId(composition, clip) === track.id)
                    .map((clip) => {
                      const pattern = composition.patterns.find((item) => item.id === clip.pattern_id);
                      const start = clipStart(clip);
                      const width = (clipEnd(clip) - start) * pxPerBeat;
                      return (
                        <div
                          key={clip.id}
                          role="button"
                          tabIndex={0}
                          aria-label={clipLabel(clip, pattern, track)}
                          className={`playlist__clip${editor.selection.clips.includes(clip.id) ? " is-selected" : ""}${clip.mute ? " is-muted" : ""}${clip.locked ? " is-locked" : ""}${obscured.has(clip.id) ? " is-obscured" : ""}`}
                          style={{
                            left: `${start * pxPerBeat}px`,
                            width: `${width}px`,
                            height: `${CLIP_HEIGHT}px`,
                          }}
                          onPointerDown={(event) => startClipDrag(event, clip, false)}
                          onDoubleClick={(event) => {
                            const gridLeft = gridRef.current?.getBoundingClientRect().left ?? 0;
                            onSplitClip(clip.id, beatFromClientX(event.clientX, gridLeft, pxPerBeat));
                          }}
                        >
                          <span className="playlist__clip-title">
                            {pattern?.name ?? "?"}
                            {clip.repeat_count && clip.repeat_count > 1 ? ` ×${clip.repeat_count}` : ""}
                          </span>
                          {clip.transposition ? <span className="playlist__clip-transpose">+{clip.transposition}</span> : null}
                          <button
                            type="button"
                            className="playlist__clip-handle"
                            aria-label={`Redimensionner le clip ${pattern?.name ?? "sans nom"}`}
                            onPointerDown={(event) => {
                              event.stopPropagation();
                              startClipDrag(event, clip, true);
                            }}
                          />
                        </div>
                      );
                    })}
                </div>
              ))}
              <div className="playlist__duration" aria-hidden="true" style={{ left: `${totalWidth}px` }} />
            </div>
          </div>
        </div>
      )}
      <p className="playlist__hint">
        Fin de composition : {compositionEndBeat(composition)} temps (≈{" "}
        {((compositionEndBeat(composition) * 60) / composition.tempo_bpm).toFixed(1)} s) — clic : sélection, glisser :
        déplacer, bord droit : redimensionner, double-clic : découper.
      </p>
    </section>
  );
}
