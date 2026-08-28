<template>
  <div class="space-y-4 md:space-y-6">
    <Transition name="fade" mode="out-in">
      <div v-if="visibleNearbyBloodBanks.length" class="space-y-3">
        <div class="flex items-center justify-between gap-3">
          <div>
            <h3 class="text-base font-semibold">
              {{
                selectedInstitution
                  ? "Bancos de sangue próximos"
                  : "Bancos de sangue disponíveis"
              }}
            </h3>
            <p v-if="!selectedInstitution" class="text-sm text-gray-600">
              Escolha um banco de sangue para iniciar o agendamento.
            </p>
          </div>
          <UButton
            v-if="!hasLatLng"
            data-testid="use-location-button"
            color="neutral"
            variant="soft"
            icon="i-lucide-crosshair"
            :loading="geolocLoading"
            @click="useMyLocation"
          >
            Usar minha localização
          </UButton>
        </div>
        <div class="grid md:grid-cols-2 gap-4" v-auto-animate>
          <UCard
            v-for="b in visibleNearbyBloodBanks"
            :key="b._id || b.bloodBanksLocationId || b.name"
            class="hover:shadow"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <UAvatar :src="b.logo || undefined" size="md">{{
                  b.name.charAt(0)
                }}</UAvatar>
                <div>
                  <div class="font-medium">{{ b.name }}</div>
                  <div class="text-xs text-gray-500" v-if="b.distanceMeters">
                    {{ (b.distanceMeters / 1000).toFixed(1) }} km
                  </div>
                </div>
              </div>
              <UButton
                v-if="isSchedulable(b)"
                :data-testid="`select-bank-${b._id || b.bloodBanksLocationId}`"
                color="primary"
                size="sm"
                @click="selectBank(b)"
              >
                Selecionar
              </UButton>
              <UButton
                v-else
                :data-testid="`interest-bank-${b._id || b.bloodBanksLocationId}`"
                color="neutral"
                variant="soft"
                size="sm"
                :loading="interestLoading && interestBank?.bloodBanksLocationId === b.bloodBanksLocationId"
                @click="openInterest(b)"
              >
                Sinalizar Interesse
              </UButton>
            </div>
          </UCard>
        </div>
      </div>
      <div
        v-else-if="isLoadingBloodBanks"
        class="text-center py-12 text-gray-600"
      >
        <UIcon
          name="i-lucide-loader-2"
          class="w-10 h-10 mx-auto mb-3 animate-spin text-gray-400"
        />
        <p>Carregando bancos de sangue disponíveis...</p>
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

    <UModal v-model:open="interestDialogOpen" title="Sinalizar interesse">
      <template #content>
        <form class="space-y-4 p-6" @submit.prevent="submitInterest">
          <div>
            <h3 class="text-lg font-semibold">Sinalizar interesse</h3>
            <p class="mt-1 text-sm text-gray-600">
              Informe seus dados para avisarmos o banco de sangue.
            </p>
          </div>
          <div class="space-y-1">
            <label for="interest-name" class="text-sm font-medium">Nome</label>
            <UInput
              id="interest-name"
              v-model="interestName"
              data-testid="interest-name"
              autocomplete="name"
              :disabled="interestLoading"
            />
            <p v-if="interestError" class="text-sm text-red-600">
              {{ interestError }}
            </p>
          </div>
          <div class="space-y-1">
            <label for="interest-phone" class="text-sm font-medium">Telefone</label>
            <UInput
              id="interest-phone"
              v-model="interestPhone"
              data-testid="interest-phone"
              type="tel"
              autocomplete="tel"
              :disabled="interestLoading"
            />
          </div>
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
import { onlyDigits } from "~/utils/cnpj";

const store = useSchedulingStore();
const userStore = useUserStore();
const { nearbyBloodBanks, isLoadingBloodBanks } = storeToRefs(store);
const visibleNearbyBloodBanks = computed(() =>
  nearbyBloodBanks.value.filter((bank) => bank.hidden !== true),
);

const selectedInstitution = computed(() => store.selectedInstitution);
const hasLatLng = computed(() => store.hasLatLng);
const isLoggedIn = computed(() => Boolean(userStore.user));

const interestDialogOpen = ref(false);
const interestBank = ref<BloodBankListItem | null>(null);
const interestName = ref("");
const interestPhone = ref("");
const interestError = ref("");
const interestLoading = ref(false);

const isSchedulable = (bank: BloodBankListItem) =>
  bank.availability
    ? bank.availability === "active" && Boolean(bank.slug)
    : bank.active !== false && Boolean(bank.slug);

const selectBank = (bank: BloodBankListItem) => {
  if (!isSchedulable(bank)) return;
  store.setSelectedBloodBank(bank);
  navigateTo(`/agendar/${bank.slug}`);
};

const resetInterestForm = () => {
  interestName.value = "";
  interestPhone.value = "";
  interestError.value = "";
};

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
    interestError.value = "Informe seu nome.";
    return;
  }
  if (!isLoggedIn.value || phone) {
    const phoneDigits = onlyDigits(phone || "");
    if (phoneDigits.length < 10 || phoneDigits.length > 13) {
      interestError.value = "Informe um telefone válido.";
      return;
    }
  }

  interestError.value = "";
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
    useToast().add({ title: "Interesse enviado", color: "success" });
    resetInterestForm();
  } catch {
    if (isLoggedIn.value) {
      useToast().add({
        title: "Não foi possível enviar o interesse",
        color: "error",
      });
    } else {
      interestError.value = "Não foi possível enviar o interesse. Tente novamente.";
    }
  } finally {
    interestLoading.value = false;
  }
};

const openInterest = async (bank: BloodBankListItem) => {
  if (!bank.bloodBanksLocationId) return;
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
