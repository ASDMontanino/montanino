const SOURCE_URL = "https://gestionalecalcionuovo.uisp.it/AREZZO/25/57";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Cache-Control": "public, max-age=120, s-maxage=120, stale-while-revalidate=600",
  "Vary": "Origin",
};

let cachedStandings: unknown = null;
let cachedAt = 0;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

function decodeEntities(value: string) {
  const named: Record<string, string> = {
    "&amp;": "&",
    "&quot;": '"',
    "&apos;": "'",
    "&#39;": "'",
    "&nbsp;": " ",
  };
  return value
    .replace(/&(?:amp|quot|apos|nbsp);|&#39;/gi, (entity) => named[entity.toLowerCase()] ?? entity)
    .replace(/&#(\d+);/g, (_, number: string) => String.fromCodePoint(Number(number)))
    .replace(/&#x([\da-f]+);/gi, (_, number: string) => String.fromCodePoint(parseInt(number, 16)));
}

function cellText(html: string) {
  return decodeEntities(html.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function parseStandings(html: string) {
  const tables = html.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi);
  for (const [table] of tables) {
    const header = table.match(/<thead\b[^>]*>([\s\S]*?)<\/thead>/i)?.[1] ?? "";
    if (!/title=["']Punti["']/i.test(header) ||
        !/title=["']Gol fatti\/subiti["']/i.test(header) ||
        !/title=["']Punti disciplina["']/i.test(header)) continue;

    const tbody = table.match(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/i)?.[1] ?? "";
    const rows = [...tbody.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
    const standings = rows.map(([, row]) => {
      const cells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(([, cell]) => cellText(cell));
      if (cells.length < 8) return null;
      const [_, squadra, puntiRaw, reti, vinteRaw, pareggiateRaw, perseRaw, disciplinaRaw] = cells;
      const numbers = [puntiRaw, vinteRaw, pareggiateRaw, perseRaw, disciplinaRaw].map((value) => Number(value));
      if (!squadra || !/^\d+:\d+$/.test(reti) || numbers.some((value) => !Number.isInteger(value))) return null;
      return {
        squadra,
        punti: numbers[0],
        giocate: numbers[1] + numbers[2] + numbers[3],
      };
    }).filter((row): row is { squadra: string; punti: number; giocate: number } => row !== null);

    if (standings.length >= 2 && standings.length <= 50) return standings;
  }
  throw new Error("La tabella ufficiale UISP non ha il formato atteso");
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "GET") return jsonResponse({ error: "Metodo non supportato" }, 405);

  if (cachedStandings && Date.now() - cachedAt < 120_000) {
    return jsonResponse({ source: SOURCE_URL, classifica: cachedStandings });
  }

  try {
    const response = await fetch(SOURCE_URL, {
      headers: { "Accept": "text/html", "User-Agent": "Montanino-Standings/1.0" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) throw new Error(`UISP ha risposto con HTTP ${response.status}`);
    const html = await response.text();
    if (html.length > 2_000_000) throw new Error("Risposta UISP troppo grande");

    const classifica = parseStandings(html);
    cachedStandings = classifica;
    cachedAt = Date.now();
    return jsonResponse({ source: SOURCE_URL, classifica });
  } catch (error) {
    console.error("Impossibile aggiornare la classifica UISP:", error);
    return jsonResponse({ error: "Classifica UISP temporaneamente non disponibile" }, 502);
  }
});
