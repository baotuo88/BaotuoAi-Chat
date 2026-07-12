# Baotuo Chat

<p align="center">
  <img src="public/logo.png" width="96" alt="Baotuo Chat logo" />
</p>

<p align="center">
  <strong>A local-first AI chat workspace for models, agents, skills, plugins, search, RAG, voice, memory, and artifacts.</strong>
</p>

<p align="center">
  <a href="README.zh-CN.md">简体中文</a>
</p>

<p align="center">
  <a href="https://github.com/baotuo88/BaotuoAi-Chat/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/baotuo88/BaotuoAi-Chat/actions/workflows/ci.yml/badge.svg" /></a>
  <a href="https://github.com/baotuo88/BaotuoAi-Chat/actions/workflows/docker.yml"><img alt="Docker" src="https://github.com/baotuo88/BaotuoAi-Chat/actions/workflows/docker.yml/badge.svg" /></a>
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-black" />
  <img alt="React" src="https://img.shields.io/badge/React-19-149eca" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178c6" />
</p>

Baotuo Chat is a self-hostable, local-first AI chat application built with Next.js, React, TypeScript, and Zustand. It brings multi-provider chat, assistant presets, text-only Skills, OpenAPI-style plugin tools, web search, knowledge-base RAG, local memory, voice, generated media, rich message rendering, citations, and editable artifacts into one clean workspace.

It is designed for people who want the power of modern AI workspaces without giving up local data ownership. Chat history, workspace metadata, skills, plugin configuration, memories, and files stay in the browser by default; server routes act as controlled proxies for model providers, search, RAG, document parsing, voice, plugin execution, and deployment health.

## v2.1.0 Highlights

- Rebuilt System Settings with clearer grouped controls, an About panel, deployment health visibility, and local data export/reset actions.
- Added native model image generation/editing with ordered mixed text/image output blocks and OPFS-backed image display caching.
- Added thinking intensity controls for reasoning-capable Gemini and OpenAI-compatible models.
- Added Japanese localization for the app shell, SEO metadata, assistant locale routing, voice language handling, and the public Skills catalog.
- Hardened hosted deployments with API request proof, shared-store checks, service health coverage, safer URL/secret handling, and Cloudflare Worker command fixes.
- Added changelog-driven GitHub Release automation and a fork-only upstream sync workflow.

## Features

- Multi-provider chat with Gemini, OpenAI, and OpenAI-compatible endpoints.
- Native image generation and image editing for models whose metadata exposes image output/input, with ordered mixed text/image message blocks and OPFS-backed Blob URL display caching.
- Local-first sessions, branches, pinned chats, workspaces, workspace files, and assistant instructions.
- Assistant presets from the LobeHub agent registry plus local custom assistants.
- Text-only Skills with localized public catalogs, install/uninstall flows, local edits, custom skills, auto-selection, and workspace presets.
- OpenAPI-based plugin tools with per-plugin authentication and server-side execution.
- Built-in tools for web reading, weather, Unsplash search, Agnes image generation, and Agnes video generation. Agnes remains a plugin path, separate from native model image output.
- Web search through Gemini native Google Search or external providers such as Tavily, Firecrawl, Exa, Bocha, and SearXNG.
- Knowledge-base RAG with OPFS file storage, Mineru/LlamaParse document parsing, and optional vector indexing.
- Local memory with optional memory search, background extraction, and dream consolidation.
- Voice input and output through browser APIs, ElevenLabs, Mimo, or compatible configured providers.
- Rich message rendering for Markdown, safe inline HTML visual blocks, GFM tables, math, code highlighting, Mermaid diagrams, mind maps, citations, reasoning, tool calls, images, audio, and artifacts.
- Local BYOK encryption for user-entered provider, plugin, search, RAG, and voice secrets.
- Optional multi-user accounts (email/password) with signed per-user session cookies, per-user daily request quotas, and audit logging — layered on top of the deployment-wide access password gate. Activated by setting `DATABASE_URL`. Chat history stays local-first regardless.
- Deployment health checks for BYOK, access password, shared stores, default model, search, RAG, and voice readiness.
- Docker, Vercel, and Cloudflare Workers deployment paths.

## Screenshots

![Baotuo Chat Desktop](public/desktop.png)

![Baotuo Chat Mobile](public/mobile.png)

## Quick Start

### Requirements

- Node.js 22
- pnpm 10.30.3

### Run Locally

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`, then configure at least one model provider in Settings.

For deployment-wide defaults, copy the environment template:

```bash
cp .env.example .env.local
```

Most settings can be managed in the browser. Server environment variables are useful when you want a shared default provider, hosted deployment safety, access password protection, shared runtime stores, or managed defaults for search, RAG, document parsing, voice, memory, and HTML visual rendering.

## Deployment

### Docker Compose

```bash
docker compose up --build
```

The compose file publishes Baotuo Chat on `http://localhost:3000` and uses local/self-hosted safety defaults. For production Docker deployments, set stable BYOK values, use shared stores for hosted or multi-instance deployments, and enable `TRUST_PROXY_HEADERS` only behind a proxy that strips spoofed forwarded headers.

### Docker Image

```bash
docker build -t baotuo-chat:local .
docker run --rm -p 3000:3000 -e BYOK_ALLOW_EPHEMERAL_KEY=true baotuo-chat:local
```

The Docker workflow builds pull requests and publishes `main` / `v*` tags to GitHub Container Registry:

```text
ghcr.io/baotuo88/BaotuoAi-Chat:latest
```

### Vercel

Import the repository as a Next.js project. Vercel picks up the framework
preset and package manager from `pnpm-lock.yaml` and the `packageManager`
field, so the project does not need a custom output directory.

Recommended project settings:

```text
Framework Preset: Next.js
Install Command: default, or corepack pnpm install --frozen-lockfile
Build Command: pnpm build
Output Directory: default
```

#### Minimum environment variables for a public Vercel deployment

Set these in **Project → Settings → Environment Variables** (Production scope
at minimum). Redeploy after adding or changing any of them.

```bash
# Deployment mode
DEPLOYMENT_MODE=hosted
TRUST_PROXY_HEADERS=true
ALLOW_CUSTOM_PROVIDER_BASE_URL=true     # let users configure their own provider base URLs
NEXT_PUBLIC_SITE_URL=https://your-domain.com

# Shared runtime state (required in hosted mode — serverless functions do not
# share memory between invocations). Upstash Redis is available as a Vercel
# marketplace integration.
RATE_LIMIT_STORE=upstash
DOCUMENT_PARSE_JOB_STORE=upstash
PLUGIN_REGISTRY_STORE=upstash
UPSTASH_REDIS_REST_URL=https://<your-upstash-endpoint>
UPSTASH_REDIS_REST_TOKEN=<your-upstash-token>

# BYOK — stable server key. Generate with `pnpm byok:generate` locally.
BYOK_PRIVATE_KEY_PEM="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
BYOK_KEY_ID=prod-2026-07
BYOK_ALLOW_EPHEMERAL_KEY=false

# Optional deployment-level access password (extra gate in front of everything).
# Leave empty to skip the deployment password gate; individual user accounts
# below still work.
ACCESS_PASSWORD=
```

##### Where to get each value

| Variable | How to obtain | Example value |
| --- | --- | --- |
| `DEPLOYMENT_MODE` | Type it in yourself. Use `hosted` for any public deployment (Vercel, Cloudflare). Use `local` only when running on `localhost` / private network. | `hosted` |
| `TRUST_PROXY_HEADERS` | Type it in. Set to `true` behind Vercel or Cloudflare (they strip spoofed forwarded headers). Never set `true` when exposing your Node server directly to the public internet. | `true` |
| `ALLOW_CUSTOM_PROVIDER_BASE_URL` | Type it in. Set to `true` so users can configure their own provider base URLs in Settings; leave empty if you only allow the default upstreams. | `true` |
| `NEXT_PUBLIC_SITE_URL` | Type your production URL. In Vercel: **Project → Settings → Domains** shows the assigned `*.vercel.app` URL and any custom domain. | `https://baotuo-chat.vercel.app` |
| `RATE_LIMIT_STORE` | Type in `upstash`. Any of `upstash` / `redis` / `kv` selects the shared REST-based Redis backend. | `upstash` |
| `DOCUMENT_PARSE_JOB_STORE` | Type in `upstash`. Uses the same Upstash creds below to persist doc-parse job state across serverless invocations. | `upstash` |
| `PLUGIN_REGISTRY_STORE` | Type in `upstash`. Same Upstash creds. Stores installed plugin manifests server-side. | `upstash` |
| `UPSTASH_REDIS_REST_URL` | Go to [console.upstash.com](https://console.upstash.com), create a Redis database (free tier is fine, pick the region closest to your Vercel region — Vercel default is Washington DC → pick `us-east-1`), open the DB, copy **REST API → UPSTASH_REDIS_REST_URL**. Or install the **Upstash** integration from the [Vercel Marketplace](https://vercel.com/marketplace/upstash) and both variables are injected automatically. | `https://us1-fond-narwhal-12345.upstash.io` |
| `UPSTASH_REDIS_REST_TOKEN` | Same Upstash DB page → **REST API → UPSTASH_REDIS_REST_TOKEN**. Long random string. Treat as a secret. | `AXXXASQgY2xhdWRlLWV4YW1wbGXXXXXXXXXX...` |
| `BYOK_PRIVATE_KEY_PEM` | Generate locally with `pnpm byok:generate` — it prints ready-to-paste values for both the key and the key ID. Or manually: `openssl genpkey -algorithm RSA-OAEP -pkeyopt rsa_keygen_bits:2048 -out byok.pem` then base64/PEM-encode the contents. Paste the whole `-----BEGIN PRIVATE KEY-----...-----END PRIVATE KEY-----` block, preserving newlines (Vercel accepts them as literal newlines in the value field). | `-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkq...\n-----END PRIVATE KEY-----` |
| `BYOK_KEY_ID` | Type any stable identifier that you change when you rotate the key. Naming convention: `prod-YYYY-MM`. | `prod-2026-07` |
| `BYOK_ALLOW_EPHEMERAL_KEY` | Type `false`. Only `true` is acceptable during local development. | `false` |
| `ACCESS_PASSWORD` | Type your own strong password (or leave empty to skip this extra gate). Everyone hitting the deployment must enter this before seeing the login/register page. | `your-strong-random-string` or empty |

Command-line one-liners you'll need:

```bash
# Generate BYOK material (recommended — outputs both key and ID in one shot)
pnpm byok:generate

# Generate a session/HMAC secret
openssl rand -base64 32
# → 5tQE9v...+Rp0=

# Verify a Neon connection URL works before pasting into Vercel
psql "postgres://user:pass@ep-xxxx.neon.tech/neondb?sslmode=require" -c "SELECT 1"
```

#### Multi-user accounts (email/password + per-user daily quota)

Multi-user accounts are **optional** and only activate when `DATABASE_URL` is
configured. When enabled, they layer email/password sign-in, signed per-user
session cookies, dual-layer login lockout (per-IP and per-email), per-user
daily request quotas, and audit logging on top of the deployment-wide
`ACCESS_PASSWORD` gate. Chat history, workspaces, knowledge bases, and files
remain local-first (IndexedDB/OPFS) — only account records, quota counters,
and audit logs live in the database.

**Environment variables to configure in Vercel** (Project → Settings →
Environment Variables, Production scope at minimum):

| Variable                 | Required?              | Purpose                                                                                                                                       |
| ------------------------ | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`           | Required to enable     | Neon serverless Postgres connection string. Presence of this variable is the on/off switch for the whole account system.                      |
| `ACCOUNT_SESSION_SECRET` | Required with database | HMAC-SHA256 key used to sign per-user session cookies. Bump this to force every existing user to sign in again.                               |
| `DEFAULT_DAILY_QUOTA`    | Optional (default 200) | Fallback daily request quota per user when their `daily_quota` DB column is `null`. Counts calls to chat, search, rag, voice, and doc-parse.  |
| `RATE_LIMIT_STORE`       | Required in hosted     | Must be `upstash` (or `redis`/`kv`) so login lockout and quota buckets survive across serverless invocations. Memory fallback fails in hosted. |
| `UPSTASH_REDIS_REST_URL` | Required with upstash  | Upstash REST endpoint. Free tier is fine.                                                                                                     |
| `UPSTASH_REDIS_REST_TOKEN` | Required with upstash | Upstash REST token.                                                                                                                          |

Example values:

```bash
# Neon serverless Postgres — create a project at https://neon.tech and copy
# the pooled connection string. Uses HTTP driver, works from Vercel Edge and
# serverless functions without a persistent TCP connection.
DATABASE_URL=postgres://user:pass@ep-xxxx.neon.tech/neondb?sslmode=require

# Signs per-user session cookies. Generate a fresh value locally with:
#   openssl rand -base64 32
# Rotating this value invalidates every existing session (users must sign in
# again). Preview and production can safely use different secrets.
ACCOUNT_SESSION_SECRET=<32+ random bytes, base64>

# Fallback daily quota per user (24h rolling window). Set per-user overrides
# by editing the users.daily_quota column in Neon.
DEFAULT_DAILY_QUOTA=200

# Shared rate-limit store — required in hosted mode. Login lockout and quota
# counters live here, not in per-instance memory.
RATE_LIMIT_STORE=upstash
UPSTASH_REDIS_REST_URL=https://<your-endpoint>.upstash.io
UPSTASH_REDIS_REST_TOKEN=<your-token>
```

##### Where to get each value

| Variable | How to obtain | Example value |
| --- | --- | --- |
| `DATABASE_URL` | Sign up at [neon.tech](https://neon.tech) (free tier: 0.5 GB storage, plenty for accounts + audit logs). Create a project → open the project dashboard → **Connection Details** → copy the **Pooled connection** string (starts with `postgres://`, host contains `-pooler`). The pooled URL is what you want for serverless. Or install the [Neon Vercel integration](https://vercel.com/integrations/neon) and this variable is injected automatically, plus you get isolated DB branches for preview vs. production. | `postgres://neondb_owner:AbCdEf12@ep-cool-mud-a1b2c3-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require` |
| `ACCOUNT_SESSION_SECRET` | Generate locally with `openssl rand -base64 32` (or PowerShell: `[Convert]::ToBase64String((1..32 \| %{ Get-Random -Max 256 }))`). Any 32+ byte high-entropy string works. Rotate to force all users to sign in again. Use different values for preview vs. production. | `5tQE9v3xLPuHZ1c/w2JN6RfCbGY7aKM+DoIkS4yTBr0=` |
| `DEFAULT_DAILY_QUOTA` | Type any positive integer. Applies to every user whose `users.daily_quota` column is `NULL`. Counts requests to `/api/chat`, `/api/search`, `/api/rag`, `/api/voice`, `/api/doc-parse` per rolling 24h window (not tokens). Give power users a bigger quota via SQL, or set this higher and use `UPDATE` to *reduce* specific abusers. | `200` |
| `RATE_LIMIT_STORE` | Type `upstash`. Same variable as in the base Vercel block above — the login lockout and daily quota buckets reuse the shared rate-limit store. If you already set `RATE_LIMIT_STORE=upstash` above you don't need to set it again. | `upstash` |
| `UPSTASH_REDIS_REST_URL` | Same Upstash database you set up for rate limiting above — you don't need a second Redis instance. Quota keys (`quota:<userId>`) and login-failure keys (`auth-login-ip:<ip>`, `auth-login-account:<email>`) all share the same store. | `https://us1-fond-narwhal-12345.upstash.io` |
| `UPSTASH_REDIS_REST_TOKEN` | Same as above — reuse the Upstash token from the rate-limit setup. | `AXXXASQgY2xhdWRlLWV4YW1wbGXXXXXXXXXX...` |

Command-line one-liners for multi-user setup:

```bash
# Generate the session secret
openssl rand -base64 32
# → 5tQE9v3xLPuHZ1c/w2JN6RfCbGY7aKM+DoIkS4yTBr0=

# Verify the Neon URL works before pasting into Vercel
psql "postgres://neondb_owner:...@ep-xxx-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require" -c "SELECT 1"

# Push the schema (creates users + audit_logs tables) — see Step 1 below
DATABASE_URL="postgres://..." pnpm db:push

# Later, connect to the DB to manage users
psql "$DATABASE_URL"
```

**Step 1 — create the Neon database and push the schema** (one-time, run
locally from your checkout with the same `DATABASE_URL` you'll put in
Vercel):

```bash
# On your dev machine
export DATABASE_URL="postgres://..."   # or set in .env.local
pnpm db:push
```

That creates the two tables the account layer needs:

- `users` — `id`, `email`, `password_hash`, `token_version`, `daily_quota`, `disabled`, `created_at`, `updated_at`
- `audit_logs` — `id`, `user_id`, `action` (`register` / `login` / `login_failed` / `quota_exceeded` / `account_disabled_login_attempt`), `detail` (jsonb), `created_at`

Rerun `pnpm db:push` after any future schema change. Vercel does **not** run
migrations for you.

**Step 2 — set the environment variables in Vercel**, then trigger a
Redeploy. Once the deployment is live:

- Anonymous visitors see the login/register page at the root URL.
- Registration is throttled to 5 accounts per IP per hour and requires a
  password of 8+ characters.
- Failed logins are locked out after 8 attempts (per-IP OR per-email) for 30
  minutes.

**Step 3 — manage users by editing the database directly.** There is
intentionally **no admin UI** — quota and ban changes are done in Neon's SQL
console:

```sql
-- Give one user a bigger daily quota
UPDATE users SET daily_quota = 1000 WHERE email = 'user@example.com';

-- Remove a per-user override so they fall back to DEFAULT_DAILY_QUOTA
UPDATE users SET daily_quota = NULL WHERE email = 'user@example.com';

-- Disable / ban an account (blocks all future logins immediately, existing
-- sessions get invalidated on their next request)
UPDATE users SET disabled = true WHERE email = 'abuser@example.com';

-- Re-enable an account
UPDATE users SET disabled = false WHERE email = 'user@example.com';

-- Force sign-out everywhere for one user (e.g. after they report a lost
-- device or you reset their password)
UPDATE users SET token_version = token_version + 1
WHERE email = 'user@example.com';

-- See recent auth events for a user
SELECT action, detail, created_at FROM audit_logs
WHERE user_id = (SELECT id FROM users WHERE email = 'user@example.com')
ORDER BY created_at DESC LIMIT 50;

-- See failed login attempts across all accounts in the last 24 hours
SELECT action, detail, created_at FROM audit_logs
WHERE action IN ('login_failed', 'account_disabled_login_attempt')
  AND created_at > now() - interval '24 hours'
ORDER BY created_at DESC;

-- Delete a user (audit_logs.user_id is set to NULL by ON DELETE SET NULL,
-- so their history is preserved for abuse investigation)
DELETE FROM users WHERE email = 'user@example.com';
```

Signed-in users see their email, current daily quota usage with a progress
bar, remaining requests, quota reset time, and a sign-out button in
**Settings → Account**.

**Common pitfalls**:

- **`RATE_LIMIT_STORE` not set to `upstash` in hosted mode** — the app will
  throw `SHARED_RATE_LIMIT_STORE_ERROR` at startup. Memory fallback is
  disabled in hosted mode on purpose (Vercel serverless functions don't
  share memory between invocations, so lockout counters would reset every
  request otherwise).
- **`TRUST_PROXY_HEADERS` not set to `true`** — client IP always resolves to
  `"unknown"`, so per-IP login lockout and per-IP register throttle collapse
  into one shared bucket for every visitor. Set to `true` on Vercel and
  Cloudflare (they strip spoofed forwarded headers before your app sees
  them).
- **Forgot `pnpm db:push`** — registration returns HTTP 500 with a "relation
  does not exist" error in the logs.
- **Preview and production sharing the same `DATABASE_URL`** — accidental
  test accounts show up in production. Vercel's Neon integration creates
  isolated Neon branches per Vercel deployment environment automatically —
  use that.

Do not commit any of these values to the repository — they are Vercel
environment variables only. When a `NEXT_PUBLIC_*` value affects metadata or
generated public links, set it for the environments that build those
deployments.

### Cloudflare Workers

```bash
pnpm build:worker
pnpm preview:worker
pnpm deploy:worker
```

Workers should run in hosted mode and use public HTTPS upstreams. When using
Cloudflare Workers Builds, use separate build and deploy commands so the
OpenNext build output exists before deployment:

```bash
# Build command
pnpm build:worker

# Deploy command
pnpm exec opennextjs-cloudflare deploy -- --keep-vars
```

`--keep-vars` preserves runtime variables and secrets configured in the
Cloudflare dashboard instead of replacing them with only the values committed in
`wrangler.jsonc`.

Production Workers should configure runtime variables in the Cloudflare
dashboard under **Settings -> Variables and Secrets**. Use plain variables for
non-sensitive deployment defaults:

```bash
DEPLOYMENT_MODE=hosted
RATE_LIMIT_STORE=upstash
DOCUMENT_PARSE_JOB_STORE=upstash
PLUGIN_REGISTRY_STORE=upstash
BYOK_ALLOW_EPHEMERAL_KEY=false
NEXT_PUBLIC_SITE_URL=https://your-domain.com
```

Use secrets for deployment passwords, provider keys, BYOK material, and shared
store credentials:

```bash
wrangler secret put BYOK_PRIVATE_KEY_PEM
wrangler secret put BYOK_KEY_ID
wrangler secret put UPSTASH_REDIS_REST_URL
wrangler secret put UPSTASH_REDIS_REST_TOKEN
wrangler secret put ACCESS_PASSWORD
```

For Cloudflare Workers Builds, also add build-time variables under
**Settings -> Builds -> Variables and Secrets** when a value must be available
during `next build`, especially `NEXT_PUBLIC_*` values. Runtime variables are
not available to the build step unless they are also configured there.

Do not commit personal API keys or deployment secrets to `wrangler.jsonc`.
Deployment-level provider keys such as `DEFAULT_PROVIDER_API_KEY` are shared by
everyone using that Worker instance; leave them unset if users should provide
their own keys in the browser.

See [Deployment Hardening](docs/deployment-hardening.md) for production configuration guidance.

## Configuration

Baotuo Chat is local-first by default:

- Core settings, provider records, selected models, and provider API keys are stored in browser `localStorage`.
- Chat metadata, messages, app settings, installed plugins, installed/custom skills, skill catalog caches, assistants, knowledge metadata, and local memories are stored in IndexedDB through `localforage`.
- Uploaded chat, workspace, and knowledge files are stored in browser OPFS. User-sent and model-generated images also keep OPFS display-cache copies that render through runtime `blob:` URLs while preserving the original message data for model requests and export.
- User-entered secrets are encrypted in the browser as BYOK envelopes before being sent to API routes.

Important server-side settings:

```bash
# Deployment-wide access gate (optional, layered above accounts)
ACCESS_PASSWORD="your-access-password"

# Stable BYOK server key for production
BYOK_PRIVATE_KEY_PEM="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
BYOK_KEY_ID="prod-2026-07"
BYOK_ALLOW_EPHEMERAL_KEY="false"

# Deployment safety
DEPLOYMENT_MODE="local" # or hosted
TRUST_PROXY_HEADERS=""                    # set to true only when behind a trusted proxy (Vercel, Cloudflare)
ALLOW_LOCAL_NETWORK_PROXY=""
ALLOW_CUSTOM_PROVIDER_BASE_URL=""         # required=true in hosted mode if users configure their own provider base URLs
ALLOW_MEMORY_STORE_FALLBACK=""            # keep empty in hosted mode; forces shared store use

# Shared short-lived state for hosted or multi-instance deployments
RATE_LIMIT_STORE="upstash"
DOCUMENT_PARSE_JOB_STORE="upstash"
PLUGIN_REGISTRY_STORE="upstash"
UPSTASH_REDIS_REST_URL="https://..."
UPSTASH_REDIS_REST_TOKEN="..."

# Multi-user accounts (optional). Enable by setting DATABASE_URL; leave empty
# to keep the deployment single-tenant behind ACCESS_PASSWORD.
DATABASE_URL=""                           # Neon serverless Postgres
ACCOUNT_SESSION_SECRET=""                 # openssl rand -base64 32
DEFAULT_DAILY_QUOTA="200"                 # per-user daily request quota
```

Default model provider:

```bash
DEFAULT_PROVIDER_TYPE="Gemini"
DEFAULT_PROVIDER_NAME="Google Gemini"
DEFAULT_PROVIDER_BASE_URL=""
DEFAULT_PROVIDER_API_KEY="provider-key"
DEFAULT_PROVIDER_MODELS="model-a,model-b"
```

`DEFAULT_PROVIDER_MODELS` supports multiple formats:

```bash
# Comma-separated model IDs
DEFAULT_PROVIDER_MODELS="gpt-5.5,gpt-5.4-mini"

# JSON string array
DEFAULT_PROVIDER_MODELS='["gpt-5.5","gpt-5.4-mini"]'

# JSON object array with optional display names, capability aliases, and modalities
DEFAULT_PROVIDER_MODELS='[{"id":"gpt-image-2","name":"GPT Image 2","capabilities":["image_generation"]},{"id":"gemini-3.1-flash-image","modalities":{"input":["text","image"],"output":["text","image"]}},"gpt-5.4-mini"]'
```

For JSON object entries, `name` is optional and falls back to `id`.
`capabilities` accepts aliases such as `vision`, `attachment`, `reasoning`,
`tool_call`, `image_generation`, `image_output`, and `image_editing`.
Explicit `modalities.input` / `modalities.output` are preferred when present.

Default task models:

```bash
DEFAULT_MODEL_TITLE_GENERATION="model-a"
DEFAULT_MODEL_RELATED_QUESTIONS="model-a"
DEFAULT_MODEL_CONTEXT_COMPRESSION="model-a"
DEFAULT_MODEL_PROMPT_OPTIMIZATION="model-a"
DEFAULT_MODEL_RAG_QUERY="model-a"
DEFAULT_MODEL_MEMORY="model-a"
```

Search, RAG, document parsing, and voice defaults:

```bash
DEFAULT_SEARCH_PROVIDER="firecrawl"
# Firecrawl search works without an API key; set one for higher rate limits.
DEFAULT_SEARCH_API_KEY=""
DEFAULT_SEARCH_BASE_URL="https://search.example"

DEFAULT_RAG_BASE_URL="https://rag.example"
DEFAULT_RAG_TOKEN="rag-token"
DEFAULT_RAG_TOP_K="10"
DEFAULT_RAG_CHUNK_SIZE="512"
DEFAULT_RAG_NAMESPACE="default"
DEFAULT_DOCUMENT_PARSE_PROVIDER="mineru"
DEFAULT_MINERU_API_TOKEN=""
DEFAULT_LLAMA_PARSE_API_KEY="llama-parse-key"

DEFAULT_VOICE_PROVIDER="elevenlabs"
DEFAULT_ELEVENLABS_API_KEY="elevenlabs-key"
DEFAULT_ELEVENLABS_STT_MODEL="scribe_v2"
DEFAULT_ELEVENLABS_TTS_MODEL="eleven_flash_v2_5"
DEFAULT_ELEVENLABS_TTS_VOICE_ID="bIHbv24MWmeRgasZH58o"

DEFAULT_MIMO_API_KEY="mimo-key"
DEFAULT_MIMO_STT_MODEL="mimo-v2.5-asr"
DEFAULT_MIMO_TTS_MODEL="mimo-v2.5-tts"
DEFAULT_MIMO_TTS_VOICE_ID="mimo_default"
```

Default system behavior:

```bash
DEFAULT_SYSTEM_PROMPT=""
DEFAULT_ENABLE_AUTO_TITLE="true"
DEFAULT_ENABLE_RELATED_QUESTIONS="true"
DEFAULT_ENABLE_AUTO_COMPRESSION="true"
DEFAULT_ENABLE_CODE_COLLAPSE="true"
DEFAULT_ENABLE_HTML_VISUAL_PROMPT="true"
```

Public site URL:

```bash
NEXT_PUBLIC_SITE_URL="https://your-domain.com"
```

For the full template, see [.env.example](.env.example).

## Architecture

```mermaid
flowchart LR
  Browser["Browser app\nReact + Zustand"] --> LocalStorage["localStorage\nproviders + settings"]
  Browser --> IndexedDB["IndexedDB\nsessions + plugins + skills + knowledge + memories"]
  Browser --> OPFS["OPFS\nuploads + workspace files"]
  Browser --> ApiRoutes["Next.js API routes"]
  ApiRoutes --> Providers["Model providers\nGemini / OpenAI / compatible"]
  ApiRoutes --> Search["Search providers"]
  ApiRoutes --> Rag["RAG + document services"]
  ApiRoutes --> Plugins["Plugin APIs"]
  ApiRoutes --> Voice["Voice providers"]
  ApiRoutes --> Health["Deployment health"]
  Browser -. encrypted BYOK envelopes .-> ApiRoutes
```

The app keeps durable user data in browser storage whenever possible. API routes provide:

- provider request normalization and streaming;
- BYOK decryption on the server side;
- URL safety gates for proxied upstreams;
- plugin execution through registered plugin IDs and function names;
- deployment health reporting through `/api/health`;
- hosted-mode checks for shared stores and local-network restrictions.

## Skills, Plugins, Search, RAG, and Voice

Skills are text-only prompt-context modules. The app loads localized metadata catalogs from `public/data/skills`, fetches full skill definitions only when needed, and stores installed, edited, and custom skills locally. Active skills can be selected manually, inherited from workspace presets, or auto-selected for a message.

Plugins are OpenAPI-style tools installed from manifests or built-in definitions. Enabled plugin functions are exposed to compatible models as tools, then executed by the server-side plugin route. Tool-call orchestration uses a high but bounded loop limit to avoid runaway recursive calls while still allowing multi-step tasks.

Search can run through Gemini native Google Search for Gemini models or external providers for other model families. Knowledge-base RAG stores source files in OPFS, optionally parses documents with Mineru or LlamaParse, and can index chunks into an external vector service.

Voice workflows support browser speech APIs and configured external providers. Set `DEFAULT_VOICE_PROVIDER` to `elevenlabs` or `mimo` to enable a server default; leaving it empty keeps browser-native speech as the default. Empty default model values disable the matching STT or TTS capability, and the UI can store user-specific secrets locally.

Deployment health is available from Settings and `/api/health`. It reports non-secret readiness for BYOK, access password, hosted mode, shared stores, default model, search, RAG, and voice configuration.

## Security Model

Baotuo Chat supports both self-hosted single-tenant and multi-user public deployments.

- `DEPLOYMENT_MODE=local` allows local and private-network proxy targets for private deployments.
- `DEPLOYMENT_MODE=hosted` blocks localhost, private-network, and plain-HTTP proxy targets unless explicitly overridden.
- BYOK envelopes prevent plain user-entered secrets from being sent in request bodies.
- API schemas reject unknown high-risk fields and oversized payloads.
- Plugin execution remains server-proxied and validated, but runtime tool calls no longer require a user confirmation modal.
- `ACCESS_PASSWORD` is a deployment-wide gate; enable multi-user accounts on top of it by setting `DATABASE_URL`.
- Multi-user mode adds email/password sign-in with PBKDF2 password hashing, HMAC-signed session cookies, per-user daily request quotas on metered AI routes, dual-layer login rate limiting (per-IP + per-account), and best-effort audit logging. Chat history, workspaces, and knowledge remain client-side; only account records live in the database.
- User administration (grant custom quotas, disable accounts, force sign-out everywhere by bumping `token_version`) is done by editing rows directly in the database. There is intentionally no admin UI.

See [Reliability and Safety Model](docs/reliability-and-safety.md) for runtime behavior and recovery notes.

## Development

Quality checks:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm audit --audit-level low
```

Useful scripts:

```bash
pnpm dev              # Start Next.js dev server
pnpm build            # Production build
pnpm start            # Start production server
pnpm format           # Format the repository with Prettier
pnpm format:check     # Check repository formatting
pnpm build:worker     # Build for Cloudflare Workers
pnpm preview:worker   # Preview Worker build
pnpm deploy:worker    # Deploy Worker build while preserving dashboard vars
pnpm byok:generate    # Generate copyable BYOK key values
```

Project layout:

```text
src/app/              Next.js routes and API routes
src/components/       Chat UI, settings, plugin market, knowledge base
src/lib/              Server/client domain helpers and safety gates
src/services/         Provider, search, voice, RAG, and plugin service clients
src/store/            Zustand stores and persistence migrations
src/__tests__/        Vitest coverage for utilities, routes, and workflows
docs/                 Deployment and reliability notes
```

Project documentation:

- [Environment Variables](docs/environment-variables.md)
- [Plugin Development](docs/plugin-development.md)
- [Privacy and Local Data](docs/privacy-and-local-data.md)
- [Deployment Hardening](docs/deployment-hardening.md)
- [Reliability and Safety Model](docs/reliability-and-safety.md)
- [Roadmap](ROADMAP.md)
- [Changelog](CHANGELOG.md)

### Fork Synchronization

Fork maintainers can enable the `Sync upstream` workflow to fast-forward their fork from the upstream `baotuo88/BaotuoAi-Chat` `main` branch.

1. In the fork, open **Settings > Actions > General** and allow GitHub Actions to run.
2. In **Workflow permissions**, select **Read and write permissions** so `GITHUB_TOKEN` can push to the fork.
3. Open **Actions > Sync upstream > Run workflow** to trigger the first sync manually.
4. Keep the scheduled workflow enabled if you want the fork to sync daily.

The workflow is skipped in the upstream repository and only runs when GitHub marks the repository as a fork. It uses fast-forward-only merging, so it fails safely when the fork branch has diverged from upstream or a branch protection rule blocks the push.

Optional repository variables can override the defaults:

```text
UPSTREAM_REPOSITORY=baotuo88/BaotuoAi-Chat
UPSTREAM_BRANCH=main
TARGET_BRANCH=<fork default branch>
```

## FAQ

### Does Baotuo Chat store my data on a server?

By default, durable chat and configuration data live in browser storage. API routes proxy external services, and production deployments should still treat server logs, upstream services, and configured stores according to their own privacy requirements.

### Can I use OpenAI-compatible providers?

Yes. Add an OpenAI-compatible provider in Settings or configure deployment defaults with `DEFAULT_PROVIDER_TYPE="OpenAI Compatible"` and a compatible `/v1` base URL.

### Why do I need a stable BYOK private key in production?

Browser secrets are encrypted to the server public key. If the server private key changes, existing local envelopes cannot be decrypted until users re-enter their secrets.

### Can I deploy this as a public SaaS?

Yes, with the multi-user layer enabled. Set `DATABASE_URL`, `ACCOUNT_SESSION_SECRET`, and `DEFAULT_DAILY_QUOTA` on top of the hosted-mode defaults (`DEPLOYMENT_MODE=hosted`, `TRUST_PROXY_HEADERS=true`, Upstash-backed shared stores, stable BYOK key). You get email/password sign-in, per-user daily request quotas on metered AI routes, dual-layer login rate limiting, and audit logging. Chat history, workspaces, and knowledge remain client-side; only account records live in the database. There is no admin UI — manage quotas and bans by editing the database directly.

### Why did a tool stop after many calls?

Baotuo Chat keeps tool calls high but bounded. The model can run multi-step tool workflows, but recursive tool loops stop after the configured tool-round limit.

### How do I retrieve previous versions?

Previous versions of the project were developed solely based on the Gemini ecosystem. If you need previous versions, you can obtain them from the `gemini-next-chat` branch, **which has its code archived**.

## Contributing

Contributions are welcome. Keep changes focused, preserve local-first behavior, and run the quality checks before opening a pull request. For security-sensitive changes, include tests for both local and hosted deployment modes.

Read [Contributing](CONTRIBUTING.md), [Security Policy](SECURITY.md), and the
[Code of Conduct](CODE_OF_CONDUCT.md) before opening larger changes.

## Community Support

[LinuxDo](https://linux.do/)

## License

Baotuo Chat is released under the [MIT License](LICENSE).
