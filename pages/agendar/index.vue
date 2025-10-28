<template>
  <div class="space-y-4 md:space-y-6">
    <Transition name="fade" mode="out-in">
      <div
        v-if="selectedInstitution && nearbyBloodBanks.length"
        class="space-y-3"
      >
        <h3 class="text-base font-semibold">Bancos de sangue próximos</h3>
        <div class="grid md:grid-cols-2 gap-4" v-auto-animate>
          <UCard
            v-for="b in nearbyBloodBanks"
            :key="b.bloodBanksLocationId"
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
              <UButton color="primary" size="sm" @click="selectBank(b)"
                >Selecionar</UButton
              >
            </div>
          </UCard>
        </div>
      </div>
      <div v-else class="text-center py-12 text-gray-600">
        <UIcon
          name="i-lucide-building"
          class="w-10 h-10 mx-auto mb-3 text-gray-400"
        />
        <p v-if="!selectedInstitution">
          Selecione ou registre uma instituição para ver bancos de sangue
          disponíveis.
        </p>
        <p v-else>
          A instituição selecionada não possui coordenadas para buscar bancos
          próximos.
        </p>
        <div v-if="selectedInstitution" class="mt-4">
          <UButton
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
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: "agendamento" });
import { useSchedulingStore } from "~/stores/scheduling";

const store = useSchedulingStore();
const { nearbyBloodBanks } = storeToRefs(store);

const selectedInstitution = computed(() => store.selectedInstitution);

const selectBank = (b: any) => {
  store.setSelectedBloodBank(b);
  navigateTo(`/agendar/${b.slug}`);
};

onMounted(() => {
  store.setAccessedAgendarPage(true);
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
