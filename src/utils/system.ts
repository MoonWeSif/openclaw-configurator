import { spawnSync } from "node:child_process";

export function which(command: string): string | null {
  const result = spawnSync("which", [command], { encoding: "utf-8" });
  if (result.status !== 0) {
    return null;
  }
  return result.stdout.trim() || null;
}
