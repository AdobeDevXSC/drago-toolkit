# Spectrum 2 (project-wide)

Bundled [Spectrum Web Components](https://opensource.adobe.com/spectrum-web-components/) for **site pages, blocks, and tools**.

## Build

```bash
npm run build:spectrum
```

Produces:

| Output | Purpose |
|--------|---------|
| `dist/index.js` | `sp-theme`, `sp-button`, Spectrum 2 theme fragments |
| `dist/form-nav-icons.js` | Workflow/UI icons for multi-section form nav |
| `dist/tokens.css` | `tokens-v2` + typography custom properties |

Run `npm run build:deps` to rebuild Lit and Spectrum together.

## Site integration

| File | Role |
|------|------|
| `head.html` | Loads `tokens.css`, `styles.css`, `spectrum-bridge.css` |
| `scripts/scripts.js` | `initSpectrum()` + `applyDocumentSpectrumTheme()` on every page |
| `styles/spectrum-bridge.css` | Maps legacy `--color-*` / `--font-family` to Spectrum tokens |

## Blocks & tools

```js
import { initSpectrum, spectrumThemeDefaults } from '../../scripts/utils/spectrum-theme.js';

initSpectrum();
// <sp-theme system="spectrum-two" scale="medium" color="light">…</sp-theme>
```

Tools may re-export via `tools/shared/spectrum-theme.js`.

## Demo

`/tools/spectrum-demo/spectrum-demo.html`

## Versioning

All `@spectrum-web-components/*` packages must share the same version in `package.json`. Re-run `build:spectrum` after upgrades.
