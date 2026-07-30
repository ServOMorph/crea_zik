import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type Patch = {
  id: string;
  name: string;
  kind: string;
  seed: number;
  duration_seconds: number;
  parameters: Record<string, number>;
  tags: string[];
  notes: string;
  favorite: boolean;
};
type Job = {
  id: string;
  state: "queued" | "running" | "completed" | "failed" | "cancelled";
  progress: number;
  error?: { code: string; message: string };
  wav?: string;
};
type TrackedJob = Job & { label: string; projectId: string; patchId: string };
type ArtifactInfo = {
  wav: string;
  sha256: string;
  duration_seconds: number;
  peak: number;
  dc_offset: number;
  is_clipping: boolean;
  sample_rate: number;
  channels: number;
};
type ExportInfo = { wav: string; manifest: string };
type ScoreRender = { mix: string; stems: Record<string, string>; frame_count: number };
type QaReport = { passed: boolean; metrics: Record<string, number>; issues: string[] };
type ProposalOperation = { op: "replace"; patch_id: string; path: string; value: unknown };
type IntentProposal = {
  intent: string;
  rationale: string;
  expected_impacts: string[];
  operations: ProposalOperation[];
};
type IntentRecord = {
  id: string;
  provider: string;
  model: string;
  decision: "accepted" | "rejected";
  proposal: IntentProposal;
};
type AdaptiveGraph = { id: string; name: string };
type AdaptiveDecision = {
  source_state_id: string;
  target_state_id: string;
  scheduled_beats: number;
  condition: string;
};
type Project = {
  id: string;
  name: string;
  patches: Patch[];
  intent_history: IntentRecord[];
  adaptive_graphs: AdaptiveGraph[];
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { headers: { "Content-Type": "application/json" }, ...init });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { detail?: string | { message?: string } } | null;
    throw new Error(
      typeof payload?.detail === "string" ? payload.detail : (payload?.detail?.message ?? "Network error"),
    );
  }
  return response.json() as Promise<T>;
}

function Waveform({ source }: { source: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    const draw = async () => {
      const context = new AudioContext();
      try {
        const buffer = await fetch(source).then((response) => response.arrayBuffer());
        const audio = await context.decodeAudioData(buffer);
        if (cancelled || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const drawing = canvas.getContext("2d");
        if (!drawing) return;
        const samples = audio.getChannelData(0);
        const width = canvas.width;
        const height = canvas.height;
        const step = Math.max(1, Math.ceil(samples.length / width));
        drawing.clearRect(0, 0, width, height);
        drawing.strokeStyle = "#9ee5bd";
        drawing.beginPath();
        for (let column = 0; column < width; column += 1) {
          let minimum = 1;
          let maximum = -1;
          for (let index = column * step; index < Math.min((column + 1) * step, samples.length); index += 1) {
            minimum = Math.min(minimum, samples[index]);
            maximum = Math.max(maximum, samples[index]);
          }
          const top = ((1 + minimum) * height) / 2;
          const bottom = ((1 + maximum) * height) / 2;
          drawing.moveTo(column, top);
          drawing.lineTo(column, bottom);
        }
        drawing.stroke();
      } catch {
        return;
      } finally {
        await context.close();
      }
    };
    void draw();
    return () => {
      cancelled = true;
    };
  }, [source]);

  return <canvas className="waveform" ref={canvasRef} width="720" height="96" aria-label="Waveform preview" />;
}

function operationLabel(operation: ProposalOperation, project: Project) {
  const patch = project.patches.find((item) => item.id === operation.patch_id);
  const target = patch ? patch.name : operation.patch_id;
  const property = operation.path.startsWith("parameters.")
    ? operation.path.replace("parameters.", "")
    : operation.path;
  return `${target} : ${property} → ${JSON.stringify(operation.value)}`;
}

function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [gallery, setGallery] = useState<Patch[]>([]);
  const [name, setName] = useState("");
  const [status, setStatus] = useState("Ready");
  const [audio, setAudio] = useState<string | null>(null);
  const [artifact, setArtifact] = useState<ArtifactInfo | null>(null);
  const [exported, setExported] = useState<ExportInfo | null>(null);
  const [qaReport, setQaReport] = useState<QaReport | null>(null);
  const [jobs, setJobs] = useState<TrackedJob[]>([]);
  const [comparisonA, setComparisonA] = useState("");
  const [comparisonB, setComparisonB] = useState("");
  const [loop, setLoop] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [playing, setPlaying] = useState(false);
  const [galleryProjectId, setGalleryProjectId] = useState<string | null>(null);
  const galleryProjectRef = useRef<Project | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [creatingProject, setCreatingProject] = useState(false);
  const [designerProjectId, setDesignerProjectId] = useState<string | null>(null);
  const [designerName, setDesignerName] = useState("Custom UI click");
  const [designerKind, setDesignerKind] = useState("ui_click");
  const [designerSeed, setDesignerSeed] = useState("42");
  const [designerDuration, setDesignerDuration] = useState("0.12");
  const [designerGain, setDesignerGain] = useState("0.18");
  const [designerPitch, setDesignerPitch] = useState("1700");
  const [designerBrightness, setDesignerBrightness] = useState("0.6");
  const [designerDrive, setDesignerDrive] = useState("0");
  const [designerSpace, setDesignerSpace] = useState("0");
  const [designerNoiseColor, setDesignerNoiseColor] = useState("0");
  const [variantLocks, setVariantLocks] = useState("");
  const [assistantProjectId, setAssistantProjectId] = useState<string | null>(null);
  const [assistantIntent, setAssistantIntent] = useState("");
  const [proposal, setProposal] = useState<IntentProposal | null>(null);
  const [proposalPreview, setProposalPreview] = useState<Project | null>(null);
  const [adaptiveProjectId, setAdaptiveProjectId] = useState<string | null>(null);
  const [adaptiveGraphId, setAdaptiveGraphId] = useState("");
  const [adaptiveIntensity, setAdaptiveIntensity] = useState("0.8");
  const [adaptiveDecisions, setAdaptiveDecisions] = useState<AdaptiveDecision[]>([]);
  const galleryProject = projects.find((project) => project.id === galleryProjectId) ?? projects[0];
  const designerProject = projects.find((project) => project.id === designerProjectId) ?? projects[0];
  const assistantProject = projects.find((project) => project.id === assistantProjectId) ?? projects[0];
  const adaptiveProject = projects.find((project) => project.id === adaptiveProjectId) ?? projects[0];
  const adaptiveGraphs = adaptiveProject?.adaptive_graphs ?? [];
  const pendingJobIds = jobs
    .filter((job) => ["queued", "running"].includes(job.state))
    .map((job) => job.id)
    .join(",");
  const completedJobs = jobs.filter((job) => job.state === "completed" && job.wav);

  const reload = () =>
    request<Project[]>("/api/projects")
      .then((fetched) =>
        setProjects((current) => {
          const fetchedIds = new Set(fetched.map((project) => project.id));
          return [...fetched, ...current.filter((project) => !fetchedIds.has(project.id))];
        }),
      )
      .catch((error) => setStatus(error.message));
  useEffect(() => {
    void reload();
    request<Patch[]>("/api/gallery")
      .then(setGallery)
      .catch((error) => setStatus(error.message));
  }, []);
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [audio, volume]);

  const loadArtifact = useCallback((job: Pick<TrackedJob, "projectId" | "patchId" | "wav">) => {
    if (!job.wav) return;
    setAudio(`/projects/${job.wav}`);
    void request<ArtifactInfo>(`/api/projects/${job.projectId}/patches/${job.patchId}/artifact`)
      .then(setArtifact)
      .catch((error) => setStatus(error instanceof Error ? error.message : "Artifact lookup failed"));
  }, []);

  const updateJob = useCallback(
    (job: Job, tracked: TrackedJob) => {
      setJobs((items) => items.map((item) => (item.id === job.id ? { ...item, ...job } : item)));
      if (job.state === "completed" && job.wav) {
        loadArtifact({ ...tracked, wav: job.wav });
        setStatus("Render complete");
      } else if (job.state === "cancelled") {
        setStatus("Render cancelled");
      } else if (job.state === "failed") {
        setStatus(job.error?.message ?? "Render failed");
      } else {
        setStatus(`Rendering ${job.progress} %...`);
      }
    },
    [loadArtifact],
  );

  function trackJob(job: Job, project: Project, patch: Patch) {
    setJobs((items) => [
      ...items.filter((item) => item.id !== job.id),
      { ...job, label: patch.name, projectId: project.id, patchId: patch.id },
    ]);
  }

  useEffect(() => {
    const pendingJobs = jobs.filter((job) => ["queued", "running"].includes(job.state));
    if (pendingJobs.length === 0) return;
    const streams = pendingJobs.map((tracked) => {
      const events = new EventSource(`/api/jobs/${tracked.id}/events`);
      events.addEventListener("job", (event) =>
        updateJob(JSON.parse((event as MessageEvent<string>).data) as Job, tracked),
      );
      events.onerror = () => events.close();
      return events;
    });
    return () => streams.forEach((events) => events.close());
  }, [jobs, pendingJobIds, updateJob]);

  async function createProject(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    try {
      setCreatingProject(true);
      const project = await request<Project>("/api/projects", { method: "POST", body: JSON.stringify({ name }) });
      galleryProjectRef.current = project;
      setProjects((items) => [...items, project]);
      setGalleryProjectId(project.id);
      setDesignerProjectId(project.id);
      setAssistantProjectId(project.id);
      setAdaptiveProjectId(project.id);
      setName("");
      setStatus("Project created");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Project creation failed");
    } finally {
      setCreatingProject(false);
    }
  }

  async function createAndRender(project: Project) {
    try {
      setStatus("Creating UI click...");
      const updated = await request<Project>(`/api/projects/${project.id}/patches`, {
        method: "POST",
        body: JSON.stringify({ name: "UI click", kind: "ui_click", seed: 42, duration_seconds: 0.12 }),
      });
      setProjects((items) => items.map((item) => (item.id === updated.id ? updated : item)));
      await renderPatch(updated, updated.patches.at(-1)!);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Render failed");
    }
  }

  async function createCancellationDemo(project: Project) {
    try {
      setStatus("Creating two-minute cancellation demo...");
      const updated = await request<Project>(`/api/projects/${project.id}/patches`, {
        method: "POST",
        body: JSON.stringify({
          name: "Cancellation demo",
          kind: "continuous_engine",
          seed: 4200,
          duration_seconds: 120,
          gain: 0.08,
        }),
      });
      setProjects((items) => items.map((item) => (item.id === updated.id ? updated : item)));
      await renderPatch(updated, updated.patches.at(-1)!);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Render failed");
    }
  }

  async function createAndRenderTheme(project: Project) {
    const patch = project.patches[0];
    if (!patch) {
      setStatus("Create a sound patch before creating a theme");
      return;
    }
    try {
      setStatus("Creating a four-beat theme...");
      const withInstrument = await request<Project>(`/api/projects/${project.id}/instruments`, {
        method: "POST",
        body: JSON.stringify({ name: "Theme lead", patch_id: patch.id, seed: 300, polyphony: 4 }),
      });
      const instrument = (withInstrument as Project & { instruments: { id: string }[] }).instruments.at(-1);
      if (!instrument) throw new Error("Instrument creation failed");
      const withScore = await request<Project>(`/api/projects/${project.id}/scores`, {
        method: "POST",
        body: JSON.stringify({
          name: "Four-beat theme",
          seed: 301,
          tempo_bpm: 120,
          events: [
            { instrument_id: instrument.id, start_beats: 0, duration_beats: 1, midi_note: 60, velocity: 0.8 },
            { instrument_id: instrument.id, start_beats: 1, duration_beats: 1, midi_note: 64, velocity: 0.8 },
            { instrument_id: instrument.id, start_beats: 2, duration_beats: 1, midi_note: 67, velocity: 0.8 },
            { instrument_id: instrument.id, start_beats: 3, duration_beats: 1, midi_note: 72, velocity: 0.8 },
          ],
        }),
      });
      const score = (withScore as Project & { scores: { id: string }[] }).scores.at(-1);
      if (!score) throw new Error("Score creation failed");
      const rendered = await request<ScoreRender>(`/api/projects/${project.id}/scores/${score.id}/render`, {
        method: "POST",
      });
      setProjects((items) => items.map((item) => (item.id === withScore.id ? withScore : item)));
      setArtifact(null);
      setAudio(`/projects/${rendered.mix}`);
      setStatus(`Theme rendered with ${Object.keys(rendered.stems).length} stem`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Theme render failed");
    }
  }

  async function createDesignerPatch(event: FormEvent) {
    event.preventDefault();
    if (!designerProject || !designerName.trim()) return;
    try {
      const updated = await request<Project>(`/api/projects/${designerProject.id}/patches`, {
        method: "POST",
        body: JSON.stringify({
          name: designerName,
          kind: designerKind,
          seed: Number(designerSeed),
          duration_seconds: Number(designerDuration),
          gain: Number(designerGain),
          parameters: {
            pitch_hz: Number(designerPitch),
            brightness: Number(designerBrightness),
            drive: Number(designerDrive),
            space: Number(designerSpace),
            noise_color: Number(designerNoiseColor),
          },
        }),
      });
      setProjects((items) => items.map((item) => (item.id === updated.id ? updated : item)));
      await renderPatch(updated, updated.patches.at(-1)!);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Sound Designer render failed");
    }
  }

  async function renderPatch(project: Project, patch: Patch) {
    setStatus(`Starting ${patch.name} render...`);
    trackJob(
      await request<Job>(`/api/projects/${project.id}/patches/${patch.id}/render`, { method: "POST" }),
      project,
      patch,
    );
  }

  async function cancelRender(job: TrackedJob) {
    if (!["queued", "running"].includes(job.state)) return;
    try {
      updateJob(await request<Job>(`/api/jobs/${job.id}/cancel`, { method: "POST" }), job);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to cancel render");
    }
  }

  async function copyExample(project: Project, example: Patch) {
    try {
      const destination = galleryProjectRef.current ?? project;
      const updated = await request<Project>(`/api/projects/${destination.id}/gallery/${example.id}`, {
        method: "POST",
      });
      setProjects((items) => items.map((item) => (item.id === updated.id ? updated : item)));
      await renderPatch(updated, updated.patches.at(-1)!);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to copy example");
    }
  }

  async function createVariants(project: Project) {
    const source = project.patches[0];
    if (!source) return;
    try {
      const updated = await request<Project>(`/api/projects/${project.id}/patches/${source.id}/variants`, {
        method: "POST",
        body: JSON.stringify({
          count: 10,
          locked_parameters: variantLocks
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
        }),
      });
      setProjects((items) => items.map((item) => (item.id === updated.id ? updated : item)));
      setStatus("Ten deterministic variants created");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to create variants");
    }
  }

  async function exportRenderedPatch(job: TrackedJob) {
    try {
      const result = await request<ExportInfo>(`/api/projects/${job.projectId}/patches/${job.patchId}/export`, {
        method: "POST",
      });
      setExported(result);
      setStatus("Export ready");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Export failed");
    }
  }

  async function analyzeRenderedPatch(job: TrackedJob) {
    try {
      const report = await request<QaReport>(`/api/projects/${job.projectId}/patches/${job.patchId}/analyze`, {
        method: "POST",
        body: JSON.stringify({ profile: "sfx", loop }),
      });
      setQaReport(report);
      setStatus(report.passed ? "QA passed" : `QA blocked: ${report.issues.join(", ")}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "QA failed");
    }
  }

  async function savePatchMetadata(
    project: Project,
    patch: Patch,
    update: Partial<Pick<Patch, "favorite" | "tags" | "notes">>,
  ) {
    try {
      const updated = await request<Project>(`/api/projects/${project.id}/patches/${patch.id}`, {
        method: "PATCH",
        body: JSON.stringify(update),
      });
      setProjects((items) => items.map((item) => (item.id === updated.id ? updated : item)));
      setStatus("Patch metadata saved");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to save patch metadata");
    }
  }

  async function generateIntentProposal(event: FormEvent) {
    event.preventDefault();
    if (!assistantProject || !assistantIntent.trim()) return;
    try {
      setStatus("Generating local proposal...");
      const generated = await request<IntentProposal>(`/api/projects/${assistantProject.id}/proposals/generate`, {
        method: "POST",
        body: JSON.stringify({ intent: assistantIntent }),
      });
      setProposal(generated);
      setProposalPreview(null);
      setStatus("Proposal ready for preview");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Proposal generation failed");
    }
  }

  async function previewIntentProposal() {
    if (!assistantProject || !proposal) return;
    try {
      const preview = await request<Project>(`/api/projects/${assistantProject.id}/proposals/preview`, {
        method: "POST",
        body: JSON.stringify(proposal),
      });
      setProposalPreview(preview);
      setStatus("Preview ready; no change saved");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Proposal preview failed");
    }
  }

  async function acceptIntentProposal() {
    if (!assistantProject || !proposal || !proposalPreview) return;
    try {
      const updated = await request<Project>(`/api/projects/${assistantProject.id}/proposals/apply`, {
        method: "POST",
        body: JSON.stringify({ accepted: true, proposal }),
      });
      setProjects((items) => items.map((item) => (item.id === updated.id ? updated : item)));
      setProposal(null);
      setProposalPreview(null);
      setStatus("Proposal accepted and saved");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Proposal application failed");
    }
  }

  async function rejectIntentProposal() {
    if (!assistantProject || !proposal) return;
    try {
      const updated = await request<Project>(`/api/projects/${assistantProject.id}/proposals/reject`, {
        method: "POST",
        body: JSON.stringify(proposal),
      });
      setProjects((items) => items.map((item) => (item.id === updated.id ? updated : item)));
      setProposal(null);
      setProposalPreview(null);
      setStatus("Proposal rejected; no change saved");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Proposal rejection failed");
    }
  }

  async function createAdaptiveDemo() {
    if (!adaptiveProject) return;
    const explorationId = crypto.randomUUID();
    const tensionId = crypto.randomUUID();
    try {
      const updated = await request<Project>(`/api/projects/${adaptiveProject.id}/adaptive-graphs`, {
        method: "POST",
        body: JSON.stringify({
          name: "Exploration tension",
          seed: 700,
          initial_state_id: explorationId,
          states: [
            { id: explorationId, name: "Exploration" },
            { id: tensionId, name: "Tension" },
          ],
          transitions: [
            {
              source_state_id: explorationId,
              target_state_id: tensionId,
              condition: "intensity >= 0.5",
              quantization: "bar",
            },
            {
              source_state_id: tensionId,
              target_state_id: explorationId,
              condition: "intensity < 0.5",
              quantization: "bar",
            },
          ],
        }),
      });
      setProjects((items) => items.map((item) => (item.id === updated.id ? updated : item)));
      const graph = updated.adaptive_graphs.at(-1);
      if (graph) setAdaptiveGraphId(graph.id);
      setAdaptiveDecisions([]);
      setStatus("Adaptive graph created");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Adaptive graph creation failed");
    }
  }

  async function simulateAdaptiveGraph() {
    if (!adaptiveProject || !adaptiveGraphId) return;
    try {
      const decisions = await request<AdaptiveDecision[]>(
        `/api/projects/${adaptiveProject.id}/adaptive-graphs/${adaptiveGraphId}/simulate`,
        {
          method: "POST",
          body: JSON.stringify({ events: [{ at_beats: 1.1, values: { intensity: Number(adaptiveIntensity) } }] }),
        },
      );
      setAdaptiveDecisions(decisions);
      setStatus(`${decisions.length} adaptive transition${decisions.length === 1 ? "" : "s"} simulated`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Adaptive simulation failed");
    }
  }

  function stopPlayback() {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setPlaying(false);
  }

  return (
    <main>
      <header>
        <p className="eyebrow">Offline procedural studio</p>
        <h1>Crea Zik</h1>
        <output>{status}</output>
      </header>
      <section className="create">
        <h2>New project</h2>
        <form onSubmit={createProject}>
          <label>
            Name <input value={name} onChange={(event) => setName(event.target.value)} placeholder="My first sound" />
          </label>
          <button>Create</button>
        </form>
      </section>
      <section>
        <h2>Projects</h2>
        {projects.length === 0 ? (
          <p>No projects yet. Create one to get started.</p>
        ) : (
          <div className="grid">
            {projects.map((project) => (
              <article key={project.id}>
                <h3>{project.name}</h3>
                <p>
                  {project.patches.length} patch{project.patches.length > 1 ? "es" : ""}
                </p>
                <button onClick={() => void createAndRender(project)}>Create and render a click</button>
                <button className="secondary" onClick={() => void createCancellationDemo(project)}>
                  Render 2-minute cancellation demo
                </button>
                <button className="secondary" onClick={() => void createAndRenderTheme(project)}>
                  Create and render a 4-beat theme
                </button>
                {project.patches.length > 0 && (
                  <div className="patches">
                    {project.patches.map((patch) => (
                      <div key={patch.id}>
                        <span>{patch.name}</span>
                        <div>
                          <button className="secondary inline" onClick={() => void renderPatch(project, patch)}>
                            Render
                          </button>
                          <button
                            className="secondary inline"
                            aria-label={`Favorite ${patch.name}`}
                            onClick={() => void savePatchMetadata(project, patch, { favorite: !patch.favorite })}
                          >
                            {patch.favorite ? "★" : "☆"}
                          </button>
                        </div>
                        <label>
                          Tags{" "}
                          <input
                            defaultValue={patch.tags.join(", ")}
                            onBlur={(event) =>
                              void savePatchMetadata(project, patch, {
                                tags: event.target.value
                                  .split(",")
                                  .map((value) => value.trim())
                                  .filter(Boolean),
                              })
                            }
                          />
                        </label>
                        <label>
                          Notes{" "}
                          <input
                            defaultValue={patch.notes}
                            onBlur={(event) => void savePatchMetadata(project, patch, { notes: event.target.value })}
                          />
                        </label>
                      </div>
                    ))}
                  </div>
                )}
                <button className="secondary" onClick={() => void createVariants(project)}>
                  Create 10 variants
                </button>
                <label>
                  Locked macros{" "}
                  <input
                    value={variantLocks}
                    onChange={(event) => setVariantLocks(event.target.value)}
                    placeholder="pitch_hz, brightness"
                  />
                </label>
              </article>
            ))}
          </div>
        )}
      </section>
      <section>
        <h2>Assistant de modification</h2>
        {assistantProject ? (
          <form className="assistant" onSubmit={generateIntentProposal}>
            <label>
              Projet{" "}
              <select value={assistantProject.id} onChange={(event) => setAssistantProjectId(event.target.value)}>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Intention{" "}
              <input
                value={assistantIntent}
                onChange={(event) => setAssistantIntent(event.target.value)}
                placeholder="Augmente la brillance du clic"
              />
            </label>
            <button>Proposer</button>
          </form>
        ) : (
          <p>Créez un projet avant de demander une modification.</p>
        )}
        {proposal && assistantProject && (
          <article className="proposal">
            <h3>Proposition</h3>
            <p>{proposal.rationale || "Modification limitée aux paramètres autorisés."}</p>
            <ul className="semantic-diff">
              {proposal.operations.map((operation, index) => (
                <li key={`${operation.patch_id}-${operation.path}-${index}`}>
                  {operationLabel(operation, assistantProject)}
                </li>
              ))}
            </ul>
            {proposal.expected_impacts.length > 0 && (
              <ul>
                {proposal.expected_impacts.map((impact) => (
                  <li key={impact}>{impact}</li>
                ))}
              </ul>
            )}
            {proposalPreview && (
              <p className="preview">Aperçu calculé : aucune modification n’est encore enregistrée.</p>
            )}
            <button className="secondary inline" onClick={() => void previewIntentProposal()} type="button">
              Aperçu
            </button>
            <button
              className="secondary inline"
              onClick={() => {
                setProposal(null);
                setProposalPreview(null);
              }}
              type="button"
            >
              Modifier l’intention
            </button>
            <button className="secondary inline" onClick={() => void rejectIntentProposal()} type="button">
              Rejeter
            </button>
            <button disabled={!proposalPreview} onClick={() => void acceptIntentProposal()} type="button">
              Accepter et enregistrer
            </button>
          </article>
        )}
        {assistantProject && assistantProject.intent_history.length > 0 && (
          <article className="proposal-history">
            <h3>Historique des décisions</h3>
            <ul>
              {assistantProject.intent_history.map((record) => (
                <li key={record.id}>
                  {record.decision} · {record.model} · {record.proposal.intent}
                </li>
              ))}
            </ul>
          </article>
        )}
      </section>
      <section>
        <h2>Adaptive Lab</h2>
        {adaptiveProject ? (
          <div className="adaptive">
            <label>
              Projet{" "}
              <select value={adaptiveProject.id} onChange={(event) => setAdaptiveProjectId(event.target.value)}>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
            <button onClick={() => void createAdaptiveDemo()} type="button">
              Créer le graphe exploration/tension
            </button>
            {adaptiveGraphs.length > 0 && (
              <>
                <label>
                  Graphe{" "}
                  <select value={adaptiveGraphId} onChange={(event) => setAdaptiveGraphId(event.target.value)}>
                    <option value="">Choisir un graphe</option>
                    {adaptiveGraphs.map((graph) => (
                      <option key={graph.id} value={graph.id}>
                        {graph.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Intensité{" "}
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.1"
                    value={adaptiveIntensity}
                    onChange={(event) => setAdaptiveIntensity(event.target.value)}
                  />
                </label>
                <button disabled={!adaptiveGraphId} onClick={() => void simulateAdaptiveGraph()} type="button">
                  Simuler à la mesure
                </button>
              </>
            )}
          </div>
        ) : (
          <p>Créez un projet avant de simuler une musique adaptative.</p>
        )}
        {adaptiveDecisions.length > 0 && (
          <ul className="adaptive-decisions">
            {adaptiveDecisions.map((decision) => (
              <li key={`${decision.source_state_id}-${decision.target_state_id}-${decision.scheduled_beats}`}>
                {decision.condition} : transition planifiée à {decision.scheduled_beats} beats
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h2>Sound Designer</h2>
        {designerProject ? (
          <form className="designer" onSubmit={createDesignerPatch}>
            <label>
              Project{" "}
              <select value={designerProject.id} onChange={(event) => setDesignerProjectId(event.target.value)}>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Patch name <input value={designerName} onChange={(event) => setDesignerName(event.target.value)} />
            </label>
            <label>
              Type{" "}
              <select value={designerKind} onChange={(event) => setDesignerKind(event.target.value)}>
                <option value="ui_click">UI click</option>
                <option value="modal_impact">Modal impact</option>
                <option value="continuous_engine">Continuous engine</option>
                <option value="whoosh">Whoosh</option>
                <option value="mechanical_ambience">Mechanical ambience</option>
                <option value="drone">Drone</option>
              </select>
            </label>
            <label>
              Seed{" "}
              <input
                type="number"
                min="0"
                max="9223372036854775807"
                value={designerSeed}
                onChange={(event) => setDesignerSeed(event.target.value)}
              />
            </label>
            <label>
              Duration (s){" "}
              <input
                type="number"
                min="0.01"
                max="120"
                step="0.01"
                value={designerDuration}
                onChange={(event) => setDesignerDuration(event.target.value)}
              />
            </label>
            <label>
              Gain{" "}
              <input
                type="number"
                min="0.01"
                max="1"
                step="0.01"
                value={designerGain}
                onChange={(event) => setDesignerGain(event.target.value)}
              />
            </label>
            <label>
              Pitch (Hz){" "}
              <input
                type="number"
                min="20"
                max="12000"
                value={designerPitch}
                onChange={(event) => setDesignerPitch(event.target.value)}
              />
            </label>
            <label>
              Brightness{" "}
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={designerBrightness}
                onChange={(event) => setDesignerBrightness(event.target.value)}
              />
            </label>
            <label>
              Drive{" "}
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={designerDrive}
                onChange={(event) => setDesignerDrive(event.target.value)}
              />
            </label>
            <label>
              Space{" "}
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={designerSpace}
                onChange={(event) => setDesignerSpace(event.target.value)}
              />
            </label>
            <label>
              Noise{" "}
              <select value={designerNoiseColor} onChange={(event) => setDesignerNoiseColor(event.target.value)}>
                <option value="0">White</option>
                <option value="1">Pink</option>
                <option value="2">Brown</option>
              </select>
            </label>
            <button>Create and render</button>
          </form>
        ) : (
          <p>Create a project to use the Sound Designer.</p>
        )}
      </section>
      <section>
        <h2>Example gallery</h2>
        <p>Each example is copied into the selected project, then rendered for listening.</p>
        {galleryProject && (
          <label>
            Destination project{" "}
            <select
              value={galleryProject.id}
              disabled={creatingProject}
              onChange={(event) => {
                const destination = projects.find((project) => project.id === event.target.value) ?? null;
                galleryProjectRef.current = destination;
                setGalleryProjectId(event.target.value);
              }}
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="grid">
          {gallery.map((example) => (
            <article key={example.id}>
              <h3>{example.name}</h3>
              <p>
                {example.kind} / {example.duration_seconds}s
              </p>
              {galleryProject && (
                <button disabled={creatingProject} onClick={() => void copyExample(galleryProject, example)}>
                  Open, render and listen
                </button>
              )}
            </article>
          ))}
        </div>
      </section>
      <section>
        <h2>Render jobs</h2>
        {jobs.length === 0 ? (
          <p>No render jobs yet.</p>
        ) : (
          <div className="jobs">
            {jobs.map((job) => (
              <article key={job.id}>
                <h3>{job.label}</h3>
                <p>
                  {job.state} · {job.progress} %
                </p>
                {["queued", "running"].includes(job.state) && (
                  <>
                    <progress value={job.progress} max="100" />
                    <button className="secondary" onClick={() => void cancelRender(job)}>
                      Cancel render
                    </button>
                  </>
                )}
                {job.state === "completed" && (
                  <div>
                    <button className="secondary inline" onClick={() => loadArtifact(job)}>
                      Listen
                    </button>
                    <button className="secondary inline" onClick={() => void exportRenderedPatch(job)}>
                      Export WAV
                    </button>
                    <button className="secondary inline" onClick={() => void analyzeRenderedPatch(job)}>
                      Analyze
                    </button>
                  </div>
                )}
                {job.error && <p className="error">{job.error.message}</p>}
              </article>
            ))}
          </div>
        )}
      </section>
      {completedJobs.length >= 2 && (
        <section>
          <h2>A/B comparison</h2>
          <div className="compare">
            <label>
              A{" "}
              <select value={comparisonA} onChange={(event) => setComparisonA(event.target.value)}>
                <option value="">Choose render</option>
                {completedJobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              B{" "}
              <select value={comparisonB} onChange={(event) => setComparisonB(event.target.value)}>
                <option value="">Choose render</option>
                {completedJobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              disabled={!comparisonA}
              onClick={() => {
                const job = completedJobs.find((item) => item.id === comparisonA);
                if (job) loadArtifact(job);
              }}
            >
              Listen A
            </button>
            <button
              disabled={!comparisonB}
              onClick={() => {
                const job = completedJobs.find((item) => item.id === comparisonB);
                if (job) loadArtifact(job);
              }}
            >
              Listen B
            </button>
          </div>
        </section>
      )}
      {audio && (
        <section className="player">
          <h2>Latest render</h2>
          <Waveform source={audio} />
          <audio
            ref={audioRef}
            controls
            src={audio}
            loop={loop}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
          />
          <div className="transport">
            <button onClick={() => void audioRef.current?.play()}>{playing ? "Playing" : "Play"}</button>
            <button className="secondary inline" onClick={() => audioRef.current?.pause()}>
              Pause
            </button>
            <button className="secondary inline" onClick={stopPlayback}>
              Stop
            </button>
            <label>
              Volume{" "}
              <input
                aria-label="Volume"
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={(event) => setVolume(Number(event.target.value))}
              />
            </label>
            <label>
              <input
                aria-label="Loop"
                type="checkbox"
                checked={loop}
                onChange={(event) => setLoop(event.target.checked)}
              />{" "}
              Loop
            </label>
          </div>
          {artifact && (
            <dl className="metrics">
              <div>
                <dt>Duration</dt>
                <dd>{artifact.duration_seconds.toFixed(3)} s</dd>
              </div>
              <div>
                <dt>Peak</dt>
                <dd className={artifact.is_clipping ? "error" : ""}>
                  {artifact.peak.toFixed(3)}
                  {artifact.is_clipping ? " clipping" : ""}
                </dd>
              </div>
              <div>
                <dt>DC</dt>
                <dd className={Math.abs(artifact.dc_offset) >= 0.02 ? "error" : ""}>{artifact.dc_offset.toFixed(4)}</dd>
              </div>
              <div>
                <dt>Hash</dt>
                <dd>
                  <code>{artifact.sha256}</code>
                </dd>
              </div>
            </dl>
          )}
          {qaReport && (
            <>
              <p className={qaReport.passed ? "" : "error"}>
                QA {qaReport.passed ? "passed" : `blocked: ${qaReport.issues.join(", ")}`}
              </p>
              <dl className="metrics qa-metrics">
                {Object.entries(qaReport.metrics).map(([name, value]) => (
                  <div key={name}>
                    <dt>{name.replaceAll("_", " ")}</dt>
                    <dd>{value.toFixed(5)}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}
          <p>
            <a href={audio} download>
              Download WAV
            </a>
          </p>
        </section>
      )}
      {exported && (
        <section className="export">
          <h2>Export</h2>
          <a href={`/projects/${exported.wav}`} download>
            Download exported WAV
          </a>
          <a href={`/projects/${exported.manifest}`} download>
            Download provenance manifest
          </a>
        </section>
      )}
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
