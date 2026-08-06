# Lignes de nuit

Morceau electronique instrumental original de 30 secondes, genere sans sample ni asset externe.

## Rendu

Depuis la racine du projet :

```powershell
python EXPLO/morceau_electro/render.py
```

Le master PCM WAV 24 bits est ecrit dans `renders/lignes_de_nuit_30s.wav`. Les stems, en alignement
sample a sample avec le master, sont ecrits dans `renders/stems/`. Le rapport de controle est
`renders/qa_report.json`.

## Structure preparee pour l'editeur

- `spec.json` contient les parametres de projet, les pistes, la tonalite, l'arrangement et la seed.
- `render.py` separe les generateurs d'instruments, la planification d'evenements, le mixage, les stems
  et l'export.
- Les identifiants de pistes sont stables : `drums`, `bass`, `pad`, `arp`, `lead`.

Le futur editeur pourra remplacer l'arrangement code par une liste d'evenements versionnee, sans
modifier les generateurs DSP ou le format de sortie.
