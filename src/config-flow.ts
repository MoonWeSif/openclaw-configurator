import {
  createLogger,
  escInput,
  escPassword,
  isPromptCancelled,
  ora,
  symbols,
  fetchModels,
  filterModelsByVendor,
  findVendorModel,
  isSupportedProvider,
  getConfiguredModels,
  getPrimaryModel,
  VENDOR_FILTERS,
  runMenu,
  MENU_EXIT,
  type OpenclawModel,
  type SupportedProvider,
  type ApiType,
  type MenuContext,
} from "@/utils";
import { t } from "@/i18n";
import {
  runOperations,
  createSetProviderConfig,
  createSetApiKey,
  createSetModel,
  type Operation,
} from "@/operations";

const logger = createLogger("ConfigFlow");

const TWELVE_API_BASE_URL = "https://cdn.12ai.org";

type Vendor = "12api" | "other";

async function selectVendor(): Promise<Vendor | null> {
  return runMenu<Vendor>({
    message: t("select_vendor"),
    items: [
      { label: t("vendor_12api"), value: "12api" },
      { label: t("vendor_other"), value: "other" },
    ],
  });
}

async function getBaseUrl(
  vendor: Vendor,
): Promise<string | null> {
  if (vendor === "12api") {
    return TWELVE_API_BASE_URL;
  }
  try {
    return await escInput({
      message: t("input_base_url"),
    });
  } catch (err) {
    if (isPromptCancelled(err)) {
      return null;
    }
    throw err;
  }
}

function getProviderBaseUrl(
  baseUrl: string,
  provider: SupportedProvider,
  api?: ApiType
): string {
  // Custom providers with explicit api type
  if (api === "openai-completions") {
    return `${baseUrl}/v1`;
  }
  if (api === "anthropic-messages") {
    return baseUrl;
  }
  // Built-in providers
  if (provider === "openai") {
    return `${baseUrl}/v1`;
  }
  if (provider === "google") {
    return `${baseUrl}/v1beta`;
  }
  return baseUrl;
}

async function selectModel(
  models: OpenclawModel[]
): Promise<OpenclawModel | null> {
  return runMenu<OpenclawModel>({
    message: t("select_model"),
    items: models.map((m) => ({
      label: `${m.name} (${m.key})`,
      value: m,
    })),
  });
}

async function configureProvider(ctx: MenuContext): Promise<void> {
  // Step 1: Select vendor
  const vendor = await selectVendor();
  if (!vendor) {
    return;
  }
  ctx.logger.debug(`Selected vendor: ${vendor}`);

  // Step 2: Get base URL
  const baseUrl = await getBaseUrl(vendor);
  if (!baseUrl) {
    return;
  }
  ctx.logger.debug(`Base URL: ${baseUrl}`);

  // Step 3: Fetch and filter models
  const spinner = ora(t("fetching_models")).start();
  let filteredModels: OpenclawModel[];
  try {
    const result = fetchModels();
    filteredModels = filterModelsByVendor(result.models, vendor);
    spinner.succeed();
  } catch (err) {
    spinner.fail(t("fetching_models_failed"));
    ctx.logger.error(err instanceof Error ? err.message : String(err));
    return;
  }

  if (filteredModels.length === 0) {
    console.log(`${symbols.warning} ${t("no_models_available")}`);
    return;
  }

  // Step 4: Select model
  const selectedModel = await selectModel(filteredModels);
  if (!selectedModel) {
    return;
  }
  ctx.logger.debug(`Selected model: ${selectedModel.key}`);

  // Step 5: Determine provider and api type
  const vendorFilter = VENDOR_FILTERS[vendor];
  const allowedProviders = vendorFilter?.providers.length
    ? vendorFilter.providers
    : undefined;
  const provider = isSupportedProvider(selectedModel.key, allowedProviders);
  if (!provider) {
    return;
  }

  const vendorModel = findVendorModel(vendor, selectedModel.key);
  const api = vendorModel?.api;

  // Step 6: Get API key
  let apiKey: string;
  try {
    apiKey = await escPassword({
      message: t("input_api_key", { provider }),
      mask: "*",
    });
  } catch (err) {
    if (isPromptCancelled(err)) {
      return;
    }
    throw err;
  }

  // Step 7: Save config via operations (auto restart included)
  const modelSuffix = selectedModel.key.split("/").slice(1).join("/");
  const providerBaseUrl = getProviderBaseUrl(baseUrl, provider, api);
  const operations: Operation[] = [
    createSetProviderConfig({
      provider,
      baseUrl: providerBaseUrl,
      api,
      models: api ? [{ id: modelSuffix, name: selectedModel.name }] : undefined,
    }),
    createSetApiKey(provider, apiKey),
    createSetModel(selectedModel.key),
  ];

  await runOperations(ctx, operations);
}

async function selectConfiguredModel(ctx: MenuContext): Promise<void> {
  const configuredModels = getConfiguredModels();
  if (configuredModels.length === 0) {
    console.log(`${symbols.warning} ${t("no_configured_models")}`);
    return;
  }

  const currentModel = getPrimaryModel();

  const selected = await runMenu<string>({
    message: t("select_configured_model"),
    items: configuredModels.map((modelKey) => ({
      label:
        modelKey === currentModel
          ? `${modelKey} ${t("current_model_hint")}`
          : modelKey,
      value: modelKey,
    })),
  });

  if (!selected || selected === currentModel) {
    return;
  }

  ctx.logger.debug(`Selected model: ${selected}`);
  await runOperations(ctx, [createSetModel(selected)]);
}

export async function runConfigLoop(): Promise<void> {
  const ctx: MenuContext = { logger };

  await runMenu({
    message: t("config_action_prompt"),
    loop: true,
    context: ctx,
    items: [
      {
        label: t("config_action_add"),
        value: "add",
        action: configureProvider,
      },
      {
        label: t("config_action_select_model"),
        value: "select_model",
        action: selectConfiguredModel,
      },
      {
        label: t("config_action_exit"),
        value: MENU_EXIT,
      },
    ],
  });
}
