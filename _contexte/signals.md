# Signals — crea_zik (MAJ 2026-07-30)

## Actions ouvertes
- [P1|ouvert] Clore le gate de phase 1 sur le rendu déterministe Csound.
  fait quand: trois rendus Csound successifs d’une même spec produisent le même hash de sortie
  réf: roadmap_studio_audio_procedural.md, backend/src/crea_zik/engine.py, backend/src/crea_zik/provenance.py
- [P2|ouvert] Intégrer l’archivage versionné au futur Music Composer.
  fait quand: l’éditeur produit un descripteur puis archive une version, ses stems et son rapport QA
  réf: explo/archives/README.md, explo/archives/archive_piece.py, roadmap_studio_audio_procedural.md

## Dernière session (2026-07-30)
# Session du 2026-07-30

## Décisions prises
- Les explorations musicales utilisent une archive versionnée, adressée par SHA-256 et dédupliquée.
- Le premier morceau de référence est une composition électro instrumentale originale de 30 secondes.

## Livrables produits ou modifiés
- `explo/morceau_electro/` : renderer, spec, master WAV, cinq stems, QA et fiche de création.
- `explo/archives/` : catalogue, manifeste v001, archivage SHA-256, contrôle d’intégrité et tests.

## Hypothèses validées / invalidées
- VALIDE : deux rendus successifs du morceau produisent le même SHA-256 ; durée de 30 s et WAV PCM 24 bits à 48 kHz.
- VALIDE : l’archive refuse l’écrasement, déduplique les blobs identiques et détecte une corruption simulée.
- EN ATTENTE : la répétabilité du rendu Csound réel reste à mesurer sur trois rendus.

## Prochaine étape exacte
Rendre trois fois la même spec avec Csound et comparer les hashes de sortie.
Lors de la phase Music Composer, remplacer l’arrangement codé de l’exploration par des événements versionnés puis appeler l’archive.

## Question bloquante pour la session suivante
Aucune.
