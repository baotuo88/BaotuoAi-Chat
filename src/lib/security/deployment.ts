export type DeploymentMode = "local" | "hosted";

export interface OutboundPolicyProfile {
  mode: DeploymentMode;
  allowLocalNetworkProxy: boolean;
}

const DEPLOYMENT_MODE_ENV = "DEPLOYMENT_MODE";
const ALLOW_LOCAL_NETWORK_PROXY_ENV = "ALLOW_LOCAL_NETWORK_PROXY";
const ALLOW_CUSTOM_PROVIDER_BASE_URL_ENV = "ALLOW_CUSTOM_PROVIDER_BASE_URL";
const ALLOW_MEMORY_STORE_FALLBACK_ENV = "ALLOW_MEMORY_STORE_FALLBACK";

function getEnvValue(name: string): string | undefined {
  if (typeof process === "undefined") return undefined;
  return process.env[name];
}

function parseBooleanEnv(name: string): boolean | undefined {
  const raw = getEnvValue(name)?.trim().toLowerCase();
  if (!raw) return undefined;
  if (["1", "true", "yes", "on"].includes(raw)) return true;
  if (["0", "false", "no", "off"].includes(raw)) return false;
  return undefined;
}

export function getDeploymentMode(): DeploymentMode {
  const raw = getEnvValue(DEPLOYMENT_MODE_ENV)?.trim().toLowerCase();
  return raw === "hosted" ? "hosted" : "local";
}

function getExplicitLocalNetworkProxySetting(): boolean | undefined {
  return parseBooleanEnv(ALLOW_LOCAL_NETWORK_PROXY_ENV);
}

export function getOutboundPolicyProfile(): OutboundPolicyProfile {
  const mode = getDeploymentMode();
  const explicit = getExplicitLocalNetworkProxySetting();

  return {
    mode,
    allowLocalNetworkProxy: explicit ?? mode === "local",
  };
}

export function isHostedProxyRestricted(): boolean {
  const profile = getOutboundPolicyProfile();
  return profile.mode === "hosted" && !profile.allowLocalNetworkProxy;
}

/**
 * Whether users may configure custom provider base URLs while running in
 * hosted mode. Off by default so hosted deployments keep pinning providers to
 * their official upstreams; opt in with ALLOW_CUSTOM_PROVIDER_BASE_URL=true for
 * self-hosted deployments that still want hosted-mode protections (request
 * proof, access control, SSRF checks) but need to point at custom or relay
 * OpenAI-compatible endpoints. In local mode custom base URLs are always
 * allowed, so this flag only matters in hosted mode.
 */
export function isCustomProviderBaseUrlAllowed(): boolean {
  if (getDeploymentMode() !== "hosted") return true;
  return parseBooleanEnv(ALLOW_CUSTOM_PROVIDER_BASE_URL_ENV) ?? false;
}

/**
 * Whether server-side shared stores (rate limiting, document parse jobs, plugin
 * registry) may fall back to per-instance in-memory storage while running in
 * hosted mode without Upstash/Redis configured. Off by default so multi-instance
 * hosted deployments are forced to configure a shared store; opt in with
 * ALLOW_MEMORY_STORE_FALLBACK=true for single-instance self-hosted deployments
 * (e.g. a personal Vercel project) that do not want to run Upstash. In local
 * mode the memory fallback is always available, so this flag only matters in
 * hosted mode.
 *
 * Note: in-memory stores are NOT shared across serverless instances. Enabling
 * this on a deployment that scales beyond one instance weakens rate limiting and
 * can cause document parse job polling to miss jobs created on another instance.
 */
export function isMemoryStoreFallbackAllowed(): boolean {
  if (getDeploymentMode() !== "hosted") return true;
  return parseBooleanEnv(ALLOW_MEMORY_STORE_FALLBACK_ENV) ?? false;
}
