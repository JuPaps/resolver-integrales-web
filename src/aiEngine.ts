import { type SolveResult, generatePlot } from './mathEngine';

const SYSTEM_PROMPT = `Eres el motor de cálculo matemático de "MathSolver". El usuario te enviará una integral o expresión matemática para resolver.
Debes resolverla paso a paso utilizando métodos de cálculo universitario (sustitución, por partes, fracciones parciales, trigonométricas, etc.).
Debes devolver ÚNICAMENTE un objeto JSON válido (sin formato markdown adicional ni bloques de código de texto plano, SOLO el JSON parseable).
El JSON debe cumplir con esta estructura estricta:
{
  "success": true,
  "integrand_latex": "string (la expresión original en LaTeX limpio)",
  "solution_latex": "string (la solución final en LaTeX limpio, recuerda agregar + C si es indefinida)",
  "steps": [
    {
      "id": 0,
      "rule": "string (nombre de la regla o método usado)",
      "explanation": "string (explicación breve y clara en español de lo que hiciste en este paso)",
      "formula": "string (fórmula matemática del paso en LaTeX limpio)"
    }
  ],
  "tips": [
    "string (opcional, consejos útiles sobre este tipo de integrales, métodos alternativos o verificación)"
  ],
  "integrand_math": "string (el integrando original en sintaxis matemática para Javascript, ej: x**2 + Math.sin(x), SIN LaTeX)",
  "solution_math": "string (la solución final en sintaxis matemática para Javascript, ej: (x**3)/3 - Math.cos(x), SIN LaTeX)",
  "definite_value": "number (OPCIONAL, numérico. Si el usuario provee límites 'a' y 'b', calcula F(b)-F(a) aquí)",
  "definite_latex": "string (OPCIONAL. El valor numérico final o fracción formateada en LaTeX, ej: '14.5' o '\\\\frac{29}{2}')",
  "warnings": [
    "string (opcional, advertencias matemáticas como divisiones por cero, discontinuidades de tangentes o restricciones de dominio)"
  ]
}

REGLAS IMPORTANTES PARA EL JSON:
1. No envuelvas el JSON en \`\`\`json ... \`\`\`. Devuelve el JSON puro.
2. Escapa correctamente las barras inclinadas en LaTeX. En lugar de \\int, debes usar \\\\int. En lugar de \\frac, usa \\\\frac. 
3. Asegúrate de que las matemáticas sean correctas y estén simplificadas.
4. Si la expresión no es una integral válida o es basura de texto, devuelve {"success": false, "error": "Explicación del error matemático"}.`;

export type AIProvider = 'gemini' | 'openai';

export interface AIConfig {
  provider: AIProvider;
  model: string;
  apiKey: string;
  baseUrl?: string; // Para OpenAI compatibles (Groq, LMStudio, etc)
}

export async function solveIntegralWithAI(expr: string, config: AIConfig, aStr?: string, bStr?: string): Promise<SolveResult> {
  if (!config.apiKey) {
    return { success: false, error: 'No se configuró una API Key.' };
  }
  if (!config.model) {
    return { success: false, error: 'No se especificó un modelo.' };
  }

  try {
    let candidateText = '';

    const userMessage = aStr && bStr 
      ? `Resuelve esta integral DEFINIDA desde a=${aStr} hasta b=${bStr} de la función: ${expr}. Devuelve SOLO el JSON estricto e incluye definite_value y definite_latex calculando F(${bStr}) - F(${aStr}).`
      : `Resuelve esta integral indefinida de forma detallada: ${expr}. Devuelve SOLO el JSON estricto.`;

    if (config.provider === 'gemini') {
      // Gemini API (Google AI Studio)
      const cleanModel = config.model.replace('models/', '');
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${config.apiKey}`;

      const body = {
        system_instruction: { parts: { text: SYSTEM_PROMPT } },
        contents: [ { parts: [ { text: userMessage } ] } ],
        generationConfig: { temperature: 0.2, responseMimeType: "application/json" }
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Google API HTTP ${response.status}: ${errText}`);
      }

      const data = await response.json();
      candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    } else if (config.provider === 'openai') {
      // OpenAI API o Compatible (Groq, DeepSeek, Local, etc)
      const endpoint = config.baseUrl ? config.baseUrl.replace(/\/$/, '') + '/chat/completions' : 'https://api.openai.com/v1/chat/completions';
      
      const body = {
        model: config.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.2,
        response_format: { type: "json_object" }
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenAI API HTTP ${response.status}: ${errText}`);
      }

      const data = await response.json();
      candidateText = data.choices?.[0]?.message?.content;
    }

    if (!candidateText) {
       throw new Error('La IA no devolvió contenido de texto útil.');
    }

    // Parse the JSON
    let parsedResult: SolveResult;
    try {
      parsedResult = JSON.parse(candidateText);
    } catch (parseError) {
      const cleaned = candidateText.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
      try {
        parsedResult = JSON.parse(cleaned);
      } catch (e) {
         throw new Error('La IA devolvió un formato inválido que no se pudo parsear como JSON. Respuesta cruda: ' + candidateText.substring(0, 50) + '...');
      }
    }

    // Add a mandatory warning to indicate this was AI generated
    parsedResult.warnings = parsedResult.warnings || [];
    parsedResult.warnings.unshift(`🤖 Generado por Red Neuronal Avanzada. Verifica el resultado matemático.`);
    
    // Generate Plot Data from the AI's math JS syntax
    if ((parsedResult as any).integrand_math && (parsedResult as any).solution_math) {
      parsedResult.plotData = generatePlot((parsedResult as any).integrand_math, (parsedResult as any).solution_math, aStr, bStr);
    } else {
      delete parsedResult.plotData;
    }

    return parsedResult;

  } catch (err: any) {
    return {
      success: false,
      error: `Error al contactar a la IA: ${err.message || 'Desconocido'}`
    };
  }
}
