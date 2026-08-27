import { defineStore } from "pinia";
import { fetchWithAuth } from "~/composables/useFetchWithAuth";
import type { AvailableDateStatus } from "~/utils/availableDateStatus";

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
  lockedBy?: string | null;
  startTimeStr?: string;
  endTimeStr?: string;
}

export interface AvailableDate {
  _id: string;
  bloodBanksLocationId: string;
  date: string;
  year: number;
  isAllTeams: boolean;
  status?: AvailableDateStatus;
  slots: Slot[];
  allSlotsLocked?: boolean; // virtual
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface StructuredAddress {
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
}

export interface CollectionRequest {
  _id: string;
  institutionId: string;
  institutionName: string;
  institutionLocation: {
    type: "Point";
    coordinates: [number, number];
  } | null;
  institutionAddress: string;
  institutionLogo?: string;
  institutionBanner?: string;
  requestedByUserId: string;
  bloodBanksLocationId: string;
  availableSlotOptions: Array<{
    availableDateId: string;
    slotId: string;
    date: string;
    startTime?: Date;
    endTime?: Date;
    teamName?: string;
    teamColor?: string;
    isLocked?: boolean;
    isRequested?: boolean;
    priority?: number;
  }>;
  host: {
    name: string;
    email: string;
    phone: string;
  };
  address?: StructuredAddress;
  note?: string;
  accessToken?: string;
  selectedAvailableDateId?: string;
  selectedSlotId?: string;
  counterProposal?: {
    proposedDates: Array<{
      date: string;
      startTime: string;
      endTime?: string;
      durationMinutes?: number;
      teamName?: string;
      note: string;
    }>;
    needsTechnicalVisit: boolean;
    note: string;
    proposedBy: string;
    proposedAt: string;
  };
  confirmedSchedule?: {
    date: string | Date;
    startTime: string;
    endTime: string;
    durationMinutes: number;
    teamName?: string;
  };
  visitProposal?: {
    proposedDates: Array<{
      date: string;
      startTime: string;
      endTime?: string;
      durationMinutes?: number;
      teamName?: string;
      note: string;
    }>;
    note: string;
    proposedBy: string;
    proposedAt: string;
  };
  technicalVisitId?: string;
  status:
    | "pending"
    | "institution_needs_validation"
    | "accepted"
    | "rejected"
    | "cancelled"
    | "counter_proposed"
    | "counter_proposal_declined"
    | "awaiting_technical_visit"
    | "technical_visit_confirmed"
    | "scheduled";
  rejectionReason?: string;
  statusHistory: Array<{
    status: string;
    changedAt: Date;
    changedBy?: string;
    reason?: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CollectionRequestsPagination {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface DashboardCollection {
  _id: string;
  institutionName: string;
  institutionLocation: {
    type: "Point";
    coordinates: [number, number];
  } | null;
  institutionAddress: string;
  institutionLogo?: string;
  institutionBanner?: string;
  date: string;
  startTime?: Date;
  endTime?: Date;
  teamName: string;
  teamColor: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DashboardData {
  upcomingCollections: DashboardCollection[];
  pendingRequestsCount: number;
  nextCollection: DashboardCollection | null;
}

export const useBloodbankStore = defineStore("bloodbank", {
  state: () => ({
    bloodbankData: null as BloodbankData | null,
    currentCoverageArea: null as CoverageArea | null,
    teams: [] as Team[],
    restrictionChecklist: [] as RestrictionItem[],
    availableDates: [] as AvailableDate[],
    collectionRequests: {
      data: [] as CollectionRequest[],
      pagination: {
        total: 0,
        page: 1,
        limit: 20,
        pages: 0,
      } as CollectionRequestsPagination,
    },
    currentCollectionRequest: null as CollectionRequest | null,
    dashboardData: null as DashboardData | null,
    isLoading: false,
    isSaving: false,
    isLoadingTeams: false,
    isLoadingRestrictions: false,
    isLoadingAvailableDates: false,
    isLoadingCollectionRequests: false,
    isLoadingDashboard: false,
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
    async loadBloodbankData(
      bloodBanksLocationId: string,
      noNeedToRefresh: boolean = false
    ) {
      if (!noNeedToRefresh && this.bloodbankData) {
        return this.bloodbankData;
      }
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

    async updateAvailableDateStatus(
      bloodBanksLocationId: string,
      availableDateId: string,
      status: AvailableDateStatus
    ) {
      this.error = null;

      try {
        const response = await fetchWithAuth(
          `/api/v1/bloodbank/${bloodBanksLocationId}/available-dates/${availableDateId}`,
          {
            method: "PATCH",
            body: { status },
          }
        );

        if (response.success) {
          const availableDateIndex = this.availableDates.findIndex(
            (ad) => ad._id === availableDateId
          );
          if (availableDateIndex !== -1) {
            this.availableDates[availableDateIndex] = {
              ...response.data,
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
          throw new Error("Failed to update available date status");
        }
      } catch (error: any) {
        this.error = error.message || "Error updating available date status";
        console.error("Error updating available date status:", error);
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

    // Collection Requests Actions
    async loadCollectionRequests(
      bloodBanksLocationId: string,
      filters: { status?: string; dateFrom?: string; dateTo?: string } = {},
      page: number = 1
    ) {
      this.isLoadingCollectionRequests = true;
      this.error = null;

      try {
        const queryParams = new URLSearchParams();
        if (filters.status) queryParams.append("status", filters.status);
        if (filters.dateFrom) queryParams.append("dateFrom", filters.dateFrom);
        if (filters.dateTo) queryParams.append("dateTo", filters.dateTo);
        queryParams.append("page", page.toString());
        queryParams.append("limit", "20");

        const response = await fetchWithAuth(
          `/api/v1/bloodbank/${bloodBanksLocationId}/collection-requests?${queryParams.toString()}`
        );

        if (response.success) {
          this.collectionRequests = {
            data: response.data.map((request: any) => ({
              ...request,
              createdAt: new Date(request.createdAt),
              updatedAt: new Date(request.updatedAt),
              availableSlotOptions: request.availableSlotOptions.map(
                (slot: any) => ({
                  ...slot,
                  startTime: slot.startTime
                    ? new Date(slot.startTime)
                    : undefined,
                  endTime: slot.endTime ? new Date(slot.endTime) : undefined,
                })
              ),
              statusHistory: request.statusHistory.map((sh: any) => ({
                ...sh,
                changedAt: new Date(sh.changedAt),
              })),
            })),
            pagination: response.pagination,
          };
          return response.data;
        } else {
          throw new Error("Failed to load collection requests");
        }
      } catch (error: any) {
        this.error = error.message || "Error loading collection requests";
        console.error("Error loading collection requests:", error);
        throw error;
      } finally {
        this.isLoadingCollectionRequests = false;
      }
    },

    async loadCollectionRequestById(
      requestId: string,
      bloodBanksLocationId: string
    ) {
      this.isLoadingCollectionRequests = true;
      this.error = null;

      try {
        const response = await fetchWithAuth(
          `/api/v1/bloodbank/${bloodBanksLocationId}/collection-requests/${requestId}`
        );

        if (response.success) {
          this.currentCollectionRequest = {
            ...response.data,
            createdAt: new Date(response.data.createdAt),
            updatedAt: new Date(response.data.updatedAt),
            availableSlotOptions: response.data.availableSlotOptions.map(
              (slot: any) => ({
                ...slot,
                startTime: slot.startTime
                  ? new Date(slot.startTime)
                  : undefined,
                endTime: slot.endTime ? new Date(slot.endTime) : undefined,
              })
            ),
            statusHistory: response.data.statusHistory.map((sh: any) => ({
              ...sh,
              changedAt: new Date(sh.changedAt),
            })),
          };
          return response.data;
        } else {
          throw new Error("Failed to load collection request");
        }
      } catch (error: any) {
        this.error = error.message || "Error loading collection request";
        console.error("Error loading collection request:", error);
        throw error;
      } finally {
        this.isLoadingCollectionRequests = false;
      }
    },

    async acceptCollectionRequest(
      requestId: string,
      selectedAvailableDateId: string,
      selectedSlotId: string,
      bloodBanksLocationId: string
    ) {
      this.error = null;

      try {
        const response = await fetchWithAuth(
          `/api/v1/bloodbank/${bloodBanksLocationId}/collection-requests/${requestId}/accept`,
          {
            method: "POST",
            body: {
              selectedAvailableDateId,
              selectedSlotId,
            },
          }
        );

        if (response.success) {
          // Remove the request from the current list since its status changed
          this.collectionRequests.data = this.collectionRequests.data.filter(
            (req) => req._id !== requestId
          );
          this.collectionRequests.pagination.total = Math.max(
            0,
            this.collectionRequests.pagination.total - 1
          );

          // Update current collection request if it's the same
          if (this.currentCollectionRequest?._id === requestId) {
            this.currentCollectionRequest = {
              ...response.data,
              createdAt: new Date(response.data.createdAt),
              updatedAt: new Date(response.data.updatedAt),
              availableSlotOptions: response.data.availableSlotOptions.map(
                (slot: any) => ({
                  ...slot,
                  startTime: slot.startTime,
                  endTime: slot.endTime,
                })
              ),
              statusHistory: response.data.statusHistory.map((sh: any) => ({
                ...sh,
                changedAt: new Date(sh.changedAt),
              })),
            };
          }

          // Decrement pending requests count in dashboard
          if (this.dashboardData && this.dashboardData.pendingRequestsCount > 0) {
            this.dashboardData.pendingRequestsCount--;
          }

          return response.data;
        } else {
          throw new Error("Failed to accept collection request");
        }
      } catch (error: any) {
        this.error = error.message || "Error accepting collection request";
        console.error("Error accepting collection request:", error);
        throw error;
      }
    },

    async rejectCollectionRequest(
      requestId: string,
      rejectionReason: string,
      bloodBanksLocationId: string
    ) {
      this.error = null;

      try {
        const response = await fetchWithAuth(
          `/api/v1/bloodbank/${bloodBanksLocationId}/collection-requests/${requestId}/reject`,
          {
            method: "POST",
            body: {
              rejectionReason,
            },
          }
        );

        if (response.success) {
          // Remove the request from the current list since its status changed
          this.collectionRequests.data = this.collectionRequests.data.filter(
            (req) => req._id !== requestId
          );
          this.collectionRequests.pagination.total = Math.max(
            0,
            this.collectionRequests.pagination.total - 1
          );

          // Update current collection request if it's the same
          if (this.currentCollectionRequest?._id === requestId) {
            this.currentCollectionRequest = {
              ...response.data,
              createdAt: new Date(response.data.createdAt),
              updatedAt: new Date(response.data.updatedAt),
              availableSlotOptions: response.data.availableSlotOptions.map(
                (slot: any) => ({
                  ...slot,
                  startTime: slot.startTime,
                  endTime: slot.endTime,
                })
              ),
              statusHistory: response.data.statusHistory.map((sh: any) => ({
                ...sh,
                changedAt: new Date(sh.changedAt),
              })),
            };
          }

          // Decrement pending requests count in dashboard
          if (this.dashboardData && this.dashboardData.pendingRequestsCount > 0) {
            this.dashboardData.pendingRequestsCount--;
          }

          return response.data;
        } else {
          throw new Error("Failed to reject collection request");
        }
      } catch (error: any) {
        this.error = error.message || "Error rejecting collection request";
        console.error("Error rejecting collection request:", error);
        throw error;
      }
    },

    async counterProposeCollectionRequest(
      requestId: string,
      data: {
        proposedDates: Array<{
          date: string;
          startTime: string;
          endTime?: string;
          durationMinutes: number;
          teamName?: string;
          note: string;
        }>;
        needsTechnicalVisit: boolean;
        note: string;
      },
      bloodBanksLocationId: string
    ) {
      this.error = null;

      try {
        const response = await fetchWithAuth(
          `/api/v1/bloodbank/${bloodBanksLocationId}/collection-requests/${requestId}/counter-propose`,
          {
            method: "POST",
            body: data,
          }
        );

        if (response.success) {
          this.collectionRequests.data = this.collectionRequests.data.filter(
            (req) => req._id !== requestId
          );
          this.collectionRequests.pagination.total = Math.max(
            0,
            this.collectionRequests.pagination.total - 1
          );

          if (this.currentCollectionRequest?._id === requestId) {
            this.currentCollectionRequest = {
              ...response.data,
              createdAt: new Date(response.data.createdAt),
              updatedAt: new Date(response.data.updatedAt),
              availableSlotOptions: response.data.availableSlotOptions.map(
                (slot: any) => ({
                  ...slot,
                  startTime: slot.startTime,
                  endTime: slot.endTime,
                })
              ),
              statusHistory: response.data.statusHistory.map((sh: any) => ({
                ...sh,
                changedAt: new Date(sh.changedAt),
              })),
            };
          }

          if (this.dashboardData && this.dashboardData.pendingRequestsCount > 0) {
            this.dashboardData.pendingRequestsCount--;
          }

          return response.data;
        } else {
          throw new Error("Failed to send counter proposal");
        }
      } catch (error: any) {
        this.error = error.message || "Error sending counter proposal";
        console.error("Error sending counter proposal:", error);
        throw error;
      }
    },

    async proposeTechnicalVisit(
      requestId: string,
      data: {
        proposedDates: Array<{
          date: string;
          startTime: string;
          endTime?: string;
          durationMinutes: number;
          teamName?: string;
          note: string;
        }>;
        note: string;
      },
      bloodBanksLocationId: string
    ) {
      this.error = null;

      try {
        const response = await fetchWithAuth(
          `/api/v1/bloodbank/${bloodBanksLocationId}/collection-requests/${requestId}/propose-technical-visit`,
          {
            method: "POST",
            body: data,
          }
        );

        if (response.success) {
          if (this.currentCollectionRequest?._id === requestId) {
            this.currentCollectionRequest = {
              ...this.currentCollectionRequest,
              ...response.data,
            };
          }

          return response.data;
        }

        throw new Error("Failed to send technical visit proposal");
      } catch (error: any) {
        this.error = error.message || "Error sending technical visit proposal";
        console.error("Error sending technical visit proposal:", error);
        throw error;
      }
    },

    // Utility method to refresh collection requests list
    async refreshCollectionRequests(
      bloodBanksLocationId: string,
      currentFilter: string = "pending"
    ) {
      try {
        await this.loadCollectionRequests(
          bloodBanksLocationId,
          { status: currentFilter },
          1
        );
      } catch (error) {
        console.error("Error refreshing collection requests:", error);
        // Don't throw error to avoid breaking the main flow
      }
    },

    async cancelCollectionRequest(
      requestId: string,
      cancellationReason: string,
      bloodBanksLocationId: string
    ) {
      this.error = null;

      try {
        const response = await fetchWithAuth(
          `/api/v1/bloodbank/${bloodBanksLocationId}/collection-requests/${requestId}/cancel`,
          {
            method: "POST",
            body: {
              cancellationReason,
            },
          }
        );

        if (response.success) {
          // Update local state
          // Remove the request from the current list since its status changed
          this.collectionRequests.data = this.collectionRequests.data.filter(
            (req) => req._id !== requestId
          );
          this.collectionRequests.pagination.total = Math.max(
            0,
            this.collectionRequests.pagination.total - 1
          );

          // Update current collection request if it's the same
          if (this.currentCollectionRequest?._id === requestId) {
            this.currentCollectionRequest = {
              ...response.data,
              createdAt: new Date(response.data.createdAt),
              updatedAt: new Date(response.data.updatedAt),
              availableSlotOptions: response.data.availableSlotOptions.map(
                (slot: any) => ({
                  ...slot,
                  startTime: slot.startTime,
                  endTime: slot.endTime,
                })
              ),
              statusHistory: response.data.statusHistory.map((sh: any) => ({
                ...sh,
                changedAt: new Date(sh.changedAt),
              })),
            };
          }

          return response.data;
        } else {
          throw new Error("Failed to cancel collection request");
        }
      } catch (error: any) {
        this.error = error.message || "Error cancelling collection request";
        console.error("Error cancelling collection request:", error);
        throw error;
      }
    },

    clearCurrentCollectionRequest() {
      this.currentCollectionRequest = null;
    },

    // Dashboard Actions
    async loadDashboardData(bloodBanksLocationId: string) {
      this.isLoadingDashboard = true;
      this.error = null;

      try {
        const response = await fetchWithAuth(
          `/api/v1/bloodbank/${bloodBanksLocationId}/dashboard`
        );

        if (response.success) {
          this.dashboardData = {
            upcomingCollections: response.data.upcomingCollections.map(
              (collection: any) => ({
                ...collection,
                createdAt: new Date(collection.createdAt),
                updatedAt: new Date(collection.updatedAt),
                startTime: collection.startTime
                  ? new Date(collection.startTime)
                  : undefined,
                endTime: collection.endTime
                  ? new Date(collection.endTime)
                  : undefined,
              })
            ),
            pendingRequestsCount: response.data.pendingRequestsCount,
            nextCollection: response.data.nextCollection
              ? {
                  _id: (response.data.nextCollection as any)._id || "",
                  institutionName: response.data.nextCollection.institutionName,
                  institutionLocation: response.data.nextCollection
                    .institutionLocation
                    ? {
                        ...response.data.nextCollection.institutionLocation,
                        coordinates: response.data.nextCollection
                          .institutionLocation.coordinates as [number, number],
                      }
                    : null,
                  institutionAddress:
                    response.data.nextCollection.institutionAddress,
                  institutionLogo: response.data.nextCollection.institutionLogo,
                  institutionBanner:
                    response.data.nextCollection.institutionBanner,
                  date: response.data.nextCollection.date,
                  teamName:
                    (response.data.nextCollection as any).teamName || "",
                  teamColor:
                    (response.data.nextCollection as any).teamColor ||
                    "#3B82F6",
                  createdAt: new Date(
                    (response.data.nextCollection as any).createdAt
                  ),
                  updatedAt: new Date(
                    (response.data.nextCollection as any).updatedAt
                  ),
                  startTime: response.data.nextCollection.startTime
                    ? new Date(response.data.nextCollection.startTime)
                    : undefined,
                  endTime: response.data.nextCollection.endTime
                    ? new Date(response.data.nextCollection.endTime)
                    : undefined,
                }
              : null,
          };
          return response.data;
        } else {
          throw new Error("Failed to load dashboard data");
        }
      } catch (error: any) {
        this.error = error.message || "Error loading dashboard data";
        console.error("Error loading dashboard data:", error);
        throw error;
      } finally {
        this.isLoadingDashboard = false;
      }
    },

    clearDashboardData() {
      this.dashboardData = null;
    },
  },
});
