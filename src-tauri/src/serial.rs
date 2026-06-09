use serde::Serialize;
use serialport::SerialPort;
use std::io::Read;
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

use crate::AppState;

/// USB serial port state
pub struct UsbSerialState {
    port: Mutex<Option<Box<dyn SerialPort>>>,
}

impl UsbSerialState {
    pub fn new() -> Self {
        Self {
            port: Mutex::new(None),
        }
    }
}

#[derive(Serialize, Clone)]
pub struct PortInfo {
    path: String,
    label: String,
    manufacturer: String,
    friendly_name: String,
    pnp_id: String,
    vendor_id: String,
    product_id: String,
}

#[tauri::command]
pub fn usb_list() -> Result<Vec<PortInfo>, String> {
    let ports = serialport::available_ports().map_err(|e| e.to_string())?;
    Ok(ports
        .iter()
        .map(|port| {
            let name = match &port.port_type {
                serialport::SerialPortType::UsbPort(info) => {
                    info.product.clone().unwrap_or_else(|| {
                        info.manufacturer
                            .clone()
                            .unwrap_or_else(|| "USB串口".to_string())
                    })
                }
                _ => port.port_name.clone(),
            };
            let manufacturer = match &port.port_type {
                serialport::SerialPortType::UsbPort(info) => {
                    info.manufacturer.clone().unwrap_or_default()
                }
                _ => String::new(),
            };
            let (pnp_id, vendor_id, product_id) = match &port.port_type {
                serialport::SerialPortType::UsbPort(info) => (
                    info.serial_number.clone().unwrap_or_default(),
                    format!("{:04x}", info.vid),
                    format!("{:04x}", info.pid),
                ),
                _ => (String::new(), String::new(), String::new()),
            };
            PortInfo {
                path: port.port_name.clone(),
                label: format!("{} - {}", port.port_name, name),
                manufacturer,
                friendly_name: name,
                pnp_id,
                vendor_id,
                product_id,
            }
        })
        .collect())
}

#[tauri::command]
pub fn usb_connect(app: AppHandle, path: String, baud_rate: u32) -> Result<bool, String> {
    let state = app.state::<AppState>();
    let mut guard = state.usb_state.port.lock().map_err(|e| e.to_string())?;

    // Close existing port if any
    if guard.is_some() {
        *guard = None;
    }

    let port = serialport::new(&path, baud_rate)
        .timeout(Duration::from_millis(100))
        .open()
        .map_err(|e| format!("无法打开串口 {}: {}", path, e))?;

    let mut port_clone = port.try_clone().map_err(|e| e.to_string())?;
    *guard = Some(port);

    // Spawn a background thread to read data
    let app_handle = app.clone();
    std::thread::spawn(move || {
        let mut buf = [0u8; 1024];
        loop {
            match port_clone.read(&mut buf) {
                Ok(n) if n > 0 => {
                    let data: Vec<u8> = buf[..n].to_vec();
                    let _ = app_handle.emit("usb-data", data);
                }
                Ok(_) => {}
                Err(ref e) if e.kind() == std::io::ErrorKind::TimedOut => continue,
                Err(ref e) if e.kind() == std::io::ErrorKind::BrokenPipe => {
                    let _ = app_handle.emit("usb-close", ());
                    break;
                }
                Err(_) => {
                    let _ = app_handle.emit("usb-error", "USB串口读取错误");
                    break;
                }
            }
        }
    });

    Ok(true)
}

#[tauri::command]
pub fn usb_write(app: AppHandle, bytes: Vec<u8>) -> Result<bool, String> {
    use std::io::Write;
    let state = app.state::<AppState>();
    let mut guard = state.usb_state.port.lock().map_err(|e| e.to_string())?;
    let port = guard.as_mut().ok_or("USB串口未连接")?;

    port.write_all(&bytes)
        .map_err(|e| format!("写入失败: {}", e))?;
    port.flush().map_err(|e| format!("刷新失败: {}", e))?;
    Ok(true)
}

#[tauri::command]
pub fn usb_disconnect(app: AppHandle) -> Result<bool, String> {
    let state = app.state::<AppState>();
    let mut guard = state.usb_state.port.lock().map_err(|e| e.to_string())?;
    *guard = None;
    Ok(true)
}
