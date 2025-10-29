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
          <span class="font-semibold">Agendar Coleta</span>
        </div>
        <div class="flex items-center gap-2">
          <UButton
            v-if="!isLoggedIn"
            color="primary"
            icon="i-lucide-log-in"
            @click="onLogin"
            >Entrar</UButton
          >
          <UButton
            v-else
            color="neutral"
            icon="i-lucide-log-out"
            @click="onLogout"
            >Sair ({{ firstName }})</UButton
          >
        </div>
      </div>
    </header>

    <main class="max-w-5xl mx-auto px-4 py-6">
      <!-- Institution bar -->
      <UCard class="mb-3 md:mb-4" :ui="{ body: 'p-3 md:p-4' }">
        <div
          class="flex flex-col md:flex-row md:items-start md:justify-between gap-3 md:gap-4"
        >
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium mb-1 md:mb-2">Instituição</div>
            <div
              v-if="isLoggedIn && userInstitutions.length"
              class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
            >
              <USelect
                v-model="selectedInstitutionId"
                :items="institutionItems"
                placeholder="Selecione sua instituição"
                class="w-full md:w-80"
                @change="onSelectInstitution"
              />
            </div>
            <div v-else class="text-sm text-gray-600 leading-snug">
              Entre para selecionar sua instituição ou crie uma nova.
            </div>
          </div>
          <div class="flex flex-wrap items-center gap-2 md:justify-end">
            <UButton
              color="neutral"
              variant="soft"
              icon="i-lucide-building"
              class="w-full sm:w-auto"
              @click="onCreateClick"
            >
              Registrar Instituição
            </UButton>
          </div>
        </div>
      </UCard>

      <!-- Create Institution Modal -->
      <UModal v-model:open="openCreate">
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
            <UFormField label="CNPJ" key="cnpj">
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
            <div class="flex items-center justify-end gap-2 mt-2">
              <UButton variant="ghost" @click="openCreate = false"
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

      <!-- Login Prompt Modal (quando deslogado) -->
      <UModal v-model:open="loginPromptOpen">
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

      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import { redirectToID } from "~/middleware/auth";
import { useUserStore } from "~/stores/user";
import { useSchedulingStore } from "~/stores/scheduling";
import { geocodeCep } from "~/utils/geocode";
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

// Institution select/create (global)
const scheduling = useSchedulingStore();
const { selectedInstitution } = storeToRefs(scheduling);
const openCreate = ref(false);
const loginPromptOpen = ref(false);
const saving = ref(false);
const cnpjLoading = ref(false);
const geocodeLoading = ref(false);
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
        scheduling.setSelectedInstitution(firstInst);
        selectedInstitutionId.value = firstInst.id;
        // Load blood banks if institution has coordinates
        if (firstInst.latitude && firstInst.longitude) {
          scheduling.loadBloodBanksByCoverage();
        }
      }
    } catch {}
  }
});

watch(selectedInstitution, (newVal, oldVal) => {
  if (newVal?.id !== oldVal?.id) {
    selectedInstitutionId.value = newVal?.id;
    onSelectInstitution();
  }
});

const onSelectInstitution = () => {
  const inst =
    scheduling?.userInstitutions?.find(
      (i) => i.id === selectedInstitutionId.value
    ) || null;
  scheduling.setSelectedInstitution(inst);
  // Load blood banks if institution has coordinates
  scheduling.loadBloodBanksByCoverage();
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

const isFormValid = computed(() => {
  return (
    form.name.trim() !== "" &&
    form.document.trim() !== "" &&
    form.legalName.trim() !== "" &&
    form.cep.trim() !== "" &&
    form.address.trim() !== "" &&
    form.city.trim() !== "" &&
    form.state.trim() !== "" &&
    form.phone.trim() !== "" &&
    form.kind.trim() !== ""
  );
});

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

const onCnpj = async () => {
  const digits = (form.document || "").replace(/\D/g, "");
  if (digits.length !== 14) return;
  try {
    cnpjLoading.value = true;
    const data = await $fetch<any>(
      `https://brasilapi.com.br/api/cnpj/v1/${digits}`
    );
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
    // ignore errors silently
  } finally {
    cnpjLoading.value = false;
  }
};

// Trigger on typing as soon as reaches 14 digits (masked)
const onCnpjInput = () => {
  const digits = (form.document || "").replace(/\D/g, "");
  if (digits.length === 14 && !cnpjLoading.value) {
    onCnpj();
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
  openCreate.value = true;
};
</script>
