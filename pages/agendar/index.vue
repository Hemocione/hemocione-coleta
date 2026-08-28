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
        <div
          class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <h2 class="text-base font-semibold text-gray-900">
            {{
              selectedInstitution
                ? "Bancos de sangue próximos"
                : "Bancos de sangue disponíveis"
            }}
          </h2>
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
              Agende sua doação online
            </h3>
            <p class="text-sm text-gray-600">
              Escolha um banco de sangue com agenda disponível e reserve uma
              data.
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
              Organize uma coleta externa na sua instituição
            </h3>
            <p class="text-sm text-gray-600">
              Este banco ainda não permite agendamento pela plataforma. Informe
              que você quer organizar uma coleta externa na sua instituição. Se
              houver interesse suficiente, a equipe Hemocione entra em contato
              com o banco para avaliar o evento.
            </p>
          </div>
          <div class="grid gap-4 md:grid-cols-2" v-auto-animate>
            <AgendarBloodBankCard
              v-for="bank in unavailableNearbyBloodBanks"
              :key="bank._id || bank.bloodBanksLocationId || bank.name"
              :bank="bank"
              :action-disabled="interestLoading"
              :interest-loading="
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

    <UModal v-model:open="interestDialogOpen" :title="interestDialogTitle">
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
          <div class="space-y-1">
            <label for="interest-name" class="text-sm font-medium">Nome</label>
            <UInput
              id="interest-name"
              name="name"
              v-model="interestName"
              data-testid="interest-name"
              autocomplete="name"
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
          <div class="space-y-1">
            <label for="interest-phone" class="text-sm font-medium">Telefone</label>
            <UInput
              id="interest-phone"
              name="phone"
              v-model="interestPhone"
              data-testid="interest-phone"
              type="tel"
              autocomplete="tel"
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
              @click="interestDialogOpen = false"
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
              Organizar coleta externa
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
import { onlyDigits } from "~/utils/cnpj";

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
const interestName = ref("");
const interestPhone = ref("");
const interestNameError = ref("");
const interestPhoneError = ref("");
const interestFormError = ref("");
const interestLoading = ref(false);

const interestDialogTitle = computed(() =>
  interestBank.value
    ? `Organize uma coleta externa com o ${interestBank.value.name}`
    : "Organize uma coleta externa",
);

const interestDialogDescription = computed(() =>
  interestBank.value?.availability === "inactive"
    ? "A agenda online deste banco está indisponível. Seu pedido informa à equipe Hemocione que você quer organizar uma coleta externa na sua instituição. Se houver interesse suficiente, a equipe entra em contato com o banco para avaliar o evento."
    : interestBank.value?.availability === "missing"
      ? "Este banco ainda não tem agenda na plataforma. Seu pedido informa à equipe Hemocione que você quer organizar uma coleta externa na sua instituição. Se houver interesse suficiente, a equipe entra em contato com o banco para avaliar o evento."
      : "Seu pedido informa à equipe Hemocione que você quer organizar uma coleta externa na sua instituição.",
);

const selectBank = (bank: BloodBankListItem) => {
  if (!isSchedulable(bank)) return;
  store.setSelectedBloodBank(bank);
  navigateTo(`/agendar/${bank.slug}`);
};

const resetInterestForm = () => {
  interestName.value = "";
  interestPhone.value = "";
  interestNameError.value = "";
  interestPhoneError.value = "";
  interestFormError.value = "";
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

  const name = isLoggedIn.value
    ? undefined
    : interestName.value.trim();
  const phone = isLoggedIn.value
    ? undefined
    : interestPhone.value.trim();
  if (!isLoggedIn.value && !name) {
    interestNameError.value = "Informe seu nome.";
    return;
  }
  if (!isLoggedIn.value || phone) {
    const phoneDigits = onlyDigits(phone || "");
    if (phoneDigits.length < 10 || phoneDigits.length > 13) {
      interestPhoneError.value = "Informe um telefone válido.";
      return;
    }
  }

  interestNameError.value = "";
  interestPhoneError.value = "";
  interestFormError.value = "";
  interestLoading.value = true;
  try {
    await fetchWithAuth("/api/v1/public/bloodbank-interests", {
      method: "POST",
      body: {
        bloodBanksLocationId: bank.bloodBanksLocationId,
        bankName: bank.name,
        ...(name ? { name } : {}),
        ...(phone ? { phone } : {}),
        origin: "ondedoar",
      },
    });
    interestDialogOpen.value = false;
    useToast().add({
      title: "Interesse em coleta externa registrado",
      color: "success",
    });
    resetInterestForm();
  } catch (error) {
    if (statusCodeOf(error) === 409) {
      interestFormError.value =
        "Este banco agora tem agenda disponível. Feche esta janela e escolha “Agendar coleta”.";
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
  interestBank.value = bank;
  resetInterestForm();
  if (isLoggedIn.value) {
    await submitInterest();
    return;
  }
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
