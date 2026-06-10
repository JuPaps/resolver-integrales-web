// ═══════════════════════════════════════════════════════════════════════════════
//  MathSolver — Motor de Integración Simbólica (Pure TypeScript, zero deps)
//  Soporta: potencias, trig, trig inversa, exponencial, logarítmica,
//           composición lineal, integración por partes, identidades trig,
//           formas especiales (arco, 1/(a²+x²), etc.)
// ═══════════════════════════════════════════════════════════════════════════════

export interface MathStep {
  id: number;
  rule: string;
  explanation: string;
  formula: string;
}

export interface PlotPoint {
  x: number;
  fx: number | null;
  Fx: number | null;
  isArea?: boolean;
}

export interface SolveResult {
  success: boolean;
  integrand_latex?: string;
  solution_latex?: string;
  steps?: MathStep[];
  tips?: string[];
  warnings?: string[];
  methods?: string[];
  plotData?: PlotPoint[];
  error?: string;
  definite_value?: number;
  definite_latex?: string;
}

// ─── LaTeX conversion ─────────────────────────────────────────────────────────
export function toLatex(s: string): string {
  return s
    .replace(/\bsqrt\(([^)]+)\)/g, '\\sqrt{$1}')
    .replace(/\barcsin\(/g, '\\arcsin(')
    .replace(/\barccos\(/g, '\\arccos(')
    .replace(/\barctan\(/g, '\\arctan(')
    .replace(/\basin\(/g, '\\operatorname{asin}(')
    .replace(/\bacos\(/g, '\\operatorname{acos}(')
    .replace(/\batan\(/g, '\\arctan(')
    .replace(/\bsin\(/g, '\\sin(')
    .replace(/\bcos\(/g, '\\cos(')
    .replace(/\btan\(/g, '\\tan(')
    .replace(/\bsec\(/g, '\\sec(')
    .replace(/\bcsc\(/g, '\\csc(')
    .replace(/\bcot\(/g, '\\cot(')
    .replace(/\bln\(/g, '\\ln(')
    .replace(/\blog\(/g, '\\log(')
    .replace(/\bexp\(/g, '\\exp(')
    .replace(/\bpi\b/g, '\\pi')
    .replace(/\babs\(/g, '|')
    .replace(/([a-zA-Z0-9_)]+)\^(-?[\d.]+)/g, '$1^{$2}')
    .replace(/([a-zA-Z0-9_)]+)\^\(([^)]+)\)/g, '$1^{$2}')
    .replace(/\*/g, '\\cdot ')
    .replace(/\|x\|/g, '|x|');
}

// Pretty fraction
function frac(num: number, den: number): string {
  if (den === 1) return String(num);
  if (num < 0 && den < 0) return `${-num}/${-den}`;
  return `(${num}/${den})`;
}

function coeffStr(c: number): string {
  if (c === 1) return '';
  if (c === -1) return '-';
  if (Number.isInteger(c)) return String(c) + '*';
  return c.toFixed(4).replace(/0+$/, '').replace(/\.$/, '') + '*';
}

// ─── Safe numeric evaluator ──────────────────────────────────────────────────
function safeEval(expr: string, xVal: number): number {
  const s = expr
    .replace(/\bx\b/g, `(${xVal})`)
    .replace(/\bpi\b/g, String(Math.PI))
    .replace(/\be\b/g, String(Math.E))
    .replace(/\bsin\(/g, 'Math.sin(')
    .replace(/\bcos\(/g, 'Math.cos(')
    .replace(/\btan\(/g, 'Math.tan(')
    .replace(/\bsec\(/g, '(1/Math.cos(')
    .replace(/\bcsc\(/g, '(1/Math.sin(')
    .replace(/\bcot\(/g, '(1/Math.tan(')
    .replace(/\bsqrt\(/g, 'Math.sqrt(')
    .replace(/\bln\(/g, 'Math.log(')
    .replace(/\blog\(/g, 'Math.log(')
    .replace(/\bexp\(/g, 'Math.exp(')
    .replace(/\babs\(/g, 'Math.abs(')
    .replace(/\barcsin\(/g, 'Math.asin(')
    .replace(/\barccos\(/g, 'Math.acos(')
    .replace(/\barctan\(/g, 'Math.atan(')
    .replace(/\^/g, '**');
  try {
    const v = new Function(`"use strict"; return (${s});`)();
    return typeof v === 'number' ? v : NaN;
  } catch { return NaN; }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  INTEGRATION RULES — ordered from most specific to most general
// ═══════════════════════════════════════════════════════════════════════════════

interface IntegrationResult {
  antiderivative: string;
  rule: string;
  explanation: string;
  latexRule?: string;
  alternativeMethods?: string[];
}

function tryIntegrate(raw: string): IntegrationResult | null {
  const s = raw.trim();
  if (!s) return null;

  // ── 0. Pure constant ────────────────────────────────────────────────────────
  if (/^-?[\d.]+$/.test(s)) {
    return {
      antiderivative: `${s}*x`,
      rule: 'Integral de una constante',
      explanation: `La integral de una constante k es k·x. Aquí k = ${s}.`,
      latexRule: '\\int k\\,dx = kx + C',
    };
  }

  // ── 1. Just x ──────────────────────────────────────────────────────────────
  if (s === 'x') {
    return {
      antiderivative: '(1/2)*x^2',
      rule: 'Regla de la Potencia (n=1)',
      explanation: '∫x dx = x²/2 + C. Se aplica la regla de la potencia con n = 1.',
      latexRule: '\\int x\\,dx = \\frac{x^2}{2} + C',
    };
  }

  // ── 2. a*x (linear) ────────────────────────────────────────────────────────
  const linM = s.match(/^(-?[\d.]+)\*?x$/);
  if (linM) {
    const a = Number(linM[1]);
    const c = a / 2;
    return {
      antiderivative: `${c}*x^2`,
      rule: 'Regla de la Potencia (n=1)',
      explanation: `∫${a}x dx = ${a}·x²/2 = ${c}x². Se saca la constante y se aplica la regla de potencia.`,
      latexRule: `\\int ${a}x\\,dx = \\frac{${a}x^2}{2} = ${c}x^2 + C`,
    };
  }

  // ── 3. x^n  or  a*x^n (POWER RULE) ─────────────────────────────────────────
  const powM = s.match(/^(-?[\d.]*)\*?x\^(-?[\d.]+)$/);
  if (powM) {
    const aRaw = powM[1]; const nRaw = powM[2];
    const a = aRaw === '' ? 1 : aRaw === '-' ? -1 : Number(aRaw);
    const n = Number(nRaw);
    if (n === -1) {
      return {
        antiderivative: `${a !== 1 ? `${a}*` : ''}ln(abs(x))`,
        rule: 'Integral de 1/x',
        explanation: `∫x⁻¹ dx = ln|x| + C. La regla de la potencia NO aplica cuando n = -1.${a !== 1 ? ` Se multiplica por la constante ${a}.` : ''}`,
        latexRule: '\\int \\frac{1}{x}\\,dx = \\ln|x| + C',
        alternativeMethods: ['Este es un caso especial que se deriva de la definición del logaritmo natural.'],
      };
    }
    const np = n + 1;
    const c = a / np;
    const cs = Number.isInteger(c) ? String(c) : c.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
    const ad = `${cs === '1' ? '' : cs === '-1' ? '-' : cs + '*'}x^${np}`;
    return {
      antiderivative: ad,
      rule: 'Regla de la Potencia',
      explanation: `Se suma 1 al exponente (${n} → ${np}) y se divide entre el nuevo exponente. ${a !== 1 ? `El coeficiente ${a} se conserva: ${a}/(${np}) = ${cs}.` : `Coeficiente: 1/${np} = ${cs}.`}`,
      latexRule: `\\int x^{${n}}\\,dx = \\frac{x^{${np}}}{${np}} + C`,
    };
  }

  // ── 4. 1/x ─────────────────────────────────────────────────────────────────
  if (s === '1/x') {
    return {
      antiderivative: 'ln(abs(x))',
      rule: 'Integral de 1/x',
      explanation: '∫1/x dx = ln|x| + C. Caso especial donde la regla de la potencia (n = -1) no aplica.',
      latexRule: '\\int \\frac{1}{x}\\,dx = \\ln|x| + C',
    };
  }

  // ── 5. BASIC TRIGONOMETRIC ──────────────────────────────────────────────────
  const trigBasic: Record<string, { ad: string; rule: string; exp: string; latex: string }> = {
    'sin(x)':    { ad: '-cos(x)',         rule: 'Integral de sin(x)',       exp: '∫sin(x)dx = -cos(x) + C.',          latex: '\\int \\sin x\\,dx = -\\cos x + C' },
    'cos(x)':    { ad: 'sin(x)',          rule: 'Integral de cos(x)',       exp: '∫cos(x)dx = sin(x) + C.',           latex: '\\int \\cos x\\,dx = \\sin x + C' },
    'tan(x)':    { ad: '-ln(abs(cos(x)))', rule: 'Integral de tan(x)',      exp: '∫tan(x)dx = -ln|cos(x)| + C. Se reescribe como ∫sin/cos dx y se sustituye u = cos(x).', latex: '\\int \\tan x\\,dx = -\\ln|\\cos x| + C' },
    'sec(x)^2':  { ad: 'tan(x)',          rule: 'Integral de sec²(x)',      exp: '∫sec²(x)dx = tan(x) + C. Es la derivada inversa de tan(x).', latex: '\\int \\sec^2 x\\,dx = \\tan x + C' },
    'csc(x)^2':  { ad: '-cot(x)',         rule: 'Integral de csc²(x)',      exp: '∫csc²(x)dx = -cot(x) + C. Es la derivada inversa de cot(x).', latex: '\\int \\csc^2 x\\,dx = -\\cot x + C' },
    'sec(x)*tan(x)': { ad: 'sec(x)',      rule: 'Integral de sec(x)tan(x)', exp: '∫sec(x)tan(x)dx = sec(x) + C. Es la derivada inversa de sec(x).', latex: '\\int \\sec x \\tan x\\,dx = \\sec x + C' },
    'csc(x)*cot(x)': { ad: '-csc(x)',     rule: 'Integral de csc(x)cot(x)', exp: '∫csc(x)cot(x)dx = -csc(x) + C. Es la derivada inversa de csc(x).', latex: '\\int \\csc x \\cot x\\,dx = -\\csc x + C' },
    'cot(x)':    { ad: 'ln(abs(sin(x)))', rule: 'Integral de cot(x)',       exp: '∫cot(x)dx = ln|sin(x)| + C. Se reescribe como ∫cos/sin dx y se sustituye u = sin(x).', latex: '\\int \\cot x\\,dx = \\ln|\\sin x| + C' },
    'sec(x)':    { ad: 'ln(abs(sec(x)+tan(x)))', rule: 'Integral de sec(x)', exp: '∫sec(x)dx = ln|sec(x) + tan(x)| + C. Se multiplica por (sec+tan)/(sec+tan).', latex: '\\int \\sec x\\,dx = \\ln|\\sec x + \\tan x| + C' },
    'csc(x)':    { ad: '-ln(abs(csc(x)+cot(x)))', rule: 'Integral de csc(x)', exp: '∫csc(x)dx = -ln|csc(x) + cot(x)| + C.', latex: '\\int \\csc x\\,dx = -\\ln|\\csc x + \\cot x| + C' },
  };

  if (trigBasic[s]) {
    const t = trigBasic[s];
    return { antiderivative: t.ad, rule: t.rule, explanation: t.exp, latexRule: t.latex };
  }

  // ── 5b. a*trig(x) ──────────────────────────────────────────────────────────
  const aTrigM = s.match(/^(-?[\d.]+)\*?(sin|cos|tan|sec|csc|cot)\(x\)$/);
  if (aTrigM) {
    const a = Number(aTrigM[1]);
    const fn = aTrigM[2];
    const baseKey = `${fn}(x)`;
    const base = trigBasic[baseKey];
    if (base) {
      return {
        antiderivative: `${a}*(${base.ad})`,
        rule: `Constante × ${base.rule}`,
        explanation: `Se saca la constante ${a} y se aplica: ${base.exp}`,
        latexRule: `${a} \\cdot ${base.latex?.replace('\\int', '').replace('+ C', '')} + C`,
      };
    }
  }

  // ── 6. EXPONENTIAL ─────────────────────────────────────────────────────────
  if (s === 'exp(x)' || s === 'e^x') {
    return {
      antiderivative: 'exp(x)',
      rule: 'Integral de eˣ',
      explanation: '∫eˣ dx = eˣ + C. La función exponencial es su propia antiderivada.',
      latexRule: '\\int e^x\\,dx = e^x + C',
    };
  }

  // e^(ax) or exp(ax)
  const expLinM = s.match(/^exp\((-?[\d.]+)\*?x\)$/) || s.match(/^e\^\((-?[\d.]+)\*?x\)$/);
  if (expLinM) {
    const a = Number(expLinM[1]);
    return {
      antiderivative: `(1/${a})*exp(${a}*x)`,
      rule: 'Integral de e^(ax) — Sustitución lineal',
      explanation: `∫e^(${a}x) dx. Sea u = ${a}x, du = ${a}dx → dx = du/${a}. Entonces ∫e^u · du/${a} = (1/${a})·e^(${a}x).`,
      latexRule: `\\int e^{${a}x}\\,dx = \\frac{1}{${a}} e^{${a}x} + C`,
      alternativeMethods: ['Método de sustitución con u = ax'],
    };
  }

  // a*e^x
  const aExpM = s.match(/^(-?[\d.]+)\*?exp\(x\)$/) || s.match(/^(-?[\d.]+)\*?e\^x$/);
  if (aExpM) {
    const a = Number(aExpM[1]);
    return {
      antiderivative: `${a}*exp(x)`,
      rule: 'Constante × Integral de eˣ',
      explanation: `Se saca la constante ${a}: ${a}·∫eˣ dx = ${a}·eˣ + C.`,
      latexRule: `\\int ${a}e^x\\,dx = ${a}e^x + C`,
    };
  }

  // ── 7. LOGARITHMIC ─────────────────────────────────────────────────────────
  if (s === 'ln(x)') {
    return {
      antiderivative: 'x*ln(x)-x',
      rule: 'Integral de ln(x) — Integración por Partes',
      explanation: '∫ln(x) dx se resuelve por partes: u = ln(x), dv = dx → du = 1/x dx, v = x. Entonces ∫ln(x)dx = x·ln(x) - ∫x·(1/x)dx = x·ln(x) - x.',
      latexRule: '\\int \\ln x\\,dx = x\\ln x - x + C',
      alternativeMethods: ['Integración por partes: u = ln(x), dv = dx'],
    };
  }

  // ── 8. TRIGONOMETRIC IDENTITIES ────────────────────────────────────────────
  if (s === 'sin(x)^2') {
    return {
      antiderivative: '(1/2)*x-(1/4)*sin(2*x)',
      rule: 'Integral de sin²(x) — Identidad de medio ángulo',
      explanation: 'Se usa la identidad sin²(x) = (1 - cos(2x))/2. Entonces ∫sin²(x)dx = ∫(1/2 - cos(2x)/2)dx = x/2 - sin(2x)/4.',
      latexRule: '\\int \\sin^2 x\\,dx = \\frac{x}{2} - \\frac{\\sin 2x}{4} + C',
      alternativeMethods: ['Identidad trigonométrica: sin²x = (1 - cos2x)/2'],
    };
  }

  if (s === 'cos(x)^2') {
    return {
      antiderivative: '(1/2)*x+(1/4)*sin(2*x)',
      rule: 'Integral de cos²(x) — Identidad de medio ángulo',
      explanation: 'Se usa la identidad cos²(x) = (1 + cos(2x))/2. Entonces ∫cos²(x)dx = ∫(1/2 + cos(2x)/2)dx = x/2 + sin(2x)/4.',
      latexRule: '\\int \\cos^2 x\\,dx = \\frac{x}{2} + \\frac{\\sin 2x}{4} + C',
      alternativeMethods: ['Identidad trigonométrica: cos²x = (1 + cos2x)/2'],
    };
  }

  if (s === 'tan(x)^2') {
    return {
      antiderivative: 'tan(x)-x',
      rule: 'Integral de tan²(x) — Identidad pitagórica',
      explanation: 'Se usa la identidad tan²(x) = sec²(x) - 1. Entonces ∫tan²(x)dx = ∫(sec²(x) - 1)dx = tan(x) - x.',
      latexRule: '\\int \\tan^2 x\\,dx = \\tan x - x + C',
      alternativeMethods: ['Identidad: tan²x = sec²x - 1'],
    };
  }

  if (s === 'sin(x)*cos(x)') {
    return {
      antiderivative: '(1/2)*sin(x)^2',
      rule: 'Integral de sin(x)cos(x) — Sustitución simple',
      explanation: '∫sin(x)cos(x) dx. Sea u = sin(x), du = cos(x)dx. Entonces ∫u du = u²/2 = sin²(x)/2. También se puede usar la identidad sin(2x)/2.',
      latexRule: '\\int \\sin x \\cos x\\,dx = \\frac{\\sin^2 x}{2} + C',
      alternativeMethods: ['Sustitución u = sin(x)', 'Identidad: sin(x)cos(x) = sin(2x)/2'],
    };
  }

  // ── 9. LINEAR COMPOSITION: trig(ax+b) ─────────────────────────────────────
  // sin(ax), cos(ax), sin(ax+b), cos(ax+b)
  const trigLinM = s.match(/^(sin|cos|tan)\((-?[\d.]+)\*?x([+-][\d.]+)?\)$/);
  if (trigLinM) {
    const fn = trigLinM[1];
    const a = Number(trigLinM[2]);
    const b = trigLinM[3] ? Number(trigLinM[3]) : 0;
    const inner = b ? `${a}*x${b >= 0 ? '+' : ''}${b}` : `${a}*x`;
    const anti = fn === 'sin' ? `(-1/${a})*cos(${inner})`
               : fn === 'cos' ? `(1/${a})*sin(${inner})`
               : `(-1/${a})*ln(abs(cos(${inner})))`;
    return {
      antiderivative: anti,
      rule: `Integral de ${fn}(ax${b ? '+b' : ''}) — Sustitución lineal`,
      explanation: `Sea u = ${inner}, du = ${a}dx → dx = du/${a}. Se integra ${fn}(u) y se divide entre ${a}.`,
      latexRule: `\\int \\${fn}(${toLatex(inner)})\\,dx = ${toLatex(anti)} + C`,
      alternativeMethods: [`Sustitución u = ${inner}`],
    };
  }

  // ── 10. LINEAR COMPOSITION: (ax+b)^n ───────────────────────────────────────
  const polyLinM = s.match(/^\((-?[\d.]+)\*?x([+-][\d.]+)?\)\^(-?[\d.]+)$/);
  if (polyLinM) {
    const a = Number(polyLinM[1]);
    const b = polyLinM[2] ? Number(polyLinM[2]) : 0;
    const n = Number(polyLinM[3]);
    const inner = b ? `${a}*x${b >= 0 ? '+' : ''}${b}` : `${a}*x`;
    if (n === -1) {
      return {
        antiderivative: `(1/${a})*ln(abs(${inner}))`,
        rule: 'Integral de 1/(ax+b)',
        explanation: `Sea u = ${inner}, du = ${a}dx. Entonces ∫du/(${a}·u) = (1/${a})·ln|u|.`,
        latexRule: `\\int \\frac{1}{${toLatex(inner)}}\\,dx = \\frac{1}{${a}}\\ln|${toLatex(inner)}| + C`,
        alternativeMethods: [`Sustitución u = ${inner}`],
      };
    }
    const np = n + 1;
    const coeff = 1 / (a * np);
    const cs = Number.isInteger(1 / coeff) ? `(1/${Math.round(1 / coeff)})` : coeff.toFixed(4);
    return {
      antiderivative: `${cs}*(${inner})^${np}`,
      rule: `Regla de la Potencia con sustitución lineal`,
      explanation: `Sea u = ${inner}, du = ${a}dx. Entonces ∫u^${n}·du/${a} = (1/${a})·u^${np}/${np} = ${cs}·(${inner})^${np}.`,
      latexRule: `\\int (${toLatex(inner)})^{${n}}\\,dx = ${cs} (${toLatex(inner)})^{${np}} + C`,
      alternativeMethods: [`Sustitución u = ${inner}`],
    };
  }

  // ── 11. SPECIAL FORMS ──────────────────────────────────────────────────────

  // 1/(1+x^2) → arctan(x)
  if (s === '1/(1+x^2)' || s === '1/(x^2+1)') {
    return {
      antiderivative: 'arctan(x)',
      rule: 'Integral que produce arctan(x)',
      explanation: '∫1/(1+x²) dx = arctan(x) + C. Es la derivada inversa de la función arco tangente.',
      latexRule: '\\int \\frac{1}{1+x^2}\\,dx = \\arctan x + C',
    };
  }

  // 1/(a^2+x^2) → (1/a)*arctan(x/a)
  const arctanM = s.match(/^1\/\((-?[\d.]+)\+x\^2\)$/) || s.match(/^1\/\(x\^2\+(-?[\d.]+)\)$/);
  if (arctanM) {
    const a2 = Number(arctanM[1]);
    const a = Math.sqrt(a2);
    if (Number.isInteger(a) || a === Math.round(a * 1000) / 1000) {
      return {
        antiderivative: `(1/${a})*arctan(x/${a})`,
        rule: 'Integral que produce arctan — Forma 1/(a² + x²)',
        explanation: `∫1/(${a2} + x²) dx = (1/${a})·arctan(x/${a}) + C. Se identifica a² = ${a2}, a = ${a}.`,
        latexRule: `\\int \\frac{1}{${a2}+x^2}\\,dx = \\frac{1}{${a}}\\arctan\\frac{x}{${a}} + C`,
      };
    }
  }

  // 1/sqrt(1-x^2) → arcsin(x)
  if (s === '1/sqrt(1-x^2)') {
    return {
      antiderivative: 'arcsin(x)',
      rule: 'Integral que produce arcsin(x)',
      explanation: '∫1/√(1-x²) dx = arcsin(x) + C. Es la derivada inversa de la función arco seno.',
      latexRule: '\\int \\frac{1}{\\sqrt{1-x^2}}\\,dx = \\arcsin x + C',
    };
  }

  // ── 12. INTEGRATION BY PARTS PATTERNS ──────────────────────────────────────

  // x*exp(x)
  if (s === 'x*exp(x)' || s === 'x*e^x') {
    return {
      antiderivative: 'x*exp(x)-exp(x)',
      rule: 'Integración por Partes — x·eˣ',
      explanation: 'u = x, dv = eˣ dx → du = dx, v = eˣ. Aplicando: ∫x·eˣ dx = x·eˣ - ∫eˣ dx = x·eˣ - eˣ = eˣ(x - 1).',
      latexRule: '\\int x e^x\\,dx = xe^x - e^x + C = e^x(x-1) + C',
      alternativeMethods: ['Integración por partes: u = x, dv = eˣdx', 'Método LIATE: Logarítmica-Inversa-Algebraica-Trigonométrica-Exponencial'],
    };
  }

  // x*sin(x)
  if (s === 'x*sin(x)') {
    return {
      antiderivative: '-x*cos(x)+sin(x)',
      rule: 'Integración por Partes — x·sin(x)',
      explanation: 'u = x, dv = sin(x)dx → du = dx, v = -cos(x). Aplicando: ∫x·sin(x) dx = -x·cos(x) - ∫(-cos(x))dx = -x·cos(x) + sin(x).',
      latexRule: '\\int x\\sin x\\,dx = -x\\cos x + \\sin x + C',
      alternativeMethods: ['Integración por partes: u = x, dv = sin(x)dx'],
    };
  }

  // x*cos(x)
  if (s === 'x*cos(x)') {
    return {
      antiderivative: 'x*sin(x)+cos(x)',
      rule: 'Integración por Partes — x·cos(x)',
      explanation: 'u = x, dv = cos(x)dx → du = dx, v = sin(x). Aplicando: ∫x·cos(x) dx = x·sin(x) - ∫sin(x)dx = x·sin(x) + cos(x).',
      latexRule: '\\int x\\cos x\\,dx = x\\sin x + \\cos x + C',
      alternativeMethods: ['Integración por partes: u = x, dv = cos(x)dx'],
    };
  }

  // x*ln(x)
  if (s === 'x*ln(x)') {
    return {
      antiderivative: '(1/2)*x^2*ln(x)-(1/4)*x^2',
      rule: 'Integración por Partes — x·ln(x)',
      explanation: 'u = ln(x), dv = x dx → du = 1/x dx, v = x²/2. Entonces ∫x·ln(x)dx = (x²/2)·ln(x) - ∫(x²/2)·(1/x)dx = (x²/2)·ln(x) - x²/4.',
      latexRule: '\\int x\\ln x\\,dx = \\frac{x^2}{2}\\ln x - \\frac{x^2}{4} + C',
      alternativeMethods: ['Integración por partes: u = ln(x), dv = x dx (regla LIATE)'],
    };
  }

  // x^2*exp(x)
  if (s === 'x^2*exp(x)' || s === 'x^2*e^x') {
    return {
      antiderivative: 'x^2*exp(x)-2*x*exp(x)+2*exp(x)',
      rule: 'Integración por Partes doble — x²·eˣ',
      explanation: 'Se aplica integración por partes dos veces. Primera: u=x², dv=eˣdx → x²eˣ - 2∫xeˣdx. Segunda: u=x, dv=eˣdx → xeˣ - eˣ. Resultado: eˣ(x² - 2x + 2).',
      latexRule: '\\int x^2 e^x\\,dx = e^x(x^2 - 2x + 2) + C',
      alternativeMethods: ['Integración por partes tabular (método de la tabla)'],
    };
  }

  // ── 13. SPECIAL: sqrt(x) ───────────────────────────────────────────────────
  if (s === 'sqrt(x)') {
    return {
      antiderivative: '(2/3)*x^1.5',
      rule: 'Regla de la Potencia — √x = x^(1/2)',
      explanation: '∫√x dx = ∫x^(1/2) dx. Aplicando la regla de potencia: x^(3/2)/(3/2) = (2/3)·x^(3/2).',
      latexRule: '\\int \\sqrt{x}\\,dx = \\frac{2}{3}x^{3/2} + C',
    };
  }

  // ── 14. a*sqrt(x) ─────────────────────────────────────────────────────────
  const aSqrtM = s.match(/^(-?[\d.]+)\*?sqrt\(x\)$/);
  if (aSqrtM) {
    const a = Number(aSqrtM[1]);
    const c = (2 * a) / 3;
    return {
      antiderivative: `${c}*x^1.5`,
      rule: 'Constante × Regla de la Potencia — √x',
      explanation: `∫${a}√x dx = ${a}·(2/3)·x^(3/2) = ${c}·x^(3/2).`,
      latexRule: `\\int ${a}\\sqrt{x}\\,dx = ${c} x^{3/2} + C`,
    };
  }

  // ── 15. 1/x^n = x^(-n) ────────────────────────────────────────────────────
  const invPowM = s.match(/^1\/x\^([\d.]+)$/);
  if (invPowM) {
    const n = Number(invPowM[1]);
    return tryIntegrate(`x^${-n}`);
  }

  // ── 16. a/x ────────────────────────────────────────────────────────────────
  const aOverXm = s.match(/^(-?[\d.]+)\/x$/);
  if (aOverXm) {
    const a = Number(aOverXm[1]);
    return {
      antiderivative: `${a}*ln(abs(x))`,
      rule: 'Constante × Integral de 1/x',
      explanation: `∫${a}/x dx = ${a}·ln|x| + C.`,
      latexRule: `\\int \\frac{${a}}{x}\\,dx = ${a}\\ln|x| + C`,
    };
  }

  // Not matched
  return null;
}

// ─── Split expression into additive terms ────────────────────────────────────
function splitTerms(expr: string): string[] {
  const s = expr.replace(/\s+/g, '');
  const terms: string[] = [];
  let depth = 0;
  let current = '';

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '(' || ch === ')') depth += (ch === '(' ? 1 : -1);

    if (depth === 0 && (ch === '+' || ch === '-') && i > 0) {
      if (current) terms.push(current);
      current = ch === '-' ? '-' : '';
    } else {
      current += ch;
    }
  }
  if (current) terms.push(current);

  return terms.filter(Boolean);
}

// ─── Plot generation ─────────────────────────────────────────────────────────
export function generatePlot(expr: string, antideriv: string, aStr?: string, bStr?: string): PlotPoint[] {
  const pts: PlotPoint[] = [];
  const a = aStr ? safeEval(aStr, 0) : null;
  const b = bStr ? safeEval(bStr, 0) : null;
  
  let start = -10;
  let end = 10;

  // Ajustar la ventana gráfica si los límites están muy lejos
  if (a !== null && b !== null && !isNaN(a) && !isNaN(b)) {
    const minAb = Math.min(a, b);
    const maxAb = Math.max(a, b);
    if (minAb < -8) start = minAb - 2;
    if (maxAb > 8) end = maxAb + 2;
  }

  const step = (end - start) / 100; // 100 points resol

  for (let x = start; x <= end; x += step) {
    let fx = safeEval(expr, x);
    let Fx = safeEval(antideriv, x);
    
    // Evitar picos gigantes de asíntotas
    if (!isFinite(fx) || Math.abs(fx) > 500) fx = NaN;
    if (!isFinite(Fx) || Math.abs(Fx) > 500) Fx = NaN;

    let isArea = false;
    if (a !== null && b !== null && !isNaN(a) && !isNaN(b)) {
      if (x >= Math.min(a, b) && x <= Math.max(a, b)) {
        isArea = true;
      }
    }

    pts.push({ 
      x: +x.toFixed(2), 
      fx: isNaN(fx) ? null : +fx.toFixed(4), 
      Fx: isNaN(Fx) ? null : +Fx.toFixed(4),
      isArea
    });
  }
  return pts;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN SOLVER
// ═══════════════════════════════════════════════════════════════════════════════

function simplifyLocal(expr: string): string {
  let e = expr;
  let changed = true;
  while (changed) {
    changed = false;
    let nextE = e.replace(/\bx\^([0-9.]+)\*x\^([0-9.]+)/g, (_, a, b) => `x^${Number(a) + Number(b)}`);
    nextE = nextE.replace(/\bx\*x\^([0-9.]+)/g, (_, a) => `x^${1 + Number(a)}`);
    nextE = nextE.replace(/\bx\^([0-9.]+)\*x\b(?!\^)/g, (_, a) => `x^${Number(a) + 1}`);
    nextE = nextE.replace(/\bx\*x\b(?!\^)/g, 'x^2');
    if (nextE !== e) {
      changed = true;
      e = nextE;
    }
  }
  return e;
}

export function solveIntegral(rawExpr: string, aStr?: string, bStr?: string): SolveResult {
  try {
    let expr = rawExpr.trim()
      .replace(/\s+/g, '')
      .replace(/\*\*/g, '^');

    expr = simplifyLocal(expr);

    if (!expr) return { success: false, error: 'Escribe una función primero.' };

    const aVal = aStr ? safeEval(aStr, 0) : null;
    const bVal = bStr ? safeEval(bStr, 0) : null;
    const isDefinite = aVal !== null && bVal !== null && !isNaN(aVal) && !isNaN(bVal);

    // ── Try as a single whole expression first (for complex patterns) ──
    const wholeResult = tryIntegrate(expr);
    if (wholeResult) {
      const steps: MathStep[] = [
        { id: 0, rule: 'Planteamiento', explanation: isDefinite ? `Planteamos la integral definida en el intervalo [${aStr}, ${bStr}].` : 'Escribimos la integral indefinida.', formula: isDefinite ? `\\int_{${aStr}}^{${bStr}} \\left(${toLatex(expr)}\\right)\\,dx` : `\\int \\left(${toLatex(expr)}\\right)\\,dx` },
        { id: 1, rule: wholeResult.rule, explanation: wholeResult.explanation, formula: wholeResult.latexRule ?? `${toLatex(expr)} \\to ${toLatex(wholeResult.antiderivative)}` },
      ];
      
      let defValue: number | undefined = undefined;
      let defLatex: string | undefined = undefined;
      let solLatex = toLatex(wholeResult.antiderivative);

      if (isDefinite) {
        const fa = safeEval(wholeResult.antiderivative, aVal!);
        const fb = safeEval(wholeResult.antiderivative, bVal!);
        defValue = fb - fa;
        const valStr = Number.isInteger(defValue) ? String(defValue) : defValue.toFixed(4);
        solLatex = `\\left[ ${solLatex} \\right]_{${aStr}}^{${bStr}}`;
        defLatex = valStr;
        steps.push({
          id: 2,
          rule: 'Teorema Fundamental del Cálculo',
          explanation: `Evaluamos los límites: F(b) - F(a) = F(${bStr}) - F(${aStr}).`,
          formula: `F(${bStr}) - F(${aStr}) = ${fb.toFixed(4)} - (${fa.toFixed(4)}) = ${valStr}`
        });
      } else {
        solLatex += ' + C';
        steps.push({ id: 2, rule: 'Resultado final', explanation: 'Añadimos la constante de integración C.', formula: `F(x) = ${solLatex}` });
      }

      const plotData = generatePlot(expr, wholeResult.antiderivative, aStr, bStr);

      const tips = [
        isDefinite ? 'El resultado numérico representa el área neta bajo la curva.' : 'Siempre agrega + C en integrales indefinidas.',
        'Verifica derivando: d/dx[F(x)] debe dar f(x).',
      ];
      if (wholeResult.alternativeMethods) tips.push(...wholeResult.alternativeMethods.map(m => `📌 Método alternativo: ${m}`));

      const warnings: string[] = [];
      if (/tan/.test(expr)) warnings.push('⚠️ tan(x) tiene discontinuidades en x = π/2 + nπ.');
      if (/1\/x/.test(expr) || /x\^-1/.test(expr)) warnings.push('⚠️ 1/x no está definida en x = 0.');
      if (/sqrt/.test(expr)) warnings.push('⚠️ √x solo está definida para x ≥ 0.');

      return {
        success: true,
        integrand_latex: toLatex(expr),
        solution_latex: solLatex,
        definite_value: defValue,
        definite_latex: defLatex,
        steps,
        tips,
        warnings,
        methods: wholeResult.alternativeMethods,
        plotData,
      };
    }

    // ── Split into additive terms ──
    const terms = splitTerms(expr);
    if (terms.length === 0) return { success: false, error: 'No se encontraron términos para integrar.' };

    const results: IntegrationResult[] = [];
    for (const t of terms) {
      const r = tryIntegrate(t);
      if (!r) {
        // Lista de lo que sí soportamos para guiar al usuario
        return {
          success: false,
          error: `No se encontró regla para el término "${t}".

Tipos soportados:
• Potencias: x^n, a*x^n, √x
• Constantes: 5, -3.5
• Trigonométricas: sin(x), cos(x), tan(x), sec(x)², csc(x)², sec(x)*tan(x), cot(x), sec(x), csc(x)
• Trig cuadradas: sin(x)^2, cos(x)^2, tan(x)^2, sin(x)*cos(x)
• Composición lineal: sin(ax), cos(ax+b), (ax+b)^n
• Exponenciales: e^x, exp(x), exp(ax), a*e^x
• Logarítmica: ln(x)
• Por partes: x*e^x, x*sin(x), x*cos(x), x*ln(x), x^2*e^x
• Especiales: 1/x, 1/(1+x^2), 1/sqrt(1-x^2), 1/(a+x^2)`,
        };
      }
      results.push(r);
    }

    // Build full antiderivative
    const fullAntideriv = results.map(r => r.antiderivative).join('+');

    let solLatex = toLatex(fullAntideriv).replace(/\+\-/g, '-');
    let defValue: number | undefined = undefined;
    let defLatex: string | undefined = undefined;

    // Build steps
    const steps: MathStep[] = [];
    steps.push({
      id: 0,
      rule: 'Planteamiento',
      explanation: isDefinite ? `Planteamos la integral definida en [${aStr}, ${bStr}] de la función completa.` : 'Escribimos la integral indefinida de la función completa.',
      formula: isDefinite ? `\\int_{${aStr}}^{${bStr}} \\left(${toLatex(expr)}\\right)\\,dx` : `\\int \\left(${toLatex(expr)}\\right)\\,dx`,
    });

    if (terms.length > 1) {
      steps.push({
        id: 1,
        rule: 'Regla de la Suma / Resta',
        explanation: 'La integral de una suma (o resta) de funciones es la suma (o resta) de sus integrales individuales. Esto nos permite resolver cada término por separado.',
        formula: terms.map(t => isDefinite ? `\\int_{${aStr}}^{${bStr}} ${toLatex(t)}\\,dx` : `\\int ${toLatex(t)}\\,dx`).join(' + '),
      });
    }

    terms.forEach((term, i) => {
      const r = results[i];
      steps.push({
        id: steps.length,
        rule: r.rule,
        explanation: r.explanation,
        formula: r.latexRule ?? `\\int ${toLatex(term)}\\,dx = ${toLatex(r.antiderivative)}`,
      });
    });

    if (isDefinite) {
      const fa = safeEval(fullAntideriv, aVal!);
      const fb = safeEval(fullAntideriv, bVal!);
      defValue = fb - fa;
      const valStr = Number.isInteger(defValue) ? String(defValue) : defValue.toFixed(4);
      solLatex = `\\left[ ${solLatex} \\right]_{${aStr}}^{${bStr}}`;
      defLatex = valStr;
      
      steps.push({
        id: steps.length,
        rule: 'Teorema Fundamental del Cálculo',
        explanation: `Evaluamos los límites: F(b) - F(a) = F(${bStr}) - F(${aStr}).`,
        formula: `F(${bStr}) - F(${aStr}) = ${fb.toFixed(4)} - (${fa.toFixed(4)}) = ${valStr}`
      });
    } else {
      solLatex += ' + C';
      steps.push({
        id: steps.length,
        rule: 'Resultado final',
        explanation: 'Combinamos todas las antiderivadas y añadimos la constante de integración C.',
        formula: `F(x) = ${solLatex}`
      });
    }

    const plotData = generatePlot(expr, fullAntideriv, aStr, bStr);

    const tips = [
      'Siempre agrega + C en integrales indefinidas.',
      'Verifica derivando: d/dx[F(x)] debe dar f(x).',
      'La integral representa el área bajo la curva cuando tiene límites definidos.',
    ];

    const allMethods = results.flatMap(r => r.alternativeMethods ?? []);
    if (allMethods.length > 0) tips.push(...allMethods.map(m => `📌 ${m}`));

    const warnings: string[] = [];
    if (/tan/.test(expr)) warnings.push('⚠️ tan(x) tiene discontinuidades en x = π/2 + nπ.');
    if (/1\/x/.test(expr) || /x\^-1/.test(expr)) warnings.push('⚠️ Función no definida en x = 0.');
    if (/sqrt/.test(expr)) warnings.push('⚠️ √x solo está definida para x ≥ 0 (en los reales).');

    return {
      success: true,
      integrand_latex: toLatex(expr),
      solution_latex: solLatex,
      definite_value: defValue,
      definite_latex: defLatex,
      steps,
      tips,
      warnings,
      methods: allMethods.length > 0 ? allMethods : undefined,
      plotData,
    };
  } catch (e: any) {
    return { success: false, error: `Error interno: ${e?.message ?? 'desconocido'}` };
  }
}
