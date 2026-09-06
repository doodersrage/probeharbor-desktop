import { invoke } from "@tauri-apps/api/core";

const STORAGE_KEY = "tt-desktop-kiosk";

export function isKioskStored(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export async function setKioskMode(enabled: boolean): Promise<void> {
  localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
  await invoke("set_kiosk_mode", { enabled });
}
