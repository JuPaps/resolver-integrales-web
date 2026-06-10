import nerdamer from 'nerdamer';
import 'nerdamer/Calculus';
import { evaluate } from 'mathjs';

export interface MathStep {
  title: string;
  description: string;
  formula: string; // LaTeX
}

export interface PlotData {
  x: number[];
  y_original: number[];
  y_integral: number[];
}

export interface SolveResult {
  success: boolean;
  original_latex?: string;
  solution_latex?: string;
  steps?: MathStep[];
  tips?: string;
  plot?: PlotData;
  error?: string;
}

export const solveIntegralLocally = (expressionStr: string): SolveResult => {
  try {
    // 1. Parse and format the expression
    const cleanExpr = expressionStr.replace(/\^/g, '^'); // Nerdamer handles ^
    
    // Convert to Nerdamer object to check if it's valid
    const nExpr = nerdamer(cleanExpr);
    const originalLatex = nerdamer(cleanExpr).toTeX();

    // 2. Calculate the integral using Nerdamer
    const integral = nerdamer(`integrate(${cleanExpr}, x)`);
    const solutionLatex = integral.toTeX() + ' + C';

    // 3. Generate Mock Steps for Educational Purposes
    // (A full symbolic step-by-step engine requires deep AST parsing. Here we simulate basic rules based on the expression)
    const steps: MathStep[] = [];
    
    steps.push({
      title: "Planteamiento",
      description: "Escribimos la integral con respecto a la variable x.",
      formula: `\\int (${originalLatex}) \\, dx`
    });

    if (cleanExpr.includes('+') || cleanExpr.includes('-')) {
      steps.push({
        title: "Regla de la Suma/Resta",
        description: "Separamos la integral en múltiples integrales más pequeñas, una para cada término.",
        formula: "\\int (f(x) \\pm g(x)) \\, dx = \\int f(x) \\, dx \\pm \\int g(x) \\, dx"
      });
    }

    if (cleanExpr.includes('sin') || cleanExpr.includes('cos') || cleanExpr.includes('tan')) {
       steps.push({
        title: "Integración Trigonométrica",
        description: "Aplicamos las identidades y reglas de integración de funciones trigonométricas estándar.",
        formula: "\\int \\sin(x)dx = -\\cos(x), \\quad \\int \\cos(x)dx = \\sin(x)"
      });
    }

    steps.push({
      title: "Solución Final",
      description: "Agregamos la constante de integración (C) al resultado final de las antiderivadas.",
      formula: solutionLatex
    });

    // 4. Generate Plotting Data
    // We use MathJS to evaluate numerical points safely
    const xVals: number[] = [];
    const yOrig: number[] = [];
    const yInt: number[] = [];
    
    // We compile expressions in MathJS for performance
    const compiledOrig = nerdamer(cleanExpr).buildFunction();
    const compiledInt = integral.buildFunction();

    for (let x = -10; x <= 10; x += 0.5) {
      xVals.push(x);
      try {
        const valO = Number(compiledOrig(x));
        const valI = Number(compiledInt(x));
        yOrig.push(isNaN(valO) || !isFinite(valO) ? 0 : valO);
        yInt.push(isNaN(valI) || !isFinite(valI) ? 0 : valI);
      } catch {
        yOrig.push(0);
        yInt.push(0);
      }
    }

    return {
      success: true,
      original_latex: originalLatex,
      solution_latex: solutionLatex,
      steps,
      tips: "Recuerda que la integral indefinida representa una familia de funciones. Siempre incluye '+ C'.",
      plot: {
        x: xVals,
        y_original: yOrig,
        y_integral: yInt
      }
    };

  } catch (err: any) {
    return {
      success: false,
      error: 'Error al interpretar la expresión matemática. Verifica la sintaxis (ej. x^2, sin(x)).'
    };
  }
};
