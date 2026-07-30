# Signals — crea_zik (MAJ 2026-07-30)

## Actions ouvertes
- [P1|ouvert] Clore le gate de phase 1 sur le rendu déterministe Csound.
  fait quand: trois rendus Csound successifs d’une même spec produisent le même hash de sortie
  réf: roadmap_studio_audio_procedural.md, backend/src/crea_zik/engine.py, backend/src/crea_zik/provenance.py

## Dernière session (2026-07-30)
### Décisions prises
- Les exports CLI produisent systématiquement un WAV et un manifeste de provenance JSON.

### Livrables produits ou modifiés
- `backend/src/crea_zik/errors.py`, `logging.py`, `exports.py` : erreurs typées, logs JSON et manifeste d’export.
- `backend/src/crea_zik/cli.py`, `engine.py`, `jobs.py` : timeout Csound, erreurs structurées et commandes CLI actionnables.
- `tests/test_cli.py`, `tests/test_foundation.py`, `tests/test_jobs.py` : parcours CLI et contrôles d’erreurs, timeout et binaire absent.
- `tests_manuels.md` : vidé ; l’annulation longue était non reproductible et la reprise a réussi.

### Hypothèses validées / invalidées
- VALIDE : 19 tests Python, le build frontend et trois parcours Playwright passent.
- VALIDE : l’annulation non bloquante est couverte automatiquement ; la recette longue peut être non reproductible sur une machine rapide.
- EN ATTENTE : la répétabilité du rendu Csound réel reste à mesurer sur trois rendus.

### Prochaine étape exacte
Rendre trois fois la même spec avec Csound et comparer les hashes de sortie.
Si le gate est satisfait, clôturer la phase 1 avant de reprendre la phase 2.

### Question bloquante pour la session suivante
Aucune.
