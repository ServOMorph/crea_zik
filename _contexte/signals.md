# Signals — crea_zik (MAJ 2026-07-30)

## Actions ouvertes
- [P1|ouvert] Auditer l'écart entre `roadmap_studio_audio_procedural.md` (phase 2) et l'état réel du code.
  fait quand: chaque case de phase 2 est confirmée cochée/décochée après lecture effective des fichiers correspondants (api.py, frontend/)
  réf: roadmap_studio_audio_procedural.md, backend/src/crea_zik/api.py, frontend/src/
- [P2|ouvert] Intégrer l'archivage versionné au futur Music Composer.
  fait quand: l'éditeur produit un descripteur puis archive une version, ses stems et son rapport QA
  réf: EXPLO/archives/README.md, EXPLO/archives/archive_piece.py, roadmap_studio_audio_procedural.md

## Dernière session (2026-07-30)
# Session du 2026-07-30

## Décisions prises
- Le gate de phase 1 (déterminisme du rendu Csound réel) est validé ; l'action P1 précédente est close.

## Livrables produits ou modifiés
- Aucun fichier livrable : validation par rendus répétés, fichiers temporaires supprimés après contrôle.

## Hypothèses validées / invalidées
- VALIDE : trois rendus Csound indépendants du patch « UI click » (projet b1890ee0-af29-4683-a5d4-d54577cd0d52) produisent le même SHA-256 sur le WAV réel.
- EN ATTENTE : le champ « hash » renvoyé par le CLI (`patch_hash`) est dérivé de la spec, pas du rendu ; il ne prouve pas seul le déterminisme audio.
- EN ATTENTE : découverte en fin de session — `roadmap_studio_audio_procedural.md` semble en décalage avec le code réel de phase 2 (API FastAPI complète dans `api.py`, frontend existant avec une structure différente de celle décrite) ; non auditée en détail.

## Prochaine étape exacte
Auditer l'écart entre la phase 2 du roadmap et l'état réel du code avant de cocher ou démarrer une nouvelle tâche.

## Question bloquante pour la session suivante
Le roadmap phase 2 doit-il être réaudité/réécrit avant reprise du développement, ou une tâche précise doit-elle démarrer malgré l'écart constaté ?
