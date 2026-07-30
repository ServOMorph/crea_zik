# Crea Zik

## Objectif

Créer localement de la musique et des effets sonores pour des applications et des jeux vidéo, sans
samples, morceaux, SoundFonts ni réponses impulsionnelles externes.

## Stack cible

L’interface utilise React, TypeScript et Vite. Le backend utilise Python et FastAPI.
Csound 7 est le moteur de rendu offline, pyo le fallback et Faust la cible DSP portable.

## Structure

- `_contexte/` : état durable, décisions et prochaine action ;
- `_docs/` : recherches, sources, audit open source et spécification UI ;
- `roadmap_studio_audio_procedural.md` : plan de développement et critères de livraison ;
- `.claude/` : commandes et protocole de travail du projet.

## État actuel

Le socle CLI, worker local, galerie, promotion, validation et archivage reste opérationnel.
L’éditeur dispose des contrats versionnés, de la persistance des révisions, du rendu borné, du shell et d’un store avec historique.
Le transport et la préécoute sont implémentés ; leur contrôle d’écoute post-correctif reste à valider.
Le moteur rend cinq stems instrumentaux distincts, la réverbération et un mix normalisé.
Le runner actuel passe sur les contrats, le rendu, le frontend et le parcours E2E.
La phase 0 reste ouverte tant que ses exigences exhaustives de qualification ne sont pas toutes couvertes.
