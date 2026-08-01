# Crea Zik

## Objectif

Créer localement de la musique et des effets sonores pour des applications et des jeux vidéo, sans
samples, morceaux, SoundFonts ni réponses impulsionnelles externes.

## Stack cible

L’interface utilise React, TypeScript et Vite. Le backend utilise Python et FastAPI.
Csound 7 est le moteur de rendu offline, pyo le fallback et Faust la cible DSP portable.

## Structure

- `_contexte/` : état durable, décisions et prochaine action ;
- `_docs/` : recherches, sources, audit open source et spécification UI ;
- `roadmap_studio_audio_procedural.md` : plan de développement et critères de livraison ;
- `.claude/` : commandes et protocole de travail du projet.

## État actuel

Le socle CLI, worker local, galerie, promotion, validation et archivage reste opérationnel.
L’éditeur dispose des contrats versionnés, de la persistance des révisions, du rendu borné, du shell et d’un store avec historique.
Le transport et la préécoute sont implémentés et validés à l’écoute par l’utilisateur.
Le moteur rend cinq stems instrumentaux distincts, la réverbération et un mix normalisé.
La phase 0 et le gate V0 de l’éditeur sont livrés : le runner canonique couvre lint, typage, contrats,
déterminisme Csound, couverture bloquante, fuzzing OpenAPI, accessibilité, mutation et régression
visuelle, chacun avec preuve de blocage volontaire. La phase 1 de l’éditeur (domaine compositionnel,
migration de `Lignes de nuit`) est livrée : les notes et le bus master/reverb/limiteur sont désormais
des modèles typés (`NoteEvent`, `MixerChannel`) plutôt que des dictionnaires génériques, migration
vérifiée bit-exacte au rendu. Le mutation testing Python (mutmut) reste bloqué par une incompatibilité
structurelle malgré un environnement WSL/Csound provisionné ; limite documentée
(`EDITEUR/docs/limites_connues.md`).
Le gate de déterminisme Csound réel de la phase 1 (roadmap studio audio procédural) est validé (trois rendus indépendants, même SHA-256 du WAV).
La phase 2 de `roadmap_studio_audio_procedural.md` a été réauditée et close [FAIT] : le code réel
dépasse largement sa description initiale. Les phases 3 à 6 restent à réauditer avant reprise.
`EXPLO/roadmap_plugins.md` est intégralement livré : le banc de test plugins dans l’UI globale a été
validé dans un navigateur réel, et le plugin kick est promu sur le moteur de composition via des
paramètres d’instrument opt-in, sans copie de fichiers vers un dossier plugins applicatif séparé.
Une zone `DOCUMENTATION/` et une zone `WORKFLOW/` ont été créées pour bâtir en parallèle l’inventaire des styles musicaux (modèle de fiche défini) et l’agent de création de musique associé ; voir `roadmap_creation_musique.md`.
