# Signals — crea_zik (MAJ 2026-07-31)

## Actions ouvertes
- [P2|ouvert] Intégrer l'archivage versionné au futur Music Composer.
  fait quand: l'éditeur produit un descripteur puis archive une version, ses stems et son rapport QA
  réf: EXPLO/archives/README.md, EXPLO/archives/archive_piece.py, roadmap_studio_audio_procedural.md
- [P2|ouvert] Auditer les phases 3 à 6 de `roadmap_studio_audio_procedural.md` (non réauditées) avant
  d'y reprendre du travail — même logique que l'audit fait sur la phase 2 le 2026-07-31.
  fait quand: chaque case des phases 3 à 6 est confirmée cochée/décochée après lecture effective du code
  réf: roadmap_studio_audio_procedural.md
- [P3|ouvert] Écoute subjective au casque du banc de test plugins par un humain.
  fait quand: un humain a écouté le rendu du plugin kick dans l'UI et confirme la qualité perçue
  réf: frontend/src/plugins/PluginBench.tsx, tests_manuels.md

## Dernière session (2026-07-31)

# Session du 2026-07-31

## Décisions prises
- Phase 2 de `roadmap_studio_audio_procedural.md` réauditée et close [FAIT] : le code réel dépasse
  largement la description initiale (API FastAPI complète, éditeur multipiste dans la zone EDITEUR,
  système de plugins). Reprise directe malgré l'écart, pas de réécriture complète du roadmap.
- Validation du banc de test plugins effectuée par pilotage automatisé d'un Chromium réel (aucun
  outil navigateur natif disponible pour l'agent) : sélection plugin/preset, ajustement d'un
  paramètre, rendu, téléchargement, intégrité du WAV vérifiée par analyse programmatique.
- Promotion du plugin kick (phase 3 de `EXPLO/roadmap_plugins.md`) : branchement sur le moteur de
  composition via des paramètres d'instrument opt-in (`plugin_id`, `plugin_preset`,
  `plugin_overrides`), sans copie de fichiers vers un dossier plugins applicatif séparé.

## Livrables produits ou modifiés
- `roadmap_studio_audio_procedural.md` : phase 2 réauditée, toutes les cases corrigées, marquée [FAIT].
- `tests_manuels.md` : section « Banc de test plugins » validée et supprimée.
- `backend/src/crea_zik/composition_dsp.py` : ajout de `_plugin_voice`, branchement opt-in du kick
  promu sur la voie `drums`, ancien kick codé en dur inchangé par défaut.
- `tests/test_composition_dsp_plugin_voice.py` : créé, 5 tests (équivalence bit-à-bit, gain de
  composition, non-régression du kick codé en dur, rejet d'un plugin_id inconnu, rendu de
  composition complet avec le plugin promu).
- `EXPLO/roadmap_plugins.md` : phase 3 marquée [FAIT], procédure de promotion documentée.
- `_contexte/archive_decisions.md` : créé, décisions structurantes antérieures au 2026-07-28 archivées.

## Hypothèses validées / invalidées
- VALIDE : le rendu du plugin kick via le moteur de composition est bit-identique au rendu direct
  via `/api/plugins/{id}/render` pour les mêmes paramètres (test automatisé).
- VALIDE : le WAV produit par le banc de test dans un Chromium réel est un signal stéréo 48 kHz/24
  bits valide (durée 2 s, pic 0.595, pas d'écrêtage, signal non silencieux) — vérifié par décodage
  et analyse programmatique, pas par écoute humaine.
- EN ATTENTE : écoute subjective au casque du banc de test plugins par un humain.
- EN ATTENTE : audit détaillé des phases 3 à 6 de `roadmap_studio_audio_procedural.md`.

## Prochaine étape exacte
Auditer la phase 3 de `roadmap_studio_audio_procedural.md` avant d'y reprendre du travail, ou
traiter l'action P2 ouverte sur l'archivage versionné du Music Composer.

## Question bloquante pour la session suivante
Aucune.
