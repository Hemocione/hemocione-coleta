import type { LocationQuery } from "#vue-router";
import { useUserStore } from "~/stores/user";
import type { EnrichedMe } from "~/server/services/hemocioneId";
import { decideBloodbankSlugAccess } from "~/utils/decideBloodbankSlugAccess";
import { redirectToID } from "~/utils/redirectToID";

const routeBypassBloodBankRolesPrefixes = ["/agendar", "/sem-acesso"];
export const routeBypassesBloodbankRoles = (route: string) => {
  return routeBypassBloodBankRolesPrefixes.some((prefix) =>
    route.startsWith(prefix)
  );
};

const publicRoutesPrefixes = ["/agendar", "/termo"];
export const isPublicRoute = (route: string) => {
  return publicRoutesPrefixes.some(
    (prefix) => route === prefix || route.startsWith(`${prefix}/`)
  );
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

  const isLoggedIn = await evaluateCurrentLogin(to.query);
  if (isPublicRoute(to.path)) {
    return;
  }

  // A rota raiz e prerenderizada e servida estatica na edge, entao o
  // middleware server-side de redirect nunca roda para ela. Sem este guard,
  // usuario de instituicao logado em "/" era mandado pro Hemocione ID
  // (loop do dogfood ISSUE-004).
  if (to.path === "/") {
    if (!isLoggedIn) {
      await redirectToID(to.fullPath);
      return;
    }
    const rootTarget = useUserStore().firstBloodBankSlug
      ? `/${useUserStore().firstBloodBankSlug}`
      : "/agendar";
    return navigateTo(rootTarget, { replace: true });
  }

  if (!isLoggedIn) {
    await redirectToID(to.fullPath);
    return;
  }
  const userStore = useUserStore();
  if (
    !routeBypassesBloodbankRoles(to.fullPath) &&
    !userStore.userHasBloodBankRole
  ) {
    // user doesn't have any blood bank role, redirect to ID as he's trying to access a route that requires a blood bank role
    await redirectToID(to.fullPath);
    return;
  }

  const retriedRaw = Array.isArray(to.query.retried)
    ? to.query.retried[0]
    : to.query.retried;
  const decision = decideBloodbankSlugAccess({
    bloodbankSlug: to.params.bloodbankSlug as string | undefined,
    fullPath: to.fullPath,
    retried: retriedRaw === "1",
    isBypassRoute: routeBypassesBloodbankRoles(to.fullPath),
    allBloodBankSlugs: userStore.allBloodBankSlugs,
    firstBloodBankSlug: userStore.firstBloodBankSlug,
  });

  if (decision.kind === "redirectToId") {
    await redirectToID(decision.redirectPath);
    return;
  }
  if (decision.kind === "navigateTo") {
    return navigateTo(decision.path, { replace: true });
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
    const validationResponse = await $fetch<
      boolean | { valid?: boolean }
    >(`${config.public.hemocioneIdApiUrl}/users/validate-token`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    tokenIsValid =
      validationResponse !== false &&
      (typeof validationResponse !== "object" ||
        validationResponse === null ||
        validationResponse.valid !== false);
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
    useCookie(config.public.authCookieKey).value = token;

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
