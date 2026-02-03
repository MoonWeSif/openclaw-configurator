import { execSync } from "node:child_process";

export interface OpenclawModel {
  key: string;
  name: string;
  input: string;
  contextWindow: number;
  local: boolean;
  available: boolean;
  tags: string[];
  missing: boolean;
}

export interface OpenclawModelsResult {
  count: number;
  models: OpenclawModel[];
}

export interface ProviderConfig {
  baseUrl: string;
  models: string[];
}

const SUPPORTED_PROVIDERS = ["openai", "anthropic"] as const;
export type SupportedProvider = (typeof SUPPORTED_PROVIDERS)[number];

export function isSupportedProvider(key: string): SupportedProvider | null {
  for (const provider of SUPPORTED_PROVIDERS) {
    if (key.startsWith(`${provider}/`)) {
      return provider;
    }
  }
  return null;
}

export function fetchModels(): OpenclawModelsResult {
  const result = execSync("openclaw models list --all --json", {
    encoding: "utf-8",
  });
  return JSON.parse(result) as OpenclawModelsResult;
}

export function filterSupportedModels(
  models: OpenclawModel[]
): OpenclawModel[] {
  return models.filter((m) => isSupportedProvider(m.key) !== null);
}

export function setProviderConfig(
  provider: SupportedProvider,
  config: ProviderConfig
): void {
  const json = JSON.stringify(config);
  execSync(`openclaw config set models.providers.${provider} '${json}'`, {
    encoding: "utf-8",
  });
}
