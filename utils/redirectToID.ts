import { getHemocioneIdUrl } from "~/utils/getHemocioneIdUrl";

function removeTokenQueryParameter(fullPath: string) {
  const url = new URL(fullPath, "http://localhost");
  url.searchParams.delete("token");

  return `${url.pathname}${url.search}${url.hash}`;
}

export async function redirectToID(fullPath: string) {
  const config = useRuntimeConfig();
  const origin =
    import.meta.dev && typeof window !== "undefined"
      ? window.location.origin
      : config.public.siteUrl;
  const redirectUrl = `${origin}${removeTokenQueryParameter(fullPath)}`;
  await navigateTo(getHemocioneIdUrl(redirectUrl), { external: true });
}
