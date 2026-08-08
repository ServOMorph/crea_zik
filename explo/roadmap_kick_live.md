# Roadmap — plugin kick temps réel (kick_live)

## Objectif

Créer un nouveau plugin `kick_live`, indépendant du plugin `kick` existant (aucun fichier de
`plugins/kick/` n'est modifié), permettant de déclencher le kick en boucle et d'entendre les
changements de paramètres en direct, comme un synthétiseur natif (FL Studio).

## Cadre fixé le 2026-08-07

- Nouveau plugin `kick_live`, dossier propre `explo/plugins/kick_live/` ; `explo/plugins/kick/`
  n'est ni modifié ni supprimé.
- Moteur DSP unique écrit en Rust, partagé entre :
  - le rendu offline (liaison PyO3 → Python, banc de test classique, futur archivage) ;
  - le rendu temps réel (compilation `wasm-pack` → AudioWorklet navigateur).
  Un seul chemin de calcul, pas de réimplémentation JS dupliquée.
- Le manifeste JSON / schéma de paramètres reste le contrat d'UI, indépendant du langage du
  moteur (même principe que `kick`).
- Changement de modèle nécessaire : le moteur passe d'une fonction batch
  `(params) -> buffer complet` à un générateur par blocs avec état persistant (phase
  d'oscillateur, valeur d'enveloppe courante conservées entre appels) — condition requise pour
  un vrai temps réel.

## Phase 1 — Toolchain Rust et portage du moteur en générateur par blocs [TODO]

Zone : explo

- Mettre en place un crate Rust (`explo/plugins/kick_live/engine_rs/`) avec toolchain de build
  (cargo, wasm-pack, maturin).
- Concevoir le modèle de voix : état interne (phase, temps écoulé, enveloppes courantes),
  `process(n_samples) -> buffer` appelé en boucle par bloc, `trigger(params, velocity)` qui
  réinitialise l'état, `set_param(id, value)` avec lissage inter-bloc pour éviter les clics.
- Porter les couches DSP du kick (corps, sub, click, bruit) et les primitives communes
  (drive, bandpass, highpass, étage de sortie) vers ce modèle, en s'appuyant sur la logique de
  `plugins/kick/engine.py` et `plugins/_common/dsp.py` comme référence de calcul — logique
  reprise, code non copié.
- Tests : rendu du crate en mode batch (blocs enchaînés) comparé aux presets de référence
  `kick` avec tolérance définie (réorganisation en blocs, pas garanti bit-exact) ; absence de
  discontinuité aux frontières de bloc ; absence de clic à un changement de paramètre en cours
  de note ; validation des bornes de paramètres.

**⏸ Checkpoint** — Demander à l'utilisateur de faire `/compact` avant de continuer.
Attendre sa réponse écrite. Ne pas commencer la phase suivante sans confirmation.

## Phase 2 — Liaison Python (PyO3) et rendu offline [TODO]

Zone : explo

- Exposer le crate Rust en module Python via PyO3/maturin : fonction de rendu batch équivalente
  à l'actuel `render(params, velocity, sample_rate) -> np.ndarray`.
- Créer le plugin `kick_live` : manifeste JSON (paramètres, presets), inspiré du contrat de
  `kick` sans dépendre de son code.
- Générer les WAV de référence par preset et leurs empreintes SHA-256.
- Tests : validation du manifeste contre son schéma, déterminisme du rendu offline,
  non-régression sur les empreintes des presets, absence de clipping / valeurs non finies.

**⏸ Checkpoint** — Demander à l'utilisateur de faire `/compact` avant de continuer.
Attendre sa réponse écrite. Ne pas commencer la phase suivante sans confirmation.

## Phase 3 — Compilation WASM et intégration AudioWorklet [TODO]

Zone : crea_zik (frontend)

- Compiler le crate Rust en WASM (wasm-pack), exposé comme asset servi par le frontend.
- Écrire l'AudioWorkletProcessor qui instancie la voix WASM et produit l'audio bloc par bloc
  dans le thread audio du navigateur.
- Définir le canal paramètres UI → thread audio (SharedArrayBuffer ou postMessage) ; si
  SharedArrayBuffer, poser l'exigence d'isolation cross-origin (en-têtes COOP/COEP) sur le
  serveur.
- Tests : le rendu de l'AudioWorklet pour des paramètres figés converge vers le rendu offline
  PyO3 (tolérance définie) ; latence mesurée entre changement de slider et audible (cible à
  fixer) ; absence de sous-flux audio (underrun) sous charge normale.

**⏸ Checkpoint** — Demander à l'utilisateur de faire `/compact` avant de continuer.
Attendre sa réponse écrite. Ne pas commencer la phase suivante sans confirmation.

## Phase 4 — Backend : exposition du plugin live [TODO]

Zone : crea_zik (backend)

- Étendre `/api/plugins` pour distinguer les plugins offline (comme `kick`) et live (comme
  `kick_live`) via un champ du manifeste (ex. `kind`).
- Servir le binaire WASM et le manifeste du plugin `kick_live`.
- Tests : découverte du plugin `kick_live` dans la liste, service du binaire WASM,
  non-régression de la liste/rendu des plugins offline existants (`kick` inchangé).

**⏸ Checkpoint** — Demander à l'utilisateur de faire `/compact` avant de continuer.
Attendre sa réponse écrite. Ne pas commencer la phase suivante sans confirmation.

## Phase 5 — Banc de test temps réel (UI) [TODO]

Zone : crea_zik (frontend)

- Nouvel écran (ou mode) du banc de test pour les plugins live : déclenchement en boucle avec
  tempo réglable, contrôles générés depuis le manifeste comme en mode offline, mais chaque
  changement envoyé directement au thread audio (pas de round-trip HTTP, pas de debounce).
- Le mode offline existant reste intact pour les plugins sans moteur live (dont `kick`).
- Tests : contrôle manuel en écoute (ajouté à `tests_manuels.md` le moment venu, non testable
  unitairement) ; tests d'intégration sur le câblage paramètre → AudioWorklet (valeur envoyée
  correspond à la valeur affichée).

**⏸ Checkpoint** — Demander à l'utilisateur de faire `/compact` avant de continuer.
Attendre sa réponse écrite. Ne pas commencer la phase suivante sans confirmation.

## Limite connue

L'archivage versionné et la promotion vers le moteur de composition (chemin
`plugin_id`/`plugin_preset`/`plugin_overrides`, cf. action ouverte dans `_contexte/signals.md`)
ne sont pas couverts par cette roadmap. `kick_live` est un instrument jouable en banc de test ;
son intégration éventuelle à une composition ou à l'archivage sera une roadmap séparée si le
besoin se confirme.
