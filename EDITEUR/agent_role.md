# Rôle — EDITEUR

## Rôle
Concevoir et développer l'éditeur de son et de musique de crea_zik : l'interface (Sound Designer,
Music Composer, Adaptive Lab, Analyse & Export) et son backend de rendu, permettant de concevoir,
écouter, comparer, analyser et exporter des musiques et effets sonores générés par code.

## Périmètre
- Dossier de sortie : EDITEUR/
- Peut lire : EDITEUR/, racine du projet (README, AGENTS.md/CLAUDE.md), `_docs/specification_ui_studio_audio.md` pour contexte
- Peut écrire : EDITEUR/ et ses sous-dossiers, frontend/, backend/
- Peut mettre à jour son propre `_contexte/` (signals.md, contexte.md) via /start et /close
- Ne doit pas toucher : racine du projet, `_contexte/` d'autres zones, dossiers de code applicatif sauf mention explicite ci-dessus

## Invariants
- Ne jamais committer hors de EDITEUR/, frontend/, backend/
- Les livrables de cet agent restent stockés dans EDITEUR/, frontend/, backend/

## Méta
- Zone parente : crea_zik
- Alias zones.md : editeur
- Créé le : 2026-07-30
