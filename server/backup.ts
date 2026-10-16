// Sauvegarde nocturne : toute la base Deno KV en NDJSON compressé, 14 jours gardés.
// Les données sont déjà chiffrées par les appareils : la sauvegarde l'est donc aussi.
//
//   BACKUP_DIR=/var/backups/nadendar-sync deno task backup

const kv = await Deno.openKv(Deno.env.get("DENO_KV_PATH") ?? "sync.db");
const dir = Deno.env.get("BACKUP_DIR") ?? "./backups";
const keep = Number(Deno.env.get("BACKUP_KEEP_DAYS") ?? 14);
await Deno.mkdir(dir, { recursive: true });

const day = new Date().toISOString().slice(0, 10);
const path = `${dir}/nadendar-sync-${day}.ndjson.gz`;
const file = await Deno.open(path, { write: true, create: true, truncate: true });
const gz = new CompressionStream("gzip");
const done = gz.readable.pipeTo(file.writable);
const w = gz.writable.getWriter();
const enc = new TextEncoder();

let n = 0;
for await (const e of kv.list({ prefix: [] })) {
  await w.write(enc.encode(JSON.stringify({ key: e.key, value: e.value }) + "\n"));
  n++;
}
await w.close();
await done;

// Rotation : on supprime les sauvegardes plus vieilles que `keep` jours.
const limit = Date.now() - keep * 86400_000;
for await (const f of Deno.readDir(dir)) {
  const m = f.name.match(/^nadendar-sync-(\d{4}-\d{2}-\d{2})\.ndjson\.gz$/);
  if (m && Date.parse(m[1]) < limit) await Deno.remove(`${dir}/${f.name}`);
}
console.log(`${n} entrées sauvegardées dans ${path}`);
