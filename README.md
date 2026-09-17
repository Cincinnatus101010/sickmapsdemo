# sickmapsdemo

Theme preview for the [`sickmaps`](https://github.com/Cincinnatus101010/sickmaps) npm package — Minecraft, GTA SA, and GTA V MapLibre styles.

## Run locally

```bash
npm install
npm run dev
```

Open the URL Vite prints (default port 5174).

## Reuse the preview shell

`src/preview.ts` exports `mountSickmapsPreview()` — drop it into any Vite/React/vanilla app that already uses MapLibre.

```ts
import { mountSickmapsPreview } from "./preview";

await mountSickmapsPreview({ root: "#app", theme: "minecraft" });
```

## Related

- Package: https://github.com/Cincinnatus101010/sickmaps
- Install: `npm install @iantroisi/sickmaps maplibre-gl`

## License

MIT
