# Roadmap — plugins d'instruments

## Objectif

Développer dans explo des plugins d'instruments originaux, chacun exposant un manifeste de
paramètres et un moteur de synthèse déterministe, testables depuis l'UI globale du projet puis
promus vers le dossier plugins applicatif. Premier plugin : kick.

## Cadre fixé le 2026-07-30

- Le pont UI repose sur un manifeste JSON par plugin ; l'UI globale génère les contrôles
  automatiquement à partir de ce manifeste. Aucune UI n'est codée dans explo.
- Le son est calculé côté Python en rendu offline ; l'UI reçoit un WAV.
- Un plugin est un one-shot déclenchable : `(params, velocity) -> signal`. L'arrangement reste
  hors du plugin.
- explo n'écrit que dans `explo/`. L'endpoint backend, l'écran frontend et la copie vers le
  dossier plugins applicatif sont réalisés par la zone `crea_zik`, sur la base du manifeste
  figé par explo.

## Phase 1 — Contrat de plugin et moteur kick [FAIT]

Zone : explo

- Définir le format de manifeste, générique et valable pour tous les futurs plugins :
  identifiant, version, groupes de paramètres, et par paramètre type, plage, défaut, unité,
  courbe d'affichage.
- Écrire le schéma du manifeste et sa validation.
- Implémenter le moteur kick, un seul chemin de synthèse, couches corps, sub, transitoire et
  bruit :
  - corps : `pitch_start`, `pitch_end`, `pitch_decay`, `pitch_curve`, `body_waveform`,
    `body_decay`, `body_curve`, `phase_start`
  - sub : `sub_enabled`, `sub_freq` en note MIDI, `sub_decay`, `sub_gain`, `sub_drive`
  - transitoire : `click_type`, `click_frequency`, `click_decay`, `click_gain`, `click_highpass`
  - bruit : `noise_gain`, `noise_filter`, `noise_decay`
  - sortie : `drive_amount`, `output_gain`, `pan`, `length`, `target_peak_dbfs`, `seed`
- Livrer trois presets modifiables : `techno`, `808_sub`, `acoustique`.
- Produire un WAV de référence par preset et son empreinte SHA-256.
- Tests : validation du manifeste contre son schéma, déterminisme du rendu, respect des bornes
  de paramètres, absence de clipping et de valeurs non finies, non-régression des trois presets
  contre leurs empreintes.

**⏸ Checkpoint** — Demander à l'utilisateur de faire `/compact` avant de continuer.
Attendre sa réponse écrite. Ne pas commencer la phase suivante sans confirmation.

## Phase 2 — Banc de test dans l'UI globale [FAIT]

Zone : crea_zik

- Exposer un endpoint de rendu prenant un identifiant de plugin, un preset et des paramètres,
  et renvoyant un WAV.
- Découvrir les plugins en cours de développement dans explo à partir de leurs manifestes.
- Générer automatiquement les contrôles de l'UI à partir du manifeste, groupés comme il le
  déclare, avec sélection de preset et réinitialisation.
- Permettre le déclenchement à l'écoute et le téléchargement du rendu.
- Tests : sérialisation des paramètres, rejet des valeurs hors bornes, rendu d'un preset connu
  identique au WAV de référence produit en phase 1.

**⏸ Checkpoint** — Demander à l'utilisateur de faire `/compact` avant de continuer.
Attendre sa réponse écrite. Ne pas commencer la phase suivante sans confirmation.

## Phase 3 — Promotion et intégration au projet [FAIT]

Zone : crea_zik

Procédure de promotion retenue le 2026-07-31 : `backend/src/crea_zik/plugins.py` charge déjà les
plugins directement depuis `EXPLO/plugins/<id>/` (manifeste, presets, moteur), sans copie vers un
dossier applicatif séparé. Dupliquer les fichiers aurait créé un risque de divergence de version
entre explo et crea_zik pour un gain nul. La promotion d'un plugin validé consiste donc à :
1. vérifier que le plugin explo est au vert (tests, empreintes SHA-256 des presets, gate de la
   phase 1 de ce roadmap) ;
2. l'exposer côté piste de composition via les paramètres d'instrument `plugin_id`,
   `plugin_preset` et `plugin_overrides` (opt-in, aucun effet sur les pistes existantes) ;
3. verrouiller la non-régression par test d'équivalence entre le rendu direct
   (`/api/plugins/{id}/render`) et le rendu passant par le moteur de composition.

- [x] Brancher les plugins promus sur le moteur de composition, en remplacement de la voix kick
  codée en dur, pour les pistes `drums` qui déclarent `plugin_id` (`composition_dsp.py`,
  fonction `_plugin_voice`). Les pistes sans `plugin_id` gardent l'ancien kick codé en dur,
  inchangé.
- [x] Rendre le plugin utilisable depuis une composition (`render_composition` /
  `Track.instrument.parameters`).
- [x] Tests (`tests/test_composition_dsp_plugin_voice.py`) : équivalence bit-à-bit entre rendu
  direct et rendu via le moteur de composition, application correcte du gain de composition,
  non-régression de l'ancien kick codé en dur pour les pistes sans `plugin_id`, rejet d'un
  `plugin_id` inconnu, rendu complet d'une composition utilisant le plugin promu.

Limite connue : l'archivage versionné (`EXPLO/archives/`) n'a pas encore été branché sur ce
chemin de promotion — cf. action ouverte P2 dans `_contexte/signals.md` de crea_zik.

**⏸ Checkpoint** — Demander à l'utilisateur de faire `/compact` avant de continuer.
Attendre sa réponse écrite. Ne pas commencer la phase suivante sans confirmation.
