import { defineNuxtPlugin, useRoute } from "nuxt/app";
import { useUserStore } from "~/stores/user";

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook("app:beforeMount", async () => {
    const userStore = useUserStore();
    userStore.setIsIframed(window !== window.top);
  });
});
