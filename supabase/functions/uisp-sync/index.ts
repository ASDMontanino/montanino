const SOURCE_URL = "https://gestionalecalcionuovo.uisp.it/AREZZO/25/57";
const MAX_HTML_BYTES = 2_000_000;
const REQUEST_TIMEOUT_MS = 20_000;
const ROUND_COUNT = 13;
const MATCHES_PER_ROUND = 7;
const SYNC_MIN_INTERVAL_HOURS = 5;

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function supabaseSecret() {
  const values = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (values) {
    try {
      const parsed = JSON.parse(values);
      const key = parsed.default || Object.values(parsed)[0];
      if (typeof key === "string" && key) return key;
    } catch {
      // Fall through to the legacy environment variable.
    }
  }
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  throw new Error("Supabase secret key non configurata nell’Edge Function");
}

function apiHeaders(key: string, extra: Record<string, string> = {}) {
  const headers = new Headers({ apikey: key, ...extra });
  // Legacy service_role is a JWT; modern sb_secret keys must be sent on apikey only.
  if (!key.startsWith("sb_secret_")) headers.set("Authorization", "Bearer " + key);
  return headers;
}

async function databaseRequest(path: string, key: string, init: RequestInit = {}) {
  const base = (Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
  if (!base) throw new Error("SUPABASE_URL non configurato");
  const headers = apiHeaders(key, { "Content-Type": "application/json", ...(init.headers as Record<string, string> || {}) });
  return await fetch(base + "/rest/v1/" + path, {
    ...init,
    headers,
    signal: init.signal || AbortSignal.timeout(10_000),
  });
}

async function postJson(path: string, key: string, body: unknown) {
  const response = await databaseRequest(path, key, { method: "POST", body: JSON.stringify(body) });
  if (!response.ok) throw new Error("Errore Supabase " + path + ": HTTP " + response.status);
  return await response.json();
}

function hex(bytes: Uint8Array) {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return hex(new Uint8Array(digest));
}

function sameSecretHash(a: string, b: string) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
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

function textFromHtml(value: string) {
  return decodeEntities(value.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

function parseStandings(html: string) {
  for (const [table] of html.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)) {
    const header = table.match(/<thead\b[^>]*>([\s\S]*?)<\/thead>/i)?.[1] ?? "";
    if (!/title=["']Punti["']/i.test(header) ||
        !/title=["']Gol fatti\/subiti["']/i.test(header) ||
        !/title=["']Punti disciplina["']/i.test(header)) continue;

    const tbody = table.match(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/i)?.[1] ?? "";
    const rows = [...tbody.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
    const standings = rows.map(([, row]) => {
      const cells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(([, cell]) => textFromHtml(cell));
      if (cells.length < 8) return null;
      const [_, squadra, puntiRaw, reti, vinteRaw, pareggiateRaw, perseRaw, disciplinaRaw] = cells;
      const values = [puntiRaw, vinteRaw, pareggiateRaw, perseRaw, disciplinaRaw].map(Number);
      if (!squadra || !/^\d+:\d+$/.test(reti) || values.some((value) => !Number.isInteger(value))) return null;
      return { squadra, punti: values[0], giocate: values[1] + values[2] + values[3] };
    }).filter((row): row is { squadra: string; punti: number; giocate: number } => row !== null);

    if (standings.length >= 2 && standings.length <= 50) return standings;
  }
  throw new Error("La tabella ufficiale UISP non ha il formato atteso");
}

const italianMonths: Record<string, number> = {
  gennaio: 1, febbraio: 2, marzo: 3, aprile: 4, maggio: 5, giugno: 6,
  luglio: 7, agosto: 8, settembre: 9, ottobre: 10, novembre: 11, dicembre: 12,
};

function parseDate(value: string | null) {
  if (!value || /definire|da confermare|da stabilire/i.test(value)) return null;
  const match = value.toLocaleLowerCase("it-IT").match(/(\d{1,2})\s+([a-zà-ù]+)\s+(\d{4})/i);
  if (!match) throw new Error("Data UISP in formato non riconosciuto: " + value);
  const month = italianMonths[match[2]];
  if (!month) throw new Error("Mese UISP non riconosciuto: " + match[2]);
  return match[3] + "-" + String(month).padStart(2, "0") + "-" + match[1].padStart(2, "0");
}

function normalizeTeam(value: string) {
  const words = value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("it-IT")
    .replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/);
  const organization = new Set(["asd", "as", "a", "s", "d", "gs", "g", "ac", "pol", "polisportiva", "1979"]);
  const filtered = words.filter((word) => !organization.has(word));
  return filtered.join(" ");
}

function canonicalTeamNames(calendar: unknown[]) {
  const names = new Map<string, string>();
  for (const row of calendar) {
    if (!row || typeof row !== "object") continue;
    const item = row as Record<string, unknown>;
    for (const field of ["casa", "ospite"]) {
      const name = typeof item[field] === "string" ? item[field].trim() : "";
      if (name) names.set(normalizeTeam(name), name);
    }
  }
  names.set("montanino", "Montanino");
  return names;
}

function parseFixtures(html: string, expectedPhase: number, expectedRound: number, teamNames: Map<string, string>) {
  const cards = [...html.matchAll(/<a class="card card-flush overflow-hidden[^"]*" href="\/AREZZO\/25\/57\/(\d+)\/(\d+)\/(\d+)"[^>]*>([\s\S]*?)<\/a>/gi)];
  if (cards.length !== MATCHES_PER_ROUND) {
    throw new Error("Giornata UISP " + expectedPhase + "/" + expectedRound + ": attese 7 partite, ricevute " + cards.length);
  }

  return cards.map(([, phaseRaw, roundRaw, _gameRaw, card]) => {
    const phase = Number(phaseRaw);
    const giornata = Number(roundRaw);
    if (phase !== expectedPhase || giornata !== expectedRound || (phase !== 1 && phase !== 2)) {
      throw new Error("La scheda UISP punta a una giornata diversa dalla richiesta");
    }

    const teams = [...card.matchAll(/<span class="text-light fw-bolder fs-7 text-uppercase">([\s\S]*?)<\/span>/gi)]
      .map(([, value]) => textFromHtml(value));
    const scores = [...card.matchAll(/<div class="col-2[^"]*">\s*<span class="text-light fw-bolder fs-2">\s*([^<]+?)\s*<\/span>/gi)]
      .map(([, value]) => textFromHtml(value));
    if (teams.length !== 2 || scores.length !== 2) throw new Error("Scheda partita UISP incompleta");

    const score = scores.map((value) => value === "-" ? null : /^\d+$/.test(value) ? Number(value) : NaN);
    if (score.some((value) => Number.isNaN(value)) || (score[0] === null) !== (score[1] === null)) {
      throw new Error("Punteggio UISP non riconosciuto: " + scores.join(" - "));
    }

    const dateText = card.match(/<span class="text-gray-900 fw-bold fs-7 text-capitalize">([\s\S]*?)<\/span>/i)?.[1];
    const date = parseDate(dateText ? textFromHtml(dateText) : null);
    const greyValues = [...card.matchAll(/<span class="text-gray-500 fs-7">([\s\S]*?)<\/span>/gi)]
      .map(([, value]) => textFromHtml(value));
    const timeValue = greyValues.find((value) => /\b(?:[01]?\d|2[0-3]):[0-5]\d\b/.test(value));
    const time = timeValue?.match(/\b(?:[01]?\d|2[0-3]):[0-5]\d\b/)?.[0] ?? null;
    const locationName = [...card.matchAll(/<span class="text-gray-900 fw-bold fs-7">([\s\S]*?)<\/span>/gi)]
      .map(([, value]) => textFromHtml(value))[0] ?? "";
    const address = greyValues.find((value) => value !== timeValue && !/definire|da confermare|da stabilire/i.test(value)) ?? "";
    const location = [locationName, address]
      .filter((value, index, all) => value && !all.slice(0, index).some((prior) => prior.toLocaleLowerCase("it-IT") === value.toLocaleLowerCase("it-IT")))
      .filter((value) => !/definire|da confermare|da stabilire/i.test(value))
      .join(" · ") || null;

    const homeKey = normalizeTeam(teams[0]);
    const awayKey = normalizeTeam(teams[1]);
    const phaseName = phase === 1 ? "Andata" : "Ritorno";
    const prefix = phase === 1 ? "A" : "R";
    return {
      id: prefix + String(giornata).padStart(2, "0"),
      fase: phaseName,
      giornata,
      casa: teamNames.get(homeKey) || teams[0],
      ospite: teamNames.get(awayKey) || teams[1],
      data: date,
      ora: time,
      campo: location,
      golCasa: score[0],
      golOspite: score[1],
    };
  });
}

async function fetchPage(phase: number, round: number) {
  const url = SOURCE_URL + "?round=" + phase + "&roundnumber=" + round;
  const response = await fetch(url, {
    headers: { Accept: "text/html", "User-Agent": "Montanino-UISP-Sync/1.0" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error("UISP giornata " + phase + "/" + round + ": HTTP " + response.status);
  const html = await response.text();
  if (html.length > MAX_HTML_BYTES) throw new Error("Pagina UISP troppo grande");
  return html;
}

async function fetchAllOfficialData(teamNames: Map<string, string>) {
  const pages = new Array<string>(ROUND_COUNT * 2);
  let next = 0;
  const worker = async () => {
    while (true) {
      const index = next++;
      if (index >= pages.length) return;
      const phase = index < ROUND_COUNT ? 1 : 2;
      const round = index < ROUND_COUNT ? index + 1 : index - ROUND_COUNT + 1;
      pages[index] = await fetchPage(phase, round);
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));
  const classifica = parseStandings(pages[0]);
  const calendario: Record<string, unknown>[] = [];
  for (let index = 0; index < pages.length; index++) {
    const phase = index < ROUND_COUNT ? 1 : 2;
    const round = index < ROUND_COUNT ? index + 1 : index - ROUND_COUNT + 1;
    const fixtures = parseFixtures(pages[index], phase, round, teamNames);
    const montaninoFixtures = fixtures.filter((match) =>
      normalizeTeam(String(match.casa)) === "montanino" || normalizeTeam(String(match.ospite)) === "montanino"
    );
    if (montaninoFixtures.length !== 1) {
      throw new Error("Giornata " + phase + "/" + round + ": trovate " + montaninoFixtures.length + " partite del Montanino");
    }
    calendario.push(...montaninoFixtures);
  }
  const ids = new Set(calendario.map((match) => match.id));
  if (calendario.length !== 26 || ids.size !== 26 || classifica.length < 2) {
    throw new Error("La risposta UISP è incompleta: " + calendario.length + " partite Montanino, " + classifica.length + " squadre");
  }
  return { classifica, calendario };
}

function mergeCalendar(existing: unknown, official: Record<string, unknown>[]) {
  const old = Array.isArray(existing) ? existing : [];
  const byId = new Map(old.map((match) => [String((match as Record<string, unknown>)?.id ?? ""), match]));
  const officialIds = new Set(official.map((match) => String(match.id)));
  const merged = official.map((match) => ({ ...(byId.get(String(match.id)) as Record<string, unknown> || {}), ...match }));
  old.forEach((match) => {
    const id = String((match as Record<string, unknown>)?.id ?? "");
    if (id && !officialIds.has(id)) merged.push(match as Record<string, unknown>);
  });
  return merged;
}

async function setSyncState(key: string, values: Record<string, unknown>) {
  const response = await databaseRequest("uisp_sync_state?id=eq.site", key, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(values),
  });
  if (!response.ok) throw new Error("Errore aggiornamento stato sincronizzazione: HTTP " + response.status);
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return reply({ error: "Metodo non supportato" }, 405);

  try {
    const key = supabaseSecret();
    const stateResponse = await databaseRequest("uisp_sync_state?select=token_hash&id=eq.site", key);
    if (!stateResponse.ok) throw new Error("Errore lettura stato sincronizzazione: HTTP " + stateResponse.status);
    const stateRows = await stateResponse.json();
    const suppliedToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    const suppliedHash = await sha256(suppliedToken);
    if (!stateRows?.length || !suppliedToken || !sameSecretHash(suppliedHash, stateRows[0].token_hash)) {
      return reply({ error: "Non autorizzato" }, 401);
    }

    const claimed = await postJson("rpc/claim_uisp_sync", key, {});
    if (claimed !== true) return reply({ status: "recentemente_sincronizzata" }, 202);

    try {
      const siteResponse = await databaseRequest("club_content?select=payload,revision&id=eq.site", key);
      if (!siteResponse.ok) throw new Error("Errore lettura contenuti sito: HTTP " + siteResponse.status);
      const siteRows = await siteResponse.json();
      if (!siteRows?.length || !siteRows[0].payload || !Number.isInteger(siteRows[0].revision)) {
        throw new Error("Contenuto sito o revisione non disponibili");
      }

      const payload = siteRows[0].payload as Record<string, unknown>;
      const teamNames = canonicalTeamNames(Array.isArray(payload.calendario) ? payload.calendario : []);
      const official = await fetchAllOfficialData(teamNames);
      const calendario = mergeCalendar(payload.calendario, official.calendario);
      const updated = await postJson("rpc/sync_uisp_official_data", key, {
        p_classifica: official.classifica,
        p_calendario: calendario,
        p_expected_revision: siteRows[0].revision,
      });
      if (updated !== true) throw new Error("I dati del sito sono cambiati durante la sincronizzazione; nessun dato è stato sovrascritto");

      await setSyncState(key, { last_synced_at: new Date().toISOString(), last_error: null });
      return reply({
        status: "ok",
        source: SOURCE_URL,
        giornate: 26,
        partite: calendario.length,
        squadre: official.classifica.length,
      });
    } catch (error) {
      const message = (error instanceof Error ? error.message : String(error)).slice(0, 500);
      await setSyncState(key, { last_error: message }).catch((stateError) => console.error("Stato sync non aggiornato:", stateError));
      console.error("UISP sync failed:", message);
      return reply({ error: "Sincronizzazione UISP non riuscita", detail: message }, 502);
    }
  } catch (error) {
    console.error("UISP sync authorization or setup failed:", error);
    return reply({ error: "Servizio di sincronizzazione non disponibile" }, 500);
  }
});
