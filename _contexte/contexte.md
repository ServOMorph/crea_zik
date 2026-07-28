# Contexte — crea_zik

## Objectif (immuable sauf décision explicite)
Créer de la musique et des effets sonores pour des applications et des jeux vidéo.

## Stack / contraintes techniques (stable, rarement modifié)
- Aucun son, sample, morceau, SoundFont ou réponse impulsionnelle récupéré sur le Web.
- Les sources audio sont créées localement par synthèse, DSP, composition et modèles physiques codés.
- Csound 7.0.0-beta.17 pour le rendu offline ; pyo 1.0.5 comme fallback ; Faust comme cible DSP portable.

## État actuel (réécrit intégralement à chaque /close)
La phase 0 est terminée et documentée dans `benchmarks/engine_selection/` et l’ADR 0001.
Le noyau Python expose schémas, provenance, CLI, moteur Csound, API locale et jobs de rendu.
La première UI React/Vite crée des projets, rend un clic, lit le WAV, copie trois exemples et crée des variantes.
Les phases 1–2 restent en cours : annulation/SSE continue, export UI et E2E doivent encore passer leurs gates.

## Décisions structurantes (append only — 10 entrées max, 5 lignes max/entrée, archiver au-delà)
- 2026-07-28 : Initialisation du protocole vibecoding.
- 2026-07-28 : Création audio « from scratch » uniquement ; aucun asset sonore ou musical externe.
- 2026-07-28 : La version 1.0 devra être entièrement fonctionnelle sans retouche audio externe et
  inclure dans l’UI une galerie d’exemples sonores et musicaux reproductibles.
- 2026-07-28 : Csound 7.0.0-beta.17 est retenu pour l’authoring offline ; pyo est le fallback et
  Faust reste la cible portable, conformément à `_docs/adr/0001-stack-audio-phase-0.md`.
