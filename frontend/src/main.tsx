import { FormEvent, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type Patch = { id: string; name: string; kind: string; seed: number; duration_seconds: number };
type Project = { id: string; name: string; patches: Patch[] };
type Job = { id: string; state: "queued" | "running" | "completed" | "failed" | "cancelled"; progress: number; error?: { code: string; message: string }; wav?: string };
type TrackedJob = Job & { label: string };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { headers: { "Content-Type": "application/json" }, ...init });
  if (!response.ok) throw new Error((await response.json()).detail ?? "Network error");
  return response.json() as Promise<T>;
}

function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [gallery, setGallery] = useState<Patch[]>([]);
  const [name, setName] = useState("");
  const [status, setStatus] = useState("Ready");
  const [audio, setAudio] = useState<string | null>(null);
  const [jobs, setJobs] = useState<TrackedJob[]>([]);
  const [galleryProjectId, setGalleryProjectId] = useState<string | null>(null);
  const galleryProjectRef = useRef<Project | null>(null);
  const [creatingProject, setCreatingProject] = useState(false);
  const [designerProjectId, setDesignerProjectId] = useState<string | null>(null);
  const [designerName, setDesignerName] = useState("Custom UI click");
  const [designerKind, setDesignerKind] = useState("ui_click");
  const [designerSeed, setDesignerSeed] = useState("42");
  const [designerDuration, setDesignerDuration] = useState("0.12");
  const [designerGain, setDesignerGain] = useState("0.18");
  const galleryProject = projects.find(project => project.id === galleryProjectId) ?? projects[0];
  const designerProject = projects.find(project => project.id === designerProjectId) ?? projects[0];
  const pendingJobIds = jobs.filter(job => ["queued", "running"].includes(job.state)).map(job => job.id).join(",");

  const reload = () => request<Project[]>("/api/projects").then(setProjects).catch(error => setStatus(error.message));
  useEffect(() => { void reload(); request<Patch[]>("/api/gallery").then(setGallery).catch(error => setStatus(error.message)); }, []);

  useEffect(() => {
    const pendingJobs = jobs.filter(job => ["queued", "running"].includes(job.state));
    if (pendingJobs.length === 0) return;
    const streams = pendingJobs.map(tracked => {
      const events = new EventSource(`/api/jobs/${tracked.id}/events`);
      events.addEventListener("job", event => updateJob(JSON.parse((event as MessageEvent<string>).data) as Job));
      events.onerror = () => events.close();
      return events;
    });
    return () => streams.forEach(events => events.close());
  }, [pendingJobIds]);

  function updateJob(job: Job) {
    setJobs(items => items.map(item => item.id === job.id ? { ...item, ...job } : item));
    if (job.state === "completed" && job.wav) {
      setAudio(`/projects/${job.wav}`); setStatus("Render complete");
    } else if (job.state === "cancelled") {
      setStatus("Render cancelled");
    } else if (job.state === "failed") {
      setStatus(job.error?.message ?? "Render failed");
    } else {
      setStatus(`Rendering ${job.progress} %...`);
    }
  }

  function trackJob(job: Job, label: string) {
    setJobs(items => [...items.filter(item => item.id !== job.id), { ...job, label }]);
  }

  async function createProject(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    try {
      setCreatingProject(true);
      const project = await request<Project>("/api/projects", { method: "POST", body: JSON.stringify({ name }) });
      galleryProjectRef.current = project;
      setProjects(items => [...items, project]); setGalleryProjectId(project.id); setDesignerProjectId(project.id); setName(""); setStatus("Project created");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Project creation failed");
    } finally {
      setCreatingProject(false);
    }
  }

  async function createAndRender(project: Project) {
    try {
      setStatus("Creating UI click...");
      const updated = await request<Project>(`/api/projects/${project.id}/patches`, { method: "POST", body: JSON.stringify({ name: "UI click", kind: "ui_click", seed: 42, duration_seconds: .12 }) });
      setProjects(items => items.map(item => item.id === updated.id ? updated : item));
      const patch = updated.patches.at(-1)!;
      await renderPatch(updated, patch);
    } catch (error) { setStatus(error instanceof Error ? error.message : "Render failed"); }
  }

  async function createCancellationDemo(project: Project) {
    try {
      setStatus("Creating two-minute cancellation demo...");
      const updated = await request<Project>(`/api/projects/${project.id}/patches`, { method: "POST", body: JSON.stringify({ name: "Cancellation demo", kind: "continuous_engine", seed: 4200, duration_seconds: 120, gain: .08 }) });
      setProjects(items => items.map(item => item.id === updated.id ? updated : item));
      await renderPatch(updated, updated.patches.at(-1)!);
    } catch (error) { setStatus(error instanceof Error ? error.message : "Render failed"); }
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
          seed: designerSeed,
          duration_seconds: Number(designerDuration),
          gain: Number(designerGain),
        }),
      });
      setProjects(items => items.map(item => item.id === updated.id ? updated : item));
      await renderPatch(updated, updated.patches.at(-1)!);
    } catch (error) { setStatus(error instanceof Error ? error.message : "Sound Designer render failed"); }
  }

  async function renderPatch(project: Project, patch: Patch) {
    setStatus(`Starting ${patch.name} render...`);
    trackJob(await request<Job>(`/api/projects/${project.id}/patches/${patch.id}/render`, { method: "POST" }), patch.name);
  }

  async function cancelRender(job: TrackedJob) {
    if (!["queued", "running"].includes(job.state)) return;
    try {
      updateJob(await request<Job>(`/api/jobs/${job.id}/cancel`, { method: "POST" }));
    } catch (error) { setStatus(error instanceof Error ? error.message : "Unable to cancel render"); }
  }

  async function copyExample(project: Project, example: Patch) {
    try {
      const destination = galleryProjectRef.current ?? project;
      const updated = await request<Project>(`/api/projects/${destination.id}/gallery/${example.id}`, { method: "POST" });
      setProjects(items => items.map(item => item.id === updated.id ? updated : item));
      await renderPatch(updated, updated.patches.at(-1)!);
    } catch (error) { setStatus(error instanceof Error ? error.message : "Unable to copy example"); }
  }

  async function createVariants(project: Project) {
    const source = project.patches[0];
    if (!source) return;
    try {
      const updated = await request<Project>(`/api/projects/${project.id}/patches/${source.id}/variants?count=10`, { method: "POST" });
      setProjects(items => items.map(item => item.id === updated.id ? updated : item));
      setStatus("Ten deterministic variants created");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Unable to create variants"); }
  }

  return <main>
    <header><p className="eyebrow">Offline procedural studio</p><h1>Crea Zik</h1><output>{status}</output></header>
    <section className="create"><h2>New project</h2><form onSubmit={createProject}><label>Name <input value={name} onChange={event => setName(event.target.value)} placeholder="My first sound" /></label><button>Create</button></form></section>
    <section><h2>Projects</h2>{projects.length === 0 ? <p>No projects yet. Create one to get started.</p> : <div className="grid">{projects.map(project => <article key={project.id}><h3>{project.name}</h3><p>{project.patches.length} patch{project.patches.length > 1 ? "es" : ""}</p><button onClick={() => createAndRender(project)}>Create and render a click</button><button className="secondary" onClick={() => createCancellationDemo(project)}>Render 2-minute cancellation demo</button>{project.patches.length > 0 && <div className="patches">{project.patches.map(patch => <div key={patch.id}><span>{patch.name}</span><button className="secondary" onClick={() => void renderPatch(project, patch)}>Render</button></div>)}</div>}<button className="secondary" onClick={() => createVariants(project)}>Create 10 variants</button></article>)}</div>}</section>
    <section><h2>Sound Designer</h2>{designerProject ? <form className="designer" onSubmit={createDesignerPatch}><label>Project <select value={designerProject.id} onChange={event => setDesignerProjectId(event.target.value)}>{projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label><label>Patch name <input value={designerName} onChange={event => setDesignerName(event.target.value)} /></label><label>Type <select value={designerKind} onChange={event => setDesignerKind(event.target.value)}><option value="ui_click">UI click</option><option value="modal_impact">Modal impact</option><option value="continuous_engine">Continuous engine</option></select></label><label>Seed <input type="number" min="0" max="9223372036854775807" value={designerSeed} onChange={event => setDesignerSeed(event.target.value)} /></label><label>Duration (s) <input type="number" min="0.01" max="120" step="0.01" value={designerDuration} onChange={event => setDesignerDuration(event.target.value)} /></label><label>Gain <input type="number" min="0.01" max="1" step="0.01" value={designerGain} onChange={event => setDesignerGain(event.target.value)} /></label><button>Create and render</button></form> : <p>Create a project to use the Sound Designer.</p>}</section>
    <section><h2>Example gallery</h2><p>Each example is copied into the selected project, then rendered for listening.</p>{galleryProject && <label>Destination project <select value={galleryProject.id} disabled={creatingProject} onChange={event => { const destination = projects.find(project => project.id === event.target.value) ?? null; galleryProjectRef.current = destination; setGalleryProjectId(event.target.value); }}>{projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>}<div className="grid">{gallery.map(example => <article key={example.id}><h3>{example.name}</h3><p>{example.kind} / {example.duration_seconds}s</p>{galleryProject && <button disabled={creatingProject} onClick={() => void copyExample(galleryProject, example)}>Open, render and listen</button>}</article>)}</div></section>
    <section><h2>Render jobs</h2>{jobs.length === 0 ? <p>No render jobs yet.</p> : <div className="jobs">{jobs.map(job => <article key={job.id}><h3>{job.label}</h3><p>{job.state} · {job.progress} %</p>{["queued", "running"].includes(job.state) && <><progress value={job.progress} max="100" /><button className="secondary" onClick={() => void cancelRender(job)}>Cancel render</button></>}{job.error && <p className="error">{job.error.message}</p>}</article>)}</div>}</section>
    {audio && <section className="player"><h2>Latest render</h2><audio controls src={audio} /><p><a href={audio} download>Download WAV</a></p></section>}
  </main>;
}

createRoot(document.getElementById("root")!).render(<App />);
