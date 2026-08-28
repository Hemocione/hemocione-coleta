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
  selectedInstitution: null as {
    id: string;
    name?: string;
    document?: string;
  } | null,
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
    expect(wrapper.text()).not.toContain("Bancos de sangue próximos");
    expect(wrapper.text()).not.toContain("Bancos de sangue disponíveis");
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
    ).toContain("Quero organizar com esse banco");
    expect(
      wrapper.find('[data-testid="interest-bank-bank-missing"]').text()
    ).toContain("Quero organizar com esse banco");
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

    expect(wrapper.text()).toContain("Agende uma campanha na sua instituição");
    expect(wrapper.text()).toContain(
      "Escolha um banco de sangue próximo com agenda disponível e agende uma campanha de doação na sua instituição.",
    );
    expect(activeCard.text()).toContain("Agenda disponível");
    expect(activeCard.text()).toContain("Agendar campanha");
    expect(activeCard.find("button").attributes("icon")).toBe(
      "i-lucide-calendar-plus",
    );
    expect(activeCard.attributes("data-availability")).toBe("active");
    expect(activeCard.classes()).toContain("border-primary-200");

    expect(inactiveCard.text()).not.toContain("Agenda online indisponível.");
    expect(inactiveCard.attributes("data-availability")).toBe("inactive");
    expect(inactiveCard.classes()).toContain("border-gray-200");

    expect(missingCard.text()).not.toContain("Ainda não está na plataforma.");
    expect(missingCard.attributes("data-availability")).toBe("missing");
    expect(missingCard.classes()).toContain("border-gray-200");

    expect(wrapper.text()).not.toContain("Sinalizar interesse");
    expect(wrapper.text()).toContain(
      "Os bancos de sangue próximos de você ainda não permitem agendamento pela plataforma.",
    );
    expect(wrapper.text()).not.toContain("A equipe Hemocione usa essa demanda");
  });

  it("limita o nome do banco a três linhas e preserva o nome completo no título", () => {
    const longName =
      "Núcleo de Hemoterapia Zona Sul - Instituto Nacional de Cardiologia do Rio de Janeiro";
    nearbyBloodBanks.value = [{ ...inactiveBank, name: longName }];
    const wrapper = mountPage();
    const bankName = wrapper.find(
      '[data-testid="blood-bank-card-bank-inactive"] h3',
    );

    expect(bankName.classes()).toContain("line-clamp-3");
    expect(bankName.attributes("title")).toBe(longName);
  });

  it("orienta o modal sem explicar o processo interno do Hemocione", async () => {
    const wrapper = mountPage();

    await wrapper
      .find('[data-testid="interest-bank-bank-missing"]')
      .trigger("click");

    expect(wrapper.text()).toContain(
      "Quero organizar uma coleta com o Banco sem cadastro de agendamento",
    );
    expect(wrapper.text()).toContain("Banco sem cadastro de agendamento");
    expect(wrapper.text()).toContain(
      "Informe a instituição onde você quer realizar a coleta.",
    );
    expect(wrapper.text()).not.toContain("A equipe Hemocione usa essa demanda");
  });

  it("exige o nome da instituição no interesse anônimo", async () => {
    const wrapper = mountPage();

    await wrapper
      .find('[data-testid="interest-bank-bank-inactive"]')
      .trigger("click");
    await wrapper.find('[data-testid="interest-submit"]').trigger("submit");

    expect(wrapper.text()).toContain("Informe o nome da instituição.");
    expect(mocks.fetchWithAuth).not.toHaveBeenCalled();
  });

  it("envia interesse anônimo pelo dialog com dados da instituição, nome e telefone", async () => {
    const wrapper = mountPage();

    await wrapper
      .find('[data-testid="interest-bank-bank-inactive"]')
      .trigger("click");
    expect(wrapper.find('label[for="interest-name"]').classes()).toContain(
      "block",
    );
    expect(wrapper.find('[data-testid="interest-name"]').classes()).toContain(
      "w-full",
    );
    await wrapper
      .find('[data-testid="interest-institution-name"]')
      .setValue("Instituição A");
    await wrapper
      .find('[data-testid="interest-institution-cnpj"]')
      .setValue("04.252.011/0001-10");
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
        timeout: 15000,
        body: expect.objectContaining({
          bloodBanksLocationId: "location-inactive",
          name: "Pessoa A",
          phone: "(11) 99999-9999",
          institutionName: "Instituição A",
          institutionCnpj: "04.252.011/0001-10",
          origin: "ondedoar",
        }),
      }),
    );
  });

  it("rejeita CNPJ inválido no interesse anônimo", async () => {
    const wrapper = mountPage();

    await wrapper
      .find('[data-testid="interest-bank-bank-inactive"]')
      .trigger("click");
    await wrapper
      .find('[data-testid="interest-institution-name"]')
      .setValue("Instituição A");
    await wrapper
      .find('[data-testid="interest-institution-cnpj"]')
      .setValue("12.345.678/0001-00");
    await wrapper.find('[data-testid="interest-name"]').setValue("Pessoa A");
    await wrapper
      .find('[data-testid="interest-phone"]')
      .setValue("(11) 99999-9999");
    await wrapper.find('[data-testid="interest-submit"]').trigger("submit");

    expect(wrapper.text()).toContain("Informe um CNPJ válido.");
    expect(mocks.fetchWithAuth).not.toHaveBeenCalled();
  });

  it("libera o envio quando o registro de interesse falha", async () => {
    mocks.fetchWithAuth.mockRejectedValueOnce(new Error("Request timeout"));
    const wrapper = mountPage();

    await wrapper
      .find('[data-testid="interest-bank-bank-inactive"]')
      .trigger("click");
    await wrapper
      .find('[data-testid="interest-institution-name"]')
      .setValue("Instituição A");
    await wrapper.find('[data-testid="interest-name"]').setValue("Pessoa A");
    await wrapper
      .find('[data-testid="interest-phone"]')
      .setValue("(11) 99999-9999");
    await wrapper.find('[data-testid="interest-submit"]').trigger("submit");
    await flushPromises();

    const submitButton = wrapper.find('[data-testid="interest-submit"]');
    expect(submitButton.attributes("loading")).toBe("false");
    expect(submitButton.attributes("disabled")).toBeUndefined();
    expect(wrapper.text()).toContain(
      "Não foi possível registrar o interesse. Tente novamente.",
    );
  });

  it("envia interesse autenticado automaticamente sem dados do cliente", async () => {
    userStore.user = {
      givenName: "Pessoa",
      surName: "Sessão",
      phone: "+55 (11) 98888-7777",
    };
    schedulingStore.selectedInstitution = {
      id: "institution-a",
      name: "Instituição A",
      document: "04252011000110",
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
        timeout: 15000,
        body: expect.not.objectContaining({
          name: expect.anything(),
          phone: expect.anything(),
        }),
      }),
    );
    expect(mocks.fetchWithAuth).toHaveBeenCalledWith(
      "/api/v1/public/bloodbank-interests",
      expect.objectContaining({
        body: expect.objectContaining({ institutionId: "institution-a" }),
      }),
    );
    const requestBody = mocks.fetchWithAuth.mock.calls[0][1].body;
    expect(requestBody).not.toHaveProperty("institutionName");
    expect(requestBody).not.toHaveProperty("institutionCnpj");
    expect(wrapper.find('[data-testid="interest-modal"]').exists()).toBe(false);
  });

  it("não envia interesse autenticado sem instituição selecionada", async () => {
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

    expect(mocks.fetchWithAuth).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Selecione uma instituição antes de enviar o interesse",
      }),
    );
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
