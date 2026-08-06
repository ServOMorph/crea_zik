# Signals — editeur (MAJ 2026-08-06)

## Actions ouvertes
- [P1|ouvert] Clore la Phase 8 (Playlist, arrangement et marqueurs) et sa qualification V8 :
  test e2e drag-and-drop Playwright encore ROUGE. Tout le reste (composant Playlist, commandes
  clips/marqueurs/pistes, unitaires) est livré et vert ; il manque : le test e2e « the playlist
  arranges clips and markers by drag and keeps them after reload » vert, puis exécution du runner
  canonique complet (rapport `EDITEUR/test-results/v1-*.json`, success true) et ouverture Phase 9.
  - fait quand: e2e V8 vert sur le runner canonique complet (rapport `v1-*.json` success true) et
    Phase 9 ouverte [EN COURS]
  - réf: `EDITEUR/roadmap_editeur_musical.md` (Phase 8, Phase V8), `frontend/e2e/studio.spec.ts`
    (test rouge ligne ~299), `frontend/src/editor/Playlist.tsx`,
    `frontend/src/editor/clipCommands.ts`

## Contexte chaud
- Test e2e V8 rouge : dernière assertion `nth(1)` attend `left: 6528px` reçoit `6720px`. État DOM
  observé (probe retiré) : drums-1 `left 768px` (8 beats, OK), drums-2 (clip ajouté) `6720px`
  (70 beats) largeur 384px, arp-1 `0px` largeur 768px, arp-2 `768px` largeur 4992px, pad `192px`.
  Le dblclick de découpe se fait à position relative x=768 (8 beats) et le split de l'arp est OK.
  Le clip ajouté part de 60 beats ; le drag ripple du drums (+8) le fait arriver à 70 au lieu de 68.
- Sélecteurs e2e Playlist : utiliser les libellés exacts (`Pattern 3 (piste pad)`,
  `Marqueur groove à 8`) — la strict mode interdit les regex `/piste pad/` (3 éléments : boutons
  ↑/↓ de piste + clip). `toHaveStyle` n'existe plus sous Playwright 1.62 : utiliser `toHaveCSS`.
- Layout Playlist e2e : `scrollIntoViewIfNeeded` scrolle `.playlist__scroll` horizontalement
  (le side sticky z-index 2 de 220 px recouvre alors les clips). Piloter `scrollLeft` explicitement
  (`scrollPlaylist(0)` après chaque reveal, `scrollPlaylist(659)` pour le marqueur groove,
  `scrollPlaylist(400)` avant le drag ripple). Départ du drag sur clip géant : `Math.max(x+120, 500)`
  pour éviter le lane-head (269..489) et le hors-viewport.

## Dernière session (2026-08-06)
# Session du 2026-08-06

## Décisions prises
- Playlist livrée comme composant autonome (`Playlist.tsx`, 19 callbacks câblés au store), drag à
  deltas incrémentés + snap, poignées de resize en vrais boutons accessibles.
- Le drag e2e pilote le défilement horizontal par `scrollLeft` explicite (`scrollPlaylist`) :
  `scrollIntoViewIfNeeded` fait passer le contenu sous le side sticky (z-index 2, 220 px) ou hors
  viewport.

## Livrables produits ou modifiés
- `frontend/src/editor/Playlist.tsx` : Playlist complète (lanes synchronisées au Channel Rack, clips
  draggables/resizables/splittables, marqueurs éditables, pistes ↑/↓, insert/delete time, mute/lock,
  clips chevauchants `is-obscured`, alerte densité 300).
- `frontend/src/editor/Playlist.test.tsx` : 17 tests (drags, split, marqueurs, pistes, overlap) — verts.
- `frontend/src/editor/clipCommands.ts` : `resizeClip` clamp aux bornes ; `clipMute` inutilisée supprimée.
- `frontend/src/editor/editorStore.ts` / `.test.ts` : `EMPTY_SELECTION` inclut `markers` ; corrections imports/const.
- `frontend/src/editor/EditorLanding.tsx` : intégration Playlist (callbacks → store).
- `frontend/src/styles.css` : styles `.playlist*` (side sticky 220 px, lanes, ruler, marqueurs, clips).
- `frontend/e2e/studio.spec.ts` : test V8 drag-and-drop Playwright — ROUGE (dernière assertion nth(1)
  = 6720 px au lieu de 6528 px).

## Hypothèses validées / invalidées
- VALIDE : échecs e2e précédents = strict mode (`/piste pad/` → 3 éléments) et `toHaveStyle` absent
  (Playwright 1.62 → `toHaveCSS`).
- VALIDE : drag sur clip géant échouait quand le départ était hors viewport ou sous le lane-head
  sticky (fix : `scrollPlaylist(400)` + `Math.max(x+120, 500)`).
- INVALIDE : le drag ripple déplace le clip ajouté de +10 au lieu de +8 attendu (6720 px = 70 beats
  au lieu de 68) — non résolu (ripple appelé à chaque pointermove incrémental).

## Prochaine étape exacte
Debugger le test e2e rouge : pourquoi le clip ajouté finit à 70 beats (6720 px) au lieu de 68
(6528 px) ; vérifier la séquence split/dblclick + delta incrémental du ripple ; une fois vert :
`npm run test:e2e` complet + `uv run pytest` + `verify_lignes_reference.py`, puis
`EDITEUR/test_editor.ps1` pour le rapport V8.

## Question bloquante pour la session suivante
Aucune.
