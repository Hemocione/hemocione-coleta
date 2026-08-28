import { mount, flushPromises } from "@vue/test-utils";
import { ref } from "vue";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchWithAuth: vi.fn(),
  navigateTo: vi.fn(),
  toast: vi.fn(),
  routerPush: vi.fn(),
}));

const currentCollectionRequest = ref<any>({
  _id: "request-a",
  institutionId: "institution-a",
  institutionName: "Instituição A",
  institutionLocation: null,
  institutionAddress: "Rua A, 1",
  availableSlotOptions: [],
  host: { name: "Pessoa A", email: "a@example.com", phone: "11999999999" },
  status: "pending",
  statusHistory: [],
  createdAt: new Date("2026-08-27T12:00:00.000Z"),
  updatedAt: new Date("2026-08-27T12:00:00.000Z"),
});
const bloodbankData = ref<any>(null);
const currentBloodBankRole = ref({ bloodBanksLocationId: "blood-bank-a" });

vi.mock("vue-router", () => ({
  useRoute: () => ({
    params: { bloodbankSlug: "hemocione", requestId: "request-a" },
  }),
  useRouter: () => ({ push: mocks.routerPush }),
}));
vi.mock("~/composables/useFetchWithAuth", () => ({
  fetchWithAuth: (...args: unknown[]) => mocks.fetchWithAuth(...args),
}));
vi.mock("~/stores/bloodbank", () => ({
  useBloodbankStore: () => ({
    bloodbankData,
    currentCollectionRequest,
    loadBloodbankData: vi.fn(),
    loadCollectionRequestById: vi.fn(),
    refreshCollectionRequests: vi.fn(),
    acceptCollectionRequest: vi.fn(),
    rejectCollectionRequest: vi.fn(),
    cancelCollectionRequest: vi.fn(),
    counterProposeCollectionRequest: vi.fn(),
    proposeTechnicalVisit: vi.fn(),
  }),
}));
vi.mock("~/stores/user", () => ({
  useUserStore: () => ({ currentBloodBankRole }),
}));

const globalStubs = {
  UCard: { template: '<div><slot name="header" /><slot /></div>' },
  UModal: {
    props: { dismissible: { type: Boolean, default: true } },
    template:
      '<div :data-modal-dismissible="String(dismissible)"><slot name="content" /></div>',
  },
  UButton: { template: "<button><slot /></button>" },
  UBadge: { template: "<span><slot /></span>" },
  UIcon: { template: "<span />" },
  UAvatar: { template: "<span><slot /></span>" },
  UTextarea: { template: "<textarea />" },
  UInput: { template: "<input />" },
  UCheckbox: { template: "<input type=\"checkbox\" />" },
  UFormField: { template: "<label><slot /></label>" },
  NuxtImg: { template: "<img />" },
  NuxtLink: { template: '<a><slot /></a>' },
  MglMap: { template: "<div><slot /></div>" },
  MglNavigationControl: { template: "<div />" },
  MglMarker: { template: "<div><slot /><slot name=\"marker\" /></div>" },
  MglPopup: { template: "<div><slot /></div>" },
};

let CollectionRequestDetailPage: any;

beforeAll(async () => {
  vi.stubGlobal("definePageMeta", vi.fn());
  vi.stubGlobal("storeToRefs", (store: any) => ({
    bloodbankData: store.bloodbankData,
    currentCollectionRequest: store.currentCollectionRequest,
    currentBloodBankRole: store.currentBloodBankRole,
  }));
  vi.stubGlobal("useToast", () => ({ add: mocks.toast }));
  vi.stubGlobal("navigateTo", mocks.navigateTo);

  const mod = await import(
    "~/pages/[bloodbankSlug]/coletas/[requestId].vue"
  );
  CollectionRequestDetailPage = mod.default;
});

beforeEach(() => {
  mocks.fetchWithAuth.mockReset();
  mocks.fetchWithAuth.mockResolvedValue({ success: true, data: [] });
});

describe("detalhe da coleta", () => {
  it("mantém a modal de contraproposta aberta ao selecionar uma data", async () => {
    const wrapper = mount(CollectionRequestDetailPage, {
      global: {
        stubs: globalStubs,
      },
    });
    await flushPromises();

    expect(wrapper.find('[data-modal-dismissible="false"]').exists()).toBe(true);
  });

  it("mostra a proposta de visita técnica já enviada, com as datas propostas", async () => {
    currentCollectionRequest.value = {
      ...currentCollectionRequest.value,
      status: "awaiting_technical_visit",
      visitProposal: {
        proposedDates: [
          {
            date: "2026-09-15",
            startTime: "09:00",
            endTime: "10:00",
            note: "Levar crachá",
          },
        ],
        note: "Preferência pela manhã",
        proposedBy: "user-a",
        proposedAt: "2026-08-27T12:00:00.000Z",
      },
    };

    const wrapper = mount(CollectionRequestDetailPage, {
      global: { stubs: globalStubs },
    });
    await flushPromises();

    expect(wrapper.text()).toContain("Visita Técnica Proposta");
    expect(wrapper.text()).toContain("Preferência pela manhã");
    expect(wrapper.text()).toContain("Levar crachá");
    expect(wrapper.text()).toContain("Aguardando resposta da instituição");
    expect(wrapper.text()).not.toContain("Visita técnica necessária");
  });
});
