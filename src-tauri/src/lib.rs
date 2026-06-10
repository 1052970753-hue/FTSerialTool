mod serial;
mod tcp;
mod updater;

use std::sync::Mutex;
use tauri::menu::*;
use tauri::Manager;

/// Shared application state
pub struct AppState {
    pub update_settings: Mutex<updater::UpdateSettings>,
    pub usb_state: serial::UsbSerialState,
    pub tcp_state: tcp::TcpSerialState,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(AppState {
            update_settings: Mutex::new(updater::UpdateSettings::default()),
            usb_state: serial::UsbSerialState::new(),
            tcp_state: tcp::TcpSerialState::new(),
        })
        .invoke_handler(tauri::generate_handler![
            serial::usb_list,
            serial::usb_connect,
            serial::usb_write,
            serial::usb_disconnect,
            tcp::tcp_connect,
            tcp::tcp_write,
            tcp::tcp_disconnect,
            updater::configure_updates,
            updater::get_update_config,
            updater::get_app_version,
            updater::save_update_file,
            updater::open_downloads_folder,
            updater::install_update,
            updater::apply_update,
            app_get_version,
            app_set_language,
        ])
        .setup(|app| {
            setup_menu(app)?;
            Ok(())
        })
        .on_menu_event(|app, event| {
            let id = event.id().as_ref();
            // 用 eval 直接调用前端函数，绕过事件系统
            if let Some(w) = app.get_webview_window("main") {
                let js = match id {
                    // 编辑
                    "protocol_analysis" => "openProtocolAnalysis()",
                    // 视图
                    "view_workbench" => "setAppMode('workbench')",
                    "view_terminal" => "setAppMode('terminal')",
                    "view_general" => "setWorkspaceView('general')",
                    "view_vacuum" => "setWorkspaceView('vacuum')",
                    "view_ecm" => "setWorkspaceView('ecm')",
                    "view_compressor" => "setWorkspaceView('compressor')",
                    "reload" => "location.reload()",
                    // 设置
                    "tool_settings" => "setAppMode('settings')",
                    "lang_zh" => "applyToolLanguage('zh')",
                    "lang_en" => "applyToolLanguage('en')",
                    "lang_ja" => "applyToolLanguage('ja')",
                    "lang_ko" => "applyToolLanguage('ko')",
                    // 帮助
                    "help" => "setAppMode('help')",
                    "check_updates" => "{ saveUpdateSettings(); window.ftApp?.checkUpdates(); }",
                    _ => return,
                };
                let _ = w.eval(js);
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
fn app_get_version(app: tauri::AppHandle) -> String {
    app.package_info().version.to_string()
}

#[tauri::command]
fn app_set_language(_language: String) -> String {
    "ok".to_string()
}

fn setup_menu(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let h = app.handle();

    // ── 文件 ──
    let file = Submenu::with_id(h, "file", "文件", true)?;
    file.append(&PredefinedMenuItem::quit(h, Some("退出"))?)?;

    // ── 编辑 ──
    let edit = Submenu::with_id(h, "edit", "编辑", true)?;
    edit.append_items(&[
        &PredefinedMenuItem::undo(h, Some("撤销"))?,
        &PredefinedMenuItem::redo(h, Some("重做"))?,
        &PredefinedMenuItem::separator(h)?,
        &PredefinedMenuItem::cut(h, Some("剪切"))?,
        &PredefinedMenuItem::copy(h, Some("复制"))?,
        &PredefinedMenuItem::paste(h, Some("粘贴"))?,
        &PredefinedMenuItem::select_all(h, Some("全选"))?,
        &PredefinedMenuItem::separator(h)?,
        &MenuItem::with_id(h, "protocol_analysis", "协议解析", true, None::<&str>)?,
    ])?;

    // ── 视图 ──
    let view = Submenu::with_id(h, "view", "视图", true)?;
    view.append_items(&[
        &MenuItem::with_id(h, "view_workbench", "工作台", true, None::<&str>)?,
        &MenuItem::with_id(h, "view_terminal", "命令行", true, None::<&str>)?,
        &PredefinedMenuItem::separator(h)?,
        &MenuItem::with_id(h, "view_general", "通用", true, None::<&str>)?,
        &MenuItem::with_id(h, "view_vacuum", "吸尘器", true, None::<&str>)?,
        &MenuItem::with_id(h, "view_ecm", "ECM风机", true, None::<&str>)?,
        &MenuItem::with_id(h, "view_compressor", "压缩机", true, None::<&str>)?,
        &PredefinedMenuItem::separator(h)?,
        &MenuItem::with_id(h, "reload", "刷新", true, Some("F5"))?,
        &PredefinedMenuItem::fullscreen(h, Some("全屏"))?,
    ])?;

    // ── 设置 ──
    let settings = Submenu::with_id(h, "settings", "设置", true)?;
    settings.append_items(&[
        &MenuItem::with_id(h, "tool_settings", "工具设置", true, None::<&str>)?,
        &PredefinedMenuItem::separator(h)?,
        &MenuItem::with_id(h, "lang_zh", "中文", true, None::<&str>)?,
        &MenuItem::with_id(h, "lang_en", "English", true, None::<&str>)?,
        &MenuItem::with_id(h, "lang_ja", "日本語", true, None::<&str>)?,
        &MenuItem::with_id(h, "lang_ko", "한국어", true, None::<&str>)?,
    ])?;

    // ── 帮助 ──
    let help = Submenu::with_id(h, "help_menu", "帮助", true)?;
    help.append_items(&[
        &MenuItem::with_id(h, "help", "帮助", true, None::<&str>)?,
        &PredefinedMenuItem::separator(h)?,
        &MenuItem::with_id(h, "check_updates", "检查更新", true, None::<&str>)?,
    ])?;

    let menu = Menu::with_items(h, &[&file, &edit, &view, &settings, &help])?;
    app.set_menu(menu)?;
    Ok(())
}
