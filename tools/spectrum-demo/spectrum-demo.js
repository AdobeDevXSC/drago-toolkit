import { initSpectrum, spectrumThemeDefaults } from '../shared/spectrum-theme.js';

initSpectrum();

const { system, scale, color } = spectrumThemeDefaults;
const root = document.getElementById('spectrum-demo-root');

root.innerHTML = `
  <sp-theme system="${system}" scale="${scale}" color="${color}">
    <div class="spectrum-demo spectrum-Typography">
      <h1 class="spectrum-demo__title spectrum-Heading spectrum-Heading--sizeL">Spectrum 2 foundation</h1>
      <p class="spectrum-demo__lead spectrum-Body spectrum-Body--sizeM">
        Phase 1: official tokens, <code>sp-theme</code>, and <code>sp-button</code>.
        Open via <code>aem up</code> → <code>/tools/spectrum-demo/spectrum-demo.html</code>.
      </p>
      <div class="spectrum-demo__actions">
        <sp-button variant="accent">Accent</sp-button>
        <sp-button variant="secondary">Secondary</sp-button>
        <sp-button variant="primary" quiet>Primary quiet</sp-button>
      </div>
    </div>
  </sp-theme>
`;
