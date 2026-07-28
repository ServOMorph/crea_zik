import { FormEvent, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type Patch = { id: string; name: string; kind: string; seed: number; duration_seconds: number };
type Project = { id: string; name: string; patches: Patch[] };
type Job = { id: string; state: "queued" | "running" | "completed" | "failed" | "cancelled"; progress: number; error?: string; wav?: string };

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
  const [activeJob, setActiveJob] = useState<Job | null>(null);

  const reload = () => request<Project[]>("/api/projects").then(setProjects).catch(error => setStatus(error.message));
  useEffect(() => { void reload(); request<Patch[]>("/api/gallery").then(setGallery).catch(error => setStatus(error.message)); }, []);

  useEffect(() => {
    if (!activeJob || !["queued", "running"].includes(activeJob.state)) return;
    const events = new EventSource(`/api/jobs/${activeJob.id}/events`);
    const update = (event: Event) => {
      const job = JSON.parse((event as MessageEvent<string>).data) as Job;
      setActiveJob(job);
      if (job.state === "completed" && job.wav) {
        setAudio(`/projects/${job.wav}`); setStatus("Render complete");
      } else if (job.state === "cancelled") {
        setStatus("Render cancelled");
      } else if (job.state === "failed") {
        setStatus(job.error ?? "Render failed");
      } else {
        setStatus(`Rendering ${job.progress} %...`);
      }
    };
    events.addEventListener("job", update);
    events.onerror = () => events.close();
    return () => events.close();
  }, [activeJob?.id]);

  async function createProject(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    const project = await request<Project>("/api/projects", { method: "POST", body: JSON.stringify({ name }) });
    setProjects(items => [...items, project]); setName(""); setStatus("Project created");
  }

  async function createAndRender(project: Project) {
    try {
      setStatus("Creating UI click...");
      const updated = await request<Project>(`/api/projects/${project.id}/patches`, { method: "POST", body: JSON.stringify({ name: "UI click", kind: "ui_click", seed: 42, duration_seconds: .12 }) });
      setProjects(items => items.map(item => item.id === updated.id ? updated : item));
      const patch = updated.patches.at(-1)!;
      setStatus("Starting Csound render...");
      setActiveJob(await request<Job>(`/api/projects/${project.id}/patches/${patch.id}/render`, { method: "POST" }));
    } catch (error) { setStatus(error instanceof Error ? error.message : "Render failed"); }
  }

  async function cancelRender() {
    if (!activeJob || !["queued", "running"].includes(activeJob.state)) return;
    try {
      setActiveJob(await request<Job>(`/api/jobs/${activeJob.id}/cancel`, { method: "POST" }));
      setStatus("Render cancelled");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Unable to cancel render"); }
  }

  async function copyExample(project: Project, example: Patch) {
    try {
      const updated = await request<Project>(`/api/projects/${project.id}/gallery/${example.id}`, { method: "POST" });
      setProjects(items => items.map(item => item.id === updated.id ? updated : item));
      setStatus(`${example.name} copied into ${project.name}`);
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
    <header><p className="eyebrow">Offline procedural studio</p><h1>Crea Zik</h1><output>{status}</output>{activeJob && ["queued", "running"].includes(activeJob.state) && <p><progress value={activeJob.progress} max="100" /> {activeJob.progress} % <button className="secondary" onClick={cancelRender}>Cancel render</button></p>}</header>
    <section className="create"><h2>New project</h2><form onSubmit={createProject}><label>Name <input value={name} onChange={event => setName(event.target.value)} placeholder="My first sound" /></label><button>Create</button></form></section>
    <section><h2>Projects</h2>{projects.length === 0 ? <p>No projects yet. Create one to get started.</p> : <div className="grid">{projects.map(project => <article key={project.id}><h3>{project.name}</h3><p>{project.patches.length} patch{project.patches.length > 1 ? "es" : ""}</p><button onClick={() => createAndRender(project)}>Create and render a click</button>{project.patches.length > 0 && <button className="secondary" onClick={() => createVariants(project)}>Create 10 variants</button>}</article>)}</div>}</section>
    <section><h2>Example gallery</h2><div className="grid">{gallery.map(example => <article key={example.id}><h3>{example.name}</h3><p>{example.kind} / {example.duration_seconds}s</p>{projects.length > 0 && <button onClick={() => copyExample(projects[0], example)}>Open a copy</button>}</article>)}</div></section>
    {audio && <section className="player"><h2>Latest render</h2><audio controls src={audio} /><p><a href={audio} download>Download WAV</a></p></section>}
  </main>;
}

createRoot(document.getElementById("root")!).render(<App />);
