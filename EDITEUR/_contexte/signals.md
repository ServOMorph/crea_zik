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
- [P1|ouvert] Poursuivre les étapes 12.2 à 12.7 de la Phase 12 (modèle de rendu étendu/manifeste
  enrichi, comparaison rendu périmé, gate de promotion master, écran « Analyse & Export »,
  téléchargement/bundle, non-régression et clarification du comportement rendu concurrent) en commençant par 12.2.
  - fait quand: Étape 12.2 close (modèle de rendu étendu et manifeste enrichi fonctionnels et testés).
  - réf: `EDITEUR/roadmap_editeur_musical.md` (Phase 12, étape 12.2), `backend/src/crea_zik/jobs.py`

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
- Choix pragmatiques d'analyse : suréchantillonnage 4x (ou 2x pour fs >= 96 kHz) avec resample_poly pour le True Peak, et K-weighting IIR précis dynamique (filtre haute-étagère + passe-haut) avec double-gating (-70 LUFS et -10 dB) pour le calcul de LUFS.
- Adaptation des seuils d'issues QA : clipping à true_peak >= 1.0 (0 dBTP), et loudness excessif/insuffisant selon le profil (musique : -10 à -26 LUFS ; sfx : -6 à -45 LUFS).

## Livrables produits ou modifiés
- `backend/src/crea_zik/audio_info.py` : calcul de true_peak et lufs.
- `backend/src/crea_zik/qa.py` : intégration dans evaluate_wav et issues.
- `tests/test_audio_info.py` : tests unitaires sur silence, sinus pur et ISP.

## Hypothèses validées / invalidées
- VALIDE : resample_poly de scipy permet une détection robuste des inter-sample peaks sur les signaux à la fréquence de Nyquist (ex: motif [0.707, 0.707, -0.707, -0.707] monte bien à 1.0 en True Peak).
- VALIDE : Les coefficients biquad IIR de K-weighting calculés dynamiquement assurent la conformité BS.1770 sur toutes les fréquences cibles.

## Prochaine étape exacte
Entamer l'étape 12.2 : étendre le modèle de rendu (boucles et sélection) et enrichir le manifeste (seed, versions, spec_hash, rapport QA).

## Question bloquante pour la session suivante
Aucune.
