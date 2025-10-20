import type { LocationQuery } from "#vue-router";
import { useUserStore } from "~/stores/user";
import { getHemocioneIdUrl } from "~/utils/getHemocioneIdUrl";
import type { EnrichedMe } from "~/server/services/hemocioneId";

const getMeWithAuth = (token: string) => {
  return $fetch<EnrichedMe>("/api/v1/me", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

export default defineNuxtRouteMiddleware(async (to, from) => {
  if (import.meta.server) return;

  const isLoggedIn = await evaluateCurrentLogin(from.query);
  const fromQueryHasToken = from.query.token;
  console.log("isLoggedIn", isLoggedIn);
  if (!isLoggedIn) {
    const redirectPath = fromQueryHasToken ? "/" : to.fullPath;
    console.log("redirectPath", redirectPath);
    redirectToID(redirectPath);
    return;
  }
});

export async function evaluateCurrentLogin(query?: LocationQuery) {
  console.log("evaluateCurrentLogin");
  const userStore = useUserStore();
  const config = useRuntimeConfig();

  if (userStore.user && userStore.token) return true; // Already logged in
  console.log("userStore.user", userStore.user);
  console.log("userStore.token", userStore.token);
  const token = getCurrentToken(query);
  console.log("token", token);
  if (!token) return false;
  let tokenIsValid = true;
  console.log("tokenIsValid", tokenIsValid);
  try {
    await $fetch(`${config.public.hemocioneIdApiUrl}/users/validate-token`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (error) {
    tokenIsValid = false;
  }

  if (!tokenIsValid) {
    userStore.setUser(null);
    userStore.setToken(null);
    return false;
  }

  try {
    // Get enriched user data with blood bank information
    const enrichedUserData = await getMeWithAuth(token);

    // User must have at least one blood bank role
    if (!enrichedUserData || !enrichedUserData.bloodBankRoles.length) {
      return false;
    }

    userStore.setUser(enrichedUserData);
    userStore.setToken(token);

    return true;
  } catch (error) {
    userStore.setUser(null);
    userStore.setToken(null);

    return false;
  }
}

export function getCurrentToken(query?: LocationQuery): string | null {
  if (query?.token) {
    return String(query.token);
  }

  const { token } = useUserStore();
  if (token) {
    return token;
  }

  const config = useRuntimeConfig();
  const cookieToken = useCookie(config.public.authCookieKey).value as string;
  return cookieToken;
}

export async function redirectToID(fullPath: string) {
  const config = useRuntimeConfig();
  const redirectUrl = `${config.public.siteUrl}${fullPath}`;
  await navigateTo(getHemocioneIdUrl(redirectUrl), { external: true });
}
