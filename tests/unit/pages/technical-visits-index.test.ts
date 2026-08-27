import { mount, flushPromises } from "@vue/test-utils";
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchWithAuth: vi.fn(),
  toast: vi.fn(),
}));

const bloodbankData = ref(null);

vi.mock("~/composables/useFetchWithAuth", () => ({
  fetchWithAuth: (...args: unknown[]) => mocks.fetchWithAuth(...args),
}));
vi.mock("~/stores/bloodbank", () => ({
  useBloodbankStore: () => ({ bloodbankData }),
}));
vi.mock("~/stores/user", () => ({
  useUserStore: () => ({
    currentBloodBankRole: { bloodBanksLocationId: "blood-bank-a" },
  }),
}));

const globalStubs = {
  UCard: { template: '<div v-bind="$attrs"><slot name="header" /><slot /></div>' },
  UTabs: { template: "<div />" },
  USkeleton: { template: "<div />" },
  UIcon: { template: "<span />" },
  UButton: { template: "<button><slot /></button>" },
  UBadge: { template: "<span><slot /></span>" },
  UFormField: { template: "<label><slot /><slot name=\"help\" /></label>" },
  UInput: { template: "<input v-bind=\"$attrs\" />" },
  UTextarea: { template: "<textarea v-bind=\"$attrs\" />" },
  USelect: { template: "<select v-bind=\"$attrs\"><slot /></select>" },
  UModal: { template: '<div data-testid="modal"><slot name="content" /></div>' },
  UPagination: { template: "<div />" },
  NuxtLink: { template: '<a><slot /></a>' },
};

let TechnicalVisitsPage: any;

beforeAll(async () => {
  vi.stubGlobal("definePageMeta", vi.fn());
  vi.stubGlobal("useRoute", () => ({ params: { bloodbankSlug: "hemocione" } }));
  vi.stubGlobal("storeToRefs", (store: any) => ({
    bloodbankData: store.bloodbankData,
  }));
  vi.stubGlobal("useToast", () => ({ add: mocks.toast }));
  vi.stubGlobal("computed", computed);
  vi.stubGlobal("nextTick", nextTick);
  vi.stubGlobal("onMounted", onMounted);
  vi.stubGlobal("ref", ref);
  vi.stubGlobal("watch", watch);

  const mod = await import("~/pages/[bloodbankSlug]/visitas-tecnicas/index.vue");
  TechnicalVisitsPage = mod.default;
});

beforeEach(() => {
  mocks.fetchWithAuth.mockReset();
  mocks.toast.mockReset();
  mocks.fetchWithAuth.mockImplementation((url: string) => {
    if (url.includes("technical-visits?")) {
      return Promise.resolve({
        success: true,
        data: [],
        pagination: { total: 0, page: 1, limit: 20, totalPages: 0 },
      });
    }
    return Promise.resolve({ success: true, data: [] });
  });
});

describe("visitas técnicas", () => {
  it("oferece vínculo com instituição ao registrar uma visita manual", async () => {
    const wrapper = mount(TechnicalVisitsPage, {
      global: {
        stubs: globalStubs,
        directives: { "auto-animate": {} },
      },
    });
    await flushPromises();

    (wrapper.vm as any).openCreateModal();
    await flushPromises();

    expect(
      wrapper.find('[data-testid="technical-visit-institution-select"]').exists()
    ).toBe(true);
  });
});
