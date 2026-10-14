/**
 * Measurement for the skies, switched on by `?fps` in the address bar.
 *
 * Three things the owner asked to be proven about the hotloader cannot be argued
 * from reading the code: what a frame costs, whether the hole's layers are actually
 * built, and whether the sky behind it is really displaced. This module turns those
 * into digits on the screen, and holds the pixel arithmetic the lensing probe uses.
 *
 * With the flag absent nothing here runs: no readout is created, no pixel is read
 * back, and the render path is the ordinary one. The readout is digits with short
 * unit labels, so it is a measurement rather than copy and stays out of
 * content/copy.json.
 */

/** How long a frame reading is averaged over, in milliseconds. */
const WINDOW_MS = 500;

/** True when the address bar asks for the readout. */
export function measurementMode(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).has("fps");
}

/**
 * True when the address bar also asks to bypass the lensing pass. This is the A/B half
 * of the cost measurement: the same scene, the same viewport, the same six layers,
 * rendered once through the composer and once straight to the canvas. The difference
 * between the two readings is what the pass costs, with nothing else changed.
 */
export function lensBypassRequested(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return params.has("fps") && params.has("nolens");
}

/**
 * True when the address bar asks to draw the sky with no hole in it. This is how the
 * pass is proven inactive rather than merely invisible: with no hotloader the composer
 * is never built, the frame goes straight to the canvas by the same call it used before
 * this change, and the readout reports the pass at zero.
 */
export function holeBypassRequested(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return params.has("fps") && params.has("nohole");
}

/** What one sky reports about itself once per measurement window. */
export interface SkyReadout {
  /** Whether this sky draws the hotloader at all. */
  hotloader: boolean;
  /** The hole's layers actually constructed. */
  layers: string[];
  /** 0 when the lensing pass is inactive, 1 when it is bending the frame. */
  lensActive: number;
  /** The shadow's radius on screen, in CSS pixels. */
  shadowPx: number;
  /** How far a pixel at the sample band is pulled, in CSS pixels. */
  bendPx: number;
}

/**
 * A running frame reading plus a self-report, written into a DOM node as digits.
 * The longest single frame gap in the window is shown next to the average, because
 * that gap is what a reader feels as a hitch.
 */
export class FrameMeter {
  private frames = 0;
  private windowStart = 0;
  private previous = 0;
  private worst = 0;
  /** The last clean frame reading, kept so the probe text can sit beside it. */
  private base: string | null = null;
  private extra = "";

  constructor(
    private readonly host: HTMLElement | null,
    private readonly read: () => SkyReadout,
  ) {}

  /** Appends measured results to the same line. */
  setExtra(text: string) {
    this.extra = text;
    if (this.host) this.host.textContent = `${this.base ?? ""}${text}`;
  }

  /**
   * Drops the window in progress.
   *
   * The lens probe costs three extra full renders and a synchronous pixel readback, so
   * the frames around it are not a fair sample of ordinary rendering. Discarding that
   * partial window means the number on screen afterwards is measured from clean frames.
   */
  discard() {
    this.frames = 0;
    this.windowStart = 0;
    this.previous = 0;
    this.worst = 0;
  }

  /** Call once per rendered frame with that frame's timestamp. */
  sample(now: number) {
    if (!this.host) return;
    if (this.windowStart === 0) {
      this.windowStart = now;
      this.previous = now;
      return;
    }
    this.frames += 1;
    const gap = Math.min(now - this.previous, 999);
    if (gap > this.worst) this.worst = gap;
    this.previous = now;
    if (now - this.windowStart < WINDOW_MS) return;

    const fps = (this.frames * 1000) / (now - this.windowStart);
    const r = this.read();
    this.base =
      `${fps.toFixed(1)} fps  gap ${this.worst.toFixed(1)}ms  ` +
      `hole ${r.layers.length}  lens ${r.lensActive.toFixed(0)}  ` +
      `r ${r.shadowPx.toFixed(0)}px  pull ${r.bendPx.toFixed(2)}px  `;
    this.frames = 0;
    this.windowStart = now;
    this.worst = 0;
    if (this.host) this.host.textContent = `${this.base}${this.extra}`;
  }
}

/** Reads a rectangular band of pixels from the canvas, top-left anchored. */
export function readBand(
  gl: WebGL2RenderingContext,
  canvasWidth: number,
  canvasHeight: number,
  x: number,
  y: number,
  width: number,
  height: number,
): Uint8Array {
  const px = Math.max(0, Math.min(canvasWidth - width, Math.round(x)));
  const py = Math.max(0, Math.min(canvasHeight - height, Math.round(y)));
  const buffer = new Uint8Array(width * height * 4);
  // gl.readPixels starts from the bottom-left; the maths above is top-left.
  gl.readPixels(px, canvasHeight - py - height, width, height, gl.RGBA, gl.UNSIGNED_BYTE, buffer);
  return buffer;
}

/** Mean per-channel difference between two bands, in units of one full channel. */
export function bandDelta(a: Uint8Array, b: Uint8Array): number {
  let total = 0;
  const count = Math.min(a.length, b.length) / 4;
  for (let i = 0; i < count * 4; i += 4) {
    total += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
  }
  return total / count / 3 / 255;
}

/** Mean gap between the red and blue channels of a band: the chromatic fringe. */
export function bandChroma(band: Uint8Array): number {
  let total = 0;
  const count = band.length / 4;
  for (let i = 0; i < band.length; i += 4) total += Math.abs(band[i] - band[i + 2]);
  return total / count / 255;
}

/**
 * Mean alpha across a band, from nought to one.
 *
 * The canvas is transparent and the page's background and hero scrim show through it, so
 * a render path that flattened the frame to opaque would black all of that out. A band
 * well away from the hole should stay partly transparent; a reading of one there means
 * the composer has taken the page's background for itself.
 */
export function bandAlpha(band: Uint8Array): number {
  let total = 0;
  const count = band.length / 4;
  for (let i = 3; i < band.length; i += 4) total += band[i];
  return total / count / 255;
}
