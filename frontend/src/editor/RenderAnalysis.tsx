import { useCallback, useEffect, useRef, useState } from "react";

import { apiRequest } from "../api/client";
import type { EditableComposition, Track } from "./editorStore";

type JobResponse = { id: string; state: string; progress: number };
type JobState = { id: string; state: string; progress: number; error?: string };
type QaReport = { passed: boolean; profile: string; issues: string[]; metrics: Record<string, number> };
type ExportResponse = { wav: string; manifest: string };
type RenderFormat = "wav_pcm24" | "wav_pcm16" | "wav_float32";
type RenderScope = "full" | "tracks" | "clips" | "loop";

type RenderAnalysisProps = {
  projectId: string;
  compositionId: string;
  tracks: Track[];
  selectedClipIds: string[];
  renderFormat: RenderFormat;
  onSetRenderFormat: (format: RenderFormat) => void;
  ensureSaved: () => Promise<EditableComposition | null>;
};

type RenderInfo = {
  revision: number;
  up_to_date: boolean;
  stale: boolean;
  manifest_url: string;
  qa_url: string;
};

const METRIC_LABELS: Record<string, string> = {
  sample_peak: "Pic échantillon",
  true_peak: "True peak",
  lufs: "LUFS",
  rms: "RMS",
  dc_offset: "Décalage DC",
};

const NAMED_METRIC_ORDER = ["sample_peak", "true_peak", "lufs", "rms", "dc_offset"];

function sleep(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function latestOf(renders: RenderInfo[]): RenderInfo {
  return renders.reduce((a, b) => (a.revision > b.revision ? a : b));
}

export function RenderAnalysis({
  projectId,
  compositionId,
  tracks,
  selectedClipIds,
  renderFormat,
  onSetRenderFormat,
  ensureSaved,
}: RenderAnalysisProps) {
  const [job, setJob] = useState<JobState | null>(null);
  const [qa, setQa] = useState<QaReport | null>(null);
  const [latestRender, setLatestRender] = useState<RenderInfo | null>(null);
  const [exportInfo, setExportInfo] = useState<ExportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<"render" | "promote" | "export" | null>(null);
  const [queuedJobsCount, setQueuedJobsCount] = useState<number>(0);
  const [scope, setScope] = useState<RenderScope>("full");
  const [selectedTrackIds, setSelectedTrackIds] = useState<string[]>([]);
  const [loopStartBeat, setLoopStartBeat] = useState(0);
  const [loopEndBeat, setLoopEndBeat] = useState(8);
  const [waveform, setWaveform] = useState<number[] | null>(null);
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);
  const cancelRequestedRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const disabled = !projectId || !compositionId;
  const cancellable = job !== null && (job.state === "queued" || job.state === "running");

  const buildRenderBody = useCallback((): Record<string, unknown> => {
    if (scope === "tracks" && selectedTrackIds.length > 0) {
      return { track_ids: selectedTrackIds };
    }
    if (scope === "clips" && selectedClipIds.length > 0) {
      return { clip_ids: selectedClipIds };
    }
    if (scope === "loop") {
      return { start_beat: loopStartBeat, end_beat: loopEndBeat, loop: true };
    }
    return {};
  }, [loopEndBeat, loopStartBeat, scope, selectedClipIds, selectedTrackIds]);

  const refreshWaveform = useCallback(async (revision: number) => {
    try {
      const artifact = await apiRequest<{ wav: string }>(
        `/api/projects/${projectId}/compositions/${compositionId}/renders/${revision}/artifact`,
      );
      const response = await fetch(`/projects/${artifact.wav}`);
      if (!response.ok) return;
      const context = audioContextRef.current ?? new AudioContext();
      audioContextRef.current = context;
      const buffer = await context.decodeAudioData(await response.arrayBuffer());
      setDurationSeconds(buffer.duration);
      const channel = buffer.getChannelData(0);
      const buckets = 200;
      const step = Math.max(1, Math.floor(channel.length / buckets));
      const peaks: number[] = [];
      for (let bucket = 0; bucket < buckets; bucket += 1) {
        let max = 0;
        const start = bucket * step;
        const end = Math.min(channel.length, start + step);
        for (let index = start; index < end; index += 1) {
          const value = Math.abs(channel[index]);
          if (value > max) max = value;
        }
        peaks.push(max);
      }
      setWaveform(peaks);
    } catch {
      setWaveform(null);
    }
  }, [compositionId, projectId]);

  useEffect(() => {
    if (!waveform || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    const barWidth = width / waveform.length;
    waveform.forEach((peak, index) => {
      const barHeight = Math.max(1, peak * height);
      ctx.fillRect(index * barWidth, (height - barHeight) / 2, Math.max(1, barWidth - 1), barHeight);
    });
  }, [waveform]);

  // Rafraîchir le nombre de jobs en attente périodiquement
  useEffect(() => {
    const interval = window.setInterval(refreshQueuedJobs, 2000);
    return () => window.clearInterval(interval);
  }, [refreshQueuedJobs]);

  // Rafraîchir aussi quand le job courant change (pour réinitialiser le compte)
  useEffect(() => {
    void refreshQueuedJobs();
  }, [job, refreshQueuedJobs]);

  const refreshRenders = useCallback(async (): Promise<RenderInfo[]> => {
    return apiRequest<RenderInfo[]>(`/api/projects/${projectId}/compositions/${compositionId}/renders`);
  }, [compositionId, projectId]);

  const refreshQueuedJobs = useCallback(async () => {
    try {
      const allJobs = await apiRequest<JobState[]>(`/api/jobs`);
      const queuedCount = allJobs.filter((j) => j.state === "queued").length;
      setQueuedJobsCount(queuedCount);
    } catch {
      // Si l'endpoint n'est pas disponible, on ignore (comportement dégradé)
    }
  }, []);

  const render = useCallback(async () => {
    if (disabled) return;
    setLoading("render");
    setError(null);
    setQa(null);
    setExportInfo(null);
    setWaveform(null);
    setDurationSeconds(null);
    cancelRequestedRef.current = false;
    try {
      const saved = await ensureSaved();
      if (!saved) {
        setError("Sauvegarde requise avant le rendu");
        return;
      }
      let state: JobState = await apiRequest<JobResponse>(
        `/api/projects/${projectId}/compositions/${compositionId}/render`,
        { method: "POST", body: JSON.stringify(buildRenderBody()) },
      );
      setJob(state);
      while (state.state === "queued" || state.state === "running") {
        if (cancelRequestedRef.current) {
          state = { ...state, state: "cancelled" };
          setJob(state);
          break;
        }
        await sleep(50);
        state = await apiRequest<JobState>(`/api/jobs/${state.id}`);
        setJob(state);
      }
      if (state.state === "failed") {
        setError(state.error ?? "Le rendu a échoué");
      } else if (state.state === "completed") {
        const renders = await refreshRenders();
        if (renders.length > 0) {
          const latest = latestOf(renders);
          setLatestRender(latest);
          void refreshWaveform(latest.revision);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur réseau");
    } finally {
      setLoading(null);
    }
  }, [buildRenderBody, compositionId, disabled, ensureSaved, projectId, refreshRenders, refreshWaveform]);

  const cancelRender = useCallback(async () => {
    if (!job) return;
    cancelRequestedRef.current = true;
    try {
      await apiRequest(`/api/jobs/${job.id}/cancel`, { method: "POST" });
    } catch {
      /* le job peut déjà être terminé côté serveur */
    }
  }, [job]);

  const refreshQa = useCallback(async () => {
    if (disabled) return;
    try {
      const renders = await refreshRenders();
      if (renders.length === 0) {
        setQa(null);
        setLatestRender(null);
        return;
      }
      const latest = latestOf(renders);
      setLatestRender(latest);
      const report = await apiRequest<QaReport>(latest.qa_url);
      setQa(report);
    } catch {
      setQa(null);
    }
  }, [disabled, refreshRenders]);

  const exportBundle = useCallback(async () => {
    if (disabled) return;
    setLoading("export");
    setError(null);
    try {
      const renders = await refreshRenders();
      if (renders.length === 0) {
        setError("Aucun rendu disponible pour l'export");
        return;
      }
      const latest = latestOf(renders);
      setLatestRender(latest);
      const info = await apiRequest<ExportResponse>(
        `/api/projects/${projectId}/compositions/${compositionId}/renders/${latest.revision}/export`,
        { method: "POST" },
      );
      setExportInfo(info);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur réseau");
    } finally {
      setLoading(null);
    }
  }, [compositionId, disabled, projectId, refreshRenders]);

  const promote = useCallback(async () => {
    if (disabled) return;
    setLoading("promote");
    setError(null);
    try {
      const renders = await refreshRenders();
      if (renders.length === 0) {
        setError("Aucun rendu disponible");
        return;
      }
      const latest = latestOf(renders);
      setLatestRender(latest);
      await apiRequest(
        `/api/projects/${projectId}/compositions/${compositionId}/renders/${latest.revision}/promote`,
        { method: "POST" },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur réseau");
    } finally {
      setLoading(null);
    }
  }, [compositionId, disabled, projectId, refreshRenders]);

  const toggleTrack = (trackId: string) => {
    setSelectedTrackIds((current) =>
      current.includes(trackId) ? current.filter((id) => id !== trackId) : [...current, trackId],
    );
  };

  const namedMetrics = qa ? NAMED_METRIC_ORDER.filter((key) => key in qa.metrics) : [];
  const otherMetrics = qa ? Object.keys(qa.metrics).filter((key) => !NAMED_METRIC_ORDER.includes(key)) : [];
  const clipping = qa ? qa.issues.includes("clipping") || qa.issues.includes("true_peak_clipping") : false;

  return (
    <section className="render-analysis" aria-labelledby="render-analysis-title">
      <h3 id="render-analysis-title">Rendu & Export</h3>

      <fieldset className="render-analysis__scope">
        <legend>Portée du rendu</legend>
        <label>
          <input type="radio" name="render-scope" value="full" checked={scope === "full"} onChange={() => setScope("full")} />
          Morceau entier
        </label>
        <label>
          <input type="radio" name="render-scope" value="loop" checked={scope === "loop"} onChange={() => setScope("loop")} />
          Boucle
        </label>
        <label>
          <input type="radio" name="render-scope" value="clips" checked={scope === "clips"} onChange={() => setScope("clips")} />
          Sélection ({selectedClipIds.length} clip{selectedClipIds.length > 1 ? "s" : ""})
        </label>
        <label>
          <input type="radio" name="render-scope" value="tracks" checked={scope === "tracks"} onChange={() => setScope("tracks")} />
          Pistes choisies
        </label>
        {scope === "loop" && (
          <div className="render-analysis__loop-range">
            <label>
              Début (temps)
              <input
                type="number"
                min={0}
                value={loopStartBeat}
                onChange={(event) => setLoopStartBeat(Number(event.target.value))}
              />
            </label>
            <label>
              Fin (temps)
              <input
                type="number"
                min={0}
                value={loopEndBeat}
                onChange={(event) => setLoopEndBeat(Number(event.target.value))}
              />
            </label>
          </div>
        )}
        {scope === "tracks" && (
          <ul className="render-analysis__tracks">
            {tracks.map((track) => (
              <li key={track.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={selectedTrackIds.includes(track.id)}
                    onChange={() => toggleTrack(track.id)}
                  />
                  {track.name}
                </label>
              </li>
            ))}
          </ul>
        )}
      </fieldset>

      <label className="render-analysis__format">
        Format
        <select value={renderFormat} onChange={(event) => onSetRenderFormat(event.target.value as RenderFormat)}>
          <option value="wav_pcm24">WAV PCM 24 bits</option>
          <option value="wav_pcm16">WAV PCM 16 bits</option>
          <option value="wav_float32">WAV flottant 32 bits</option>
        </select>
      </label>

      <div className="render-analysis__actions">
        <button type="button" onClick={() => void render()} disabled={loading === "render" || disabled}>
          {loading === "render" ? "Rendu…" : "Lancer le rendu"}
        </button>
        {cancellable && (
          <button type="button" onClick={() => void cancelRender()}>
            Annuler le rendu
          </button>
        )}
        {job?.state === "failed" && (
          <button type="button" onClick={() => void render()} disabled={loading === "render" || disabled}>
            Réessayer
          </button>
        )}
        <button type="button" onClick={() => void refreshQa()} disabled={disabled}>
          Actualiser le QA
        </button>
        <button type="button" onClick={() => void promote()} disabled={loading === "promote" || disabled}>
          {loading === "promote" ? "Promotion…" : "Promouvoir en master"}
        </button>
        <button type="button" onClick={() => void exportBundle()} disabled={loading === "export" || disabled}>
          {loading === "export" ? "Export…" : "Exporter le bundle"}
        </button>
      </div>

      {job && (
        <p>
          Rendu #<strong>{job.id}</strong> : <em>{job.state}</em> ({job.progress}%)
          {queuedJobsCount > 0 && job.state !== "queued" && (
            <>, <strong>{queuedJobsCount} rendu{queuedJobsCount > 1 ? "s" : ""} en attente</strong>
          )}
          {job.state === "queued" && queuedJobsCount > 1 && (
            <>, <strong>position {queuedJobsCount} dans la file</strong>
          )}
        </p>
      )}
      {error && (
        <p className="error" role="alert">{error}</p>
      )}
      {latestRender && (
        <p className={latestRender.stale ? "render-stale" : "render-up-to-date"}>
          {latestRender.stale ? "Rendu périmé" : "Rendu à jour"} (révision {latestRender.revision})
        </p>
      )}

      <canvas ref={canvasRef} className="render-analysis__waveform" width={600} height={80} role="img" aria-label="Forme d’onde du rendu" />
      {durationSeconds !== null && <p>Durée : {durationSeconds.toFixed(2)} s</p>}

      {qa && (
        <dl className="qa-report">
          <dt>Profil QA</dt>
          <dd>{qa.profile}</dd>
          <dt>Résultat</dt>
          <dd className={qa.passed ? "qa-pass" : "qa-fail"}>{qa.passed ? "Réussi" : "Échec"}</dd>
          {qa.issues.length > 0 && (
            <>
              <dt>Problèmes</dt>
              <dd>
                <ul>
                  {qa.issues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              </dd>
            </>
          )}
          <dt>Métriques</dt>
          <dd>
            <ul>
              {namedMetrics.map((key) => (
                <li key={key}>
                  {METRIC_LABELS[key]}: {Number(qa.metrics[key]).toFixed(3)}
                </li>
              ))}
              <li>Clipping : {clipping ? "Oui" : "Non"}</li>
              {otherMetrics.map((key) => (
                <li key={key}>
                  {key}: {Number(qa.metrics[key]).toFixed(3)}
                </li>
              ))}
            </ul>
          </dd>
        </dl>
      )}
      {exportInfo && (
        <ul className="export-paths">
          <li>WAV : {exportInfo.wav}</li>
          <li>Manifeste : {exportInfo.manifest}</li>
        </ul>
      )}
    </section>
  );
}
