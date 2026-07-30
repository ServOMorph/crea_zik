# Signals — editeur (MAJ 2026-07-30)

## Actions ouvertes
- [P1|ouvert] Valider à l’écoute le rendu instrumental corrigé et le transport de préécoute.
  - fait quand: les cinq familles instrumentales sont audibles et lecture, pause, stop, seek, boucle, volume et mute fonctionnent sans modifier l’export
  - réf: `tests_manuels.md`, `backend/src/crea_zik/composition_dsp.py`, `frontend/src/editor/TransportBar.tsx`
- [P2|ouvert] Terminer les exigences et le gate V0 avant de poursuivre la roadmap.
  - fait quand: chaque tâche de la phase 0 est cochée et le gate V0 complet réussit, y compris couverture, mutations et accessibilité prévues
  - réf: `EDITEUR/roadmap_editeur_musical.md`

## Dernière session (2026-07-30)
# Session du 2026-07-30

## Décisions prises
- La composition versionnée reste la source du rendu, avec remappage intégral des identifiants lors d’une copie.
- Le rendu sépare les familles instrumentales, les effets et la normalisation de sortie.

## Livrables produits ou modifiés
- Contrats, fixtures, runner de qualification, API et persistance des compositions.
- Shell éditeur, store avec historique, sauvegarde, transport et préécoute.
- Correctif DSP pour les cinq instruments, les stems, la réverbération et le mastering.

## Hypothèses validées / invalidées
- VALIDE — Les tests automatisés de composition et de régression passent.
- INVALIDE — Un oscillateur générique suffisait à restituer les cinq instruments ; remplacement par des voix DSP spécialisées.
- EN ATTENTE — Contrôle d’écoute post-correctif par l’utilisateur.

## Prochaine étape exacte
1. Écouter le rendu corrigé et valider le transport.
2. Compléter la phase 0 et son gate V0 avant de reprendre les phases suivantes.

## Question bloquante pour la session suivante
Aucune
