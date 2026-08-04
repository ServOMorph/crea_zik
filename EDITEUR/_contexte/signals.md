# Signals — editeur (MAJ 2026-08-04)

## Actions ouvertes
- [P1|ouvert] Ouvrir la Phase V4 : qualification du store d'édition, des commandes et de la sauvegarde.
  - fait quand: 100 % lignes et branches atteint sur store/commandes/historique, séquences fast-check
    avec inverses vérifiés, 100 opérations puis 100 undo/redo comparées, Stryker sur les
    transformations critiques avec seuil bloquant, runner canonique complet vert (V0→V3 inclus)
  - réf: `EDITEUR/roadmap_editeur_musical.md` (Phase V4), `frontend/src/editor/editorStore.ts`,
    `frontend/src/editor/editorStore.test.ts`

## Dernière session (2026-08-04)
# Session du 2026-08-04

## Décisions prises
- Phase V3 close [FAIT] : qualification shell, sidebar et routage. Runner canonique complet vert
  (V0→V2 inclus) — frontend 39 tests unitaires (+13), a11y 5 tests, e2e 10 tests (dont 3 nouveaux),
  snapshot visuel inchangé, mutation Stryker 87,31 % ≥ 60 %.

## Livrables produits ou modifiés
- `frontend/src/app/Sidebar.test.tsx` (nouveau, 3 tests) : repli/dépli, aria-current unique, toggle,
  navigation au clic sans suivre le href.
- `frontend/src/editor/EditorLanding.test.tsx` (nouveau, 6 tests) : états loading, vide, erreur,
  introuvable, bannière hors ligne (événements online/offline), écran de création de copie.
- `frontend/src/app/Application.test.tsx` : +2 tests — confirmation avant de quitter des modifs non
  enregistrées (refus puis acceptation), restauration de la route éditeur après départ direct sans query.
- `frontend/src/app/Application.a11y.test.tsx` : axe étendu à l'éditeur réel (fetch stubé), état
  projet introuvable et état vide ; l'ancien test axe « éditeur » scannait l'état erreur par accident.
- `frontend/e2e/shell.spec.ts` (nouveau, 3 tests) : sidebar active + historique navigateur
  (goBack/goForward), URL directe vers un projet absent, conservation de la route éditeur sans query.
- `EDITEUR/roadmap_editeur_musical.md` : Phase V3 et Phase 3 (shell, sidebar, routage) [FAIT].

## Hypothèses validées / invalidées
- VALIDE — Les 4 échecs e2e observés en lancement standalone venaient de projets résiduels
  pré-migration NoteEvent dans `test-results/projects` (racine), pas d'une régression : le runner
  canonique (racine temp fraîche) est vert intégralement.
- EN ATTENTE — `GET /api/projects` renvoie un 500 brut si un projet du dossier n'est plus validable
  par le schéma courant (validation stricte sans migration à la lecture) ; angle mort de robustesse,
  hors périmètre V3, à qualifier dans une phase ultérieure.

## Prochaine étape exacte
Ouvrir la Phase V4 (qualification store, commandes et sauvegarde) : 100 % lignes/branches sur le
store d'édition et l'historique, séquences fast-check avec inverses vérifiés, 100 opérations puis
100 undo/redo comparées, Stryker sur les transformations critiques avec seuil bloquant, puis
non-régression V0→V3 via le runner.

## Question bloquante pour la session suivante
Aucune.
