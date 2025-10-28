import { defineStore } from "pinia";
import {
  fetchWithAuth,
  useFetchWithAuth,
} from "~/composables/useFetchWithAuth";

export interface Institution {
  id: string;
  name: string;
  document?: string;
  kind?: "company" | "ngo" | "school" | string;
  address?: string;
  phone?: string;
  city?: string;
  state?: string;
  latitude?: number;
  longitude?: number;
  logo?: string | null;
  banner?: string | null;
  status?: "pending" | "validated" | "rejected";
}

export interface BloodBankListItem {
  _id: string;
  name: string;
  slug: string;
  bloodBanksLocationId: string;
  logo?: string | null;
  distanceMeters?: number;
}

export interface SelectedDate {
  availableDateId: string;
  slotIds?: string[];
  date?: string;
}

export const useSchedulingStore = defineStore("scheduling", {
  state: () => ({
    // Institution
    userInstitutions: null as Institution[] | null,
    selectedInstitution: null as Institution | null,
    temporaryInstitutionData: null as Partial<Institution> | null,

    // Address / Geocoding
    cep: "",
    address: "",
    city: "",
    stateUF: "",
    latitude: null as number | null,
    longitude: null as number | null,

    // Blood banks by coverage
    nearbyBloodBanks: [] as BloodBankListItem[],
    selectedBloodBank: null as BloodBankListItem | null,

    // Dates
    selectedDates: [] as SelectedDate[],

    // Loading flags
    isLoadingInstitutions: false,
    isCreatingInstitution: false,
    isLoadingBloodBanks: false,
    accessedAgendarPage: false,
  }),
  getters: {
    hasLatLng: (s) =>
      typeof s.latitude === "number" && typeof s.longitude === "number",
  },
  actions: {
    async selectFirstInstitution() {
      if (!this.userInstitutions) {
        await this.loadUserInstitutions();
        console.log("userInstitutions", this.userInstitutions);
      }
      if (this.userInstitutions?.length) {
        console.log("setting first institution", this.userInstitutions[0]);
        this.setSelectedInstitution(this.userInstitutions[0]);
      }
    },
    setAccessedAgendarPage(value: boolean) {
      this.accessedAgendarPage = value;
    },
    setSelectedInstitution(inst: Institution | null) {
      this.selectedInstitution = inst;
      if (inst?.latitude && inst?.longitude) {
        this.latitude = inst.latitude;
        this.longitude = inst.longitude;
      }
    },
    setTemporaryInstitutionData(data: Partial<Institution> | null) {
      this.temporaryInstitutionData = data;
    },
    setSelectedBloodBank(bb: BloodBankListItem | null) {
      this.selectedBloodBank = bb;
    },
    toggleSelectedDate(date: SelectedDate) {
      const idx = this.selectedDates.findIndex(
        (d) => d.availableDateId === date.availableDateId
      );
      if (idx >= 0) {
        this.selectedDates.splice(idx, 1);
      } else {
        if (this.selectedDates.length >= 3) return;
        this.selectedDates.push(date);
      }
    },

    async loadUserInstitutions() {
      this.isLoadingInstitutions = true;
      try {
        const { data } = await useFetchWithAuth<{
          institutions: Institution[];
        }>("/api/v1/me/institutions", { method: "GET" });
        if (data.value?.institutions) {
          this.userInstitutions = data.value.institutions;
        }
      } finally {
        this.isLoadingInstitutions = false;
      }
    },

    async createInstitution(
      payload: Required<
        Pick<
          Institution,
          "name" | "document" | "address" | "phone" | "city" | "state"
        >
      > & { kind: string; latitude?: number; longitude?: number }
    ) {
      this.isCreatingInstitution = true;
      try {
        const created = await fetchWithAuth<Institution>(
          "/api/v1/me/institutions",
          {
            method: "POST",
            body: payload as any,
          }
        );
        // Reload institutions
        await this.loadUserInstitutions();
        const inst =
          this.userInstitutions.find((i) => i.id === (created as any)?.id) ||
          null;
        this.setSelectedInstitution(inst);
        return inst;
      } finally {
        this.isCreatingInstitution = false;
      }
    },

    async loadBloodBanksByCoverage() {
      if (!this.hasLatLng) return;
      this.isLoadingBloodBanks = true;
      try {
        const { data } = await useFetchWithAuth<{
          success: boolean;
          data: BloodBankListItem[];
        }>(
          `/api/v1/bloodbanks/by-location?lat=${this.latitude}&lng=${this.longitude}`
        );
        if (data.value?.success) {
          this.nearbyBloodBanks = data.value.data;
        }
      } finally {
        this.isLoadingBloodBanks = false;
      }
    },
  },
});
