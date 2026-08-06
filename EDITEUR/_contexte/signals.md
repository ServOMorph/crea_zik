# Signals — editeur (MAJ 2026-08-06)

## Actions ouvertes
- [P1|ouvert] Mener la Phase 10 (Automations) et sa qualification V10 : automation depuis tout
  paramètre automatisable, lanes et clips d'automation dans la Playlist, points/courbes
  step/linéaire/lissée, snap/copie/duplication/échelle/inversion, priorité valeur de base/
  automation/mute/bypass, application au moteur sans zipper noise, valeur évaluée sous le playhead,
  automations démonstratives sans modifier la référence immuable.
  - fait quand: runner canonique complet vert (rapport `v1-*.json` success true) et Phase 11 ouverte [EN COURS]
  - réf: `EDITEUR/roadmap_editeur_musical.md` (Phase 10, Phase V10), `backend/src/crea_zik/api.py`,
    `frontend/src/editor/editorStore.ts`, `frontend/src/editor/InstrumentInspector.tsx` (sources
    d'automation), `frontend/src/editor/Playlist.tsx` (lanes d'automation)

## Contexte chaud
- Qualification V9 close le 2026-08-06 : runner canonique 21/21 vert (rapport
  `EDITEUR/test-results/v1-20260806-073005.json`, success true) ; backend 179 tests, frontend 239
  unitaires, e2e 15/15, mutation Stryker 77.02.
- `POST .../instrument-preview` accepte des `parameters` explicites → l'inspecteur préécoute l'état
  en cours d'édition sans sauvegarde ; le bypass « écouter l'original » envoie les défauts du registre.
- Parité bornes UI/backend : `setInstrumentParameter` (frontend) clamp ; `sanitize_parameters`
  (backend) clamp + NaN→défaut. L'inspecteur est affiché par `EditorLanding` quand une seule piste
  est sélectionnée.
- Runner `test_editor.ps1` : `uv lock --check` écrit sur stderr même en succès → `Invoke-Gate`
  abaisse `$ErrorActionPreference` à `Continue` localement ; les échecs réels restent détectés via
  `$LASTEXITCODE`.

## Dernière session
# Session du 2026-08-06

## Décisions prises
- Phase 9 close : la préécoute d'instrument accepte des `parameters` explicites (POST
  `instrument-preview`) — l'inspecteur préécoute l'état en cours d'édition sans sauvegarde ; le
  bypass « écouter l'original » envoie les défauts du registre.
- Bornes UI = backend : `setInstrumentParameter` (store) clamp comme `sanitize_parameters` (NaN
  ignoré côté UI, NaN→défaut côté backend).

## Livrables produits ou modifiés
- `backend/src/crea_zik/instrument_registry.py` : registre typé + sanitize.
- `backend/src/crea_zik/composition_dsp.py` : `synthesize` applique `sanitize_parameters`.
- `backend/src/crea_zik/api.py` : `GET /api/instrument-registry`, `POST .../instrument-preview`.
- `tests/test_editor_instruments.py` : 50 tests (parité, bornes, Hypothesis, endpoint).
- `frontend/src/editor/editorStore.ts` : `Track.instrument` + commandes bornées (undo/redo).
- `frontend/src/editor/instrumentRegistry.ts` : types TS + fetch mémoïsé.
- `frontend/src/editor/InstrumentInspector.tsx` : inspecteur complet.
- `frontend/src/editor/editorStore.instrument.test.ts` (9 tests) + `InstrumentInspector.test.tsx` (13 tests).
- `frontend/src/editor/EditorLanding.tsx`, `frontend/src/styles.css` : intégration inspecteur.

## Hypothèses validées / invalidées
- VALIDE : parité défauts fixture ↔ défauts registre (testé pour les 5 kinds).
- VALIDE : préécoute avec paramètres hors bornes reste finie (sanitize via endpoint).
- EN ATTENTE : les « 5 échecs » frontend signalés en V8 ne se reproduisent pas sur la suite actuelle
  (239 tests verts) — non re-investigués.

## Prochaine étape exacte
Ouvrir la Phase 10 (Automations) ; Phase 9 close (runner canonique vert
`v1-20260806-073005.json`, success true, 21 checks).

## Question bloquante pour la session suivante
Aucune.
