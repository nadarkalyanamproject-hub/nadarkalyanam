import { LogoMark } from './logo';

// The boot splash: the logo animation, played on every full load of the site
// (not on page-to-page navigation, since the layout stays mounted), then it
// fades away to show the page underneath (about 2.4s, tap to skip).
// It is server-rendered so it covers the page from the very first paint; the
// inline script right after it switches to a still logo that simply fades
// for visitors who prefer reduced motion (e.g. Windows "Animation effects" off).
const SKIP_SCRIPT = `(function(){var d=document.documentElement,s=document.getElementById('nk-splash');
try{if(matchMedia('(prefers-reduced-motion: reduce)').matches)d.dataset.splash='still'}catch(e){}
if(s)s.addEventListener('click',function(){d.dataset.splash='off'})})()`;

// React warns about rendering <script> on the client; this keeps it a real
// script in the server HTML and inert on the client (see Next's "Preventing
// Flash" guide).
function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === 'undefined' ? 'text/javascript' : 'text/plain'}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

const letters = (text: string, start: number, step: number) =>
  [...text].map((ch, n) => (
    <span key={n} className="nk-splash-l" style={{ animationDelay: `${(start + n * step).toFixed(2)}s` }}>
      {ch}
    </span>
  ));

export function Splash() {
  return (
    <>
      <div id="nk-splash" className="nk-splash" aria-hidden="true">
        <div className="nk-logo nk-splash-logo">
          <span className="nk-splash-mark">
            <LogoMark className="nk-logo-mark" />
            <span className="nk-splash-shine">
              <LogoMark fill="#FFF3CF" className="nk-logo-mark" />
            </span>
          </span>
          <span className="nk-logo-word">
            <span className="nk-logo-a">{letters('NADAR', 0.8, 0.05)}</span>
            <span className="nk-logo-b nk-splash-b">KALYANAM</span>
          </span>
        </div>
      </div>
      <InlineScript html={SKIP_SCRIPT} />
    </>
  );
}
