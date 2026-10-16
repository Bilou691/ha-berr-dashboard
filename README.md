# 🏠 Berr Dashboard — thème + cartes perso pour Home Assistant

Thème sombre **verre dépoli + accents ambre** et 6 cartes perso, pensés pour une tablette murale.
Un seul fichier JavaScript, aucune dépendance, pas de HACS obligatoire.

> Par **BERR'INFO** · berrinfo.fr

---

## 📦 Contenu

| Dossier | Ce qu'il y a dedans |
|---|---|
| `themes/berr-glass.yaml` | Le thème **Berr Glass** (mode sombre + clair) |
| `www/berr-cards/berr-cards.js` | Les 6 cartes perso |
| `dashboards/maison.yaml` | Un dashboard d'exemple prêt à coller |
| `preview/index.html` | Une page d'aperçu avec une fausse maison (pour tester sans HA) |

### Les cartes

| Carte | À quoi elle sert |
|---|---|
| `custom:berr-header-card` | Horloge, date, « Bonsoir Bilou », météo, petites pastilles d'état |
| `custom:berr-tile-card` | Tuile lumineuse : serrure, alarme, robinet, lumière, fuite… |
| `custom:berr-room-card` | Une pièce : lumières en pastilles, température, « Tout éteindre » |
| `custom:berr-media-card` | Lecture en cours : jaquette, fond flouté, progression en direct, commandes |
| `custom:berr-vacuum-card` | Robot aspirateur : anneau de batterie, robot qui tourne pendant le ménage |
| `custom:berr-sensor-card` | Valeur + mini-graphe lissé sur 24 h (conso, température…) |

---

## 🚀 Installation (10 minutes)

### 1. Copier les fichiers

Avec l'add-on **File editor** ou **Samba** :

```
/config/themes/berr-glass.yaml              ← themes/berr-glass.yaml
/config/www/berr-cards/berr-cards.js        ← www/berr-cards/berr-cards.js
```

> Si le dossier `/config/www` n'existait pas, **redémarre HA** après l'avoir créé.

### 2. Activer les thèmes

Dans `configuration.yaml` (si ce n'est pas déjà fait) :

```yaml
frontend:
  themes: !include_dir_merge_named themes
```

Puis **Outils de développement → YAML → Thèmes → Recharger**.

### 3. Déclarer les cartes

**Paramètres → Tableaux de bord → ⋮ (en haut à droite) → Ressources → Ajouter une ressource**

- URL : `/local/berr-cards/berr-cards.js?v=1.0.0`
- Type : **Module JavaScript**

> ⚠️ Quand tu mets à jour le fichier, change le `?v=` (ex. `?v=1.0.1`), sinon la tablette garde l'ancienne version en cache.

### 4. Choisir le thème

Ton **Profil** (en bas à gauche) → **Thème** → `Berr Glass`.
Sur la tablette, fais pareil depuis son propre profil.

### 5. Créer le dashboard

**Paramètres → Tableaux de bord → Ajouter → Nouveau tableau de bord à partir de zéro**,
ouvre-le, **⋮ → Modifier → ⋮ → Éditeur de configuration brute**, colle `dashboards/maison.yaml`.

👉 **Remplace tous les entity_id marqués `# À ADAPTER`** par les tiens
(Outils de développement → États pour les retrouver). Une entité qui n'existe pas
s'affiche « Introuvable », rien ne plante.

---

## ⚙️ Options des cartes

### berr-tile-card

```yaml
type: custom:berr-tile-card
entity: lock.porte_entree
name: Serrure              # optionnel
icon: mdi:lock             # optionnel
layout: vertical           # ou horizontal
tap_action: toggle         # toggle | more-info | none
# tap_action:
#   service: script.bonne_nuit
#   data: {}
# tap_action:
#   navigation_path: /dashboard-maison/cuisine
tones:                     # optionnel : forcer une couleur pour un état
  "on": alert              # active | alert | ok | info | blue | off
confirm: true              # serrures : demande confirmation avant de déverrouiller
```

Appui court = action, **appui long = fenêtre détail** de l'entité.

### berr-room-card

```yaml
type: custom:berr-room-card
name: Salon
icon: mdi:sofa-outline
temperature: sensor.salon_temperature   # optionnel
humidity: sensor.salon_humidite         # optionnel
navigation_path: /dashboard-maison/salon  # optionnel (clic sur le titre)
entities:
  - light.salon
  - entity: light.lampadaire
    name: Lampadaire
    icon: mdi:floor-lamp
```

« Tout éteindre » n'agit que sur les lumières, prises, ventilos et `input_boolean`
(jamais sur une serrure ou un volet).

### berr-media-card

```yaml
type: custom:berr-media-card
entity: media_player.tv_salon
name: TV Salon       # optionnel
show_volume: true    # boutons volume +/-
```

Marche avec tout `media_player` qui remonte une jaquette : Plex, Apple TV, Android TV,
Philips TV, Alexa Media Player (Echo), Spotify…

### berr-vacuum-card

```yaml
type: custom:berr-vacuum-card
entity: vacuum.wall_e
name: WALL-E
battery: sensor.wall_e_battery_level   # optionnel
stats:                                 # optionnel
  - entity: sensor.wall_e_cleaned_area
    name: Surface
```

Testé pour l'intégration Dreame (L40 Ultra), compatible avec tout `vacuum`.

### berr-header-card

```yaml
type: custom:berr-header-card
user: Bilou                    # sinon le prénom du compte HA connecté
name: Maison                   # optionnel
weather: weather.maison        # optionnel
chips:                         # optionnel
  - alarm_control_panel.alarme
  - person.bilou
```

### berr-sensor-card

```yaml
type: custom:berr-sensor-card
entity: sensor.puissance_maison
name: Conso instantanée
icon: mdi:flash
hours: 24          # période du graphe
tone: active       # couleur : active | ok | info | blue | alert
decimals: 0
```

Le graphe utilise l'historique HA (recorder). Il se recharge toutes les 5 minutes.

---

## 📱 Mode tablette murale

- **Fully Kiosk Browser** (Android) : plein écran, écran qui s'allume quand on passe devant.
- Ou l'app Companion + **kiosk-mode** (HACS) pour cacher la barre du haut et le menu.
- Le mode clair du thème est là si la tablette est en plein soleil.

---

## 👀 Tester sans Home Assistant

```bash
cd ha-berr-dashboard
python -m http.server 8000
```

Puis ouvre http://localhost:8000/preview/ : une fausse maison, tout est cliquable.

---

## 🛠️ Dépannage

| Problème | Solution |
|---|---|
| « Custom element doesn't exist: berr-… » | Ressource mal ajoutée → vérifie l'URL `/local/berr-cards/berr-cards.js` et le type **Module** |
| Les modifs n'apparaissent pas | Change `?v=` dans la ressource + vide le cache (ou ferme/rouvre l'app) |
| Le thème n'apparaît pas | `frontend: themes:` manquant, ou pas rechargé |
| Le graphe reste sur « Chargement… » | L'entité n'est pas enregistrée par le recorder, ou n'est pas numérique |
| Effet « verre » absent | Navigateur trop ancien (il faut Chrome 111+ / Safari 16.2+) |

---

Licence MIT — fais-en ce que tu veux 🙂
