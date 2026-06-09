use std::io::{Read, Write};
use std::net::TcpStream;
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

use crate::AppState;

/// TCP socket state
pub struct TcpSerialState {
    stream: Mutex<Option<TcpStream>>,
}

impl TcpSerialState {
    pub fn new() -> Self {
        Self {
            stream: Mutex::new(None),
        }
    }
}

#[tauri::command]
pub fn tcp_connect(app: AppHandle, host: String, port: u16) -> Result<bool, String> {
    let state = app.state::<AppState>();
    let mut guard = state.tcp_state.stream.lock().map_err(|e| e.to_string())?;

    // Close existing connection
    *guard = None;

    let addr = format!("{}:{}", host, port);
    let stream = TcpStream::connect_timeout(
        &addr.parse().map_err(|_| "无效的地址")?,
        Duration::from_secs(5),
    )
    .map_err(|e| format!("无法连接到 {}: {}", addr, e))?;

    stream
        .set_read_timeout(Some(Duration::from_millis(100)))
        .map_err(|e| e.to_string())?;

    let mut stream_clone = stream.try_clone().map_err(|e| e.to_string())?;
    *guard = Some(stream);

    // Spawn background reading thread
    let app_handle = app.clone();
    std::thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match stream_clone.read(&mut buf) {
                Ok(n) if n > 0 => {
                    let data: Vec<u8> = buf[..n].to_vec();
                    let _ = app_handle.emit("tcp-data", data);
                }
                Ok(0) => {
                    let _ = app_handle.emit("tcp-close", ());
                    break;
                }
                Ok(_) => {}
                Err(ref e)
                    if e.kind() == std::io::ErrorKind::TimedOut
                        || e.kind() == std::io::ErrorKind::WouldBlock =>
                {
                    continue;
                }
                Err(ref e)
                    if e.kind() == std::io::ErrorKind::ConnectionAborted
                        || e.kind() == std::io::ErrorKind::BrokenPipe =>
                {
                    let _ = app_handle.emit("tcp-close", ());
                    break;
                }
                Err(e) => {
                    let _ = app_handle.emit("tcp-error", e.to_string());
                    break;
                }
            }
        }
    });

    Ok(true)
}

#[tauri::command]
pub fn tcp_write(app: AppHandle, bytes: Vec<u8>) -> Result<bool, String> {
    let state = app.state::<AppState>();
    let mut guard = state.tcp_state.stream.lock().map_err(|e| e.to_string())?;
    let stream = guard.as_mut().ok_or("网络串口未连接")?;

    stream
        .write_all(&bytes)
        .map_err(|e| format!("发送失败: {}", e))?;
    stream.flush().map_err(|e| format!("刷新失败: {}", e))?;
    Ok(true)
}

#[tauri::command]
pub fn tcp_disconnect(app: AppHandle) -> Result<bool, String> {
    let state = app.state::<AppState>();
    let mut guard = state.tcp_state.stream.lock().map_err(|e| e.to_string())?;
    *guard = None;
    Ok(true)
}
