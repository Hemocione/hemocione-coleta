import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import {
  useSchedulingStore,
  type BloodBankListItem,
  type Institution,
} from "~/stores/scheduling";

const mocks = vi.hoisted(() => ({
  useFetchWithAuth: vi.fn(),
}));

vi.mock("~/composables/useFetchWithAuth", () => ({
  useFetchWithAuth: mocks.useFetchWithAuth,
}));

const institutionA: Institution = {
  id: "institution-a",
  name: "Instituição A",
  city: "São Paulo",
  state: "SP",
  latitude: -23.55,
  longitude: -46.63,
};

const institutionB: Institution = {
  id: "institution-b",
  name: "Instituição B",
  city: "Campinas",
  state: "SP",
  latitude: -22.9,
  longitude: -47.06,
};

const bankA: BloodBankListItem = {
  _id: "bank-a",
  name: "Banco A",
  slug: "banco-a",
  bloodBanksLocationId: "location-a",
  availability: "active",
};

const bankB: BloodBankListItem = {
  _id: "bank-b",
  name: "Banco B",
  slug: "banco-b",
  bloodBanksLocationId: "location-b",
  availability: "active",
};

function asyncData(data: BloodBankListItem[]) {
  return Promise.resolve({
    data: {
      value: { success: true, data },
    },
  });
}

beforeEach(() => {
  setActivePinia(createPinia());
  mocks.useFetchWithAuth.mockReset();
  localStorage.clear();
});

describe("useSchedulingStore", () => {
  it("seleciona a instituição pelo id e recarrega a cobertura", async () => {
    mocks.useFetchWithAuth.mockImplementation(() => asyncData([bankB]));
    const store = useSchedulingStore();
    store.userInstitutions = [institutionA, institutionB];
    store.nearbyBloodBanks = [bankA];
    store.selectedBloodBank = bankA;
    store.selectedDates = [{ availableDateId: "old-date" }];

    await store.selectInstitution(institutionB.id);

    expect(store.selectedInstitution).toEqual(institutionB);
    expect(store.nearbyBloodBanks).toEqual([bankB]);
    expect(store.selectedBloodBank).toBeNull();
    expect(store.selectedDates).toEqual([]);
    expect(mocks.useFetchWithAuth).toHaveBeenCalledWith(
      "/api/v1/public/bloodbanks/by-location?lat=-22.9&lng=-47.06"
    );
  });

  it("carrega a listagem pública com localização e sem instituição", async () => {
    const publicBank: BloodBankListItem = {
      _id: "public-bank",
      name: "Banco Público",
      slug: "banco-publico",
      bloodBanksLocationId: "public-location",
      availability: "active",
    };
    mocks.useFetchWithAuth.mockImplementation(() => asyncData([publicBank]));
    const store = useSchedulingStore();
    store.latitude = -23.55;
    store.longitude = -46.63;

    await store.loadPublicBloodBanks();

    expect(store.selectedInstitution).toBeNull();
    expect(store.nearbyBloodBanks).toEqual([publicBank]);
    expect(mocks.useFetchWithAuth).toHaveBeenCalledWith(
      "/api/v1/public/bloodbanks/by-location?lat=-23.55&lng=-46.63"
    );
  });

  it("descarta a resposta antiga quando a instituição muda durante o carregamento", async () => {
    let resolveFirst!: (value: unknown) => void;
    let resolveSecond!: (value: unknown) => void;
    const firstResponse = new Promise((resolve) => {
      resolveFirst = resolve;
    });
    const secondResponse = new Promise((resolve) => {
      resolveSecond = resolve;
    });
    mocks.useFetchWithAuth
      .mockReturnValueOnce(firstResponse)
      .mockReturnValueOnce(secondResponse);

    const store = useSchedulingStore();
    store.userInstitutions = [institutionA, institutionB];

    const firstLoad = store.selectInstitution(institutionA.id);
    const secondLoad = store.selectInstitution(institutionB.id);

    resolveSecond({ data: { value: { success: true, data: [bankB] } } });
    await secondLoad;
    resolveFirst({ data: { value: { success: true, data: [bankA] } } });
    await firstLoad;

    expect(store.selectedInstitution).toEqual(institutionB);
    expect(store.nearbyBloodBanks).toEqual([bankB]);
  });

  it("limpa a cobertura quando a instituição não possui coordenadas", async () => {
    const institutionWithoutCoordinates: Institution = {
      id: "institution-without-coordinates",
      name: "Instituição sem coordenadas",
    };
    mocks.useFetchWithAuth.mockImplementation(() => asyncData([bankA]));
    const store = useSchedulingStore();
    store.userInstitutions = [institutionA, institutionWithoutCoordinates];
    await store.selectInstitution(institutionA.id);

    await store.selectInstitution(institutionWithoutCoordinates.id);

    expect(store.nearbyBloodBanks).toEqual([]);
    expect(store.isLoadingBloodBanks).toBe(false);
    expect(mocks.useFetchWithAuth).toHaveBeenCalledTimes(1);
  });

  it("restaura a instituição selecionada após carregar as instituições", async () => {
    localStorage.setItem("hemocione:selected-institution-id", institutionB.id);
    mocks.useFetchWithAuth.mockImplementation((url: string) => {
      if (url === "/api/v1/me/institutions") {
        return Promise.resolve({
          data: { value: { institutions: [institutionA, institutionB] } },
        });
      }
      return asyncData([bankB]);
    });

    const store = useSchedulingStore();
    await store.loadUserInstitutions();

    expect(store.selectedInstitution).toEqual(institutionB);
  });
});
