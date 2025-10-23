<template>
  <div class="flex flex-col gap-8">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">
          Detalhes da Solicitação
        </h1>
        <p class="text-gray-600 mt-1">
          Informações completas da solicitação de coleta
        </p>
      </div>
      <UButton variant="ghost" icon="i-lucide-arrow-left" @click="goBack">
        Voltar
      </UButton>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <USpinner size="lg" />
      <span class="ml-3 text-gray-600">Carregando detalhes...</span>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="text-center py-12">
      <UIcon
        name="i-lucide-alert-circle"
        class="w-16 h-16 text-red-400 mx-auto mb-4"
      />
      <h3 class="text-lg font-medium text-gray-900 mb-2">
        Erro ao carregar solicitação
      </h3>
      <p class="text-gray-600 mb-4">{{ error }}</p>
      <UButton @click="loadRequestDetails">Tentar novamente</UButton>
    </div>

    <!-- Request Details -->
    <div v-else-if="request" class="space-y-6">
      <!-- Institution Information Card -->
      <UCard>
        <template #header>
          <div class="flex items-center space-x-4">
            <UAvatar
              v-if="request.institutionLogo"
              :src="request.institutionLogo"
              :alt="request.institutionName"
              size="lg"
            />
            <UAvatar
              v-else
              :alt="request.institutionName"
              size="lg"
              class="bg-blue-500"
            >
              {{ request.institutionName.charAt(0) }}
            </UAvatar>
            <div>
              <h2 class="text-xl font-semibold text-gray-900">
                {{ request.institutionName }}
              </h2>
              <p class="text-gray-600">{{ request.institutionAddress }}</p>
            </div>
          </div>
        </template>

        <div class="space-y-4">
          <!-- Status Badge -->
          <div class="flex items-center justify-between">
            <UBadge
              :color="getStatusColor(request.status)"
              variant="subtle"
              size="lg"
            >
              {{ getStatusLabel(request.status) }}
            </UBadge>
            <span class="text-sm text-gray-500">
              Criado em {{ formatDate(request.createdAt) }}
            </span>
          </div>

          <!-- Institution Details -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 class="text-sm font-medium text-gray-900 mb-2">
                Informações da Instituição
              </h4>
              <div class="space-y-2 text-sm">
                <div class="flex justify-between">
                  <span class="text-gray-600">ID da Instituição:</span>
                  <span class="font-mono text-xs">{{
                    request.institutionId
                  }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-600">Solicitado por:</span>
                  <span class="font-mono text-xs">{{
                    request.requestedByUserId
                  }}</span>
                </div>
              </div>
            </div>

            <div>
              <h4 class="text-sm font-medium text-gray-900 mb-2">
                Localização
              </h4>
              <div class="space-y-2 text-sm">
                <div class="flex justify-between">
                  <span class="text-gray-600">Latitude:</span>
                  <span>{{ request.institutionLocation.coordinates[1] }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-600">Longitude:</span>
                  <span>{{ request.institutionLocation.coordinates[0] }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </UCard>

      <!-- Requested Dates Card -->
      <UCard>
        <template #header>
          <h3 class="text-lg font-semibold text-gray-900">Datas Solicitadas</h3>
        </template>

        <div class="space-y-4">
          <div
            v-for="(date, index) in request.requestedDates"
            :key="index"
            class="border rounded-lg p-4"
          >
            <div class="flex items-center justify-between mb-2">
              <h4 class="font-medium text-gray-900">Opção {{ index + 1 }}</h4>
              <UBadge
                v-if="
                  request.status === 'accepted' &&
                  request.selectedAvailableDateId ===
                    date.availableDateId.toString() &&
                  request.selectedSlotId === date.slotId.toString()
                "
                color="success"
                variant="subtle"
              >
                Selecionada
              </UBadge>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span class="text-gray-600">Data:</span>
                <p class="font-medium">{{ formatDate(date.date) }}</p>
              </div>
              <div>
                <span class="text-gray-600">Horário:</span>
                <p class="font-medium">
                  {{ formatTimeRange(date.startTime, date.endTime) }}
                </p>
              </div>
              <div>
                <span class="text-gray-600">Equipe:</span>
                <div class="flex items-center space-x-2">
                  <div
                    class="w-3 h-3 rounded-full"
                    :style="{ backgroundColor: date.teamColor }"
                  ></div>
                  <span class="font-medium">{{ date.teamName }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </UCard>

      <!-- Map Card -->
      <UCard>
        <template #header>
          <h3 class="text-lg font-semibold text-gray-900">Localização</h3>
        </template>

        <div class="h-96 rounded-lg overflow-hidden">
          <div ref="mapContainer" class="w-full h-full" data-testid="map-container"></div>
        </div>
      </UCard>

      <!-- Status History Card -->
      <UCard>
        <template #header>
          <h3 class="text-lg font-semibold text-gray-900">
            Histórico de Status
          </h3>
        </template>

        <div class="space-y-4">
          <div
            v-for="(history, index) in request.statusHistory"
            :key="index"
            class="flex items-start space-x-3"
          >
            <div class="shrink-0">
              <div
                class="w-3 h-3 rounded-full mt-2"
                :class="getStatusColor(history.status)"
              ></div>
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between">
                <p class="text-sm font-medium text-gray-900">
                  {{ getStatusLabel(history.status) }}
                </p>
                <p class="text-xs text-gray-500">
                  {{ formatDateTime(history.changedAt) }}
                </p>
              </div>
              <p v-if="history.reason" class="text-sm text-gray-600 mt-1">
                {{ history.reason }}
              </p>
              <p v-if="history.changedBy" class="text-xs text-gray-500 mt-1">
                Alterado por: {{ history.changedBy }}
              </p>
            </div>
          </div>
        </div>
      </UCard>

      <!-- Rejection Reason (if rejected) -->
      <UCard v-if="request.status === 'rejected' && request.rejectionReason">
        <template #header>
          <h3 class="text-lg font-semibold text-gray-900">
            Motivo da Rejeição
          </h3>
        </template>

        <p class="text-gray-700">{{ request.rejectionReason }}</p>
      </UCard>

      <!-- Actions -->
      <div class="flex items-center justify-between pt-6 border-t">
        <UButton variant="ghost" icon="i-lucide-arrow-left" @click="goBack">
          Voltar para Lista
        </UButton>

        <div
          v-if="request.status === 'pending'"
          class="flex items-center space-x-3"
        >
          <UButton color="error" variant="outline" @click="rejectRequest">
            Rejeitar
          </UButton>
          <UButton color="success" @click="acceptRequest"> Aceitar </UButton>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useBloodbankStore } from "~/stores/bloodbank";
import { useUserStore } from "~/stores/user";
import type { CollectionRequest } from "~/stores/bloodbank";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import maplibregl from "maplibre-gl";

dayjs.extend(utc);
dayjs.extend(timezone);

const route = useRoute();
const router = useRouter();
const bloodbankStore = useBloodbankStore();
const userStore = useUserStore();

const requestId = route.params.requestId as string;
const bloodbankSlug = route.params.bloodbankSlug as string;

const bloodBanksLocationId = computed(
  () => userStore.currentBloodBankRole?.bloodBanksLocationId
);

const request = ref<CollectionRequest | null>(null);
const isLoading = ref(true);
const error = ref<string | null>(null);
const mapContainer = ref<HTMLDivElement | null>(null);
let map: maplibregl.Map | null = null;

const loadRequestDetails = async () => {
  isLoading.value = true;
  error.value = null;

  try {
    if (!bloodBanksLocationId.value) {
      error.value = "ID do banco de sangue não encontrado";
      return;
    }

    await bloodbankStore.loadCollectionRequestById(
      requestId,
      bloodBanksLocationId.value
    );
    request.value = bloodbankStore.currentCollectionRequest;

    if (!request.value) {
      error.value = "Solicitação não encontrada";
    }
  } catch (err: any) {
    error.value = err.message || "Erro ao carregar detalhes da solicitação";
  } finally {
    isLoading.value = false;
  }
};

const goBack = () => {
  router.push(`/${bloodbankSlug}/coletas`);
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "pending":
      return "yellow";
    case "accepted":
      return "green";
    case "rejected":
      return "red";
    case "cancelled":
      return "gray";
    default:
      return "blue";
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case "pending":
      return "Pendente";
    case "accepted":
      return "Aceita";
    case "rejected":
      return "Rejeitada";
    case "cancelled":
      return "Cancelada";
    case "institution_needs_validation":
      return "Aguardando Validação";
    default:
      return status;
  }
};

const formatDate = (date: string | Date) => {
  return dayjs(date).tz("America/Sao_Paulo").format("DD/MM/YYYY");
};

const formatDateTime = (date: string | Date) => {
  return dayjs(date).tz("America/Sao_Paulo").format("DD/MM/YYYY HH:mm");
};

const formatTimeRange = (startTime: Date, endTime: Date) => {
  const start = dayjs(startTime).tz("America/Sao_Paulo").format("HH:mm");
  const end = dayjs(endTime).tz("America/Sao_Paulo").format("HH:mm");
  return `${start} - ${end}`;
};

const initializeMap = () => {
  if (!mapContainer.value || !request.value) return;

  // Initialize map
  map = new maplibregl.Map({
    container: mapContainer.value,
    style: {
      version: 8,
      sources: {
        "raster-tiles": {
          type: "raster",
          tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
          tileSize: 256,
          attribution: "© OpenStreetMap contributors",
        },
      },
      layers: [
        {
          id: "simple-tiles",
          type: "raster",
          source: "raster-tiles",
          minzoom: 0,
          maxzoom: 22,
        },
      ],
    },
    center: [
      request.value.institutionLocation.coordinates[0],
      request.value.institutionLocation.coordinates[1],
    ],
    zoom: 13,
  });

  // Add institution marker
  new maplibregl.Marker({ color: "#3B82F6" })
    .setLngLat([
      request.value.institutionLocation.coordinates[0],
      request.value.institutionLocation.coordinates[1],
    ])
    .setPopup(
      new maplibregl.Popup().setHTML(`
        <div class="p-2">
          <h3 class="font-semibold">${request.value.institutionName}</h3>
          <p class="text-sm text-gray-600">${request.value.institutionAddress}</p>
        </div>
      `)
    )
    .addTo(map);

  // Add blood bank marker (you'll need to get the blood bank location)
  // For now, we'll use a placeholder location
  new maplibregl.Marker({ color: "#EF4444" })
    .setLngLat([-43.1729, -22.9068]) // Placeholder coordinates
    .setPopup(
      new maplibregl.Popup().setHTML(`
        <div class="p-2">
          <h3 class="font-semibold">HEMORIO</h3>
          <p class="text-sm text-gray-600">Banco de Sangue</p>
        </div>
      `)
    )
    .addTo(map);
};

const acceptRequest = () => {
  // Navigate to accept modal or implement accept logic
  router.push(`/${bloodbankSlug}/coletas?accept=${requestId}`);
};

const rejectRequest = () => {
  // Navigate to reject modal or implement reject logic
  router.push(`/${bloodbankSlug}/coletas?reject=${requestId}`);
};

onMounted(async () => {
  await loadRequestDetails();

  // Initialize map after request is loaded
  if (request.value) {
    setTimeout(initializeMap, 100);
  }
});

onUnmounted(() => {
  if (map) {
    map.remove();
  }
});
</script>
