<template>
  <div class="flex flex-col gap-6">
    <!-- Loading State -->
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
          <template #header>
            <div class="flex items-center gap-3">
              <USkeleton class="w-12 h-12 rounded-full" />
              <div class="flex-1">
                <USkeleton class="h-5 w-3/4 mb-2 rounded" />
                <USkeleton class="h-4 w-1/2 rounded" />
              </div>
            </div>
          </template>
          <div class="space-y-4">
            <USkeleton class="h-4 w-full rounded" />
            <USkeleton class="h-4 w-2/3 rounded" />
          </div>
        </UCard>
      </div>

      <!-- Empty State -->
      <div
        v-else-if="technicalVisits.length === 0"
        class="text-center py-12"
      >
        <UIcon
          name="i-lucide-clipboard-list"
          class="w-16 h-16 text-gray-400 mx-auto mb-4"
        />
        <h3 class="text-lg font-medium text-gray-900 mb-2">
          Nenhuma visita técnica encontrada
        </h3>
        <p class="text-gray-600">
          Não há visitas técnicas registradas no momento.
        </p>
      </div>

      <!-- Technical Visits Grid -->
      <div
        v-else
        class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        v-auto-animate
      >
        <UCard
          v-for="visit in technicalVisits"
          :key="visit._id"
          class="hover:shadow-lg transition-shadow duration-200"
        >
          <!-- Card Header with Institution Info -->
          <template #header>
            <div class="flex items-center gap-3">
              <UAvatar
                v-if="visit.institutionLogo"
                :src="visit.institutionLogo"
                :alt="visit.institutionName"
                size="lg"
              />
              <UAvatar
                v-else
                :alt="visit.institutionName"
                size="lg"
                class="bg-blue-500"
              >
                {{ visit.institutionName.charAt(0) }}
              </UAvatar>
              <div class="flex-1 min-w-0">
                <h3
                  class="text-base font-semibold text-gray-900 truncate"
                  :title="visit.institutionName"
                >
                  {{ visit.institutionName }}
                </h3>
                <p class="text-sm text-gray-500">
                  {{ formatDate(visit.date) }}
                </p>
              </div>
            </div>
          </template>

          <!-- Card Body -->
          <div class="space-y-4">
            <!-- Status Badge -->
            <div class="flex items-center justify-between">
              <UBadge
                :color="getStatusColor(visit.status)"
                variant="subtle"
                size="sm"
              >
                {{ getStatusLabel(visit.status) }}
              </UBadge>
              <span class="text-xs text-gray-500">
                Criado em {{ formatDate(visit.createdAt) }}
              </span>
            </div>
          </div>
        </UCard>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useUserStore } from "~/stores/user";
import { fetchWithAuth } from "~/composables/useFetchWithAuth";

// Define page meta
definePageMeta({
  layout: "default",
});

// Get route params
const route = useRoute();

// Initialize stores
const userStore = useUserStore();

// State
const isLoading = ref(false);
const technicalVisits = ref<
  Array<{
    _id: string;
    institutionId: string;
    institutionName: string;
    institutionLogo?: string;
    institutionBanner?: string;
    date: Date | string;
    status: "pending" | "approved" | "rejected";
    createdAt: Date | string;
    updatedAt: Date | string;
  }>
>([]);

// Computed
const currentBloodBankRole = computed(() => userStore.currentBloodBankRole);
const bloodBanksLocationId = computed(
  () => currentBloodBankRole.value?.bloodBanksLocationId
);

// Methods
const loadTechnicalVisits = async () => {
  if (!bloodBanksLocationId.value) return;

  isLoading.value = true;
  try {
    const response = await fetchWithAuth<{
      success: boolean;
      data: typeof technicalVisits.value;
    }>(
      `/api/v1/bloodbank/${bloodBanksLocationId.value}/technical-visits`,
      {
        method: "GET",
      }
    );

    if (response.success) {
      technicalVisits.value = response.data;
    }
  } catch (error: any) {
    console.error("Error loading technical visits:", error);
    useToast().add({
      title: "Erro ao carregar visitas técnicas",
      description: "Tente novamente mais tarde.",
      color: "error",
    });
  } finally {
    isLoading.value = false;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "pending":
      return "warning";
    case "approved":
      return "success";
    case "rejected":
      return "error";
    default:
      return "neutral";
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case "pending":
      return "Pendente";
    case "approved":
      return "Aprovada";
    case "rejected":
      return "Rejeitada";
    default:
      return status;
  }
};

const formatDate = (date: string | Date) => {
  const d = new Date(date);
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

// Lifecycle
onMounted(() => {
  loadTechnicalVisits();
});
</script>
