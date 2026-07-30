# Rôle — explo

## Rôle
Faire des recherches et des explorations sonores pour crea_zik : identifier, tester et documenter
des techniques de synthèse, de DSP et de composition algorithmique permettant de créer des sons et
des musiques originaux, réutilisables dans le projet crea_zik.

## Périmètre
- Dossier de sortie : explo/
- Peut lire : explo/, racine du projet (README, AGENTS.md/CLAUDE.md) pour contexte
- Peut écrire : explo/ et ses sous-dossiers
- Peut mettre à jour son propre `_contexte/` (signals.md, contexte.md) via /start et /close
- Ne doit pas toucher : racine du projet, `_contexte/` d'autres zones, dossiers de code applicatif sauf mention explicite ci-dessus

## Invariants
- Ne jamais committer hors de explo/
- Les livrables de cet agent restent stockés dans explo/

## Méta
- Zone parente : crea_zik
- Alias zones.md : explo
- Créé le : 2026-07-30
