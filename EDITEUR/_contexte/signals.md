# Signals — editeur (MAJ 2026-08-07)

## Actions ouvertes
Aucune

## Actions closes récentes
- [P2|FAIT] Test e2e Playwright « the editor transport plays, pauses, stops and reaches media end » :
  correction du `AudioContext` suspendu en environnement local. Ajout de `context.resume()` explicite
  avant et après `decodeAudioData` dans `TransportBar.tsx` pour garantir que le contexte audio est actif.
  - fait le: 2026-08-07
  - réf: `frontend/e2e/studio.spec.ts:312`, `frontend/src/editor/TransportBar.tsx`
- [P1|FAIT] Étape 12.7 de la Phase 12 close : non-régression formats/durées/métadonnées/hashes/
  annulation validée. Comportement rendu sérié acté (1 worker, file séquentielle) — clarification
  utilisateur : les rendus sont toujours traités un par un, les autres en attente.
  - fait le: 2026-08-06
  - réf: `EDITEUR/roadmap_editeur_musical.md` (Phase 12, étape 12.7), `backend/src/crea_zik/jobs.py`
- [P2|FAIT] Intégration visuelle des automations : décision actée d'assumer définitivement
  le panneau dédié `Automations.tsx` sous la Playlist plutôt que des lanes dans la timeline.
  Justification : déjà implémenté et testé (21 tests unitaires), moins risqué pour la Phase 13,
  architecture modulaire préservée. L'écart par rapport à l'intention initiale (lanes dans Playlist)
  est documenté comme décision structurante.
  - fait le: 2026-08-06
  - réf: `frontend/src/editor/Automations.tsx`, `frontend/src/editor/Playlist.tsx`, `EDITEUR/_contexte/contexte.md`
- [P2|FAIT] Scope `master` des cibles d'automation : décision actée de retirer le scope du
  schéma de validation. Le regex `AutomationLane.target` a été modifié de `^(track|master)` à `^track`
  et une validation explicite a été ajoutée pour rejeter les cibles `master.*`. Aucune lane existante
  n'utilisait ce scope (vérifié dans le codebase).
  - fait le: 2026-08-06
  - réf: `backend/src/crea_zik/models.py` (AutomationLane.target, validation), commit 147be4f

## Contexte chaud
- `mixer_channels` reste vide par défaut pour `Lignes de nuit` (aucun canal par piste tant qu'aucune
  action mixer explicite n'a été effectuée) : toute piste/bus sans canal est traitée avec
  gain=1/pan=0/output=master directement au rendu (`render_composition`, `compositions.py`). Tout
  futur test ou développement sur le mixer doit compter avec cet état vide par défaut.
- Sémantique pré/post-fader (`RenderSettings.stem_fader`) définie pragmatiquement : `"pre"` = buffer
  sec avant la chaîne d'effets d'insertion du canal, mais le gain/pan de piste reste inclus (déjà
  appliqué lors de la synthèse par événement, non séparable sans réécrire `_render_event`) — ne pas
  confondre avec la convention DAW stricte « avant fader ».
- La détection de cycle du mixer (`_has_mixer_cycle` backend, `hasMixerCycle` frontend
  `mixerRouting.ts`) suit désormais à la fois `output` ET `sends`. Tout nouveau champ de routage doit
  être ajouté aux deux implémentations en parallèle.
- Le bouton d'annulation d'un rendu dans l'écran « Rendu & Export » est nommé « Annuler le rendu »
  (pas « Annuler ») pour ne pas entrer en collision avec le bouton Undo global de l'éditeur, lui-même
  nommé « Annuler ». Tout nouveau contrôle d'annulation dans l'éditeur doit suivre cette convention.
- **Rendus simultanés** : Toujours traités en **file sériée** (1 worker, séquentiel). Les demandes multiples sont mises en attente et exécutées dans l'ordre. Aucun parallélisme prévu.

## Dernière session
# Session du 2026-08-08

## Décisions prises
- Comportement rendu sérié acté : les rendus sont traités un par un (1 worker, file séquentielle). L'executor actuel est validé comme solution définitive.
- **Intégration visuelle des automations** : Décision structurante d'assumer définitivement le panneau dédié `Automations.tsx` plutôt que des lanes dans la timeline `Playlist.tsx`. Justification : implémentation déjà complète et testée, alignement avec l'architecture modulaire, réduction des risques pour la Phase 13.
- **Scope `master` des automations** : Décision structurante de retirer le scope `master` du schéma de validation (`AutomationLane.target`). Le scope était accepté par Pydantic mais jamais implémenté dans le moteur de rendu. Aucune lane existante n'utilisait ce scope.
- **Tests résistants aux mutations** : Remplacement systématique de `.toHaveLength(0)` par `.toEqual([])` pour les stacks d'historique (`undoStack`, `redoStack`) afin de tuer les mutants Stryker.

## Livrables produits ou modifiés
- `EDITEUR/_contexte/signals.md` : question bloquante résolue, étape 12.7 et Phase 12 closes [FAIT]. P2#1 et P2#2 résolues.
- `EDITEUR/_contexte/contexte.md` : état actuel mis à jour (Phases 9-12 closes), décisions structurantes ajoutées (panneau Automations dédié, retrait scope master).
- `EDITEUR/roadmap_editeur_musical.md` : étape 12.7 et Phase 12 marquées [FAIT].
- `backend/src/crea_zik/jobs.py` : commentaire ajouté pour documenter `max_workers=1`, méthode `list_jobs()` ajoutée.
- `backend/src/crea_zik/api.py` : endpoint `/api/jobs` ajouté pour lister tous les jobs.
- `backend/src/crea_zik/models.py` : scope `master` retiré du regex `AutomationLane.target`, validation explicite ajoutée pour rejeter les cibles `master.*`.
- `frontend/src/editor/RenderAnalysis.tsx` : UI mise à jour pour afficher le nombre de jobs en attente + correction des types TypeScript pour supporter les issues QA structurées.
- `frontend/src/editor/TransportBar.tsx` : correction du `AudioContext` suspendu en local (ajout de `resume()` explicite avant/après `decodeAudioData`).
- `frontend/src/editor/editorStore.test.ts` : correction des tests pour résister aux mutations Stryker (lignes 73-78).
- `frontend/src/editor/stepSequencer.test.ts` : correction du test de propriété fast-check pour résister aux mutations Stryker (ligne 289).
- `frontend/e2e/studio.spec.ts` : correction du regex invalide à la ligne 567 (`/-/editor` → `\/editor`).
- `frontend/eslint.config.js` : ajout de `.stryker-tmp` dans les ignores pour exclure les fichiers générés.
- `frontend/vitest.config.ts` : ajout de `.stryker-tmp/**` dans les excludes de couverture.
- `tests/test_jobs.py` : test pour `list_jobs()` ajouté.
- `tests/test_api.py` : test pour `/api/jobs` ajouté.

## Hypothèses validées / invalidées
- VALIDE : Le comportement sérié (1 worker) est suffisant pour les besoins utilisateur (décision actée).
- VALIDE : L'UI peut afficher le nombre de jobs en attente via `/api/jobs`.
- VALIDE : Le panneau dédié `Automations.tsx` est une solution d'intégration visuelle acceptable (décision structurante).
- VALIDE : Le scope `master` n'est pas nécessaire pour les automations (aucune utilisation dans le codebase, retrait validé).
- VALIDE : Le test e2e "the editor transport plays, pauses, stops and reaches media end" échouait en local à cause du `AudioContext` suspendu. La correction par `resume()` explicite résout le problème.
- VALIDE : Les tests utilisant `.toEqual([])` tuent les mutants Stryker là où `.toHaveLength(0)` échouait.

## Prochaine étape exacte
Entamer la Phase 13 (Durcissement, accessibilité et livraison). Vérifier que la gate frontend-mutation passe avec les corrections appliquées.

## Question bloquante pour la session suivante
Aucune.

## Décisions récentes
- 2026-08-06 : Comportement des rendus simultanés acté comme **file sériée** (1 rendu à la fois, les autres en attente).
  L'executor actuel (1 worker) est validé comme solution définitive. Aucun développement de parallélisme prévu.
- 2026-08-06 : **Intégration visuelle des automations** : panneau dédié `Automations.tsx` **assumé définitivement** comme solution.
- 2026-08-06 : **Scope `master` des automations** : scope **retiré du schéma de validation** (jamais implémenté dans le rendu).