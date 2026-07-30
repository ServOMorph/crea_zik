# Signals — explo   (MAJ 2026-07-30)

## Actions ouvertes
- [P1|ouvert] Préparer l’intégration de l’archive au futur Music Composer.
  fait quand: un arrangement éditable produit une nouvelle version d’archive avec master, stems et QA
  réf: ../archives/README.md, ../archives/archive_piece.py, ../roadmap_archivage_morceaux.md

## Dernière session (2026-07-30)
<!-- Écrasé intégralement par /close. Synthèse < 25 lignes. -->
# Session du 2026-07-30

## Décisions prises
- Une archive adressée par SHA-256 conserve toute version d’un morceau sans écrasement.
- L’inspiration est documentée comme caractéristiques générales, sans reproduction identifiable.

## Livrables produits ou modifiés
- `morceau_electro/` : composition, master WAV, cinq stems, QA, source et fiche de création.
- `archives/` : catalogue, manifeste v001, script d’archivage, schéma et tests.

## Hypothèses validées / invalidées
- VALIDE : le rendu est déterministe, dure 30 s et sort en WAV PCM 24 bits à 48 kHz.
- VALIDE : l’archive déduplique les blobs et détecte une corruption simulée.
- EN ATTENTE : l’écoute humaine de la qualité artistique.

## Prochaine étape exacte
Modéliser l’arrangement par événements versionnés avant de construire l’éditeur.
Faire archiver chaque nouvelle version par `archives/archive_piece.py`.

## Question bloquante pour la session suivante
Aucune.
