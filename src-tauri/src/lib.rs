use std::fs;
use tauri::Manager;

/// Écrit une sauvegarde JSON dans le dossier de données de l'application
/// (en plus du stockage du webview) et renvoie son chemin.
#[tauri::command]
fn save_backup(app: tauri::AppHandle, json: String) -> Result<String, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join("nadendar-backup.json");
    fs::write(&path, json).map_err(|e| e.to_string())?;
    Ok(path.display().to_string())
}

/// Relit la dernière sauvegarde, si elle existe.
#[tauri::command]
fn load_backup(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let path = dir.join("nadendar-backup.json");
    if !path.exists() {
        return Ok(None);
    }
    fs::read_to_string(path).map(Some).map_err(|e| e.to_string())
}

/// Enregistre un fichier exporté (PDF…) dans Téléchargements (ou Documents à défaut).
#[tauri::command]
fn save_export(app: tauri::AppHandle, request: tauri::ipc::Request<'_>) -> Result<String, String> {
    // Corps binaire brut (pas de JSON) ; le nom du fichier arrive dans un en-tête.
    let tauri::ipc::InvokeBody::Raw(data) = request.body() else {
        return Err("corps binaire attendu".into());
    };
    let name = request
        .headers()
        .get("x-file-name")
        .and_then(|v| v.to_str().ok())
        .map(|v| percent_decode(v))
        .unwrap_or_else(|| "nadendar.pdf".into());
    let path = app.path();
    let dir = path
        .download_dir()
        .or_else(|_| path.document_dir())
        .or_else(|_| path.app_data_dir())
        .map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    // Pas de séparateur de chemin dans le nom proposé par l'interface.
    let safe: String = name
        .chars()
        .map(|c| if matches!(c, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|') { '-' } else { c })
        .collect();
    let file = dir.join(safe);
    fs::write(&file, data).map_err(|e| e.to_string())?;
    Ok(file.display().to_string())
}

/// Décode un nom encodé avec encodeURIComponent (les en-têtes HTTP sont en ASCII).
fn percent_decode(s: &str) -> String {
    let b = s.as_bytes();
    let mut out = Vec::with_capacity(b.len());
    let mut i = 0;
    while i < b.len() {
        if b[i] == b'%' && i + 2 < b.len() {
            if let Ok(v) = u8::from_str_radix(&s[i + 1..i + 3], 16) {
                out.push(v);
                i += 3;
                continue;
            }
        }
        out.push(b[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

/// Télécharge un agenda iCal (lien secret Google, publication Outlook, iCloud…).
/// Fait côté Rust : depuis le webview, ces serveurs refusent les requêtes (CORS).
#[tauri::command]
async fn fetch_ics(url: String) -> Result<String, String> {
    let url = url.trim().replacen("webcal://", "https://", 1);
    if !(url.starts_with("https://") || url.starts_with("http://")) {
        return Err("lien invalide : il doit commencer par https://".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        let resp = ureq::get(&url)
            .timeout(std::time::Duration::from_secs(25))
            .set("User-Agent", "Nadendar/0.1")
            .call()
            .map_err(|e| e.to_string())?;
        resp.into_string().map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![save_backup, load_backup, save_export, fetch_ics])
        .run(tauri::generate_context!())
        .expect("erreur au lancement de Nadendar");
}
