import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export function which(command: string): string | null {
  try {
    const result = execSync(`which ${command}`, { encoding: "utf-8" });
    return result.trim() || null;
  } catch {
    return null;
  }
}

export function fileExists(path: string): boolean {
  return existsSync(path);
}

export function getOpenclawConfigPath(): string {
  return join(homedir(), ".openclaw", "openclaw.json");
}
