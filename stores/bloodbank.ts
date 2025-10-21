import { defineStore } from "pinia";
import { fetchWithAuth } from "~/composables/useFetchWithAuth";

// Types
export interface BloodbankData {
  id: string;
  name: string;
  slug: string;
  bloodBanksLocationId: string;
  logo?: string | null;
  location?: {
    type: "Point";
    coordinates: number[]; // [lng, lat]
  } | null;
  coverageArea?: {
    type: "Polygon";
    coordinates: any;
  } | null;
  hasLocation: boolean;
  hasCoverageArea: boolean;
}

export interface CoverageArea {
  id: string;
  coordinates: [number, number][]; // [lat, lng]
  center: {
    lat: number;
    lng: number;
  };
  area: number;
}

export interface Team {
  _id: string;
  bloodBanksLocationId: string;
  name: string;
  color: string;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RestrictionItem {
  slug: string;
  title: string;
  description: string;
}

export const useBloodbankStore = defineStore("bloodbank", {
  state: () => ({
    bloodbankData: null as BloodbankData | null,
    currentCoverageArea: null as CoverageArea | null,
    teams: [] as Team[],
    restrictionChecklist: [] as RestrictionItem[],
    isLoading: false,
    isSaving: false,
    isLoadingTeams: false,
    isLoadingRestrictions: false,
    error: null as string | null,
  }),

  getters: {
    hasCoverageArea: (state) => {
      return state.bloodbankData?.hasCoverageArea || false;
    },
    hasLocation: (state) => {
      return state.bloodbankData?.hasLocation || false;
    },
    canSave: (state) => {
      return state.currentCoverageArea && !state.isSaving;
    },
  },

  actions: {
    async loadBloodbankData(bloodBanksLocationId: string) {
      this.isLoading = true;
      this.error = null;

      try {
        const response = await fetchWithAuth(
          `/api/v1/bloodbank/${bloodBanksLocationId}/coverage`
        );

        if (response.success) {
          this.bloodbankData = response.data;
          return response.data;
        } else {
          throw new Error("Failed to load bloodbank data");
        }
      } catch (error: any) {
        this.error = error.message || "Error loading bloodbank data";
        console.error("Error loading bloodbank data:", error);
        throw error;
      } finally {
        this.isLoading = false;
      }
    },

    async saveCoverageArea(
      bloodBanksLocationId: string,
      coverageArea: CoverageArea
    ) {
      this.isSaving = true;
      this.error = null;

      try {
        const response = await fetchWithAuth(
          `/api/v1/bloodbank/${bloodBanksLocationId}/coverage`,
          {
            method: "PUT",
            body: {
              coverageArea: {
                type: "Polygon",
                coordinates: [coverageArea.coordinates], // Keep as [lng, lat] format
              },
            },
          }
        );

        if (response.success) {
          this.bloodbankData = response.data;
          return response.data;
        } else {
          throw new Error("Failed to save coverage area");
        }
      } catch (error: any) {
        this.error = error.message || "Error saving coverage area";
        console.error("Error saving coverage area:", error);
        throw error;
      } finally {
        this.isSaving = false;
      }
    },

    setCurrentCoverageArea(coverageArea: CoverageArea | null) {
      this.currentCoverageArea = coverageArea;
    },

    clearCurrentCoverageArea() {
      this.currentCoverageArea = null;
    },

    setError(error: string | null) {
      this.error = error;
    },

    clearError() {
      this.error = null;
    },

    // Team management actions
    async loadTeams(bloodBanksLocationId: string) {
      this.isLoadingTeams = true;
      this.error = null;

      try {
        const response = await fetchWithAuth(
          `/api/v1/bloodbank/${bloodBanksLocationId}/teams`
        );

        if (response.success) {
          this.teams = response.data;
          return response.data;
        } else {
          throw new Error("Failed to load teams");
        }
      } catch (error: any) {
        this.error = error.message || "Error loading teams";
        console.error("Error loading teams:", error);
        throw error;
      } finally {
        this.isLoadingTeams = false;
      }
    },

    async createTeam(
      bloodBanksLocationId: string,
      name: string,
      color: string
    ) {
      this.isLoadingTeams = true;
      this.error = null;

      try {
        const response = await fetchWithAuth(
          `/api/v1/bloodbank/${bloodBanksLocationId}/teams`,
          {
            method: "POST",
            body: { name, color },
          }
        );

        if (response.success) {
          this.teams.push(response.data);
          return response.data;
        } else {
          throw new Error("Failed to create team");
        }
      } catch (error: any) {
        this.error = error.message || "Error creating team";
        console.error("Error creating team:", error);
        throw error;
      } finally {
        this.isLoadingTeams = false;
      }
    },

    async updateTeam(
      bloodBanksLocationId: string,
      teamId: string,
      updates: { name?: string; color?: string }
    ) {
      this.error = null;

      // Update local state immediately for instant UI feedback
      const teamIndex = this.teams.findIndex((team) => team._id === teamId);
      if (teamIndex !== -1) {
        this.teams[teamIndex] = { ...this.teams[teamIndex], ...updates };
      }

      try {
        const response = await fetchWithAuth(
          `/api/v1/bloodbank/${bloodBanksLocationId}/teams/${teamId}`,
          {
            method: "PUT",
            body: updates,
          }
        );

        if (response.success) {
          // Update with server response to ensure consistency
          if (teamIndex !== -1) {
            this.teams[teamIndex] = response.data;
          }
          return response.data;
        } else {
          throw new Error("Failed to update team");
        }
      } catch (error: any) {
        // Revert local changes on error
        if (teamIndex !== -1) {
          // We could reload the team from server here, but for now just log the error
          console.error(
            "Error updating team, local state may be inconsistent:",
            error
          );
        }
        this.error = error.message || "Error updating team";
        console.error("Error updating team:", error);
        throw error;
      }
    },

    async deleteTeam(bloodBanksLocationId: string, teamId: string) {
      this.isLoadingTeams = true;
      this.error = null;

      try {
        const response = await fetchWithAuth(
          `/api/v1/bloodbank/${bloodBanksLocationId}/teams/${teamId}`,
          {
            method: "DELETE",
          }
        );

        if (response.success) {
          this.teams = this.teams.filter((team) => team._id !== teamId);
          return true;
        } else {
          throw new Error("Failed to delete team");
        }
      } catch (error: any) {
        this.error = error.message || "Error deleting team";
        console.error("Error deleting team:", error);
        throw error;
      } finally {
        this.isLoadingTeams = false;
      }
    },

    // Restriction Checklist Actions
    async loadRestrictionChecklist(bloodBanksLocationId: string) {
      this.isLoadingRestrictions = true;
      this.error = null;

      try {
        const response = await fetchWithAuth(
          `/api/v1/bloodbank/${bloodBanksLocationId}/restrictions`
        );

        if (response.success) {
          this.restrictionChecklist = response.data as RestrictionItem[];
          return response.data;
        } else {
          throw new Error("Failed to load restriction checklist");
        }
      } catch (error: any) {
        this.error = error.message || "Error loading restriction checklist";
        console.error("Error loading restriction checklist:", error);
        throw error;
      } finally {
        this.isLoadingRestrictions = false;
      }
    },

    async addRestrictionItem(
      bloodBanksLocationId: string,
      title: string,
      description: string
    ) {
      this.isLoadingRestrictions = true;
      this.error = null;

      try {
        const response = await fetchWithAuth(
          `/api/v1/bloodbank/${bloodBanksLocationId}/restrictions`,
          {
            method: "POST",
            body: { title, description },
          }
        );

        if (response.success) {
          this.restrictionChecklist = response.data as RestrictionItem[];
          return response.data;
        } else {
          throw new Error("Failed to add restriction item");
        }
      } catch (error: any) {
        this.error = error.message || "Error adding restriction item";
        console.error("Error adding restriction item:", error);
        throw error;
      } finally {
        this.isLoadingRestrictions = false;
      }
    },

    async updateRestrictionItem(
      bloodBanksLocationId: string,
      slug: string,
      updates: { title?: string; description?: string }
    ) {
      this.error = null;

      // Update local state immediately for instant UI feedback
      const itemIndex = this.restrictionChecklist.findIndex(
        (item) => item.slug === slug
      );
      if (itemIndex !== -1) {
        this.restrictionChecklist[itemIndex] = {
          ...this.restrictionChecklist[itemIndex],
          ...updates,
        };
      }

      try {
        const response = await fetchWithAuth(
          `/api/v1/bloodbank/${bloodBanksLocationId}/restrictions/${slug}`,
          {
            method: "PUT",
            body: updates,
          }
        );

        if (response.success) {
          // Update with server response to ensure consistency
          this.restrictionChecklist = response.data as RestrictionItem[];
          return response.data;
        } else {
          throw new Error("Failed to update restriction item");
        }
      } catch (error: any) {
        // Revert local changes on error by reloading from server
        try {
          await this.loadRestrictionChecklist(bloodBanksLocationId);
        } catch (reloadError) {
          console.error("Error reloading restriction checklist:", reloadError);
        }
        this.error = error.message || "Error updating restriction item";
        console.error("Error updating restriction item:", error);
        throw error;
      }
    },

    async deleteRestrictionItem(bloodBanksLocationId: string, slug: string) {
      this.isLoadingRestrictions = true;
      this.error = null;

      try {
        const response = await fetchWithAuth(
          `/api/v1/bloodbank/${bloodBanksLocationId}/restrictions/${slug}`,
          {
            method: "DELETE",
          }
        );

        if (response.success) {
          this.restrictionChecklist = response.data as RestrictionItem[];
          return true;
        } else {
          throw new Error("Failed to delete restriction item");
        }
      } catch (error: any) {
        this.error = error.message || "Error deleting restriction item";
        console.error("Error deleting restriction item:", error);
        throw error;
      } finally {
        this.isLoadingRestrictions = false;
      }
    },
  },
});
