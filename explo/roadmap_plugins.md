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

## Phase 2 — Banc de test dans l'UI globale [EN COURS]

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

## Phase 3 — Promotion et intégration au projet [TODO]

Zone : crea_zik

- Définir la procédure de promotion d'un plugin validé d'explo vers le dossier plugins
  applicatif, avec sa version et ses empreintes.
- Brancher les plugins promus sur le moteur de composition, en remplacement des voix codées en
  dur dans le renderer.
- Rendre le plugin utilisable depuis une spec de morceau et l'archivage existant.
- Tests : équivalence du rendu avant et après promotion, rendu d'un morceau utilisant le
  plugin promu.

**⏸ Checkpoint** — Demander à l'utilisateur de faire `/compact` avant de continuer.
Attendre sa réponse écrite. Ne pas commencer la phase suivante sans confirmation.
