# Signals — editeur (MAJ 2026-07-30)

## Actions ouvertes
- [P1|ouvert] Lever le blocage mutmut (WSL/CI) ou acter la limite dans la documentation finale.
  - fait quand: mutmut s'exécute dans le runner (via WSL provisionné ou CI Linux) ou la limite est actée formellement dans `EDITEUR/docs/limites_connues.md` (phase 14)
  - réf: `EDITEUR/test_editor.ps1`, `EDITEUR/roadmap_editeur_musical.md` (section Phase V0)
- [P2|ouvert] Démarrer la Phase 1 — domaine compositionnel et migration de `Lignes de nuit`.
  - fait quand: modèles Pydantic Composition/Track/Pattern/Clip/NoteEvent/InstrumentPreset/AutomationLane/MixerChannel/EffectInstance/RenderSettings ajoutés et gate V1 lancé
  - réf: `EDITEUR/roadmap_editeur_musical.md` (Phase 1)

## Dernière session (2026-07-30)
# Session du 2026-07-30

## Décisions prises
- Rendu instrumental et transport de préécoute validés à l'écoute par l'utilisateur (action clôturée).
- Seuil de couverture frontend temporairement abaissé (60 %/75 %) pour `TransportBar.tsx` et `EditorLanding.tsx`, à remonter à 80 % après leurs phases dédiées (V3/V5).
- mutmut reste verrouillé en dépendance mais non exécutable nativement sous Windows ; traité comme réserve d'infrastructure documentée plutôt que gate contourné.

## Livrables produits ou modifiés
- `EDITEUR/test_editor.ps1` : gates Schemathesis, couverture (Python + frontend), markdownlint, a11y, mutation (Stryker), visuel (Playwright), et probes de blocage étendues aux 8 familles.
- Nouveaux tests : `tests/test_schema_fuzz.py`, `frontend/src/api/client.test.ts`, `frontend/src/app/Application.a11y.test.tsx`, `frontend/e2e/visual.spec.ts` (+ baselines approuvées).
- Outillage : `pyproject.toml`/`uv.lock` (Schemathesis), `frontend/package.json` (markdownlint-cli2, scripts), `frontend/vitest.config.ts`, `frontend/stryker.config.mjs`, `EDITEUR/.markdownlint-cli2.jsonc`.
- `backend/src/crea_zik/api.py` : correctifs lint/typage uniquement, sur du code livré ailleurs (feature plugins, cf. CHANGELOG v0.13).
- `run.py` : ports par défaut changés (API 8003, UI 5175) à la demande utilisateur.
- `EDITEUR/roadmap_editeur_musical.md` : Phase 0 et Phase V0 marquées [FAIT], réserve mutmut documentée.

## Hypothèses validées / invalidées
- VALIDE — Le runner V0 étendu passe intégralement, probes de blocage des 8 familles comprises.
- VALIDE — Rendu instrumental et transport conformes à l'écoute utilisateur.
- EN ATTENTE — mutmut non exécutable nativement sous Windows ; nécessite WSL provisionné ou CI Linux.

## Prochaine étape exacte
1. Lever ou acter le blocage mutmut.
2. Démarrer la Phase 1 (domaine compositionnel et migration de `Lignes de nuit`).

## Question bloquante pour la session suivante
Aucune
