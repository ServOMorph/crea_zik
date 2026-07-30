# Changelog

## v0.6 — 2026-07-30

### Ajouté

- Premier morceau électro procédural de 30 secondes avec master WAV, stems, spec, renderer et QA.
- Archivage musical versionné : catalogue, manifestes SHA-256, déduplication, documentation et contrôle d’intégrité.

## v0.5 — 2026-07-30

### Ajouté

- Erreurs typées, logs JSON, timeout Csound et couverture des erreurs de rendu.
- Parcours CLI testé de bout en bout et manifeste de provenance JSON créé à chaque export.

### Modifié

- Les erreurs de jobs structurées sont affichées par l’interface.
- La recette manuelle non reproductible a été retirée après validation de la reprise automatique.

## v0.4 — 2026-07-28

### Ajouté

- Schémas de domaine versionnés, migration de lecture, validation et confinement d’écriture des projets.
- Galerie rendable, Sound Designer minimal et liste de jobs avec progression, état et annulation.
- Couverture des schémas et trois parcours E2E : clic, galerie et Sound Designer.

### Modifié

- Recette manuelle réduite au test résiduel d’annulation de rendu long.

## v0.3 — 2026-07-28

### Ajouté

- Jobs de rendu à progression SSE, annulation coopérative et tests de non-blocage de file.
- Lanceur local `run.py`, recette manuelle et test E2E Playwright du parcours création/rendu/écoute/export.

### Corrigé

- Proxy Vite des fichiers WAV `/projects` : le lecteur HTML charge et lit désormais les rendus.

## v0.2 — 2026-07-28

### Ajouté

- Benchmark pyo, Faust+DawDreamer et Csound 7 avec ADR de stack et runtime Csound isolé.
- Noyau Python, CLI, API FastAPI, jobs de rendu et tests de provenance/confinement.
- Frontend React/Vite : projets, rendu de clic, lecture WAV, galerie initiale et variantes déterministes.

## v0.1 — 2026-07-28

### Ajouté

- Analyse des techniques actuelles de création musicale et sonore par code.
- Audit de projets GitHub open source et index consolidé des sources.
- Spécification de l’interface du studio et galerie de onze exemples reproductibles.
- Roadmap complète en douze phases avec contrat de livraison sans retouche externe.
- Contexte de projet, signaux de reprise et documentation de racine.
