import { useCallback, useEffect, useRef, useState } from 'react';
import { IonIcon } from '@ionic/react';
import { resolveIcon } from './PrimitiveRenderer';

/**
 * One row on the MEDIA sub-tab's Audios tab: a filename and an inline
 * transport — play/pause, skip back/forward, mute, playback speed,
 * elapsed/total time and a scrubber.
 *
 * Bespoke for the same reason the schedule sheet is: transport control is
 * imperative and stateful, and none of it composes out of Ionic
 * primitives. A bare <audio controls> was the alternative and looks
 * nothing like the design — it is also styled differently by every
 * browser and WebView, which is precisely what a design-matched app
 * cannot have.
 *
 * INTERACTION SPLIT (confirmed with Noor): the CONTROLS play, the
 * FILENAME opens the post. The AppZet wraps this whole row in the
 * on_tap_title action, so every control stops propagation — otherwise
 * pressing play would also navigate away. `data-appza-inline-click` keeps
 * the plug-in-admin's primitive-select off them too, so the controls stay
 * usable in the simulator (P81: verify the way a person performs it).
 */

function str(overrides: Record<string, unknown> | undefined, key: string): string {
  const v = overrides?.[key];
  return typeof v === 'string' ? v : '';
}

function bool(
  overrides: Record<string, unknown> | undefined,
  key: string,
  fallback: boolean,
): boolean {
  const v = overrides?.[key];
  return typeof v === 'boolean' ? v : fallback;
}

/** "0:03", "1:04:22" — hours only appear when there are some. */
function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${ss}`;
  return `${m}:${ss}`;
}

/** Parses "1,1.5,2" into playable rates, discarding anything unusable. */
function parseSpeeds(raw: string): number[] {
  const parsed = raw
    .split(',')
    .map((part) => Number.parseFloat(part.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  return parsed.length > 0 ? parsed : [1];
}

/** Trims trailing zeros so 1.5 reads "1.5×" and 1 reads "1×". */
function formatSpeed(rate: number): string {
  return `${Number(rate.toFixed(2))}×`;
}

export function AppzaAudioPlayer({ overrides }: { overrides?: Record<string, unknown> }) {
  const url = str(overrides, 'url');
  const title = str(overrides, 'title');

  const showTitle = bool(overrides, 'show_title', true);
  const showSkip = bool(overrides, 'show_skip', true);
  const showVolume = bool(overrides, 'show_volume', true);
  const showSpeed = bool(overrides, 'show_speed', true);
  const showTime = bool(overrides, 'show_time', true);

  const skipRaw = Number.parseInt(str(overrides, 'skip_seconds') || '10', 10);
  const skipSeconds = Number.isFinite(skipRaw) && skipRaw > 0 ? skipRaw : 10;
  const speeds = parseSpeeds(str(overrides, 'speed_steps') || '1,1.5,2');

  const musicIcon = resolveIcon(str(overrides, 'music_icon') || 'musical-notes-outline');
  const playIcon = resolveIcon(str(overrides, 'play_icon') || 'play');
  const pauseIcon = resolveIcon(str(overrides, 'pause_icon') || 'pause');
  const rewindIcon = resolveIcon(str(overrides, 'rewind_icon') || 'play-back');
  const forwardIcon = resolveIcon(str(overrides, 'forward_icon') || 'play-forward');
  const volumeIcon = resolveIcon(str(overrides, 'volume_icon') || 'volume-high-outline');
  const mutedIcon = resolveIcon(str(overrides, 'muted_icon') || 'volume-mute-outline');

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [speedIndex, setSpeedIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);

  // Every control lives inside the row wrapper that carries the AppZet's
  // "open the post" action. Without this, play would navigate.
  const swallow = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  // Playback rate is a property, not an attribute — React cannot set it
  // declaratively, and it resets whenever the element reloads a new src.
  useEffect(() => {
    const el = audioRef.current;
    if (el) el.playbackRate = speeds[speedIndex] ?? 1;
  }, [speedIndex, speeds, url]);

  // A changed src is a different file: drop the transport state rather
  // than showing the previous track's position against the new one.
  useEffect(() => {
    setPlaying(false);
    setElapsed(0);
    setDuration(0);
  }, [url]);

  const toggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const el = audioRef.current;
      if (!el) return;
      if (el.paused) {
        // play() rejects on autoplay policy and on a failed load. Either
        // way the button must not stay stuck in the "playing" state.
        void el.play().catch(() => setPlaying(false));
      } else {
        el.pause();
      }
    },
    [],
  );

  const seekBy = useCallback(
    (delta: number) => (e: React.MouseEvent) => {
      e.stopPropagation();
      const el = audioRef.current;
      if (!el) return;
      const max = Number.isFinite(el.duration) ? el.duration : Number.MAX_SAFE_INTEGER;
      el.currentTime = Math.min(max, Math.max(0, el.currentTime + delta));
    },
    [],
  );

  const toggleMute = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const el = audioRef.current;
    if (!el) return;
    el.muted = !el.muted;
    setMuted(el.muted);
  }, []);

  const cycleSpeed = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setSpeedIndex((i) => (i + 1) % speeds.length);
    },
    [speeds.length],
  );

  const scrub = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const el = audioRef.current;
    if (!el || !Number.isFinite(el.duration)) return;
    const next = (Number(e.target.value) / 1000) * el.duration;
    el.currentTime = next;
    setElapsed(next);
  }, []);

  if (url === '') return null;

  const progress = duration > 0 ? Math.min(1000, (elapsed / duration) * 1000) : 0;
  const currentSpeed = speeds[speedIndex] ?? 1;

  return (
    <span className="appza-audio-row">
      {showTitle && (
        <span className="appza-audio-row-title">
          {musicIcon && <IonIcon className="appza-audio-row-title-icon" icon={musicIcon} />}
          <span className="appza-audio-row-title-text">{title}</span>
        </span>
      )}

      <span className="appza-audio-row-controls" data-appza-inline-click onClick={swallow}>
        <button
          type="button"
          className="appza-audio-row-play"
          onClick={toggle}
          aria-label={playing ? 'Pause' : 'Play'}
          data-appza-inline-click
        >
          {playing
            ? pauseIcon && <IonIcon icon={pauseIcon} />
            : playIcon && <IonIcon icon={playIcon} />}
        </button>

        {showSkip && (
          <>
            <button
              type="button"
              className="appza-audio-row-skip"
              onClick={seekBy(-skipSeconds)}
              aria-label={`Back ${skipSeconds} seconds`}
              data-appza-inline-click
            >
              {rewindIcon && <IonIcon icon={rewindIcon} />}
              <span className="appza-audio-row-skip-label">{skipSeconds}</span>
            </button>
            <button
              type="button"
              className="appza-audio-row-skip"
              onClick={seekBy(skipSeconds)}
              aria-label={`Forward ${skipSeconds} seconds`}
              data-appza-inline-click
            >
              <span className="appza-audio-row-skip-label">{skipSeconds}</span>
              {forwardIcon && <IonIcon icon={forwardIcon} />}
            </button>
          </>
        )}

        {showVolume && (
          <button
            type="button"
            className="appza-audio-row-icon-btn"
            onClick={toggleMute}
            aria-label={muted ? 'Unmute' : 'Mute'}
            data-appza-inline-click
          >
            {muted
              ? mutedIcon && <IonIcon icon={mutedIcon} />
              : volumeIcon && <IonIcon icon={volumeIcon} />}
          </button>
        )}

        {showSpeed && (
          <button
            type="button"
            className="appza-audio-row-speed"
            onClick={cycleSpeed}
            aria-label={`Playback speed ${formatSpeed(currentSpeed)}`}
            data-appza-inline-click
          >
            {formatSpeed(currentSpeed)}
          </button>
        )}

        {showTime && (
          <span className="appza-audio-row-time">
            {formatTime(elapsed)}/{formatTime(duration)}
          </span>
        )}
      </span>

      <input
        className="appza-audio-row-scrubber"
        type="range"
        min={0}
        max={1000}
        step={1}
        value={progress}
        onChange={scrub}
        onClick={swallow}
        aria-label="Seek"
        data-appza-inline-click
        style={{ ['--appza-audio-progress' as string]: `${progress / 10}%` }}
      />

      <audio
        ref={audioRef}
        src={url}
        // The row shows a duration before the user ever presses play, so
        // metadata has to load up front. The audio itself does not.
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) => setElapsed(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          // A stream of unknown length reports Infinity; showing "Infinity"
          // is worse than showing 0:00.
          setDuration(Number.isFinite(d) ? d : 0);
        }}
      />
    </span>
  );
}
