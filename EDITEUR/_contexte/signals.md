# Signals — editeur (MAJ 2026-08-06)

## Actions ouvertes
- [P2|ouvert] Réévaluer l'intégration visuelle des automations : elles vivent dans un panneau
  `Automations.tsx` dédié sous la Playlist plutôt que comme lanes dans la timeline `Playlist.tsx`
  comme envisagé initialement. Décider si cet écart est assumé définitivement ou si les lanes
  doivent être déplacées dans la Playlist.
  - fait quand: décision actée et documentée (assumée ou lanes déplacées dans `Playlist.tsx`)
  - réf: `frontend/src/editor/Automations.tsx`, `frontend/src/editor/Playlist.tsx`
- [P2|ouvert] Le scope `master` des cibles d'automation est accepté par la validation Pydantic
  (`AutomationLane.target`) mais jamais appliqué par le moteur de rendu (`compositions.py` n'applique
  que le scope `track`). Décider si c'est un gap backend à combler ou un scope à retirer du schéma.
  - fait quand: le scope `master` est soit appliqué au rendu, soit retiré du pattern de validation
  - réf: `backend/src/crea_zik/models.py` (AutomationLane.target), `backend/src/crea_zik/compositions.py`
- [P1|ouvert] Terminer l'étape 12.7 de la Phase 12 (non-régression formats/durées/métadonnées/hashes/
  annulation, et clarification avec l'utilisateur du comportement attendu pour plusieurs rendus
  simultanés — l'executor de rendu est aujourd'hui à un seul worker, donc les rendus sont sériés, pas
  parallèles réels).
  - fait quand: Étape 12.7 close (fonctionnelle et testée), Phase 12 entièrement close.
  - réf: `EDITEUR/roadmap_editeur_musical.md` (Phase 12, étape 12.7), `backend/src/crea_zik/jobs.py`
- [P2|ouvert] Test e2e Playwright « the editor transport plays, pauses, stops and reaches media end »
  rouge en environnement local, indépendamment de toute modification récente (confirmé par
  `git stash` : échoue aussi hors des changements de cette session). Non investigué plus avant.
  - fait quand: cause identifiée et test de nouveau vert, ou limite documentée si liée à
    l'environnement local (Web Audio réel en CI/local).
  - réf: `frontend/e2e/studio.spec.ts:312`, `frontend/src/editor/TransportBar.tsx`

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
# Session du 2026-08-06

## Décisions prises
- Comportement rendu sérié acté : les rendus sont traités un par un (1 worker, file séquentielle). L'executor actuel est validé comme solution définitive.

## Livrables produits ou modifiés
- `EDITEUR/_contexte/signals.md` : question bloquante résolue, étape 12.7 et Phase 12 closes [FAIT].
- `EDITEUR/_contexte/contexte.md` : état actuel mis à jour (Phases 9-12 closes), décision structurante ajoutée.
- `EDITEUR/roadmap_editeur_musical.md` : étape 12.7 et Phase 12 marquées [FAIT].
- `backend/src/crea_zik/jobs.py` : commentaire ajouté pour documenter `max_workers=1`, méthode `list_jobs()` ajoutée.
- `backend/src/crea_zik/api.py` : endpoint `/api/jobs` ajouté pour lister tous les jobs.
- `frontend/src/editor/RenderAnalysis.tsx` : UI mise à jour pour afficher le nombre de jobs en attente.
- `tests/test_jobs.py` : test pour `list_jobs()` ajouté.
- `tests/test_api.py` : test pour `/api/jobs` ajouté.

## Hypothèses validées / invalidées
- VALIDE : Le comportement sérié (1 worker) est suffisant pour les besoins utilisateur (décision actée).
- VALIDE : L'UI peut afficher le nombre de jobs en attente via `/api/jobs`.

## Prochaine étape exacte
Entamer la Phase 13 (Durcissement, accessibilité et livraison).

## Question bloquante pour la session suivante
Aucune

## Décisions récentes
- 2026-08-06 : Comportement des rendus simultanés acté comme **file sériée** (1 rendu à la fois, les autres en attente).
  L'executor actuel (1 worker) est validé comme solution définitive. Aucun développement de parallélisme prévu.
