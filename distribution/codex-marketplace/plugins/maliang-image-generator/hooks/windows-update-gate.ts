import { readFile } from "node:fs/promises";
import path from "node:path";

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const FAILURE_RETRY_INTERVAL_MS = 15 * 60 * 1000;

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function readJson(filePath: string) {
  return JSON.parse(await readFile(filePath, "utf8")) as unknown;
}

export async function shouldRunPowerShell(options?: { environmentMode?: string; pluginData?: string }) {
  const pluginDataValue = String(options?.pluginData ?? process.env.PLUGIN_DATA ?? "").trim();
  if (!pluginDataValue) return true;
  const pluginData = path.resolve(pluginDataValue);
  const environmentMode = String(options?.environmentMode ?? process.env.MALIANG_PLUGIN_UPDATE_MODE ?? "")
    .trim()
    .toLowerCase();
  if (environmentMode === "off") return false;
  if (environmentMode && environmentMode !== "auto" && environmentMode !== "notify") return true;
  if (!environmentMode) {
    try {
      const settings = await readJson(path.join(pluginData, "update-settings.json"));
      if (!isObject(settings) || !["auto", "notify", "off"].includes(String(settings.mode))) return true;
      if (settings.mode === "off") return false;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") return true;
    }
  }
  try {
    const state = await readJson(path.join(pluginData, "update-state.json"));
    if (!isObject(state) || state.schemaVersion !== 1 || state.blockedReason) return true;
    const failed = Boolean(state.lastError);
    const timestamp = failed && typeof state.lastErrorAt === "string"
      ? state.lastErrorAt
      : state.lastCheckAt;
    if (typeof timestamp !== "string") return true;
    const checkedAt = Date.parse(timestamp);
    const age = Date.now() - checkedAt;
    const interval = failed ? FAILURE_RETRY_INTERVAL_MS : CHECK_INTERVAL_MS;
    return !Number.isFinite(checkedAt) || age < 0 || age >= interval;
  } catch (error) {
    void error;
    return true;
  }
}

if (import.meta.main) process.exit(await shouldRunPowerShell() ? 20 : 0);
