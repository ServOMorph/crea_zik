# Signals — crea_zik (MAJ 2026-07-28)

## Actions ouvertes
- [P1|ouvert] Terminer les gates des phases 1 et 2 : jobs locaux annulables/SSE, premier parcours UI complet et tests E2E.
  fait quand: un utilisateur crée un projet, rend, écoute et exporte un clic depuis l’UI sans terminal ; l’annulation n’empêche pas les jobs suivants
  réf: roadmap_studio_audio_procedural.md

## Dernière session (2026-07-28)
### Décisions prises
- Csound 7.0.0-beta.17 est le moteur d’authoring offline ; pyo reste le fallback et Faust la cible DSP portable.
- DawDreamer reste limité au benchmark et au développement, hors distribution par défaut (GPL-3.0).

### Livrables produits ou modifiés
- `benchmarks/engine_selection/` : trois routes, cinq cas, métriques, empreintes et ADR de stack.
- `backend/`, `tests/`, `pyproject.toml` : noyau, CLI, API FastAPI, jobs de rendu et huit tests.
- `frontend/` : UI React/Vite pour projets, clic, galerie initiale, rendu, écoute et variantes.

### Hypothèses validées / invalidées
- VALIDE : les trois moteurs rendent les cinq cas ; Csound est déterministe et le plus rapide sur cette machine.
- VALIDE : un parcours UI local peut créer, rendre et lire un premier WAV sans terminal.
- EN ATTENTE : test manuel UI, annulation d’un job en attente et E2E Playwright.

### Prochaine étape exacte
Tester `http://127.0.0.1:5173` : création, clic, lecture, export, copie de galerie et dix variantes.
Implémenter ensuite la progression SSE continue, l’annulation de job et les tests E2E de la phase 2.

### Question bloquante pour la session suivante
Aucune.
