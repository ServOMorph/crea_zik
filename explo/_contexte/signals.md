# Signals — explo   (MAJ 2026-08-01)

## Actions ouvertes
- [P1|ouvert] Brancher le plugin kick (avec ses réglages de punch) sur le morceau démo
  `morceau_electro`, en remplacement du kick codé en dur dans `render.py`.
  fait quand: `morceau_electro/render.py` appelle `plugins/kick/engine.py` (via manifeste +
  preset) pour la voix kick au lieu de la fonction `kick()` codée en dur ; rendu, stems,
  QA et non-régression (test_render.py) revalidés.
  réf: morceau_electro/render.py, morceau_electro/spec.json, plugins/kick/engine.py,
  plugins/kick/presets.json
- [P2|ouvert] Trois réglages de punch du kick différés (phase 5 de roadmap_plugins.md) :
  duck du corps/sub sur l'attaque, transitoire dédié sur le sub, saturation par couche
  (sub/corps séparés au lieu d'un drive global post-mix).
  fait quand: chaque réglage est implémenté, testé (non-régression + vérification
  spectrale ou écoute) et documenté dans roadmap_plugins.md
  réf: ../roadmap_plugins.md, plugins/kick/engine.py
- [P2|ouvert] Préparer l’intégration de l’archive au futur Music Composer.
  fait quand: un arrangement éditable produit une nouvelle version d’archive avec master, stems et QA
  réf: ../archives/README.md, ../archives/archive_piece.py, ../roadmap_archivage_morceaux.md
  note 2026-07-31: le chemin de promotion des plugins (`plugin_id`/`plugin_preset`/`plugin_overrides`
  dans `Track.instrument.parameters`) n’est pas encore branché sur l’archivage versionné. Un morceau
  utilisant un plugin promu n’archive donc pas la version du plugin ni ses empreintes.

## Actions fermées
- [P1|fermé 2026-07-31] Phase 2 de la roadmap plugins (banc de test UI) côté crea_zik.
  Résolue : phases 2 et 3 de `../roadmap_plugins.md` livrées par crea_zik. Endpoints `/api/plugins`,
  écran de banc de test à contrôles générés depuis le manifeste, et promotion du kick sur le moteur
  de composition (`backend/src/crea_zik/composition_dsp.py`, `_plugin_voice`) avec équivalence
  bit-à-bit vérifiée contre le rendu direct.

## Dernière session (2026-08-01)
<!-- Écrasé intégralement par /close. Synthèse < 25 lignes. -->
# Session du 2026-08-01

## Décisions prises
- Socle commun des moteurs de plugins validé : logique générique (validation, primitives DSP,
  étage de sortie) extraite dans `plugins/_common/dsp.py` ; les couches de synthèse restent
  propres à chaque plugin, pas de modèle de « couche » mutualisé.
- Amélioration du kick : filtre de présence (bandpass) sur le click et enveloppe de hauteur sur
  le sub, choisis parmi 5 réglages proposés ; 3 réglages restants différés en phase 5.
- Branchement du kick amélioré sur le morceau démo `morceau_electro` reporté à la session suivante.

## Livrables produits ou modifiés
- `plugins/_common/dsp.py`, `test_dsp.py` : créés (validation, drive, highpass, bandpass, stereo,
  finalize_output), 20 tests verts.
- `plugins/kick/engine.py` : refactorisé sur le socle commun, `click_layer` en bandpass,
  `sub_layer` avec sweep de hauteur (`swept_phase` partagé avec `body_layer`).
- `plugins/kick/manifest.json`, `presets.json` : `click_highpass` remplacé par `click_bandwidth`,
  ajout `sub_pitch_start_semitones`/`sub_pitch_decay`.
- `plugins/kick/references/*.wav`, `references.json` : régénérés, nouvelles empreintes SHA-256
  (changement de son intentionnel).
- `plugins/README.md`, `roadmap_plugins.md` (phases 4 et 5) : documentés.

## Hypothèses validées / invalidées
- VALIDE : le socle commun ne régresse rien (45 tests verts : kick, socle commun, backend crea_zik).
- VALIDE : le bandpass sur le click améliore mesurablement la présence spectrale de l'attaque
  (preset techno : bande 200Hz-2kHz de 16% à 33%, bruit diffus >2kHz de 9% à 1,4%).
- EN ATTENTE : effet du sweep de pitch sub non vérifiable par analyse spectrale (reste sous 200Hz) ;
  à valider à l'écoute.

## Prochaine étape exacte
Brancher le plugin kick amélioré sur `morceau_electro/render.py` (remplacement du kick codé en
dur), puis traiter les 3 réglages de punch différés (phase 5 de `roadmap_plugins.md`).

## Question bloquante pour la session suivante
Aucune.
