import { evaluateCurrentLogin, redirectToID } from "~/middleware/auth";

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook("app:beforeMount", async () => {
    const route = useRoute();
    const isLoggedIn = await evaluateCurrentLogin(route.query);
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
    // remove token from url
    const url = new URL(window.location.href);
    url.searchParams.delete("token");
    window.history.replaceState({}, document.title, url.toString());
  });
});
