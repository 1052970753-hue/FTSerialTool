use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{Read, Write};
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

/// 安装更新：打开下载文件夹（保留作为备用）
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

/// 自动更新：解压 zip → 替换当前 exe → 重启
#[tauri::command(rename_all = "camelCase")]
pub async fn apply_update(app: AppHandle, zip_path: String) -> Result<bool, String> {
    let window = app.get_webview_window("main");

    // 通知前端正在更新
    if let Some(ref w) = window {
        let _ = w.eval("renderUpdateProgress({state:'installing',message:'正在准备更新...'})");
    }

    let current_exe = std::env::current_exe().map_err(|e| format!("获取当前程序路径失败: {}", e))?;
    let zip_path = PathBuf::from(&zip_path);

    if !zip_path.exists() {
        return Err(format!("更新文件不存在: {}", zip_path.display()));
    }

    // 创建临时目录
    let temp_dir = std::env::temp_dir().join("ft-update");
    if temp_dir.exists() {
        fs::remove_dir_all(&temp_dir).map_err(|e| format!("清理临时目录失败: {}", e))?;
    }
    fs::create_dir_all(&temp_dir).map_err(|e| format!("创建临时目录失败: {}", e))?;

    // 解压 zip
    if let Some(ref w) = window {
        let _ = w.eval("renderUpdateProgress({state:'installing',message:'正在解压更新文件...'})");
    }

    let zip_file = fs::File::open(&zip_path).map_err(|e| format!("打开更新文件失败: {}", e))?;
    let mut archive = zip::ZipArchive::new(zip_file).map_err(|e| format!("解析zip失败: {}", e))?;

    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| format!("读取zip条目失败: {}", e))?;
        let outpath = temp_dir.join(file.name());

        if file.is_dir() {
            fs::create_dir_all(&outpath).map_err(|e| format!("创建目录失败: {}", e))?;
        } else {
            if let Some(parent) = outpath.parent() {
                fs::create_dir_all(parent).map_err(|e| format!("创建父目录失败: {}", e))?;
            }
            let mut outfile = fs::File::create(&outpath).map_err(|e| format!("创建文件失败: {}", e))?;
            let mut buf = Vec::new();
            file.read_to_end(&mut buf).map_err(|e| format!("读取文件失败: {}", e))?;
            outfile.write_all(&buf).map_err(|e| format!("写入文件失败: {}", e))?;
        }
    }

    // 查找解压出来的 exe
    let new_exe = fs::read_dir(&temp_dir)
        .map_err(|e| format!("读取临时目录失败: {}", e))?
        .filter_map(|e| e.ok())
        .find(|e| {
            e.path().extension().map_or(false, |ext| ext == "exe")
        })
        .ok_or("更新包中未找到 exe 文件")?;

    let new_exe_path = new_exe.path();

    // 通知前端
    if let Some(ref w) = window {
        let _ = w.eval("renderUpdateProgress({state:'installing',message:'正在替换文件，应用将自动重启...'})");
    }

    // 先把新 exe 复制到当前 exe 同目录下的临时文件名
    let exe_dir = current_exe.parent().unwrap_or(&temp_dir);
    let temp_new = exe_dir.join("__update_new.exe");
    let _ = fs::copy(&new_exe_path, &temp_new);

    // 创建批处理脚本：重命名当前 exe（不删除），替换，启动，清理
    let bat_path = exe_dir.join("__update.bat");
    let current_str = current_exe.to_string_lossy().to_string();
    let temp_new_str = temp_new.to_string_lossy().to_string();
    let old_str = format!("{}.old", current_str);
    let temp_dir_str = temp_dir.to_string_lossy().to_string();

    let bat_content = format!(
        "@echo off\r\n\
         ping -n 3 127.0.0.1 >nul\r\n\
         :retry\r\n\
         ren \"{current}\" *.old >nul 2>&1\r\n\
         if exist \"{current}\" goto retry\r\n\
         move /y \"{temp_new}\" \"{current}\" >nul\r\n\
         start \"\" \"{current}\"\r\n\
         ping -n 2 127.0.0.1 >nul\r\n\
         del \"{old}\" >nul 2>&1\r\n\
         rd /s /q \"{temp}\" >nul 2>&1\r\n\
         del \"%~f0\" >nul 2>&1\r\n",
        current = current_str,
        temp_new = temp_new_str,
        old = old_str,
        temp = temp_dir_str,
    );

    fs::File::create(&bat_path)
        .map_err(|e| format!("创建更新脚本失败: {}", e))?
        .write_all(bat_content.as_bytes())
        .map_err(|e| format!("写入更新脚本失败: {}", e))?;

    // 启动批处理脚本（同一个窗口，不用 start）
    std::process::Command::new("cmd")
        .args(["/C", bat_path.to_string_lossy().as_ref()])
        .spawn()
        .map_err(|e| format!("启动更新脚本失败: {}", e))?;

    // 退出当前应用
    std::process::exit(0);
}
