// Test de bout en bout contre un serveur lancé : SYNC_URL=http://127.0.0.1:8787 deno task test
const BASE = Deno.env.get("SYNC_URL") ?? "http://127.0.0.1:8787";

const b64u = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const hid = b64u(crypto.getRandomValues(new Uint8Array(16)));
const token = b64u(crypto.getRandomValues(new Uint8Array(32)));
const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

let ok = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (!cond) {
    console.error(`✗ ${name}`, extra ?? "");
    Deno.exit(1);
  }
  ok++;
  console.log(`✓ ${name}`);
}

const call = (path: string, init?: RequestInit) => fetch(`${BASE}${path}`, init).then(async (r) => ({ status: r.status, body: await r.json() }));

check("health", (await call("/health")).body.ok === true);
check("pull sans foyer → 404", (await call(`/h/${hid}/pull`, { headers: auth })).status === 404);
check("création du foyer", (await call(`/h/${hid}/register`, { method: "POST", headers: auth })).body.ok === true);
check("création idempotente", (await call(`/h/${hid}/register`, { method: "POST", headers: auth })).body.ok === true);

const bad = { Authorization: `Bearer ${b64u(crypto.getRandomValues(new Uint8Array(32)))}` };
check("mauvais jeton → 403", (await call(`/h/${hid}/pull`, { headers: bad })).status === 403);
check("reprise du foyer par un autre jeton → 409", (await call(`/h/${hid}/register`, { method: "POST", headers: bad })).status === 409);

// WebSocket : un autre appareil doit être prévenu.
const ws = new WebSocket(`${BASE.replace(/^http/, "ws")}/h/${hid}/ws?token=${token}`);
const notified = new Promise<number>((res) => {
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.type === "seq" && m.seq > 0) res(m.seq);
  };
});
await new Promise((r) => (ws.onopen = r));

const p1 = await call(`/h/${hid}/push`, {
  method: "POST",
  headers: auth,
  body: JSON.stringify({ records: [{ id: "events:a", updatedAt: 1000, blob: "chiffré-v1" }, { id: "todos:b", updatedAt: 1000, blob: "x" }] }),
});
check("envoi de 2 enregistrements", p1.body.accepted === 2 && p1.body.seq === 2, p1.body);
check("notification WebSocket reçue", (await Promise.race([notified, new Promise((r) => setTimeout(() => r(-1), 3000))])) === 2);

const older = await call(`/h/${hid}/push`, { method: "POST", headers: auth, body: JSON.stringify({ records: [{ id: "events:a", updatedAt: 500, blob: "ancien" }] }) });
check("version plus ancienne ignorée (dernier écrit gagne)", older.body.accepted === 0);

const newer = await call(`/h/${hid}/push`, { method: "POST", headers: auth, body: JSON.stringify({ records: [{ id: "events:a", updatedAt: 2000, blob: "chiffré-v2" }, { id: "todos:b", updatedAt: 2000, deleted: true }] }) });
check("mise à jour + suppression acceptées", newer.body.accepted === 2 && newer.body.seq === 4, newer.body);

const all = await call(`/h/${hid}/pull?since=0`, { headers: auth });
const a = all.body.records.find((r: { id: string }) => r.id === "events:a");
const b = all.body.records.find((r: { id: string }) => r.id === "todos:b");
check("lecture complète : version la plus récente", all.body.records.length === 2 && a.blob === "chiffré-v2" && b.deleted === true, all.body);

const delta = await call(`/h/${hid}/pull?since=3`, { headers: auth });
check("lecture incrémentale depuis seq 3", delta.body.records.length === 1 && delta.body.records[0].id === "todos:b" && delta.body.more === false, delta.body);

check("enregistrement invalide refusé", (await call(`/h/${hid}/push`, { method: "POST", headers: auth, body: JSON.stringify({ records: [{ id: "", updatedAt: 1 }] }) })).status === 400);
check("blob trop gros refusé", (await call(`/h/${hid}/push`, { method: "POST", headers: auth, body: JSON.stringify({ records: [{ id: "x", updatedAt: 1, blob: "a".repeat(70_000) }] }) })).status === 400);

ws.close();
const del = await call(`/h/${hid}`, { method: "DELETE", headers: auth });
check("suppression du foyer", del.body.ok === true && del.body.deleted >= 3, del.body);
check("foyer supprimé → 404", (await call(`/h/${hid}/pull`, { headers: auth })).status === 404);

console.log(`\n${ok} vérifications réussies.`);
