# Signals — editeur (MAJ 2026-08-04)

## Actions ouvertes
- [P1|ouvert] Terminer la Phase 4 fonctionnelle (reste : stratégie de virtualisation pour les
  grandes listes de pistes et d'événements) puis ouvrir la Phase 5 (transport et préécoute) avec sa
  qualification V5.
  - fait quand: virtualisation livrée et testée (une grande liste ne rend que les lignes visibles),
    puis machine d'état du transport testée avec horloge contrôlée, et runner canonique vert
    (V0→V4 inclus)
  - réf: `EDITEUR/roadmap_editeur_musical.md` (Phase 4 bullet virtualisation, Phase V5),
    `frontend/src/editor/editorStore.ts`, `frontend/src/editor/transport.ts`

## Dernière session (2026-08-04)
# Session du 2026-08-04

## Décisions prises
- Phase V4 close [FAIT] : qualification du store d'édition, des commandes et de la sauvegarde.
  Runner canonique vert (rapport `EDITEUR/test-results/v1-20260804-151348.json`, 20 checks) —
  store 100 % lignes et branches (coverage-summary 2026-08-04 15:14).

## Livrables produits ou modifiés
- `frontend/src/editor/editorStore.test.ts` +185 lignes : cent commandes puis cent undo/redo
  comparées exactement, historique borné à 200, suppressions en cascade (tracks→patterns→clips),
  transactions, sélection multicollection et coller avec remappage des identifiants.
- `frontend/src/editor/editorStore.property.test.ts` (nouveau) : fast-check sur séquences d'actions
  générées, inverses vérifiés (undo rétablit l'état précédent, redo le rejoue), 100 runs.
- `frontend/stryker.config.mjs` : mutation étendue à `editorStore.ts` et `transport.ts`, seuil
  bloquant break 60 %.

## Hypothèses validées / invalidées
- VALIDE — le store d'édition et l'historique atteignent 100 % lignes et branches
  (`coverage-summary.json`, editorStore.ts 100/100) sans couverture artificielle (combiné
  property/mutation).
- INVALIDE (écart résumé vs code) — la Phase 4 fonctionnelle n'est pas intégralement close : il
  n'existe aucune stratégie de virtualisation dans `frontend/src/` (grep `virtual` vide). Le bullet
  correspondant reste ouvert avant la Phase 5.
- EN ATTENTE — `GET /api/projects` renvoie un 500 brut si un projet du dossier n'est plus validable
  par le schéma courant ; angle mort de robustesse hors V4, à qualifier dans une phase ultérieure.

## Prochaine étape exacte
Compléter la virtualisation de la Phase 4 (grosse liste de pistes/événements, rendu des seules
lignes visibles) avec son test et le gate satisfait, puis ouvrir la Phase 5 (transport et
préécoute) et sa qualification V5.

## Question bloquante pour la session suivante
Aucune.