/* =====================================================================
 *  BERR Cards — cartes perso pour Home Assistant
 *  Par BERR'INFO · Licence MIT
 *
 *  Un seul fichier, aucune dépendance, aucun "build" à faire.
 *  Cartes incluses :
 *    - custom:berr-header-card   → horloge, date, salutation, météo
 *    - custom:berr-tile-card     → tuile d'état (serrure, alarme, vanne…)
 *    - custom:berr-room-card     → une pièce et ses lumières
 *    - custom:berr-media-card    → lecture en cours avec jaquette
 *    - custom:berr-vacuum-card   → robot aspirateur (Dreame & co)
 *    - custom:berr-sensor-card   → valeur + mini-graphe 24 h
 * ===================================================================== */

const BERR_VERSION = "1.0.0";

/* ---------------------------------------------------------------------
 *  1. Petits utilitaires
 * ------------------------------------------------------------------- */

// Échappe le texte avant de l'injecter dans le HTML (évite les surprises)
const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// "light.salon" → "light"
const domainOf = (entityId) => (entityId || "").split(".")[0];

// Nom affiché : config > friendly_name > entity_id
const nameOf = (stateObj, config) =>
  config?.name || stateObj?.attributes?.friendly_name || stateObj?.entity_id || "Inconnu";

// État traduit par HA (en français si ton profil HA est en français)
const formatState = (hass, stateObj) => {
  if (!stateObj) return "Introuvable";
  try {
    if (hass.formatEntityState) return hass.formatEntityState(stateObj);
  } catch (e) { /* vieille version de HA : on retombe sur l'état brut */ }
  return stateObj.state;
};

// Format "1:48:13" ou "4:07"
const fmtDuration = (sec) => {
  sec = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const mm = h ? String(m).padStart(2, "0") : m;
  return `${h ? h + ":" : ""}${mm}:${String(s).padStart(2, "0")}`;
};

// Premier entity_id trouvé pour un domaine (sert au sélecteur de cartes)
const firstEntity = (hass, domains) =>
  Object.keys(hass?.states || {}).find((id) => domains.includes(domainOf(id))) || "";

/* ---------------------------------------------------------------------
 *  2. Icônes par défaut et "tonalité" (couleur) selon l'état
 * ------------------------------------------------------------------- */

function defaultIcon(stateObj) {
  if (!stateObj) return "mdi:help-circle-outline";
  if (stateObj.attributes?.icon) return stateObj.attributes.icon;
  const d = domainOf(stateObj.entity_id);
  const s = stateObj.state;
  const dc = stateObj.attributes?.device_class;
  switch (d) {
    case "light": return s === "on" ? "mdi:lightbulb" : "mdi:lightbulb-outline";
    case "switch": return s === "on" ? "mdi:power-plug" : "mdi:power-plug-off-outline";
    case "lock": return s === "locked" ? "mdi:lock" : "mdi:lock-open-variant";
    case "alarm_control_panel": return s === "disarmed" ? "mdi:shield-off-outline" : "mdi:shield-home";
    case "valve": return s === "open" ? "mdi:valve-open" : "mdi:valve-closed";
    case "cover": return s === "open" ? "mdi:window-shutter-open" : "mdi:window-shutter";
    case "media_player": return "mdi:television-play";
    case "vacuum": return "mdi:robot-vacuum";
    case "climate": return "mdi:thermostat";
    case "fan": return "mdi:fan";
    case "scene": return "mdi:palette";
    case "script": return "mdi:script-text-play";
    case "input_boolean": return s === "on" ? "mdi:toggle-switch" : "mdi:toggle-switch-off-outline";
    case "person": return s === "home" ? "mdi:account" : "mdi:account-arrow-right";
    case "weather": return "mdi:weather-partly-cloudy";
    case "binary_sensor":
      if (dc === "moisture") return s === "on" ? "mdi:water-alert" : "mdi:water-check";
      if (["door", "opening", "garage_door"].includes(dc)) return s === "on" ? "mdi:door-open" : "mdi:door-closed";
      if (dc === "window") return s === "on" ? "mdi:window-open-variant" : "mdi:window-closed-variant";
      if (dc === "motion" || dc === "occupancy") return s === "on" ? "mdi:motion-sensor" : "mdi:motion-sensor-off";
      if (dc === "smoke") return "mdi:smoke-detector-variant";
      return "mdi:checkbox-blank-circle-outline";
    case "sensor":
      if (dc === "temperature") return "mdi:thermometer";
      if (dc === "humidity") return "mdi:water-percent";
      if (dc === "power") return "mdi:flash";
      if (dc === "energy") return "mdi:lightning-bolt";
      if (dc === "battery") return "mdi:battery";
      return "mdi:gauge";
    default: return "mdi:circle-medium";
  }
}

/*  Tonalités disponibles :
 *   active → ambre  (allumé, en marche)
 *   alert  → rouge  (serrure ouverte, fuite, alarme déclenchée)
 *   ok     → vert   (verrouillé, alarme armée, présent)
 *   info   → violet (multimédia, ouverture)
 *   blue   → bleu
 *   off    → gris
 *  On peut forcer dans la config : tones: { "on": "alert", "off": "ok" }  */
function toneFor(stateObj, overrides) {
  if (!stateObj) return "off";
  const s = stateObj.state;
  if (overrides && overrides[s]) return overrides[s];
  const d = domainOf(stateObj.entity_id);
  const dc = stateObj.attributes?.device_class;
  if (["unavailable", "unknown"].includes(s)) return "off";
  switch (d) {
    case "lock":
      if (s === "locked") return "ok";
      return ["unlocked", "open", "jammed"].includes(s) ? "alert" : "info";
    case "alarm_control_panel":
      if (s === "disarmed") return "off";
      if (s === "triggered") return "alert";
      return s.startsWith("armed") ? "ok" : "info";
    case "binary_sensor":
      if (s !== "on") return "off";
      if (["moisture", "smoke", "gas", "problem", "safety", "carbon_monoxide", "tamper"].includes(dc)) return "alert";
      if (["door", "window", "opening", "garage_door"].includes(dc)) return "blue";
      return "active";
    case "valve": return s === "open" ? "blue" : "off";
    case "cover": return ["open", "opening"].includes(s) ? "active" : "off";
    case "climate": return s === "off" ? "off" : "active";
    case "media_player": return s === "playing" ? "info" : ["paused", "on", "idle"].includes(s) ? "active" : "off";
    case "person":
    case "device_tracker": return s === "home" ? "ok" : "off";
    case "vacuum": return s === "cleaning" ? "active" : s === "error" ? "alert" : "off";
    default: return ["on", "open", "home", "playing"].includes(s) ? "active" : "off";
  }
}

/* ---------------------------------------------------------------------
 *  3. Actions (appui court / appui long)
 * ------------------------------------------------------------------- */

const TOGGLE_DOMAINS = ["light", "switch", "fan", "input_boolean", "lock", "valve", "cover", "scene", "script", "button", "automation", "siren", "humidifier"];

function fireMoreInfo(el, entityId) {
  el.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId }, bubbles: true, composed: true }));
}

function navigate(path) {
  history.pushState(null, "", path);
  window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
}

// Bascule une entité selon son domaine
async function toggleEntity(hass, stateObj, config) {
  const id = stateObj.entity_id;
  const d = domainOf(id);
  const s = stateObj.state;
  switch (d) {
    case "lock": {
      const unlocking = s === "locked";
      // ⚠️ Sécurité : on demande confirmation avant de déverrouiller
      if (unlocking && config?.confirm !== false && !window.confirm(`Déverrouiller « ${nameOf(stateObj, config)} » ?`)) return;
      return hass.callService("lock", unlocking ? "unlock" : "lock", { entity_id: id });
    }
    case "valve": return hass.callService("valve", s === "open" ? "close_valve" : "open_valve", { entity_id: id });
    case "cover": return hass.callService("cover", "toggle", { entity_id: id });
    case "scene": return hass.callService("scene", "turn_on", { entity_id: id });
    case "script": return hass.callService("script", "turn_on", { entity_id: id });
    case "button": return hass.callService("button", "press", { entity_id: id });
    default: return hass.callService("homeassistant", "toggle", { entity_id: id });
  }
}

/*  action peut valoir :
 *   "toggle" | "more-info" | "none"
 *   { navigation_path: "/lovelace/cuisine" }
 *   { service: "script.bonne_nuit", data: {...} }                        */
async function runAction(el, hass, stateObj, action, config) {
  if (!stateObj && typeof action !== "object") return;
  if (!action) action = stateObj && TOGGLE_DOMAINS.includes(domainOf(stateObj.entity_id)) ? "toggle" : "more-info";
  try {
    if (action === "none") return;
    if (action === "more-info") return fireMoreInfo(el, stateObj.entity_id);
    if (action === "toggle") return await toggleEntity(hass, stateObj, config);
    if (action.navigation_path) return navigate(action.navigation_path);
    if (action.service) {
      const [dom, srv] = action.service.split(".");
      return await hass.callService(dom, srv, action.data || action.service_data || {});
    }
  } catch (err) {
    console.error("[berr-cards] Action impossible :", err);
  }
}

// Branche appui court + appui long (500 ms) sur un élément
function bindPress(el, onTap, onHold) {
  let timer = null, held = false;
  const start = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    held = false;
    timer = setTimeout(() => { held = true; onHold && onHold(); }, 500);
  };
  const cancel = () => clearTimeout(timer);
  el.addEventListener("pointerdown", start);
  el.addEventListener("pointerleave", cancel);
  el.addEventListener("pointercancel", cancel);
  el.addEventListener("pointerup", cancel);
  el.addEventListener("click", (e) => {
    e.stopPropagation();
    if (held) { held = false; return; }
    onTap && onTap();
  });
  el.addEventListener("contextmenu", (e) => e.preventDefault());
}

/* ---------------------------------------------------------------------
 *  4. Styles communs (verre dépoli + tonalités)
 * ------------------------------------------------------------------- */

const BASE_CSS = `
  :host {
    --b-accent: var(--berr-accent, #f5b544);
    --b-alert: var(--berr-alert, #ff5d5d);
    --b-ok: var(--berr-ok, #3ddc97);
    --b-info: var(--berr-info, #8b7cf6);
    --b-blue: var(--berr-blue, #4cc2ff);
    --b-card: var(--berr-card-bg, rgba(22, 29, 45, 0.72));
    --b-border: var(--berr-card-border, rgba(255, 255, 255, 0.07));
    --b-text: var(--primary-text-color, #eef1f7);
    --b-muted: var(--secondary-text-color, #8b93a7);
    --b-radius: var(--berr-radius, 22px);
    display: block;
    height: 100%;
  }
  * { box-sizing: border-box; }
  .card {
    position: relative; height: 100%;
    background: var(--b-card);
    border: 1px solid var(--b-border);
    border-radius: var(--b-radius);
    -webkit-backdrop-filter: blur(18px) saturate(140%);
    backdrop-filter: blur(18px) saturate(140%);
    box-shadow: 0 10px 30px -12px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.04);
    color: var(--b-text);
    overflow: hidden;
    font-family: var(--berr-font, 'Inter', 'Segoe UI', system-ui, sans-serif);
    -webkit-tap-highlight-color: transparent;
  }
  .clickable { cursor: pointer; user-select: none; transition: transform .15s ease, border-color .25s, box-shadow .25s; }
  .clickable:active { transform: scale(.97); }

  .tone-active { --tone: var(--b-accent); }
  .tone-alert  { --tone: var(--b-alert); }
  .tone-ok     { --tone: var(--b-ok); }
  .tone-info   { --tone: var(--b-info); }
  .tone-blue   { --tone: var(--b-blue); }
  .tone-off    { --tone: var(--b-muted); }

  .eyebrow {
    font-size: 10.5px; font-weight: 700; letter-spacing: .14em;
    text-transform: uppercase; color: var(--b-muted);
  }
  .iconbox {
    width: 44px; height: 44px; flex: none; border-radius: 14px;
    display: grid; place-items: center;
    background: rgba(255,255,255,.06); color: var(--b-muted);
    transition: background .3s, color .3s, box-shadow .3s;
  }
  .iconbox ha-icon { --mdc-icon-size: 24px; }
  .lit .iconbox, .iconbox.lit {
    background: color-mix(in srgb, var(--tone) 18%, transparent);
    color: var(--tone);
    box-shadow: 0 0 26px -6px color-mix(in srgb, var(--tone) 70%, transparent);
  }
  .lit.card { border-color: color-mix(in srgb, var(--tone) 28%, var(--b-border)); }
  .state-txt { color: var(--b-muted); font-weight: 600; }
  .lit .state-txt { color: var(--tone); }

  .btn {
    border: 1px solid var(--b-border); background: rgba(255,255,255,.05);
    color: var(--b-text); border-radius: 14px; height: 40px; padding: 0 14px;
    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    font: 600 13px/1 inherit; font-family: inherit; cursor: pointer;
    transition: background .2s, transform .12s;
  }
  .btn:hover { background: rgba(255,255,255,.09); }
  .btn:active { transform: scale(.95); }
  .btn ha-icon { --mdc-icon-size: 20px; }
  .btn.primary {
    background: color-mix(in srgb, var(--b-accent) 20%, transparent);
    border-color: color-mix(in srgb, var(--b-accent) 40%, transparent);
    color: var(--b-accent);
  }
  .btn.round { width: 40px; padding: 0; border-radius: 50%; }

  @keyframes berr-pulse { 0%,100% { opacity: 1; } 50% { opacity: .35; } }
  @keyframes berr-spin { to { transform: rotate(360deg); } }
  @keyframes berr-eq { 0%,100% { transform: scaleY(.3); } 50% { transform: scaleY(1); } }
  @media (prefers-reduced-motion: reduce) { * { animation: none !important; } }
`;

/* ---------------------------------------------------------------------
 *  5. Classe de base : gère hass, la config et le rendu
 * ------------------------------------------------------------------- */

class BerrBase extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  setConfig(config) {
    if (!config) throw new Error("Configuration manquante");
    this._validate(config);
    this._config = { ...config };
    if (this._hass) this._render();
  }

  // Appelé par HA à chaque changement d'état de la maison
  set hass(hass) {
    const old = this._hass;
    this._hass = hass;
    if (!this._config) return;
    // On ne redessine que si une de NOS entités a bougé (perf tablette)
    if (!old || this._watched().some((id) => old.states[id] !== hass.states[id])) this._render();
  }
  get hass() { return this._hass; }

  _validate(_config) {}
  _watched() { return [this._config?.entity].filter(Boolean); }
  _state(id) { return this._hass?.states?.[id]; }
  getCardSize() { return 2; }

  // Écrit le HTML dans le shadow DOM avec les styles
  _paint(css, html) {
    this.shadowRoot.innerHTML = `<style>${BASE_CSS}${css}</style>${html}`;
  }
}

/* =====================================================================
 *  CARTE 1 : berr-header-card
 *  type: custom:berr-header-card
 *  name: Maison                    (optionnel)
 *  user: Bilou                     (optionnel, sinon nom du compte HA)
 *  weather: weather.maison         (optionnel)
 *  chips: [alarm_control_panel.maison, person.bilou]  (optionnel)
 * ===================================================================== */
const WEATHER_ICONS = {
  "clear-night": "mdi:weather-night", cloudy: "mdi:weather-cloudy", fog: "mdi:weather-fog",
  hail: "mdi:weather-hail", lightning: "mdi:weather-lightning", "lightning-rainy": "mdi:weather-lightning-rainy",
  partlycloudy: "mdi:weather-partly-cloudy", pouring: "mdi:weather-pouring", rainy: "mdi:weather-rainy",
  snowy: "mdi:weather-snowy", "snowy-rainy": "mdi:weather-snowy-rainy", sunny: "mdi:weather-sunny",
  windy: "mdi:weather-windy", "windy-variant": "mdi:weather-windy-variant", exceptional: "mdi:alert-circle-outline",
};

class BerrHeaderCard extends BerrBase {
  _watched() { return [this._config.weather, ...(this._config.chips || [])].filter(Boolean); }

  connectedCallback() {
    // L'horloge se met à jour toutes les 10 secondes
    this._clock = setInterval(() => this._tick(), 10000);
  }
  disconnectedCallback() { clearInterval(this._clock); }

  _tick() {
    const t = this.shadowRoot.querySelector(".time");
    const d = this.shadowRoot.querySelector(".date");
    if (!t) return;
    const now = new Date();
    t.textContent = now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    d.textContent = now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  }

  _greeting() {
    const h = new Date().getHours();
    const who = this._config.user || this._hass?.user?.name?.split(" ")[0] || "";
    const hello = h < 5 ? "Bonne nuit" : h < 12 ? "Bonjour" : h < 18 ? "Bon après-midi" : "Bonsoir";
    return who ? `${hello} ${who}` : hello;
  }

  _render() {
    const c = this._config;
    const w = c.weather ? this._state(c.weather) : null;
    const unit = w?.attributes?.temperature_unit || "°";
    const weatherHtml = w ? `
      <div class="weather">
        <ha-icon icon="${WEATHER_ICONS[w.state] || "mdi:weather-partly-cloudy"}"></ha-icon>
        <div>
          <div class="w-temp">${esc(Math.round(w.attributes.temperature ?? 0))}${esc(unit.replace("C", "").replace("F", ""))}</div>
          <div class="w-cond">${esc(formatState(this._hass, w))}</div>
        </div>
      </div>` : "";

    const chips = (c.chips || []).map((id) => {
      const so = this._state(id);
      const tone = toneFor(so);
      return `<button class="chip tone-${tone} ${tone !== "off" ? "lit" : ""}" data-id="${esc(id)}">
        <ha-icon icon="${esc(defaultIcon(so))}"></ha-icon><span>${esc(formatState(this._hass, so))}</span></button>`;
    }).join("");

    this._paint(`
      .card { padding: 22px 24px; display: flex; flex-direction: column; gap: 16px; }
      .row { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; }
      .time { font-size: 56px; font-weight: 300; letter-spacing: -.03em; line-height: .95; font-variant-numeric: tabular-nums; }
      .date { margin-top: 6px; font-size: 15px; color: var(--b-muted); text-transform: capitalize; }
      .hello { font-size: 13px; font-weight: 600; color: var(--b-accent); margin-bottom: 8px; }
      .weather { display: flex; align-items: center; gap: 10px; text-align: right; }
      .weather ha-icon { --mdc-icon-size: 40px; color: var(--b-accent); filter: drop-shadow(0 0 12px color-mix(in srgb, var(--b-accent) 50%, transparent)); }
      .w-temp { font-size: 28px; font-weight: 600; }
      .w-cond { font-size: 12px; color: var(--b-muted); }
      .chips { display: flex; flex-wrap: wrap; gap: 8px; }
      .chip { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px 6px 8px; border-radius: 999px;
        border: 1px solid var(--b-border); background: rgba(255,255,255,.04); color: var(--b-muted);
        font: 600 12px/1 inherit; font-family: inherit; cursor: pointer; }
      .chip ha-icon { --mdc-icon-size: 16px; }
      .chip.lit { color: var(--tone); border-color: color-mix(in srgb, var(--tone) 35%, transparent);
        background: color-mix(in srgb, var(--tone) 12%, transparent); }
    `, `
      <div class="card">
        <div class="row">
          <div>
            <div class="hello">${esc(this._greeting())}${c.name ? ` · ${esc(c.name)}` : ""}</div>
            <div class="time"></div>
            <div class="date"></div>
          </div>
          ${weatherHtml}
        </div>
        ${chips ? `<div class="chips">${chips}</div>` : ""}
      </div>`);
    this._tick();
    this.shadowRoot.querySelectorAll(".chip").forEach((el) =>
      el.addEventListener("click", () => fireMoreInfo(this, el.dataset.id)));
    if (w) this.shadowRoot.querySelector(".weather").addEventListener("click", () => fireMoreInfo(this, c.weather));
  }

  getCardSize() { return 3; }
  getGridOptions() { return { columns: 12, rows: 3, min_columns: 6 }; }
  static getStubConfig(hass) { return { weather: firstEntity(hass, ["weather"]) }; }
}

/* =====================================================================
 *  CARTE 2 : berr-tile-card
 *  type: custom:berr-tile-card
 *  entity: lock.porte_entree
 *  name: Serrure                (optionnel)
 *  icon: mdi:lock               (optionnel)
 *  layout: vertical | horizontal  (défaut : vertical)
 *  tap_action: toggle | more-info | none | {service…} | {navigation_path…}
 *  tones: { "on": "alert" }     (optionnel, force la couleur d'un état)
 *  confirm: false               (désactive la confirmation pour les serrures)
 * ===================================================================== */
class BerrTileCard extends BerrBase {
  _validate(c) { if (!c.entity) throw new Error("berr-tile-card : il faut une 'entity'"); }

  _render() {
    const c = this._config;
    const so = this._state(c.entity);
    const tone = toneFor(so, c.tones);
    const lit = tone !== "off";
    const horizontal = c.layout === "horizontal";
    this._paint(`
      .card { padding: 16px; display: flex; flex-direction: column; align-items: center; justify-content: center;
        gap: 10px; text-align: center; min-height: 124px; }
      .card.h { flex-direction: row; justify-content: flex-start; text-align: left; min-height: 72px; padding: 14px 16px; gap: 12px; }
      .name { font-weight: 700; font-size: 14px; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
      .state-txt { font-size: 12px; margin-top: 3px; text-transform: capitalize; }
      .txt { min-width: 0; max-width: 100%; }
      .pulse { position: absolute; top: 12px; right: 12px; width: 8px; height: 8px; border-radius: 50%;
        background: var(--b-alert); box-shadow: 0 0 10px var(--b-alert); animation: berr-pulse 1.4s infinite; }
    `, `
      <div class="card clickable tone-${tone} ${lit ? "lit" : ""} ${horizontal ? "h" : ""}">
        ${tone === "alert" ? `<span class="pulse"></span>` : ""}
        <div class="iconbox"><ha-icon icon="${esc(c.icon || defaultIcon(so))}"></ha-icon></div>
        <div class="txt">
          <div class="name">${esc(nameOf(so, c))}</div>
          <div class="state-txt">${esc(formatState(this._hass, so))}</div>
        </div>
      </div>`);
    bindPress(this.shadowRoot.querySelector(".card"),
      () => runAction(this, this._hass, this._state(c.entity), c.tap_action, c),
      () => so && fireMoreInfo(this, c.entity));
  }

  getCardSize() { return this._config?.layout === "horizontal" ? 1 : 2; }
  getGridOptions() { return this._config?.layout === "horizontal" ? { columns: 6, rows: 1 } : { columns: 3, rows: 2, min_columns: 3 }; }
  static getStubConfig(hass) { return { entity: firstEntity(hass, ["lock", "light", "switch", "alarm_control_panel"]) }; }
}

/* =====================================================================
 *  CARTE 3 : berr-room-card
 *  type: custom:berr-room-card
 *  name: Salon
 *  icon: mdi:sofa
 *  temperature: sensor.salon_temperature   (optionnel)
 *  humidity: sensor.salon_humidite         (optionnel)
 *  entities:
 *    - light.lampadaire
 *    - entity: light.petite_boule
 *      name: Petite boule
 *  navigation_path: /dashboard-maison/salon  (optionnel, clic sur le titre)
 * ===================================================================== */
class BerrRoomCard extends BerrBase {
  _validate(c) { if (!Array.isArray(c.entities) || !c.entities.length) throw new Error("berr-room-card : il faut une liste 'entities'"); }

  _items() {
    return this._config.entities.map((e) => (typeof e === "string" ? { entity: e } : e));
  }
  _watched() {
    return [...this._items().map((i) => i.entity), this._config.temperature, this._config.humidity].filter(Boolean);
  }

  _pillState(so) {
    if (!so) return "Introuvable";
    // Pour une lumière allumée avec variateur, on affiche le pourcentage
    if (domainOf(so.entity_id) === "light" && so.state === "on" && so.attributes.brightness != null)
      return `${Math.round((so.attributes.brightness / 255) * 100)} %`;
    return formatState(this._hass, so);
  }

  _render() {
    const c = this._config;
    const items = this._items();
    const onCount = items.filter((i) => toneFor(this._state(i.entity)) !== "off").length;
    const roomTone = onCount ? "active" : "off";
    const temp = c.temperature ? this._state(c.temperature) : null;
    const hum = c.humidity ? this._state(c.humidity) : null;
    const sensors = [
      temp && `<span><ha-icon icon="mdi:thermometer"></ha-icon>${esc(temp.state)}°</span>`,
      hum && `<span><ha-icon icon="mdi:water-percent"></ha-icon>${esc(hum.state)}%</span>`,
    ].filter(Boolean).join("");

    const pills = items.map((it, idx) => {
      const so = this._state(it.entity);
      const tone = toneFor(so, it.tones);
      return `<button class="pill tone-${tone} ${tone !== "off" ? "lit" : ""}" data-idx="${idx}">
        <span class="iconbox"><ha-icon icon="${esc(it.icon || defaultIcon(so))}"></ha-icon></span>
        <span class="ptxt"><span class="pname">${esc(nameOf(so, it))}</span>
        <span class="state-txt">${esc(this._pillState(so))}</span></span>
      </button>`;
    }).join("");

    this._paint(`
      .card { padding: 18px; display: flex; flex-direction: column; gap: 14px; }
      .head { display: flex; align-items: center; gap: 12px; }
      .head .titles { flex: 1; min-width: 0; }
      .title { font-size: 18px; font-weight: 700; }
      .head.nav { cursor: pointer; }
      .sensors { display: flex; gap: 10px; color: var(--b-muted); font-size: 13px; font-weight: 600; }
      .sensors span { display: inline-flex; align-items: center; gap: 2px; }
      .sensors ha-icon { --mdc-icon-size: 16px; }
      .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px; }
      .pill { display: flex; align-items: center; gap: 10px; padding: 8px; border-radius: 16px; text-align: left;
        background: rgba(255,255,255,.035); border: 1px solid var(--b-border); color: var(--b-text);
        font-family: inherit; cursor: pointer; transition: background .25s, border-color .25s, transform .12s; min-width: 0; }
      .pill:active { transform: scale(.96); }
      .pill.lit { background: color-mix(in srgb, var(--tone) 9%, transparent); border-color: color-mix(in srgb, var(--tone) 28%, transparent); }
      .pill .iconbox { width: 36px; height: 36px; border-radius: 12px; }
      .pill .iconbox ha-icon { --mdc-icon-size: 20px; }
      .ptxt { display: flex; flex-direction: column; min-width: 0; }
      .pname { font-size: 13px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .pill .state-txt { font-size: 11.5px; margin-top: 2px; }
      .foot { display: flex; align-items: center; justify-content: space-between; color: var(--b-muted); font-size: 12.5px; }
      .foot b { color: var(--b-accent); }
    `, `
      <div class="card tone-${roomTone} ${onCount ? "lit" : ""}">
        <div class="head ${c.navigation_path ? "nav" : ""}">
          <div class="iconbox"><ha-icon icon="${esc(c.icon || "mdi:home-variant-outline")}"></ha-icon></div>
          <div class="titles"><div class="eyebrow">Pièce</div><div class="title">${esc(c.name || "Pièce")}</div></div>
          ${sensors ? `<div class="sensors">${sensors}</div>` : ""}
        </div>
        <div class="grid">${pills}</div>
        <div class="foot">
          <span>${onCount ? `<b>${onCount}</b> allumé${onCount > 1 ? "s" : ""} sur ${items.length}` : "Tout est éteint"}</span>
          ${onCount ? `<button class="btn alloff"><ha-icon icon="mdi:power"></ha-icon>Tout éteindre</button>` : ""}
        </div>
      </div>`);

    this.shadowRoot.querySelectorAll(".pill").forEach((el) => {
      const it = items[+el.dataset.idx];
      bindPress(el,
        () => runAction(this, this._hass, this._state(it.entity), it.tap_action, it),
        () => fireMoreInfo(this, it.entity));
    });
    const off = this.shadowRoot.querySelector(".alloff");
    if (off) off.addEventListener("click", () => {
      const ids = items.map((i) => i.entity).filter((id) => ["light", "switch", "fan", "input_boolean"].includes(domainOf(id)));
      if (ids.length) this._hass.callService("homeassistant", "turn_off", { entity_id: ids });
    });
    if (c.navigation_path) this.shadowRoot.querySelector(".head").addEventListener("click", () => navigate(c.navigation_path));
  }

  getCardSize() { return 2 + Math.ceil(this._items().length / 2); }
  getGridOptions() { return { columns: 6, min_columns: 6 }; }
  static getStubConfig(hass) { return { name: "Salon", icon: "mdi:sofa", entities: [firstEntity(hass, ["light"])].filter(Boolean) }; }
}

/* =====================================================================
 *  CARTE 4 : berr-media-card
 *  type: custom:berr-media-card
 *  entity: media_player.apple_tv_salon
 *  name: Apple TV 4K       (optionnel)
 *  show_volume: true       (optionnel)
 * ===================================================================== */
class BerrMediaCard extends BerrBase {
  _validate(c) { if (!c.entity) throw new Error("berr-media-card : il faut une 'entity' media_player"); }

  connectedCallback() { this._timer = setInterval(() => this._tickProgress(), 1000); }
  disconnectedCallback() { clearInterval(this._timer); }

  // Position actuelle calculée en direct (HA ne pousse pas chaque seconde)
  _position(so) {
    const a = so.attributes;
    if (a.media_position == null) return null;
    let pos = a.media_position;
    if (so.state === "playing" && a.media_position_updated_at)
      pos += (Date.now() - new Date(a.media_position_updated_at).getTime()) / 1000;
    return Math.min(pos, a.media_duration || pos);
  }

  _tickProgress() {
    const so = this._state(this._config?.entity);
    if (!so || so.state !== "playing") return;
    const pos = this._position(so);
    const dur = so.attributes.media_duration;
    const bar = this.shadowRoot.querySelector(".bar i");
    const cur = this.shadowRoot.querySelector(".t-cur");
    if (bar && pos != null && dur) bar.style.width = `${(pos / dur) * 100}%`;
    if (cur && pos != null) cur.textContent = fmtDuration(pos);
  }

  _subtitle(a) {
    if (a.media_series_title) {
      const ep = a.media_season && a.media_episode ? ` · S${a.media_season}E${a.media_episode}` : "";
      return a.media_series_title + ep;
    }
    return a.media_artist || a.media_album_name || a.app_name || "";
  }

  _render() {
    const c = this._config;
    const so = this._state(c.entity);
    const a = so?.attributes || {};
    const st = so?.state || "unavailable";
    const active = ["playing", "paused", "buffering"].includes(st);
    const playing = st === "playing";
    const art = active ? a.entity_picture_local || a.entity_picture : null;
    const pos = so ? this._position(so) : null;
    const dur = a.media_duration;
    const pct = pos != null && dur ? (pos / dur) * 100 : 0;
    const source = c.name || a.friendly_name || "Lecteur";

    const label = playing ? "En lecture" : st === "paused" ? "En pause" : st === "off" ? "Éteint" : st === "unavailable" ? "Indisponible" : "En veille";

    this._paint(`
      .card { padding: 18px; min-height: 170px; }
      .bg { position: absolute; inset: -40px; background-size: cover; background-position: center;
        filter: blur(40px) saturate(160%); opacity: .45; transform: scale(1.1); transition: opacity .6s; }
      .bg::after { content: ""; position: absolute; inset: 0; background: linear-gradient(90deg, rgba(12,17,28,.9) 30%, rgba(12,17,28,.55)); }
      .inner { position: relative; display: flex; gap: 18px; align-items: stretch; }
      .meta { flex: 1; min-width: 0; display: flex; flex-direction: column; }
      .top { display: flex; align-items: center; gap: 8px; }
      .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--b-muted); }
      .playing .dot { background: var(--b-ok); box-shadow: 0 0 10px var(--b-ok); animation: berr-pulse 1.6s infinite; }
      .playing .eyebrow.lbl { color: var(--b-ok); }
      .src { margin-left: auto; font-size: 11px; color: var(--b-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .m-title { margin-top: 10px; font-size: 22px; font-weight: 800; letter-spacing: -.01em; line-height: 1.15;
        display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      .m-sub { margin-top: 4px; font-size: 13px; color: var(--b-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .progress { margin-top: auto; padding-top: 14px; }
      .bar { height: 4px; border-radius: 4px; background: rgba(255,255,255,.1); overflow: hidden; }
      .bar i { display: block; height: 100%; border-radius: 4px; background: linear-gradient(90deg, var(--b-accent), #ffd98a);
        box-shadow: 0 0 12px color-mix(in srgb, var(--b-accent) 60%, transparent); transition: width 1s linear; }
      .times { display: flex; justify-content: space-between; font-size: 11px; color: var(--b-muted); margin-top: 6px; font-variant-numeric: tabular-nums; }
      .controls { display: flex; align-items: center; gap: 8px; margin-top: 10px; }
      .controls .grow { flex: 1; }
      .art { width: 112px; flex: none; border-radius: 16px; overflow: hidden; aspect-ratio: 2/3; align-self: center;
        background: rgba(255,255,255,.05); display: grid; place-items: center; color: var(--b-muted);
        box-shadow: 0 12px 30px -10px rgba(0,0,0,.7); }
      .art img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .art ha-icon { --mdc-icon-size: 40px; }
      .art.square { aspect-ratio: 1; }
      .eq { display: flex; align-items: flex-end; gap: 3px; height: 22px; }
      .eq i { width: 4px; height: 100%; border-radius: 2px; background: var(--b-accent); transform-origin: bottom; transform: scaleY(.25); }
      .playing .eq i { animation: berr-eq 1s ease-in-out infinite; }
      .eq i:nth-child(2) { animation-delay: -.3s !important; } .eq i:nth-child(3) { animation-delay: -.6s !important; }
      .eq i:nth-child(4) { animation-delay: -.15s !important; } .eq i:nth-child(5) { animation-delay: -.45s !important; }
      .idle .m-title { font-size: 18px; color: var(--b-muted); font-weight: 600; }
      @media (max-width: 420px) { .art { width: 84px; } .m-title { font-size: 18px; } }
    `, `
      <div class="card ${playing ? "playing" : ""} ${active ? "" : "idle"}">
        ${art ? `<div class="bg" style="background-image:url('${esc(art)}')"></div>` : ""}
        <div class="inner">
          <div class="meta">
            <div class="top"><span class="dot"></span><span class="eyebrow lbl">${label}</span><span class="src">${esc(source)}</span></div>
            <div class="m-title">${esc(active ? a.media_title || a.app_name || "Lecture" : "Rien en lecture")}</div>
            <div class="m-sub">${esc(active ? this._subtitle(a) : source)}</div>
            ${active && dur ? `
            <div class="progress">
              <div class="bar"><i style="width:${pct}%"></i></div>
              <div class="times"><span class="t-cur">${fmtDuration(pos)}</span><span>${fmtDuration(dur)}</span></div>
            </div>` : ""}
            <div class="controls">
              ${active ? `
                <button class="btn round" data-srv="media_previous_track" title="Précédent"><ha-icon icon="mdi:skip-previous"></ha-icon></button>
                <button class="btn round primary" data-srv="media_play_pause" title="Lecture/Pause"><ha-icon icon="${playing ? "mdi:pause" : "mdi:play"}"></ha-icon></button>
                <button class="btn round" data-srv="media_next_track" title="Suivant"><ha-icon icon="mdi:skip-next"></ha-icon></button>
                ${c.show_volume !== false ? `
                <button class="btn round" data-srv="volume_down" title="Volume -"><ha-icon icon="mdi:volume-minus"></ha-icon></button>
                <button class="btn round" data-srv="volume_up" title="Volume +"><ha-icon icon="mdi:volume-plus"></ha-icon></button>` : ""}
              ` : `
                <button class="btn" data-srv="${st === "off" ? "turn_on" : "turn_off"}"><ha-icon icon="mdi:power"></ha-icon>${st === "off" ? "Allumer" : "Éteindre"}</button>
              `}
              <span class="grow"></span>
              <div class="eq"><i></i><i></i><i></i><i></i><i></i></div>
            </div>
          </div>
          <div class="art ${a.media_content_type === "music" ? "square" : ""}">
            ${art ? `<img src="${esc(art)}" alt="">` : `<ha-icon icon="mdi:movie-open-play-outline"></ha-icon>`}
          </div>
        </div>
      </div>`);

    this.shadowRoot.querySelectorAll("[data-srv]").forEach((b) =>
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        this._hass.callService("media_player", b.dataset.srv, { entity_id: c.entity });
      }));
    this.shadowRoot.querySelector(".art").addEventListener("click", () => fireMoreInfo(this, c.entity));
  }

  getCardSize() { return 4; }
  getGridOptions() { return { columns: 12, rows: 4, min_columns: 6 }; }
  static getStubConfig(hass) { return { entity: firstEntity(hass, ["media_player"]) }; }
}

/* =====================================================================
 *  CARTE 5 : berr-vacuum-card
 *  type: custom:berr-vacuum-card
 *  entity: vacuum.wall_e
 *  name: WALL-E
 *  battery: sensor.wall_e_batterie     (optionnel, sinon attribut battery_level)
 *  stats:                              (optionnel)
 *    - entity: sensor.wall_e_surface_nettoyee
 *      name: Surface
 *    - entity: sensor.wall_e_duree_nettoyage
 *      name: Durée
 * ===================================================================== */
const VACUUM_TEXT = {
  cleaning: "Nettoyage en cours", docked: "Prêt à nettoyer", idle: "En attente", paused: "En pause",
  returning: "Retour à la base", error: "Problème détecté", unavailable: "Indisponible",
};

class BerrVacuumCard extends BerrBase {
  _validate(c) { if (!c.entity) throw new Error("berr-vacuum-card : il faut une 'entity' vacuum"); }
  _watched() { return [this._config.entity, this._config.battery, ...(this._config.stats || []).map((s) => s.entity)].filter(Boolean); }

  _battery(so) {
    const b = this._config.battery ? this._state(this._config.battery)?.state : so?.attributes?.battery_level;
    const n = parseFloat(b);
    return isNaN(n) ? null : Math.round(n);
  }

  _render() {
    const c = this._config;
    const so = this._state(c.entity);
    const st = so?.state || "unavailable";
    const bat = this._battery(so);
    const cleaning = st === "cleaning";
    const tone = st === "error" ? "alert" : cleaning ? "active" : st === "returning" ? "info" : "ok";
    const charging = st === "docked" && bat != null && bat < 100;
    // Petite ligne sous l'état principal (sans répéter la même info)
    const sub = charging ? "En charge"
      : st === "docked" ? "Sur la base · batterie pleine"
      : bat != null ? `Batterie ${bat} %`
      : "";
    // Anneau de batterie (SVG)
    const R = 54, CIRC = 2 * Math.PI * R;
    const dash = bat != null ? (bat / 100) * CIRC : 0;
    const batColor = bat == null ? "var(--b-muted)" : bat < 20 ? "var(--b-alert)" : bat < 50 ? "var(--b-accent)" : "var(--b-ok)";

    const stats = (c.stats || []).map((s) => {
      const sso = this._state(s.entity);
      const unit = sso?.attributes?.unit_of_measurement || "";
      return `<div class="stat"><div class="eyebrow">${esc(s.name || nameOf(sso))}</div>
        <div class="sv">${esc(sso ? sso.state : "–")}<small>${esc(unit)}</small></div></div>`;
    }).join("");

    this._paint(`
      .card { padding: 18px; display: flex; flex-direction: column; gap: 14px; }
      .head { display: flex; align-items: center; gap: 12px; }
      .title { font-size: 18px; font-weight: 700; }
      .badge { margin-left: auto; display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700;
        letter-spacing: .08em; text-transform: uppercase; color: var(--b-ok); }
      .badge::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: currentColor; box-shadow: 0 0 8px currentColor; }
      .badge.off { color: var(--b-muted); }
      .body { display: flex; align-items: center; gap: 16px; }
      .info { flex: 1; min-width: 0; }
      .big { font-size: 26px; font-weight: 800; letter-spacing: -.01em; margin-top: 4px; line-height: 1.1; color: var(--tone); }
      .sub { font-size: 13px; color: var(--b-muted); margin-top: 6px; display: flex; align-items: center; gap: 6px; }
      .sub ha-icon { --mdc-icon-size: 16px; color: var(--b-accent); }
      .stats { display: flex; gap: 18px; margin-top: 14px; flex-wrap: wrap; }
      .sv { font-size: 18px; font-weight: 700; margin-top: 3px; } .sv small { font-size: 11px; color: var(--b-muted); margin-left: 2px; font-weight: 600; }
      .visual { position: relative; width: 132px; height: 132px; flex: none; margin-bottom: 18px; cursor: pointer; }
      .visual svg.ring-svg { width: 100%; height: 100%; }
      .ring-bg { stroke: rgba(255,255,255,.07); }
      .ring { transition: stroke-dasharray .8s ease; filter: drop-shadow(0 0 6px ${batColor}); }
      .robot { transform-origin: 66px 66px; }
      .cleaning .robot { animation: berr-spin 6s linear infinite; }
      .pct { position: absolute; left: 0; right: 0; bottom: -20px; text-align: center; font-size: 12px; font-weight: 700; color: ${batColor}; }
      .actions { display: flex; gap: 8px; flex-wrap: wrap; }
      .actions .btn { flex: 1; min-width: 96px; }
      @media (max-width: 380px) { .visual { width: 104px; height: 104px; } .big { font-size: 21px; } }
    `, `
      <div class="card tone-${tone} ${cleaning ? "cleaning lit" : ""}">
        <div class="head">
          <div class="iconbox ${cleaning ? "lit" : ""}"><ha-icon icon="mdi:robot-vacuum"></ha-icon></div>
          <div><div class="eyebrow">Robot aspirateur</div><div class="title">${esc(nameOf(so, c))}</div></div>
          <span class="badge ${st === "unavailable" ? "off" : ""}">${st === "unavailable" ? "Hors ligne" : "Connecté"}</span>
        </div>
        <div class="body">
          <div class="info">
            <div class="eyebrow">État du robot</div>
            <div class="big">${esc(VACUUM_TEXT[st] || formatState(this._hass, so))}</div>
            <div class="sub">${charging ? `<ha-icon icon="mdi:lightning-bolt"></ha-icon>` : ""}${esc(sub)}</div>
            ${stats ? `<div class="stats">${stats}</div>` : ""}
          </div>
          <div class="visual">
            <svg class="ring-svg" viewBox="0 0 132 132">
              <defs>
                <radialGradient id="rg" cx="40%" cy="35%" r="70%">
                  <stop offset="0" stop-color="#3a4357"/><stop offset="1" stop-color="#151b28"/>
                </radialGradient>
              </defs>
              <circle class="ring-bg" cx="66" cy="66" r="${R}" fill="none" stroke-width="6"/>
              <circle class="ring" cx="66" cy="66" r="${R}" fill="none" stroke="${batColor}" stroke-width="6"
                stroke-linecap="round" stroke-dasharray="${dash} ${CIRC}" transform="rotate(-90 66 66)"/>
              <g class="robot">
                <circle cx="66" cy="66" r="40" fill="url(#rg)" stroke="rgba(255,255,255,.12)"/>
                <circle cx="66" cy="66" r="31" fill="none" stroke="rgba(255,255,255,.06)"/>
                <circle cx="66" cy="46" r="9" fill="#1d2433" stroke="rgba(255,255,255,.18)"/>
                <circle cx="66" cy="46" r="3" fill="var(--tone)"/>
                <rect x="52" y="78" width="28" height="4" rx="2" fill="rgba(255,255,255,.12)"/>
              </g>
            </svg>
            <div class="pct">${bat != null ? bat + " %" : ""}</div>
          </div>
        </div>
        <div class="actions">
          ${cleaning
            ? `<button class="btn primary" data-srv="pause"><ha-icon icon="mdi:pause"></ha-icon>Pause</button>`
            : `<button class="btn primary" data-srv="start"><ha-icon icon="mdi:play"></ha-icon>${st === "paused" ? "Reprendre" : "Nettoyer"}</button>`}
          <button class="btn" data-srv="return_to_base"><ha-icon icon="mdi:home-import-outline"></ha-icon>Base</button>
          <button class="btn" data-srv="locate"><ha-icon icon="mdi:map-marker-radius"></ha-icon>Localiser</button>
        </div>
      </div>`);

    this.shadowRoot.querySelectorAll("[data-srv]").forEach((b) =>
      b.addEventListener("click", () => this._hass.callService("vacuum", b.dataset.srv, { entity_id: c.entity })));
    this.shadowRoot.querySelector(".visual").addEventListener("click", () => fireMoreInfo(this, c.entity));
  }

  getCardSize() { return 4; }
  getGridOptions() { return { columns: 12, rows: 4, min_columns: 6 }; }
  static getStubConfig(hass) { return { entity: firstEntity(hass, ["vacuum"]) }; }
}

/* =====================================================================
 *  CARTE 6 : berr-sensor-card
 *  type: custom:berr-sensor-card
 *  entity: sensor.consommation_instantanee
 *  name: Conso maison     (optionnel)
 *  icon: mdi:flash        (optionnel)
 *  hours: 24              (optionnel, période du graphe)
 *  tone: active | ok | info | blue | alert  (optionnel, couleur du graphe)
 *  decimals: 1            (optionnel)
 * ===================================================================== */
class BerrSensorCard extends BerrBase {
  _validate(c) { if (!c.entity) throw new Error("berr-sensor-card : il faut une 'entity' (capteur numérique)"); }

  set hass(hass) {
    super.hass = hass;
    // On recharge l'historique au maximum toutes les 5 minutes
    if (this._config && (!this._lastFetch || Date.now() - this._lastFetch > 5 * 60 * 1000)) this._fetchHistory();
  }
  get hass() { return this._hass; }

  async _fetchHistory() {
    this._lastFetch = Date.now();
    const hours = this._config.hours || 24;
    const start = new Date(Date.now() - hours * 3600 * 1000).toISOString();
    try {
      const res = await this._hass.callApi("GET",
        `history/period/${start}?filter_entity_id=${encodeURIComponent(this._config.entity)}&minimal_response&no_attributes`);
      const raw = (res?.[0] || [])
        .map((p) => ({ t: new Date(p.last_changed || p.lu * 1000).getTime(), v: parseFloat(p.state) }))
        .filter((p) => !isNaN(p.v) && !isNaN(p.t));
      this._points = this._downsample(raw, 48);
      this._render();
    } catch (e) {
      console.warn("[berr-cards] Historique indisponible :", e);
    }
  }

  // Réduit à ~48 points (moyenne par tranche) pour un tracé fluide
  _downsample(pts, n) {
    if (pts.length <= n) return pts.map((p) => p.v);
    const t0 = pts[0].t, t1 = Date.now(), step = (t1 - t0) / n;
    const out = [];
    let last = pts[0].v;
    for (let i = 0; i < n; i++) {
      const a = t0 + i * step, b = a + step;
      const slice = pts.filter((p) => p.t >= a && p.t < b);
      if (slice.length) last = slice.reduce((s, p) => s + p.v, 0) / slice.length;
      out.push(last);
    }
    return out;
  }

  // Courbe lissée (Catmull-Rom → Bézier)
  _path(vals, w, h, pad) {
    const min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1;
    const pts = vals.map((v, i) => [ (i / (vals.length - 1)) * w, pad + (1 - (v - min) / span) * (h - pad * 2) ]);
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
    }
    return { line: d, area: `${d} L${w},${h} L0,${h} Z`, min, max };
  }

  _fmt(v) {
    const dec = this._config.decimals ?? (Math.abs(v) >= 100 ? 0 : 1);
    return Number(v).toLocaleString("fr-FR", { maximumFractionDigits: dec, minimumFractionDigits: 0 });
  }

  _render() {
    const c = this._config;
    const so = this._state(c.entity);
    const unit = so?.attributes?.unit_of_measurement || "";
    const val = parseFloat(so?.state);
    const tone = c.tone || "active";
    const vals = this._points && this._points.length > 1 ? this._points : null;
    const g = vals ? this._path(vals, 300, 70, 6) : null;

    this._paint(`
      .card { padding: 16px 16px 0; display: flex; flex-direction: column; min-height: 150px; }
      .head { display: flex; align-items: center; gap: 10px; }
      .head .iconbox { width: 36px; height: 36px; border-radius: 12px; }
      .head .iconbox ha-icon { --mdc-icon-size: 20px; }
      .name { font-size: 13px; font-weight: 700; flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .val { margin-top: 10px; font-size: 32px; font-weight: 700; letter-spacing: -.02em; font-variant-numeric: tabular-nums; }
      .val small { font-size: 14px; color: var(--b-muted); font-weight: 600; margin-left: 4px; }
      .mm { font-size: 11px; color: var(--b-muted); text-align: right; line-height: 1.5; }
      svg.spark { display: block; width: calc(100% + 32px); margin: 6px -16px 0; height: 70px; }
      .area { fill: url(#fill); }
      .line { fill: none; stroke: var(--tone); stroke-width: 2.2; vector-effect: non-scaling-stroke;
        filter: drop-shadow(0 0 6px color-mix(in srgb, var(--tone) 60%, transparent)); }
      .empty { height: 70px; display: grid; place-items: center; color: var(--b-muted); font-size: 12px; }
    `, `
      <div class="card clickable tone-${tone} lit">
        <div class="head">
          <div class="iconbox"><ha-icon icon="${esc(c.icon || defaultIcon(so))}"></ha-icon></div>
          <div class="name">${esc(nameOf(so, c))}</div>
          ${g ? `<div class="mm">max ${this._fmt(g.max)}<br>min ${this._fmt(g.min)}</div>` : ""}
        </div>
        <div class="val">${isNaN(val) ? esc(formatState(this._hass, so)) : this._fmt(val)}<small>${esc(unit)}</small></div>
        ${g ? `
        <svg class="spark" viewBox="0 0 300 70" preserveAspectRatio="none">
          <defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="var(--tone)" stop-opacity=".35"/>
            <stop offset="1" stop-color="var(--tone)" stop-opacity="0"/>
          </linearGradient></defs>
          <path class="area" d="${g.area}"/>
          <path class="line" d="${g.line}"/>
        </svg>` : `<div class="empty">${this._points ? "Pas assez de données" : "Chargement…"}</div>`}
      </div>`);
    this.shadowRoot.querySelector(".card").addEventListener("click", () => fireMoreInfo(this, c.entity));
  }

  getCardSize() { return 3; }
  getGridOptions() { return { columns: 6, rows: 3, min_columns: 4 }; }
  static getStubConfig(hass) { return { entity: firstEntity(hass, ["sensor"]) }; }
}

/* ---------------------------------------------------------------------
 *  7. Enregistrement des cartes auprès de Home Assistant
 * ------------------------------------------------------------------- */
const CARDS = [
  ["berr-header-card", BerrHeaderCard, "Berr · En-tête", "Horloge, date, salutation et météo"],
  ["berr-tile-card", BerrTileCard, "Berr · Tuile", "Tuile d'état lumineuse (serrure, alarme, vanne, lumière…)"],
  ["berr-room-card", BerrRoomCard, "Berr · Pièce", "Une pièce, ses lumières, sa température"],
  ["berr-media-card", BerrMediaCard, "Berr · Média", "Lecture en cours avec jaquette et progression"],
  ["berr-vacuum-card", BerrVacuumCard, "Berr · Aspirateur", "Robot aspirateur avec batterie animée"],
  ["berr-sensor-card", BerrSensorCard, "Berr · Capteur", "Valeur + mini-graphe sur 24 h"],
];

window.customCards = window.customCards || [];
for (const [tag, cls, name, description] of CARDS) {
  if (!customElements.get(tag)) customElements.define(tag, cls);
  if (!window.customCards.some((c) => c.type === tag))
    window.customCards.push({ type: tag, name, description, preview: true, documentationURL: "https://github.com/Bilou691/ha-berr-dashboard" });
}

console.info(
  `%c BERR-CARDS %c v${BERR_VERSION} `,
  "background:#f5b544;color:#0c111c;font-weight:700;border-radius:4px 0 0 4px;padding:2px 4px",
  "background:#161d2d;color:#f5b544;border-radius:0 4px 4px 0;padding:2px 4px"
);
