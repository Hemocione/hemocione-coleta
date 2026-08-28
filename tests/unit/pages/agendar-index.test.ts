import { mount, flushPromises } from "@vue/test-utils";
import { computed, onMounted, ref } from "vue";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import AgendarBloodBankCard from "~/components/AgendarBloodBankCard.vue";
import type { BloodBankListItem } from "~/stores/scheduling";

const mocks = vi.hoisted(() => ({
  loadBloodBanksByCoverage: vi.fn(),
  setSelectedBloodBank: vi.fn(),
  navigateTo: vi.fn(),
  toast: vi.fn(),
  fetchWithAuth: vi.fn(),
}));

const nearbyBloodBanks = ref<BloodBankListItem[]>([]);
const isLoadingBloodBanks = ref(false);
const schedulingStore = {
  selectedInstitution: null as { id: string } | null,
  hasLatLng: false,
  latitude: null as number | null,
  longitude: null as number | null,
  loadBloodBanksByCoverage: (...args: unknown[]) =>
    mocks.loadBloodBanksByCoverage(...args),
  setAccessedAgendarPage: vi.fn(),
  setSelectedBloodBank: (...args: unknown[]) =>
    mocks.setSelectedBloodBank(...args),
};

const userStore = {
  user: null as { givenName?: string; surName?: string; phone?: string } | null,
};

vi.mock("~/stores/scheduling", () => ({
  useSchedulingStore: () => schedulingStore,
}));

vi.mock("~/stores/user", () => ({
  useUserStore: () => userStore,
}));

vi.mock("~/composables/useFetchWithAuth", () => ({
  fetchWithAuth: (...args: unknown[]) => mocks.fetchWithAuth(...args),
}));

const globalStubs = {
  UCard: { template: '<article v-bind="$attrs"><slot /></article>' },
  UAvatar: { template: "<span><slot /></span>" },
  UButton: {
    inheritAttrs: false,
    template: '<button v-bind="$attrs"><slot /></button>',
  },
  UModal: {
    props: ["open"],
    template:
      '<div v-if="open" data-testid="interest-modal"><slot name="content" /></div>',
  },
  UInput: {
    inheritAttrs: false,
    props: ["modelValue"],
    emits: ["update:modelValue"],
    template:
      '<input v-bind="$attrs" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  },
  UIcon: { template: "<span />" },
};

let AgendarPage: any;

beforeAll(async () => {
  vi.stubGlobal("definePageMeta", vi.fn());
  vi.stubGlobal("storeToRefs", () => ({ nearbyBloodBanks, isLoadingBloodBanks }));
  vi.stubGlobal("computed", computed);
  vi.stubGlobal("onMounted", onMounted);
  vi.stubGlobal("ref", ref);
  vi.stubGlobal("useHead", vi.fn());
  vi.stubGlobal("useToast", () => ({ add: mocks.toast }));
  vi.stubGlobal("navigateTo", mocks.navigateTo);

  const mod = await import("~/pages/agendar/index.vue");
  AgendarPage = mod.default;
});

const activeBank: BloodBankListItem = {
  _id: "bank-active",
  name: "Banco Ativo",
  slug: "banco-ativo",
  bloodBanksLocationId: "location-active",
  availability: "active",
};

const inactiveBank: BloodBankListItem = {
  _id: "bank-inactive",
  name: "Banco Inativo",
  slug: "banco-inativo",
  bloodBanksLocationId: "location-inactive",
  availability: "inactive",
};

const bankWithoutSlug: BloodBankListItem = {
  _id: "bank-missing",
  name: "Banco sem cadastro de agendamento",
  slug: null,
  bloodBanksLocationId: "123e4567-e89b-12d3-a456-426614174002",
  availability: "missing",
};

beforeEach(() => {
  nearbyBloodBanks.value = [activeBank, inactiveBank, bankWithoutSlug];
  isLoadingBloodBanks.value = false;
  schedulingStore.selectedInstitution = null;
  schedulingStore.hasLatLng = false;
  userStore.user = null;
  mocks.loadBloodBanksByCoverage.mockReset();
  mocks.setSelectedBloodBank.mockReset();
  mocks.navigateTo.mockReset();
  mocks.toast.mockReset();
  mocks.fetchWithAuth.mockReset().mockResolvedValue({
    success: true,
    data: { deliveryStatus: "disabled" },
  });
});

function mountPage() {
  return mount(AgendarPage, {
    global: {
      stubs: globalStubs,
      components: { AgendarBloodBankCard },
      directives: { "auto-animate": {} },
    },
  });
}

describe("/agendar", () => {
  it("carrega e renderiza a listagem pública sem instituição selecionada", async () => {
    const wrapper = mountPage();
    await flushPromises();

    expect(mocks.loadBloodBanksByCoverage).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain("Banco Ativo");
    expect(wrapper.text()).toContain("Banco Inativo");
    expect(wrapper.text()).toContain("Banco sem cadastro de agendamento");
    expect(wrapper.find('[data-testid="use-location-button"]').exists()).toBe(
      true
    );
  });

  it("mantém bancos com agenda no início da listagem", () => {
    nearbyBloodBanks.value = [inactiveBank, bankWithoutSlug, activeBank];
    const wrapper = mountPage();

    const cards = wrapper.findAll('[data-testid^="blood-bank-card-"]');

    expect(cards.map((card) => card.attributes("data-availability"))).toEqual([
      "active",
      "inactive",
      "missing",
    ]);
  });

  it("mantém o fluxo atual para banco ativo", async () => {
    const wrapper = mountPage();

    await wrapper
      .find('[data-testid="select-bank-bank-active"]')
      .trigger("click");

    expect(mocks.setSelectedBloodBank).toHaveBeenCalledWith(activeBank);
    expect(mocks.navigateTo).toHaveBeenCalledWith("/agendar/banco-ativo");
  });

  it("mostra interesse para banco inativo ou sem slug sem criar link dedicado", () => {
    const wrapper = mountPage();

    expect(wrapper.findAll("a")).toHaveLength(0);
    expect(
      wrapper.find('[data-testid="interest-bank-bank-inactive"]').text()
    ).toContain("Avisar que quero doar");
    expect(
      wrapper.find('[data-testid="interest-bank-bank-missing"]').text()
    ).toContain("Avisar que quero doar");
    expect(
      wrapper.find('[data-testid="interest-bank-bank-inactive"]').attributes("icon")
    ).toBe("i-lucide-hand-heart");
    expect(
      wrapper.find('[data-testid="interest-bank-bank-missing"]').attributes("icon")
    ).toBe("i-lucide-hand-heart");
  });

  it("explica a disponibilidade de cada banco e destaca somente o CTA indisponível", () => {
    const wrapper = mountPage();

    const activeCard = wrapper.find('[data-testid="blood-bank-card-bank-active"]');
    const inactiveCard = wrapper.find('[data-testid="blood-bank-card-bank-inactive"]');
    const missingCard = wrapper.find('[data-testid="blood-bank-card-bank-missing"]');

    expect(activeCard.text()).toContain("Agenda disponível");
    expect(activeCard.text()).toContain("Agendar coleta");
    expect(activeCard.find("button").attributes("icon")).toBe(
      "i-lucide-calendar-plus",
    );
    expect(activeCard.attributes("data-availability")).toBe("active");
    expect(activeCard.classes()).toContain("border-primary-200");

    expect(inactiveCard.text()).toContain("Agenda online indisponível.");
    expect(inactiveCard.attributes("data-availability")).toBe("inactive");
    expect(inactiveCard.classes()).toContain("border-gray-200");

    expect(missingCard.text()).toContain("Ainda não está na plataforma.");
    expect(missingCard.attributes("data-availability")).toBe("missing");
    expect(missingCard.classes()).toContain("border-gray-200");

    expect(wrapper.text()).not.toContain("Sinalizar interesse");
  });

  it("explica no modal que o aviso ajuda a equipe a avaliar uma coleta externa", async () => {
    const wrapper = mountPage();

    await wrapper
      .find('[data-testid="interest-bank-bank-missing"]')
      .trigger("click");

    expect(wrapper.text()).toContain(
      "Avise que você quer doar no Banco sem cadastro de agendamento",
    );
    expect(wrapper.text()).toContain("Banco sem cadastro de agendamento");
    expect(wrapper.text()).toContain(
      "Seu aviso ajuda a equipe Hemocione a medir a demanda e entrar em contato com o banco para avaliar uma coleta externa",
    );
  });

  it("envia interesse anônimo pelo dialog com nome e telefone", async () => {
    const wrapper = mountPage();

    await wrapper
      .find('[data-testid="interest-bank-bank-inactive"]')
      .trigger("click");
    await wrapper.find('[data-testid="interest-name"]').setValue("Pessoa A");
    await wrapper
      .find('[data-testid="interest-phone"]')
      .setValue("(11) 99999-9999");
    await wrapper.find('[data-testid="interest-submit"]').trigger("submit");
    await flushPromises();

    expect(mocks.fetchWithAuth).toHaveBeenCalledWith(
      "/api/v1/public/bloodbank-interests",
      expect.objectContaining({
        method: "POST",
        body: expect.objectContaining({
          bloodBanksLocationId: "location-inactive",
          name: "Pessoa A",
          phone: "(11) 99999-9999",
          origin: "ondedoar",
        }),
      }),
    );
  });

  it("envia interesse autenticado automaticamente sem dados do cliente", async () => {
    userStore.user = {
      givenName: "Pessoa",
      surName: "Sessão",
      phone: "+55 (11) 98888-7777",
    };
    const wrapper = mountPage();

    await wrapper
      .find('[data-testid="interest-bank-bank-inactive"]')
      .trigger("click");
    await flushPromises();

    expect(mocks.fetchWithAuth).toHaveBeenCalledWith(
      "/api/v1/public/bloodbank-interests",
      expect.objectContaining({
        method: "POST",
        body: expect.not.objectContaining({
          name: expect.anything(),
          phone: expect.anything(),
        }),
      }),
    );
    expect(wrapper.find('[data-testid="interest-modal"]').exists()).toBe(false);
  });

  it("não exibe banco hidden mesmo quando o catálogo cliente o contém", async () => {
    nearbyBloodBanks.value = [
      ...nearbyBloodBanks.value,
      {
        _id: "bank-hidden",
        name: "Banco oculto",
        slug: "banco-oculto",
        bloodBanksLocationId: "123e4567-e89b-12d3-a456-426614174003",
        availability: "active",
        hidden: true,
      },
    ];
    const wrapper = mountPage();

    await flushPromises();

    expect(wrapper.text()).not.toContain("Banco oculto");
    expect(
      wrapper.find('[data-testid="select-bank-bank-hidden"]').exists(),
    ).toBe(false);
  });
});
