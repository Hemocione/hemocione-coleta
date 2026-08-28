<template>
  <div class="space-y-6">
    <!-- Loading State -->
    <Transition name="fade" mode="out-in">
      <div v-if="isLoading" class="space-y-6">
        <USkeleton class="h-16 w-full rounded-lg" />
        <USkeleton class="h-64 w-full rounded-lg" />
      </div>

      <!-- Error State -->
      <div v-else-if="hasError" class="text-center py-12">
        <UIcon
          name="i-lucide-alert-circle"
          class="w-16 h-16 text-red-400 mx-auto mb-4"
        />
        <h3 class="text-lg font-medium text-gray-900 mb-2">
          Erro ao carregar dados
        </h3>
        <p class="text-gray-600 mb-4">
          Não foi possível carregar os dados do painel.
        </p>
        <UButton color="primary" @click="loadDashboardData">
          Tentar novamente
        </UButton>
      </div>

      <!-- Dashboard Content -->
      <div
        v-else
        class="space-y-6 flex flex-col gap-6"
        data-testid="dashboard-content"
      >
        <!-- Banner de Pedidos Pendentes -->
        <NuxtLink
          :to="`/${bloodbankSlug}/coletas`"
          v-if="(dashboardData?.pendingRequestsCount || 0) > 0"
        >
          <UAlert
            v-if="(dashboardData?.pendingRequestsCount || 0) > 0"
            color="warning"
            icon="i-lucide-bell"
            title="Solicitações de Coleta Pendentes"
            :description="'Há solicitações de coleta aguardando aprovação.'"
          >
          </UAlert>
        </NuxtLink>

        <!-- Card de Agenda dos Próximos 7 Dias -->
        <UCard class="mb-0">
          <template #header>
            <h2 class="text-lg font-semibold">Agenda dos Próximos 7 Dias</h2>
          </template>

          <!-- Empty State -->
          <div
            v-if="!dashboardData?.upcomingCollections?.length"
            class="text-center py-12"
          >
            <UIcon
              name="i-lucide-calendar"
              class="w-16 h-16 text-gray-400 mx-auto mb-4"
            />
            <h3 class="text-lg font-medium text-gray-900 mb-2">
              Nenhuma coleta agendada
            </h3>
            <p class="text-gray-600">
              Não há coletas agendadas para os próximos 7 dias.
            </p>
          </div>

          <!-- Lista de Coletas Agendadas - Agenda Style -->
          <div v-else class="space-y-4">
            <div
              v-for="collection in dashboardData.upcomingCollections"
              :key="collection._id"
              class="flex flex-col sm:flex-row sm:items-center p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow duration-200 cursor-pointer"
              @click="navigateToCollection(collection._id)"
            >
              <!-- Mobile Layout -->
              <div class="flex sm:hidden items-center justify-between mb-3">
                <div class="flex items-center space-x-3">
                  <UAvatar
                    v-if="collection.institutionLogo"
                    :src="collection.institutionLogo"
                    :alt="collection.institutionName"
                    size="sm"
                  />
                  <UAvatar
                    v-else
                    :alt="collection.institutionName"
                    size="sm"
                    class="bg-blue-500"
                  >
                    {{ collection.institutionName.charAt(0) }}
                  </UAvatar>
                  <div>
                    <h3 class="text-sm font-semibold text-gray-900">
                      {{ collection.institutionName }}
                    </h3>
                    <p class="text-xs text-gray-500">
                      {{ collection.institutionAddress }}
                    </p>
                  </div>
                </div>
                <UIcon
                  name="i-lucide-chevron-right"
                  class="w-4 h-4 text-gray-400"
                />
              </div>

              <!-- Mobile Date/Time Row -->
              <div class="flex sm:hidden items-center justify-between mb-3">
                <div class="flex items-center space-x-4">
                  <div class="text-center">
                    <div class="text-2xl font-bold text-gray-900">
                      {{ formatDay(collection.date) }}
                    </div>
                    <div class="text-sm text-gray-500">
                      {{ formatMonth(collection.date) }}
                    </div>
                  </div>
                  <div class="text-sm">
                    <div class="font-medium text-gray-900">
                      {{ formatTime(collection.startTime) }}
                    </div>
                    <div class="text-xs text-gray-500">
                      {{ formatTime(collection.endTime) }}
                    </div>
                  </div>
                </div>
                <div
                  class="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium"
                  :style="{
                    backgroundColor: collection.teamColor + '20',
                    color: collection.teamColor,
                    border: `1px solid ${collection.teamColor}40`,
                  }"
                >
                  {{ collection.teamName }}
                </div>
              </div>

              <!-- Desktop Layout -->
              <!-- Date Column -->
              <div
                class="hidden sm:flex flex-shrink-0 w-20 text-center flex-col"
              >
                <div class="text-2xl font-bold text-gray-900">
                  {{ formatDay(collection.date) }}
                </div>
                <div class="text-sm text-gray-500">
                  {{ formatMonth(collection.date) }}
                </div>
              </div>

              <!-- Time Column -->
              <div class="hidden sm:flex flex-shrink-0 w-24 ml-4 flex-col">
                <div class="text-sm font-medium text-gray-900">
                  {{ formatTime(collection.startTime) }}
                </div>
                <div class="text-xs text-gray-500">
                  {{ formatTime(collection.endTime) }}
                </div>
              </div>

              <!-- Institution Info -->
              <div class="hidden sm:flex flex-1 ml-6">
                <div class="flex items-center space-x-3">
                  <UAvatar
                    v-if="collection.institutionLogo"
                    :src="collection.institutionLogo"
                    :alt="collection.institutionName"
                    size="sm"
                  />
                  <UAvatar
                    v-else
                    :alt="collection.institutionName"
                    size="sm"
                    class="bg-blue-500"
                  >
                    {{ collection.institutionName.charAt(0) }}
                  </UAvatar>
                  <div>
                    <h3 class="text-sm font-semibold text-gray-900">
                      {{ collection.institutionName }}
                    </h3>
                    <p class="text-xs text-gray-500">
                      {{ collection.institutionAddress }}
                    </p>
                  </div>
                </div>
              </div>

              <!-- Team Badge -->
              <div class="hidden sm:flex flex-shrink-0 ml-4">
                <div
                  class="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium"
                  :style="{
                    backgroundColor: collection.teamColor + '20',
                    color: collection.teamColor,
                    border: `1px solid ${collection.teamColor}40`,
                  }"
                >
                  {{ collection.teamName }}
                </div>
              </div>

              <!-- Action Icon -->
              <div class="hidden sm:flex flex-shrink-0 ml-4">
                <UIcon
                  name="i-lucide-chevron-right"
                  class="w-4 h-4 text-gray-400"
                />
              </div>
            </div>
          </div>
        </UCard>

        <UCard v-if="dashboardData?.nextCollection">
          <template #header>
            <h3 class="text-lg font-semibold">Próxima Coleta</h3>
          </template>

          <!-- Informações da Coleta -->
          <div class="space-y-4 mb-6">
            <div class="flex items-center space-x-4">
              <UAvatar
                v-if="dashboardData.nextCollection.institutionLogo"
                :src="dashboardData.nextCollection.institutionLogo"
                :alt="dashboardData.nextCollection.institutionName"
                size="lg"
              />
              <UAvatar
                v-else
                :alt="dashboardData.nextCollection.institutionName"
                size="lg"
                class="bg-blue-500"
              >
                {{ dashboardData.nextCollection.institutionName.charAt(0) }}
              </UAvatar>
              <div>
                <h4 class="font-semibold text-lg">
                  {{ dashboardData.nextCollection.institutionName }}
                </h4>
                <p class="text-sm text-gray-600">
                  {{ dashboardData.nextCollection.institutionAddress }}
                </p>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="text-sm font-medium text-gray-500">Data</label>
                <p class="text-sm">
                  {{ formatDate(dashboardData.nextCollection.date) }}
                </p>
              </div>
              <div>
                <label class="text-sm font-medium text-gray-500">Horário</label>
                <p class="text-sm">
                  {{
                    formatTimeRange(
                      dashboardData.nextCollection.startTime,
                      dashboardData.nextCollection.endTime
                    )
                  }}
                </p>
              </div>
            </div>

            <div>
              <div
                class="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium"
                :style="{
                  backgroundColor:
                    dashboardData.nextCollection.teamColor + '20',
                  color: dashboardData.nextCollection.teamColor,
                  border: `1px solid ${dashboardData.nextCollection.teamColor}40`,
                }"
              >
                {{ dashboardData.nextCollection.teamName }}
              </div>
            </div>
          </div>

          <!-- Mapa com Localização -->
          <div
            v-if="dashboardData.nextCollection.institutionLocation"
            class="h-96 rounded-lg overflow-hidden"
          >
            <MglMap
              :map-style="mapStyle"
              :center="[
                dashboardData.nextCollection.institutionLocation.coordinates[0],
                dashboardData.nextCollection.institutionLocation.coordinates[1],
              ]"
              :zoom="10"
              ref="mapRef"
              @map:load="initializeMap"
            >
              <MglNavigationControl />

              <!-- Institution Marker -->
              <MglMarker
                :coordinates="[
                  dashboardData.nextCollection.institutionLocation
                    .coordinates[0],
                  dashboardData.nextCollection.institutionLocation
                    .coordinates[1],
                ]"
                :color="'#3B82F6'"
              >
                <!-- MglPopup and marker visuals for institution -->
                <template
                  v-if="dashboardData.nextCollection.institutionLogo"
                  v-slot:marker
                >
                  <NuxtImg
                    :src="dashboardData.nextCollection.institutionLogo"
                    :alt="`Logo da instituição ${dashboardData.nextCollection.institutionName}`"
                    class="w-8 h-8 rounded-full object-cover border-2"
                    style="border-color: #3b82f6"
                  />
                </template>
                <MglPopup
                  v-if="!dashboardData.nextCollection.institutionLogo"
                  ref="institutionPopup"
                  :close-button="false"
                  :offset="[0, -40]"
                >
                  <div class="flex items-center space-x-3">
                    <div class="shrink-0">
                      <NuxtImg
                        v-if="dashboardData.nextCollection.institutionLogo"
                        :src="dashboardData.nextCollection.institutionLogo"
                        :alt="`Logo da instituição ${dashboardData.nextCollection.institutionName}`"
                        class="w-8 h-8 rounded-full object-cover"
                      />
                      <div
                        v-else
                        class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center"
                      >
                        <svg
                          class="w-5 h-5 text-blue-600"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"
                          />
                        </svg>
                      </div>
                    </div>
                    <div>
                      <h3 class="text-lg font-semibold text-gray-800">
                        {{ dashboardData.nextCollection.institutionName }}
                      </h3>
                      <p class="text-sm text-gray-600">
                        {{ dashboardData.nextCollection.institutionAddress }}
                      </p>
                    </div>
                  </div>
                </MglPopup>
              </MglMarker>

              <!-- Blood Bank Marker -->
              <MglMarker
                v-if="bloodbankData?.location"
                :coordinates="[
                  bloodbankData.location.coordinates[0],
                  bloodbankData.location.coordinates[1],
                ]"
                :color="'#bb0a08'"
              >
                <!-- MglPopup for bloodbank info -->
                <template v-if="bloodbankData.logo" v-slot:marker>
                  <NuxtImg
                    :src="bloodbankData.logo"
                    :alt="`Logo do ${bloodbankData.name}`"
                    class="w-8 h-8 rounded-full object-cover border-2"
                    style="border-color: #bb0a08"
                  />
                </template>
                <MglPopup
                  v-if="!bloodbankData.logo"
                  ref="bloodbankPopup"
                  :close-button="false"
                  :offset="[0, -40]"
                >
                  <div class="flex items-center space-x-3">
                    <div class="shrink-0">
                      <NuxtImg
                        v-if="bloodbankData.logo"
                        :src="bloodbankData.logo"
                        :alt="`Logo do ${bloodbankData.name}`"
                        class="w-8 h-8 rounded-full object-cover"
                      />
                      <div
                        v-else
                        class="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center"
                      >
                        <svg
                          class="w-5 h-5 text-red-600"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"
                          />
                        </svg>
                      </div>
                    </div>
                    <h3 class="text-lg font-semibold text-grey-800">
                      {{ bloodbankData.name }}
                    </h3>
                  </div>
                </MglPopup>
              </MglMarker>
            </MglMap>
          </div>

          <div
            v-else
            class="h-64 w-full rounded-lg bg-gray-100 flex items-center justify-center"
          >
            <div class="text-center">
              <UIcon
                name="i-lucide-map-pin"
                class="w-8 h-8 text-gray-400 mx-auto mb-2"
              />
              <p class="text-sm text-gray-500">Localização não disponível</p>
            </div>
          </div>
        </UCard>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { useUserStore } from "~/stores/user";
import { useBloodbankStore } from "~/stores/bloodbank";
import type { DashboardData } from "~/stores/bloodbank";

const userStore = useUserStore();
const bloodbankStore = useBloodbankStore();
const route = useRoute();

const bloodbankSlug = route.params.bloodbankSlug as string;

// Get blood bank info from user's roles
const bloodBankRole = computed(() => {
  return userStore.user?.bloodBankRoles?.find(
    (role) => role.slug === bloodbankSlug
  );
});

const bloodBankName = computed(() => {
  return bloodBankRole.value?.slug || "Hemocentro";
});

const bloodBanksLocationId = computed(
  () => bloodBankRole.value?.bloodBanksLocationId
);

// Store state
const { dashboardData, isLoadingDashboard, bloodbankData } =
  storeToRefs(bloodbankStore);

const isLoadingBloodbank = computed(() => bloodbankStore.isLoading);
const isLoading = computed(
  () => isLoadingDashboard.value || isLoadingBloodbank.value
);
const hasError = ref(false);

// Modal state
const showLocationModal = ref(false);

// Map configuration
const mapRef = ref<any>(null);
const mapStyle = "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";

// Methods
const loadDashboardData = async () => {
  if (!bloodBanksLocationId.value) return;

  hasError.value = false;

  try {
    // Load both dashboard data and bloodbank data in parallel
    await Promise.all([
      bloodbankStore.loadDashboardData(bloodBanksLocationId.value),
      bloodbankStore.loadBloodbankData(bloodBanksLocationId.value, false),
    ]);

    // Show location modal if there's a next collection with valid data
    if (
      dashboardData.value?.nextCollection &&
      dashboardData.value.nextCollection.institutionLocation
    ) {
      showLocationModal.value = true;
    }
  } catch (error) {
    console.error("Error loading dashboard data:", error);
    hasError.value = true;
  }
};

const navigateToCollection = (collectionId: string) => {
  navigateTo(`/${bloodbankSlug}/coletas/${collectionId}`);
};

const formatDate = (date: string | Date) => {
  const d = new Date(date);
  return d.toLocaleDateString("pt-BR");
};

const formatDay = (date: string | Date) => {
  const d = new Date(date);
  if (isNaN(d.getTime())) return "--";
  return d.getDate().toString().padStart(2, "0");
};

const formatMonth = (date: string | Date) => {
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { month: "short" });
};

const formatTime = (time: Date | string | undefined) => {
  if (!time) return "N/A";
  const d = new Date(time);
  if (isNaN(d.getTime())) return "N/A";
  return d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatTimeRange = (
  startTime: Date | string | undefined,
  endTime: Date | string | undefined
) => {
  if (!startTime || !endTime) return "N/A";

  const start = new Date(startTime).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const end = new Date(endTime).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${start} - ${end}`;
};

const getTeamBadgeColor = (teamColor: string) => {
  // Map team colors to Nuxt UI badge colors
  const colorMap: Record<string, string> = {
    "#ef4444": "red",
    "#f97316": "orange",
    "#eab308": "yellow",
    "#22c55e": "green",
    "#06b6d4": "cyan",
    "#3b82f6": "blue",
    "#8b5cf6": "violet",
    "#ec4899": "pink",
  };

  return colorMap[teamColor] || "blue";
};

const initializeMap = () => {
  // Map will be initialized by MglMap component
  console.log("Map initialized");
};

// Lifecycle
onMounted(() => {
  loadDashboardData();
});

// Set page meta
definePageMeta({
  layout: "default",
  keepalive: false,
});
</script>
