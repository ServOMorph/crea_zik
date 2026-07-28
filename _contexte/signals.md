# Signals — crea_zik (MAJ 2026-07-28)

## Actions ouvertes
- [P1|ouvert] Terminer les gates des phases 1 et 2 : modèles de domaine restants, parcours complet des exemples de galerie et UI de jobs exploitable pour les rendus longs.
  fait quand: les schémas prévus sont couverts, les trois exemples sont lisibles et régénérables depuis l’UI, et l’annulation est observable sur un rendu long sans bloquer le suivant
  réf: roadmap_studio_audio_procedural.md, frontend/src/main.tsx, tests/test_jobs.py

## Dernière session (2026-07-28)
### Décisions prises
- Le lanceur local utilise par défaut l’API sur `127.0.0.1:8002` et l’UI sur `127.0.0.1:5174` afin d’éviter les ports déjà occupés.
- Les fichiers de rendu `/projects/*` sont proxifiés par Vite, comme l’API, pour que le lecteur HTML puisse charger les WAV.

### Livrables produits ou modifiés
- `backend/src/crea_zik/` : jobs SSE versionnés, annulation coopérative de Csound et racine de projets configurable.
- `frontend/` : suivi de job par SSE, annulation, téléchargement WAV, proxy des WAV et test E2E Playwright.
- `run.py`, `tests_manuels.md` : lanceur local et recette manuelle documentée.

### Hypothèses validées / invalidées
- VALIDE : la recette manuelle crée, rend, écoute, exporte, copie la galerie, génère des variantes et persiste les projets.
- VALIDE : le WAV est chargé par le lecteur après proxy de `/projects`; le clic de 120 ms s’affiche comme `0:00` dans Chrome par arrondi.
- EN ATTENTE : l’annulation ne peut pas être observée manuellement avec un rendu de 120 ms ; les tests automatisés valident le non-blocage de la file.

### Prochaine étape exacte
Compléter les schémas de la phase 1, puis rendre les exemples de galerie jouables et régénérables depuis l’UI.
Ajouter un rendu de démonstration assez long pour rendre l’annulation observable manuellement.

### Question bloquante pour la session suivante
Aucune.
