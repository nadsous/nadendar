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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![save_backup, load_backup])
        .run(tauri::generate_context!())
        .expect("erreur au lancement de Nadendar");
}
