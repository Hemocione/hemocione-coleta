import { defineStore } from "pinia";
import { redirectToID } from "~/utils/redirectToID";
import type { EnrichedMe } from "~/server/services/hemocioneId";

export const useUserStore = defineStore("user", {
  state: () => ({
    user: null as EnrichedMe | null,
    token: null as string | null,
    iframed: false as boolean,
    iframeValidated: false as boolean,
  }),
  getters: {
    loggedIn: (state) => Boolean(state.user),
    userHasBloodBankRole: (state) =>
      Boolean(state.user?.bloodBankRoles?.length),
    firstBloodBankSlug: (state) => {
      const firstRole = state.user?.bloodBankRoles?.[0];
      return firstRole?.slug || null;
    },
    allBloodBankSlugs: (state): string[] => {
      return (
        state.user?.bloodBankRoles
          ?.map((role) => role?.slug)
          .filter((slug): slug is string => Boolean(slug)) ?? []
      );
    },
    currentBloodBankRole: (state) => {
      const route = useRoute();
      const bloodbankSlug = route.params.bloodbankSlug as string;
      return (
        state.user?.bloodBankRoles?.find(
          (role) => role.slug === bloodbankSlug
        ) || null
      );
    },
  },
  actions: {
    setIsIframed(value: boolean) {
      this.iframed = value;
      this.iframeValidated = true;
    },
    setUser(user: EnrichedMe | null) {
      this.user = user;
    },
    setToken(token: string | null) {
      this.token = token;
    },

    async logOut() {
      try {
        this.setToken(null);
        const route = useRoute();
        await redirectToID(route.fullPath);
        // Clear user data
      } catch (error) {
        console.error("🚨 Error during logout:", error);
      }
    },
  },
});
