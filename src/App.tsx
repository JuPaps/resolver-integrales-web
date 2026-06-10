import { useState, useEffect, useCallback, useRef } from 'react';
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ComposedChart, Area } from 'recharts';
import { solveIntegral, toLatex } from './mathEngine';

import { solveIntegralWithAI } from './aiEngine';
import katex from 'katex';
import 'katex/dist/katex.min.css';

// ─── KaTeX helper ────────────────────────────────────────────────────────────

function KatexBlock({ latex }: { latex: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current && typeof katex !== 'undefined') {
      try {
        katex.render(latex, ref.current, { displayMode: true, throwOnError: false, strict: false });
      } catch { ref.current.textContent = latex; }
    }
  }, [latex]);
  return <div ref={ref} style={{ overflowX: 'auto', padding: '4px 0' }} />;
}

function KatexInline({ latex }: { latex: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (ref.current && typeof katex !== 'undefined') {
      try {
        katex.render(latex, ref.current, { displayMode: false, throwOnError: false, strict: false });
      } catch { ref.current.textContent = latex; }
    }
  }, [latex]);
  return <span ref={ref} />;
}

// ─── Theme ───────────────────────────────────────────────────────────────────
const keys = [
  ['sin(', 'cos(', 'tan(', 'ln('],
  ['x^2', 'x^3', 'x^', 'sqrt('],
  ['(', ')', 'x', 'pi'],
  ['7', '8', '9', '/'],
  ['4', '5', '6', '*'],
  ['1', '2', '3', '-'],
  ['C', '0', '.', '+'],
];

// ─── Constants ─────────────────────────────────────────────────────────────────

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [dark, setDark] = useState(true);
  const [expr, setExpr] = useState('');
  const [lowerLimit, setLowerLimit] = useState('');
  const [upperLimit, setUpperLimit] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [openStep, setOpenStep] = useState<number | null>(null);
  const [xDomain, setXDomain] = useState<[number, number]>([-10, 10]);
  
  // AI State
  const [apiKey, setApiKey] = useState('');
  const [aiProvider, setAiProvider] = useState<'gemini' | 'openai'>('gemini');
  const [aiModel, setAiModel] = useState('gemini-1.5-pro-latest');
  const [aiBaseUrl, setAiBaseUrl] = useState('');
  
  const [showApiModal, setShowApiModal] = useState(false);
  const [isUsingAI, setIsUsingAI] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.documentElement.className = dark ? '' : 'light';
  }, [dark]);

  useEffect(() => {
    const savedKey = localStorage.getItem('MATHSOLVER_GEMINI_API_KEY');
    const savedProv = localStorage.getItem('MATHSOLVER_AI_PROV');
    const savedMod = localStorage.getItem('MATHSOLVER_AI_MOD');
    const savedBase = localStorage.getItem('MATHSOLVER_AI_BASE');
    if (savedKey) setApiKey(savedKey);
    if (savedProv) setAiProvider(savedProv as any);
    if (savedMod) setAiModel(savedMod);
    if (savedBase) setAiBaseUrl(savedBase);
  }, []);

  const saveAiConfig = () => {
    localStorage.setItem('MATHSOLVER_GEMINI_API_KEY', apiKey);
    localStorage.setItem('MATHSOLVER_AI_PROV', aiProvider);
    localStorage.setItem('MATHSOLVER_AI_MOD', aiModel);
    localStorage.setItem('MATHSOLVER_AI_BASE', aiBaseUrl);
    setShowApiModal(false);
  };

  const handleSolveLocal = () => {
    if (!expr.trim()) return;
    setLoading(true);
    setIsUsingAI(false);
    setTimeout(() => {
      const res = solveIntegral(expr, lowerLimit.trim() || undefined, upperLimit.trim() || undefined);
      setResult(res);
      setLoading(false);
      setOpenStep(null);
      if (res.plotData && res.plotData.length > 0) {
        const xs = res.plotData.map((p: any) => p.x);
        setXDomain([Math.floor(Math.min(...xs)), Math.ceil(Math.max(...xs))]);
      }
    }, 150);
  };

  const handleSolveAI = useCallback(async () => {
    if (!expr.trim()) return;
    if (!apiKey) {
      setShowApiModal(true);
      return;
    }
    setLoading(true);
    setIsUsingAI(true);
    setResult(null);
    setOpenStep(null);
    
    const res = await solveIntegralWithAI(expr, {
      provider: aiProvider,
      model: aiModel,
      apiKey: apiKey,
      baseUrl: aiBaseUrl
    }, lowerLimit.trim() || undefined, upperLimit.trim() || undefined);
    setResult(res);
    setLoading(false);
    if (res.plotData && res.plotData.length > 0) {
        const xs = res.plotData.map((p: any) => p.x);
        setXDomain([Math.floor(Math.min(...xs)), Math.ceil(Math.max(...xs))]);
    }
  }, [expr, lowerLimit, upperLimit, apiKey, aiProvider, aiModel, aiBaseUrl]);

  const insertKey = (k: string) => {
    const realKey = k === 'x^2' ? 'x^2' : k === 'x^3' ? 'x^3' : k;
    setExpr(prev => prev + realKey);
    inputRef.current?.focus();
  };

  const v = (cssVar: string) => `var(--${cssVar})`;

  return (
    <div style={{ minHeight: '100vh', background: v('color-bg'), color: v('color-text'), fontFamily: "'Inter', sans-serif" }}>
      {showApiModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: v('color-surface'), padding: 32, borderRadius: 16, width: '100%', maxWidth: 450, border: `1px solid ${v('color-border')}`, boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }}>
            <h2 style={{ margin: '0 0 16px', fontSize: 20, color: v('color-primary') }}>Red Neuronal Avanzada</h2>
            <label style={{ display: 'block', fontSize: 13, marginBottom: 4, color: v('color-text-muted') }}>Proveedor</label>
            <select value={aiProvider} onChange={e => setAiProvider(e.target.value as any)} style={{ width: '100%', padding: '10px', borderRadius: 8, border: `1px solid ${v('color-border')}`, background: v('color-surface-2'), color: v('color-text'), marginBottom: 16, outline: 'none' }}>
              <option value="gemini">Google Gemini AI Studio</option>
              <option value="openai">Compatible con OpenAI (OpenAI, Groq, etc)</option>
            </select>
            <label style={{ display: 'block', fontSize: 13, marginBottom: 4, color: v('color-text-muted') }}>Modelo</label>
            <input type="text" value={aiModel} onChange={e => setAiModel(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: 8, border: `1px solid ${v('color-border')}`, background: v('color-surface-2'), color: v('color-text'), marginBottom: 16, outline: 'none' }} />
            {aiProvider === 'openai' && (
              <>
                <label style={{ display: 'block', fontSize: 13, marginBottom: 4, color: v('color-text-muted') }}>Base URL</label>
                <input type="text" value={aiBaseUrl} onChange={e => setAiBaseUrl(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: 8, border: `1px solid ${v('color-border')}`, background: v('color-surface-2'), color: v('color-text'), marginBottom: 16, outline: 'none' }} />
              </>
            )}
            <label style={{ display: 'block', fontSize: 13, marginBottom: 4, color: v('color-text-muted') }}>API Key</label>
            <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: 8, border: `1px solid ${v('color-border')}`, background: v('color-surface-2'), color: v('color-text'), marginBottom: 20, outline: 'none' }} />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowApiModal(false)} style={{ padding: '10px 16px', borderRadius: 8, background: 'transparent', border: 'none', color: v('color-text-muted'), cursor: 'pointer' }}>Cancelar</button>
              <button onClick={saveAiConfig} style={{ padding: '10px 20px', borderRadius: 8, background: v('color-primary'), border: 'none', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      <header style={{ background: v('color-surface'), borderBottom: `1px solid ${v('color-border')}`, padding: '0 24px', position: 'sticky', top: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, background: 'linear-gradient(135deg, #0ea5e9, #10b981)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>∫</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18, color: v('color-primary') }}>MathSolver</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => setShowApiModal(true)} style={{ background: 'transparent', border: `1px solid ${v('color-border')}`, borderRadius: 8, padding: '8px 12px', color: v('color-text'), cursor: 'pointer', fontSize: 13 }}>⚙️ API Key</button>
          <button onClick={() => setDark(d => !d)} style={{ background: v('color-surface-2'), border: `1px solid ${v('color-border')}`, borderRadius: 8, padding: '8px 12px', color: v('color-text'), cursor: 'pointer', fontSize: 13 }}>{dark ? '☀️ Claro' : '🌙 Oscuro'}</button>
        </div>
      </header>

      <main style={{ maxWidth: 900, margin: '0 auto', padding: '32px 16px' }}>
        <div style={{ background: v('color-surface'), borderRadius: 16, border: `1px solid ${v('color-border')}`, padding: 24, marginBottom: 24, boxShadow: '0 4px 24px rgba(0,0,0,0.2)' }}>
          <h1 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 500, color: v('color-text-muted'), letterSpacing: 0.5 }}>FUNCIÓN A INTEGRAR</h1>

          <div style={{ position: 'relative' }}>
            <input 
              ref={inputRef}
              type="text" 
              value={expr}
              onChange={e => setExpr(e.target.value)}
              placeholder="Ej: x^2 * sin(x)"
              style={{ width: '100%', padding: '16px 20px', fontSize: 18, borderRadius: 12, border: `2px solid ${v('color-primary')}`, background: v('color-surface'), color: v('color-text'), outline: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', transition: 'border-color 0.2s', marginBottom: 12 }}
            />
          </div>

          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, color: v('color-text-muted'), fontWeight: 600, display: 'block', marginBottom: 4 }}>Límite Inferior (a)</label>
              <input type="text" value={lowerLimit} onChange={e => setLowerLimit(e.target.value)} placeholder="Ej: 0, -pi" style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${v('color-border')}`, background: v('color-surface'), color: v('color-text'), outline: 'none' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, color: v('color-text-muted'), fontWeight: 600, display: 'block', marginBottom: 4 }}>Límite Superior (b)</label>
              <input type="text" value={upperLimit} onChange={e => setUpperLimit(e.target.value)} placeholder="Ej: 1, 2*pi" style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${v('color-border')}`, background: v('color-surface'), color: v('color-text'), outline: 'none' }} />
            </div>
          </div>

          <div style={{ background: v('color-surface-2'), padding: 16, borderRadius: 12, border: `1px solid ${v('color-border')}`, marginBottom: 24, minHeight: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {expr.trim() ? (
              <div style={{ fontSize: 20 }}>
                <KatexInline latex={`\\int_{${lowerLimit ? toLatex(lowerLimit) : ''}}^{${upperLimit ? toLatex(upperLimit) : ''}} \\left( ${toLatex(expr)} \\right) \\,dx`} />
              </div>
            ) : (
              <span style={{ color: v('color-text-muted'), fontStyle: 'italic', fontSize: 14 }}>Escribe una expresión para ver la vista previa...</span>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => setShowKeyboard(s => !s)} style={{ padding: '10px 18px', borderRadius: 10, border: `1px solid ${v('color-border')}`, background: showKeyboard ? v('color-primary') : v('color-surface-2'), color: showKeyboard ? '#fff' : v('color-text'), cursor: 'pointer', fontSize: 14 }}>
              {showKeyboard ? '⌨️ Ocultar teclado' : '⌨️ Teclado'}
            </button>
            <button onClick={handleSolveLocal} disabled={!expr.trim() || loading} style={{ flex: 1, minWidth: 140, padding: '12px 20px', borderRadius: 10, border: 'none', background: v('color-surface-2'), color: v('color-text'), borderBottom: `2px solid ${v('color-primary')}`, fontWeight: 600, fontSize: 15, cursor: 'pointer', opacity: (!expr.trim() || loading) ? 0.6 : 1 }}>
              = Resolver Normal
            </button>
            <button onClick={handleSolveAI} disabled={!expr.trim() || loading} style={{ flex: 1, minWidth: 160, padding: '12px 20px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #a855f7, #ec4899)', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer', opacity: (!expr.trim() || loading) ? 0.6 : 1 }}>
              ✨ Red Neuronal Avanzada
            </button>
          </div>
          
          {loading && (
            <div style={{ marginTop: 16, textAlign: 'center', color: v('color-text-muted'), fontSize: 14 }}>
              {isUsingAI ? '🤖 La Red Neuronal Avanzada está procesando (puede tardar unos segundos)...' : '⟳ Calculando localmente...'}
            </div>
          )}

          {showKeyboard && (
            <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              {keys.flat().map(k => (
                <button key={k} onClick={() => k === 'C' ? setExpr('') : insertKey(k)} style={{ padding: '10px 4px', borderRadius: 8, border: `1px solid ${v('color-border')}`, background: v('color-surface-2'), color: v('color-text'), cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>{k}</button>
              ))}
            </div>
          )}
        </div>

        {/* Error */}
        {result?.success === false && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', borderRadius: 16, padding: 24, marginTop: 16 }}>
            <div style={{ color: '#ef4444', fontWeight: 'bold', marginBottom: 8 }}>❌ Error matemático</div>
            <div style={{ color: '#ef4444', whiteSpace: 'pre-wrap' }}>{result.error}</div>
            {!isUsingAI && (
              <button onClick={handleSolveAI} style={{ marginTop: 16, padding: '10px 16px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold' }}>
                ¿Intentar con Red Neuronal Avanzada ✨?
              </button>
            )}
          </div>
        )}

        {result?.success && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ background: isUsingAI ? 'linear-gradient(135deg, rgba(168,85,247,0.12), rgba(236,72,153,0.12))' : 'linear-gradient(135deg, rgba(14,165,233,0.12), rgba(16,185,129,0.12))', border: `1px solid ${isUsingAI ? 'rgba(168,85,247,0.3)' : 'rgba(14,165,233,0.3)'}`, borderRadius: 16, padding: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: isUsingAI ? '#d946ef' : v('color-primary'), marginBottom: 12 }}>RESPUESTA FINAL</div>
              <div style={{ fontSize: 20, color: v('color-text'), overflowX: 'auto', paddingBottom: 8 }}>
                <KatexInline latex={`F(x) = ${result.solution_latex}`} />
              </div>
              {result.definite_value !== undefined && (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${v('color-border')}` }}>
                  <div style={{ fontSize: 12, color: v('color-text-muted'), marginBottom: 8 }}>EVALUACIÓN DEFINIDA</div>
                  <div style={{ fontSize: 24, fontWeight: 'bold', color: isUsingAI ? '#d946ef' : v('color-primary') }}>
                    <KatexInline latex={`= ${result.definite_latex}`} />
                  </div>
                </div>
              )}
            </div>

            <div style={{ background: v('color-surface'), border: `1px solid ${v('color-border')}`, borderRadius: 16, padding: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: v('color-primary'), marginBottom: 16 }}>PROCEDIMIENTO PASO A PASO</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {result.steps?.map((step: any) => (
                  <div key={step.id} style={{ border: `1px solid ${v('color-border')}`, borderRadius: 10, overflow: 'hidden' }}>
                    <button onClick={() => setOpenStep(openStep === step.id ? null : step.id)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'transparent', border: 'none', color: v('color-text'), cursor: 'pointer' }}>
                      <span style={{ fontWeight: 600 }}>{step.rule}</span>
                      <span>{openStep === step.id ? '▲' : '▼'}</span>
                    </button>
                    {openStep === step.id && (
                      <div style={{ padding: '0 16px 16px', background: v('color-surface-2') }}>
                        <p style={{ fontSize: 14 }}>{step.explanation}</p>
                        <KatexBlock latex={step.formula} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {result.plotData && result.plotData.length > 0 && (
              <div style={{ background: v('color-surface'), border: `1px solid ${v('color-border')}`, borderRadius: 16, padding: 24 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: v('color-primary'), marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>GRÁFICA INTERACTIVA</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => setXDomain([xDomain[0]-2, xDomain[1]-2])} style={{ padding: '4px 8px', borderRadius: 4, border: `1px solid ${v('color-border')}`, background: v('color-surface-2'), cursor: 'pointer' }}>←</button>
                    <button onClick={() => setXDomain([xDomain[0]+2, xDomain[1]-2])} style={{ padding: '4px 8px', borderRadius: 4, border: `1px solid ${v('color-border')}`, background: v('color-surface-2'), cursor: 'pointer' }}>+</button>
                    <button onClick={() => setXDomain([xDomain[0]-2, xDomain[1]+2])} style={{ padding: '4px 8px', borderRadius: 4, border: `1px solid ${v('color-border')}`, background: v('color-surface-2'), cursor: 'pointer' }}>-</button>
                    <button onClick={() => setXDomain([xDomain[0]+2, xDomain[1]+2])} style={{ padding: '4px 8px', borderRadius: 4, border: `1px solid ${v('color-border')}`, background: v('color-surface-2'), cursor: 'pointer' }}>→</button>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart data={result.plotData.filter((d: any) => d.x >= xDomain[0] && d.x <= xDomain[1])}>
                    <CartesianGrid strokeDasharray="3 3" stroke={v('color-border')} />
                    <XAxis dataKey="x" type="number" domain={xDomain} stroke={v('color-text-muted')} fontSize={12} tickCount={11} />
                    <YAxis stroke={v('color-text-muted')} fontSize={12} />
                    <Tooltip contentStyle={{ backgroundColor: v('color-surface'), borderColor: v('color-border') }} />
                    <ReferenceLine y={0} stroke={v('color-text-muted')} />
                    <ReferenceLine x={0} stroke={v('color-text-muted')} />
                    
                    {result.plotData.some((p: any) => p.isArea) && (
                      <Area type="monotone" dataKey={(d: any) => d.isArea ? d.fx : null} stroke="none" fill={v('color-primary')} fillOpacity={0.3} connectNulls={false} />
                    )}
                    
                    <Line type="monotone" dataKey="fx" name="f(x)" stroke={v('color-primary')} dot={false} strokeWidth={3} isAnimationActive={false} />
                    <Line type="monotone" dataKey="Fx" name="F(x)" stroke="#10b981" dot={false} strokeWidth={3} isAnimationActive={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Tips & Warnings */}
            {(result.tips?.length || result.warnings?.length) ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {result.tips?.map((tip: string, i: number) => (
                  <div key={`tip-${i}`} style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 10, padding: '12px 16px', display: 'flex', gap: 10 }}>
                    <span>💡</span>
                    <span style={{ color: v('color-text'), fontSize: 14 }}>{tip}</span>
                  </div>
                ))}
                {result.warnings?.map((w: string, i: number) => (
                  <div key={`warn-${i}`} style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 10, padding: '12px 16px', display: 'flex', gap: 10 }}>
                    <span>⚠️</span>
                    <span style={{ color: v('color-text'), fontSize: 14, fontWeight: isUsingAI && i===0 ? 'bold' : 'normal' }}>{w}</span>
                  </div>
                ))}
              </div>
            ) : null}

          </div>
        )}
      </main>
    </div>
  );
}
