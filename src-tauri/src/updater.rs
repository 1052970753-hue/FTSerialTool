use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

use crate::AppState;

/// Update settings stored in shared state
#[derive(Clone, Serialize, Deserialize)]
pub struct UpdateSettings {
    pub repository: String,
    pub mirror_url: String,
    pub auto_check: bool,
}

impl Default for UpdateSettings {
    fn default() -> Self {
        Self {
            repository: "https://github.com/1052970753-hue/FTSerialTool".to_string(),
            mirror_url: String::new(),
            auto_check: true,
        }
    }
}

#[tauri::command(rename_all = "camelCase")]
pub fn configure_updates(
    app: AppHandle,
    repository: String,
    mirror_url: String,
    auto_check: bool,
) -> Result<UpdateSettings, String> {
    let state = app.state::<AppState>();
    let mut settings = state.update_settings.lock().map_err(|e| e.to_string())?;
    *settings = UpdateSettings {
        repository: repository.trim().to_string(),
        mirror_url: mirror_url.trim().to_string(),
        auto_check,
    };
    Ok(settings.clone())
}

/// 检查更新 — 由前端 JS 直接发 HTTP，这里只返回配置
#[tauri::command]
pub fn get_update_config(app: AppHandle) -> Result<UpdateSettings, String> {
    let state = app.state::<AppState>();
    let settings = state.update_settings.lock().map_err(|e| e.to_string())?;
    Ok(settings.clone())
}

/// 获取当前版本号
#[tauri::command]
pub fn get_app_version(app: AppHandle) -> String {
    app.package_info().version.to_string()
}

/// 保存下载的文件到 Downloads 目录（覆盖已有文件）
#[tauri::command]
pub fn save_update_file(app: AppHandle, filename: String, data: Vec<u8>) -> Result<String, String> {
    let downloads_dir = app
        .path()
        .download_dir()
        .map_err(|_| "无法获取下载目录")?;
    let safe_name = filename
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '.' || *c == '-' || *c == '_')
        .collect::<String>();
    let target = downloads_dir.join(&safe_name);
    // 如果文件已存在且被占用，先尝试删除
    if target.exists() {
        let _ = fs::remove_file(&target);
    }
    let mut file = fs::File::create(&target).map_err(|e| format!("创建文件失败: {}", e))?;
    file.write_all(&data).map_err(|e| format!("写入文件失败: {}", e))?;
    Ok(target.to_string_lossy().to_string())
}

/// 打开下载文件夹
#[tauri::command]
pub fn open_downloads_folder(app: AppHandle) -> Result<(), String> {
    let downloads_dir = app
        .path()
        .download_dir()
        .map_err(|_| "无法获取下载目录")?;
    opener::open(&downloads_dir).map_err(|e| format!("打开文件夹失败: {}", e))?;
    Ok(())
}

/// 安装更新：打开下载文件夹
#[tauri::command]
pub async fn install_update(app: AppHandle) -> Result<bool, String> {
    let window = app.get_webview_window("main");
    if let Some(ref w) = window {
        let _ = w.eval("renderUpdateProgress({state:'ready',message:'新版本已下载到下载文件夹，请关闭当前程序后运行新版本'})");
    }

    let downloads_dir = app
        .path()
        .download_dir()
        .map_err(|_| "无法获取下载目录")?;
    opener::open(&downloads_dir).map_err(|e| format!("打开文件夹失败: {}", e))?;

    Ok(true)
}
