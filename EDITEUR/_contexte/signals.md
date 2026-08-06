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

## Dernière session
# Session du 2026-08-06

## Décisions prises
- Étape 12.5 (écran « Analyse & Export ») complétée après vérification : une première version livrée
  par un agent tiers (opencode, tombé en panne de crédits en tentant `/close`) passait ses tests mais
  restait partielle au regard du gate de la roadmap — complétée plutôt que clôturée telle quelle.
- Portée du rendu limitée à morceau entier / boucle (plage de temps) / sélection de clips courante /
  pistes choisies, sans plomberie d'état supplémentaire (pas de concept de « boucle » partagé au-delà
  de ce qu'expose déjà l'API `loop`/`start_beat`/`end_beat`).

## Livrables produits ou modifiés
- `frontend/src/editor/RenderAnalysis.tsx` : réécrit (portée, format, sauvegarde préalable
  obligatoire, polling réel, annulation, reprise, waveform, métriques QA nommées, badge périmé/à jour).
- `frontend/src/editor/editorStore.ts` : commande `setRenderFormat`.
- `frontend/src/editor/EditorLanding.tsx` : intégration des nouvelles props.
- `frontend/src/editor/RenderAnalysis.test.tsx` : réécrit, 23 tests.
- `frontend/e2e/studio.spec.ts` : nouveau parcours Playwright « Rendu & Export ».
- `backend/src/crea_zik/api.py` : `qa_url` ajouté au modèle `RenderInfo` (bug réel, voir ci-dessous).
- `tests/test_api.py` : assertions `qa_url`.
- `EDITEUR/roadmap_editeur_musical.md` : étape 12.5 marquée [FAIT] avec détail vérifié.
- Fichier `Continue` (vide, non suivi, artefact accidentel) : supprimé.

## Hypothèses validées / invalidées
- INVALIDE : la version de 12.5 livrée par l'agent tiers était complète malgré des tests verts ->
  gate non satisfait (pas de portée/format/annulation/polling réel, pas d'état périmé affiché, aucun
  test Playwright) -> complétée cette session.
- VALIDE : le parcours Playwright est un filet de sécurité réel, pas redondant avec Vitest — il a
  détecté que `GET .../renders` n'exposait jamais `qa_url` côté backend, un bug masqué depuis l'étape
  12.3 par des tests unitaires qui fabriquaient ce champ dans leurs stubs.

## Prochaine étape exacte
Entamer l'étape 12.7 : non-régression (formats, durées, métadonnées, hashes, annulation) et
clarifier avec l'utilisateur le comportement attendu pour plusieurs rendus simultanés avant d'écrire
un test de « concurrence » (l'executor de rendu est à un seul worker aujourd'hui : file sériée).

## Question bloquante pour la session suivante
Comportement attendu pour plusieurs rendus simultanés (étape 12.7) : accepter la file sériée actuelle
comme comportement définitif, ou faire évoluer l'executor vers un parallélisme réel ?
