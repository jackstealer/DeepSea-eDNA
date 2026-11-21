/**
 * ============================================================================
 *  OCEAN BACKGROUND — TUNING
 * ============================================================================
 * Every look-and-feel number for the signed-in app's deep-sea background lives
 * here. Speeds are per second (frame-rate independent); sizes are CSS pixels;
 * opacities are 0..1. "Calmer" and "more dramatic" levers are marked ★.
 */
export const OCEAN = {
  /** Brand palette per theme. Dark = night dive; light = bright shallow water. */
  palette: {
    dark: {
      surface: '#0D2A3D', // top of the depth gradient: teal-navy "surface light"
      mid: '#0B1220',
      deep: '#04080F', // bottom: near-black
      vignette: 'rgba(2, 5, 12, 0.6)',
      sink: '#02050C', // overlay that darkens the water as you scroll deeper
      ray: '200, 240, 255', // r,g,b of the god rays
      caustic: '170, 235, 255',
      snow: '205, 230, 245',
      cyan: '#22D3EE',
      violet: '#A78BFA',
      teal: '#0E7490',
      helix: '34, 211, 238',
      desaturated: '#94A3B8', // plankton colour while the API is unhealthy
    },
    light: {
      surface: '#F2FDFF',
      mid: '#D9F6FB',
      deep: '#B5E5EE',
      vignette: 'rgba(14, 116, 144, 0.12)',
      sink: '#7FC6D6',
      ray: '255, 255, 255',
      caustic: '255, 255, 255',
      snow: '14, 116, 144',
      cyan: '#0E7490',
      violet: '#7C6BD6',
      teal: '#0E7490',
      helix: '14, 116, 144',
      desaturated: '#64748B',
    },
  },

  /** ★ Particle counts (desktop / screens narrower than `mobileBreakpoint`). */
  counts: { snow: { desktop: 220, mobile: 90 }, plankton: { desktop: 40, mobile: 18 }, mobileBreakpoint: 640 },

  /** Marine snow: three parallax depths, far → near. */
  snow: {
    layers: [
      { share: 0.5, depth: 0.25, size: [0.5, 1.0], alpha: [0.12, 0.25], speed: [5, 9] },
      { share: 0.32, depth: 0.55, size: [0.9, 1.6], alpha: [0.2, 0.38], speed: [9, 15] },
      { share: 0.18, depth: 1.0, size: [1.4, 2.4], alpha: [0.3, 0.5], speed: [15, 24] },
    ],
    sway: 7, // ★ side-to-side drift, px/s
    lightAlpha: 0.35, // multiplier in light mode ("faint particles")
  },

  /** Bioluminescent plankton: the interactive layer. */
  plankton: {
    size: [1.4, 2.8], // core radius
    glow: 16, // ★ glow radius around each core
    alpha: [0.45, 0.85],
    pulsePeriod: [3, 7], // s per breath
    violetShare: 0.3,
    depth: 0.8,
    wander: 14, // px/s of idle drift
    attractRadius: 380, // cursor pull reaches this far
    halo: 70, // plankton keep this distance from the cursor, forming a soft halo
    attract: 220, // ★ pull toward the cursor, px/s² (with damping 1.8 → drift of ~25–60 px/s)
    scatterSpeed: 1400, // cursor speed (px/s) that counts as a quick flick
    scatter: 320, // ★ outward kick when the cursor flicks past, px/s
    scatterRadius: 200, // plankton this close to the flick's path get kicked
    damping: 1.8, // velocity decay per second
    maxSpeed: 220,
    lightAlpha: 0.25, // light mode: faint dots, no glow
  },

  /** God rays from the surface. */
  rays: { count: 4, opacity: 0.055, width: [140, 300], sway: 0.07, swayPeriod: [24, 40], pulsePeriod: [20, 34], depth: 0.25 }, // ★ opacity

  /** Caustic light-net across the upper screen. */
  caustics: { opacity: 0.07, height: 0.42, drift: [9, -6], scale: 1.6, depth: 0.35 }, // ★ opacity

  /** Distant DNA helix silhouette (right side). */
  helix: { opacity: 0.06, x: 0.84, radius: 0.09, turns: 2.6, spin: 0.09, rungs: 30, depth: 0.15 }, // ★ opacity, spin

  /** ★ Mouse parallax: max shift for the nearest layer; deeper layers move less. */
  parallax: { max: 16, ease: 2.6 },

  /** Scrolling "sinks" you: the water darkens and light fades with page depth. */
  scroll: { depthPx: 2400, darken: 0.35, lightFade: 0.55 },

  /** Light ripples from app events (classification success / novel taxon). */
  ripple: { duration: 2.6, reach: 0.8, width: 70, opacity: 0.22 }, // ★ opacity
  novelGlow: { boost: 1.9, decay: 3.2 },

  /** API health: plankton fade to grey while unhealthy. */
  health: { ease: 1.2 },

  /**
   * ★ Reduced motion (OS "animation effects" off): the ocean keeps drifting, just slower, like the
   * 3D scenes' gentle mode. 1 = full speed; lower is calmer.
   */
  reducedMotion: { speed: 0.5 },

  /** Performance guard rails. */
  performance: {
    dpr: [2, 1.5, 1], // pixel-density cap per quality level (0 = full)
    shed: [1, 0.6, 0.35], // particle multiplier per quality level
    slowFrameMs: 24, // frames slower than this count as "slow"
    fastFrameMs: 18, // frames at least this fast count as "fast" (60 Hz qualifies)
    downgradeAfterS: 2,
    upgradeAfterS: 12,
    pauseAfterBlurMs: 20_000, // stop animating after the window is unfocused this long
  },
} as const;

export type OceanTheme = keyof typeof OCEAN.palette;
export type OceanPalette = (typeof OCEAN.palette)[OceanTheme];
