import { defineStore } from "pinia";
import { fetchWithAuth } from "~/composables/useFetchWithAuth";

// Types
export interface BloodbankData {
  _id: string;
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
  timezone: string;
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

export interface Slot {
  _id: string;
  teamId: string;
  startTime: Date;
  endTime: Date;
  locked: boolean;
  startTimeStr?: string;
  endTimeStr?: string;
}

export interface AvailableDate {
  _id: string;
  bloodBanksLocationId: string;
  date: string;
  year: number;
  isAllTeams: boolean;
  slots: Slot[];
  allSlotsLocked?: boolean; // virtual
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const useBloodbankStore = defineStore("bloodbank", {
  state: () => ({
    bloodbankData: null as BloodbankData | null,
    currentCoverageArea: null as CoverageArea | null,
    teams: [] as Team[],
    restrictionChecklist: [] as RestrictionItem[],
    availableDates: [] as AvailableDate[],
    isLoading: false,
    isSaving: false,
    isLoadingTeams: false,
    isLoadingRestrictions: false,
    isLoadingAvailableDates: false,
    error: null as string | null,
  }),

  getters: {
    bloodbank: (state) => {
      return state.bloodbankData;
    },
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
    getAvailableDateByDate(dateStr: string) {
      return this.availableDates.find((ad) => ad.date === dateStr);
    },
    getAvailableDatesForMonth(year: number, month: number) {
      return this.availableDates.filter((ad) => {
        if (ad.year !== year) return false;
        // Extract month from date string (YYYY-MM-DD format)
        const dateMonth = parseInt(ad.date.split("-")[1]);
        return dateMonth === month;
      });
    },
    async loadBloodbankData(bloodBanksLocationId: string) {
      this.isLoading = true;
      this.error = null;

      try {
        const response = await fetchWithAuth(
          `/api/v1/bloodbank/${bloodBanksLocationId}/coverage`
        );

        if (response.success) {
          this.bloodbankData = {
            ...response.data,
            _id: (response.data as any).id || (response.data as any)._id || "",
          };
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
          this.bloodbankData = {
            ...response.data,
            _id: (response.data as any).id || (response.data as any)._id || "",
          };
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
    async loadTeams(
      bloodBanksLocationId: string,
      forceRefresh: boolean = true
    ) {
      if (!forceRefresh && this.teams.length > 0) {
        return this.teams;
      }

      this.isLoadingTeams = true;
      this.error = null;

      try {
        const response = await fetchWithAuth(
          `/api/v1/bloodbank/${bloodBanksLocationId}/teams`
        );

        if (response.success) {
          this.teams = response.data.map((team: any) => ({
            ...team,
            deletedAt: team.deletedAt ? new Date(team.deletedAt) : null,
            createdAt: new Date(team.createdAt),
            updatedAt: new Date(team.updatedAt),
          }));
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
          const newTeam = {
            ...response.data,
            deletedAt: response.data.deletedAt
              ? new Date(response.data.deletedAt)
              : null,
            createdAt: new Date(response.data.createdAt),
            updatedAt: new Date(response.data.updatedAt),
          };
          this.teams.push(newTeam);
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
            this.teams[teamIndex] = {
              ...response.data,
              deletedAt: response.data.deletedAt
                ? new Date(response.data.deletedAt)
                : null,
              createdAt: new Date(response.data.createdAt),
              updatedAt: new Date(response.data.updatedAt),
            };
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

    // AvailableDates Actions
    async loadAvailableDates(
      bloodBanksLocationId: string,
      year: number,
      month: number
    ) {
      this.isLoadingAvailableDates = true;
      this.error = null;

      try {
        const response = await fetchWithAuth(
          `/api/v1/bloodbank/${bloodBanksLocationId}/available-dates?year=${year}&month=${month}`
        );
        console.log("response", response);

        if (response.success) {
          this.availableDates = response.data.map((ad: any) => ({
            ...ad,
            date: ad.date, // Already a string
            deletedAt: ad.deletedAt ? new Date(ad.deletedAt) : undefined,
            createdAt: new Date(ad.createdAt),
            updatedAt: new Date(ad.updatedAt),
            slots: ad.slots.map((slot: any) => ({
              ...slot,
              startTime: new Date(slot.startTime),
              endTime: new Date(slot.endTime),
            })),
          }));
          return response.data;
        } else {
          throw new Error("Failed to load available dates");
        }
      } catch (error: any) {
        this.error = error.message || "Error loading available dates";
        console.error("Error loading available dates:", error);
        throw error;
      } finally {
        this.isLoadingAvailableDates = false;
      }
    },

    async createAvailableDate(bloodBanksLocationId: string, payload: any) {
      this.isLoadingAvailableDates = true;
      this.error = null;

      try {
        const response = await fetchWithAuth(
          `/api/v1/bloodbank/${bloodBanksLocationId}/available-dates`,
          {
            method: "POST",
            body: payload,
          }
        );

        if (response.success) {
          const newAvailableDate = {
            ...response.data,
            date: response.data.date, // Already a string
            deletedAt: response.data.deletedAt
              ? new Date(response.data.deletedAt)
              : undefined,
            createdAt: new Date(response.data.createdAt),
            updatedAt: new Date(response.data.updatedAt),
            slots: response.data.slots.map((slot: any) => ({
              ...slot,
              startTime: new Date(slot.startTime),
              endTime: new Date(slot.endTime),
            })),
          };
          this.availableDates.push(newAvailableDate);
          return response.data;
        } else {
          throw new Error("Failed to create available date");
        }
      } catch (error: any) {
        this.error = error.message || "Error creating available date";
        console.error("Error creating available date:", error);
        throw error;
      } finally {
        this.isLoadingAvailableDates = false;
      }
    },

    async updateSlot(
      bloodBanksLocationId: string,
      availableDateId: string,
      slotId: string,
      updates: any
    ) {
      this.error = null;

      // Optimistic update
      const availableDateIndex = this.availableDates.findIndex(
        (ad) => ad._id === availableDateId
      );
      if (availableDateIndex !== -1) {
        const slotIndex = this.availableDates[
          availableDateIndex
        ].slots.findIndex((slot) => slot._id === slotId);
        if (slotIndex !== -1) {
          this.availableDates[availableDateIndex].slots[slotIndex] = {
            ...this.availableDates[availableDateIndex].slots[slotIndex],
            ...updates,
          };
        }
      }

      try {
        const response = await fetchWithAuth(
          `/api/v1/bloodbank/${bloodBanksLocationId}/available-dates/${availableDateId}/slots/${slotId}`,
          {
            method: "PUT",
            body: updates,
          }
        );

        if (response.success) {
          // Update with server response
          if (availableDateIndex !== -1) {
            this.availableDates[availableDateIndex] = {
              ...response.data,
              date: response.data.date, // Already a string
              deletedAt: response.data.deletedAt
                ? new Date(response.data.deletedAt)
                : undefined,
              createdAt: new Date(response.data.createdAt),
              updatedAt: new Date(response.data.updatedAt),
              slots: response.data.slots.map((slot: any) => ({
                ...slot,
                startTime: new Date(slot.startTime),
                endTime: new Date(slot.endTime),
              })),
            };
          }
          return response.data;
        } else {
          throw new Error("Failed to update slot");
        }
      } catch (error: any) {
        // Revert optimistic update
        if (availableDateIndex !== -1) {
          // Reload from server
          try {
            await this.loadAvailableDates(
              bloodBanksLocationId,
              new Date().getFullYear(),
              new Date().getMonth()
            );
          } catch (reloadError) {
            console.error("Error reloading available dates:", reloadError);
          }
        }
        this.error = error.message || "Error updating slot";
        console.error("Error updating slot:", error);
        throw error;
      }
    },

    async addTeamsToDate(
      bloodBanksLocationId: string,
      availableDateId: string,
      teamIds: string[],
      times: { defaultStartTime: string; defaultEndTime: string }
    ) {
      this.error = null;

      try {
        const response = await fetchWithAuth(
          `/api/v1/bloodbank/${bloodBanksLocationId}/available-dates/${availableDateId}/slots`,
          {
            method: "POST",
            body: {
              teamIds,
              ...times,
            },
          }
        );

        if (response.success) {
          // Update local state
          const availableDateIndex = this.availableDates.findIndex(
            (ad) => ad._id === availableDateId
          );
          if (availableDateIndex !== -1) {
            this.availableDates[availableDateIndex] = {
              ...response.data,
              date: response.data.date, // Already a string
              deletedAt: response.data.deletedAt
                ? new Date(response.data.deletedAt)
                : undefined,
              createdAt: new Date(response.data.createdAt),
              updatedAt: new Date(response.data.updatedAt),
              slots: response.data.slots.map((slot: any) => ({
                ...slot,
                startTime: new Date(slot.startTime),
                endTime: new Date(slot.endTime),
              })),
            };
          }
          return response.data;
        } else {
          throw new Error("Failed to add teams to date");
        }
      } catch (error: any) {
        this.error = error.message || "Error adding teams to date";
        console.error("Error adding teams to date:", error);
        throw error;
      }
    },

    async removeSlotFromDate(
      bloodBanksLocationId: string,
      availableDateId: string,
      slotId: string
    ) {
      this.error = null;

      // Optimistic update
      const availableDateIndex = this.availableDates.findIndex(
        (ad) => ad._id === availableDateId
      );
      if (availableDateIndex !== -1) {
        this.availableDates[availableDateIndex].slots = this.availableDates[
          availableDateIndex
        ].slots.filter((slot) => slot._id !== slotId);
      }

      try {
        const response = await fetchWithAuth(
          `/api/v1/bloodbank/${bloodBanksLocationId}/available-dates/${availableDateId}/slots/${slotId}`,
          {
            method: "DELETE",
          }
        );

        if (response.success) {
          // Update with server response
          if (availableDateIndex !== -1) {
            this.availableDates[availableDateIndex] = {
              ...response.data,
              date: response.data.date, // Already a string
              deletedAt: response.data.deletedAt
                ? new Date(response.data.deletedAt)
                : undefined,
              createdAt: new Date(response.data.createdAt),
              updatedAt: new Date(response.data.updatedAt),
              slots: response.data.slots.map((slot: any) => ({
                ...slot,
                startTime: new Date(slot.startTime),
                endTime: new Date(slot.endTime),
              })),
            };
          }
          return response.data;
        } else {
          throw new Error("Failed to remove slot from date");
        }
      } catch (error: any) {
        // Revert optimistic update
        if (availableDateIndex !== -1) {
          try {
            await this.loadAvailableDates(
              bloodBanksLocationId,
              new Date().getFullYear(),
              new Date().getMonth()
            );
          } catch (reloadError) {
            console.error("Error reloading available dates:", reloadError);
          }
        }
        this.error = error.message || "Error removing slot from date";
        console.error("Error removing slot from date:", error);
        throw error;
      }
    },

    async deleteAvailableDate(
      bloodBanksLocationId: string,
      availableDateId: string
    ) {
      this.isLoadingAvailableDates = true;
      this.error = null;

      try {
        const response = await fetchWithAuth(
          `/api/v1/bloodbank/${bloodBanksLocationId}/available-dates/${availableDateId}`,
          {
            method: "DELETE",
          }
        );

        if (response.success) {
          this.availableDates = this.availableDates.filter(
            (ad) => ad._id !== availableDateId
          );
          return true;
        } else {
          throw new Error("Failed to delete available date");
        }
      } catch (error: any) {
        this.error = error.message || "Error deleting available date";
        console.error("Error deleting available date:", error);
        throw error;
      } finally {
        this.isLoadingAvailableDates = false;
      }
    },
  },
});
