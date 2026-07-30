# Contexte — crea_zik

## Objectif (immuable sauf décision explicite)
Créer de la musique et des effets sonores pour des applications et des jeux vidéo.

## Stack / contraintes techniques (stable, rarement modifié)
- Aucun son, sample, morceau, SoundFont ou réponse impulsionnelle récupéré sur le Web.
- Les sources audio sont créées localement par synthèse, DSP, composition et modèles physiques codés.
- Csound 7.0.0-beta.17 pour le rendu offline ; pyo 1.0.5 comme fallback ; Faust comme cible DSP portable.

## État actuel (réécrit intégralement à chaque /close)
Les phases 0 et 1 couvrent le benchmark, les schémas métier v1, la provenance, la CLI, Csound et l’API.
Le gate de déterminisme Csound réel est validé : trois rendus indépendants du même patch produisent un WAV au SHA-256 identique.
`EXPLO/` contient un premier morceau de 30 s et son archive versionnée avec master, stems, sources et QA.
`roadmap_studio_audio_procedural.md` (phase 2) semble en décalage avec le code réel (API FastAPI et frontend déjà présents sous une forme différente de celle décrite) ; un audit reste à faire avant de reprendre les tâches de phase 2.

## Décisions structurantes (append only — 10 entrées max, 5 lignes max/entrée, archiver au-delà)
- 2026-07-28 : Initialisation du protocole vibecoding.
- 2026-07-28 : Création audio « from scratch » uniquement ; aucun asset sonore ou musical externe.
- 2026-07-28 : La version 1.0 devra être entièrement fonctionnelle sans retouche audio externe et
  inclure dans l’UI une galerie d’exemples sonores et musicaux reproductibles.
- 2026-07-28 : Csound 7.0.0-beta.17 est retenu pour l’authoring offline ; pyo est le fallback et
  Faust reste la cible portable, conformément à `_docs/adr/0001-stack-audio-phase-0.md`.
- 2026-07-28 : Le lancement local par défaut utilise `127.0.0.1:8002` pour l’API et `127.0.0.1:5174` pour l’UI.
- 2026-07-28 : Playwright utilise les ports isolés `8001`/`5180` et une racine de projets temporaire.
- 2026-07-28 : Les projets utilisent les schémas de domaine versionnés v1 ; les exemples intégrés
  sont copiés vers un projet avant rendu et restent immuables dans la galerie.
- 2026-07-30 : Les erreurs de rendu et de CLI sont typées et journalisées en JSON ; tout export CLI
  comprend un manifeste de provenance déterministe.
- 2026-07-30 : Les explorations musicales conservent leurs sources, rendus, stems, QA et documentation
  dans une archive versionnée adressée par SHA-256 ; l’éditeur devra produire ce même descripteur.
- 2026-07-30 : Le rendu Csound réel est confirmé déterministe par hachage du WAV produit sur trois
  rendus indépendants (pas seulement le hash de spec renvoyé par le CLI).
