# Signals — editeur (MAJ 2026-08-04)

## Actions ouvertes
- [P1|ouvert] Ouvrir la Phase V3 : qualification du shell, de la sidebar et du routage.
  - fait quand: composants/états de page V3 testés (Vitest + RTL), axe-core sans violation sur le
    shell, Playwright URL directe/historique/sidebar/conservation du projet, snapshots visuels
    approuvés et runner canonique complet vert (V0→V2 inclus)
  - réf: `EDITEUR/roadmap_editeur_musical.md` (Phase V3), `frontend/src/app/`, `frontend/e2e/`

## Dernière session (2026-08-04)
# Session du 2026-08-04

## Décisions prises
- Phase V2 close [FAIT] : chaque route nominale et chaque erreur typée de l'API de composition testée,
  fuzzing OpenAPI étendu, révisions concurrentes, écriture interrompue/annulation/reprise, chemins
  hostiles et isolation des projets qualifiés. Runner canonique complet vert aujourd'hui.
- Ungap 500 non typé découvert et corrigé : PUT avec `composition.id` ≠ id du chemin levait un
  `ValueError` brut → 500 ; nouvelle erreur typée `CompositionIdMismatchError` → 422
  `composition_id_mismatch`.

## Livrables produits ou modifiés
- `tests/test_api.py` : +4 tests (master lisible, 404 project, 422 `composition_not_found`, track
  inconnu, `export_artifact_missing`) — suite 18/18.
- `tests/test_api_robustness.py` (nouveau) : 13 tests — Hypothesis entrées invalides (UUIDs
  malformés, révisions/start_beat/expected_revision négatifs), concurrence réelle 2 threads (200+409
  sans écrasement), interruption `os.replace` + reprise, nettoyage des `.tmp` orphelins à la lecture,
  annulation/reprise d'un rendu via API + flux SSE, isolation entre projets, `plugin_id` hostiles
  (aucune écriture hors dossier autorisé).
- `tests/test_schema_fuzz.py` : fuzz Schemathesis étendu des 4 aux 11 routes GET composition avec
  état réel seedé.
- `backend/src/crea_zik/errors.py` : +`CompositionIdMismatchError` (code `composition_id_mismatch`).
- `backend/src/crea_zik/cli.py` : garde id mismatch typée (remplace le `ValueError`).
- `EDITEUR/test_editor.ps1` : gates `python-lint-v1`/`python-types-v1`/`composition-domain` étendus
  (`errors.py`, `test_api_robustness.py`) — ces livrables n'étaient sinon jamais exécutés par le runner.
- `EDITEUR/roadmap_editeur_musical.md` : Phase V2 [FAIT], Phase 2 (API et persistance) [FAIT].

## Hypothèses validées / invalidées
- VALIDE — Le 500 non typé sur id mismatch existait réellement (probe avant correction) ; le
  catch/raise des `CreaZikError` par l'API le convertissait en 500 silencieux.
- VALIDE — Les `plugin_id` hostiles (`..%2f`, `%2e%2e`, `..`) ne produisent jamais de requête 200 ni
  d'écriture hors du dossier autorisé (routing Starlette + `load_manifest` + `resolve_project_path`),
  vérifié par comparaison du filesystem avant/après.
- VALIDE — `os.replace` (écriture atomique .tmp + fsync) tient l'interruption : disque intact,
  reprise au PUT suivant à la même révision ; les `.tmp` orphelins sont purgés au chargement.

## Prochaine étape exacte
Ouvrir la Phase V3 (qualification shell, sidebar et routage) : composants et états de page avec
Vitest + React Testing Library, accessibilité axe-core, parcours Playwright (URL directe, historique,
sidebar active, conservation du projet), snapshots visuels, puis non-régression V0→V2 via le runner.

## Question bloquante pour la session suivante
Aucune.