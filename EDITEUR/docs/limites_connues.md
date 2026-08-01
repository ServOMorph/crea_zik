# Limites connues

Ce fichier sera complété exhaustivement en Phase 14. Une première entrée est actée par anticipation
car son investigation a eu lieu en amont, pendant la Phase V0.

## LIM-001 — Mutation testing Python (mutmut) non exécutable

- **Fonctionnalité prévue** : gate de mutation testing sur le domaine Python
  (`backend/src/crea_zik`), conformément à l'outillage obligatoire de la roadmap
  (`EDITEUR/roadmap_editeur_musical.md`, sections « Outillage automatique obligatoire » et
  Phase V1).
- **État réel** : `mutmut` est verrouillé en dépendance, configuré (`[tool.mutmut]` dans
  `pyproject.toml`), et son environnement d'exécution est provisionné (WSL Ubuntu, venv Python
  3.13, Csound 6.18 pour la suite de tests). L'outil ne peut toutefois pas produire de résultat de
  mutation exploitable.
- **Raison** : `mutmut` dérive le nom de module de chaque fichier mutant directement de la valeur
  littérale de `source_paths` (ex. `backend/src/crea_zik/adaptive.py` →
  `backend.src.crea_zik.adaptive`). Or les tests importent réellement le code sous le nom
  `crea_zik.*`, grâce à `pythonpath = ["backend/src"]` dans `[tool.pytest.ini_options]`. Cette
  incohérence empêche `mutmut` de relier les mutants à la couverture de test réelle (« Stopping
  early, because tests recorded trampoline hits but none match any mutant key »). La corriger
  proprement exigerait de restructurer les imports du projet (faire de `backend/src` un vrai
  package Python et importer partout via `backend.src.crea_zik`), un changement transverse hors
  périmètre de ce correctif d'infrastructure.
- **Impact utilisateur** : aucun impact direct sur l'éditeur livré ; ce gate est un outil de
  qualification interne au développement, pas une fonctionnalité produit.
- **Contournement** : les autres gates de non-régression (pytest, couverture de lignes/branches,
  Schemathesis, mypy, ruff) restent actifs et bloquants sur le domaine Python.
- **Risque** : des mutations de logique métier non détectées par une couverture de lignes complète
  mais superficielle pourraient passer inaperçues.
- **Priorité** : P2.
- **Test d'acceptation restant** : `mutmut run` doit relier au moins un mutant tué à son test, sur
  un module du domaine, sans avertissement de désalignement de clé.
