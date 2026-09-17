import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "@iantroisi/sickmaps/css";
import {
  THEME_DEFAULTS,
  decorateMapContainer,
  getMinecraftPixelRatio,
  installMinecraftEnhancements,
  loadGameMapStyle,
  undecorateMapContainer,
  type GameMapTheme,
} from "@iantroisi/sickmaps";

export type SickmapsPreviewOptions = {
  /** Element that holds map + chrome, or selector string */
  root: HTMLElement | string;
  theme?: GameMapTheme;
  center?: [number, number];
  zoom?: number;
  /** Preset locations for the location picker */
  locations?: SickmapsPreviewLocation[];
};

export type SickmapsPreviewLocation = {
  id: string;
  label: string;
  center: [number, number];
  zoom: number;
};

export type SickmapsPreview = {
  map: maplibregl.Map;
  getTheme: () => GameMapTheme;
  setTheme: (theme: GameMapTheme) => Promise<void>;
  flyToLocation: (id: string) => void;
  destroy: () => void;
};

const THEMES: { id: GameMapTheme; label: string; hint: string }[] = [
  { id: "minecraft", label: "Minecraft", hint: "Blocky biomes, angled view" },
  { id: "gta-sa", label: "GTA SA", hint: "San Andreas minimap" },
  { id: "gta-v", label: "GTA V", hint: "Modern HUD map" },
];

const DEFAULT_LOCATIONS: SickmapsPreviewLocation[] = [
  { id: "nyc", label: "NYC", center: [-74.02, 40.72], zoom: 11.2 },
  { id: "la", label: "Los Santos-ish", center: [-118.25, 34.05], zoom: 11 },
  { id: "sf", label: "San Fierro-ish", center: [-122.42, 37.78], zoom: 11.5 },
];

export async function mountSickmapsPreview(
  options: SickmapsPreviewOptions,
): Promise<SickmapsPreview> {
  const root =
    typeof options.root === "string" ? document.querySelector<HTMLElement>(options.root) : options.root;

  if (!root) {
    throw new Error("sickmapsdemo: root element not found");
  }

  let theme = options.theme ?? "minecraft";
  const locations = options.locations ?? DEFAULT_LOCATIONS;
  let activeLocationId = locations[0]?.id ?? "nyc";

  root.innerHTML = "";
  root.className = "sickmaps-preview";

  const shell = document.createElement("div");
  shell.className = "sickmaps-preview__shell";

  const toolbar = document.createElement("header");
  toolbar.className = "sickmaps-preview__toolbar";
  toolbar.innerHTML = `
    <div class="sickmaps-preview__brand">
      <span class="sickmaps-preview__title">sickmaps</span>
      <span class="sickmaps-preview__subtitle">theme preview</span>
    </div>
  `;

  const themeGroup = document.createElement("div");
  themeGroup.className = "sickmaps-preview__theme-group";
  themeGroup.setAttribute("role", "tablist");
  themeGroup.setAttribute("aria-label", "Map theme");

  const locationSelect = document.createElement("select");
  locationSelect.className = "sickmaps-preview__select";
  locationSelect.setAttribute("aria-label", "Location");
  for (const loc of locations) {
    const opt = document.createElement("option");
    opt.value = loc.id;
    opt.textContent = loc.label;
    locationSelect.appendChild(opt);
  }

  toolbar.append(themeGroup, locationSelect);

  const mapHost = document.createElement("div");
  mapHost.id = "sickmaps-preview-map";
  mapHost.className = "sickmaps-preview__map-host";

  const hint = document.createElement("p");
  hint.className = "sickmaps-preview__hint";

  shell.append(toolbar, mapHost, hint);
  root.appendChild(shell);

  const themeButtons = new Map<GameMapTheme, HTMLButtonElement>();

  for (const t of THEMES) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "sickmaps-preview__theme-btn";
    btn.setAttribute("role", "tab");
    btn.dataset.theme = t.id;
    btn.innerHTML = `<span class="sickmaps-preview__theme-label">${t.label}</span>`;
    btn.title = t.hint;
    themeGroup.appendChild(btn);
    themeButtons.set(t.id, btn);
  }

  function syncThemeUi() {
    for (const [id, btn] of themeButtons) {
      const selected = id === theme;
      btn.classList.toggle("is-active", selected);
      btn.setAttribute("aria-selected", selected ? "true" : "false");
    }
    hint.textContent = THEMES.find((t) => t.id === theme)?.hint ?? "";
  }

  decorateMapContainer(mapHost, theme);
  syncThemeUi();

  const loc = locations.find((l) => l.id === activeLocationId) ?? locations[0];
  const defaults = THEME_DEFAULTS[theme];

  let style;
  try {
    style = await loadGameMapStyle(theme);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const errorEl = document.createElement("p");
    errorEl.className = "sickmaps-preview__error";
    errorEl.textContent = `Could not load map style: ${message}`;
    shell.insertBefore(errorEl, mapHost);
    throw err;
  }

  let mcTeardown: (() => void) | undefined;

  const map = new maplibregl.Map({
    container: mapHost,
    style,
    center: options.center ?? loc.center,
    zoom: options.zoom ?? loc.zoom,
    pitch: defaults.pitch,
    bearing: defaults.bearing,
    maxPitch: defaults.maxPitch,
    antialias: defaults.antialias,
    ...(theme === "minecraft" ? { pixelRatio: getMinecraftPixelRatio() } : {}),
  });

  map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "bottom-right");

  map.on("load", () => {
    map.resize();
    if (theme === "minecraft") {
      mcTeardown?.();
      mcTeardown = installMinecraftEnhancements(map);
    }
  });
  map.on("error", (e) => {
    console.error("MapLibre error:", e.error?.message ?? e);
  });
  requestAnimationFrame(() => map.resize());
  const onResize = () => map.resize();
  window.addEventListener("resize", onResize);

  async function setTheme(next: GameMapTheme): Promise<void> {
    if (next === theme) return;

    undecorateMapContainer(mapHost);
    theme = next;
    decorateMapContainer(mapHost, theme);
    syncThemeUi();

    const d = THEME_DEFAULTS[theme];
    const nextStyle = await loadGameMapStyle(theme);
    mcTeardown?.();
    mcTeardown = undefined;
    map.setStyle(nextStyle);
    map.once("styledata", () => {
      map.setPitch(d.pitch);
      map.setBearing(d.bearing);
      if (theme === "minecraft") {
        mcTeardown = installMinecraftEnhancements(map);
      }
    });
  }

  function flyToLocation(id: string): void {
    const target = locations.find((l) => l.id === id);
    if (!target) return;
    activeLocationId = id;
    locationSelect.value = id;
    map.flyTo({
      center: target.center,
      zoom: target.zoom,
      pitch: THEME_DEFAULTS[theme].pitch,
      bearing: THEME_DEFAULTS[theme].bearing,
      duration: 1400,
    });
  }

  for (const [id, btn] of themeButtons) {
    btn.addEventListener("click", () => void setTheme(id));
  }

  locationSelect.addEventListener("change", () => flyToLocation(locationSelect.value));

  return {
    map,
    getTheme: () => theme,
    setTheme,
    flyToLocation,
    destroy: () => {
      window.removeEventListener("resize", onResize);
      mcTeardown?.();
      map.remove();
      undecorateMapContainer(mapHost);
      root.innerHTML = "";
      root.className = "";
    },
  };
}
