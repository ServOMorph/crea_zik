# Signals — explo   (MAJ 2026-07-30)

## Actions ouvertes
- [P2|ouvert] Préparer l’intégration de l’archive au futur Music Composer.
  fait quand: un arrangement éditable produit une nouvelle version d’archive avec master, stems et QA
  réf: ../archives/README.md, ../archives/archive_piece.py, ../roadmap_archivage_morceaux.md
- [P1|ouvert] Phase 2 de la roadmap plugins (banc de test UI) à lancer côté zone crea_zik, sur la base
  du manifeste et du moteur kick figés par explo en phase 1.
  fait quand: un endpoint crea_zik rend un WAV depuis manifeste + preset, contrôles UI générés, tests verts
  réf: ../roadmap_plugins.md, plugins/kick/manifest.json, plugins/kick/engine.py

## Dernière session (2026-07-30)
<!-- Écrasé intégralement par /close. Synthèse < 25 lignes. -->
# Session du 2026-07-30

## Décisions prises
- Premier plugin explo : kick, avec manifeste JSON générique comme contrat entre explo et crea_zik.
- Promotion des plugins validés faite par la zone crea_zik, jamais par explo (invariant de périmètre).
- Trois presets figés pour le kick : techno, 808_sub, acoustique, tous paramètres éditables, couche sub dédiée.

## Livrables produits ou modifiés
- `plugins/schema/plugin_manifest.schema.json` : créé, schéma générique de manifeste.
- `plugins/kick/manifest.json`, `presets.json`, `engine.py`, `render_presets.py` : créés.
- `plugins/kick/references/{techno,808_sub,acoustique}.wav` + `references.json` : créés, empreintes SHA-256.
- `plugins/kick/test_kick.py` : créé, 11 tests (schéma, bornes, déterminisme, non-clipping, non-régression), tous verts.
- `plugins/README.md` : créé, documentation de la structure générique d'un plugin.

## Hypothèses validées / invalidées
- VALIDE : le manifeste JSON comme contrat UI/moteur respecte l’invariant d’écriture d’explo.
- VALIDE : un seul chemin de synthèse (corps/sub/transitoire/bruit) suffit aux trois presets sans divergence de code.

## Prochaine étape exacte
Phase 2 (banc de test UI, endpoint de rendu, découverte des manifestes) à démarrer côté zone crea_zik.

## Question bloquante pour la session suivante
Aucune.
