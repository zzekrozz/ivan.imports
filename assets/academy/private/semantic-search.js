const STOP_WORDS = new Set([
  "a", "al", "algo", "como", "con", "cual", "cuando", "de", "del", "donde", "el", "ella", "en", "es", "esta", "este",
  "hay", "la", "las", "lo", "los", "me", "mi", "para", "por", "que", "se", "si", "sin", "su", "un", "una", "y",
  "debo", "hago", "mirar", "miro", "necesito", "puedo", "quiero", "saber", "significa", "significar", "tengo", "veo", "ver",
]);

const DOMAIN_GROUPS = Object.freeze([
  ["v7", "co2", "emisiones", "emision", "dioxido", "carbono"],
  ["campo-k", "homologacion", "contrasena-homologacion", "homologacion-tipo"],
  ["coc", "certificado", "conformidad", "ficha-reducida"],
  ["tuv", "hu", "itv", "inspeccion-tecnica"],
  ["modelo-576", "576", "impuesto-matriculacion", "iedmt", "matriculacion"],
  ["motorschaden", "motor", "averia-motor", "motor-danado"],
  ["getriebeschaden", "cambio", "caja-cambios", "transmision", "averia-cambio"],
  ["roi", "rentabilidad", "retorno", "margen", "beneficio"],
  ["placas-exportacion", "placas", "matricula-exportacion", "exportkennzeichen", "kurzzeitkennzeichen"],
  ["dgt", "trafico", "matricular", "matriculacion-espana"],
  ["ivtm", "impuesto-circulacion", "numerito"],
  ["vin", "bastidor", "numero-bastidor", "fahrgestellnummer"],
  ["historial", "mantenimiento", "scheckheft", "serviceheft"],
]);

const TERM_GROUP = new Map();
DOMAIN_GROUPS.forEach((group) => group.forEach((term) => TERM_GROUP.set(term, group)));

const TYPE_PRIORITY = Object.freeze({
  "Respuestas": 7,
  "Conceptos": 6,
  "Términos": 5,
  "Lecciones": 4,
  "Herramientas": 3,
  "Datos revisables": 3,
  "Fuentes": 2,
  "Etapas": 1,
  "Recursos": 1,
});

export function normalizeSemanticText(value = "") {
  return String(value ?? "")
    .replace(/₂/g, "2")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/\bco\s*[₂2]\b/g, " co2 ")
    .replace(/\bv\s*[.\-]?\s*7\b/g, " v7 ")
    .replace(/\bcampo\s+k\b/g, " campo-k ")
    .replace(/\bmodelo\s+576\b/g, " modelo-576 ")
    .replace(/\bcaja\s+de\s+cambios?\b/g, " caja-cambios ")
    .replace(/\bimpuesto\s+de\s+matriculacion\b/g, " impuesto-matriculacion ")
    .replace(/\bplacas?\s+de\s+exportacion\b/g, " placas-exportacion ")
    .replace(/[^a-z0-9-]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function stem(term) {
  if (term.length < 5 || /\d/.test(term)) return term;
  return term
    .replace(/(amientos|imientos|aciones|adores|adoras|mente)$/u, "")
    .replace(/(ando|iendo|acion|idades|idad|es|os|as)$/u, "")
    .replace(/(ar|er|ir|o|a)$/u, "");
}

function tokens(value) {
  return normalizeSemanticText(value).split(" ").filter((term) => term && !STOP_WORDS.has(term));
}

function editDistanceAtMostOne(left, right) {
  if (left === right) return true;
  if (left.length < 5 || right.length < 5 || Math.abs(left.length - right.length) > 1) return false;
  let edits = 0;
  for (let i = 0, j = 0; i < left.length && j < right.length;) {
    if (left[i] === right[j]) { i += 1; j += 1; continue; }
    edits += 1;
    if (edits > 1) return false;
    if (left.length > right.length) i += 1;
    else if (right.length > left.length) j += 1;
    else { i += 1; j += 1; }
  }
  return true;
}

function expandToken(token) {
  const direct = TERM_GROUP.get(token);
  if (direct) return direct;
  const tokenStem = stem(token);
  for (const [term, group] of TERM_GROUP) {
    if (stem(term) === tokenStem) return group;
  }
  return [token];
}

function field(value) {
  const text = normalizeSemanticText(Array.isArray(value) ? value.join(" ") : value);
  return { text, tokens: new Set(tokens(text)), stems: new Set(tokens(text).map(stem)) };
}

function fieldMatch(queryToken, expanded, candidate) {
  let best = 0;
  for (const term of expanded) {
    if (candidate.tokens.has(term)) best = Math.max(best, term === queryToken ? 1 : 0.82);
    else if (candidate.stems.has(stem(term))) best = Math.max(best, 0.72);
    else if ([...candidate.tokens].some((candidateToken) => editDistanceAtMostOne(term, candidateToken))) best = Math.max(best, 0.48);
  }
  return best;
}

function prepareItem(item) {
  return {
    item,
    title: field(item.title),
    aliases: field([...(item.keywords || []), ...(item.aliases || [])]),
    summary: field(item.summary),
    search: field(item.search),
  };
}

function confidence(score, coverage, exactPhrase) {
  if ((exactPhrase && score >= 24) || (coverage === 1 && score >= 22)) return "alta";
  if (coverage >= 0.66 && score >= 14) return "media";
  return "baja";
}

export function rankSemanticItems(query, items = [], options = {}) {
  const normalizedQuery = normalizeSemanticText(query);
  const queryTokens = tokens(normalizedQuery);
  if (!queryTokens.length) return [];
  const limit = Math.max(1, Number(options.limit) || 30);
  const ranked = [];
  items.forEach((item, index) => {
    if (!item?.title || !item?.href) return;
    const prepared = prepareItem(item);
    let score = Number(TYPE_PRIORITY[item.type] || 0);
    let matched = 0;
    const matchedTerms = [];
    const reasons = new Set();
    queryTokens.forEach((queryToken) => {
      const expanded = expandToken(queryToken);
      const titleMatch = fieldMatch(queryToken, expanded, prepared.title);
      const aliasMatch = fieldMatch(queryToken, expanded, prepared.aliases);
      const summaryMatch = fieldMatch(queryToken, expanded, prepared.summary);
      const searchMatch = fieldMatch(queryToken, expanded, prepared.search);
      const best = Math.max(titleMatch * 9, aliasMatch * 7, summaryMatch * 4, searchMatch * 2);
      if (best > 0) {
        matched += 1;
        score += best;
        matchedTerms.push(queryToken);
        if (titleMatch) reasons.add("título");
        else if (aliasMatch) reasons.add("término equivalente");
        else reasons.add("contenido");
      }
    });
    const exactPhrase = normalizedQuery.length >= 3 && prepared.title.text.includes(normalizedQuery);
    if (exactPhrase) { score += 18; reasons.add("frase exacta"); }
    const coverage = matched / queryTokens.length;
    score += coverage * 8;
    const minimumCoverage = queryTokens.length <= 2 ? 1 : 0.5;
    if (coverage < minimumCoverage || score < 8) return;
    ranked.push({
      item,
      score: Math.round(score * 100) / 100,
      coverage,
      confidence: confidence(score, coverage, exactPhrase),
      matchedTerms: [...new Set(matchedTerms)],
      reason: [...reasons].join(" · "),
      index,
    });
  });
  const seen = new Set();
  return ranked
    .sort((a, b) => b.score - a.score || b.coverage - a.coverage || a.index - b.index)
    .filter(({ item }) => {
      const key = `${item.type}|${item.href}|${normalizeSemanticText(item.title)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit)
    .map(({ index: _index, ...result }) => result);
}

export function answerSemanticQuery(query, items = [], options = {}) {
  const results = rankSemanticItems(query, items, options);
  const candidate = results.find(({ item, confidence: level }) =>
    level !== "baja" && ["Respuestas", "Conceptos", "Términos", "Datos revisables"].includes(item.type) && item.summary,
  );
  if (!candidate) return { query: normalizeSemanticText(query), answer: null, results };
  return {
    query: normalizeSemanticText(query),
    answer: {
      title: candidate.item.title,
      text: candidate.item.summary,
      href: candidate.item.href,
      type: candidate.item.type,
      confidence: candidate.confidence,
      reason: candidate.reason,
      sourcePages: candidate.item.sourcePages || [],
      sourceLabel: candidate.item.sourceLabel || "Contenido trazado del programa",
      conceptId: candidate.item.conceptId || "",
      answerId: candidate.item.answerId || "",
    },
    results,
  };
}

export const ACADEMY_SEARCH_SUGGESTIONS = Object.freeze([
  "¿Dónde miro el CO₂?",
  "¿Qué significa campo K vacío?",
  "¿Necesito CoC?",
  "¿Cómo calculo el ROI?",
  "¿Qué placas necesito para volver?",
]);
