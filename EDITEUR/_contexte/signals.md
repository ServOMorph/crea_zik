# Signals — editeur (MAJ 2026-07-30)

## Actions ouvertes
- [P1|ouvert] Exécuter la phase 0 puis son gate automatique V0
  - fait quand: l’outillage, les contrats et le gate Csound sont en place et V0 réussit intégralement
  - réf: `EDITEUR/roadmap_editeur_musical.md`

## Dernière session (2026-07-30)
<!-- Écrasé intégralement par /close. Synthèse < 25 lignes. -->
# Session du 2026-07-30

## Décisions prises
- Les fondations partagées du studio sont conservées comme base de l’éditeur dédié.
- La phase 0 reste ouverte tant que le runner canonique et le gate V0 ne sont pas livrés.
- La compaction du contexte Codex est automatique à partir de 64 000 tokens.

## Livrables produits ou modifiés
- Backend partagé : composition avec stems, graphes adaptatifs, QA/export et assistant Ollama sécurisé.
- Frontend partagé : sept SFX, variantes, transport, waveform, QA, assistant et Adaptive Lab.
- Qualification : 48 tests Python, lint, formatage, build et 6 parcours Playwright réussis.
- Configuration Codex et périmètre Prettier automatisés pour les sessions suivantes.

## Hypothèses validées / invalidées
- VALIDE : les services partagés couvrent déjà plusieurs briques nécessaires au futur éditeur.
- INVALIDE : ces briques suffisent à terminer la phase 0 -> le runner de qualification manque encore.
- EN ATTENTE : exécution intégrale du gate V0 de l’éditeur.

## Prochaine étape exacte
Créer `EDITEUR/test_editor.ps1`, verrouiller l’outillage prévu puis faire réussir V0.

## Question bloquante pour la session suivante
Aucune
