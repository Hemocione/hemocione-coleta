import { mount, flushPromises } from "@vue/test-utils";
import { onMounted, ref, watch } from "vue";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchWithAuth: vi.fn(),
  useFetchWithAuth: vi.fn(),
}));

const selectedInstitution = ref({ id: "institution-a" });

vi.mock("~/composables/useFetchWithAuth", () => ({
  fetchWithAuth: mocks.fetchWithAuth,
  useFetchWithAuth: mocks.useFetchWithAuth,
}));
vi.mock("~/stores/scheduling", () => ({
  useSchedulingStore: () => ({ selectedInstitution }),
}));

const globalStubs = {
  UIcon: { template: "<span />" },
  USkeleton: { template: "<div />" },
  UCard: { template: "<div><slot /></div>" },
  UAvatar: { template: "<span><slot /></span>" },
  UBadge: { template: "<span><slot /></span>" },
  UButton: { template: "<button><slot /></button>" },
  NuxtLink: { template: '<a><slot /></a>' },
  UPagination: { template: "<div />" },
};

let MyAppointmentsPage: any;

beforeAll(async () => {
  vi.stubGlobal("definePageMeta", vi.fn());
  vi.stubGlobal("storeToRefs", () => ({ selectedInstitution }));
  vi.stubGlobal("useHead", vi.fn());
  vi.stubGlobal("useToast", () => ({ add: vi.fn() }));
  vi.stubGlobal("onMounted", onMounted);
  vi.stubGlobal("ref", ref);
  vi.stubGlobal("watch", watch);

  const mod = await import("~/pages/agendar/meus-agendamentos/index.vue");
  MyAppointmentsPage = mod.default;
});

beforeEach(() => {
  selectedInstitution.value = { id: "institution-a" };
  mocks.fetchWithAuth.mockReset();
  mocks.useFetchWithAuth.mockReset();
  mocks.fetchWithAuth.mockResolvedValue({
    success: true,
    data: [],
    pagination: { total: 0, page: 1, limit: 10, pages: 0 },
  });
});

describe("meus agendamentos", () => {
  it("lê os agendamentos com fetchWithAuth direto", async () => {
    const wrapper = mount(MyAppointmentsPage, {
      global: {
        stubs: globalStubs,
        directives: { "auto-animate": {} },
      },
    });
    await flushPromises();

    expect(mocks.fetchWithAuth).toHaveBeenCalledWith(
      "/api/v1/institutions/institution-a/collection-requests",
      { query: { page: 1, limit: 10 } }
    );
    expect(mocks.useFetchWithAuth).not.toHaveBeenCalled();
    wrapper.unmount();
  });
});
