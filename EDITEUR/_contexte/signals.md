# Signals — editeur (MAJ 2026-08-05)

## Actions ouvertes
- [P1|ouvert] Terminer la Phase 6 fonctionnelle (Channel Rack) : longueur de pattern, duplication,
  renommage, variation, suppression sûre, sélection multiple, remplissages usuels, préécoute piste ;
  couleur et nom de pattern exigent une migration de schéma (modèle `extra="forbid"`). Puis clore la
  qualification V6 (drag-and-drop rejoué dans Playwright ou assumé couvert en unitaire ; preuve
  rendu/hash frontend) et ouvrir la Phase 7 (Piano Roll).
  - fait quand: tous les bullets Phase 6 cochés, V6 entièrement cochée avec runner canonique vert
    final (rapport `EDITEUR/test-results/v1-*.json`, success true) et Phase 7 ouverte [EN COURS]
  - réf: `EDITEUR/roadmap_editeur_musical.md` (Phase 6, Phase V6, Phase 7),
    `frontend/src/editor/editorStore.ts`, `frontend/src/editor/StepSequencer.tsx`,
    `frontend/src/editor/ChannelRack.tsx`

## Dernière session (2026-08-05)
# Session du 2026-08-05

## Décisions prises
- Phase 5 close [FAIT] : tempo et métrique affichés dans `TransportBar` et couverts par un test ;
  runner canonique vert (V0→V5).
- Phase 6 ouverte [EN COURS] : Channel Rack + séquenceur pas à pas livrés (backend
  probability/micro_timing propagés avec gate seedé, fix du solo) ; V6 [EN COURS], runner canonique
  vert 20 checks (`EDITEUR/test-results/v1-20260805-102645.json`).

## Livrables produits ou modifiés
- `backend/src/crea_zik/compositions.py` : gate `_event_plays` seedé (SHA-256
  `{seed}:{track_id}:{midi_note}:{start_beat}`), `micro_timing_beats` décale l'onset ; fix solo :
  pistes sans canal muettes quand un solo est actif. `tests/test_editor_sequencer.py` (nouveau,
  5 tests) ajouté aux gates lint/domain de `EDITEUR/test_editor.ps1`.
- `frontend/src/editor/editorStore.ts` : types `NoteEvent`/`Pattern.events`/`MixerChannel`,
  commandes `setStep`, `setStepField`, `setTrackChannelFlag`, `addPattern`, helpers
  `stepBeat`/`patternLengthBeats`/`stepEvent`/`STEP_FIELD_BOUNDS`.
- `frontend/src/editor/ChannelRack.tsx` + `ChannelRack.test.tsx` (nouveaux) ; `StepSequencer.tsx` +
  `StepSequencer.test.tsx` (nouveaux : grille, résolution 1/1→1/8, paint/erase au glisser, sliders
  vélocité/probabilité/micro-décalage, accent, clavier Entrée/Espace) ; `stepSequencer.test.ts`
  (nouveau, 11 tests dont fast-check) ; `EditorLanding.tsx` (VirtualList rowHeight 48, SequencerPanel
  par défaut sur la première piste drums, patternRequest) ; `TransportBar.tsx` (préécoute du pattern,
  tempo/métrique) ; `styles.css` (`.channel-rack__*`, `.step-sequencer__*`).
- `frontend/e2e/studio.spec.ts` : test « the editor step sequencer toggles, undoes and mutes drum
  steps » — a révélé et corrigé l'inaccessibilité clavier du séquenceur (Enter n'émet pas
  pointerdown).
- Runner canonique 20/20 gates verts : backend 116 tests, frontend 96 unitaires, 13 e2e, mutation
  Stryker ~84 %, a11y, visuel, golden `Lignes de nuit` inchangé.
- `tests_manuels.md` : section Channel Rack ajoutée (4 contrôles en attente de validation manuelle).

## Hypothèses validées / invalidées
- VALIDE — le golden `Lignes de nuit` reste bit-exact après l'ajout de probability/micro_timing
  (champs absents par défaut, gate inactif) : le run runner complet le confirme.
- INVALIDE → pivot — le séquenceur était inutilisable au clavier : `applyCell` dépendait de
  `paintModeRef` jamais initialisé hors pointer ; corrigé par `onKeyDown` (fix détecté par le test
  e2e, pas par les tests unitaires).
- EN ATTENTE — drag-and-drop natif non rejoué dans Playwright (peinture au glisser couverte en
  unitaire via pointer events) ; preuve rendu/hash frontend d'une modification de pas non
  formalisée (la preuve backend existe via `test_editor_sequencer.py`).

## Prochaine étape exacte
Terminer la Phase 6 (longueur de pattern, duplication, renommage, variation, suppression sûre,
sélection multiple, remplissages, préécoute piste, couleur/nom via migration de schéma), clore la
qualification V6, puis ouvrir la Phase 7 (Piano Roll).

## Question bloquante pour la session suivante
Aucune.
