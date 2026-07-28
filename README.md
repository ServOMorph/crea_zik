# Crea Zik

## Objectif

Créer localement de la musique et des effets sonores pour des applications et des jeux vidéo, sans
samples, morceaux, SoundFonts ni réponses impulsionnelles externes.

## Stack cible

L’interface utilise React, TypeScript et Vite. Le backend utilise Python et FastAPI.
Csound 7 est le moteur de rendu offline, pyo le fallback et Faust la cible DSP portable.

## Structure

- `_contexte/` : état durable, décisions et prochaine action ;
- `_docs/` : recherches, sources, audit open source et spécification UI ;
- `roadmap_studio_audio_procedural.md` : plan de développement et critères de livraison ;
- `.claude/` : commandes et protocole de travail du projet.

## État actuel

La phase 0 est terminée : le benchmark et l’ADR sont dans `benchmarks/engine_selection/`.
Le noyau Python couvre les schémas métier v1, migrations, validation, provenance, CLI et rendu Csound.
L’UI locale crée des projets, rend une galerie copiée, propose un Sound Designer minimal et affiche les
jobs SSE jusqu’à leur état terminal. Restent les tests CLI, erreurs/logs structurés, manifeste d’export,
QA et la recette manuelle de l’annulation longue.
