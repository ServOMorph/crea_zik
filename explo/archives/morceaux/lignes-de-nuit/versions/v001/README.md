# Lignes de nuit — v001

Statut : `prototype`  
Date : 2026-07-30  
Version parente : `aucune`

## Résumé

Premier morceau complet de 30 secondes et premier cas de référence pour le futur éditeur.

## Inspiration et traduction

Demande initiale : Musique électro instrumentale avec Moby comme repère initial.

Composition originale fondée sur une pulsation régulière, une harmonie mineure, des textures chaudes, un arpège et une construction progressive.

Contraintes :

- Aucune parole.
- Aucun sample ni asset audio externe.
- Aucune reproduction de mélodie ou de signature sonore identifiable.
- Durée exacte de 30 secondes.
- Sortie WAV.

## Fichiers archivés

- [archive.json](../../../../blobs/sha256/50/506fc6de5564a2d2751645a9de7997c486960f4e6b774961c0b96a349c6c51b3.json) — `archive_descriptor` — Métadonnées et inventaire de la version.
- [CREATION.md](../../../../blobs/sha256/19/1941c906adef4fd4d00444192d9693b4d982bb3df6f580df34064c45f48fda99.md) — `creation_document` — Explication synthétique, pédagogique et technique.
- [README.md](../../../../blobs/sha256/2e/2e575a671a8e97665cf1ad1ddd8c2b501135125749f8387c1c225fb239ac4ce3.md) — `render_guide` — Commande de rendu et organisation des sources.
- [spec.json](../../../../blobs/sha256/20/200fffcdc772a78a3ad5b34b011f4095083649a197bc1cee28c2f73b999c393e.json) — `music_spec` — Paramètres musicaux, pistes, arrangement et seed.
- [render.py](../../../../blobs/sha256/45/45fdbc2fafae469a65d3dd60f4d587e4216909668e032a29797c94515219e4c2.py) — `renderer` — Synthèse, séquençage, mixage, stems, QA et export WAV.
- [test_render.py](../../../../blobs/sha256/49/49c771a75f8d198aa47548d384d8ef0d13891e5ec1eed9007560ad81c6990246.py) — `renderer_tests` — Tests de durée, format logique et déterminisme.
- [renders/lignes_de_nuit_30s.wav](../../../../blobs/sha256/68/68544991d97b3a2868fa83e8e3c9da6882991b40338d13a50187a520b17c73fb.wav) — `master` — Master stéréo WAV PCM 24 bits.
- [renders/qa_report.json](../../../../blobs/sha256/d8/d8e101d890e5bfe7d9513ce4f6933d48e6d854f8f2e0816fbfd522478a390ec7.json) — `qa_report` — Mesures techniques et empreintes du rendu.
- [renders/stems/drums.wav](../../../../blobs/sha256/5f/5fc82f0124be406a256c43b06573e6f09b853d56e30b263da280db3ac5e3f8b2.wav) — `stem_drums` — Stem de batterie synthétique.
- [renders/stems/bass.wav](../../../../blobs/sha256/8f/8f9e3883897b7bbf6b1e8834c9486810b7a8a793a5a644d331bed18ec9d5c9ab.wav) — `stem_bass` — Stem de basse synthétique.
- [renders/stems/pad.wav](../../../../blobs/sha256/51/5107842a4b181ebbf0188784b2407dcffc1ce28a88ecf63e088cc609d5fd9c2c.wav) — `stem_pad` — Stem de nappe harmonique.
- [renders/stems/arp.wav](../../../../blobs/sha256/32/321f9fc3ceee0e5abab2718d6237cb6e15a6c918bf039261839b4fafbd1d1c1b.wav) — `stem_arp` — Stem d'arpège.
- [renders/stems/lead.wav](../../../../blobs/sha256/08/083ef3cc154d3cd28711e0d91ff1c85cdb9ac23ccef5cc146c744a4d4a3b7cc1.wav) — `stem_lead` — Stem mélodique.

## Intégrité

Les tailles et empreintes SHA-256 de tous les fichiers sont enregistrées dans [manifest.json](manifest.json).
