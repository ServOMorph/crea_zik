# Plugins d'instruments

Chaque plugin expose un manifeste JSON de paramètres, validé par
`schema/plugin_manifest.schema.json`, et un moteur de synthèse déterministe
`(params, velocity, sample_rate) -> signal stéréo`. Aucune UI n'est codée ici :
le manifeste est le contrat repris par l'UI globale du projet.

## Socle commun (`_common/dsp.py`)

Toute logique indépendante de l'instrument est centralisée dans `_common/dsp.py`,
importée par chaque `engine.py` via :

```python
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PLUGINS_ROOT = ROOT.parent
if str(PLUGINS_ROOT) not in sys.path:
    sys.path.insert(0, str(PLUGINS_ROOT))

from _common import dsp
```

Ce module fournit :
- `parameter_defs(manifest)`, `default_params(defs)`, `validate_params(defs, params)` :
  dérivation et validation des paramètres depuis le manifeste (bornes, types, enums).
- `validate_velocity(velocity)` : vérifie `0 <= velocity <= 1`.
- `drive(buffer, amount)`, `highpass(buffer, cutoff_hz, sample_rate)`, `stereo(mono, pan)` :
  primitives DSP réutilisables.
- `finalize_output(mix, params, velocity)` : étage de sortie standard
  (drive → `output_gain` × `velocity` → normalisation `target_peak_dbfs` → contrôle
  fini → panoramique). Suppose que le manifeste déclare un groupe de sortie avec au
  moins `drive_amount`, `output_gain`, `target_peak_dbfs` et `pan`.

Ce qui reste toujours propre à chaque plugin : les couches de synthèse elles-mêmes
(corps, sub, transitoire, bruit pour le kick ; un autre vocabulaire pour un futur
plugin). Le socle commun ne modélise pas de notion générique de « couche » — seul
l'étage de sortie et la validation sont mutualisés.

## Structure d'un plugin

```text
<plugin_id>/
  manifest.json        contrat de paramètres (groupes, types, bornes, presets)
  engine.py             moteur de rendu ; couches de synthèse propres au plugin,
                        validation et étage de sortie délégués à _common/dsp.py
  presets.json           valeurs de presets, éditables
  render_presets.py     régénère les WAV de référence et leurs empreintes SHA-256
  references/            WAV et empreintes de non-régression
  test_<plugin_id>.py    tests (schéma, bornes, déterminisme, non-régression)
```

## Plugins

- [kick](kick/manifest.json) — one-shot corps + sub + transitoire + bruit.
