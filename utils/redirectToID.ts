import { getHemocioneIdUrl } from "~/utils/getHemocioneIdUrl";

export async function redirectToID(fullPath: string) {
  const config = useRuntimeConfig();
  const redirectUrl = `${config.public.siteUrl}${fullPath}`;
  await navigateTo(getHemocioneIdUrl(redirectUrl), { external: true });
}
