import {
  evaluateCurrentLogin,
  isPublicRoute,
  redirectToID,
  routeBypassesBloodbankRoles,
} from "~/middleware/auth";

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook("app:beforeMount", async () => {
    // remove token from url
    const url = new URL(window.location.href);
    if (url.searchParams.has("token")) {
      url.searchParams.delete("token");
      window.history.replaceState({}, document.title, url.toString());
    }

    const route = useRoute();
    const isLoggedIn = await evaluateCurrentLogin(route.query);
    if (isPublicRoute(route.path)) {
      return;
    }

    if (!isLoggedIn) {
      let redirectPath = route.fullPath;
      if (route.query.token) {
        redirectPath = `/${
          route.params.bloodBankSlug ? route.params.bloodBankSlug : ""
        }`;
      }
      await redirectToID(redirectPath);
      return;
    }

    const userStore = useUserStore();
    if (
      !routeBypassesBloodbankRoles(route.fullPath) &&
      !userStore.userHasBloodBankRole
    ) {
      await redirectToID(route.fullPath);
      return;
    }
  });
});
