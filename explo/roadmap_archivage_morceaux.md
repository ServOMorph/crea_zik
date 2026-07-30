# Roadmap — archivage des morceaux

## Objectif

Conserver chaque version d'un morceau avec ses sources, rendus, stems, contrôles, intentions,
explications techniques et empreintes d'intégrité, puis exploiter ces archives dans le futur éditeur.

## Phase 1 — Socle d'archivage et premier morceau [FAIT]

- Créer un stockage immuable adressé par SHA-256.
- Définir le descripteur d'archive et son schéma.
- Générer un catalogue et un manifeste par version.
- Documenter pédagogiquement la création de « Lignes de nuit ».
- Archiver les sources, le master, les stems et le rapport QA de la version `v001`.
- Tester la création, le refus d'écrasement, la déduplication et la détection de corruption.

**⏸ Checkpoint** — Demander à l'utilisateur de faire `/compact` avant de continuer.

## Phase 2 — Intégration au futur éditeur [TODO]

- Faire du manifeste d'archive un contrat du domaine applicatif.
- Ajouter depuis l'éditeur les actions « Archiver une version » et « Comparer ».
- Présenter les différences de spec, code, son, QA et intention entre deux versions.

**⏸ Checkpoint** — Demander à l'utilisateur de faire `/compact` avant de continuer.
