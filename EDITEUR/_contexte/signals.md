# Signals — editeur (MAJ 2026-08-06)

## Actions ouvertes
- [P1|ouvert] Mener la Phase 9 (Instruments procéduraux et inspecteur) et sa qualification V9 :
  registre typé des instruments et paramètres, inspecteur contextuel (oscillateurs, harmoniques,
  accordage, enveloppe, filtre, modulation, polyphonie), paramètres drums/basse/pad/arpège/lead,
  reset/saisie précise/modulation/comparaison, bypass sûr contre NaN/infini/instabilité, préécoute
  note/pattern/piste, bornes UI = backend.
  - fait quand: runner canonique complet vert (rapport `v1-*.json` success true) et Phase 10 ouverte [EN COURS]
  - réf: `EDITEUR/roadmap_editeur_musical.md` (Phase 9, Phase V9), `backend/src/crea_zik/models.py`
    (`InstrumentPreset`), `backend/src/crea_zik/composition_dsp.py` (paramètres de synthèse),
    `frontend/src/editor/EditorLanding.tsx`, `frontend/src/editor/editorStore.ts`

## Contexte chaud
- Qualification V8 close le 2026-08-06 : runner canonique 20/20 vert (rapport
  `EDITEUR/test-results/v1-20260806-060208.json`, success true) ; e2e 15/15, backend 130, golden
  `verify_lignes_reference.py` ok.
- Le test e2e V8 « arranges clips and markers » n'était pas un bug du ripple : le clip ajouté
  démarre à `compositionEndBeat` (62 beats dans le scénario car le pad est déplacé à 2..62), pas à
  60 ; le ripple de +8 l'amène à 70 beats (6720 px). L'assertion vérifie maintenant que le clip
  suivant est poussé de la distance exacte du drag (capturée avant le drag).
- Runner `test_editor.ps1` : `uv lock --check` écrit sur stderr même en succès → `Invoke-Gate`
  abaisse `$ErrorActionPreference` à `Continue` localement ; les échecs réels restent détectés via
  `$LASTEXITCODE`.
- e2e Playlist : libellés exacts (strict mode), `toHaveCSS` (plus de `toHaveStyle` sous Playwright
  1.62), défilement horizontal piloté par `scrollLeft` (`scrollPlaylist`), départ du drag sur clip
  géant `Math.max(x+120, 500)`.

## Dernière session
# Session du 2026-08-06

## Décisions prises
- Qualification V8 close : le test e2e rouge était une attente erronée, pas un bug du ripple — le
  clip ajouté démarre à `compositionEndBeat` (62 beats, pad déplacé à 2..62) et le ripple de +8
  l'amène à 70 beats (6720 px), pas 68 (6528 px). L'assertion vérifie désormais l'invariant réel :
  le clip suivant est poussé de la distance exacte du drag.
- Runner canonique : `uv lock --check` écrit sur stderr en succès ; `$ErrorActionPreference="Stop"`
  le transformait en exception et faisait échouer `python-lock` à tort. `Invoke-Gate` abaisse
  localement la préférence à `Continue` (échecs réels détectés via `$LASTEXITCODE`).

## Livrables produits ou modifiés
- `frontend/e2e/studio.spec.ts` : assertion V8 dynamique (clip suivant poussé de la distance exacte
  du drag) ; désambiguïsation du checkbox « Boucle sélection » (collision avec « Ripple »).
- `EDITEUR/test_editor.ps1` : `Invoke-Gate` tolère le stderr natif des commandes qui réussissent.

## Hypothèses validées / invalidées
- INVALIDE : le drag ripple sur-déplaçait le clip ajouté (+10 au lieu de +8) — en réalité le clip
  partait de 62 beats (`compositionEndBeat`) et le ripple le déplaçait exactement de +8 → 70 beats
  (6720 px) ; l'attente 6528 px supposait un départ à 60.
- VALIDE : le gate `python-lock` échouait à cause du stderr de `uv lock --check` sous
  `$ErrorActionPreference="Stop"`, pas d'un lockfile désynchronisé (`uv lock --check` exit 0).

## Prochaine étape exacte
Ouvrir la Phase 9 (Instruments procéduraux et inspecteur) ; V8 close (runner canonique vert
`v1-20260806-060208.json`, success true).

## Question bloquante pour la session suivante
Aucune.
