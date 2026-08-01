# Signals — crea_zik (MAJ 2026-08-02)

## Actions ouvertes
- [P2|ouvert] Intégrer l'archivage versionné au futur Music Composer.
  fait quand: l'éditeur produit un descripteur puis archive une version, ses stems et son rapport QA
  réf: EXPLO/archives/README.md, EXPLO/archives/archive_piece.py, roadmap_studio_audio_procedural.md
- [P2|ouvert] Auditer les phases 5 et 6 de `roadmap_studio_audio_procedural.md` (non réauditées) avant
  d'y reprendre du travail — même logique que l'audit fait sur les phases 2, 3 et 4.
  fait quand: chaque case des phases 5 et 6 est confirmée cochée/décochée après lecture effective du code
  réf: roadmap_studio_audio_procedural.md
- [P1|ouvert] Reprendre la phase 3 de `roadmap_studio_audio_procedural.md` (bibliothèque DSP et Sound
  Designer) : gaps identifiés dans l'audit du 2026-08-02 (waveshaping/saturation non branchés sur le
  moteur SFX, pas de compresseur, pas de chorus/flanger/phaser, pas de résonateurs/modèles physiques,
  pas de vue graphe/code-spec/QA contextuelle, pas de grille de variantes ni promotion en master, pas
  d'undo/redo, tests DSP limités à la structure textuelle sans contrôle audio réel).
  fait quand: le gate de phase 3 est rempli (dix variantes déterministes par famille testées à l'audio,
  aucun NaN/infini/DC/clipping non signalé, macros stables sur toute leur plage)
  réf: roadmap_studio_audio_procedural.md (phase 3)
- [P2|ouvert] Reprendre la phase 4 de `roadmap_studio_audio_procedural.md` (Composition/Music Composer) :
  gaps identifiés dans l'audit du 2026-08-02 (isobar non intégré, pas d'accords/gammes/transformations
  de motifs, pas de validation polyphonie/tessiture sur le modèle Composition actuel, pas de
  quantification/swing/humanisation appliqués, pas d'allocation de voix, pas de marqueurs/régions/
  boucles, un seul exemple de composition en galerie au lieu de trois). Le volet UI (piano roll,
  channel rack, mixer, automations) est piloté par `EDITEUR/roadmap_editeur_musical.md`, actuellement
  en tout début d'exécution (Phase V1 en cours, phases fonctionnelles 2 à 14 TODO) — coordonner plutôt
  que dupliquer ce travail depuis cette roadmap.
  fait quand: le gate de phase 4 est rempli (durées de mesures exactes au sample, stems recombinables
  au mix de référence, rendus bit-identiques à seed identique, masters sans étape externe)
  réf: roadmap_studio_audio_procedural.md (phase 4), EDITEUR/roadmap_editeur_musical.md
- [P3|ouvert] Écoute subjective au casque du banc de test plugins par un humain.
  fait quand: un humain a écouté le rendu du plugin kick dans l'UI et confirme la qualité perçue
  réf: frontend/src/plugins/PluginBench.tsx, tests_manuels.md

## Dernière session (2026-08-02)

# Session du 2026-08-02

## Décisions prises
- Phase 3 de `roadmap_studio_audio_procedural.md` réauditée : reste [TODO]. Socle réel (6 familles,
  filtres, delay, reverb, variantes déterministes) mais gaps significatifs (saturation/EQ/compresseur
  non branchés, pas de chorus/flanger/phaser/résonateurs, tests DSP limités au texte généré).
- Phase 4 réauditée : reste [TODO]. Moteur (tempo, automation sample-accurate, mixer, stems) solide ;
  le volet UI a divergé vers `EDITEUR/roadmap_editeur_musical.md`, encore en tout début d'exécution.

## Livrables produits ou modifiés
- `roadmap_studio_audio_procedural.md` : phases 3 et 4 réauditées, notes d'audit ajoutées, cases
  corrigées après lecture effective du code.
- `_contexte/signals.md` : actions ouvertes mises à jour (reprise phase 3 en P1, reprise phase 4 en
  P2, audit des phases 5-6 restant en P2).

## Hypothèses validées / invalidées
- VALIDE : ni la phase 3 ni la phase 4 ne sont closes, malgré du code dépassant par endroits leur
  description initiale (cas différent de la phase 2).
- EN ATTENTE : audit des phases 5 (Adaptive Lab) et 6 (QA/mastering/export) — non fait cette session.
- EN ATTENTE : écoute subjective au casque du banc de test plugins par un humain.

## Prochaine étape exacte
Auditer les phases 5 et 6 de `roadmap_studio_audio_procedural.md`, ou entamer la reprise de la
phase 3 (priorité P1).

## Question bloquante pour la session suivante
Aucune.
