# Contexte — documentation

## Objectif (immuable sauf décision explicite)
Écrire et organiser toute la documentation du projet crea_zik. En premier lieu : un inventaire des styles de musique et de la façon de s'en servir pour créer des morceaux dans ces styles, en lien direct avec l'éditeur de musique et la création de musique.

## Stack / contraintes techniques (stable, rarement modifié)
Projet crea_zik : création locale de musique et d'effets sonores, sans samples/SoundFonts/réponses impulsionnelles externes.
- Frontend éditeur : React, TypeScript, Vite.
- Backend : Python, FastAPI.
- Moteur de rendu : Csound 7 (offline), pyo (fallback), Faust (cible DSP portable).
- Documentation existante à la racine du projet (hors périmètre d'écriture de cet agent) : `_docs/` (recherches, audit open source, spécification UI, ADR).

## État actuel (réécrit intégralement à chaque /close)
Modèle de fiche de style créé (`modele_fiche_style.md`). Roadmap `roadmap_creation_musique.md`
(racine) créée, Phase 1 terminée. Le travail avance en parallèle avec la zone `workflow`
(agent de création de musique), qui contient les scripts et le fichier workflow.md.

## Décisions structurantes (append only — 10 entrées max, 5 lignes max/entrée, archiver au-delà)
- 2026-07-30 : Initialisation du protocole vibecoding.
- 2026-07-30 : Documentation et agent de création (workflow) développés en parallèle, pas en séquence.
- 2026-07-30 : Tous les scripts de l'agent de création vivent dans WORKFLOW/scripts/ (dossier déplaçable).
