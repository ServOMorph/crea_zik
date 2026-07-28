# Benchmark de sélection du moteur

Ce dossier compare les cinq cas du contrat minimal à 48 kHz stéréo : clic UI, impact modal,
moteur continu, instrument polyphonique huit voix et boucle de huit mesures.

Chaque route est répétée trois fois. Le script conserve le temps de rendu, l'empreinte du fichier,
l'empreinte des échantillons PCM et la validité du WAV. Le déterminisme porte sur les échantillons,
pas sur les métadonnées de conteneur WAV.

## Exécution

```powershell
python benchmarks/engine_selection/run_benchmark.py
```

Les sorties sont écrites dans `results/benchmark.json`; les WAV reproductibles restent dans
`artifacts/`, ignoré par Git.

## Résultat du 2026-07-28

- pyo 1.0.5 / Python 3.11 : les cinq cas sont bit-identiques sur trois rendus ; le rendu complet
  le plus long (boucle de 16 secondes) mesure environ 0,19 s.
- Faust via DawDreamer 0.8.3 / Python 3.11 : les cinq cas rendent. Quatre cas sont bit-identiques ;
  le test polyphonique diverge de 1 ULP entre rendus, donc il n'est pas acceptable comme rendu de
  référence déterministe dans son état actuel.
- Csound 7.0.0-beta.17 : les cinq cas sont bit-identiques sur trois rendus ; la boucle de 16 secondes
  rend en environ 0,06 s. Il est installé de façon isolée dans `csound7-runtime/`, ignoré par Git.

La décision et les limites sont consignées dans `_docs/adr/0001-stack-audio-phase-0.md`.
