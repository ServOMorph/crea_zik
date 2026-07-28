# Signals — crea_zik (MAJ 2026-07-28)

## Actions ouvertes
- [P1|ouvert] Clore les gates restants des phases 1 et 2 : validation CLI, erreurs et logs structurés, annulation manuelle d’un rendu long et manifeste d’export.
  fait quand: la CLI est testée de bout en bout, les erreurs et logs sont structurés, l’annulation est observée sur le rendu de deux minutes et chaque export produit son manifeste
  réf: roadmap_studio_audio_procedural.md, backend/src/crea_zik/cli.py, backend/src/crea_zik/jobs.py, tests_manuels.md

## Dernière session (2026-07-28)
### Décisions prises
- Les schémas de domaine v1 sont validés et migrés à la lecture des projets.
- La galerie rend une copie dans le projet sélectionné ; les jobs restent visibles jusqu’à leur état terminal.

### Livrables produits ou modifiés
- `backend/src/crea_zik/models.py` : schémas Project, Patch, Score, Instrument, EffectChain, AdaptiveGraph, RenderJob, Artifact et QaReport.
- `frontend/src/main.tsx` : galerie rendable, file de jobs visible et Sound Designer minimal paramétrable.
- `tests/test_foundation.py`, `frontend/e2e/studio.spec.ts` : couverture de domaine et trois parcours E2E.
- `tests_manuels.md` : recette résiduelle d’annulation de rendu long.

### Hypothèses validées / invalidées
- VALIDE : 15 tests Python, le build frontend et les trois parcours Playwright sont verts.
- VALIDE : les exemples de galerie sont copiés, rendus et régénérés depuis l’UI.
- EN ATTENTE : l’annulation du rendu de deux minutes n’a pas été observée manuellement ; le non-blocage est couvert par test automatisé.

### Prochaine étape exacte
Exécuter la recette manuelle d’annulation sur le rendu de deux minutes.
Compléter les erreurs et logs structurés, les tests CLI de bout en bout et le manifeste d’export.

### Question bloquante pour la session suivante
Aucune.
