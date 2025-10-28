import type { LocationQuery } from "#vue-router";
import { useUserStore } from "~/stores/user";
import { getHemocioneIdUrl } from "~/utils/getHemocioneIdUrl";
import type { EnrichedMe } from "~/server/services/hemocioneId";

const routeBypassBloodBankRolesPrefixes = ["/agendar"];
export const routeBypassesBloodbankRoles = (route: string) => {
  return routeBypassBloodBankRolesPrefixes.some((prefix) =>
    route.startsWith(prefix)
  );
};

const publicRoutesPrefixes = ["/agendar"];
export const isPublicRoute = (route: string) => {
  return publicRoutesPrefixes.some((prefix) => route.startsWith(prefix));
};

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
  if (isPublicRoute(to.path)) {
    return;
  }

  if (!isLoggedIn) {
    const redirectPath = fromQueryHasToken ? "/" : to.fullPath;
    redirectToID(redirectPath);
    return;
  }
  const userStore = useUserStore();
  if (
    !routeBypassesBloodbankRoles(to.fullPath) &&
    !userStore.userHasBloodBankRole
  ) {
    // user doesn't have any blood bank role, redirect to ID as he's trying to access a route that requires a blood bank role
    redirectToID(to.fullPath);
    return;
  }
});

export async function evaluateCurrentLogin(query?: LocationQuery) {
  const userStore = useUserStore();
  const config = useRuntimeConfig();

  if (userStore.user && userStore.token) return true; // Already logged in

  const token = getCurrentToken(query);
  if (!token) return false;
  let tokenIsValid = true;

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
    if (!enrichedUserData) {
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
