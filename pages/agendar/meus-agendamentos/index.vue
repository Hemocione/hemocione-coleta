<template>
  <div class="space-y-4 md:space-y-6">
    <div
      v-if="!selectedInstitution"
      class="text-center py-12 text-gray-600"
    >
      <UIcon
        name="i-lucide-building"
        class="w-10 h-10 mx-auto mb-3 text-gray-400"
      />
      <p>Selecione ou registre uma instituição para ver seus agendamentos.</p>
    </div>

    <template v-else>
      <h3 class="text-base font-semibold">Meus Agendamentos</h3>

      <Transition name="fade" mode="out-in">
        <div v-if="isLoading" class="space-y-3" key="loading">
          <USkeleton v-for="n in 3" :key="n" class="h-28" />
        </div>

        <div
          v-else-if="!requests.length"
          class="text-center py-12 text-gray-600"
          key="empty"
        >
          <UIcon
            name="i-lucide-inbox"
            class="w-10 h-10 mx-auto mb-3 text-gray-400"
          />
          <p>Nenhuma solicitação de coleta encontrada.</p>
        </div>

        <div v-else class="space-y-3" v-auto-animate key="list">
          <UCard
            v-for="request in requests"
            :key="request._id"
            data-testid="collection-request-card"
          >
            <div class="flex items-start justify-between gap-4">
              <div class="flex items-center gap-3 min-w-0">
                <UAvatar :src="request.bloodBankLogo || undefined" size="md">
                  {{ (request.bloodBankName || "B").charAt(0) }}
                </UAvatar>
                <div class="min-w-0">
                  <div class="font-medium truncate">
                    {{ request.bloodBankName }}
                  </div>
                  <div class="text-xs text-gray-500">
                    Criada em {{ formatDate(request.createdAt) }}
                  </div>
                </div>
              </div>
              <UBadge
                :color="phaseOf(request.status).isTerminalNegative ? 'error' : 'neutral'"
                variant="subtle"
                data-testid="status-badge"
              >
                {{ phaseOf(request.status).statusLabel }}
              </UBadge>
            </div>

            <!-- Bolinha de progresso com as fases -->
            <div
              v-if="!phaseOf(request.status).isTerminalNegative"
              class="mt-4"
              data-testid="phase-progress"
            >
              <div
                class="flex items-center"
                :aria-label="`Fase atual: ${phaseOf(request.status).label}`"
              >
                <template v-for="i in phaseOf(request.status).totalSteps" :key="i">
                  <div
                    class="w-2.5 h-2.5 rounded-full shrink-0"
                    :class="
                      i - 1 <= phaseOf(request.status).stepIndex
                        ? 'bg-red-500'
                        : 'bg-gray-200'
                    "
                  />
                  <div
                    v-if="i < phaseOf(request.status).totalSteps"
                    class="flex-1 h-0.5"
                    :class="
                      i <= phaseOf(request.status).stepIndex
                        ? 'bg-red-500'
                        : 'bg-gray-200'
                    "
                  />
                </template>
              </div>
              <div class="text-xs text-gray-500 mt-1">
                {{ phaseOf(request.status).label }}
              </div>
            </div>

            <div class="flex justify-end mt-3">
              <NuxtLink
                v-if="request.accessToken"
                :to="`/agendar/acompanhar/${request.accessToken}`"
              >
                <UButton variant="ghost" size="sm" icon="i-lucide-eye">
                  Ver Detalhes
                </UButton>
              </NuxtLink>
            </div>
          </UCard>
        </div>
      </Transition>

      <div
        v-if="pagination.pages > 1"
        class="flex justify-center"
        data-testid="pagination"
      >
        <UPagination
          v-model="currentPage"
          :page-count="pagination.pages"
          :total="pagination.total"
          :per-page="pagination.limit"
          @update:model-value="loadRequests"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: "agendamento" });
import { useSchedulingStore } from "~/stores/scheduling";
import { useFetchWithAuth } from "~/composables/useFetchWithAuth";
import { getCollectionRequestPhase } from "~/utils/collectionRequestPhase";

interface InstitutionCollectionRequestListItem {
  _id: string;
  status: string;
  bloodBankName?: string;
  bloodBankLogo?: string | null;
  accessToken?: string;
  createdAt: string;
}

interface CollectionRequestsResponse {
  success: boolean;
  data: InstitutionCollectionRequestListItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

const scheduling = useSchedulingStore();
const { selectedInstitution } = storeToRefs(scheduling);

const requests = ref<InstitutionCollectionRequestListItem[]>([]);
const pagination = ref({ total: 0, page: 1, limit: 10, pages: 0 });
const currentPage = ref(1);
const isLoading = ref(false);

const phaseOf = (status: string) => getCollectionRequestPhase(status);

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("pt-BR");
}

async function loadRequests() {
  if (!selectedInstitution.value?.id) return;
  isLoading.value = true;
  try {
    const { data } = await useFetchWithAuth<CollectionRequestsResponse>(
      `/api/v1/institutions/${selectedInstitution.value.id}/collection-requests`,
      {
        query: { page: currentPage.value, limit: pagination.value.limit },
      }
    );
    if (data.value) {
      requests.value = data.value.data;
      pagination.value = data.value.pagination;
    }
  } catch {
    useToast().add({
      title: "Erro ao carregar agendamentos",
      color: "error",
    });
  } finally {
    isLoading.value = false;
  }
}

watch(
  () => selectedInstitution.value?.id,
  () => {
    currentPage.value = 1;
    loadRequests();
  }
);

onMounted(() => {
  loadRequests();
});

useHead({
  title: "Meus Agendamentos",
});
</script>
