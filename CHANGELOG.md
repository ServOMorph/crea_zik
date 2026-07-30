# Changelog

## v0.15 — 2026-07-30

### Ajouté

- Gate V0 de l'éditeur musical complété : fuzzing OpenAPI (Schemathesis), couverture bloquante
  Python/frontend, accessibilité (axe-core), mutation testing (Stryker sur `transport.ts`),
  régression visuelle (Playwright) et markdownlint, chacun avec preuve de blocage volontaire dans
  `EDITEUR/test_editor.ps1`. Rendu instrumental et transport validés à l'écoute par l'utilisateur.

### Corrigé

- Correctifs lint/typage sur `backend/src/crea_zik/api.py` (tri d'imports, variance de `dict`) pour
  débloquer le runner de qualification.

## v0.14 — 2026-07-30

### Ajouté

- Zones `DOCUMENTATION/` et `WORKFLOW/` créées pour la documentation des styles musicaux et l'agent
  de création de musique, développés en parallèle. Modèle de fiche de style validé, roadmap dédiée
  `roadmap_creation_musique.md` (Phase 1 terminée).

## v0.13 — 2026-07-30

### Ajouté

- Phase 2 de `EXPLO/roadmap_plugins.md` livrée : endpoints `/api/plugins` (liste, manifeste, preset,
  rendu synchrone), écran « Plugins » avec contrôles générés depuis le manifeste JSON, non-régression
  du rendu kick vérifiée contre la référence SHA-256 de la phase 1.

## v0.12 — 2026-07-30

### Ajouté

- Phase 1 de `explo/roadmap_plugins.md` livrée : schéma de manifeste JSON générique, moteur kick
  (corps, sub, transitoire, bruit), trois presets (techno, 808_sub, acoustique) avec WAV et
  empreintes SHA-256 de référence, 11 tests (schéma, bornes, déterminisme, non-clipping, non-régression).

## v0.11 — 2026-07-30

### Corrigé

- Gate de déterminisme Csound réel de la phase 1 validé par hachage du WAV rendu (trois rendus indépendants), et non plus seulement du hash de spec renvoyé par le CLI.

## v0.10 — 2026-07-30

### Ajouté

- Roadmap `explo/roadmap_plugins.md` : contrat de plugin par manifeste JSON, moteur kick (couches corps,
  sub, transitoire, bruit), trois presets (techno, 808_sub, acoustique), promotion prévue via crea_zik.

## v0.9 — 2026-07-30

### Ajouté

- Contrats et persistance des compositions versionnées, rendu du mix et des stems, copie sûre des projets.
- Shell éditeur, store avec historique, sauvegarde, transport et préécoute.
- Runner canonique couvrant les contrats, le rendu, le frontend et le parcours E2E.

### Corrigé

- Rendu spécialisé des cinq familles instrumentales avec effets et normalisation, au lieu d’un oscillateur générique.
- Remappage des envois du mixer lors de la copie d’une composition.

## v0.8 — 2026-07-30

### Ajouté

- Sept familles SFX, variantes déterministes, métadonnées, QA et export depuis le studio local.
- Composition de scores avec stems synchronisés et simulation de graphes musicaux adaptatifs.
- Assistant Ollama local avec aperçu, acceptation, rejet et historique persistant.
- Compaction automatique du contexte Codex à partir de 64 000 tokens.

### Modifié

- Interface enrichie avec transport, waveform, Composer, Adaptive Lab et métriques QA.
- Qualification frontend isolée des sorties générées par Prettier.

## v0.7 — 2026-07-30

### Ajouté

- Roadmap complète de l’éditeur musical intégré avec sidebar gauche et édition de `Lignes de nuit`.
- Gates automatiques interphases, seuil fonctionnel de 85 % et phase finale de documentation et de
  recette manuelle exhaustive.

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
