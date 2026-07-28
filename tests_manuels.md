# Tests manuels — Crea Zik

Date de recette : `____-__-__`
Système audio utilisé : `________________`
Résultat global : `[ ] OK  [ ] KO`

## Annulation de rendu

1. Sur un projet, cliquer **Render 2-minute cancellation demo**.
2. Dès que la progression est visible, cliquer **Cancel render**.
3. Vérifier que l'état affiche `Render cancelled`.
4. Lancer ensuite **Create and render a click** et vérifier qu'il se termine avec `Render complete`.

Résultat : `[ ] OK  [ ] KO  [ ] Non reproductible`

> Le moteur effectue un rendu offline : si le rendu de deux minutes se termine avant que le bouton
> d'annulation soit disponible,
> noter `Non reproductible` plutôt que conclure à un échec. L'annulation de file est couverte
> par les tests automatisés.

## Anomalies relevées

| Étape | Description | Reproductible | Gravité |
|---|---|---|---|
| | | `[ ] Oui [ ] Non` | `[ ] Bloquante [ ] Majeure [ ] Mineure` |
| | | `[ ] Oui [ ] Non` | `[ ] Bloquante [ ] Majeure [ ] Mineure` |
