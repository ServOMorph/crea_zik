# Tests manuels — Crea Zik

Date de recette : `____-__-__`
Système audio utilisé : `________________`
Résultat global : `[ ] OK  [ ] KO`

## Préparation

1. Depuis la racine du projet, lancer `python run.py`.
2. Vérifier que le navigateur ouvre `http://127.0.0.1:5174`.
3. Vérifier que l'écran affiche `Crea Zik`, la zone **New project**, les projets et la galerie.

Résultat : `[x ] OK  [ ] KO`
Notes : `____________________________________________________________`

## Création et rendu

1. Saisir un nom de projet, par exemple `Recette manuelle`.
2. Cliquer **Create**.
3. Vérifier que le projet apparaît dans la section **Projects**.
4. Cliquer **Create and render a click**.
5. Vérifier que l'état passe par le rendu puis affiche `Render complete`.
6. Vérifier qu'un lecteur apparaît dans **Latest render**.

Résultat : `[x ] OK  [ ] KO`
Notes : `____________________________________________________________`

## Écoute

1. Cliquer lecture dans le lecteur du dernier rendu.
2. Vérifier qu'un clic court est audible, sans saturation évidente ni erreur de lecture.
3. Tester pause puis reprise.
4. Vérifier que le contrôle de volume du navigateur agit sur le son.

Résultat : `[x ] OK  [ ] KO`
Notes : `____________________________________________________________`

## Export WAV

1. Cliquer **Download WAV**.
2. Vérifier que le téléchargement se termine sans erreur.
3. Ouvrir le fichier téléchargé dans un lecteur audio local.
4. Vérifier que le son est identique à la préécoute et que le fichier n'est pas vide.

Résultat : `[ x] OK  [ ] KO`
Nom et taille du fichier : `__________________________________________`

## Galerie

1. Dans **Example gallery**, cliquer **Open a copy** pour chacun des trois exemples.
2. Vérifier que le compteur de patches du projet augmente à chaque copie.
3. Vérifier que les exemples restent visibles dans la galerie après les copies.

Résultat : `[x ] OK  [ ] KO`
Notes : `____________________________________________________________`

## Variantes

1. Sur le projet de recette, cliquer **Create 10 variants**.
2. Vérifier que le compteur de patches augmente exactement de 10.
3. Recharger la page.
4. Vérifier que le compteur reste identique après rechargement.

Résultat : `[x ] OK  [ ] KO`
Compteur avant/après : `________________`

## Annulation de rendu

1. Cliquer rapidement plusieurs fois **Create and render a click** afin de placer des rendus dans la file.
2. Dès qu'une progression est visible, cliquer **Cancel render**.
3. Vérifier que l'état affiche `Render cancelled`.
4. Lancer un nouveau rendu et vérifier qu'il se termine avec `Render complete`.

Résultat : `[ ] OK  [ ] KO  [x ] Non reproductible`

> Les clics sont très courts : si aucun bouton d'annulation ne reste visible assez longtemps,
> noter `Non reproductible` plutôt que conclure à un échec. L'annulation de file est couverte
> par les tests automatisés.

## Régression de lancement

1. Arrêter le lanceur avec `Ctrl+C`.
2. Vérifier que `http://127.0.0.1:5174` n'est plus accessible.
3. Relancer `python run.py`.
4. Vérifier que les projets et leurs patches précédents sont toujours présents.

Résultat : `[ x] OK  [ ] KO`
Notes : `____________________________________________________________`

## Anomalies relevées

| Étape | Description | Reproductible | Gravité |
|---|---|---|---|
| | | `[ ] Oui [ ] Non` | `[ ] Bloquante [ ] Majeure [ ] Mineure` |
| | | `[ ] Oui [ ] Non` | `[ ] Bloquante [ ] Majeure [ ] Mineure` |
