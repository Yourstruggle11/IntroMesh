import type { Edge, GraphSnapshot, NodeId, Reach } from "./model";

/**
 * Minimal TigerGraph (Savanna / 4.x) REST client.
 * - GSQL endpoints authenticate with the database user (basic auth) or the secret.
 * - RESTPP endpoints use a bearer token minted from the secret.
 */

export const TG_SCHEMA_VERSION = 1;

export function tgConfigured() {
  return Boolean(process.env.TG_HOST && (process.env.TG_SECRET || (process.env.TG_USERNAME && process.env.TG_PASSWORD)));
}

export function tgGraph() {
  return process.env.TG_GRAPH || "IntroMesh";
}

function host() {
  let h = (process.env.TG_HOST || "").trim().replace(/\/+$/, "");
  if (h && !/^https?:\/\//.test(h)) h = `https://${h}`;
  return h;
}

function basicAuth() {
  const user = process.env.TG_USERNAME;
  const pass = process.env.TG_PASSWORD;
  if (user && pass) return "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
  if (process.env.TG_SECRET) return "Basic " + Buffer.from(`__GSQL__secret:${process.env.TG_SECRET}`).toString("base64");
  return "";
}

type TokenCache = { token: string; exp: number };
const g = globalThis as unknown as { __tgToken?: TokenCache };

async function fetchJson(url: string, init: RequestInit & { timeoutMs?: number } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), init.timeoutMs ?? 15000);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal, cache: "no-store" });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* non-JSON */
    }
    return { ok: res.ok, status: res.status, json, text };
  } finally {
    clearTimeout(t);
  }
}

async function getToken(): Promise<string> {
  const now = Date.now();
  if (g.__tgToken && g.__tgToken.exp > now + 60_000) return g.__tgToken.token;
  const secret = process.env.TG_SECRET;
  if (!secret) throw new Error("TG_SECRET is required for RESTPP queries");
  // TigerGraph 4.x
  let r = await fetchJson(`${host()}/gsql/v1/tokens`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret, graph: tgGraph(), lifetime: "86400" }),
    timeoutMs: 6000,
  });
  let token = (r.json as { token?: string; results?: { token?: string } } | null)?.token ?? (r.json as { results?: { token?: string } } | null)?.results?.token;
  if (!token) {
    // TigerGraph 3.x fallback
    r = await fetchJson(`${host()}/restpp/requesttoken`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, lifetime: "86400" }),
      timeoutMs: 6000,
    });
    token = (r.json as { token?: string; results?: { token?: string } } | null)?.token ?? (r.json as { results?: { token?: string } } | null)?.results?.token;
  }
  if (!token) throw new Error(`TigerGraph token request failed (${r.status}): ${r.text.slice(0, 200)}`);
  g.__tgToken = { token, exp: now + 23 * 3600_000 };
  return token;
}

/** Run GSQL statements (schema / query install). */
export async function gsql(statements: string, timeoutMs = 120_000) {
  const auth = basicAuth();
  let r = await fetchJson(`${host()}/gsql/v1/statements`, {
    method: "POST",
    headers: { "Content-Type": "text/plain", Authorization: auth },
    body: statements,
    timeoutMs,
  });
  if (r.status === 404) {
    r = await fetchJson(`${host()}/gsqlserver/gsql/file`, {
      method: "POST",
      headers: { "Content-Type": "text/plain", Authorization: auth },
      body: statements,
      timeoutMs,
    });
  }
  if (!r.ok) throw new Error(`GSQL failed (${r.status}): ${r.text.slice(0, 500)}`);
  return r.text;
}

async function restpp(path: string, init: RequestInit & { timeoutMs?: number } = {}) {
  const token = await getToken();
  const r = await fetchJson(`${host()}/restpp${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
  });
  const body = r.json as { error?: boolean; message?: string; results?: unknown } | null;
  if (!r.ok || body?.error) throw new Error(`RESTPP ${path} failed (${r.status}): ${body?.message ?? r.text.slice(0, 300)}`);
  return body;
}

export function schemaGsql() {
  const G = tgGraph();
  return `
CREATE VERTEX Person (PRIMARY_ID id STRING, kind STRING, name STRING, company STRING, role STRING) WITH primary_id_as_attribute="true"
CREATE UNDIRECTED EDGE KNOWS (FROM Person, TO Person, strength INT, source STRING)
CREATE GRAPH ${G} (Person, KNOWS)
`.trim();
}

export function queryGsql() {
  const G = tgGraph();
  return `
USE GRAPH ${G}
CREATE OR REPLACE QUERY warm_paths(VERTEX<Person> src, INT max_hops) FOR GRAPH ${G} {
  SetAccum<VERTEX<Person>> @parents;
  MinAccum<INT> @depth;
  OrAccum @visited;
  SetAccum<VERTEX<Person>> @@reached;
  INT hop = 0;

  Frontier = {src};
  Frontier = SELECT s FROM Frontier:s POST-ACCUM s.@visited += TRUE, s.@depth += 0;

  WHILE Frontier.size() > 0 AND hop < max_hops DO
    hop = hop + 1;
    Frontier = SELECT t FROM Frontier:s -(KNOWS:e)-> Person:t
               WHERE t.@visited == FALSE AND (s == src OR s.kind == "user")
               ACCUM t.@parents += s, @@reached += t
               POST-ACCUM t.@visited += TRUE, t.@depth += hop;
  END;

  Reached = {@@reached};
  PRINT Reached[Reached.@parents AS parents, Reached.@depth AS depth];
}
INSTALL QUERY warm_paths
`.trim();
}

type TgVertexOut = { v_id: string; attributes: { parents?: string[]; depth?: number } };

export async function tgReachable(src: NodeId, maxHops: number): Promise<Reach> {
  const body = await restpp(`/query/${encodeURIComponent(tgGraph())}/warm_paths?src=${encodeURIComponent(src)}&max_hops=${maxHops}`, { method: "GET", timeoutMs: 4000 });
  const results = (body?.results ?? []) as { Reached?: TgVertexOut[] }[];
  const reached = results.find((r) => r.Reached)?.Reached ?? [];
  const reach: Reach = new Map([[src, { depth: 0, parents: [] }]]);
  for (const v of reached) {
    reach.set(v.v_id, { depth: Number(v.attributes.depth ?? 0), parents: (v.attributes.parents ?? []).map(String) });
  }
  return reach;
}

/** Upsert vertices + edges in batches. */
export async function tgUpsert(nodes: GraphSnapshot["nodes"], edges: Edge[]) {
  const G = encodeURIComponent(tgGraph());
  const chunk = <T,>(arr: T[], n: number) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
  for (const part of chunk(nodes, 500)) {
    const Person: Record<string, Record<string, { value: string }>> = {};
    for (const n of part) {
      Person[n.id] = { kind: { value: n.kind }, name: { value: n.name ?? "" }, company: { value: n.company ?? "" }, role: { value: n.role ?? "" } };
    }
    await restpp(`/graph/${G}`, { method: "POST", body: JSON.stringify({ vertices: { Person } }) });
  }
  for (const part of chunk(edges, 500)) {
    const Person: Record<string, { KNOWS: { Person: Record<string, { strength: { value: number }; source: { value: string } }> } }> = {};
    for (const e of part) {
      Person[e.a] ??= { KNOWS: { Person: {} } };
      Person[e.a].KNOWS.Person[e.b] = { strength: { value: e.strength }, source: { value: e.source } };
    }
    await restpp(`/graph/${G}`, { method: "POST", body: JSON.stringify({ edges: { Person } }) });
  }
}

export async function tgDeleteEdge(a: NodeId, b: NodeId) {
  const G = encodeURIComponent(tgGraph());
  await restpp(`/graph/${G}/edges/Person/${encodeURIComponent(a)}/KNOWS/Person/${encodeURIComponent(b)}`, { method: "DELETE" });
}

export async function tgDeleteVertex(id: NodeId) {
  const G = encodeURIComponent(tgGraph());
  await restpp(`/graph/${G}/vertices/Person/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function tgClearAll() {
  const G = encodeURIComponent(tgGraph());
  await restpp(`/graph/${G}/delete_by_type/vertices/Person`, { method: "DELETE" });
}

export async function tgPing() {
  const r = await fetchJson(`${host()}/restpp/echo`, { headers: { Authorization: `Bearer ${await getToken()}` }, timeoutMs: 8000 });
  return r.ok;
}
