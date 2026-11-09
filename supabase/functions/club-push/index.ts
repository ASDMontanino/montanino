import { createClient } from "npm:@supabase/supabase-js@2.110.0";
import webPush from "npm:web-push@3.6.7";
import { Buffer } from "node:buffer";
import { createECDH, createHash } from "node:crypto";

const allowedOrigin = Deno.env.get("CLUB_PUSH_ORIGIN") || "https://asdmontanino.github.io";
const vapidSubject = Deno.env.get("CLUB_PUSH_VAPID_SUBJECT") || allowedOrigin + "/montanino/";
const categories = new Set(["calendar", "result", "photos"]);

type VapidKeys = { publicKey: string; privateKey: string };

type Job = {
  job_id: string;
  lease: string;
  subscription_id: string;
  endpoint: string;
  p256dh: string;
  auth_secret: string;
  message: Record<string, string>;
  attempts: number;
  ttl: number;
};

function validEndpoint(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.href !== value || url.port || url.username ||
        url.password || url.search || url.hash) return false;
    // Only browser push services. Never forward to arbitrary hosts or follow redirects.
    if (url.hostname === "fcm.googleapis.com") return /^\/fcm\/send\/[\w:-]+$/.test(url.pathname);
    if (url.hostname === "updates.push.services.mozilla.com") return /^\/wpush\/v2\/[\w-]+={0,2}$/.test(url.pathname);
    if (/^(?:[a-z0-9-]+\.)?push\.apple\.com$/.test(url.hostname)) return /^\/[\w-]+$/.test(url.pathname);
    return false;
  } catch {
    return false;
  }
}

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "apikey, content-type",
      "Cache-Control": "no-store",
      "Vary": "Origin",
    },
  });
}

function database() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function send(db: ReturnType<typeof database>, job: Job, keys: VapidKeys) {
  let status = 400;
  if (validEndpoint(job.endpoint)) {
    try {
      const tag = job.message.tag;
      // Eighteen bytes produce a valid, unpadded 24-character Web Push Topic.
      const topic = createHash("sha256").update(tag).digest().subarray(0, 18).toString("base64url");
      const request = webPush.generateRequestDetails({
        endpoint: job.endpoint,
        keys: { p256dh: job.p256dh, auth: job.auth_secret },
      }, JSON.stringify(job.message), {
        vapidDetails: { subject: vapidSubject, ...keys },
        TTL: job.ttl,
        urgency: tag.startsWith("calendar-") || tag === "pilot-welcome" ? "high" : "normal",
        topic,
      });
      const headers = new Headers(request.headers);
      headers.delete("Content-Length");
      const response = await fetch(job.endpoint, {
        method: "POST",
        headers,
        body: request.body ? new Uint8Array(request.body) : undefined,
        signal: AbortSignal.timeout(5000),
        redirect: "error",
      });
      status = response.status;
      if (response.ok) {
        await response.body?.cancel().catch(() => {});
      } else {
        const details = await response.json().catch(() => null);
        const reason = typeof details?.reason === "string" && /^[A-Za-z]{1,48}$/.test(details.reason)
          ? details.reason : undefined;
        console.warn("Club push provider rejected request", { status, reason });
      }
    } catch {
      console.warn("Club push request could not be sent");
      status = 503;
    }
  }

  if (status === 404 || status === 410) {
    const { error } = await db.from("club_push_subscriptions").delete()
      .eq("id", job.subscription_id).eq("p256dh", job.p256dh);
    if (error) throw new Error("subscription_cleanup");
    return "expired";
  }

  const sent = status >= 200 && status < 300;
  const remove = sent || status === 400 || status === 413 || job.attempts >= 5;
  const jobs = db.from("club_push_jobs");
  const result = remove ? jobs.delete() : jobs.update({
    next_attempt: new Date(Date.now() + 60_000 * 2 ** (job.attempts - 1)).toISOString(),
    claim: null,
  });
  const { error } = await result.eq("id", job.job_id).eq("claim", job.lease);
  if (error) throw new Error("job_update");
  return sent ? "sent" : remove ? "failed" : "retry";
}

async function dispatch(db: ReturnType<typeof database>, keys: VapidKeys) {
  const totals: Record<string, number> = {};
  for (let batch = 0; batch < 4; batch++) {
    const { data, error } = await db.rpc("club_push_claim", { p_limit: 24 });
    if (error) throw new Error("job_claim");
    const jobs = data as Job[];
    const outcomes = await Promise.allSettled(jobs.map(job => send(db, job, keys)));
    for (const outcome of outcomes) {
      const key = outcome.status === "fulfilled" ? outcome.value : "job_error";
      totals[key] = (totals[key] || 0) + 1;
    }
    if (jobs.length < 24) break;
  }
  if (totals.failed || totals.job_error) console.warn("Club push delivery counts", totals);
  return json(totals);
}

Deno.serve(async request => {
  const worker = request.headers.get("x-club-push-worker");
  if (worker !== null) {
    if (!/^[0-9a-f-]{72}$/.test(worker)) return json({ error: "forbidden" }, 403);
    if (request.method !== "POST") return json({ error: "method" }, 405);
    try {
      const db = database();
      const initial = await db.rpc("club_push_runtime", { p_worker: worker });
      if (initial.error) throw new Error("worker_config");
      if (initial.data === null) return json({ error: "forbidden" }, 403);
      let keys = initial.data as VapidKeys;
      if (!keys.privateKey) {
        const setup = await db.rpc("club_push_runtime", {
          p_worker: worker, p_keys: webPush.generateVAPIDKeys(),
        });
        if (setup.error || !setup.data?.privateKey) throw new Error("worker_setup");
        keys = setup.data;
      }
      return await dispatch(db, keys);
    } catch {
      console.error("Club push dispatch failed");
      return json({ error: "dispatch_failed" }, 500);
    }
  }

  if (request.headers.get("origin") !== allowedOrigin) return json({ error: "origin" }, 403);
  if (request.method === "OPTIONS") return json({});
  if (request.method === "GET") {
    const { data, error } = await database().rpc("club_push_runtime");
    if (error || !data?.publicKey) return json({ error: "not_configured" }, 503);
    return json({ publicKey: data.publicKey, pilot: data.pilot === true });
  }
  if (request.method !== "POST") return json({ error: "method" }, 405);

  const reader = request.body?.getReader();
  if (!reader) return json({ error: "body" }, 400);
  let input: Record<string, unknown>;
  try {
    const decoder = new TextDecoder();
    let bytes = 0;
    let raw = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 4096) {
        await reader.cancel();
        return json({ error: "body_too_large" }, 413);
      }
      raw += decoder.decode(value, { stream: true });
    }
    input = JSON.parse(raw + decoder.decode());
    if (!input || typeof input !== "object" || Array.isArray(input)) return json({ error: "body" }, 400);
  } catch {
    return json({ error: "body" }, 400);
  }

  const { action, endpoint, auth, p256dh, topics, pilot } = input;
  if (!validEndpoint(endpoint) || typeof auth !== "string" || !/^[\w-]{22}$/.test(auth)) {
    return json({ error: "subscription" }, 400);
  }
  const db = database();
  try {
    if (action === "get" || action === "delete") {
      const { data, error } = await db.rpc("club_push_preferences", {
        p_endpoint: endpoint, p_auth: auth, p_remove: action === "delete",
      });
      if (error) throw new Error("subscription_read_or_delete");
      return json({ topics: data });
    }
    if (action !== "save" || typeof p256dh !== "string" || !/^B[A-Za-z0-9_-]{86}$/.test(p256dh) ||
        !Array.isArray(topics) || topics.length < 1 || topics.length > categories.size ||
        topics.some(topic => !categories.has(topic))) return json({ error: "preferences" }, 400);

    try {
      const verifier = createECDH("prime256v1");
      verifier.generateKeys();
      verifier.computeSecret(Buffer.from(p256dh, "base64url"));
    } catch {
      return json({ error: "encryption_key" }, 400);
    }
    const { data, error } = await db.rpc("club_push_save", {
      p_endpoint: endpoint, p_p256dh: p256dh, p_auth: auth, p_topics: [...new Set(topics)],
      p_pilot: typeof pilot === "string" && /^[0-9a-f]{16}$/.test(pilot) ? pilot : null,
    });
    if (error) throw new Error("subscription_save");
    if (data === "pilot") return json({ error: "pilot_code" }, 403);
    if (data !== "ok") return json({ error: "subscription_conflict" }, 409);
    return json({ topics });
  } catch {
    console.error("Club push subscription operation failed");
    return json({ error: "database" }, 503);
  }
});
