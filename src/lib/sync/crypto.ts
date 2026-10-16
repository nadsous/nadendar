// Chiffrement de bout en bout du foyer : AES-GCM 256 bits, clé partagée par le code
// d'invitation. Le serveur ne reçoit que des blobs chiffrés et l'empreinte d'un jeton dérivé.

export const b64u = (b: Uint8Array) =>
  btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export function unb64u(s: string): Uint8Array {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  return Uint8Array.from(atob(pad), (c) => c.charCodeAt(0));
}

export const randomId = (bytes: number) => b64u(crypto.getRandomValues(new Uint8Array(bytes)));

export async function importKey(raw: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", unb64u(raw) as BufferSource, "AES-GCM", false, ["encrypt", "decrypt"]);
}

/** Jeton d'accès au serveur, dérivé de la clé (le serveur n'en garde que l'empreinte). */
export async function authToken(raw: string): Promise<string> {
  const data = new Uint8Array([...unb64u(raw), ...new TextEncoder().encode("nadendar-auth-v1")]);
  return b64u(new Uint8Array(await crypto.subtle.digest("SHA-256", data)));
}

/** Objet → « iv.chiffré » en base64url. */
export async function seal(key: CryptoKey, value: unknown): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify(value));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data));
  return `${b64u(iv)}.${b64u(ct)}`;
}

export async function open<T>(key: CryptoKey, blob: string): Promise<T> {
  const [iv, ct] = blob.split(".");
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64u(iv) as BufferSource }, key, unb64u(ct) as BufferSource);
  return JSON.parse(new TextDecoder().decode(pt)) as T;
}

// ── Code d'invitation : NDR1.<foyer>.<clé>.<nom>[.<serveur>] ─────────────────

export interface Invite {
  hid: string;
  key: string;
  name: string;
  server?: string;
}

export const DEFAULT_SERVER = "https://nads.site/sync";

export function encodeInvite(i: Invite): string {
  const parts = ["NDR1", i.hid, i.key, b64u(new TextEncoder().encode(i.name))];
  if (i.server && i.server !== DEFAULT_SERVER) parts.push(b64u(new TextEncoder().encode(i.server)));
  return parts.join(".");
}

export function decodeInvite(code: string): Invite | null {
  const m = code.trim().match(/NDR1\.([A-Za-z0-9_-]{22})\.([A-Za-z0-9_-]{43})\.([A-Za-z0-9_-]*)(?:\.([A-Za-z0-9_-]+))?/);
  if (!m) return null;
  try {
    const dec = (s: string) => new TextDecoder().decode(unb64u(s));
    return { hid: m[1], key: m[2], name: m[3] ? dec(m[3]) : "Foyer", server: m[4] ? dec(m[4]) : undefined };
  } catch {
    return null;
  }
}
