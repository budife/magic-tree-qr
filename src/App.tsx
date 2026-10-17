import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MagicTreeScene, type ViewMode } from './scene';
import {
  SEASONS,
  SEASON_ORDER,
  BLOSSOM_SWATCHES,
  type SeasonId,
  type BlossomId,
  type Palette,
} from './scene/palette';
import { SPECIES, SPECIES_ORDER, type SpeciesId } from './scene/species';
import { Ambience } from './audio/ambience';
import { buildShareImage } from './share/qrImage';
import {
  SpringIcon,
  SummerIcon,
  AutumnIcon,
  WinterIcon,
  ShareIcon,
  InfoIcon,
  SoundOnIcon,
  SoundOffIcon,
  BrandMark,
  OakIcon,
  PineIcon,
  WillowIcon,
  BirchIcon,
  PalmIcon,
} from './ui/icons';

const DEFAULT_URL = 'https://example.com';
const SEASON_ICONS: Record<SeasonId, () => React.ReactElement> = {
  spring: SpringIcon,
  summer: SummerIcon,
  autumn: AutumnIcon,
  winter: WinterIcon,
};
const SPECIES_ICONS: Record<SpeciesId, () => React.ReactElement> = {
  oak: OakIcon,
  pine: PineIcon,
  willow: WillowIcon,
  birch: BirchIcon,
  palm: PalmIcon,
};

/** Debounce regrowing the tree so it does not thrash on every keystroke. */
const REBUILD_DELAY = 500;

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<MagicTreeScene | null>(null);
  const ambienceRef = useRef<Ambience | null>(null);

  const [draft, setDraft] = useState('');
  const [committed, setCommitted] = useState('');
  const [season, setSeason] = useState<SeasonId>('summer');
  const [species, setSpecies] = useState<SpeciesId>('oak');
  const [weather, setWeather] = useState<'clear' | 'rain' | 'fire'>('clear');
  const [fireActive, setFireActive] = useState(false); // fire button state independent of weather
  const [blossom, setBlossom] = useState<BlossomId>('blush');
  const [mode, setMode] = useState<ViewMode>('tree');
  const [muted, setMuted] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const palette = useMemo<Palette>(() => {
    const base = SEASONS[season];
    if (season !== 'spring') return base;
    const swatch = BLOSSOM_SWATCHES.find((s) => s.id === blossom) ?? BLOSSOM_SWATCHES[0];
    return { ...base, leaf: [...swatch.leaf], qrLeaf: [...swatch.qr], hedge: [...swatch.hedge] };
  }, [season, blossom]);

  // ---- scene lifecycle ---------------------------------------------------

  useEffect(() => {
    if (!canvasRef.current) return;
    const scene = new MagicTreeScene(canvasRef.current, committed, palette, SPECIES[species]);
    sceneRef.current = scene;

    const onResize = () => scene.resize();
    window.addEventListener('orientationchange', onResize);
    // Observing the canvas catches every size change, including the ones that
    // never fire a window resize -- a restored background tab, a container
    // relayout, or the canvas coming back from a zero-sized state.
    const ro = new ResizeObserver(onResize);
    ro.observe(canvasRef.current);

    return () => {
      window.removeEventListener('orientationchange', onResize);
      ro.disconnect();
      scene.dispose();
      sceneRef.current = null;
    };
    // Built once; text and palette are pushed through imperatively below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    sceneRef.current?.setPalette(palette);
  }, [palette]);

  useEffect(() => {
    sceneRef.current?.setText(committed);
  }, [committed]);

  useEffect(() => {
    sceneRef.current?.setMode(mode);
  }, [mode]);

  useEffect(() => {
    sceneRef.current?.setSpecies(species);
  }, [species]);

  useEffect(() => {
    // Weather logic: rain suppresses fire, but fireActive persists
    if (weather === 'rain') {
      sceneRef.current?.setWeather('rain'); // rain extinguishes fire gradually
    } else if (fireActive) {
      sceneRef.current?.setWeather('fire'); // fire recovers when rain stops
    } else {
      sceneRef.current?.setWeather('clear');
    }
  }, [weather, fireActive]);

  // Report the dock's real height so the code is never framed underneath it.
  useEffect(() => {
    const el = dockRef.current;
    if (!el) return;
    const report = () => sceneRef.current?.setDockHeight(el.getBoundingClientRect().height);
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const normalized = draft.trim();
    // Auto-prepend https:// if missing protocol
    const withProtocol = normalized && !/^https?:\/\//i.test(normalized)
      ? `https://${normalized}`
      : normalized;
    const t = window.setTimeout(() => setCommitted(withProtocol || DEFAULT_URL), REBUILD_DELAY);
    return () => window.clearTimeout(t);
  }, [draft]);

  // Auto-switch to QR view when user enters a real link (not default)
  useEffect(() => {
    if (committed && committed !== DEFAULT_URL) {
      setMode('code');
    }
  }, [committed]);

  useEffect(() => {
    ambienceRef.current = new Ambience();
    return () => ambienceRef.current?.dispose();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(t);
  }, [toast]);

  // ---- interactions ------------------------------------------------------

  const toggleMode = useCallback(() => {
    setMode((m) => {
      const next: ViewMode = m === 'tree' ? 'code' : 'tree';
      if (next === 'code') ambienceRef.current?.chord();
      return next;
    });
  }, []);

  const toggleSound = useCallback(() => {
    const on = ambienceRef.current?.toggle() ?? false;
    setMuted(!on);
  }, []);

  const share = useCallback(async () => {
    const url = committed;
    
    try {
      // Capture QR as proper scannable PNG with link text
      const blob = await buildShareImage(url, palette);
      const file = new File([blob], 'magic-tree-qr.png', { type: 'image/png' });
      
      // Try Web Share API with image
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: 'Magic Tree QR Code',
          text: `Scan this tree: ${url}`,
          files: [file],
        });
        return;
      }
      
      // Fallback: share URL only
      if (navigator.share) {
        await navigator.share({
          title: 'Magic Tree',
          text: 'A tree that is also a scannable QR code.',
          url,
        });
        return;
      }
      
      // Final fallback: copy link to clipboard
      await navigator.clipboard.writeText(url);
      setToast('Link copied');
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') setToast('Could not share');
    }
  }, [committed, palette]);

  const onCanvasKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleMode();
    }
  };

  const hint = mode === 'tree' ? 'Tap the tree to see the QR code' : 'Tap to see the tree';

  return (
    <div className="stage" style={{ background: palette.ground }}>
      <a className="brand" href="/" aria-label="Magic Tree home">
        <BrandMark />
        <span className="brand__text">
          <span className="brand__name">Magic Tree</span>
          <span className="brand__tag">3D QR</span>
        </span>
      </a>

      <div className="info">
        <button
          className="info__btn"
          type="button"
          aria-expanded={showInfo}
          aria-label="About this project"
          onClick={() => setShowInfo((v) => !v)}
        >
          <InfoIcon />
        </button>
        {showInfo && (
          <div className="info__card" role="dialog" aria-label="About Magic Tree">
            <p>
              The plot under the tree <em>is</em> the QR code. Tap it and the canopy
              settles leaf by leaf into the dark modules.
            </p>
            <p>
              Encoded at error-correction level H, with a clear four-module quiet
              zone, so the result actually scans.
            </p>
            <p>
              An original, open-source take on the isometric QR-tree idea. Built with
              React and three.js.
            </p>
          </div>
        )}
      </div>

      <canvas
        ref={canvasRef}
        className="stage__canvas"
        role="button"
        tabIndex={0}
        aria-label={hint}
        onClick={toggleMode}
        onKeyDown={onCanvasKey}
      />

      {/* Weather only applies to the tree view, so the toggle fades out with it. */}
      <div
        className={`weather-controls${mode === 'code' ? ' weather-controls--hidden' : ''}`}
        role="group"
        aria-label="Cuaca"
      >
        <button
          className="weather"
          type="button"
          title="Hujan"
          aria-label="Hujan"
          aria-pressed={weather === 'rain'}
          onClick={() => setWeather((w) => (w === 'rain' ? 'clear' : 'rain'))}
        >
          <span aria-hidden="true">🌧</span>
        </button>
        <button
          className="weather"
          type="button"
          title="Kebakaran"
          aria-label="Kebakaran"
          aria-pressed={fireActive}
          onClick={() => setFireActive((f) => !f)}
        >
          <span aria-hidden="true">🔥</span>
        </button>
      </div>

      <div className="dock" ref={dockRef}>
        <div className="dock__toast-anchor">
          {toast && <div className="toast">{toast}</div>}
          <button className="hint" type="button" onClick={toggleMode}>
            {hint}
          </button>
        </div>

        <div className="field">
          <input
            className="field__input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Masukkan link disini (contoh: https://instagram.com/username)"
            aria-label="Link to encode"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
          />
          <button
            className="field__action"
            type="button"
            onClick={share}
            aria-label="Share this tree"
          >
            <ShareIcon />
          </button>
        </div>

        <div className="trees">
          {SPECIES_ORDER.map((id) => {
            const Icon = SPECIES_ICONS[id];
            return (
              <button
                key={id}
                className="tree"
                type="button"
                title={SPECIES[id].label}
                aria-pressed={species === id}
                onClick={() => setSpecies(id)}
              >
                <Icon />
                <span className="tree__label">{SPECIES[id].label}</span>
              </button>
            );
          })}
        </div>

        <div className="seasons">
          {SEASON_ORDER.map((id) => {
            const Icon = SEASON_ICONS[id];
            return (
              <button
                key={id}
                className="season"
                type="button"
                aria-pressed={season === id}
                onClick={() => setSeason(id)}
              >
                <Icon />
                <span className="season__label">{SEASONS[id].label}</span>
              </button>
            );
          })}
          <button
            className="mute"
            type="button"
            aria-pressed={!muted}
            aria-label={muted ? 'Turn ambience on' : 'Turn ambience off'}
            onClick={toggleSound}
          >
            {muted ? <SoundOffIcon /> : <SoundOnIcon />}
          </button>
        </div>

        <div className="blossoms">
          {season === 'spring' &&
            BLOSSOM_SWATCHES.map((s) => (
              <button
                key={s.id}
                className="blossom"
                type="button"
                aria-pressed={blossom === s.id}
                aria-label={`${s.label} blossom`}
                style={{ background: s.leaf[0] }}
                onClick={() => setBlossom(s.id)}
              />
            ))}
        </div>
      </div>
    </div>
  );
}
