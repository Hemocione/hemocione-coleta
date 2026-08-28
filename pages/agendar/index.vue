<template>
  <div class="space-y-4 md:space-y-6">
    <Transition name="fade" mode="out-in">
      <div
        v-if="visibleNearbyBloodBanks.length"
        class="space-y-6"
        data-testid="blood-banks-results"
        aria-live="polite"
        :aria-busy="isLoadingBloodBanks"
      >
        <div class="flex justify-end">
          <UButton
            v-if="!hasLatLng"
            data-testid="use-location-button"
            color="neutral"
            variant="soft"
            icon="i-lucide-crosshair"
            class="w-full shrink-0 sm:w-auto"
            :loading="geolocLoading"
            @click="useMyLocation"
          >
            Usar minha localização
          </UButton>
        </div>
        <section v-if="availableNearbyBloodBanks.length" class="space-y-3">
          <div>
            <h3 class="text-lg font-semibold text-gray-900">
              Agende uma campanha na sua instituição
            </h3>
            <p class="text-sm text-gray-600">
              Escolha um banco de sangue próximo com agenda disponível e agende
              uma campanha de doação na sua instituição.
            </p>
          </div>
          <div class="grid gap-4 md:grid-cols-2" v-auto-animate>
            <AgendarBloodBankCard
              v-for="bank in availableNearbyBloodBanks"
              :key="bank._id || bank.bloodBanksLocationId || bank.name"
              :bank="bank"
              :action-disabled="interestLoading"
              @select="selectBank"
              @interest="openInterest"
            />
          </div>
        </section>

        <section v-if="unavailableNearbyBloodBanks.length" class="space-y-3">
          <div>
            <h3 class="text-lg font-semibold text-gray-900">
              Registre interesse em uma coleta externa
            </h3>
            <p class="text-sm text-gray-600">
              Os bancos de sangue próximos de você ainda não permitem
              agendamento pela plataforma.
            </p>
          </div>
          <div class="grid gap-4 md:grid-cols-2" v-auto-animate>
            <AgendarBloodBankCard
              v-for="bank in unavailableNearbyBloodBanks"
              :key="bank._id || bank.bloodBanksLocationId || bank.name"
              :bank="bank"
              :action-disabled="interestLoading"
              :interest-loading="
                interestLoading &&
                interestBank?.bloodBanksLocationId === bank.bloodBanksLocationId
              "
              @select="selectBank"
              @interest="openInterest"
            />
          </div>
        </section>
      </div>
      <div
        v-else-if="isLoadingBloodBanks"
        class="text-center py-12 text-gray-600"
      >
        <UIcon
          name="i-lucide-loader-2"
          class="w-10 h-10 mx-auto mb-3 animate-spin text-gray-400"
        />
        <p>Carregando bancos de sangue disponíveis…</p>
      </div>
      <div v-else class="text-center py-12 text-gray-600">
        <UIcon
          name="i-lucide-building"
          class="w-10 h-10 mx-auto mb-3 text-gray-400"
        />
        <p v-if="selectedInstitution && hasLatLng">
          Nenhum banco de sangue localizado próximo à instituição selecionada.
        </p>
        <p v-else>Nenhum banco de sangue disponível para o local informado.</p>
        <div class="mt-4">
          <UButton
            data-testid="use-location-button"
            color="primary"
            icon="i-lucide-crosshair"
            :loading="geolocLoading"
            @click="useMyLocation"
          >
            Usar minha localização
          </UButton>
        </div>
      </div>
    </Transition>

    <UModal
      v-model:open="interestDialogOpen"
      :title="interestDialogTitle"
      @update:open="handleInterestDialogUpdate"
    >
      <template #content>
        <form class="space-y-4 p-6" @submit.prevent="submitInterest">
          <div>
            <h2 class="text-lg font-semibold">{{ interestDialogTitle }}</h2>
            <p class="mt-1 text-sm text-gray-600">
              {{ interestDialogDescription }}
            </p>
            <p
              v-if="interestBank"
              class="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700"
            >
              Banco de sangue: <strong>{{ interestBank.name }}</strong>
            </p>
          </div>
          <div v-if="!isLoggedIn" class="space-y-1.5">
            <label
              for="interest-institution-name"
              class="block text-sm font-medium text-gray-700"
            >
              Nome da instituição
              <span class="font-normal text-gray-500">(obrigatório)</span>
            </label>
            <UInput
              id="interest-institution-name"
              name="institutionName"
              :model-value="interestInstitutionName"
              @update:model-value="handleInterestInstitutionNameInput"
              data-testid="interest-institution-name"
              autocomplete="organization"
              class="w-full"
              aria-required="true"
              :disabled="interestLoading"
              :aria-invalid="Boolean(interestInstitutionNameError)"
              :aria-describedby="
                interestInstitutionNameError
                  ? 'interest-institution-name-error'
                  : undefined
              "
            />
            <p
              v-if="interestInstitutionNameError"
              id="interest-institution-name-error"
              class="text-sm text-red-600"
            >
              {{ interestInstitutionNameError }}
            </p>
          </div>
          <div v-if="!isLoggedIn" class="space-y-1.5">
            <label
              for="interest-institution-cnpj"
              class="block text-sm font-medium text-gray-700"
            >
              CNPJ <span class="font-normal text-gray-500">(opcional)</span>
            </label>
            <UInput
              id="interest-institution-cnpj"
              name="institutionCnpj"
              :model-value="interestInstitutionCnpj"
              @update:model-value="handleInstitutionCnpjInput"
              data-testid="interest-institution-cnpj"
              placeholder="00.000.000/0000-00"
              inputmode="text"
              autocapitalize="characters"
              autocomplete="organization"
              class="w-full"
              :disabled="interestLoading"
              :aria-invalid="Boolean(interestInstitutionCnpjError)"
              :aria-describedby="
                interestInstitutionCnpjError
                  ? 'interest-institution-cnpj-error'
                  : undefined
              "
            />
            <p
              v-if="interestInstitutionCnpjError"
              id="interest-institution-cnpj-error"
              class="text-sm text-red-600"
            >
              {{ interestInstitutionCnpjError }}
            </p>
          </div>
          <div v-if="!isLoggedIn" class="space-y-1.5">
            <label
              for="interest-name"
              class="block text-sm font-medium text-gray-700"
            >
              Nome
            </label>
            <UInput
              id="interest-name"
              name="name"
              :model-value="interestName"
              @update:model-value="handleInterestNameInput"
              data-testid="interest-name"
              autocomplete="name"
              class="w-full"
              :disabled="interestLoading"
              :aria-invalid="Boolean(interestNameError)"
              :aria-describedby="interestNameError ? 'interest-name-error' : undefined"
            />
            <p
              v-if="interestNameError"
              id="interest-name-error"
              class="text-sm text-red-600"
            >
              {{ interestNameError }}
            </p>
          </div>
          <div v-if="!isLoggedIn" class="space-y-1.5">
            <label
              for="interest-phone"
              class="block text-sm font-medium text-gray-700"
            >
              Telefone
            </label>
            <UInput
              id="interest-phone"
              name="phone"
              :model-value="interestPhone"
              @update:model-value="handleInterestPhoneInput"
              data-testid="interest-phone"
              type="tel"
              placeholder="+55 (DD) 99999-9999"
              autocomplete="tel"
              class="w-full"
              :disabled="interestLoading"
              :aria-invalid="Boolean(interestPhoneError)"
              :aria-describedby="interestPhoneError ? 'interest-phone-error' : undefined"
            />
            <p
              v-if="interestPhoneError"
              id="interest-phone-error"
              class="text-sm text-red-600"
            >
              {{ interestPhoneError }}
            </p>
          </div>
          <p
            v-if="interestFormError"
            id="interest-form-error"
            class="text-sm text-red-600"
            role="alert"
          >
            {{ interestFormError }}
          </p>
          <div class="flex justify-end gap-2">
            <UButton
              type="button"
              color="neutral"
              variant="ghost"
              :disabled="interestLoading"
              @click="closeInterestDialog"
            >
              Cancelar
            </UButton>
            <UButton
              type="submit"
              color="primary"
              :loading="interestLoading"
              :disabled="interestLoading"
              data-testid="interest-submit"
            >
              Enviar interesse
            </UButton>
          </div>
        </form>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: "agendamento" });
import {
  useSchedulingStore,
  type BloodBankListItem,
} from "~/stores/scheduling";
import { fetchWithAuth } from "~/composables/useFetchWithAuth";
import { useUserStore } from "~/stores/user";
import { formatCnpj, isValidCnpj } from "~/utils/cnpj";
import { formatBrazilPhone, isValidBrazilPhone } from "~/utils/phone";

const store = useSchedulingStore();
const userStore = useUserStore();
const { nearbyBloodBanks, isLoadingBloodBanks } = storeToRefs(store);
const visibleNearbyBloodBanks = computed(() =>
  nearbyBloodBanks.value.filter((bank) => bank.hidden !== true),
);
const isSchedulable = (bank: BloodBankListItem) =>
  bank.availability === "active" && Boolean(bank.slug);
const availableNearbyBloodBanks = computed(() =>
  visibleNearbyBloodBanks.value.filter(isSchedulable),
);
const unavailableNearbyBloodBanks = computed(() =>
  visibleNearbyBloodBanks.value.filter((bank) => !isSchedulable(bank)),
);

const selectedInstitution = computed(() => store.selectedInstitution);
const hasLatLng = computed(() => store.hasLatLng);
const isLoggedIn = computed(() => Boolean(userStore.user));

const interestDialogOpen = ref(false);
const interestBank = ref<BloodBankListItem | null>(null);
const interestInstitutionName = ref("");
const interestInstitutionCnpj = ref("");
const interestName = ref("");
const interestPhone = ref("");
const interestInstitutionNameError = ref("");
const interestInstitutionCnpjError = ref("");
const interestNameError = ref("");
const interestPhoneError = ref("");
const interestFormError = ref("");
const interestLoading = ref(false);
const INTEREST_REQUEST_TIMEOUT_MS = 15_000;
const INTEREST_DRAFT_STORAGE_KEY = "hemocione:agendar:interest-draft:v1";

const interestDialogTitle = computed(() =>
  interestBank.value
    ? `Quero organizar uma coleta com o ${interestBank.value.name}`
    : "Quero organizar uma coleta",
);

const interestDialogDescription = computed(
  () => "Informe a instituição onde você quer realizar a coleta.",
);

const selectBank = (bank: BloodBankListItem) => {
  if (!isSchedulable(bank)) return;
  store.setSelectedBloodBank(bank);
  navigateTo(`/agendar/${bank.slug}`);
};

const resetInterestForm = () => {
  interestInstitutionName.value = "";
  interestInstitutionCnpj.value = "";
  interestName.value = "";
  interestPhone.value = formatBrazilPhone("");
  interestInstitutionNameError.value = "";
  interestInstitutionCnpjError.value = "";
  interestNameError.value = "";
  interestPhoneError.value = "";
  interestFormError.value = "";
};

function getInterestDraftStorage() {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

const saveInterestDraft = () => {
  const storage = getInterestDraftStorage();
  if (!storage) return;
  try {
    storage.setItem(
      INTEREST_DRAFT_STORAGE_KEY,
      JSON.stringify({
        institutionName: interestInstitutionName.value,
        institutionCnpj: interestInstitutionCnpj.value,
        name: interestName.value,
        phone: interestPhone.value,
      }),
    );
  } catch {
    // Continue without a local draft when browser storage is unavailable.
  }
};

const restoreInterestDraft = () => {
  const storage = getInterestDraftStorage();
  if (!storage) return;
  try {
    const rawDraft = storage.getItem(INTEREST_DRAFT_STORAGE_KEY);
    if (!rawDraft) return;
    const draft: unknown = JSON.parse(rawDraft);
    if (!draft || typeof draft !== "object") return;
    const values = draft as Record<string, unknown>;
    interestInstitutionName.value =
      typeof values.institutionName === "string"
        ? values.institutionName.slice(0, 200)
        : "";
    interestInstitutionCnpj.value =
      typeof values.institutionCnpj === "string"
        ? formatCnpj(values.institutionCnpj)
        : "";
    interestName.value =
      typeof values.name === "string" ? values.name.slice(0, 200) : "";
    interestPhone.value =
      typeof values.phone === "string"
        ? formatBrazilPhone(values.phone)
        : formatBrazilPhone("");
  } catch {
    // Ignore malformed or unavailable local drafts.
  }
};

const clearInterestDraft = () => {
  const storage = getInterestDraftStorage();
  if (!storage) return;
  try {
    storage.removeItem(INTEREST_DRAFT_STORAGE_KEY);
  } catch {
    // Continue after a storage cleanup failure.
  }
};

const closeInterestDialog = () => {
  interestDialogOpen.value = false;
  interestBank.value = null;
  resetInterestForm();
};

const handleInterestDialogUpdate = (open: boolean) => {
  if (open) {
    interestDialogOpen.value = true;
    return;
  }
  closeInterestDialog();
};

const handleInstitutionCnpjInput = (value: string) => {
  interestInstitutionCnpj.value = formatCnpj(value);
  interestInstitutionCnpjError.value = "";
  saveInterestDraft();
};

const handleInterestPhoneInput = (value: string) => {
  interestPhone.value = formatBrazilPhone(value);
  interestPhoneError.value = "";
  saveInterestDraft();
};

const handleInterestInstitutionNameInput = (value: string) => {
  interestInstitutionName.value = value;
  interestInstitutionNameError.value = "";
  saveInterestDraft();
};

const handleInterestNameInput = (value: string) => {
  interestName.value = value;
  interestNameError.value = "";
  saveInterestDraft();
};

function statusCodeOf(error: unknown) {
  if (!error || typeof error !== "object") return undefined;
  const response = "response" in error ? error.response : undefined;
  return "statusCode" in error && typeof error.statusCode === "number"
    ? error.statusCode
    : "status" in error && typeof error.status === "number"
      ? error.status
      : response && typeof response === "object" && "status" in response
        ? response.status
        : undefined;
}

const submitInterest = async () => {
  const bank = interestBank.value;
  if (!bank?.bloodBanksLocationId) return;

  const institution = selectedInstitution.value;
  if (isLoggedIn.value && !institution?.id) {
    useToast().add({
      title: "Selecione uma instituição antes de enviar o interesse",
      color: "warning",
    });
    return;
  }

  const institutionName = isLoggedIn.value
    ? undefined
    : interestInstitutionName.value.trim();
  const institutionCnpj = isLoggedIn.value
    ? undefined
    : interestInstitutionCnpj.value.trim();
  const name = isLoggedIn.value
    ? undefined
    : interestName.value.trim();
  const phone = isLoggedIn.value
    ? undefined
    : interestPhone.value.trim();
  if (!isLoggedIn.value && !institutionName) {
    interestInstitutionNameError.value = "Informe o nome da instituição.";
    return;
  }
  if (institutionCnpj && !isValidCnpj(institutionCnpj)) {
    interestInstitutionCnpjError.value = "Informe um CNPJ válido.";
    return;
  }
  if (!isLoggedIn.value && !name) {
    interestNameError.value = "Informe seu nome.";
    return;
  }
  if (!isLoggedIn.value || phone) {
    if (!isValidBrazilPhone(phone || "")) {
      interestPhoneError.value = "Informe um telefone válido.";
      return;
    }
  }

  interestInstitutionNameError.value = "";
  interestInstitutionCnpjError.value = "";
  interestNameError.value = "";
  interestPhoneError.value = "";
  interestFormError.value = "";
  interestLoading.value = true;
  try {
    await fetchWithAuth("/api/v1/public/bloodbank-interests", {
      method: "POST",
      timeout: INTEREST_REQUEST_TIMEOUT_MS,
      body: {
        bloodBanksLocationId: bank.bloodBanksLocationId,
        bankName: bank.name,
        ...(institution?.id ? { institutionId: institution.id } : {}),
        ...(institutionName ? { institutionName } : {}),
        ...(institutionCnpj ? { institutionCnpj } : {}),
        ...(name ? { name } : {}),
        ...(phone ? { phone } : {}),
        origin: "ondedoar",
      },
    });
    closeInterestDialog();
    clearInterestDraft();
    useToast().add({
      title: "Interesse registrado",
      color: "success",
    });
    resetInterestForm();
  } catch (error) {
    if (statusCodeOf(error) === 409) {
      interestFormError.value =
        "Este banco agora tem agenda disponível. Feche esta janela e escolha “Agendar campanha”.";
      void store.loadBloodBanksByCoverage();
      return;
    }
    if (isLoggedIn.value) {
      useToast().add({
        title: "Não foi possível registrar o interesse",
        color: "error",
      });
    } else {
      interestFormError.value =
        "Não foi possível registrar o interesse. Tente novamente.";
    }
  } finally {
    interestLoading.value = false;
  }
};

const openInterest = async (bank: BloodBankListItem) => {
  if (!bank.bloodBanksLocationId || interestLoading.value) return;
  if (isLoggedIn.value && !selectedInstitution.value?.id) {
    useToast().add({
      title: "Selecione uma instituição antes de enviar o interesse",
      color: "warning",
    });
    return;
  }
  interestBank.value = bank;
  resetInterestForm();
  if (isLoggedIn.value) {
    await submitInterest();
    return;
  }
  restoreInterestDraft();
  interestDialogOpen.value = true;
};

onMounted(() => {
  store.setAccessedAgendarPage(true);
  if (!store.selectedInstitution) {
    void store.loadBloodBanksByCoverage();
  }
});

useHead({
  title: "Agendar Coleta",
});

const geolocLoading = ref(false);
const useMyLocation = async () => {
  if (!navigator.geolocation) {
    useToast().add({ title: "Geolocalização não suportada", color: "warning" });
    return;
  }
  geolocLoading.value = true;
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      try {
        store.latitude = pos.coords.latitude;
        store.longitude = pos.coords.longitude;
        await store.loadBloodBanksByCoverage();
      } finally {
        geolocLoading.value = false;
      }
    },
    (err) => {
      geolocLoading.value = false;
      const messages: Record<number, string> = {
        1: "Permissão de localização negada",
        2: "Posição indisponível",
        3: "Tempo excedido ao obter localização",
      };
      useToast().add({
        title: messages[err.code] || "Erro ao obter localização",
        color: "error",
      });
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
};
</script>
