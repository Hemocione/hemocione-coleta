import { defineStore } from "pinia";
import { redirectToID } from "~/middleware/auth";
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
    allBloodBankSlugs: (state) => {
      return (
        state.user?.bloodBankRoles?.map((role) => role?.slug).filter(Boolean) ||
        []
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
        await redirectToID("/");
        // Clear user data
      } catch (error) {
        console.error("🚨 Error during logout:", error);
      }
    },
  },
});
