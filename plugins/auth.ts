export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook("app:beforeMount", () => {
    const url = new URL(window.location.href);
    if (url.searchParams.has("token")) {
      url.searchParams.delete("token");
      window.history.replaceState({}, document.title, url.toString());
    }
  });
});
