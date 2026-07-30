# Contexte — workflow

## Objectif (immuable sauf décision explicite)
Fournir l'agent (et ses scripts outils) qui transforme une fiche de style musical, définie dans
DOCUMENTATION/, en musique produite via le moteur de rendu du projet.

## Stack / contraintes techniques (stable, rarement modifié)
Projet crea_zik : création locale de musique et d'effets sonores, sans samples/SoundFonts/réponses
impulsionnelles externes.
- Moteur de rendu : Csound 7 (offline), pyo (fallback), Faust (cible DSP portable).
- Dossier déplaçable : tous les scripts doivent résider dans `WORKFLOW/scripts/`, jamais ailleurs.

## État actuel (réécrit intégralement à chaque /close)
Zone créée. `workflow.md` est un squelette sans étapes définies. `scripts/` est vide.
Travaille en parallèle avec la zone `documentation` (modèle de fiche de style déjà créé).

## Décisions structurantes (append only — 10 entrées max, 5 lignes max/entrée, archiver au-delà)
- 2026-07-30 : Création de la zone workflow, alias `workflow` dans `.claude/zones.md`.
- 2026-07-30 : Tous les scripts de l'agent vivent dans WORKFLOW/scripts/, pour permettre de déplacer WORKFLOW/ sans casser les références internes.
