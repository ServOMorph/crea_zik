# Signals — explo   (MAJ 2026-07-30)

## Actions ouvertes
- [P2|ouvert] Préparer l’intégration de l’archive au futur Music Composer.
  fait quand: un arrangement éditable produit une nouvelle version d’archive avec master, stems et QA
  réf: ../archives/README.md, ../archives/archive_piece.py, ../roadmap_archivage_morceaux.md
- [P1|ouvert] Implémenter la phase 1 de la roadmap plugins : schéma de manifeste, moteur kick, presets, tests.
  fait quand: les trois presets (techno, 808_sub, acoustique) rendent un WAV déterministe validé par tests
  réf: ../roadmap_plugins.md

## Dernière session (2026-07-30)
<!-- Écrasé intégralement par /close. Synthèse < 25 lignes. -->
# Session du 2026-07-30

## Décisions prises
- Premier plugin explo : kick, avec manifeste JSON générique comme contrat entre explo et crea_zik.
- Promotion des plugins validés faite par la zone crea_zik, jamais par explo (invariant de périmètre).
- Trois presets figés pour le kick : techno, 808_sub, acoustique, tous paramètres éditables, couche sub dédiée.

## Livrables produits ou modifiés
- `roadmap_plugins.md` : créé. Phase 1 (contrat de manifeste + moteur kick) en cours.

## Hypothèses validées / invalidées
- VALIDE : le manifeste JSON comme contrat UI/moteur respecte l’invariant d’écriture d’explo.
- EN ATTENTE : implémentation du schéma de manifeste et du moteur kick (phase 1 non commencée).

## Prochaine étape exacte
Lancer la phase 1 : schéma de manifeste, moteur kick, trois presets et leurs tests.

## Question bloquante pour la session suivante
Aucune.
