import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

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

export type ApiType = "openai-completions" | "anthropic-messages";

export interface ProviderConfig {
  baseUrl: string;
  api?: ApiType;
  models: ProviderModelEntry[];
}

export interface ProviderModelEntry {
  id: string;
  name: string;
}

export interface VendorFilter {
  providers: SupportedProvider[];
  models: VendorModel[];
}

interface OpenclawConfig {
  models?: {
    mode?: string;
    providers?: Record<string, ProviderConfig>;
  };
  agents?: {
    defaults?: {
      model?: {
        primary?: string;
      };
      models?: Record<string, Record<string, unknown>>;
    };
  };
  meta?: {
    lastTouchedAt?: string;
  };
  [key: string]: unknown;
}

const SUPPORTED_PROVIDERS = ["openai", "anthropic", "google", "minimax", "zai", "moonshot", "deepseek"] as const;
export type SupportedProvider = (typeof SUPPORTED_PROVIDERS)[number];

export interface VendorModel {
  name: string;
  provider: SupportedProvider;
  api?: ApiType;
}

// 12API supported models
const TWELVE_API_MODELS: VendorModel[] = [
  // Claude models (built-in anthropic provider)
  { name: "claude-haiku-4-5-20251001", provider: "anthropic" },
  { name: "claude-opus-4-5-20251101", provider: "anthropic" },
  { name: "claude-opus-4-6", provider: "anthropic" },
  { name: "claude-sonnet-4-5-20250929", provider: "anthropic" },
  // GPT models (built-in openai provider)
  { name: "gpt-5.1", provider: "openai" },
  { name: "gpt-5.2", provider: "openai" },
  // MiniMax (anthropic-messages)
  { name: "MiniMax-M2.5", provider: "minimax", api: "anthropic-messages" },
  // GLM (anthropic-messages)
  { name: "glm-5", provider: "zai", api: "anthropic-messages" },
  // Kimi (anthropic-messages)
  { name: "kimi-k2.5", provider: "moonshot", api: "anthropic-messages" },
  // DeepSeek (openai-completions)
  { name: "deepseek-v3.2", provider: "deepseek", api: "openai-completions" },
  // Gemini models (built-in google provider)
  { name: "gemini-3-pro-preview", provider: "google" },
  { name: "gemini-3-flash-preview", provider: "google" },
];

export const VENDOR_FILTERS: Record<string, VendorFilter> = {
  "12api": {
    providers: ["openai", "anthropic", "google", "minimax", "zai", "moonshot", "deepseek"],
    models: TWELVE_API_MODELS,
  },
  other: {
    providers: [],
    models: [],
  },
};

function getOpenclawConfigDir(): string {
  return process.env.OPENCLAW_CONFIG_DIR || join(homedir(), ".openclaw");
}

function getOpenclawConfigPath(): string {
  return join(getOpenclawConfigDir(), "openclaw.json");
}

function readOpenclawConfig(): OpenclawConfig {
  const configPath = getOpenclawConfigPath();
  if (!existsSync(configPath)) {
    return {};
  }
  const content = readFileSync(configPath, "utf-8");
  return JSON.parse(content) as OpenclawConfig;
}

function writeOpenclawConfig(config: OpenclawConfig): void {
  const configPath = getOpenclawConfigPath();
  writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
}

export function isSupportedProvider(
  key: string,
  allowedProviders?: SupportedProvider[]
): SupportedProvider | null {
  const providers = allowedProviders ?? SUPPORTED_PROVIDERS;
  for (const provider of providers) {
    if (key.startsWith(`${provider}/`)) {
      return provider;
    }
  }
  return null;
}

export function getModelSuffix(key: string): string {
  const slashIndex = key.indexOf("/");
  return slashIndex >= 0 ? key.slice(slashIndex + 1) : key;
}

/**
 * Find vendor model definition by model key (e.g., "moonshot/kimi-k2.5")
 */
export function findVendorModel(
  vendor: string,
  modelKey: string
): VendorModel | undefined {
  const filter = VENDOR_FILTERS[vendor];
  if (!filter) return undefined;
  const suffix = getModelSuffix(modelKey);
  const provider = isSupportedProvider(modelKey);
  return filter.models.find(
    (m) => m.name === suffix && m.provider === provider
  );
}

export function fetchModels(): OpenclawModelsResult {
  const result = spawnSync("openclaw", ["models", "list", "--all", "--json"], {
    encoding: "utf-8",
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || "Failed to fetch models");
  }
  return JSON.parse(result.stdout) as OpenclawModelsResult;
}

export function filterModelsByVendor(
  models: OpenclawModel[],
  vendor: string
): OpenclawModel[] {
  const filter = VENDOR_FILTERS[vendor];
  if (!filter) {
    return models;
  }

  // If no filters specified (other vendor), return all models
  if (filter.providers.length === 0 && filter.models.length === 0) {
    return models;
  }

  const existingKeys = new Set(models.map((m) => m.key));
  const modelNames = new Set(filter.models.map((m) => m.name));

  const filtered = models.filter((m) => {
    // Check provider prefix
    const provider = isSupportedProvider(m.key, filter.providers);
    if (!provider) {
      return false;
    }

    // If model filter is empty, accept all models from allowed providers
    if (filter.models.length === 0) {
      return true;
    }

    // Check model name suffix
    const modelSuffix = getModelSuffix(m.key);
    return modelNames.has(modelSuffix);
  });

  // Append models defined in vendor filter but missing from openclaw registry
  for (const vm of filter.models) {
    const key = `${vm.provider}/${vm.name}`;
    if (!existingKeys.has(key)) {
      filtered.push({
        key,
        name: vm.name,
        input: "",
        contextWindow: 0,
        local: false,
        available: true,
        tags: [],
        missing: false,
      });
      existingKeys.add(key);
    }
  }

  return filtered;
}

export function setProviderConfig(
  provider: SupportedProvider,
  config: ProviderConfig
): void {
  const openclawConfig = readOpenclawConfig();

  // Ensure models object exists
  if (!openclawConfig.models) {
    openclawConfig.models = {};
  }

  // Set mode to merge
  openclawConfig.models.mode = "merge";

  // Ensure providers object exists
  if (!openclawConfig.models.providers) {
    openclawConfig.models.providers = {};
  }

  // Set provider config
  openclawConfig.models.providers[provider] = config;

  writeOpenclawConfig(openclawConfig);
}

export function setModel(modelKey: string): void {
  const openclawConfig = readOpenclawConfig();

  // Ensure agents.defaults structure exists
  if (!openclawConfig.agents) {
    openclawConfig.agents = {};
  }
  if (!openclawConfig.agents.defaults) {
    openclawConfig.agents.defaults = {};
  }
  if (!openclawConfig.agents.defaults.model) {
    openclawConfig.agents.defaults.model = {};
  }
  if (!openclawConfig.agents.defaults.models) {
    openclawConfig.agents.defaults.models = {};
  }

  // Set primary model
  openclawConfig.agents.defaults.model.primary = modelKey;

  // Ensure model key exists in models
  if (!openclawConfig.agents.defaults.models[modelKey]) {
    openclawConfig.agents.defaults.models[modelKey] = {};
  }

  writeOpenclawConfig(openclawConfig);
}

export function triggerGatewayRestart(): void {
  const openclawConfig = readOpenclawConfig();

  // Ensure meta object exists
  if (!openclawConfig.meta) {
    openclawConfig.meta = {};
  }

  // Update lastTouchedAt to current timestamp
  openclawConfig.meta.lastTouchedAt = new Date().toISOString();

  writeOpenclawConfig(openclawConfig);
}

/**
 * Get configured models from agents.defaults.models
 * Returns array of model keys (e.g., ["openai/gpt-5.2", "anthropic/claude-opus-4-5-20251101"])
 */
export function getConfiguredModels(): string[] {
  const config = readOpenclawConfig();
  const models = config.agents?.defaults?.models;
  if (!models) {
    return [];
  }
  return Object.keys(models);
}

/**
 * Get current primary model from agents.defaults.model.primary
 */
export function getPrimaryModel(): string | null {
  const config = readOpenclawConfig();
  return config.agents?.defaults?.model?.primary ?? null;
}
