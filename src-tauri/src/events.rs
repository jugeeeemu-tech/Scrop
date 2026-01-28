use tauri::{AppHandle, Emitter};

use crate::packet::CapturedPacket;

pub const EVENT_CAPTURED: &str = "packet:captured";

pub fn emit_captured(app: &AppHandle, data: &CapturedPacket) -> Result<(), tauri::Error> {
    app.emit(EVENT_CAPTURED, data)
}
