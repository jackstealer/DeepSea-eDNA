/**
 * The deep-sea "submersible window" scene: plain Canvas 2D, no libraries.
 * Draw order (back → front): helix silhouette, god rays, caustics, marine snow, plankton, ripples.
 * The depth gradient, scroll darkening and vignette are CSS layers owned by <OceanBackground/>.
 * All motion is scaled by dt (seconds), so speed is the same at any frame rate.
 */
import { OCEAN, type OceanPalette, type OceanTheme } from './oceanConfig';
import { particleBudget, type QualityLevel } from './oceanQuality';

type Range = readonly [number, number];
const TAU = Math.PI * 2;
const rand = (r: Range) => r[0] + Math.random() * (r[1] - r[0]);
/** Exponential approach: frame-rate independent easing toward `target`. */
const approach = (value: number, target: number, rate: number, dt: number) => value + (target - value) * (1 - Math.exp(-rate * dt));

interface Snow { x: number; y: number; size: number; alpha: number; speed: number; phase: number; layer: number }
interface Plankton { x: number; y: number; vx: number; vy: number; size: number; alpha: number; period: number; phase: number; violet: boolean; seed: number }
interface Ray { x: number; width: number; swayPeriod: number; pulsePeriod: number; phase: number }
interface Ripple { violet: boolean; age: number }

export interface OceanScene {
  readonly level: QualityLevel;
  /** 0..1 opacity for the CSS "sinking" overlay */
  readonly sinkOpacity: number;
  resize(width: number, height: number, devicePixelRatio: number): void;
  setTheme(theme: OceanTheme): void;
  setQuality(level: QualityLevel): void;
  pointerMove(x: number, y: number, timeMs: number): void;
  pointerLeave(): void;
  /** 0 at the top of the page .. 1 at OCEAN.scroll.depthPx and beyond */
  setScroll(depth: number): void;
  ripple(kind: 'success' | 'novel'): void;
  setHealthy(healthy: boolean): void;
  /** Advance the simulation by dt seconds and draw. */
  frame(dt: number): void;
  /** Calm, static frame for reduced motion: no parallax, no ripples. */
  renderStill(): void;
}

/** Soft radial glow, pre-rendered once per colour so drawing plankton is a cheap drawImage. */
function glowSprite(color: string): HTMLCanvasElement {
  const size = 64;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, color);
  grad.addColorStop(0.12, color);
  grad.addColorStop(0.3, `${color}55`);
  grad.addColorStop(1, `${color}00`);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

/** Seamless 256px tile of two crossing families of wavy lines: the caustic "light net". */
function causticTile(rgb: string): HTMLCanvasElement {
  const n = 256;
  const c = document.createElement('canvas');
  c.width = c.height = n;
  const g = c.getContext('2d')!;
  g.strokeStyle = `rgba(${rgb}, 0.55)`;
  g.lineWidth = 1.3;
  const lines = 7;
  for (let family = 0; family < 2; family++) {
    for (let i = 0; i < lines; i++) {
      const base = ((i + 0.5) * n) / lines;
      const k = 1 + ((i + family) % 3); // integer wave counts keep the tile seamless
      const amp = 9 + ((i * 7) % 6);
      const phase = i * 1.7 + family;
      for (const wrap of [-n, 0, n]) {
        g.beginPath();
        for (let s = 0; s <= n; s += 4) {
          const off = base + wrap + amp * Math.sin((TAU * s * k) / n + phase);
          if (family === 0) {
            if (s === 0) g.moveTo(s, off);
            else g.lineTo(s, off);
          } else if (s === 0) g.moveTo(off, s);
          else g.lineTo(off, s);
        }
        g.stroke();
      }
    }
  }
  return c;
}

export function createOceanScene(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, initialTheme: OceanTheme): OceanScene {
  let theme = initialTheme;
  let palette: OceanPalette = OCEAN.palette[theme];
  let w = 1;
  let h = 1;
  let dpr = 1;
  let level: QualityLevel = 0;
  let t = 0;

  let snow: Snow[] = [];
  let plankton: Plankton[] = [];
  const rays: Ray[] = Array.from({ length: OCEAN.rays.count }, (_, i) => ({
    x: 0.12 + (i / Math.max(1, OCEAN.rays.count - 1)) * 0.62 + (Math.random() - 0.5) * 0.08,
    width: rand(OCEAN.rays.width),
    swayPeriod: rand(OCEAN.rays.swayPeriod),
    pulsePeriod: rand(OCEAN.rays.pulsePeriod),
    phase: Math.random() * TAU,
  }));
  const ripples: Ripple[] = [];

  // Eased state
  const pointer = { x: 0, y: 0, active: false, lastX: 0, lastY: 0, lastT: 0 };
  let parallaxX = 0;
  let parallaxY = 0;
  let scrollTarget = 0;
  let scroll = 0;
  let healthyTarget = true;
  let desaturation = 0; // 0 = full colour, 1 = grey
  let boost = 0; // novel-taxon glow, decays to 0

  // Theme assets
  let sprites = { cyan: glowSprite(palette.cyan), violet: glowSprite(palette.violet), grey: glowSprite(palette.desaturated) };
  let tile = causticTile(palette.caustic);
  let pattern: CanvasPattern | null = null;
  const causticCanvas = document.createElement('canvas');
  const causticCtx = causticCanvas.getContext('2d');

  const buildThemeAssets = () => {
    palette = OCEAN.palette[theme];
    sprites = { cyan: glowSprite(palette.cyan), violet: glowSprite(palette.violet), grey: glowSprite(palette.desaturated) };
    tile = causticTile(palette.caustic);
    pattern = causticCtx ? causticCtx.createPattern(tile, 'repeat') : null;
  };
  pattern = causticCtx ? causticCtx.createPattern(tile, 'repeat') : null;

  const makeSnow = (layer: number, anywhere: boolean): Snow => {
    const L = OCEAN.snow.layers[layer];
    return {
      x: Math.random() * w,
      y: anywhere ? Math.random() * h : -4,
      size: rand(L.size),
      alpha: rand(L.alpha),
      speed: rand(L.speed),
      phase: Math.random() * TAU,
      layer,
    };
  };
  const makePlankton = (): Plankton => ({
    x: Math.random() * w,
    y: Math.random() * h,
    vx: 0,
    vy: 0,
    size: rand(OCEAN.plankton.size),
    alpha: rand(OCEAN.plankton.alpha),
    period: rand(OCEAN.plankton.pulsePeriod),
    phase: Math.random() * TAU,
    violet: Math.random() < OCEAN.plankton.violetShare,
    seed: Math.random() * 100,
  });

  /** Match particle counts to the viewport and quality level, keeping existing particles. */
  const rebudget = () => {
    const budget = particleBudget(w, level);
    const want: number[] = OCEAN.snow.layers.map((L) => Math.round(budget.snow * L.share));
    const next: Snow[] = [];
    want.forEach((count, layer) => {
      const have = snow.filter((s) => s.layer === layer).slice(0, count);
      while (have.length < count) have.push(makeSnow(layer, true));
      next.push(...have);
    });
    snow = next;
    plankton = plankton.slice(0, budget.plankton);
    while (plankton.length < budget.plankton) plankton.push(makePlankton());
  };

  const layerOffset = (depth: number) => ({
    x: -parallaxX * OCEAN.parallax.max * depth,
    y: -parallaxY * OCEAN.parallax.max * depth,
  });

  // ---------------------------------------------------------------- simulation
  const step = (dt: number) => {
    t += dt;
    const target = pointer.active ? { x: (pointer.x / w) * 2 - 1, y: (pointer.y / h) * 2 - 1 } : { x: 0, y: 0 };
    parallaxX = approach(parallaxX, target.x, OCEAN.parallax.ease, dt);
    parallaxY = approach(parallaxY, target.y, OCEAN.parallax.ease, dt);
    scroll = approach(scroll, scrollTarget, 3, dt);
    desaturation = approach(desaturation, healthyTarget ? 0 : 1, 1 / OCEAN.health.ease, dt);
    boost = Math.max(0, boost - dt / OCEAN.novelGlow.decay);

    for (const s of snow) {
      s.y += s.speed * dt;
      s.x += Math.sin(t * 0.5 + s.phase) * OCEAN.snow.sway * dt;
      if (s.y > h + 4) Object.assign(s, makeSnow(s.layer, false));
      if (s.x < -4) s.x += w + 8;
      else if (s.x > w + 4) s.x -= w + 8;
    }

    const P = OCEAN.plankton;
    const off = layerOffset(P.depth);
    for (const p of plankton) {
      // idle drift: each plankton follows its own slow current
      const driftX = Math.cos(t * 0.13 + p.seed * 7) * P.wander;
      const driftY = Math.sin(t * 0.11 + p.seed * 3) * P.wander;
      let ax = (driftX - p.vx) * P.damping;
      let ay = (driftY - p.vy) * P.damping;
      if (pointer.active) {
        const dx = pointer.x - (p.x + off.x);
        const dy = pointer.y - (p.y + off.y);
        const d = Math.hypot(dx, dy);
        if (d > 0.5 && d < P.attractRadius) {
          // drawn in from afar, gently pushed back inside the halo so they hover instead of clumping
          const pull = d > P.halo ? P.attract * (1 - d / P.attractRadius) : -P.attract * 0.5 * (1 - d / P.halo);
          ax += (dx / d) * pull;
          ay += (dy / d) * pull;
        }
      }
      p.vx += ax * dt;
      p.vy += ay * dt;
      const speed = Math.hypot(p.vx, p.vy);
      if (speed > P.maxSpeed) {
        p.vx = (p.vx / speed) * P.maxSpeed;
        p.vy = (p.vy / speed) * P.maxSpeed;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.x < -30) p.x += w + 60;
      else if (p.x > w + 30) p.x -= w + 60;
      if (p.y < -30) p.y += h + 60;
      else if (p.y > h + 30) p.y -= h + 60;
    }

    for (let i = ripples.length - 1; i >= 0; i--) {
      ripples[i].age += dt;
      if (ripples[i].age >= OCEAN.ripple.duration) ripples.splice(i, 1);
    }
  };

  // ---------------------------------------------------------------- drawing
  const drawHelix = (still: boolean) => {
    const H = OCEAN.helix;
    const off = still ? { x: 0, y: 0 } : layerOffset(H.depth);
    const cx = w * H.x + off.x;
    const radius = Math.max(36, w * H.radius);
    const top = -0.05 * h + off.y;
    const span = 1.1 * h;
    const k = (TAU * H.turns) / span;
    const phase = still ? 0.6 : t * H.spin;
    const alpha = H.opacity * (1 - scroll * 0.4);
    const strand = (shift: number) => {
      ctx.beginPath();
      for (let y = 0; y <= span; y += 8) {
        const x = cx + radius * Math.sin(k * y + phase + shift);
        if (y === 0) ctx.moveTo(x, top + y);
        else ctx.lineTo(x, top + y);
      }
      ctx.stroke();
    };
    ctx.lineWidth = 2;
    ctx.strokeStyle = `rgba(${palette.helix}, ${alpha})`;
    strand(0);
    strand(Math.PI);
    ctx.lineWidth = 1.2;
    for (let i = 0; i < H.rungs; i++) {
      const y = (i + 0.5) * (span / H.rungs);
      const a = k * y + phase;
      const depth = (Math.cos(a) + 1) / 2; // rungs facing us are brighter
      ctx.strokeStyle = `rgba(${palette.helix}, ${alpha * (0.25 + 0.75 * depth)})`;
      ctx.beginPath();
      ctx.moveTo(cx + radius * Math.sin(a), top + y);
      ctx.lineTo(cx + radius * Math.sin(a + Math.PI), top + y);
      ctx.stroke();
    }
  };

  const drawRays = (still: boolean) => {
    const R = OCEAN.rays;
    const off = still ? { x: 0, y: 0 } : layerOffset(R.depth);
    const light = 1 - scroll * OCEAN.scroll.lightFade;
    for (const ray of rays) {
      const sway = still ? 0 : Math.sin((TAU * t) / ray.swayPeriod + ray.phase) * R.sway;
      const pulse = still ? 0.75 : 0.55 + 0.45 * Math.sin((TAU * t) / ray.pulsePeriod + ray.phase * 1.7);
      const a = R.opacity * pulse * light;
      if (a <= 0.002) continue;
      const angle = 0.3 + sway;
      const dirX = Math.sin(angle);
      const dirY = Math.cos(angle);
      const len = h * 1.45;
      const topX = ray.x * w + off.x;
      const topY = -0.08 * h + off.y;
      const w0 = ray.width * 0.3;
      const w1 = ray.width;
      const px = Math.cos(angle);
      const py = -Math.sin(angle);
      const endX = topX + dirX * len;
      const endY = topY + dirY * len;
      const grad = ctx.createLinearGradient(topX, topY, topX + dirX * len * 0.85, topY + dirY * len * 0.85);
      grad.addColorStop(0, `rgba(${palette.ray}, ${a})`);
      grad.addColorStop(1, `rgba(${palette.ray}, 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(topX - (px * w0) / 2, topY - (py * w0) / 2);
      ctx.lineTo(topX + (px * w0) / 2, topY + (py * w0) / 2);
      ctx.lineTo(endX + (px * w1) / 2, endY + (py * w1) / 2);
      ctx.lineTo(endX - (px * w1) / 2, endY - (py * w1) / 2);
      ctx.closePath();
      ctx.fill();
    }
  };

  const drawCaustics = (still: boolean) => {
    const C = OCEAN.caustics;
    if (!particleBudget(w, level).caustics || !causticCtx || !pattern) return;
    const alpha = C.opacity * (1 - scroll * OCEAN.scroll.lightFade);
    if (alpha <= 0.002) return;
    const off = still ? { x: 0, y: 0 } : layerOffset(C.depth);
    const cw = causticCanvas.width;
    const ch = causticCanvas.height;
    const time = still ? 0 : t;
    // The tile repeats every 256 px, so offsets wrap: they stay small however long the app runs
    const wrap = (v: number) => ((v % 256) + 256) % 256;
    causticCtx.globalCompositeOperation = 'source-over';
    causticCtx.clearRect(0, 0, cw, ch);
    // Two copies of the net drifting in different directions interfere into a moving shimmer
    causticCtx.save();
    causticCtx.fillStyle = pattern;
    const ax = wrap(time * C.drift[0]);
    const ay = wrap(time * C.drift[1]);
    causticCtx.translate(ax, ay);
    causticCtx.globalAlpha = 1;
    causticCtx.fillRect(-ax, -ay, cw, ch);
    causticCtx.restore();
    causticCtx.save();
    causticCtx.fillStyle = pattern;
    causticCtx.scale(C.scale, C.scale);
    causticCtx.rotate(0.55);
    causticCtx.translate(wrap(-time * C.drift[1] * 1.3), wrap(time * C.drift[0] * 0.8));
    causticCtx.globalAlpha = 0.75;
    causticCtx.fillRect(-cw, -ch, cw * 3, ch * 3);
    causticCtx.restore();
    // Fade the net out toward the bottom of its band
    causticCtx.globalCompositeOperation = 'destination-in';
    const fade = causticCtx.createLinearGradient(0, 0, 0, ch);
    fade.addColorStop(0, 'rgba(0,0,0,1)');
    fade.addColorStop(1, 'rgba(0,0,0,0)');
    causticCtx.fillStyle = fade;
    causticCtx.fillRect(0, 0, cw, ch);
    ctx.globalAlpha = alpha;
    ctx.drawImage(causticCanvas, off.x, off.y, w, h * C.height);
    ctx.globalAlpha = 1;
  };

  const drawSnow = (still: boolean) => {
    const lightK = theme === 'light' ? OCEAN.snow.lightAlpha : 1;
    OCEAN.snow.layers.forEach((L, layer) => {
      const off = still ? { x: 0, y: 0 } : layerOffset(L.depth);
      // Two alpha buckets per layer keep it to a handful of fill calls
      for (const bright of [false, true]) {
        ctx.beginPath();
        let any = false;
        for (const s of snow) {
          if (s.layer !== layer) continue;
          const isBright = s.alpha > (L.alpha[0] + L.alpha[1]) / 2;
          if (isBright !== bright) continue;
          ctx.moveTo(s.x + off.x + s.size, s.y + off.y);
          ctx.arc(s.x + off.x, s.y + off.y, s.size, 0, TAU);
          any = true;
        }
        if (!any) continue;
        const a = (bright ? L.alpha[1] : L.alpha[0]) * lightK;
        ctx.fillStyle = `rgba(${palette.snow}, ${a})`;
        ctx.fill();
      }
    });
  };

  const drawPlankton = (still: boolean) => {
    const P = OCEAN.plankton;
    const off = still ? { x: 0, y: 0 } : layerOffset(P.depth);
    if (theme === 'light') {
      // Shallow water: faint dots, no glow
      ctx.fillStyle = palette.teal;
      for (const p of plankton) {
        ctx.globalAlpha = p.alpha * P.lightAlpha;
        ctx.beginPath();
        ctx.arc(p.x + off.x, p.y + off.y, p.size * 0.8, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      return;
    }
    const glowBoost = 1 + (OCEAN.novelGlow.boost - 1) * boost;
    for (const p of plankton) {
      const pulse = still ? 0.8 : 0.6 + 0.4 * Math.sin((TAU * t) / p.period + p.phase);
      const a = Math.min(1, p.alpha * pulse * glowBoost);
      const size = (P.glow * 2 + p.size * 4) * (0.85 + 0.3 * pulse) * (0.9 + 0.25 * boost);
      const x = p.x + off.x - size / 2;
      const y = p.y + off.y - size / 2;
      if (desaturation < 0.99) {
        ctx.globalAlpha = a * (1 - desaturation);
        ctx.drawImage(p.violet ? sprites.violet : sprites.cyan, x, y, size, size);
      }
      if (desaturation > 0.01) {
        ctx.globalAlpha = a * desaturation * 0.7;
        ctx.drawImage(sprites.grey, x, y, size, size);
      }
    }
    ctx.globalAlpha = 1;
  };

  const drawRipples = () => {
    const R = OCEAN.ripple;
    const cx = w / 2;
    const cy = h / 2;
    const reach = Math.hypot(w, h) * 0.5 * R.reach;
    for (const r of ripples) {
      const p = r.age / R.duration;
      const radius = reach * (1 - Math.pow(1 - p, 3));
      const a = R.opacity * Math.pow(1 - p, 1.5) * (theme === 'light' ? 0.5 : 1);
      const inner = Math.max(0, radius - R.width);
      const grad = ctx.createRadialGradient(cx, cy, inner, cx, cy, radius + R.width);
      const color = r.violet ? palette.violet : palette.cyan;
      grad.addColorStop(0, `${color}00`);
      grad.addColorStop(0.5, `${color}${Math.round(a * 255).toString(16).padStart(2, '0')}`);
      grad.addColorStop(1, `${color}00`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius + R.width, 0, TAU);
      ctx.fill();
    }
  };

  const draw = (still: boolean) => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, w, h);
    // Light adds up in the dark; in shallow water it simply lies on top
    ctx.globalCompositeOperation = theme === 'dark' ? 'lighter' : 'source-over';
    drawHelix(still);
    drawRays(still);
    drawCaustics(still);
    drawSnow(still);
    drawPlankton(still);
    if (!still) drawRipples();
    ctx.globalCompositeOperation = 'source-over';
  };

  return {
    get level() {
      return level;
    },
    get sinkOpacity() {
      return scroll * OCEAN.scroll.darken;
    },
    resize(width, height, devicePixelRatio) {
      const sx = width / w;
      const sy = height / h;
      const first = w === 1 && h === 1;
      w = Math.max(1, width);
      h = Math.max(1, height);
      dpr = Math.min(devicePixelRatio || 1, particleBudget(w, level).maxDpr);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      // The caustic band is drawn at half resolution and upscaled; it is soft anyway
      causticCanvas.width = Math.max(1, Math.round(w / 2));
      causticCanvas.height = Math.max(1, Math.round((h * OCEAN.caustics.height) / 2));
      if (!first) {
        for (const s of snow) {
          s.x *= sx;
          s.y *= sy;
        }
        for (const p of plankton) {
          p.x *= sx;
          p.y *= sy;
        }
      }
      rebudget();
    },
    setTheme(next) {
      if (next === theme) return;
      theme = next;
      buildThemeAssets();
    },
    setQuality(next) {
      if (next === level) return;
      level = next;
      this.resize(w, h, window.devicePixelRatio);
    },
    pointerMove(x, y, timeMs) {
      const P = OCEAN.plankton;
      if (pointer.active && timeMs > pointer.lastT) {
        const speed = (Math.hypot(x - pointer.lastX, y - pointer.lastY) / (timeMs - pointer.lastT)) * 1000;
        if (speed > P.scatterSpeed) {
          // A quick flick scatters plankton away from the path the cursor swept through
          const off = layerOffset(P.depth);
          const sx = x - pointer.lastX;
          const sy = y - pointer.lastY;
          const len2 = sx * sx + sy * sy || 1;
          for (const p of plankton) {
            const px = p.x + off.x;
            const py = p.y + off.y;
            const along = Math.max(0, Math.min(1, ((px - pointer.lastX) * sx + (py - pointer.lastY) * sy) / len2));
            const dx = px - (pointer.lastX + sx * along);
            const dy = py - (pointer.lastY + sy * along);
            const d = Math.hypot(dx, dy) || 1;
            if (d < P.scatterRadius) {
              const kick = P.scatter * (1 - d / P.scatterRadius);
              p.vx += (dx / d) * kick;
              p.vy += (dy / d) * kick;
            }
          }
        }
      }
      pointer.x = x;
      pointer.y = y;
      pointer.lastX = x;
      pointer.lastY = y;
      pointer.lastT = timeMs;
      pointer.active = true;
    },
    pointerLeave() {
      pointer.active = false;
    },
    setScroll(depth) {
      scrollTarget = Math.min(1, Math.max(0, depth));
    },
    ripple(kind) {
      ripples.push({ violet: kind === 'novel', age: 0 });
      if (ripples.length > 4) ripples.shift();
      if (kind === 'novel') boost = 1;
    },
    setHealthy(healthy) {
      healthyTarget = healthy;
    },
    frame(dt) {
      step(dt);
      draw(false);
    },
    renderStill() {
      desaturation = healthyTarget ? 0 : 1;
      scroll = 0;
      draw(true);
    },
  };
}
