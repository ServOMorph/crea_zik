# ADR 0001 — Stack audio issue de la phase 0

Date : 2026-07-28

## Statut

Acceptée.

## Contexte

Le produit doit rendre hors ligne, à 48 kHz, sans asset externe, avec une seed et un hash de
provenance. Les trois routes évaluées sont pyo, Faust hébergé par DawDreamer et Csound 7.

## Décision

- Moteur d'authoring offline initial : **Csound 7.0.0-beta.17**, isolé derrière `RenderEngine`.
- Format et cible DSP portable : **Faust**, à compiler hors de DawDreamer pour WebAssembly/C++.
- DawDreamer 0.8.3 : **outil de benchmark et de développement seulement**, jamais dépendance de
  distribution par défaut (GPL-3.0).
- Fallback d'authoring et laboratoire Python : **pyo 1.0.5**.
- Politique de licence : les dépendances LGPL sont distribuées conformément à leurs obligations ;
  les bibliothèques/architectures Faust sont auditées fichier par fichier avant génération ; aucune
  dépendance GPL n'entre dans le produit distribué sans décision explicite.

## Éléments de preuve

Le protocole versionné est dans `benchmarks/engine_selection/`. À matériel identique :

| Route | Cinq cas | Déterminisme audio | Observation |
|---|---:|---|---|
| pyo 1.0.5 | 5/5 | 5/5 bit-identiques | 0,19 s pour la boucle de 16 s |
| Faust + DawDreamer 0.8.3 | 5/5 | 4/5 bit-identiques | polyphonie : écart maximal observé d'1 ULP |
| Csound 7.0.0-beta.17 | 5/5 | 5/5 bit-identiques | 0,06 s pour la boucle de 16 s |

Les mesures détaillées et les empreintes sont dans `benchmarks/engine_selection/results/benchmark.json`.

## Conséquences

Le noyau de l'application ne doit jamais importer directement un moteur : il dépendra d'un contrat
`RenderEngine`. Cela permet de garder pyo comme fallback et de substituer les DSP Faust portables sans
migration de projets. Pour cette machine, un rendu Csound de référence de 16 secondes doit rester sous
0,25 s ; un dépassement déclenche un rapport de régression. Csound 7 étant encore bêta, la version est
verrouillée et une mise à jour impose de rejouer ce benchmark complet.
