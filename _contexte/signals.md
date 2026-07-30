# Signals — crea_zik (MAJ 2026-07-30)

## Actions ouvertes
- [P1|ouvert] Auditer l'écart entre `roadmap_studio_audio_procedural.md` (phase 2) et l'état réel du code.
  fait quand: chaque case de phase 2 est confirmée cochée/décochée après lecture effective des fichiers correspondants (api.py, frontend/)
  réf: roadmap_studio_audio_procedural.md, backend/src/crea_zik/api.py, frontend/src/
- [P1|ouvert] Valider manuellement le banc de test plugins dans un navigateur (non fait en session, pas d'outil navigateur disponible).
  fait quand: la case correspondante de `tests_manuels.md` est validée et supprimée
  réf: tests_manuels.md, frontend/src/plugins/PluginBench.tsx
- [P2|ouvert] Intégrer l'archivage versionné au futur Music Composer.
  fait quand: l'éditeur produit un descripteur puis archive une version, ses stems et son rapport QA
  réf: EXPLO/archives/README.md, EXPLO/archives/archive_piece.py, roadmap_studio_audio_procedural.md
- [P2|ouvert] Phase 3 de `EXPLO/roadmap_plugins.md` (promotion et intégration au projet) une fois la
  validation manuelle du banc de test faite.
  fait quand: la procédure de promotion d'un plugin explo validé est définie et le kick est branché au moteur de composition
  réf: EXPLO/roadmap_plugins.md

## Dernière session (2026-07-30)
# Session du 2026-07-30

## Décisions prises
- Phase 2 de `EXPLO/roadmap_plugins.md` (banc de test dans l'UI globale) implémentée dans crea_zik :
  rendu synchrone sans file de jobs (calcul numpy sub-seconde), pas de réutilisation du Sound Designer
  existant (câblé en dur par patch, non généralisable), contrôles UI générés depuis le manifeste JSON.
- `jsonschema` promu de dépendance dev à dépendance core (validation de manifeste au runtime).

## Livrables produits ou modifiés
- `backend/src/crea_zik/plugins.py` : créé (découverte, manifest, moteur, rendu des plugins explo).
- `backend/src/crea_zik/api.py` : endpoints `/api/plugins`, `/api/plugins/{id}/manifest`,
  `/api/plugins/{id}/presets/{preset}`, `/api/plugins/{id}/render`.
- `tests/test_plugins_api.py` : créé, 9 tests dont la non-régression du hash SHA-256 de la phase 1.
- `frontend/src/plugins/api.ts`, `PluginBench.tsx`, `PluginBench.test.tsx`, `PluginBench.a11y.test.tsx` : créés.
- `frontend/src/app/Application.tsx`, `Sidebar.tsx` : route et lien `/plugins` ajoutés.
- `EXPLO/roadmap_plugins.md` : phase 2 marquée [FAIT].
- `tests_manuels.md` : ajout du contrôle manuel du banc de test plugins (non exécuté en session).

## Hypothèses validées / invalidées
- VALIDE : le rendu synchrone (sans SSE ni file de jobs) suffit pour un plugin numpy sub-seconde ;
  le hash SHA-256 du rendu réel via l'API est identique à la référence produite en phase 1.
- EN ATTENTE : validation visuelle/auditive du banc de test dans un navigateur réel (pas d'outil
  navigateur disponible en session ; vérifié uniquement par serveur réel + curl et tests automatisés).
- EN ATTENTE : le champ « hash » renvoyé par le CLI (`patch_hash`) est dérivé de la spec, pas du rendu ; il ne prouve pas seul le déterminisme audio.
- EN ATTENTE : découverte de session antérieure — `roadmap_studio_audio_procedural.md` semble en décalage avec le code réel de phase 2 (API FastAPI complète dans `api.py`, frontend existant avec une structure différente de celle décrite) ; non auditée en détail.

## Prochaine étape exacte
Valider manuellement le banc de test plugins dans un navigateur (`tests_manuels.md`), puis démarrer la
phase 3 de `EXPLO/roadmap_plugins.md` (promotion et intégration au moteur de composition).

## Question bloquante pour la session suivante
Le roadmap `roadmap_studio_audio_procedural.md` phase 2 doit-il être réaudité/réécrit avant reprise du développement, ou une tâche précise doit-elle démarrer malgré l'écart constaté ?
