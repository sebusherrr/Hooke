/**
 * Liquid Glass button — vanilla port of the shadcn LiquidButton for a non-React stack.
 * Same visual technique (SVG feTurbulence + feDisplacementMap distorting a backdrop blur),
 * restyled to Abingdon's tokens instead of generic shadcn --primary/--secondary vars.
 * Usage: <button class="btn-liquid-glass">Ask the Library AI</button>
 *        then call initLiquidGlassButtons() once on page load.
 */
export function initLiquidGlassButtons(selector = '.btn-liquid-glass') {
  if (!document.getElementById('liquid-glass-filter-defs')) {
    document.body.insertAdjacentHTML('beforeend', `
      <svg id="liquid-glass-filter-defs" class="hidden" aria-hidden="true">
        <defs>
          <filter id="abingdon-liquid-glass" x="0%" y="0%" width="100%" height="100%" color-interpolation-filters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.05 0.05" numOctaves="1" seed="1" result="turbulence"/>
            <feGaussianBlur in="turbulence" stdDeviation="2" result="blurredNoise"/>
            <feDisplacementMap in="SourceGraphic" in2="blurredNoise" scale="55" xChannelSelector="R" yChannelSelector="B" result="displaced"/>
            <feGaussianBlur in="displaced" stdDeviation="3" result="finalBlur"/>
            <feComposite in="finalBlur" in2="finalBlur" operator="over"/>
          </filter>
        </defs>
      </svg>`);
  }
  document.querySelectorAll(selector).forEach(btn => btn.classList.add('liquid-glass-ready'));
}
