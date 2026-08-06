# Archives musicales

Ce dossier conserve l'histoire vérifiable des morceaux : intention, inspiration, composition, synthèse,
code, rendus, stems, mesures techniques et changements entre versions.

## Principe

Chaque fichier est copié dans `blobs/sha256/` sous son empreinte SHA-256. Une version ne contient pas
de seconde copie : son manifeste relie le rôle du fichier, son chemin d'origine, son empreinte et le
blob immuable. Deux versions strictement identiques partagent donc le même blob.

```text
archive.json
    ↓ archive_piece.py
blobs/sha256/             fichiers immuables et dédupliqués
morceaux/<id>/            documentation et historique humain
  versions/<version>/     manifeste et fiche d'une version
CATALOGUE.md               point d'entrée de toutes les œuvres
```

## Archiver une nouvelle version

1. Modifier le morceau dans son dossier de travail.
2. Régénérer le master, les stems et le rapport QA.
3. Mettre à jour son `archive.json` : nouvelle version, version parente et résumé des changements.
4. Exécuter :

```powershell
python EXPLO/archives/archive_piece.py archive EXPLO/morceau_electro/archive.json
python EXPLO/archives/archive_piece.py verify
```

Une version déjà archivée n'est jamais remplacée. Toute amélioration crée `v002`, `v003`, etc.

## Contrat pour le futur éditeur

L'éditeur devra produire le même descripteur puis appeler le service d'archivage. Il pourra comparer
deux manifestes sans connaître le moteur audio : paramètres, fichiers modifiés, métriques QA, master,
stems et documentation utilisent des rôles stables.

## Scripts

- [Archive et contrôle](archive_piece.py)
- [Tests du système](test_archive.py)
- [Schéma du descripteur](schema/archive_descriptor.schema.json)
- [Catalogue des morceaux](CATALOGUE.md)
