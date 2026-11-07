import type { PromoCode } from './promocodes';
import { parseMoney, parsePromoDate } from './promo-parser';

/** Deterministic evidence-grounded extraction; never fabricate a missing code. */
export function enrichLiteralTerms(code: PromoCode, now = Date.now()): PromoCode {
  const text = [code.description, ...code.conditions].join(' ');
  const minText = text.match(/(?:заказ|покупк[а-яё]*|сумм[а-яё]*)(?:\s+на\s+сумму)?\s*(?:от|не\s+менее)\s*(\d[\d\s\u00a0\u202f]*(?:[.,]\d{1,2})?)\s*(?:₽|руб)/i);
  const endText = text.match(/(?:до|по|действует до)\s+(\d{1,2}\.\d{1,2}\.\d{4}|\d{1,2}\s+[а-яё]+\s+\d{4})/i);
  const minOrder = code.minOrder ?? (minText ? parseMoney(minText[1]) : undefined);
  const expiresAt = code.expiresAt ?? (endText ? parsePromoDate(endText[1], true) : undefined);
  return {
    ...code,
    minOrder,
    expiresAt,
    status: expiresAt !== undefined && expiresAt <= now ? 'expired' : code.status,
  };
}

type ModelAnswer = {
  evidencePhrases?: unknown;
  expiryLiteral?: unknown;
  minimumLiteral?: unknown;
};

/** A local, opt-in model may propose only literal spans already present in an offer. */
export function applyGroundedModelAnswer(code: PromoCode, answer: unknown): PromoCode {
  if (!answer || typeof answer !== 'object' || Array.isArray(answer)) return code;
  const data = answer as ModelAnswer;
  const text = [code.description, ...code.conditions].join(' ');
  const evidence = Array.isArray(data.evidencePhrases)
    ? data.evidencePhrases.filter((s): s is string =>
      typeof s === 'string' && s.length >= 5 && s.length <= 180 && text.includes(s)).slice(0, 5)
    : [];
  let expiresAt = code.expiresAt;
  if (expiresAt === undefined && typeof data.expiryLiteral === 'string' &&
      text.includes(data.expiryLiteral) && data.expiryLiteral.length <= 50) {
    expiresAt = parsePromoDate(data.expiryLiteral, true);
  }
  let minOrder = code.minOrder;
  if (minOrder === undefined && typeof data.minimumLiteral === 'string' &&
      text.includes(data.minimumLiteral) && data.minimumLiteral.length <= 50) {
    minOrder = parseMoney(data.minimumLiteral);
  }
  return {
    ...code,
    expiresAt,
    minOrder,
    conditions: [...new Set([...code.conditions, ...evidence])].slice(0, 100),
    status: expiresAt !== undefined && expiresAt <= Date.now() ? 'expired' : code.status,
  };
}

/** Optional Ollama localhost enrichment; failures leave deterministic results intact. */
export async function enrichWithLocalModel(codes: PromoCode[], signal: AbortSignal): Promise<PromoCode[]> {
  const model = process.env.PROMO_OLLAMA_MODEL?.trim();
  if (!model || !/^[\w.:-]{1,100}$/.test(model)) return codes;
  const result: PromoCode[] = [];
  for (const code of codes) {
    signal.throwIfAborted();
    const sourceText = [code.description, ...code.conditions].join('\n').slice(0, 2500);
    try {
      const response = await fetch('http://127.0.0.1:11434/api/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: AbortSignal.any([signal, AbortSignal.timeout(2500)]),
        body: JSON.stringify({
          model, stream: false, format: 'json',
          prompt: 'Return ONLY JSON: {"evidencePhrases":[],"expiryLiteral":null,"minimumLiteral":null}. Extract verbatim exact substrings about conditions, dates or minimum order from the Russian promotion text. Never guess missing information.\n' + sourceText,
          options: { temperature: 0, num_predict: 150 },
        }),
      });
      if (!response.ok) throw new Error('Local model unavailable');
      const payload = await response.json() as { response?: unknown };
      if (typeof payload.response !== 'string' || payload.response.length > 6000) throw new Error('Invalid model output');
      result.push(applyGroundedModelAnswer(code, JSON.parse(payload.response)));
    } catch (error) {
      if (signal.aborted) throw signal.reason;
      result.push(code);
    }
  }
  return result;
}
