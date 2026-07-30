# Lignes de nuit — fiche de création

## Intention

Créer une pièce électronique instrumentale originale de 30 secondes, minimaliste, mélodique et
contemplative. La demande initiale citait Moby comme repère. Elle a été traduite en caractéristiques
générales — pulsation régulière, harmonie mineure, textures chaudes, arpège et progression graduelle —
sans reproduire une œuvre, une mélodie ni une signature sonore identifiable.

Tout le son provient d'oscillateurs, de bruit pseudo-aléatoire déterministe, de filtres et d'enveloppes.
Aucun sample, SoundFont, enregistrement ou effet externe n'est utilisé.

## Construction musicale

- Tempo : 120 BPM.
- Mesure : 4/4.
- Tonalité : la mineur.
- Durée : 15 mesures, soit exactement 30 secondes.
- Progression de fondamentales MIDI : A2, F2, C3, G2.
- Structure : deux mesures d'introduction, installation du rythme, arrivée de la basse, ajout de
  l'arpège, montée mélodique puis sortie courte.

La seed `20260730` stabilise chaque source de bruit. À code, spec et versions de NumPy/SciPy identiques,
le rendu est déterministe.

## Fabrication des sons

| Piste | Source | Traitement principal | Rôle musical |
|---|---|---|---|
| drums | Sinusoïde glissante et bruits seedés | Enveloppes exponentielles, passe-bande et passe-haut | Kick, clap et charleston |
| bass | Fondamentale et trois harmoniques sinusoïdales | Passe-bas à 620 Hz et enveloppe courte | Assise harmonique |
| pad | Triades, oscillateurs légèrement désaccordés | Harmoniques, passe-bas à 2,4 kHz, attaque lente | Texture et accords |
| arp | Trois harmoniques par note | Décroissance rapide et panoramique alternée | Mouvement stéréo |
| lead | Sinusoïde enrichie | Vibrato lent et enveloppe souple | Motif mélodique |

Le bus mélodique reçoit une réverbération algorithmique à quatre délais. Le master utilise une
saturation douce `tanh`, un fondu aux bords puis une normalisation à 0,89, soit environ −1,01 dBFS.

## Chaîne technique

```text
spec JSON
  → planification en beats
  → synthèse de chaque voix à 48 kHz en float64
  → cinq stems stéréo
  → somme + réverbération algorithmique
  → saturation douce + normalisation
  → WAV PCM 24 bits
  → rapport QA + SHA-256
```

Le master contient 1 440 000 trames stéréo. Les cinq stems ont la même origine et la même durée. Le
rapport QA mesure durée, peak, RMS, offset DC, corrélation stéréo, valeurs non finies et clipping.

## Sources et livrables

- [Paramètres musicaux et techniques](spec.json)
- [Script de synthèse, arrangement, mixage et export](render.py)
- [Tests de durée et de déterminisme](test_render.py)
- [Commande de rendu](README.md)
- [Descripteur d'archive](archive.json)
- [Master WAV](renders/lignes_de_nuit_30s.wav)
- [Rapport QA](renders/qa_report.json)
- Stems : [batterie](renders/stems/drums.wav), [basse](renders/stems/bass.wav),
  [nappe](renders/stems/pad.wav), [arpège](renders/stems/arp.wav) et
  [mélodie](renders/stems/lead.wav).

## Préparation du futur éditeur

La séparation actuelle entre spec, pistes, synthétiseurs, mixage et export constitue le premier
contrat éditable. L'arrangement note par note reste encore codé dans le renderer : c'est la principale
limite. L'étape suivante devra déplacer chaque événement, automation et paramètre d'effet dans une spec
versionnée. L'éditeur manipulera alors ces données et conservera les générateurs DSP indépendants.
