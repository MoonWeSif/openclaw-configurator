# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
make install    # Install dependencies (pnpm)
make dev        # Run in development mode (tsx)
make build      # Build single-file bundle (esbuild → dist/index.js)
make typecheck  # Type check only
make clean      # Remove dist/ and node_modules/
```

Always run `make typecheck build` after changes to verify types and build succeed.

## Architecture

This is a CLI tool for configuring OpenClaw (Linux). TypeScript source compiles to a single ESM bundle via esbuild.

### App Lifecycle (`src/index.ts`)

- `init()` → Create `AppContext` with AbortController
- `run(ctx)` → Main flow (language selection → openclaw check → ...)
- `shutdown(ctx, reason)` → Cleanup and exit
- Signal handlers for SIGINT/SIGTERM with graceful shutdown

### Key Modules

- **`src/utils/`** - Utilities barrel export
  - `logger.ts` - `createLogger(name)` with level filtering via `LOG_LEVEL` env
  - `system.ts` - `which()` for executable lookup
  - `select` - Interactive prompts (`@inquirer/prompts`)
  - `ora` - Spinner for process status
  - `chalk` - Text styling/colors
  - `symbols` - Result feedback icons (✔ ✖ ⚠ ℹ)

- **`src/i18n/`** - Internationalization
  - `t(key, params?)` for translations with `{placeholder}` support
  - `setLocale()` / `detectLocale()` for language switching
  - Add keys to both `en.json` and `zh_CN.json` (types auto-inferred)

### Path Alias

Use `@/*` for imports from `src/`:
```typescript
import { createLogger } from "@/utils";
import { t } from "@/i18n";
```

Configured in both `tsconfig.json` (for IDE/typecheck) and `scripts/build.ts` (for esbuild).
