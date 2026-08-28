<template>
  <div class="min-h-screen bg-gray-50 text-gray-900">
    <!-- Top Bar -->
    <header
      class="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-gray-200"
    >
      <div
        class="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between"
      >
        <div class="flex items-center gap-2">
          <!-- <div
            class="w-8 h-8 rounded-lg bg-red-500 flex items-center justify-center"
          >
            <UIcon name="i-lucide-droplet" class="text-white" />
          </div> -->
          <img src="/logo.svg" alt="Hemocione Coleta" class="w-8 h-8" />
          <h1 class="font-semibold">Agendar Coleta</h1>
        </div>
        <AgendamentoNavigation
          :is-logged-in="isLoggedIn"
          :first-name="firstName"
          @login="onLogin"
          @logout="logoutOpen = true"
        />
      </div>
    </header>

    <main class="max-w-5xl mx-auto px-4 py-6">
      <!-- Institution bar -->
      <UCard class="mb-3 md:mb-4" :ui="{ body: 'p-3 md:p-4' }">
        <div class="flex flex-col gap-4">
          <div
            class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"
          >
            <div class="flex min-w-0 flex-1 items-start gap-3">
              <UAvatar
                :src="selectedInstitution?.logo || undefined"
                icon="i-lucide-building-2"
                size="md"
                class="shrink-0"
              >
                {{ selectedInstitution?.name?.charAt(0) }}
              </UAvatar>
              <div class="min-w-0 flex-1">
                <div
                  class="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500"
                >
                  Instituição da coleta
                </div>
                <USelect
                  v-if="isLoggedIn && userInstitutions.length"
                  v-model="selectedInstitutionId"
                  :items="institutionItems"
                  placeholder="Selecione sua instituição"
                  variant="none"
                  size="lg"
                  aria-label="Instituição da coleta"
                  data-testid="institution-select"
                  class="mt-0.5 w-full max-w-xl"
                  :ui="{
                    base: 'px-0 text-base font-semibold text-gray-900 focus-visible:ring-2 focus-visible:ring-red-500',
                  }"
                />
                <div v-else class="mt-1 text-sm text-gray-600 leading-snug">
                  Entre para selecionar sua instituição ou crie uma nova.
                </div>
                <div
                  v-if="selectedInstitution"
                  class="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-gray-500"
                >
                  <UBadge
                    v-if="selectedInstitution.status"
                    color="neutral"
                    variant="subtle"
                  >
                    {{ institutionStatusLabel(selectedInstitution.status) }}
                  </UBadge>
                  <span v-if="selectedInstitution.kind">
                    {{ institutionKindLabel(selectedInstitution.kind) }}
                  </span>
                  <span
                    v-if="selectedInstitution.city || selectedInstitution.state"
                    >
                    {{
                      [selectedInstitution.city, selectedInstitution.state]
                        .filter(Boolean)
                        .join(" · ")
                    }}
                  </span>
                </div>
              </div>
            </div>
            <UButton
              color="neutral"
              variant="soft"
              icon="i-lucide-building"
              class="w-full shrink-0 sm:w-auto"
              @click="onCreateClick"
            >
              Registrar Instituição
            </UButton>
          </div>

          <div
            v-if="selectedInstitution"
            class="border-t border-gray-100 pt-3"
            data-testid="selected-institution-details"
          >
            <dl
              class="grid gap-x-6 gap-y-3 text-xs text-gray-600 sm:grid-cols-2 lg:grid-cols-4"
            >
              <div v-if="selectedInstitution.document">
                <dt class="font-medium text-gray-500">CNPJ</dt>
                <dd class="mt-0.5">
                  {{ formatInstitutionDocument(selectedInstitution.document) }}
                </dd>
              </div>
              <div v-if="selectedInstitution.kind">
                <dt class="font-medium text-gray-500">Tipo</dt>
                <dd class="mt-0.5">
                  {{ institutionKindLabel(selectedInstitution.kind) }}
                </dd>
              </div>
              <div
                v-if="
                  selectedInstitution.address ||
                  selectedInstitution.city ||
                  selectedInstitution.state
                "
                class="sm:col-span-2"
              >
                <dt class="font-medium text-gray-500">Endereço</dt>
                <dd class="mt-0.5">
                  {{
                    [
                      selectedInstitution.address,
                      selectedInstitution.city,
                      selectedInstitution.state,
                    ]
                      .filter(Boolean)
                      .join(", ")
                  }}
                </dd>
              </div>
              <div v-if="selectedInstitution.phone">
                <dt class="font-medium text-gray-500">Telefone</dt>
                <dd class="mt-0.5">{{ selectedInstitution.phone }}</dd>
              </div>
            </dl>
            <UButton
              v-if="canEditSelectedInstitution"
              size="xs"
              variant="soft"
              icon="i-lucide-pencil"
              class="mt-3"
              data-testid="edit-institution-button"
              @click="openEditInstitution"
            >
              Editar dados
            </UButton>
          </div>
        </div>
      </UCard>

      <!-- Create Institution Modal -->
      <UModal
        v-model:open="openCreate"
        :dismissible="!isFormDirty"
        @close:prevent="askDiscard"
      >
        <template #content>
          <div
            class="p-6 flex flex-col gap-3 relative overflow-auto max-h-[95dvh]"
          >
            <div class="text-base font-semibold mb-1" key="title">
              Registrar Instituição
            </div>
            <Transition name="fade" mode="out-in">
              <div
                v-if="cnpjLoading || geocodeLoading"
                class="flex items-center gap-2 text-sm text-gray-500 absolute top-7 right-7"
                key="loading"
              >
                <UIcon name="i-lucide-loader-2" class="animate-spin" />
              </div>
            </Transition>
            <!-- Alerta informativo sobre endereço -->
            <div
              class="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800"
              key="address-info"
            >
              <div class="flex items-start gap-2">
                <UIcon
                  name="i-lucide-map-pin"
                  class="w-4 h-4 mt-0.5 shrink-0"
                />
                <div>
                  <strong>Endereço de coleta:</strong> Informe o endereço onde a
                  coleta de sangue será realizada. Este local será usado para
                  coordenar a visita do banco de sangue.
                </div>
              </div>
            </div>
            <UFormField label="Eu represento uma..." key="kind">
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <UCard
                  v-for="item in institutionTypes"
                  :key="item.value"
                  :class="[
                    item.value === form.kind
                      ? 'ring-2 ring-primary-500 dark:ring-primary-400 bg-primary-50 dark:bg-primary-900/20'
                      : 'ring-1 ring-gray-200 dark:ring-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50',
                  ]"
                  class="cursor-pointer transition-all duration-200"
                  @click="form.kind = item.value"
                >
                  <div
                    class="flex items-center justify-center gap-2 p-2 flex-col"
                  >
                    <UIcon :name="item.icon" class="w-6 h-6" />
                    <span class="font-semibold">{{ item.label }}</span>
                  </div>
                </UCard>
              </div>
            </UFormField>
            <UFormField label="CNPJ" key="cnpj" :error="cnpjError">
              <UInput
                v-maska="'##.###.###/####-##'"
                v-model="form.document"
                placeholder="00.000.000/0000-00"
                @change="onCnpj"
                @input="onCnpjInput"
                :disabled="saving || cnpjLoading || geocodeLoading"
              />
            </UFormField>
            <UFormField label="Razão Social" key="legalName">
              <UInput
                v-model="form.legalName"
                placeholder="Razão Social da empresa"
                :disabled="saving || cnpjLoading || geocodeLoading"
              />
            </UFormField>
            <UFormField label="CEP" key="cep">
              <UInput
                v-model="form.cep"
                placeholder="00000-000"
                v-maska="'#####-###'"
                @change="geocode"
                :disabled="saving || cnpjLoading || geocodeLoading"
              />
            </UFormField>
            <UFormField label="Nome" key="name">
              <UInput
                v-model="form.name"
                placeholder="Associação Hemocione"
                :disabled="saving || cnpjLoading || geocodeLoading"
              />
            </UFormField>
            <UFormField label="Endereço" key="address">
              <UInput
                v-model="form.address"
                placeholder="Rua, número, bairro"
                :disabled="saving || cnpjLoading || geocodeLoading"
              />
            </UFormField>
            <div class="grid grid-cols-2 gap-3" key="city-state">
              <UFormField label="Cidade">
                <UInput
                  v-model="form.city"
                  :disabled="saving || cnpjLoading || geocodeLoading"
                />
              </UFormField>
              <UFormField label="Estado">
                <USelect
                  v-model="form.state"
                  :items="brazilianStates"
                  placeholder="Selecione"
                  :disabled="saving || cnpjLoading || geocodeLoading"
                />
              </UFormField>
            </div>
            <UFormField label="Telefone" key="phone">
              <UInput
                v-model="form.phone"
                placeholder="+55 (00) 00000-0000"
                v-maska="'+## (##) #####-####'"
                :disabled="saving || cnpjLoading || geocodeLoading"
              />
            </UFormField>
            <div
              v-if="discardConfirm"
              class="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              key="discard-confirm"
            >
              <span>Descartar os dados digitados?</span>
              <div class="flex justify-end gap-2">
                <UButton
                  variant="ghost"
                  size="sm"
                  @click="discardConfirm = false"
                  >Continuar editando</UButton
                >
                <UButton color="error" size="sm" @click="discardAndClose"
                  >Descartar</UButton
                >
              </div>
            </div>
            <div class="flex items-center justify-end gap-2 mt-2">
              <UButton variant="ghost" @click="onCancelClick"
                >Cancelar</UButton
              >
              <UButton
                color="primary"
                :loading="saving || cnpjLoading || geocodeLoading"
                :disabled="cnpjLoading || geocodeLoading || !isFormValid"
                @click="createInst"
                >Salvar</UButton
              >
            </div>
          </div>
        </template>
      </UModal>

      <!-- Edit Institution Modal -->
      <UModal v-model:open="editInstitutionOpen">
        <template #content>
          <div class="p-6 space-y-4 max-h-[95dvh] overflow-auto">
            <div>
              <div class="text-base font-semibold">Editar instituição</div>
              <p class="text-sm text-gray-600 mt-1">
                Atualize os dados usados no agendamento.
              </p>
            </div>
            <UAlert
              v-if="editInstitutionError"
              color="error"
              icon="i-lucide-alert-circle"
              :description="editInstitutionError"
            />
            <UFormField label="Nome" required>
              <UInput v-model="editInstitutionForm.name" />
            </UFormField>
            <UFormField label="Razão Social">
              <UInput v-model="editInstitutionForm.legalName" />
            </UFormField>
            <UFormField label="Endereço">
              <UInput v-model="editInstitutionForm.address" />
            </UFormField>
            <div class="grid grid-cols-2 gap-3">
              <UFormField label="Cidade" required>
                <UInput v-model="editInstitutionForm.city" />
              </UFormField>
              <UFormField label="Estado" required>
                <USelect
                  v-model="editInstitutionForm.state"
                  :items="brazilianStates"
                />
              </UFormField>
            </div>
            <UFormField label="Telefone">
              <UInput v-model="editInstitutionForm.phone" />
            </UFormField>
            <div class="flex justify-end gap-2">
              <UButton
                variant="ghost"
                :disabled="editInstitutionSaving"
                @click="editInstitutionOpen = false"
              >
                Cancelar
              </UButton>
              <UButton
                color="primary"
                :loading="editInstitutionSaving"
                :disabled="!isEditInstitutionValid"
                data-testid="save-institution-button"
                @click="saveEditInstitution"
              >
                Salvar alterações
              </UButton>
            </div>
          </div>
        </template>
      </UModal>

      <!-- Login Prompt Modal (quando deslogado) -->
      <UModal
        v-model:open="loginPromptOpen"
        title="Entre para continuar"
        description="Para registrar ou selecionar uma instituição, você precisa estar logado."
      >
        <template #content>
          <div class="p-6 space-y-3">
            <h3 class="text-lg font-semibold">Entre para continuar</h3>
            <p class="text-sm text-gray-600">
              Para registrar ou selecionar uma instituição, você precisa estar
              logado.
            </p>
            <div class="flex justify-end gap-2 mt-2">
              <UButton variant="ghost" @click="loginPromptOpen = false"
                >Cancelar</UButton
              >
              <UButton color="primary" icon="i-lucide-log-in" @click="onLogin"
                >Entrar</UButton
              >
            </div>
          </div>
        </template>
      </UModal>

      <!-- Logout Confirm Modal -->
      <UModal v-model:open="logoutOpen">
        <template #content>
          <div class="p-6 space-y-3">
            <h3 class="text-lg font-semibold">Sair da conta?</h3>
            <p class="text-sm text-gray-600">
              Você precisará entrar novamente para continuar.
            </p>
            <div class="flex justify-end gap-2 mt-2">
              <UButton variant="ghost" @click="logoutOpen = false"
                >Cancelar</UButton
              >
              <UButton color="error" icon="i-lucide-log-out" @click="doLogout"
                >Sair</UButton
              >
            </div>
          </div>
        </template>
      </UModal>

      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import { redirectToID } from "~/utils/redirectToID";
import { useUserStore } from "~/stores/user";
import { useSchedulingStore } from "~/stores/scheduling";
import { geocodeCep } from "~/utils/geocode";
import { isValidCnpj, onlyDigits } from "~/utils/cnpj";
import { vMaska } from "maska/vue";

const route = useRoute();
const onLogin = () => {
  redirectToID(route.fullPath);
};

const userStore = useUserStore();
const { user } = storeToRefs(userStore);
const isLoggedIn = computed(() => Boolean(user.value));
const firstName = computed(() => user.value?.givenName || "");
const onLogout = async () => {
  await userStore.logOut();
};
const logoutOpen = ref(false);
const doLogout = async () => {
  logoutOpen.value = false;
  await onLogout();
};

// Institution select/create (global)
const scheduling = useSchedulingStore();
const { selectedInstitution } = storeToRefs(scheduling);
const openCreate = ref(false);
const loginPromptOpen = ref(false);
const saving = ref(false);
const cnpjLoading = ref(false);
const geocodeLoading = ref(false);
const cnpjError = ref("");
const discardConfirm = ref(false);
const editInstitutionOpen = ref(false);
const editInstitutionSaving = ref(false);
const editInstitutionError = ref("");
const editInstitutionForm = reactive({
  name: "",
  legalName: "",
  address: "",
  city: "",
  state: "",
  phone: "",
});
const userInstitutions = computed(() => scheduling.userInstitutions || []);
const institutionItems = computed(() =>
  userInstitutions.value.map((i) => ({ label: i.name, value: i.id }))
);
const selectedInstitutionId = ref<string | undefined>(
  selectedInstitution.value?.id || undefined
);

onMounted(async () => {
  if (isLoggedIn.value) {
    try {
      await scheduling.loadUserInstitutions();
      if (
        !scheduling.selectedInstitution &&
        scheduling?.userInstitutions?.length
      ) {
        const firstInst = scheduling.userInstitutions[0];
        await scheduling.selectInstitution(firstInst.id);
      } else if (scheduling.selectedInstitution) {
        selectedInstitutionId.value = scheduling.selectedInstitution.id;
        await scheduling.loadBloodBanksByCoverage();
      }
    } catch {}
  }
});

watch(selectedInstitutionId, (institutionId) => {
  if (institutionId !== selectedInstitution.value?.id) {
    void scheduling.selectInstitution(institutionId);
  }
});

watch(
  () => selectedInstitution.value?.id,
  (institutionId) => {
    if (institutionId !== selectedInstitutionId.value) {
      selectedInstitutionId.value = institutionId;
    }
  }
);

const institutionKindLabel = (kind: string) =>
  ({
    company: "Empresa",
    ngo: "Organização social",
    school: "Escola",
    university: "Universidade",
  })[kind] || kind;

const institutionStatusLabel = (status: string) =>
  ({
    pending: "Pendente",
    validated: "Validada",
    rejected: "Rejeitada",
  })[status] || status;

const formatInstitutionDocument = (document: string) => {
  const digits = onlyDigits(document);
  if (digits.length !== 14) return document;
  return digits.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    "$1.$2.$3/$4-$5"
  );
};

const form = reactive({
  name: "",
  document: "",
  legalName: "",
  cep: "",
  address: "",
  city: "",
  state: "",
  phone: "",
  kind: "company" as string,
});

const coords = computed(() => {
  if (scheduling.latitude != null && scheduling.longitude != null) {
    return { lat: scheduling.latitude, lng: scheduling.longitude };
  }
  return null;
});

const isFormDirty = computed(() => {
  return (
    form.name.trim() !== "" ||
    form.document.trim() !== "" ||
    form.legalName.trim() !== "" ||
    form.cep.trim() !== "" ||
    form.address.trim() !== "" ||
    form.city.trim() !== "" ||
    form.state.trim() !== "" ||
    form.phone.trim() !== ""
  );
});

const isFormValid = computed(() => {
  return (
    isFormDirty.value &&
    isValidCnpj(form.document) &&
    form.kind.trim() !== ""
  );
});

const isEditInstitutionValid = computed(
  () =>
    editInstitutionForm.name.trim().length > 0 &&
    editInstitutionForm.city.trim().length > 0 &&
    editInstitutionForm.state.length === 2
);

const canEditSelectedInstitution = computed(
  () => selectedInstitution.value?.membershipRole === "admin"
);

const brazilianStates = [
  { label: "Acre", value: "AC" },
  { label: "Alagoas", value: "AL" },
  { label: "Amapá", value: "AP" },
  { label: "Amazonas", value: "AM" },
  { label: "Bahia", value: "BA" },
  { label: "Ceará", value: "CE" },
  { label: "Distrito Federal", value: "DF" },
  { label: "Espírito Santo", value: "ES" },
  { label: "Goiás", value: "GO" },
  { label: "Maranhão", value: "MA" },
  { label: "Mato Grosso", value: "MT" },
  { label: "Mato Grosso do Sul", value: "MS" },
  { label: "Minas Gerais", value: "MG" },
  { label: "Pará", value: "PA" },
  { label: "Paraíba", value: "PB" },
  { label: "Paraná", value: "PR" },
  { label: "Pernambuco", value: "PE" },
  { label: "Piauí", value: "PI" },
  { label: "Rio de Janeiro", value: "RJ" },
  { label: "Rio Grande do Norte", value: "RN" },
  { label: "Rio Grande do Sul", value: "RS" },
  { label: "Rondônia", value: "RO" },
  { label: "Roraima", value: "RR" },
  { label: "Santa Catarina", value: "SC" },
  { label: "São Paulo", value: "SP" },
  { label: "Sergipe", value: "SE" },
  { label: "Tocantins", value: "TO" },
];

const institutionTypes = [
  {
    label: "Escola",
    value: "school",
    icon: "i-lucide-school",
  },
  {
    label: "Universidade",
    value: "university",
    icon: "i-lucide-graduation-cap",
  },
  {
    label: "Empresa",
    value: "company",
    icon: "i-lucide-building-2",
  },
];

const geocode = async () => {
  if (!form.cep) return;
  try {
    geocodeLoading.value = true;
    const r = await geocodeCep(form.cep);
    form.address = r.address || form.address;
    form.city = r.city || form.city;
    form.state = r.state || form.state;
    if (typeof r.latitude === "number" && typeof r.longitude === "number") {
      scheduling.latitude = r.latitude;
      scheduling.longitude = r.longitude;
    } else {
      scheduling.latitude = null;
      scheduling.longitude = null;
    }
  } catch {
    useToast().add({ title: "Erro ao buscar CEP", color: "error" });
  } finally {
    geocodeLoading.value = false;
  }
};

let cnpjAbort: AbortController | null = null;

const onCnpj = async () => {
  const digits = onlyDigits(form.document);
  if (digits.length !== 14) {
    cnpjError.value = "";
    return;
  }
  if (!isValidCnpj(digits)) {
    cnpjError.value = "CNPJ inválido";
    return;
  }
  cnpjError.value = "";
  cnpjAbort?.abort();
  const controller = new AbortController();
  cnpjAbort = controller;
  cnpjLoading.value = true;
  try {
    const data = await $fetch<any>(
      `https://brasilapi.com.br/api/cnpj/v1/${digits}`,
      { signal: controller.signal }
    );
    if (controller.signal.aborted || onlyDigits(form.document) !== digits) {
      return;
    }
    if (!form.name && (data?.nome_fantasia || data?.razao_social)) {
      form.name = data?.nome_fantasia || data?.razao_social || form.name;
    }
    if (!form.legalName && data?.razao_social) {
      form.legalName = data.razao_social || form.legalName;
    }
    if (data?.cep) {
      form.cep = String(data.cep);
      await geocode();
    }
  } catch (e) {
    if (!controller.signal.aborted && onlyDigits(form.document) === digits) {
      cnpjError.value = "Não foi possível consultar o CNPJ";
    }
  } finally {
    if (cnpjAbort === controller) {
      cnpjAbort = null;
      cnpjLoading.value = false;
    }
  }
};

// Trigger on typing as soon as reaches 14 digits (masked)
const onCnpjInput = () => {
  const digits = onlyDigits(form.document);
  if (digits.length < 14 && cnpjError.value) {
    cnpjError.value = "";
  }
  if (digits.length === 14 && !cnpjLoading.value) {
    onCnpj();
  }
};

const askDiscard = () => {
  if (isFormDirty.value) {
    discardConfirm.value = true;
  }
};

const discardAndClose = () => {
  discardConfirm.value = false;
  cnpjError.value = "";
  openCreate.value = false;
};

const onCancelClick = () => {
  askDiscard();
  if (!discardConfirm.value) {
    openCreate.value = false;
  }
};

const populateLatLong = async () => {
  const encodedAddress = encodeURIComponent(form.address.trim());
  const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1`;
  // Fetch coordinates from Nominatim
  const response = await $fetch(nominatimUrl, {
    headers: {
      "User-Agent": "Hemocione Coleta/1.0",
    },
  });

  if (!response || !Array.isArray(response) || response.length === 0) {
    return;
  }

  const result = response[0];
  const lat = parseFloat(result.lat);
  const lng = parseFloat(result.lon);
  if (lat && lng) {
    scheduling.latitude = lat;
    scheduling.longitude = lng;
  } else {
    scheduling.latitude = null;
    scheduling.longitude = null;
  }
};

const createInst = async () => {
  if (!isLoggedIn.value) {
    loginPromptOpen.value = true;
    return;
  }
  saving.value = true;
  try {
    if (!scheduling.latitude || !scheduling.longitude) {
      await populateLatLong(); // Populate latitude and longitude if not available
    }
    await scheduling.createInstitution({
      name: form.name,
      legalName: form.legalName,
      document: (form.document || "").replace(/[^a-zA-Z0-9]/g, ""),
      kind: form.kind,
      address: form.address,
      phone: `+${(form.phone || "").replace(/[^a-zA-Z0-9]/g, "")}`,
      city: form.city,
      state: form.state,
      latitude: scheduling.latitude ?? undefined,
      longitude: scheduling.longitude ?? undefined,
    });
    useToast().add({ title: "Instituição criada", color: "success" });
  } catch {
    useToast().add({ title: "Erro ao criar instituição", color: "error" });
  } finally {
    saving.value = false;
    discardConfirm.value = false;
    openCreate.value = false;
  }
};

const onCreateClick = () => {
  if (!isLoggedIn.value) {
    loginPromptOpen.value = true;
    return;
  }
  // Prefill phone with logged user phone if available
  if (user.value?.phone && !form.phone) {
    form.phone = user.value.phone;
  }
  discardConfirm.value = false;
  cnpjError.value = "";
  openCreate.value = true;
};

const openEditInstitution = () => {
  const institution = selectedInstitution.value;
  if (!institution) return;

  Object.assign(editInstitutionForm, {
    name: institution.name || "",
    legalName: institution.legalName || "",
    address: institution.address || "",
    city: institution.city || "",
    state: institution.state || "",
    phone: institution.phone || "",
  });
  editInstitutionError.value = "";
  editInstitutionOpen.value = true;
};

const saveEditInstitution = async () => {
  if (!selectedInstitution.value || !isEditInstitutionValid.value) return;

  editInstitutionSaving.value = true;
  editInstitutionError.value = "";
  try {
    await scheduling.updateInstitution(selectedInstitution.value.id, {
      name: editInstitutionForm.name.trim(),
      legalName: editInstitutionForm.legalName.trim() || null,
      address: editInstitutionForm.address.trim() || null,
      city: editInstitutionForm.city.trim(),
      state: editInstitutionForm.state,
      phone: editInstitutionForm.phone.trim() || null,
    });
    editInstitutionOpen.value = false;
    useToast().add({ title: "Instituição atualizada", color: "success" });
  } catch (error: any) {
    editInstitutionError.value =
      error?.data?.message || error?.message || "Erro ao atualizar instituição";
  } finally {
    editInstitutionSaving.value = false;
  }
};
</script>
