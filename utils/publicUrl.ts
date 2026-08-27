const PRODUCTION_SITE_URL = "https://coleta.hemocione.com.br";

function normalizeBaseUrl(value: string): string {
  const withProtocol = /^https?:\/\//i.test(value)
    ? value
    : `https://${value}`;

  return withProtocol.replace(/\/+$/, "");
}

function getDevelopmentNetworkUrl(): string | undefined {
  const nuxtDevConfig = process.env.__NUXT_DEV__;
  if (!nuxtDevConfig) return undefined;

  try {
    const parsedConfig = JSON.parse(nuxtDevConfig);
    return parsedConfig?.proxy?.urls?.find(
      (address: { type?: string; url?: string }) => address.type === "network"
    )?.url;
  } catch {
    return undefined;
  }
}

export function getPublicBaseUrl(): string {
  const configuredBaseUrl = process.env.NUXT_PUBLIC_BASE_URL?.trim();
  if (configuredBaseUrl) return normalizeBaseUrl(configuredBaseUrl);

  if (process.env.VERCEL_ENV === "production") {
    return PRODUCTION_SITE_URL;
  }

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) return normalizeBaseUrl(vercelUrl);

  return getDevelopmentNetworkUrl() || "http://localhost:3000";
}

export function buildPublicUrl(path: string): string {
  return new URL(path, `${getPublicBaseUrl()}/`).toString();
}
