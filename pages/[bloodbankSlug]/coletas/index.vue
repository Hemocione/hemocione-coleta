<template>
  <div class="flex flex-col gap-6">
    <!-- Main Content Card -->
    <UCard
      class="transition-all duration-500 ease-in-out"
      v-auto-animate
      :ui="{
        header: 'px-2! pt-2! pb-1! m-0!',
        body: 'p-0! m-0!',
      }"
    >
      <!-- Header with Tabs -->
      <template #header>
        <UTabs v-model="selectedFilter" :items="filterTabs" class="w-full" />
      </template>

      <!-- Content -->
      <div class="p-6">
        <Transition name="fade" mode="out-in">
          <div
            v-if="isLoading"
            class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            <UCard
              v-for="n in 6"
              :key="`skeleton-${n}`"
              class="hover:shadow-lg transition-shadow duration-200 animate-pulse"
            >
              <!-- Card Header with Skeletons -->
              <template #header>
                <div
                  class="relative h-32 -m-6 mb-3 rounded-t-lg overflow-hidden"
                >
                  <USkeleton class="w-full h-full" />
                  <div class="absolute bottom-4 left-4">
                    <USkeleton
                      class="rounded-full w-12 h-12 ring-2 ring-white"
                    />
                  </div>
                </div>
                <div class="flex flex-col items-start mt-1">
                  <USkeleton class="h-5 w-2/3 mb-1 rounded" />
                </div>
              </template>
              <div class="space-y-4">
                <!-- Status & Date Row Skeleton -->
                <div class="flex items-center justify-between">
                  <USkeleton class="h-5 w-20 rounded" />
                  <USkeleton class="h-4 w-12 rounded" />
                </div>
                <!-- Requested Dates Skeleton -->
                <div>
                  <USkeleton class="h-4 w-24 mb-2 rounded" />
                  <div class="space-y-1">
                    <USkeleton
                      v-for="i in 2"
                      :key="i"
                      class="h-4 w-full rounded"
                    />
                  </div>
                </div>
                <!-- Actions Skeleton -->
                <div class="flex items-center justify-between pt-4 border-t">
                  <USkeleton class="h-8 w-24 rounded" />
                </div>
              </div>
            </UCard>
          </div>
          <!-- Empty State -->
          <div
            v-else-if="collectionRequests.data.length === 0"
            class="text-center py-12"
          >
            <UIcon
              name="i-lucide-inbox"
              class="w-16 h-16 text-gray-400 mx-auto mb-4"
            />
            <h3 class="text-lg font-medium text-gray-900 mb-2">
              Nenhuma solicitação encontrada
            </h3>
            <p class="text-gray-600">
              Não há solicitações de coleta para exibir no momento.
            </p>
          </div>

          <!-- Collection Requests Grid -->
          <div
            v-else
            class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            <UCard
              v-for="request in collectionRequests.data"
              :key="request._id"
              class="hover:shadow-lg transition-shadow duration-200"
              data-testid="collection-request-card"
            >
              <!-- Card Header with Banner -->
              <template #header>
                <div
                  class="relative h-32 -m-6 mb-3 rounded-t-lg overflow-hidden"
                >
                  <NuxtImg
                    v-if="request.institutionBanner"
                    :src="request.institutionBanner"
                    :alt="`Banner de ${request.institutionName}`"
                    class="w-full h-full object-cover"
                  />
                  <div
                    v-else
                    class="w-full h-full object-cover bg-linear-to-br from-red-900 to-red-500"
                    style="
                      background: linear-gradient(
                        135deg,
                        #7f1d1d 0%,
                        #ef4444 100%
                      );
                    "
                    aria-label="Banner de placeholder"
                  />
                  <!-- Institution Logo Overlay -->
                  <div class="absolute bottom-4 left-4">
                    <UAvatar
                      v-if="request.institutionLogo"
                      :src="request.institutionLogo"
                      :alt="request.institutionName"
                      size="lg"
                      class="ring-2 ring-white"
                    />
                    <UAvatar
                      v-else
                      :alt="request.institutionName"
                      size="lg"
                      class="ring-2 ring-white bg-blue-500"
                    >
                      {{ request.institutionName.charAt(0) }}
                    </UAvatar>
                  </div>
                </div>
                <!-- Institution Name always shown below the banner -->
                <div class="flex flex-col items-start">
                  <span
                    class="text-base font-semibold text-gray-900 truncate"
                    data-testid="institution-name"
                  >
                    {{ request.institutionName }}
                  </span>
                </div>
              </template>

              <!-- Card Body -->
              <div class="space-y-4">
                <!-- Status Badge -->
                <div class="flex items-center justify-between">
                  <UBadge
                    :color="getStatusColor(request.status)"
                    variant="subtle"
                    size="sm"
                    data-testid="status-badge"
                  >
                    {{ getStatusLabel(request.status) }}
                  </UBadge>
                  <span class="text-xs text-gray-500">
                    {{ formatDate(request.createdAt) }}
                  </span>
                </div>

                <!-- Available Dates -->
                <div>
                  <h4 class="text-sm font-medium text-gray-900 mb-2">
                    Opções de Data
                  </h4>
                  <div class="space-y-1">
                    <div
                      v-for="(date, index) in getUniqueDates(
                        request.availableSlotOptions
                      )"
                      :key="index"
                      class="text-sm"
                    >
                      <span class="text-gray-600">{{
                        formatStringDate(date)
                      }}</span>
                    </div>
                  </div>
                </div>

                <!-- Actions -->
                <div class="flex items-center justify-between pt-4 border-t">
                  <NuxtLink
                    :to="`/${route.params.bloodbankSlug}/coletas/${request._id}`"
                  >
                    <UButton variant="ghost" size="sm" icon="i-lucide-eye">
                      Ver Detalhes
                    </UButton>
                  </NuxtLink>
                </div>
              </div>
            </UCard>
          </div>
        </Transition>
      </div>
    </UCard>

    <!-- Pagination -->
    <div
      v-if="collectionRequests.pagination.pages > 1"
      class="flex justify-center"
      data-testid="pagination"
    >
      <UPagination
        v-model="currentPage"
        :page-count="collectionRequests.pagination.pages"
        :total="collectionRequests.pagination.total"
        :per-page="collectionRequests.pagination.limit"
        @update:model-value="loadRequests"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useUserStore } from "~/stores/user";
import { useBloodbankStore } from "~/stores/bloodbank";

// Define page meta
definePageMeta({
  layout: "default",
});

// Get route params
const route = useRoute();

// Initialize stores
const userStore = useUserStore();
const bloodbankStore = useBloodbankStore();
const { collectionRequests, isLoadingCollectionRequests } =
  storeToRefs(bloodbankStore);

// State
const selectedFilter = ref("pending");
const currentPage = ref(1);

// Computed
const currentBloodBankRole = computed(() => userStore.currentBloodBankRole);
const bloodBanksLocationId = computed(
  () => currentBloodBankRole.value?.bloodBanksLocationId
);

const isLoading = computed(() => isLoadingCollectionRequests.value);

const filterTabs = [
  { value: "pending", label: "Pendentes" },
  { value: "accepted", label: "Aceitas" },
  { value: "rejected", label: "Rejeitadas" },
];

// Methods
const loadRequests = async () => {
  if (!bloodBanksLocationId.value) return;

  const filters: any = {
    status: selectedFilter.value,
  };

  try {
    await bloodbankStore.loadCollectionRequests(
      bloodBanksLocationId.value,
      filters,
      currentPage.value
    );
  } catch (error) {
    console.error("Error loading collection requests:", error);
    useToast().add({
      title: "Erro ao carregar solicitações",
      description: "Tente novamente mais tarde.",
      color: "error",
    });
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "pending":
      return "warning";
    case "accepted":
      return "success";
    case "rejected":
      return "neutral";
    case "cancelled":
      return "neutral";
    default:
      return "neutral";
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
    default:
      return status;
  }
};

const formatStringDate = (date: string) => {
  // Espera o formato "YYYY-MM-DD" e retorna "DD/MM/YYYY"
  if (!date) return "";
  const [year, month, day] = date.split("-");
  if (!year || !month || !day) return date;
  return `${day}/${month}/${year}`;
};

const formatDate = (date: string | Date) => {
  const d = new Date(date);
  return d.toLocaleDateString("pt-BR");
};

const formatTimeRange = (startTime: Date | string, endTime: Date | string) => {
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

const viewRequestDetails = (requestId: string) => {
  navigateTo(`/hemorio/coletas/${requestId}`);
};

// Helper functions for date display
const getUniqueDates = (availableSlotOptions: any[]) => {
  const dates = availableSlotOptions.map((slot) => slot.date);
  return [...new Set(dates)].sort();
};

// Watchers
watch(selectedFilter, () => {
  currentPage.value = 1;
  loadRequests();
});

watch(currentPage, loadRequests);

// Lifecycle
onMounted(() => {
  loadRequests();
});
</script>
