# Contexte — explo

## Objectif (immuable sauf décision explicite)
Faire des recherches et des explorations sonores pour crea_zik : identifier, tester et documenter
des techniques de synthèse, de DSP et de composition algorithmique permettant de créer des sons et
des musiques originaux, réutilisables dans le projet crea_zik.

## Stack / contraintes techniques (stable, rarement modifié)
Contrainte permanente du projet parent : aucun son, sample, morceau, SoundFont ni réponse
impulsionnelle récupéré sur le Web — tout son final est créé localement par synthèse, DSP,
composition algorithmique ou modélisation physique. Les recherches Web ne servent qu'à consulter
code, licences et documentation technique ; aucun asset audio externe ne doit être téléchargé.

Moteurs du projet parent : Csound 7 (rendu offline, moteur principal), pyo (fallback), Faust
(cible DSP portable). Backend Python (uv/pyproject.toml).

Recherches déjà produites côté crea_zik, à consulter avant de dupliquer :
`_docs/index_recherches_audio.md` (index), `_docs/analyse_vibecoding_audio.md`,
`_docs/audit_github_audio_open_source.md`.

## État actuel (réécrit intégralement à chaque /close)
Le premier morceau est archivé sous `archives/morceaux/lignes-de-nuit/versions/v001/`.
Il comprend source, spec, master WAV, cinq stems, rapport QA et fiche pédagogique.
Le stockage est adressé par SHA-256, dédupliqué et contrôlable par commande.
Une roadmap plugins est ouverte (`roadmap_plugins.md`) : premier plugin kick, contrat par manifeste
JSON, moteur one-shot, phase 1 en cours (schéma, moteur, presets, tests non commencés).

## Décisions structurantes (append only — 10 entrées max, 5 lignes max/entrée, archiver au-delà)
- 2026-07-30 : Création de l'agent explo via /create_agent.
- 2026-07-30 : Les archives de morceaux sont immuables par version, adressées par SHA-256 et contiennent
  l’intention, l’inspiration traduite, les sources, les rendus, les stems et les mesures QA.
- 2026-07-30 : Les plugins explo exposent un manifeste JSON générique comme contrat d'UI ; aucune UI
  n'est codée dans explo. La promotion vers le dossier plugins applicatif est faite par la zone crea_zik.
