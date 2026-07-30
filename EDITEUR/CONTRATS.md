# Contrats V0

## Responsabilités actuelles

| Couche | Point d'entrée | Responsabilité |
|---|---|---|
| Modèle | `backend/src/crea_zik/models.py` | projet, patch, instrument, score, artefact et validations existantes |
| API | `backend/src/crea_zik/api.py` | contrats HTTP, persistance, jobs et réponses d'erreur |
| Renderer de démonstration | `backend/src/crea_zik/composer.py` | synthèse Python du `Score` existant |
| Moteur principal | `backend/src/crea_zik/engine.py` | rendu WAV réel par Csound 7 |
| Interface | `frontend/src/main.tsx` | studio React existant |

Le renderer de démonstration ne doit pas devenir le moteur de l'éditeur. La composition V2 cible Csound 7 et reste séparée du modèle `Project` V1 jusqu'à sa migration explicite.

## Composition V2

Le schéma cible est `EDITEUR/contracts/composition.schema.json`. Chaque identifiant est un UUID immuable. Une écriture porte la révision lue et est refusée avec `409 revision_conflict` si elle est obsolète. Les écritures sur un même document sont atomiques : aucune modification partielle, aucun rendu déclenché avant validation complète.

| Champ | Unité | Défaut | Bornes |
|---|---:|---:|---:|
| `sample_rate` | Hz | 48000 | 44100, 48000, 88200 ou 96000 |
| `tempo_bpm` | BPM | 120 | 20 à 400 |
| `seed` | entier | requis | 0 à 4294967295 |
| `track.gain` | linéaire | 1 | 0 à 2 |
| `track.pan` | stéréo | 0 | -1 à 1 |
| note MIDI | demi-ton | requis | 0 à 127 |
| vélocité | linéaire | 1 | 0 à 1 |
| durée de rendu | secondes | requis | > 0 à 7200 |

Les paramètres instrument et effet ne sont acceptés que par une spécification versionnée, avec unité, défaut, borne et migration déclarés. Les valeurs non finies sont refusées.

## API cible

| Méthode | Route | Contrat |
|---|---|---|
| `POST` | `/api/compositions` | crée une composition V2 validée, renvoie `201` et `ETag` de révision |
| `GET` | `/api/compositions/{id}` | renvoie le document complet et son `ETag` |
| `PUT` | `/api/compositions/{id}` | remplace atomiquement avec `If-Match`, renvoie `409` en cas de conflit |
| `POST` | `/api/compositions/{id}/render` | valide puis soumet un rendu Csound, renvoie `202` et un identifiant de job |
| `GET` | `/api/render-jobs/{id}` | état, progression, artefact ou erreur structurée |

Les erreurs ont la forme `{ "code", "message", "details" }`. Les routes V1 restent compatibles pendant une migration séparée ; une route V1 ne convertit jamais silencieusement une composition V2.

## Interface, clavier et accessibilité

Le shell, les zones et les raccourcis sont définis dans `EDITEUR/wireframes.md`. Les commandes globales utilisent `Ctrl/Cmd+S`, `Espace`, `Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z` et `?`. Elles sont accessibles au clavier, annoncées par un libellé visible ou `aria-label`, et ne capturent pas une saisie dans un champ texte. Les modales piègent le focus, ferment par `Échap` et restaurent le focus déclencheur.

## Budgets

| Sujet | Budget |
|---|---:|
| Premier affichage local | < 2 s |
| Interaction de sélection | < 100 ms |
| Validation locale d'une composition | < 200 ms |
| Rendu court Csound de gate | < 60 s |
| Couverture branches backend et frontend | >= 80 % |

## Référence audio

`EDITEUR/fixtures/lignes_de_nuit.composition.json` contient l'inventaire migrable complet de « Lignes de nuit » : événements, oscillateurs, enveloppes, filtres, panoramiques, réverbération et master. `EDITEUR/fixtures/lignes_de_nuit.golden.json` verrouille le résultat du prototype de référence. La comparaison Csound est une qualification distincte : les deux implémentations ne sont pas interchangeables.
