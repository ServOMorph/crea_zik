# Contexte — crea_zik

## Objectif (immuable sauf décision explicite)
Créer de la musique et des effets sonores pour des applications et des jeux vidéo.

## Stack / contraintes techniques (stable, rarement modifié)
- Aucun son, sample, morceau, SoundFont ou réponse impulsionnelle récupéré sur le Web.
- Les sources audio sont créées localement par synthèse, DSP, composition et modèles physiques codés.
- Csound 7.0.0-beta.17 pour le rendu offline ; pyo 1.0.5 comme fallback ; Faust comme cible DSP portable.

## État actuel (réécrit intégralement à chaque /close)
La phase 0 est terminée et documentée dans `benchmarks/engine_selection/` et l’ADR 0001.
La phase 1 fournit le noyau Project/Patch, provenance, CLI, moteur Csound et API, mais les schémas métier complets restent à faire.
La tranche UI de phase 2 est lancée par `run.py` sur `8002`/`5174` et le parcours clic est validé manuellement et en E2E.
Les jobs publient leur état par SSE, s’annulent sans bloquer la file et les WAV se lisent via le proxy `/projects`.
Restent les gates de galerie régénérable, UI de jobs pour rendus longs et fonctions Sound Designer/QA prévues.

## Décisions structurantes (append only — 10 entrées max, 5 lignes max/entrée, archiver au-delà)
- 2026-07-28 : Initialisation du protocole vibecoding.
- 2026-07-28 : Création audio « from scratch » uniquement ; aucun asset sonore ou musical externe.
- 2026-07-28 : La version 1.0 devra être entièrement fonctionnelle sans retouche audio externe et
  inclure dans l’UI une galerie d’exemples sonores et musicaux reproductibles.
- 2026-07-28 : Csound 7.0.0-beta.17 est retenu pour l’authoring offline ; pyo est le fallback et
  Faust reste la cible portable, conformément à `_docs/adr/0001-stack-audio-phase-0.md`.
- 2026-07-28 : Le lancement local par défaut utilise `127.0.0.1:8002` pour l’API et `127.0.0.1:5174` pour l’UI.
- 2026-07-28 : Playwright utilise les ports isolés `8001`/`5180` et une racine de projets temporaire.
