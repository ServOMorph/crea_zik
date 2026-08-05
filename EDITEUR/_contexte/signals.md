# Signals — editeur (MAJ 2026-08-05)

## Actions ouvertes
- [P1|ouvert] Clore la Phase 7 (Piano Roll) : livré en session — `PianoRoll.tsx` rend toutes les
  notes mélodiques de `Lignes de nuit` et transpose exactement (e2e Chromium), commandes notes
  complètes (`noteCommands.ts` : add/move/resize/duplicate/delete, quantize/swing/humanize seedés,
  transpose, legato, durée uniforme, inversion, accords — testées), conversions beat/pixel,
  snap, bornes MIDI, gamme/tonalité (`pianoRollGeometry.ts`, fast-check). Restent : lanes
  vélocité/pan/probabilité/micro-timing, ghost notes, édition souris (création/déplacement/resize)
  qualifiée dans l'UI, reconstitution complète.
  - fait quand: tous les bullets Phase 7 cochés, V7 entièrement cochée avec runner canonique vert
    final (rapport `EDITEUR/test-results/v1-*.json`, success true) et Phase 8 ouverte [EN COURS]
  - réf: `EDITEUR/roadmap_editeur_musical.md` (Phase 7, Phase V7, Phase 8),
    `frontend/src/editor/PianoRoll.tsx`, `frontend/src/editor/noteCommands.ts`,
    `frontend/src/editor/pianoRollGeometry.ts`, `frontend/src/editor/editorStore.ts`

## Dernière session (2026-08-05)
# Session du 2026-08-05 (3e)

## Décisions prises
- Phases 6 et V6 closes [FAIT] : longueur/duplication/renommage/variation seedée/suppression sûre
  de patterns, sélection multiple, remplissages, préécoute piste, couleur/nom via migration de
  schéma v3 (`CURRENT_SCHEMA_VERSION = 3`). Réserves assumées : glisser et multi-sélection couverts
  en unitaire, preuve rendu/hash frontend non formalisée (backend). Phase 7 ouverte [EN COURS].
- Fix course sauvegarde/préécoute : `EditorLanding.save()` partage la promesse PUT en vol
  (`saveInFlightRef`) — un clic « Lire la sélection » pendant la sauvegarde attend la fin du PUT
  au lieu d'avorter silencieusement ; échec de sauvegarde → « Sauvegarde impossible, préécoute
  annulée. » (avant : transport bloqué sur « Rendu de la préécoute… »).
- Corruption UTF-8 réparée (6 chaînes, U+FFFD, dans `EditorLanding.tsx`/`TransportBar.tsx`,
  introduite par une conversion PowerShell antérieure) — cause réelle des 2 échecs unitaires,
  pas le refactoring.
- Piano roll de base livré (Phase 7 non close) : `PianoRoll.tsx` rend toutes les notes mélodiques
  de `Lignes de nuit` et transpose exactement (e2e Chromium) ; commandes notes complètes
  (`noteCommands.ts`) ; conversions beat/pixel, snap, bornes MIDI et gamme/tonalité
  (`pianoRollGeometry.ts`).

## Livrables produits ou modifiés
- Nouveaux : `PianoRoll.tsx`/`.test.tsx`, `noteCommands.ts`/`.test.ts` (sélection, add/move/resize/
  duplicate/delete, setNoteFields, quantize/swing/humanize, transpose, legato, uniformDuration,
  invert, buildChord), `pianoRollGeometry.ts`/`.test.ts` (fast-check),
  `PatternEditor.tsx`/`.test.tsx` (11 tests).
- Modifiés : `editorStore.ts` (patterns, remplissages, notes), `StepSequencer.tsx`/`.test.tsx`,
  `stepSequencer.test.ts`, `EditorLanding.tsx` (PatternEditor, fix course, UTF-8),
  `TransportBar.tsx` (préécoute piste, fix, UTF-8), `TransportBar.test.tsx` (+1 échec sauvegarde),
  `e2e/studio.spec.ts` (+piano roll, fix route directe), `backend/src/crea_zik/models.py`
  (migration v3), contrat `composition.schema.json` et fixture `lignes_de_nuit` alignés,
  `tests/test_compositions.py` + `test_foundation.py`, `tests_manuels.md` (+contrôles patterns).
- Runner canonique vert final : `EDITEUR/test-results/v1-20260805-161626.json` (success true,
  21 checks ; backend 118 + 11 Schemathesis, frontend 167 unitaires, mutation Stryker
  79,17 % ≥ 60 %, e2e 13, visuel 1, markdownlint 0).

## Hypothèses validées / invalidées
- VALIDE — la course PUT/préécoute est reproductible et le partage de promesse la résout
  (e2e route directe vert, seul test qui échouait avant).
- VALIDE — les 2 échecs unitaires `EditorLanding` venaient de la corruption UTF-8, pas du
  refactoring (suite entière verte après réparation).
- EN ATTENTE — Phase 7 : piano roll de base livré, lanes/ghost notes/édition souris UI et V7
  non closes.

## Prochaine étape exacte
Poursuivre la Phase 7 : lanes vélocité/pan/probabilité/micro-timing, ghost notes, édition souris
(création/déplacement/resize) qualifiée dans l'UI, reconstitution complète, puis clore V7
(conversions beat/pixel fast-check, e2e d'édition de mélodie avec comparaison de rendu, runner
canonique vert) et ouvrir la Phase 8.

## Question bloquante pour la session suivante
Aucune.
