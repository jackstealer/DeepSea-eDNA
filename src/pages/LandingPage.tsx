import { lazy, useEffect, useRef, useState, type MutableRefObject, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { MotionConfig, motion } from 'framer-motion';
import { ChevronDown, Files, GitBranch, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TAXA_CATALOG, TAXA_REFERENCE } from '@/data/taxaReference';
import { BrandMark } from '@/components/common/BrandMark';
import { Scene3DGate, usePrefersReducedMotion } from '@/components/three/Scene3DGate';
import { BASE_COLORS, TAXON_COLORS } from '@/components/three/palette';
import type { HelixPose } from '@/components/three/GlassHelix';
import { Preloader } from '@/components/landing/Preloader';
import { LayeredWordmark } from '@/components/landing/LayeredWordmark';
import { shouldShowIntro } from '@/components/landing/introGate';
import { useLenis } from '@/lib/motion/useLenis';
import { useRevealOnScroll } from '@/lib/motion/reveal';
import { SplitReveal } from '@/components/motion/SplitReveal';

// three.js is only downloaded when the scene is shown (separate chunk)
const GlassHelix = lazy(() => import('@/components/three/GlassHelix'));

const REPO_URL = 'https://github.com/jackstealer/DeepSea-eDNA';

// Every number on this page comes from the measured catalog (scripts/build_taxa_catalog.py)
const TAXA_COUNT = TAXA_REFERENCE.length;
const ACCURACY = `${(TAXA_CATALOG.validation.accuracy * 100).toFixed(1)}%`;
const HELD_OUT = TAXA_CATALOG.validation.samples.toLocaleString();
const TRAINING = TAXA_CATALOG.totalSequences.toLocaleString();
const SPECIES = TAXA_REFERENCE.reduce((n, t) => n + t.speciesCount, 0).toLocaleString();
const PHYLA = new Set(TAXA_REFERENCE.map((t) => t.lineage[1])).size;
// A real GenBank read: its bases colour the helix while it is "read"
const SAMPLE = TAXA_REFERENCE.find((t) => t.example)?.example ?? null;

const taxonColor = (classId: number) => TAXON_COLORS[classId % TAXON_COLORS.length];

/**
 * Helix poses, one per element marked `data-stage`, in page order:
 * hero, the four "how it works" steps, taxa, platform, questions, closing call to action.
 */
const POSES: HelixPose[] = [
  { x: 4.3, y: 0.8, z: 0, tilt: -0.62, scale: 1, unwind: 0, tint: 0, sort: 0 },
  { x: 2.9, y: 0, z: -1.5, tilt: -0.25, scale: 0.75, unwind: 0, tint: 0, sort: 0 },
  { x: 2.8, y: 0, z: 0.5, tilt: 0, scale: 0.9, unwind: 0.85, tint: 1, sort: 0 },
  { x: 2.5, y: 0, z: -0.5, tilt: 0, scale: 1, unwind: 0.85, tint: 1, sort: 1 },
  { x: 2.5, y: 0, z: -1.5, tilt: 0, scale: 1.2, unwind: 0.85, tint: 1, sort: 1 },
  { x: 5.6, y: 0, z: -3, tilt: 0.35, scale: 0.9, unwind: 0.2, tint: 0, sort: 0 },
  { x: 0, y: -2.5, z: 0, tilt: -Math.PI / 2, scale: 1.1, unwind: 0, tint: 0, sort: 0 },
  { x: 0, y: 3.1, z: 0, tilt: -1.45, scale: 1.1, unwind: 0, tint: 0, sort: 0 },
  // rises out of view so the questions and the closing section read cleanly
  { x: 0, y: 7.5, z: 0, tilt: -1.45, scale: 1.1, unwind: 0, tint: 0, sort: 0 },
];

const NAV = [
  { href: '#how', label: 'How it works' },
  { href: '#taxa', label: 'Taxa' },
  { href: '#platform', label: 'Platform' },
  { href: '#faq', label: 'Questions' },
];

const STEPS = [
  {
    label: 'Sample',
    title: 'Filter the water',
    body: 'Fish, crabs and snails shed DNA into the water through skin, mucus and waste. A few litres of filtered seawater carry enough of it to show who has been there.',
  },
  {
    label: 'Sequence',
    title: 'Read the barcode',
    body: 'Sequencing turns that DNA into short barcode reads, mostly COI and cytochrome b, 100 to 1,000 bases long. Paste a read, or upload a FASTA or FASTQ file.',
  },
  {
    label: 'Classify',
    title: 'Sort it into a lineage',
    body: `A convolutional network with self-attention scores each read against all ${TAXA_COUNT} taxa. Anything under 70% confidence is flagged as possibly novel instead of being forced into a group.`,
  },
  {
    label: 'Explore',
    title: 'Keep the evidence',
    body: 'Every result is saved to your private history, and file analyses export as JSON, CSV, TSV, BIOM or FASTA.',
  },
];

const FEATURES = [
  {
    icon: Files,
    title: 'Whole samples at once',
    body: 'Upload a FASTA or FASTQ file and get a row per read, plus Shannon and Simpson diversity for the whole sample.',
  },
  {
    icon: GitBranch,
    title: 'Models behind a gate',
    body: 'Every version is tracked in an MLflow registry. A new model replaces the serving one only if it matches or beats it, with no restart.',
  },
  {
    icon: Lock,
    title: 'Private by default',
    body: 'Each account sees only its own history and exports. Sign in with email, Google or GitHub; admins assign roles.',
  },
];

const FAQ = [
  {
    q: 'What is environmental DNA?',
    a: 'DNA that animals leave behind in the water as skin cells, mucus and waste. Sampling it lets you survey a site without catching, or even seeing, the animals.',
  },
  {
    q: 'Which sequences can I classify?',
    a: 'Animal barcode reads of 100 to 1,000 bases, mainly COI and cytochrome b. Headers and whitespace are stripped and RNA is converted to DNA (U becomes T) before the model sees it.',
  },
  {
    q: `What if a read belongs to none of the ${TAXA_COUNT} taxa?`,
    a: `The model still scores all ${TAXA_COUNT}, but when the best score is under 70% the result is marked as possibly novel so you can check it by hand.`,
  },
  {
    q: 'How accurate is it?',
    a: `${ACCURACY} on ${HELD_OUT} sequences held out from training. Precision, recall and F1 for each taxon, and what it gets confused with, are in the Taxa Explorer.`,
  },
  {
    q: 'Can I run it on my own servers?',
    a: 'Yes. It ships as a Docker Compose stack, and the repository includes a CloudFormation template for a single AWS EC2 host with automatic HTTPS.',
  },
];

const PAGE_X = 'px-5 sm:px-8 lg:px-12';
const H2 = 'text-[clamp(2.25rem,5vw,4.5rem)] font-light leading-[1.02] tracking-[-0.035em] [text-wrap:balance]';
const PRIMARY_BUTTON =
  'inline-flex h-12 items-center justify-center rounded-full bg-ds-ink px-6 text-sm font-medium text-ds-bg transition-opacity hover:opacity-85';
const GHOST_BUTTON =
  'inline-flex h-12 items-center justify-center rounded-full border border-ds-line px-6 text-sm text-ds-ink transition-colors hover:bg-ds-ink/5';

/** Fractional index of the `data-stage` element nearest the middle of the viewport */
function measureStage(): number {
  const anchors = document.querySelectorAll<HTMLElement>('[data-stage]');
  const middle = window.innerHeight / 2;
  let previous = 0;
  for (let k = 0; k < anchors.length; k++) {
    const rect = anchors[k].getBoundingClientRect();
    const offset = rect.top + rect.height / 2 - middle;
    if (offset > 0) return k === 0 ? 0 : k - 1 + -previous / (offset - previous);
    previous = offset;
  }
  return Math.max(anchors.length - 1, 0);
}

function RevealLine({ index, className, children }: { index: number; className?: string; children: ReactNode }) {
  return (
    // padding + negative margin let italic descenders show through the mask
    <span className="-mb-[0.12em] block overflow-hidden pb-[0.12em]">
      <motion.span
        className={cn('block', className)}
        initial={{ y: '105%' }}
        animate={{ y: 0 }}
        transition={{ duration: 1.1, delay: 0.2 + index * 0.12, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </motion.span>
    </span>
  );
}

function TaxonLegend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-ds-muted">
      {TAXA_REFERENCE.map((t) => (
        <li key={t.name} className="inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: taxonColor(t.classId) }} aria-hidden="true" />
          {t.name}
        </li>
      ))}
    </ul>
  );
}

function StepVisual({ index }: { index: number }) {
  if (index === 1 && SAMPLE) {
    return (
      <figure className="rounded-2xl bg-[#04070e] px-4 py-3">
        <p className="break-all font-mono text-[13px] leading-relaxed tracking-wider">
          {SAMPLE.sequence
            .slice(0, 72)
            .split('')
            .map((base, i) => (
              <span key={i} style={{ color: BASE_COLORS[base] ?? '#64748b' }}>
                {base}
              </span>
            ))}
        </p>
        <figcaption className="mt-2 text-xs text-slate-400">
          <span className="italic">{SAMPLE.species}</span>, {SAMPLE.marker}, GenBank {SAMPLE.accession}
        </figcaption>
      </figure>
    );
  }
  if (index >= 2) return <TaxonLegend />;
  return null;
}

function HowItWorks({ activeStep, onSelect, anchors }: {
  activeStep: number;
  onSelect: (index: number) => void;
  anchors: MutableRefObject<Array<HTMLDivElement | null>>;
}) {
  return (
    <section id="how" className="relative" style={{ height: `${STEPS.length * 100}vh` }}>
      {/* One viewport-tall anchor per step; the helix pose follows whichever is centred */}
      <div className="pointer-events-none absolute inset-0 flex flex-col" aria-hidden="true">
        {STEPS.map((step, i) => (
          <div
            key={step.label}
            data-stage
            className="h-screen"
            ref={(el) => {
              anchors.current[i] = el;
            }}
          />
        ))}
      </div>

      <div className={cn('sticky top-0 flex h-svh items-center', PAGE_X)}>
        <div className="mx-auto w-full max-w-7xl">
          <div className="max-w-xl rounded-3xl bg-ds-bg/75 p-6 backdrop-blur-md md:bg-transparent md:p-0 md:backdrop-blur-none">
            <SplitReveal as="h2" className={H2}>
              From seawater <span className="accent-phrase text-iridescent">to a lineage</span>
            </SplitReveal>

            <ol className="mt-10 flex gap-5 overflow-x-auto border-b border-ds-line [scrollbar-width:none] sm:gap-8">
              {STEPS.map((step, i) => (
                <li key={step.label} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => onSelect(i)}
                    aria-current={i === activeStep ? 'step' : undefined}
                    className={cn(
                      '-mb-px flex items-baseline gap-2 border-b-2 pb-3 text-sm transition-colors',
                      i === activeStep
                        ? 'border-ds-ink text-ds-ink'
                        : 'border-transparent text-ds-muted hover:text-ds-ink'
                    )}
                  >
                    <span className="font-mono text-xs tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                    {step.label}
                  </button>
                </li>
              ))}
            </ol>

            {/* All steps share one grid cell, so the panel keeps the height of the longest */}
            <div className="mt-8 grid">
              {STEPS.map((step, i) => (
                <div
                  key={step.label}
                  aria-hidden={i !== activeStep}
                  className={cn(
                    '[grid-area:1/1] transition-[opacity,transform] duration-500 ease-out',
                    i === activeStep ? 'opacity-100' : 'pointer-events-none translate-y-3 opacity-0'
                  )}
                >
                  <p className="font-mono text-[12px] uppercase tracking-[0.24em] text-ds-muted">
                    Chapter {String(i + 1).padStart(2, '0')} — {step.label}
                  </p>
                  <h3 className="mt-3 text-2xl font-light tracking-tight sm:text-3xl">{step.title}</h3>
                  <p className="mt-4 max-w-md leading-relaxed text-ds-muted">{step.body}</p>
                  <div className="mt-6">
                    <StepVisual index={i} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function TaxaSection() {
  const [selected, setSelected] = useState(0);
  const taxon = TAXA_REFERENCE[selected];
  const validation = taxon.validation;
  const confused = validation?.confusedWith[0];
  const facts: Array<[string, string]> = [
    ['Training reads', taxon.trainingCount.toLocaleString()],
    ['Species', taxon.speciesCount.toLocaleString()],
    ['F1 on held-out reads', validation ? `${(validation.f1 * 100).toFixed(1)}%` : '—'],
  ];

  return (
    <section id="taxa" data-stage className={cn('relative py-28 lg:py-36', PAGE_X)}>
      <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16">
        <div>
          <SplitReveal as="h2" className={H2}>
            {TAXA_COUNT} lineages, <span className="accent-phrase text-iridescent">from icefish to sea snails</span>
          </SplitReveal>
          <p className="mt-6 max-w-lg leading-relaxed text-ds-muted">
            Trained on {TRAINING} GenBank sequences from {SPECIES} species across {PHYLA} phyla, and{' '}
            {ACCURACY} accurate on {HELD_OUT} sequences it never saw in training.
          </p>

          <ul className="mt-10 border-t border-ds-line" aria-label="Taxa the model predicts">
            {TAXA_REFERENCE.map((t, i) => (
              <li key={t.name} data-reveal>
                <button
                  type="button"
                  onClick={() => setSelected(i)}
                  aria-pressed={i === selected}
                  aria-controls="taxon-detail"
                  className={cn(
                    'flex w-full items-center gap-4 border-b border-ds-line py-4 text-left transition-colors',
                    i === selected ? 'text-ds-ink' : 'text-ds-muted hover:text-ds-ink'
                  )}
                >
                  <span
                    className={cn('h-2.5 w-2.5 shrink-0 rounded-full transition-transform', i === selected && 'scale-150')}
                    style={{ background: taxonColor(t.classId) }}
                    aria-hidden="true"
                  />
                  <span className="text-lg font-light tracking-tight">{t.name}</span>
                  <span className="hidden text-sm sm:inline">{t.commonName}</span>
                  <span className="ml-auto font-mono text-xs tabular-nums" title="Training reads">
                    {t.trainingCount.toLocaleString()}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <article
          id="taxon-detail"
          aria-live="polite"
          className="glass-strong self-start rounded-[28px] border border-ds-line p-7 sm:p-10 lg:sticky lg:top-28"
        >
          <p className="text-sm text-ds-muted">{taxon.lineage.join(' / ')}</p>
          <h3 className="mt-6 text-4xl font-light tracking-[-0.03em] sm:text-5xl">{taxon.name}</h3>
          <p className="accent-phrase mt-1 text-2xl text-ds-muted">{taxon.commonName}</p>
          <p className="mt-6 max-w-prose leading-relaxed text-ds-muted">{taxon.description}</p>

          <dl className="mt-10 grid grid-cols-1 gap-px overflow-hidden rounded-2xl bg-ds-line sm:grid-cols-3">
            {facts.map(([label, value]) => (
              <div key={label} className="bg-ds-surface p-4">
                <dt className="text-xs text-ds-muted">{label}</dt>
                <dd className="mt-2 text-2xl font-light tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>

          {validation && confused && (
            <p className="mt-6 text-sm leading-relaxed text-ds-muted">
              Most often mistaken for <span className="text-ds-ink">{confused.name}</span>: {confused.count} of{' '}
              {validation.support.toLocaleString()} held-out reads.
            </p>
          )}

          <Link to="/taxa" className={cn(GHOST_BUTTON, 'mt-8 h-11')}>
            Open in Taxa Explorer
          </Link>
        </article>
      </div>
    </section>
  );
}

export function LandingPage() {
  const reducedMotion = usePrefersReducedMotion();
  const [showIntro] = useState(() => {
    try {
      return shouldShowIntro(window.sessionStorage, reducedMotion);
    } catch {
      return false;
    }
  });
  const [introDone, setIntroDone] = useState(!showIntro);
  useLenis(true);
  const mainRef = useRef<HTMLElement>(null);
  useRevealOnScroll(mainRef, [introDone]);
  const stage = useRef(0);
  const [stageIndex, setStageIndex] = useState(0);
  const stepAnchors = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    // Measured synchronously so the scene's scroll-driven frame sees the new value
    const update = () => {
      stage.current = measureStage();
      setStageIndex(Math.round(stage.current));
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  const activeStep = Math.min(Math.max(stageIndex - 1, 0), STEPS.length - 1);
  const scrollToStep = (index: number) =>
    stepAnchors.current[index]?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' });

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative min-h-screen overflow-x-clip text-ds-ink">
        {showIntro && !introDone && <Preloader onDone={() => setIntroDone(true)} />}
        {/* Painted before the helix canvas so the back copy sits under it and the front letters over it */}
        <LayeredWordmark />
        <Scene3DGate className="pointer-events-none fixed inset-0 z-0" fallback={null}>
          {({ animate, gentle }) => (
            <GlassHelix stage={stage} poses={POSES} bases={SAMPLE?.sequence ?? 'ACGT'} animate={animate} gentle={gentle} />
          )}
        </Scene3DGate>

        <header className="fixed inset-x-3 top-3 z-40 sm:inset-x-6 sm:top-5">
          <nav
            aria-label="Main"
            className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 rounded-full border border-ds-line bg-ds-bg/70 pl-5 pr-2 backdrop-blur-xl"
          >
            <a href="#top" className="flex items-center gap-2.5 text-[15px] font-medium tracking-tight">
              <BrandMark />
              DeepSea eDNA
            </a>
            <ul className="hidden items-center gap-8 text-sm text-ds-muted md:flex">
              {NAV.map((item) => (
                <li key={item.href}>
                  <a href={item.href} className="transition-colors hover:text-ds-ink">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
            <div className="flex items-center gap-1.5">
              <Link to="/login" className={cn(PRIMARY_BUTTON, 'h-10 px-5')}>
                Sign in
              </Link>
            </div>
          </nav>
        </header>

        <main ref={mainRef} className="relative z-10">
          <section
            id="top"
            data-stage
            className={cn('relative flex min-h-svh flex-col justify-end pb-14 pt-36 lg:pb-16', PAGE_X)}
          >
            {/* Keyed on the intro so the reveal plays when the curtain lifts, not underneath it */}
            {/* On phones the helix runs behind the text, so it gets the same frosted backing as How it works */}
            <div
              key={introDone ? 'hero' : 'hero-waiting'}
              className="-mx-2 rounded-3xl bg-ds-bg/60 p-5 backdrop-blur-md md:mx-0 md:bg-transparent md:p-0 md:backdrop-blur-none"
            >
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.9, duration: 0.8 }}
                className="mb-8 max-w-[19rem] text-[15px] leading-relaxed text-ds-muted"
              >
                Classify marine environmental DNA into {TAXA_COUNT} orders and classes. {ACCURACY} accurate on reads it
                never saw in training.
              </motion.p>

              <h1 className="text-[clamp(3rem,8vw,7.5rem)] font-light leading-[0.95] tracking-[-0.045em] [text-wrap:balance]">
                <RevealLine index={0}>Read the ocean</RevealLine>
                <RevealLine index={1} className="accent-phrase text-iridescent">
                  from a drop of water
                </RevealLine>
              </h1>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7, duration: 0.8 }}
                className="mt-10 flex flex-wrap items-center gap-3"
              >
                <Link to="/login" className={PRIMARY_BUTTON}>
                  Classify a sequence
                </Link>
                <a href="#how" className={GHOST_BUTTON}>
                  See how it works
                </a>
              </motion.div>
            </div>
          </section>

          <HowItWorks activeStep={activeStep} onSelect={scrollToStep} anchors={stepAnchors} />

          <TaxaSection />

          <section id="platform" data-stage className={cn('relative pb-[38vh] pt-28 lg:pt-36', PAGE_X)}>
            <div className="mx-auto max-w-6xl">
              <SplitReveal as="h2" className={cn(H2, 'mx-auto max-w-3xl text-center')}>
                Around the classifier, <span className="accent-phrase text-iridescent">a full workbench</span>
              </SplitReveal>
              <div className="mt-16 grid gap-4 md:grid-cols-3">
                {FEATURES.map(({ icon: Icon, title, body }) => (
                  <div
                    key={title}
                    data-reveal
                    className="glass glass-hover rounded-[28px] border border-ds-line p-7 text-center"
                  >
                    <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-ds-line bg-ds-bg/60">
                      <Icon className="h-5 w-5 text-ds-ink" aria-hidden="true" />
                    </span>
                    <h3 className="mt-6 text-lg font-normal tracking-tight">{title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-ds-muted">{body}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section id="faq" data-stage className={cn('relative pb-24 pt-[34vh]', PAGE_X)}>
            <div className="mx-auto max-w-4xl">
              <SplitReveal as="h2" className={cn(H2, 'text-[clamp(2.5rem,6vw,5.5rem)]')}>
                Still have <span className="accent-phrase text-iridescent">open questions</span>?
              </SplitReveal>
              <div className="mt-12 border-t border-ds-line">
                {FAQ.map(({ q, a }) => (
                  <details key={q} data-reveal className="group border-b border-ds-line">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-6 text-lg font-light tracking-tight sm:text-xl [&::-webkit-details-marker]:hidden">
                      {q}
                      <ChevronDown
                        className="h-5 w-5 shrink-0 text-ds-muted transition-transform duration-300 group-open:rotate-180"
                        aria-hidden="true"
                      />
                    </summary>
                    <p className="max-w-2xl pb-6 leading-relaxed text-ds-muted">{a}</p>
                  </details>
                ))}
              </div>
              <div className="mt-10 flex flex-col gap-3 glass rounded-2xl border border-ds-line px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-lg font-light">Not answered here?</span>
                <a
                  href={`${REPO_URL}/issues`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-iridescent text-lg underline-offset-4 hover:underline"
                >
                  Open an issue on GitHub
                </a>
              </div>
            </div>
          </section>

          <section data-stage className={cn('relative py-28 text-center', PAGE_X)}>
            <SplitReveal as="h2" className={cn(H2, 'mx-auto max-w-3xl')}>
              Start with <span className="accent-phrase text-iridescent">one sequence</span>
            </SplitReveal>
            <p className="mx-auto mt-6 max-w-md leading-relaxed text-ds-muted">
              Paste a barcode read and get its lineage, a confidence score and a novelty flag in milliseconds.
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <Link to="/login" className={PRIMARY_BUTTON}>
                Sign in to classify
              </Link>
              <Link to="/login?mode=register" className={GHOST_BUTTON}>
                Create an account
              </Link>
            </div>
          </section>
        </main>

        <footer className={cn('relative z-10 border-t border-ds-line py-8', PAGE_X)}>
          <div className="mx-auto flex max-w-7xl flex-col gap-4 text-sm text-ds-muted sm:flex-row sm:items-center sm:justify-between">
            <span className="flex items-center gap-2 text-ds-ink">
              <BrandMark className="h-5 w-5" />
              DeepSea eDNA AI
            </span>
            <span>Open source under the MIT license</span>
            <a href={REPO_URL} target="_blank" rel="noreferrer" className="transition-colors hover:text-ds-ink">
              Source on GitHub
            </a>
          </div>
        </footer>
      </div>
    </MotionConfig>
  );
}
