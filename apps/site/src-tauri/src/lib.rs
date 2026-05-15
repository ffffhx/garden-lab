use std::{env, fs, path::PathBuf};

const PET_SNAPSHOT_RELATIVE_PATH: &[&str] = &["public", "pet", "stats.json"];

fn local_pet_snapshot_path() -> PathBuf {
    if let Ok(path) = env::var("BLOG_PET_STATS_PATH") {
        return PathBuf::from(path);
    }

    if let Ok(repo_dir) = env::var("BLOG_PET_REPO_DIR") {
        return PET_SNAPSHOT_RELATIVE_PATH
            .iter()
            .fold(PathBuf::from(repo_dir), |path, segment| path.join(segment));
    }

    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let repo_dir = manifest_dir.parent().unwrap_or(&manifest_dir);

    PET_SNAPSHOT_RELATIVE_PATH
        .iter()
        .fold(repo_dir.to_path_buf(), |path, segment| path.join(segment))
}

#[tauri::command]
fn read_local_pet_snapshot() -> Result<String, String> {
    let path = local_pet_snapshot_path();

    fs::read_to_string(&path)
        .map_err(|error| format!("failed to read {}: {error}", path.display()))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![read_local_pet_snapshot])
        .run(tauri::generate_context!())
        .expect("error while running Garden Lab desktop pet");
}
