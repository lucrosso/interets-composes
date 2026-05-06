import { useState, useMemo, useEffect } from 'react';
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';

// ─── CONSTANTES ───────────────────────────────────────────────────────────────
const BRAND_NAME = 'Wassel Capital';

// Les 5 profils d'allocation avec leur rendement net fixe
const ALLOCATIONS = [
  { key: 'tresPrudente',   label: 'Très prudente',   netReturn: 3, color: '#94a3b8' },
  { key: 'plutotPrudente', label: 'Plutôt prudente',  netReturn: 4, color: '#60a5fa' },
  { key: 'equilibree',     label: 'Équilibrée',        netReturn: 5, color: '#34d399' },
  { key: 'dynamique',      label: 'Dynamique',          netReturn: 7, color: '#fbbf24' },
  { key: 'offensive',      label: 'Offensive',           netReturn: 9, color: '#f87171' },
];

// Poids par défaut — actuel : tout en très prudent ; optimisé : diversifié
const DEFAULT_WEIGHTS_ACTUEL   = { tresPrudente: 100, plutotPrudente: 0,  equilibree: 0,  dynamique: 0,  offensive: 0  };
const DEFAULT_WEIGHTS_OPTIMISE = { tresPrudente: 0,   plutotPrudente: 10, equilibree: 40, dynamique: 40, offensive: 10 };

// Couleurs des courbes de projection selon le thème
const CHART_COLORS = {
  dark:  { actual: '#f87171', optimised: '#4ade80' },
  light: { actual: '#dc2626', optimised: '#16a34a' },
};

// ─── CALCUL DU RENDEMENT PONDÉRÉ ──────────────────────────────────────────────
function calcWeightedReturn(weights) {
  const total = ALLOCATIONS.reduce((s, a) => s + (weights[a.key] || 0), 0);
  if (total === 0) return 0;
  return ALLOCATIONS.reduce((s, a) => s + ((weights[a.key] || 0) / total) * a.netReturn, 0);
}

// ─── FORMATTERS ───────────────────────────────────────────────────────────────
const fmt = (n) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(n)) + ' €';

const fmtAxis = (n) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
};

const fmtMultiple = (total, invested) =>
  invested > 0 ? `× ${(total / invested).toFixed(2)}` : '—';

// ─── DEBOUNCE HOOK ────────────────────────────────────────────────────────────
function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ─── SLIDER (paramètres communs) ──────────────────────────────────────────────
function Slider({ label, value, onChange, min, max, step = 1, suffix = '' }) {
  const [local, setLocal] = useState(value);
  useEffect(() => { setLocal(value); }, [value]);
  const debounced = useDebounce(local, 300);
  useEffect(() => {
    if (debounced !== value) onChange(debounced);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="input-label truncate">{label}</span>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <input type="number" min={min} max={max} step={step} value={local}
            onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) setLocal(Math.min(max, Math.max(min, v))); }}
            className="input-field !w-24 !py-1.5 text-right tabular-nums" />
          {suffix && <span className="text-sm min-w-fit" style={{ color: 'var(--color-text-muted)' }}>{suffix}</span>}
        </div>
      </div>
      <input type="range" min={min} max={max} step={step} value={local}
        onChange={(e) => setLocal(parseFloat(e.target.value))} className="w-full" />
      <div className="flex justify-between text-xs" style={{ color: 'var(--color-text-faint)' }}>
        <span>{min}{suffix ? ` ${suffix}` : ''}</span>
        <span>{max}{suffix ? ` ${suffix}` : ''}</span>
      </div>
    </div>
  );
}

// ─── SLIDER D'ALLOCATION (une ligne par profil) ───────────────────────────────
function AllocationSlider({ allocation, value, onChange }) {
  const [local, setLocal] = useState(value);
  useEffect(() => { setLocal(value); }, [value]);
  const debounced = useDebounce(local, 200);
  useEffect(() => {
    if (debounced !== value) onChange(debounced);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: allocation.color }} />
        <span className="text-xs font-medium flex-1 truncate" style={{ color: 'var(--color-text-secondary)' }}>
          {allocation.label}
        </span>
        <span className="text-xs tabular-nums flex-shrink-0" style={{ color: 'var(--color-text-faint)' }}>
          {allocation.netReturn}%/an net
        </span>
        <input
          type="number" min={0} max={100} step={1} value={local}
          onChange={(e) => { const v = Math.min(100, Math.max(0, parseInt(e.target.value) || 0)); setLocal(v); }}
          className="input-field !w-14 !py-0.5 !px-2 text-right tabular-nums text-xs flex-shrink-0"
        />
        <span className="text-xs flex-shrink-0" style={{ color: 'var(--color-text-muted)' }}>%</span>
      </div>
      <input type="range" min={0} max={100} step={1} value={local}
        onChange={(e) => setLocal(parseInt(e.target.value))} className="w-full" />
    </div>
  );
}

// ─── PANNEAU DONUT + LÉGENDE D'ALLOCATION ─────────────────────────────────────
function AllocationDonut({ weights }) {
  const weightedReturn = calcWeightedReturn(weights);
  const data = ALLOCATIONS
    .map(a => ({ name: a.label, value: weights[a.key] || 0, color: a.color }))
    .filter(d => d.value > 0);
  const isEmpty = data.length === 0;

  return (
    <div className="flex items-center gap-5">
      {/* Donut */}
      <div className="relative flex-shrink-0" style={{ width: 108, height: 108 }}>
        <PieChart width={108} height={108}>
          {isEmpty ? (
            <Pie data={[{ value: 1 }]} cx={52} cy={52} innerRadius={34} outerRadius={52}
                 dataKey="value" stroke="none">
              <Cell fill="var(--color-border)" />
            </Pie>
          ) : (
            <Pie data={data} cx={52} cy={52} innerRadius={34} outerRadius={52}
                 dataKey="value" stroke="none" paddingAngle={data.length > 1 ? 2 : 0}>
              {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
            </Pie>
          )}
        </PieChart>
        {/* Label central */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-sm font-bold text-heading leading-none">
            {isEmpty ? '—' : `${weightedReturn.toFixed(1)}%`}
          </span>
          {!isEmpty && (
            <span className="text-[9px] mt-0.5" style={{ color: 'var(--color-text-faint)' }}>net/an</span>
          )}
        </div>
      </div>

      {/* Détail du rendement pondéré */}
      <div className="flex-1 min-w-0">
        <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>
          Rendement annuel moyen pondéré net
        </p>
        <p className="text-2xl font-bold text-heading tabular-nums">
          {isEmpty ? '—' : `${weightedReturn.toFixed(2)} %`}
        </p>
        {/* Légende des couleurs */}
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
          {ALLOCATIONS.filter(a => (weights[a.key] || 0) > 0).map(a => (
            <div key={a.key} className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: a.color }} />
              <span className="text-[10px] tabular-nums" style={{ color: 'var(--color-text-faint)' }}>
                {a.label} {weights[a.key]}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── PANNEAU D'ALLOCATION COMPLET ─────────────────────────────────────────────
function AllocationPanel({ weights, onChange }) {
  const total = ALLOCATIONS.reduce((s, a) => s + (weights[a.key] || 0), 0);

  const totalColor = total === 100
    ? '#22c55e'
    : total > 100
    ? '#ef4444'
    : 'var(--color-text-muted)';

  return (
    <div className="space-y-3">
      {/* Sliders pour chaque profil */}
      <div className="space-y-3">
        {ALLOCATIONS.map(a => (
          <AllocationSlider
            key={a.key}
            allocation={a}
            value={weights[a.key] || 0}
            onChange={(v) => onChange({ ...weights, [a.key]: v })}
          />
        ))}
      </div>

      {/* Indicateur du total */}
      <div className="flex justify-end">
        <span className="text-xs font-semibold tabular-nums" style={{ color: totalColor }}>
          Total : {total} %
          {total === 100 && '  ✓'}
          {total > 100  && ' — dépasse 100 %'}
          {total < 100 && total > 0 && ` — manque ${100 - total} %`}
        </span>
      </div>

      {/* Séparateur */}
      <div className="pt-1" style={{ borderTop: '1px solid var(--color-border)' }} />

      {/* Donut + rendement pondéré */}
      <AllocationDonut weights={weights} />
    </div>
  );
}

// ─── TOGGLE MODE LIBRE / ALLOCATION ──────────────────────────────────────────
function ModeToggle({ mode, onChange }) {
  return (
    <div className="flex rounded-xl overflow-hidden text-xs font-medium flex-shrink-0"
         style={{ border: '1px solid var(--color-border)' }}>
      {[
        { value: 'libre',      label: 'Libre' },
        { value: 'allocation', label: 'Allocation' },
      ].map(opt => (
        <button key={opt.value} onClick={() => onChange(opt.value)}
          className="px-3 py-1.5 transition-all duration-150"
          style={mode === opt.value ? {
            backgroundColor: 'var(--color-brand)',
            color: 'var(--color-text-inverse)',
          } : {
            backgroundColor: 'transparent',
            color: 'var(--color-text-muted)',
          }}>
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ─── METRIC CARD ──────────────────────────────────────────────────────────────
function Metric({ label, value, color }) {
  return (
    <div className="rounded-xl p-4 text-center" style={{ backgroundColor: 'var(--color-bg-input)' }}>
      <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>{label}</p>
      <p className="text-lg font-bold tabular-nums leading-tight"
         style={{ color: color || 'var(--color-text-primary)' }}>{value}</p>
    </div>
  );
}

// ─── TOOLTIP DU GRAPHIQUE ────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label, colors }) {
  if (!active || !payload?.length) return null;
  const find = (key) => payload.find((p) => p.dataKey === key)?.value ?? null;
  const investi  = find('investi');
  const actuel   = find('actuel');
  const optimise = find('optimise');
  const diff     = optimise != null && actuel != null ? optimise - actuel : null;

  return (
    <div className="rounded-xl p-4 text-sm shadow-xl"
         style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', minWidth: 230 }}>
      <p className="font-semibold mb-3 text-heading">{label === 0 ? 'Départ' : `Année ${label}`}</p>
      <div className="space-y-2">
        {investi  != null && <TRow label="Capital investi"     value={fmt(investi)}  color="var(--color-text-muted)" />}
        {actuel   != null && <TRow label="Situation actuelle"  value={fmt(actuel)}   color={colors.actual} />}
        {optimise != null && <TRow label="Situation optimisée" value={fmt(optimise)} color={colors.optimised} />}
        {diff != null && diff > 0 && (
          <div className="pt-2 mt-1" style={{ borderTop: '1px solid var(--color-border)' }}>
            <TRow label="Différence" value={`+${fmt(diff)}`} color={colors.optimised} bold />
          </div>
        )}
      </div>
    </div>
  );
}

function TRow({ label, value, color, bold }) {
  return (
    <div className="flex justify-between gap-6 items-center">
      <span style={{ color }}>{label}</span>
      <span className={`tabular-nums ${bold ? 'font-bold' : 'font-medium'}`} style={{ color }}>{value}</span>
    </div>
  );
}

// ─── LÉGENDE DU GRAPHIQUE ────────────────────────────────────────────────────
function ChartLegend({ colors }) {
  const items = [
    { color: 'var(--color-text-faint)', label: 'Capital investi',    dashed: true },
    { color: colors.actual,             label: 'Situation actuelle' },
    { color: colors.optimised,          label: 'Situation optimisée' },
  ];
  return (
    <div className="flex flex-wrap justify-center gap-5 mt-4">
      {items.map(item => (
        <div key={item.label} className="flex items-center gap-2">
          <svg width="22" height="10" className="flex-shrink-0">
            <line x1="0" y1="5" x2="22" y2="5" stroke={item.color}
                  strokeWidth={item.dashed ? 1.5 : 2}
                  strokeDasharray={item.dashed ? '4 3' : undefined} />
          </svg>
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── LOGO ─────────────────────────────────────────────────────────────────────
function LogoIcon({ size = 16, style }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 110"
         fill="currentColor" width={size} height={size * 1.1} style={style}>
      <path d="M50 0 L97 88 L50 62 L3 88 Z" />
    </svg>
  );
}

// ─── THEME TOGGLE ─────────────────────────────────────────────────────────────
function ThemeToggle({ theme, onToggle }) {
  return (
    <button onClick={onToggle} className="theme-toggle"
            title={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}>
      {theme === 'dark' ? (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="5" strokeWidth="2" />
          <line x1="12" y1="1"  x2="12" y2="3"  strokeWidth="2" strokeLinecap="round" />
          <line x1="12" y1="21" x2="12" y2="23" strokeWidth="2" strokeLinecap="round" />
          <line x1="4.22" y1="4.22"   x2="5.64" y2="5.64"   strokeWidth="2" strokeLinecap="round" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" strokeWidth="2" strokeLinecap="round" />
          <line x1="1"  y1="12" x2="3"  y2="12" strokeWidth="2" strokeLinecap="round" />
          <line x1="21" y1="12" x2="23" y2="12" strokeWidth="2" strokeLinecap="round" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"  strokeWidth="2" strokeLinecap="round" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"  strokeWidth="2" strokeLinecap="round" />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App() {
  // Thème
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'dark';
    return localStorage.getItem('wassel-theme') ||
      (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  });
  useEffect(() => {
    document.documentElement.classList.remove('dark', 'light');
    document.documentElement.classList.add(theme);
    localStorage.setItem('wassel-theme', theme);
  }, [theme]);

  const colors = CHART_COLORS[theme];

  // ── Paramètres communs ──
  const [capitalInitial,   setCapitalInitial]   = useState(50000);
  const [versementMensuel, setVersementMensuel] = useState(500);
  const [duree,            setDuree]            = useState(20);

  // ── Scénario actuel ──
  const [modeActuel,    setModeActuel]    = useState('libre');
  const [tauxActuel,    setTauxActuel]    = useState(2.5);
  const [weightsActuel, setWeightsActuel] = useState(DEFAULT_WEIGHTS_ACTUEL);

  // ── Scénario optimisé ──
  const [modeOptimise,    setModeOptimise]    = useState('libre');
  const [tauxOptimise,    setTauxOptimise]    = useState(6.0);
  const [weightsOptimise, setWeightsOptimise] = useState(DEFAULT_WEIGHTS_OPTIMISE);

  // Taux effectifs selon le mode sélectionné
  const effectiveTauxActuel   = modeActuel   === 'libre' ? tauxActuel   : calcWeightedReturn(weightsActuel);
  const effectiveTauxOptimise = modeOptimise === 'libre' ? tauxOptimise : calcWeightedReturn(weightsOptimise);

  // ── Données du graphique ──
  const chartData = useMemo(() => {
    const computeCapital = (taux, n) => {
      // Taux mensuel équivalent (fonctionne pour les taux négatifs aussi)
      const r = Math.pow(1 + taux / 100, 1 / 12) - 1;
      const capitalCompound = capitalInitial * Math.pow(1 + r, n);
      // Formule des rentes valable pour r > 0, r < 0, et r ≈ 0
      const annuityFV = r !== 0
        ? versementMensuel * (Math.pow(1 + r, n) - 1) / r
        : versementMensuel * n;
      return Math.round(capitalCompound + annuityFV);
    };
    return Array.from({ length: duree + 1 }, (_, year) => {
      const n = year * 12;
      return {
        year,
        investi:  Math.round(capitalInitial + versementMensuel * n),
        actuel:   computeCapital(effectiveTauxActuel,   n),
        optimise: computeCapital(effectiveTauxOptimise, n),
      };
    });
  }, [capitalInitial, versementMensuel, duree, effectiveTauxActuel, effectiveTauxOptimise]);

  const final          = chartData[chartData.length - 1] ?? { investi: 0, actuel: 0, optimise: 0 };
  const gainsActuel    = final.actuel   - final.investi;
  const gainsOptimise  = final.optimise - final.investi;
  const avantage       = final.optimise - final.actuel;
  const hasAdvantage   = avantage > 0;
  // Domaine Y : prend en compte les valeurs potentiellement négatives (taux réel < 0)
  const yMin           = Math.min(0, Math.floor(final.actuel * 1.08));
  const yMax           = Math.ceil(final.optimise * 1.08);
  const xTickInterval  = Math.max(1, Math.floor(duree / 8));

  const renderTooltip = (props) => <ChartTooltip {...props} colors={colors} />;

  return (
    <div className="min-h-screen transition-colors duration-300"
         style={{ backgroundColor: 'var(--color-bg-primary)' }}>

      {/* ━━━ HEADER ━━━ */}
      <header className="sticky top-0 z-50 backdrop-blur-md"
              style={{
                backgroundColor: theme === 'dark' ? 'rgba(10,10,10,0.88)' : 'rgba(255,255,255,0.92)',
                borderBottom: '1px solid var(--color-border)',
              }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                 style={{ backgroundColor: 'var(--color-brand)' }}>
              <LogoIcon size={16} style={{ color: 'var(--color-text-inverse)' }} />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-heading">{BRAND_NAME}</span>
              <span className="hidden sm:inline text-faint text-sm">·</span>
              <span className="hidden sm:inline text-muted text-sm">Intérêts composés</span>
            </div>
          </div>
          <ThemeToggle theme={theme} onToggle={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-5">

        {/* ━━━ INTRO ━━━ */}
        <div className="text-center py-2">
          <h1 className="text-2xl font-bold text-heading mb-2">Simulation de capitalisation</h1>
          <p className="text-sm max-w-lg mx-auto" style={{ color: 'var(--color-text-muted)' }}>
            Visualisez l'impact concret d'une optimisation patrimoniale sur le long terme.
            Toutes les projections sont{' '}
            <strong className="text-heading">nettes de frais de gestion</strong>.
          </p>
        </div>

        {/* ━━━ PARAMÈTRES COMMUNS ━━━ */}
        <section className="card">
          <h2 className="text-heading font-semibold mb-5">Paramètres de la simulation</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <Slider label="Capital de départ"  value={capitalInitial}   onChange={setCapitalInitial}
                    min={0} max={1000000} step={5000} suffix="€" />
            <Slider label="Versement mensuel"  value={versementMensuel} onChange={setVersementMensuel}
                    min={0} max={10000} step={50} suffix="€" />
            <Slider label="Durée de placement" value={duree}            onChange={setDuree}
                    min={1} max={40} step={1} suffix="ans" />
          </div>
        </section>

        {/* ━━━ SCÉNARIOS ━━━ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">

          {/* ── Scénario actuel ── */}
          <div className="card">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                   style={{ backgroundColor: colors.actual }} />
              <h3 className="text-heading font-semibold flex-1">Situation actuelle</h3>
              <ModeToggle mode={modeActuel} onChange={setModeActuel} />
            </div>

            {modeActuel === 'libre' ? (
              <>
                <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>
                  Saisissez le rendement net annuel réel (après inflation et frais). Un taux négatif illustre
                  l'érosion de l'épargne par l'inflation.
                </p>
                {/* Alerte inflation : s'affiche quand le taux est négatif */}
                {tauxActuel < 0 && (
                  <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg mb-4"
                       style={{ backgroundColor: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171' }}>
                    <span>📉</span>
                    <span>
                      Rendement réel négatif — l'inflation érode le pouvoir d'achat de l'épargne
                      de <strong>{Math.abs(tauxActuel).toFixed(1)} %/an</strong>.
                    </span>
                  </div>
                )}
                <Slider label="Rendement net annuel réel" value={tauxActuel} onChange={setTauxActuel}
                        min={-10} max={15} step={0.1} suffix="%" />
              </>
            ) : (
              <>
                <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>
                  Définissez la pondération de chaque profil pour calculer le rendement moyen pondéré net.
                </p>
                <AllocationPanel weights={weightsActuel} onChange={setWeightsActuel} />
              </>
            )}
          </div>

          {/* ── Scénario optimisé ── La carte se distingue visuellement par sa bordure card-highlight ── */}
          <div className="card-highlight">
            {/* Structure identique à la carte gauche */}
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                   style={{ backgroundColor: colors.optimised }} />
              <h3 className="text-heading font-semibold flex-1">Situation optimisée</h3>
              <ModeToggle mode={modeOptimise} onChange={setModeOptimise} />
            </div>

            {modeOptimise === 'libre' ? (
              <>
                <p className="text-xs mb-5" style={{ color: 'var(--color-text-muted)' }}>
                  Saisissez le rendement net annuel réel après optimisation {BRAND_NAME}, tous frais compris.
                </p>
                <Slider label="Rendement net annuel réel" value={tauxOptimise} onChange={setTauxOptimise}
                        min={-10} max={15} step={0.1} suffix="%" />
              </>
            ) : (
              <>
                <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>
                  Définissez l'allocation cible recommandée pour calculer le rendement moyen pondéré net.
                </p>
                <AllocationPanel weights={weightsOptimise} onChange={setWeightsOptimise} />
              </>
            )}
          </div>
        </div>

        {/* ━━━ GRAPHIQUE ━━━ */}
        <div className="card">
          <div className="mb-1">
            <h2 className="text-heading font-semibold">Projection de capitalisation</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              Évolution de votre capital sur {duree} an{duree > 1 ? 's' : ''}
            </p>
          </div>
          <div className="mt-4" style={{ width: '100%', height: 320 }}>
            <ResponsiveContainer>
              <ComposedChart data={chartData} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradActuel" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={colors.actual}    stopOpacity={0.18} />
                    <stop offset="95%" stopColor={colors.actual}    stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradOptimise" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={colors.optimised} stopOpacity={0.20} />
                    <stop offset="95%" stopColor={colors.optimised} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.6} />
                <XAxis dataKey="year"
                       tick={{ fill: 'var(--color-text-faint)', fontSize: 11 }}
                       axisLine={{ stroke: 'var(--color-border)' }} tickLine={false}
                       tickFormatter={(v) => (v === 0 ? 'Départ' : `Année ${v}`)}
                       interval={xTickInterval} />
                <YAxis domain={[yMin, yMax]}
                       tick={{ fill: 'var(--color-text-faint)', fontSize: 11 }}
                       axisLine={false} tickLine={false} tickFormatter={fmtAxis} width={52} />
                <Tooltip content={renderTooltip} cursor={{ stroke: 'var(--color-border)', strokeWidth: 1 }} />
                <Line type="monotone" dataKey="investi"
                      stroke="var(--color-text-faint)" strokeWidth={1.5}
                      strokeDasharray="5 3" dot={false} />
                <Area type="monotone" dataKey="actuel"
                      stroke={colors.actual} strokeWidth={2} fill="url(#gradActuel)" dot={false} />
                <Area type="monotone" dataKey="optimise"
                      stroke={colors.optimised} strokeWidth={2.5} fill="url(#gradOptimise)" dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <ChartLegend colors={colors} />
        </div>

        {/* ━━━ RÉSULTATS ━━━ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="card">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                   style={{ backgroundColor: colors.actual }} />
              <h3 className="text-heading font-semibold">Situation actuelle</h3>
              <span className="text-xs ml-auto tabular-nums font-semibold"
                    style={{ color: colors.actual }}>
                {effectiveTauxActuel.toFixed(2)} %/an net
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Metric label="Capital final"   value={fmt(final.actuel)} />
              <Metric label={gainsActuel >= 0 ? 'Gains générés' : 'Perte de valeur'}
                      value={(gainsActuel >= 0 ? '+' : '') + fmt(gainsActuel)}
                      color={gainsActuel >= 0 ? colors.optimised : colors.actual} />
              <Metric label="Capital investi" value={fmt(final.investi)} />
              <Metric label="Multiplication"  value={fmtMultiple(final.actuel, final.investi)} />
            </div>
          </div>

          <div className="card-highlight">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                   style={{ backgroundColor: colors.optimised }} />
              <h3 className="text-heading font-semibold">Situation optimisée</h3>
              <span className="text-xs ml-auto tabular-nums font-semibold"
                    style={{ color: colors.optimised }}>
                {effectiveTauxOptimise.toFixed(2)} %/an net
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Metric label="Capital final"   value={fmt(final.optimise)} color={colors.optimised} />
              <Metric label="Gains générés"   value={fmt(gainsOptimise)}
                      color={gainsOptimise >= 0 ? colors.optimised : colors.actual} />
              <Metric label="Capital investi" value={fmt(final.investi)} />
              <Metric label="Multiplication"  value={fmtMultiple(final.optimise, final.investi)}
                      color={colors.optimised} />
            </div>
          </div>
        </div>

        {/* ━━━ CALLOUT ━━━ */}
        {hasAdvantage && (
          <div className="card-highlight text-center py-8 animate-fade-in">
            <p className="text-sm mb-2" style={{ color: 'var(--color-text-muted)' }}>
              Gain de l'optimisation sur {duree} an{duree > 1 ? 's' : ''}
            </p>
            <p className="text-5xl font-bold mb-2 animate-count-up text-heading">+{fmt(avantage)}</p>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              de capital supplémentaire grâce à l'optimisation {BRAND_NAME}
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-6 text-sm pt-5"
                 style={{ borderTop: '1px solid var(--color-border-highlight)' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>
                <span className="font-semibold text-heading">+{fmt(gainsOptimise - gainsActuel)}</span>{' '}
                de gains nets supplémentaires
              </span>
              <span style={{ color: 'var(--color-text-muted)' }}>
                <span className="font-semibold" style={{ color: colors.optimised }}>{effectiveTauxOptimise.toFixed(2)}%</span>
                {' '}vs{' '}
                <span className="font-semibold" style={{ color: colors.actual }}>{effectiveTauxActuel.toFixed(2)}%</span>
                {' '}actuellement
              </span>
            </div>
          </div>
        )}

        {/* ━━━ DISCLAIMER ━━━ */}
        <p className="text-xs text-center pb-2" style={{ color: 'var(--color-text-faint)' }}>
          Simulation indicative réalisée nette de tous frais de gestion. Les performances passées ne préjugent pas
          des performances futures. Document non contractuel à titre pédagogique.
        </p>
      </main>

      {/* ━━━ FOOTER ━━━ */}
      <footer className="py-6 text-center text-xs"
              style={{ color: 'var(--color-text-faint)', borderTop: '1px solid var(--color-border)' }}>
        © {new Date().getFullYear()} {BRAND_NAME} · Simulation indicative, non contractuelle
      </footer>
    </div>
  );
}
