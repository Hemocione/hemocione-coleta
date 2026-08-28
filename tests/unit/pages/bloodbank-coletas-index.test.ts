import { mount, flushPromises } from "@vue/test-utils";
import { nextTick, ref } from "vue";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  definePageMeta: vi.fn(),
  loadCollectionRequests: vi.fn(),
  userStore: {
    currentBloodBankRole: { bloodBanksLocationId: "blood-bank-a" },
  },
}));

const collectionRequests = ref({
  data: [],
  pagination: { total: 0, page: 1, limit: 20, pages: 0 },
});
const isLoadingCollectionRequests = ref(false);

vi.mock("~/stores/user", () => ({
  useUserStore: () => mocks.userStore,
}));

vi.mock("~/stores/bloodbank", () => ({
  useBloodbankStore: () => ({
    collectionRequests,
    isLoadingCollectionRequests,
    loadCollectionRequests: (...args: unknown[]) =>
      mocks.loadCollectionRequests(...args),
  }),
}));

const globalStubs = {
  UCard: {
    template: '<div v-bind="$attrs"><slot name="header" /><slot /></div>',
  },
  UTabs: { template: "<div />" },
  USkeleton: { template: "<div />" },
  UIcon: { template: "<span />" },
  NuxtImg: { template: "<img />" },
  UAvatar: { template: "<span><slot /></span>" },
  UBadge: { template: '<span v-bind="$attrs"><slot /></span>' },
  UButton: { template: "<button><slot /></button>" },
  NuxtLink: {
    inheritAttrs: false,
    props: { to: { type: String, required: true } },
    template: '<a :href="to" v-bind="$attrs"><slot /></a>',
  },
  UPagination: {
    props: { modelValue: { type: Number, required: true } },
    template:
      '<button data-testid="pagination-next" @click="$emit(\'update:modelValue\', modelValue + 1)" />',
  },
};

let CollectionRequestsPage: any;

beforeAll(async () => {
  vi.stubGlobal("definePageMeta", mocks.definePageMeta);
  vi.stubGlobal("useRoute", () => ({ params: { bloodbankSlug: "hemocione" } }));
  vi.stubGlobal("storeToRefs", (store: any) => ({
    collectionRequests: store.collectionRequests,
    isLoadingCollectionRequests: store.isLoadingCollectionRequests,
  }));
  vi.stubGlobal("useToast", () => ({ add: vi.fn() }));
  vi.stubGlobal("navigateTo", vi.fn());

  const mod = await import("~/pages/[bloodbankSlug]/coletas/index.vue");
  CollectionRequestsPage = mod.default;
});

beforeEach(() => {
  collectionRequests.value = {
    data: [],
    pagination: { total: 0, page: 1, limit: 20, pages: 0 },
  };
  isLoadingCollectionRequests.value = false;
  mocks.loadCollectionRequests.mockReset();
});

function mountPage() {
  return mount(CollectionRequestsPage, {
    global: {
      stubs: globalStubs,
      directives: { "auto-animate": {} },
    },
  });
}

describe("banco de sangue /coletas", () => {
  it("não mantém a listagem de coletas em cache", () => {
    mountPage();

    expect(mocks.definePageMeta).toHaveBeenCalledWith(
      expect.objectContaining({
        layout: "default",
        keepalive: false,
      })
    );
  });

  it("carrega a aba Pendentes com solicitações pending e counter_proposed", async () => {
    mountPage();
    await flushPromises();

    expect(mocks.loadCollectionRequests).toHaveBeenCalledWith(
      "blood-bank-a",
      { status: "pending,counter_proposed,awaiting_technical_visit" },
      1
    );
  });

  it("identifica contraproposta enviada e mantém o link para os detalhes", async () => {
    collectionRequests.value = {
      data: [
        {
          _id: "request-counter-proposed",
          institutionId: "institution-a",
          institutionName: "Instituição A",
          institutionLocation: null,
          institutionAddress: "Rua A, 1",
          requestedByUserId: "user-a",
          bloodBanksLocationId: "blood-bank-a",
          availableSlotOptions: [],
          host: { name: "Pessoa A", email: "a@example.com", phone: "11999999999" },
          status: "counter_proposed",
          statusHistory: [],
          createdAt: new Date("2026-08-26T12:00:00.000Z"),
          updatedAt: new Date("2026-08-26T12:00:00.000Z"),
        },
      ],
      pagination: { total: 1, page: 1, limit: 20, pages: 1 },
    };

    const wrapper = mountPage();
    await flushPromises();

    const card = wrapper.find('[data-testid="collection-request-card"]');

    expect(card.find('[data-testid="status-badge"]').text()).toBe(
      "Contraproposta enviada"
    );
    expect(card.find('[data-testid="counter-proposal-pending"]').text()).toContain(
      "Aguardando resposta da instituição"
    );
    expect(card.find("a").attributes("href")).toBe(
      "/hemocione/coletas/request-counter-proposed"
    );
  });

  it("mostra aceite com horário confirmado na aba Agendadas", async () => {
    collectionRequests.value = {
      data: [
        {
          _id: "request-accepted-with-slot",
          institutionId: "institution-a",
          institutionName: "Instituição A",
          institutionLocation: null,
          institutionAddress: "Rua A, 1",
          requestedByUserId: "user-a",
          bloodBanksLocationId: "blood-bank-a",
          availableSlotOptions: [
            {
              availableDateId: "date-a",
              slotId: "slot-a",
              date: "2099-01-15",
              startTime: "08:00",
              endTime: "09:00",
              teamName: "Equipe A",
            },
          ],
          selectedSlotId: "slot-a",
          status: "accepted",
          host: { name: "Pessoa A", email: "a@example.com", phone: "11999999999" },
          statusHistory: [],
          createdAt: new Date("2026-08-26T12:00:00.000Z"),
          updatedAt: new Date("2026-08-26T12:00:00.000Z"),
        },
      ],
      pagination: { total: 1, page: 1, limit: 20, pages: 1 },
    };

    const wrapper = mountPage();
    await flushPromises();
    (wrapper.vm as any).selectedFilter = "scheduled";
    await flushPromises();

    expect(wrapper.find('[data-testid="collection-request-card"]').exists()).toBe(
      true
    );
    expect(mocks.loadCollectionRequests).toHaveBeenLastCalledWith(
      "blood-bank-a",
      { status: "accepted,technical_visit_confirmed,scheduled" },
      1
    );
  });

  it("faz uma chamada ao avançar uma página", async () => {
    collectionRequests.value = {
      data: [],
      pagination: { total: 21, page: 1, limit: 20, pages: 2 },
    };

    const wrapper = mountPage();
    await flushPromises();
    mocks.loadCollectionRequests.mockClear();

    await wrapper.find('[data-testid="pagination-next"]').trigger("click");
    await flushPromises();

    expect(mocks.loadCollectionRequests).toHaveBeenCalledTimes(1);
    expect(mocks.loadCollectionRequests).toHaveBeenCalledWith(
      "blood-bank-a",
      { status: "pending,counter_proposed,awaiting_technical_visit" },
      2
    );
  });

  it("faz uma chamada ao trocar o filtro mesmo quando reseta a página", async () => {
    const wrapper = mountPage();
    await flushPromises();

    (wrapper.vm as any).currentPage = 2;
    await nextTick();
    mocks.loadCollectionRequests.mockClear();

    (wrapper.vm as any).selectedFilter = "accepted";
    await flushPromises();

    expect(mocks.loadCollectionRequests).toHaveBeenCalledTimes(1);
    expect(mocks.loadCollectionRequests).toHaveBeenCalledWith(
      "blood-bank-a",
      { status: "accepted,technical_visit_confirmed" },
      1
    );
  });
});
