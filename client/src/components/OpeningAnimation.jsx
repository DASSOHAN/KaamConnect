import { useEffect, useState } from 'react';

const SPLASH_DURATION_MS = 900;

export function OpeningAnimation() {
  const [visible, setVisible] = useState(() => (
    typeof window !== 'undefined' && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  ));

  useEffect(() => {
    if (!visible) return undefined;
    const timeoutId = window.setTimeout(() => setVisible(false), SPLASH_DURATION_MS);
    return () => window.clearTimeout(timeoutId);
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="kaam-opening" aria-hidden="true">
      <div className="kaam-opening__ambience">
        <span className="kaam-opening__blob kaam-opening__blob--blue" />
        <span className="kaam-opening__blob kaam-opening__blob--teal" />
        <span className="kaam-opening__blob kaam-opening__blob--amber" />
      </div>
      <span className="kaam-opening__glow" />
      <span className="kaam-opening__streak" />
      <span className="kaam-opening__particle kaam-opening__particle--one" />
      <span className="kaam-opening__particle kaam-opening__particle--two" />
      <span className="kaam-opening__particle kaam-opening__particle--three" />
      <span className="kaam-opening__particle kaam-opening__particle--four" />
      <span className="kaam-opening__particle kaam-opening__particle--five" />
      <span className="kaam-opening__wordmark"><span className="kaam-opening__kaam">Kaam</span><span className="kaam-opening__connect">Connect</span></span>
    </div>
  );
}
