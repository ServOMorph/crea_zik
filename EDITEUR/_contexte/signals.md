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
- [P1|ouvert] Implémenter l'étape 12.1 (true peak + LUFS) de la Phase 12 : ces deux métriques sont
  absentes du dépôt (backend et frontend), à ajouter dans `audio_info.py` puis brancher sur
  `evaluate_wav`/`qa.py`.
  - fait quand: true peak et LUFS calculés et testés sur signaux verrouillés (sinus, silence, plein
    niveau, inter-sample peak connu)
  - réf: `EDITEUR/roadmap_editeur_musical.md` (Phase 12, étape 12.1), `backend/src/crea_zik/audio_info.py`
- [P1|ouvert] Poursuivre les étapes 12.2 à 12.7 de la Phase 12 (modèle de rendu étendu/manifeste
  enrichi, comparaison rendu périmé, gate de promotion master, écran « Analyse & Export »,
  téléchargement/bundle, non-régression et clarification du comportement rendu concurrent) une fois
  12.1 close.
  - fait quand: Phase 12 fonctionnelle livrée et qualification V12 close (runner canonique vert)
  - réf: `EDITEUR/roadmap_editeur_musical.md` (Phase 12, Phase V12)

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
  `mixerRouting.ts`) suit désormais à la fois `output` ET `sends` (étendue cette session, un cycle
  pouvait auparavant se former par une combinaison des deux non détectée). Tout nouveau champ de
  routage doit être ajouté aux deux implémentations en parallèle.

## Dernière session
# Session du 2026-08-06

## Décisions prises
- Phase 12 (Rendu final, QA et export) ouverte. Après audit de l'existant, découpage en sept étapes
  séquentielles (12.1 à 12.7 : métriques manquantes, modèle/manifeste étendu, rendu périmé, gate
  promotion master, écran Analyse & Export, téléchargement/bundle, non-régression) documentées
  directement dans la roadmap.

## Livrables produits ou modifiés
- `EDITEUR/roadmap_editeur_musical.md` : section Phase 12 restructurée avec constat de session et
  tâches réordonnées en 7 étapes séquentielles (statut phase inchangé, [TODO]).

## Hypothèses validées / invalidées
- VALIDE : le moteur de rendu (`render_composition`), l'écriture WAV float32/PCM24
  (`composition_dsp.py::write_wav`), les jobs avec progression/annulation (`jobs.py`) et les
  métriques peak/RMS/DC/clipping (`audio_info.py::wav_info`) existent déjà et sont réutilisables.
- INVALIDE : aucune trace de true peak ni de LUFS dans le dépôt (ni backend ni frontend) — à
  implémenter en premier (étape 12.1), les étapes suivantes en dépendant partiellement.
- EN ATTENTE : confirmer avec l'utilisateur le comportement attendu pour les rendus simultanés avant
  d'écrire un test de « concurrence » — l'executor de jobs actuel n'a qu'un seul worker
  (`ThreadPoolExecutor(max_workers=1)`), donc les rendus sont aujourd'hui sériés, pas parallèles.

## Prochaine étape exacte
Démarrer l'étape 12.1 : implémenter true peak (suréchantillonnage) et LUFS (BS.1770) dans
`backend/src/crea_zik/audio_info.py`, les brancher sur `evaluate_wav`/`qa.py`, puis tester sur des
signaux verrouillés.

## Question bloquante pour la session suivante
Aucune.
