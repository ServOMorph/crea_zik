# Plugins d'instruments

Chaque plugin expose un manifeste JSON de paramètres, validé par
`schema/plugin_manifest.schema.json`, et un moteur de synthèse déterministe
`(params, velocity, sample_rate) -> signal stéréo`. Aucune UI n'est codée ici :
le manifeste est le contrat repris par l'UI globale du projet.

## Structure d'un plugin

```text
<plugin_id>/
  manifest.json        contrat de paramètres (groupes, types, bornes, presets)
  engine.py             moteur de rendu et validation des paramètres
  presets.json           valeurs de presets, éditables
  render_presets.py     régénère les WAV de référence et leurs empreintes SHA-256
  references/            WAV et empreintes de non-régression
  test_<plugin_id>.py    tests (schéma, bornes, déterminisme, non-régression)
```

## Plugins

- [kick](kick/manifest.json) — one-shot corps + sub + transitoire + bruit.
