import { FormEvent, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type Patch = { id: string; name: string; kind: string; seed: number; duration_seconds: number };
type Project = { id: string; name: string; patches: Patch[] };
type Job = { id: string; state: "queued" | "running" | "completed" | "failed" | "cancelled"; progress: number; error?: string; wav?: string };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { headers: { "Content-Type": "application/json" }, ...init });
  if (!response.ok) throw new Error((await response.json()).detail ?? "Erreur réseau");
  return response.json() as Promise<T>;
}

function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [gallery, setGallery] = useState<Patch[]>([]);
  const [name, setName] = useState("");
  const [status, setStatus] = useState("Prêt");
  const [audio, setAudio] = useState<string | null>(null);

  const reload = () => request<Project[]>("/api/projects").then(setProjects).catch(error => setStatus(error.message));
  useEffect(() => { void reload(); request<Patch[]>("/api/gallery").then(setGallery).catch(error => setStatus(error.message)); }, []);

  async function createProject(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    const project = await request<Project>("/api/projects", { method: "POST", body: JSON.stringify({ name }) });
    setProjects(items => [...items, project]); setName(""); setStatus("Projet créé");
  }

  async function createAndRender(project: Project) {
    try {
      setStatus("Création du clic…");
      const updated = await request<Project>(`/api/projects/${project.id}/patches`, { method: "POST", body: JSON.stringify({ name: "Clic UI", kind: "ui_click", seed: 42, duration_seconds: .12 }) });
      setProjects(items => items.map(item => item.id === updated.id ? updated : item));
      const patch = updated.patches.at(-1)!;
      setStatus("Rendu Csound…");
      let job = await request<Job>(`/api/projects/${project.id}/patches/${patch.id}/render`, { method: "POST" });
      while (job.state === "queued" || job.state === "running") {
        setStatus(`Rendu ${job.progress} %…`);
        await new Promise(resolve => window.setTimeout(resolve, 150));
        job = await request<Job>(`/api/jobs/${job.id}`);
      }
      if (job.state !== "completed" || !job.wav) throw new Error(job.error ?? "Rendu annulé");
      setAudio(`/projects/${job.wav}`); setStatus("Rendu terminé");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Échec du rendu"); }
  }

  async function copyExample(project: Project, example: Patch) {
    try {
      const updated = await request<Project>(`/api/projects/${project.id}/gallery/${example.id}`, { method: "POST" });
      setProjects(items => items.map(item => item.id === updated.id ? updated : item));
      setStatus(`${example.name} copié dans ${project.name}`);
    } catch (error) { setStatus(error instanceof Error ? error.message : "Copie impossible"); }
  }

  async function createVariants(project: Project) {
    const source = project.patches[0];
    if (!source) return;
    try {
      const updated = await request<Project>(`/api/projects/${project.id}/patches/${source.id}/variants?count=10`, { method: "POST" });
      setProjects(items => items.map(item => item.id === updated.id ? updated : item));
      setStatus("Dix variantes déterministes créées");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Variantes impossibles"); }
  }

  return <main>
    <header><p className="eyebrow">Studio procédural hors ligne</p><h1>Crea Zik</h1><output>{status}</output></header>
    <section className="create"><h2>Nouveau projet</h2><form onSubmit={createProject}><label>Nom <input value={name} onChange={event => setName(event.target.value)} placeholder="Mon premier son" /></label><button>Créer</button></form></section>
    <section><h2>Projets</h2>{projects.length === 0 ? <p>Aucun projet. Créez-en un pour commencer.</p> : <div className="grid">{projects.map(project => <article key={project.id}><h3>{project.name}</h3><p>{project.patches.length} patch{project.patches.length > 1 ? "es" : ""}</p><button onClick={() => createAndRender(project)}>Créer un clic et rendre</button>{project.patches.length > 0 && <button className="secondary" onClick={() => createVariants(project)}>Créer 10 variantes</button>}</article>)}</div>}</section>
    <section><h2>Galerie d’exemples</h2><div className="grid">{gallery.map(example => <article key={example.id}><h3>{example.name}</h3><p>{example.kind} · {example.duration_seconds}s</p>{projects.length > 0 && <button onClick={() => copyExample(projects[0], example)}>Ouvrir une copie</button>}</article>)}</div></section>
    {audio && <section className="player"><h2>Dernier rendu</h2><audio controls src={audio} /></section>}
  </main>;
}

createRoot(document.getElementById("root")!).render(<App />);
