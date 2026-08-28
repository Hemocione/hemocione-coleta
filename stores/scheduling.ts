import { defineStore } from "pinia";
import {
  fetchWithAuth,
  useFetchWithAuth,
} from "~/composables/useFetchWithAuth";

const SELECTED_INSTITUTION_STORAGE_KEY = "hemocione:selected-institution-id";

function getStoredInstitutionId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(SELECTED_INSTITUTION_STORAGE_KEY);
}

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
  membershipRole?: "admin" | "staff";
}

export interface BloodBankListItem {
  _id?: string | null;
  name: string;
  slug?: string | null;
  bloodBanksLocationId?: string | null;
  logo?: string | null;
  availability?: "active" | "inactive" | "missing";
  hidden?: boolean;
  active?: boolean;
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
    coverageRequestVersion: 0,
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
      }
      if (this.userInstitutions?.length) {
        const preferredId = getStoredInstitutionId();
        const preferredInstitution = this.userInstitutions.find(
          ({ id }) => id === preferredId
        );
        await this.selectInstitution(
          preferredInstitution?.id || this.userInstitutions[0].id
        );
      }
    },
    setAccessedAgendarPage(value: boolean) {
      this.accessedAgendarPage = value;
    },
    setSelectedInstitution(inst: Institution | null) {
      const institutionChanged = this.selectedInstitution?.id !== inst?.id;
      this.selectedInstitution = inst;
      if (typeof window !== "undefined") {
        if (inst?.id) {
          window.localStorage.setItem(
            SELECTED_INSTITUTION_STORAGE_KEY,
            inst.id
          );
        } else {
          window.localStorage.removeItem(SELECTED_INSTITUTION_STORAGE_KEY);
        }
      }
      this.latitude = inst?.latitude ?? null;
      this.longitude = inst?.longitude ?? null;
      if (institutionChanged) {
        this.coverageRequestVersion += 1;
        this.nearbyBloodBanks = [];
        this.selectedBloodBank = null;
        this.selectedDates = [];
      }
    },
    async selectInstitution(institutionId: string | undefined) {
      const institution =
        this.userInstitutions?.find(({ id }) => id === institutionId) || null;
      if (institution?.id === this.selectedInstitution?.id) return;

      this.setSelectedInstitution(institution);
      await this.loadBloodBanksByCoverage();
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

    // A posição no array define a prioridade (índice 0 = 1ª opção
    // preferida). Troca a data em `index` com a vizinha na direção pedida.
    moveSelectedDate(index: number, direction: "up" | "down") {
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (
        index < 0 ||
        index >= this.selectedDates.length ||
        targetIndex < 0 ||
        targetIndex >= this.selectedDates.length
      ) {
        return;
      }
      const dates = this.selectedDates;
      [dates[index], dates[targetIndex]] = [dates[targetIndex], dates[index]];
    },

    async loadUserInstitutions() {
      this.isLoadingInstitutions = true;
      try {
        const { data } = await useFetchWithAuth<{
          institutions: Institution[];
        }>("/api/v1/me/institutions", { method: "GET" });
        if (data.value?.institutions) {
          this.userInstitutions = data.value.institutions;
          const selectedId =
            this.selectedInstitution?.id || getStoredInstitutionId();
          if (selectedId) {
            const institution = this.userInstitutions.find(
              ({ id }) => id === selectedId
            );
            if (institution) this.setSelectedInstitution(institution);
          }
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
      > & {
        legalName: string;
        kind: string;
        latitude?: number;
        longitude?: number;
      }
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
          this.userInstitutions?.find((i) => i.id === created?.id) || null;
        this.setSelectedInstitution(inst);
        await this.loadBloodBanksByCoverage();
        return inst;
      } finally {
        this.isCreatingInstitution = false;
      }
    },

    async updateInstitution(
      institutionId: string,
      payload: Partial<
        Pick<
          Institution,
          "name" | "legalName" | "address" | "phone" | "city" | "state" | "latitude" | "longitude"
        >
      >
    ) {
      const response = await fetchWithAuth<{ institution: Institution }>(
        `/api/v1/institutions/${institutionId}`,
        { method: "PATCH", body: payload as any }
      );
      const updated = response.institution;
      this.userInstitutions = (this.userInstitutions || []).map((institution) =>
        institution.id === institutionId ? { ...institution, ...updated } : institution
      );
      const selected = this.userInstitutions.find(
        (institution) => institution.id === institutionId
      );
      if (selected) {
        this.selectedInstitution = selected;
        this.latitude = selected.latitude ?? null;
        this.longitude = selected.longitude ?? null;
      }
      await this.loadBloodBanksByCoverage();
      return selected || null;
    },

    async loadPublicBloodBanks() {
      const requestVersion = ++this.coverageRequestVersion;
      this.nearbyBloodBanks = [];
      if (!this.hasLatLng) {
        this.isLoadingBloodBanks = false;
        return;
      }
      this.isLoadingBloodBanks = true;
      try {
        const { data } = await useFetchWithAuth<{
          success: boolean;
          data: BloodBankListItem[];
        }>(
          `/api/v1/public/bloodbanks/by-location?lat=${this.latitude}&lng=${this.longitude}`
        );
        if (
          requestVersion === this.coverageRequestVersion &&
          data.value?.success
        ) {
          this.nearbyBloodBanks = data.value.data;
        }
      } finally {
        if (requestVersion === this.coverageRequestVersion) {
          this.isLoadingBloodBanks = false;
        }
      }
    },
    async loadBloodBanksByCoverage() {
      await this.loadPublicBloodBanks();
    },
  },
});
