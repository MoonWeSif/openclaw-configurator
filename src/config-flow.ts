import {
  createLogger,
  select,
  input,
  ora,
  symbols,
  fetchModels,
  filterSupportedModels,
  setProviderConfig,
  isSupportedProvider,
  type OpenclawModel,
  type SupportedProvider,
} from "@/utils";
import { t } from "@/i18n";

const logger = createLogger("ConfigFlow");

const PACKYCODE_BASE_URL = "https://www.packyapi.com";

type ConfigAction = "add" | "exit";
type Vendor = "packycode" | "other";

async function selectAction(): Promise<ConfigAction> {
  return select({
    message: t("config_action_prompt"),
    choices: [
      { value: "add" as const, name: t("config_action_add") },
      { value: "exit" as const, name: t("config_action_exit") },
    ],
  });
}

async function selectVendor(): Promise<Vendor> {
  return select({
    message: t("select_vendor"),
    choices: [
      { value: "packycode" as const, name: t("vendor_packycode") },
      { value: "other" as const, name: t("vendor_other") },
    ],
  });
}

async function getBaseUrl(vendor: Vendor): Promise<string> {
  if (vendor === "packycode") {
    return PACKYCODE_BASE_URL;
  }
  return input({
    message: t("input_base_url"),
  });
}

function getProviderBaseUrl(
  baseUrl: string,
  provider: SupportedProvider
): string {
  if (provider === "openai") {
    return `${baseUrl}/v1`;
  }
  return baseUrl;
}

async function selectModel(models: OpenclawModel[]): Promise<OpenclawModel> {
  return select({
    message: t("select_model"),
    choices: models.map((m) => ({
      value: m,
      name: `${m.name} (${m.key})`,
    })),
  });
}

async function configureProvider(): Promise<void> {
  // Step 1: Select vendor
  const vendor = await selectVendor();
  logger.debug(`Selected vendor: ${vendor}`);

  // Step 2: Get base URL
  const baseUrl = await getBaseUrl(vendor);
  logger.debug(`Base URL: ${baseUrl}`);

  // Step 3: Fetch and filter models
  const spinner = ora(t("fetching_models")).start();
  let supportedModels: OpenclawModel[];
  try {
    const result = fetchModels();
    supportedModels = filterSupportedModels(result.models);
    spinner.succeed();
  } catch (err) {
    spinner.fail(t("fetching_models_failed"));
    logger.error(err instanceof Error ? err.message : String(err));
    return;
  }

  if (supportedModels.length === 0) {
    console.log(`${symbols.warning} ${t("no_models_available")}`);
    return;
  }

  // Step 4: Select model
  const selectedModel = await selectModel(supportedModels);
  logger.debug(`Selected model: ${selectedModel.key}`);

  // Step 5: Save provider config
  const provider = isSupportedProvider(selectedModel.key);
  if (!provider) {
    return;
  }

  const providerBaseUrl = getProviderBaseUrl(baseUrl, provider);
  try {
    setProviderConfig(provider, {
      baseUrl: providerBaseUrl,
      models: [],
    });
    console.log(`${symbols.success} ${t("provider_config_saved", { provider })}`);
  } catch (err) {
    console.log(`${symbols.error} ${t("provider_config_failed")}`);
    logger.error(err instanceof Error ? err.message : String(err));
  }
}

export async function runConfigLoop(): Promise<void> {
  while (true) {
    const action = await selectAction();

    if (action === "exit") {
      break;
    }

    await configureProvider();
    console.log();
  }
}
