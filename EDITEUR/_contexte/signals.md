# Signals — editeur (MAJ 2026-08-05)

## Actions ouvertes
- [P1|ouvert] Ouvrir et clore la Phase 8 (Playlist, arrangement et marqueurs) : Playlist
  multipiste synchronisée au Channel Rack, clips (placement, déplacement, duplication,
  répétition, découpe, redimensionnement), insert/delete time avec ou sans ripple, verrouillage/
  groupe/mute/transposition de clip, création/renommage/réorganisation de pistes, marqueurs
  éditables (intro/groove/montée/climax/outro), règle explicite et visible des clips
  chevauchants ; puis qualification V8 (collision/overlap/répétition/ripple/durées/marqueurs,
  budget de densité, drag-and-drop Playwright).
  - fait quand: tous les bullets Phase 8 cochés, V8 entièrement cochée avec runner canonique vert
    final (rapport `EDITEUR/test-results/v1-*.json`, success true) et Phase 9 ouverte [EN COURS]
  - réf: `EDITEUR/roadmap_editeur_musical.md` (Phase 8, Phase V8, Phase 9),
    `frontend/src/editor/EditorLanding.tsx`, `frontend/src/editor/editorStore.ts`

## Dernière session (2026-08-05)
# Session du 2026-08-05 (4e)

## Décisions prises
- Les drags de lanes se groupent dans l'historique undo via le 4e paramètre `groupWithPrevious`
  de `onSetNoteFields` (propagé par `PatternEditor.tsx` et `EditorLanding.tsx`).
- La preuve « note modifiée → rendu modifié » est portée par le backend : déplacement et
  transposition d'une note mélodique modifient stem et mix (hash) — la réserve V6 de preuve
  rendu/hash est résolue pour les notes ; la comparaison audio post-édition reste hors Chromium
  (réserve assumée).

## Livrables produits ou modifiés
- `frontend/src/editor/PianoRoll.tsx` : lanes vélocité/probabilité/micro-décalage/pan (drag,
  undo groupé), ghost notes des autres pistes (hors drums), gamme/tonalité (sélecteurs tonique
  + mode, surbrillance `is-offscale` non bloquante), fix de l'accélération des drags
  (`lastDeltaBeat`/`lastDeltaMidi`/`lastDelta`).
- `PianoRoll.test.tsx` : 19 tests (17 → 19, dont anti-accélération et surbrillance de gamme).
  `styles.css` : styles `.piano-roll__lane*`, `.piano-roll__ghost-note`, `.is-offscale`.
- `PatternEditor.tsx` : prop `ghostNotes` ; `EditorLanding.tsx` : propagation `groupWithPrevious`.
- `e2e/studio.spec.ts` : e2e d'édition souris (création → déplacement → resize → sauvegarde →
  rechargement) ; libellés corrigés (Si3 → Sol#3, midi 56) ; `e2e/debug.spec.ts` supprimé.
- `tests/test_compositions.py` : nouveau test `render_reacts_to_a_moved_and_transposed_melodic_note`
  (déplacement/transposition d'une note pad → stem + mix différents).

## Hypothèses validées / invalidées
- VALIDE — l'échec e2e d'édition souris venait de l'accumulation des deltas de drag à chaque
  pointermove (accélération) ; corrigé par les deltas incrémentaux `lastDelta*` (debug spec puis
  e2e verts).
- INVALIDE — le libellé « Si3 » du e2e : la note est Sol#3 (midi 56) ; notation française corrigée.
- EN ATTENTE — comparaison du rendu audio post-édition dans Chromium non formalisée (preuve par
  hash backend) ; snapshot visuel limité au shell.

## Prochaine étape exacte
Phase 7 et V7 closes [FAIT]. Au prochain `/start editeur` : Phase 8 (Playlist, arrangement et
marqueurs) — Playlist multipiste, clips, ripple, groupes, marqueurs, transposition de clip,
puis V8 avec drag-and-drop Playwright et budget de densité.

## Question bloquante pour la session suivante
Aucune.
