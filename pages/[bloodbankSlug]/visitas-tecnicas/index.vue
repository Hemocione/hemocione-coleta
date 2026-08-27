<template>
  <div class="flex flex-col gap-6">
    <!-- Main Content Card -->
    <UCard
      v-auto-animate
      :ui="{
        header: 'px-2! pt-2! pb-1! m-0!',
        body: 'p-0! m-0!',
      }"
    >
      <!-- Header with Tabs -->
      <template #header>
        <div class="flex items-center justify-between px-4 pt-2">
          <UTabs v-model="selectedFilter" :items="filterTabs" class="flex-1" />
          <UButton
            icon="i-lucide-plus"
            color="primary"
            size="sm"
            @click="openCreateModal"
            class="cursor-pointer ml-4"
          >
            Registrar Visita
          </UButton>
        </div>
      </template>

      <!-- Content -->
      <div class="p-6">
        <Transition name="fade" mode="out-in">
          <!-- Loading State -->
          <div
            v-if="isLoading"
            class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            <UCard
              v-for="n in 6"
              :key="`skeleton-${n}`"
              class="animate-pulse"
            >
              <div class="space-y-3">
                <USkeleton class="h-5 w-3/4 rounded" />
                <USkeleton class="h-4 w-1/2 rounded" />
                <USkeleton class="h-4 w-full rounded" />
                <div class="flex gap-2">
                  <USkeleton class="h-6 w-20 rounded" />
                  <USkeleton class="h-6 w-16 rounded" />
                </div>
              </div>
            </UCard>
          </div>

          <!-- Empty State -->
          <div
            v-else-if="visits.length === 0"
            class="text-center py-12"
          >
            <UIcon
              name="i-lucide-clipboard-check"
              class="w-16 h-16 text-gray-400 mx-auto mb-4"
            />
            <h3 class="text-lg font-medium text-gray-900 mb-2">
              Nenhuma visita tecnica encontrada
            </h3>
            <p class="text-gray-600 mb-4">
              Registre visitas tecnicas para manter o historico de avaliacoes dos locais.
            </p>
            <UButton
              icon="i-lucide-plus"
              color="primary"
              @click="openCreateModal"
              class="cursor-pointer"
            >
              Registrar Primeira Visita
            </UButton>
          </div>

          <!-- Visits Grid -->
          <div
            v-else
            class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            <UCard
              v-for="visit in visits"
              :key="visit._id"
              class="hover:shadow-lg transition-shadow duration-200 cursor-pointer"
              @click="openEditModal(visit)"
            >
              <div class="space-y-3">
                <!-- Address -->
                <div>
                  <h4
                    class="font-semibold text-gray-900 truncate"
                    data-testid="technical-visit-institution"
                  >
                    {{ visit.institutionName || "Instituição não vinculada" }}
                  </h4>
                  <p class="text-sm text-gray-600 truncate">
                    {{ visit.address }}
                  </p>
                  <p
                    v-if="visit.institutionAddress"
                    class="text-xs text-gray-500 truncate"
                  >
                    Endereço da instituição: {{ visit.institutionAddress }}
                  </p>
                  <p class="text-sm text-gray-500">
                    {{ formatDate(visit.visitDate) }}
                  </p>
                </div>

                <!-- Vínculos persistidos da solicitação -->
                <div
                  v-if="visit.collectionRequest"
                  class="flex flex-wrap items-center gap-2 text-sm"
                  data-testid="technical-visit-links"
                >
                  <NuxtLink
                    :to="`/${route.params.bloodbankSlug}/coletas/${visit.collectionRequest._id}`"
                    class="text-primary-600 hover:underline"
                    data-testid="technical-visit-request-link"
                    @click.stop
                  >
                    Solicitação {{ visit.collectionRequest._id.slice(-6) }}
                  </NuxtLink>
                  <a
                    v-if="visit.collectionRequest.eventSlug"
                    :href="`https://eventos.hemocione.com.br/event/${visit.collectionRequest.eventSlug}`"
                    target="_blank"
                    rel="noopener"
                    class="text-primary-600 hover:underline"
                    data-testid="technical-visit-event-link"
                    @click.stop
                  >
                    Evento
                  </a>
                </div>

                <!-- Outcome Badge -->
                <div class="flex items-center gap-2">
                  <UBadge
                    :color="getOutcomeColor(visit.outcome)"
                    variant="subtle"
                    size="sm"
                  >
                    {{ getOutcomeLabel(visit.outcome) }}
                  </UBadge>
                  <UButton
                    v-if="visit.outcome === 'approved'"
                    variant="soft"
                    color="primary"
                    size="xs"
                    icon="i-lucide-file-signature"
                    :loading="generatingTermForVisit === visit._id"
                    @click.stop="generateTermForVisit(visit)"
                    class="cursor-pointer"
                  >
                    Gerar Termo
                  </UButton>
                </div>

                <!-- Registrar visita realizada (solicitação vinculada em aberto) -->
                <UButton
                  v-if="getLinkedOpenRequest(visit)"
                  variant="soft"
                  color="success"
                  size="sm"
                  icon="i-lucide-clipboard-check"
                  block
                  @click.stop="openRegisterVisitModal(visit)"
                  class="cursor-pointer"
                >
                  Registrar visita realizada
                </UButton>

                <!-- Notes (truncated) -->
                <p
                  v-if="visit.notes"
                  class="text-sm text-gray-600 line-clamp-2"
                >
                  {{ visit.notes }}
                </p>
              </div>
            </UCard>
          </div>
        </Transition>
      </div>
    </UCard>

    <!-- Pagination -->
    <div
      v-if="pagination.totalPages > 1"
      class="flex justify-center"
    >
      <UPagination
        v-model="currentPage"
        :page-count="pagination.totalPages"
        :total="pagination.total"
        :per-page="pagination.limit"
        @update:model-value="loadVisits"
      />
    </div>

    <!-- Create/Edit Modal -->
    <UModal v-model:open="showFormModal">
      <template #content>
        <div class="p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">
            {{ editingVisit ? 'Editar Visita Tecnica' : 'Registrar Visita Tecnica' }}
          </h3>

          <div class="space-y-4">
            <!-- Address -->
            <UFormField v-if="!editingVisit" label="Solicitação vinculada">
              <USelect
                v-model="formData.requestId"
                :items="requestOptions"
                class="w-full"
                data-testid="technical-visit-request-select"
                @update:model-value="handleRequestSelection"
              />
              <p class="text-xs text-gray-500 mt-1">
                A instituição será carregada da solicitação escolhida.
              </p>
            </UFormField>

            <UFormField label="Instituição" required>
              <USelect
                v-model="formData.institutionId"
                :items="institutionSelectOptions"
                :disabled="Boolean(formData.requestId)"
                class="w-full"
                data-testid="technical-visit-institution-select"
              />
              <p class="text-xs text-gray-500 mt-1">
                Vincule a visita à instituição da coleta ou selecione uma instituição relacionada.
              </p>
            </UFormField>

            <UFormField label="Endereco" required>
              <UInput
                v-model="formData.address"
                placeholder="Endereco do local visitado"
                class="w-full"
                :maxlength="500"
              />
            </UFormField>

            <!-- Visit Date -->
            <UFormField label="Data da Visita" required>
              <UInput
                v-model="formData.visitDate"
                type="date"
                class="w-full"
              />
            </UFormField>

            <!-- Outcome -->
            <UFormField label="Resultado" required>
              <USelect
                v-model="formData.outcome"
                :items="outcomeOptions"
                class="w-full"
              />
            </UFormField>

            <!-- Notes -->
            <UFormField label="Observacoes">
              <UTextarea
                v-model="formData.notes"
                placeholder="Observacoes sobre a visita..."
                :rows="4"
                :maxlength="2000"
                class="w-full resize-y"
              />
              <p class="text-xs text-gray-500 mt-1">
                {{ (formData.notes || '').length }}/2000 caracteres
              </p>
            </UFormField>
          </div>

          <div class="flex justify-end space-x-3 mt-6">
            <UButton
              variant="ghost"
              @click="showFormModal = false"
              class="cursor-pointer"
            >
              Cancelar
            </UButton>
            <UButton
              v-if="editingVisit"
              color="error"
              variant="outline"
              @click="confirmDelete"
              :loading="isDeleting"
              class="cursor-pointer"
            >
              Excluir
            </UButton>
            <UButton
              color="primary"
              @click="submitForm"
              :loading="isSaving"
              :disabled="!isFormValid"
              class="cursor-pointer"
            >
              {{ editingVisit ? 'Salvar' : 'Registrar' }}
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
    <!-- Register Performed Visit Modal (request-scoped) -->
    <UModal v-model:open="showRegisterModal">
      <template #content>
        <div class="p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-1">
            Registrar visita realizada
          </h3>
          <p v-if="registerContext" class="text-sm text-gray-500 mb-4">
            Solicitação de {{ registerContext.institutionName }} será avançada
            para "Visita técnica confirmada".
          </p>

          <div class="space-y-4">
            <UFormField label="Data da Visita" required>
              <UInput
                v-model="registerFormData.visitDate"
                type="date"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Observacoes">
              <UTextarea
                v-model="registerFormData.note"
                placeholder="Observacoes sobre a visita realizada..."
                :rows="4"
                :maxlength="2000"
                class="w-full resize-y"
              />
            </UFormField>
          </div>

          <div class="flex justify-end space-x-3 mt-6">
            <UButton
              variant="ghost"
              @click="showRegisterModal = false"
              class="cursor-pointer"
            >
              Cancelar
            </UButton>
            <UButton
              color="primary"
              :disabled="!registerFormData.visitDate"
              :loading="isRegistering"
              @click="submitRegisterVisit"
              class="cursor-pointer"
            >
              Confirmar visita realizada
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { fetchWithAuth } from "~/composables/useFetchWithAuth";
import { useBloodbankStore } from "~/stores/bloodbank";
import { useUserStore } from "~/stores/user";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

definePageMeta({
  layout: "default",
});

const route = useRoute();
const userStore = useUserStore();
const bloodbankStore = useBloodbankStore();
const { bloodbankData } = storeToRefs(bloodbankStore);

const currentBloodBankRole = computed(() => userStore.currentBloodBankRole);
const bloodBanksLocationId = computed(
  () => currentBloodBankRole.value?.bloodBanksLocationId
);

interface TechnicalVisit {
  _id: string;
  bloodBanksLocationId: string;
  institutionId?: string | null;
  institutionName?: string;
  institutionAddress?: string;
  collectionRequest?: {
    _id: string;
    institutionId: string;
    status: string;
    eventSlug?: string;
  };
  address: string;
  visitDate: string;
  outcome: "approved" | "rejected" | "pending";
  notes?: string | null;
  visitedBy: string;
  createdAt: string;
  updatedAt: string;
}

interface OpenCollectionRequest {
  _id: string;
  institutionId: string;
  institutionName: string;
  institutionAddress?: string;
  address?: {
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    zipCode: string;
  };
  eventSlug?: string;
  status?: string;
  technicalVisitId?: string;
}

interface InstitutionOption {
  id: string;
  name: string;
  address?: string;
}

// State
const selectedFilter = ref("all");
const currentPage = ref(1);
const isLoading = ref(false);
const isSaving = ref(false);
const isDeleting = ref(false);
const visits = ref<TechnicalVisit[]>([]);
const pagination = ref({ total: 0, page: 1, limit: 20, totalPages: 0 });
const showFormModal = ref(false);
const editingVisit = ref<TechnicalVisit | null>(null);
const formData = ref({
  address: "",
  visitDate: "",
  outcome: "pending" as "approved" | "rejected" | "pending",
  notes: "",
  requestId: null as string | null,
  institutionId: null as string | null,
});

// Solicitações aguardando visita técnica (para o registro vinculado)
const openRequests = ref<OpenCollectionRequest[]>([]);
const institutionOptions = ref<InstitutionOption[]>([]);
const showRegisterModal = ref(false);
const isRegistering = ref(false);
const registerTargetVisit = ref<TechnicalVisit | null>(null);
const registerContext = ref<OpenCollectionRequest | null>(null);
const registerFormData = ref({ visitDate: "", note: "" });

const filterTabs = [
  { value: "all", label: "Todas" },
  { value: "approved", label: "Aprovadas" },
  { value: "rejected", label: "Reprovadas" },
  { value: "pending", label: "Pendentes" },
];

const outcomeOptions = [
  { label: "Pendente", value: "pending" },
  { label: "Aprovada", value: "approved" },
  { label: "Reprovada", value: "rejected" },
];

const requestOptions = computed(() => [
  { label: "Sem solicitação vinculada", value: "" },
  ...openRequests.value
    .filter((request) => !request.technicalVisitId)
    .map((request) => ({
      label: `${request.institutionName} — ${request._id.slice(-6)}`,
      value: request._id,
    })),
]);

const institutionSelectOptions = computed(() => [
  { label: "Sem instituição vinculada", value: "" },
  ...institutionOptions.value.map((institution) => ({
    label: institution.name,
    value: institution.id,
  })),
]);

const isFormValid = computed(() => {
  return (
    formData.value.address.trim() &&
    formData.value.visitDate &&
    formData.value.outcome &&
    (formData.value.requestId || formData.value.institutionId)
  );
});

// Methods
const loadOpenRequests = async () => {
  if (!bloodBanksLocationId.value) return;

  try {
    const response = await fetchWithAuth(
      `/api/v1/bloodbank/${bloodBanksLocationId.value}/collection-requests?limit=100`
    ) as any;

    if (response.success) {
      const allRequests = response.data as OpenCollectionRequest[];
      openRequests.value = allRequests.filter(
        (request) => request.status === "awaiting_technical_visit"
      );
      const byId = new Map<string, InstitutionOption>();
      allRequests.forEach((request) => {
        if (request.institutionId && request.institutionName) {
          byId.set(request.institutionId, {
            id: request.institutionId,
            name: request.institutionName,
            address: request.institutionAddress,
          });
        }
      });
      institutionOptions.value = Array.from(byId.values()).sort((a, b) =>
        a.name.localeCompare(b.name)
      );
    }
  } catch (error) {
    console.error("Error loading awaiting technical visit requests:", error);
  }
};

const getLinkedOpenRequest = (visit: TechnicalVisit) => {
  return (
    openRequests.value.find(
      (request) => request.technicalVisitId === visit._id
    ) || null
  );
};

const getRequestAddress = (request: OpenCollectionRequest): string => {
  if (request.address) {
    return [
      `${request.address.street}, ${request.address.number}`,
      request.address.complement,
      request.address.neighborhood,
      `${request.address.city} - ${request.address.state}`,
      request.address.zipCode,
    ]
      .filter(Boolean)
      .join(", ");
  }

  return request.institutionAddress || "";
};

const handleRequestSelection = (value: string | null) => {
  const requestId = value || null;
  const request = openRequests.value.find(
    (candidate) => candidate._id === requestId
  );

  formData.value.requestId = requestId;
  formData.value.institutionId = request?.institutionId || null;
  if (request) {
    const requestAddress = getRequestAddress(request);
    if (requestAddress) formData.value.address = requestAddress;
  }
};

const loadVisits = async () => {
  if (!bloodBanksLocationId.value) return;
  isLoading.value = true;

  try {
    const params = new URLSearchParams();
    if (selectedFilter.value !== "all") {
      params.append("outcome", selectedFilter.value);
    }
    params.append("page", currentPage.value.toString());
    params.append("limit", "20");

    const response = await fetchWithAuth(
      `/api/v1/bloodbank/${bloodBanksLocationId.value}/technical-visits?${params.toString()}`
    ) as any;

    if (response.success) {
      visits.value = response.data;
      pagination.value = response.pagination;
    }
  } catch (error) {
    console.error("Error loading technical visits:", error);
    useToast().add({
      title: "Erro ao carregar visitas",
      description: "Tente novamente mais tarde.",
      color: "error",
    });
  } finally {
    isLoading.value = false;
  }
};

const openCreateModal = () => {
  editingVisit.value = null;
  formData.value = {
    address: "",
    visitDate: dayjs().tz("America/Sao_Paulo").format("YYYY-MM-DD"),
    outcome: "pending",
    notes: "",
    requestId: null,
    institutionId: null,
  };
  showFormModal.value = true;
};

const openEditModal = (visit: TechnicalVisit) => {
  if (
    visit.institutionId &&
    visit.institutionName &&
    !institutionOptions.value.some(
      (institution) => institution.id === visit.institutionId
    )
  ) {
    institutionOptions.value.push({
      id: visit.institutionId,
      name: visit.institutionName,
      address: visit.institutionAddress,
    });
  }
  editingVisit.value = visit;
  formData.value = {
    address: visit.address,
    visitDate: dayjs(visit.visitDate).format("YYYY-MM-DD"),
    outcome: visit.outcome,
    notes: visit.notes || "",
    requestId: null,
    institutionId: visit.institutionId || null,
  };
  showFormModal.value = true;
};

const submitForm = async () => {
  if (!bloodBanksLocationId.value || !isFormValid.value) return;
  isSaving.value = true;

  try {
    const payload = {
      address: formData.value.address.trim(),
      institutionId: formData.value.institutionId || undefined,
      requestId: formData.value.requestId || undefined,
      visitDate: formData.value.visitDate,
      outcome: formData.value.outcome,
      notes: formData.value.notes?.trim() || null,
    };

    if (editingVisit.value) {
      await fetchWithAuth(
        `/api/v1/bloodbank/${bloodBanksLocationId.value}/technical-visits/${editingVisit.value._id}`,
        { method: "PUT", body: payload }
      );
      useToast().add({
        title: "Visita atualizada!",
        color: "success",
      });
    } else {
      await fetchWithAuth(
        `/api/v1/bloodbank/${bloodBanksLocationId.value}/technical-visits`,
        { method: "POST", body: payload }
      );
      useToast().add({
        title: "Visita registrada!",
        color: "success",
      });
    }

    showFormModal.value = false;
    await loadVisits();
  } catch (error: any) {
    console.error("Error saving technical visit:", error);
    useToast().add({
      title: "Erro ao salvar visita",
      description: error.message || "Tente novamente.",
      color: "error",
    });
  } finally {
    isSaving.value = false;
  }
};

const openRegisterVisitModal = (visit: TechnicalVisit) => {
  const request = getLinkedOpenRequest(visit);
  if (!request) return;

  registerTargetVisit.value = visit;
  registerContext.value = request;
  registerFormData.value = {
    visitDate: dayjs().tz("America/Sao_Paulo").format("YYYY-MM-DD"),
    note: "",
  };
  showRegisterModal.value = true;
};

const submitRegisterVisit = async () => {
  if (
    !bloodBanksLocationId.value ||
    !registerContext.value ||
    !registerFormData.value.visitDate
  ) {
    return;
  }
  isRegistering.value = true;

  try {
    await fetchWithAuth(
      `/api/v1/bloodbank/${bloodBanksLocationId.value}/collection-requests/${registerContext.value._id}/register-retroactive-visit`,
      {
        method: "POST",
        body: {
          visitDate: registerFormData.value.visitDate,
          note: registerFormData.value.note?.trim() || undefined,
        },
      }
    );
    useToast().add({
      title: "Visita registrada!",
      description: "Solicitação avançada para visita técnica confirmada.",
      color: "success",
    });
    showRegisterModal.value = false;
    await Promise.all([loadVisits(), loadOpenRequests()]);
  } catch (error: any) {
    console.error("Error registering performed visit:", error);
    useToast().add({
      title: "Erro ao registrar visita",
      description: error.message || "Tente novamente.",
      color: "error",
    });
  } finally {
    isRegistering.value = false;
  }
};

const confirmDelete = async () => {
  if (!bloodBanksLocationId.value || !editingVisit.value) return;
  isDeleting.value = true;

  try {
    await fetchWithAuth(
      `/api/v1/bloodbank/${bloodBanksLocationId.value}/technical-visits/${editingVisit.value._id}`,
      { method: "DELETE" }
    );
    useToast().add({
      title: "Visita excluida!",
      color: "success",
    });
    showFormModal.value = false;
    await loadVisits();
  } catch (error: any) {
    console.error("Error deleting technical visit:", error);
    useToast().add({
      title: "Erro ao excluir visita",
      description: error.message || "Tente novamente.",
      color: "error",
    });
  } finally {
    isDeleting.value = false;
  }
};

const getOutcomeColor = (outcome: string) => {
  switch (outcome) {
    case "approved": return "success";
    case "rejected": return "error";
    case "pending": return "warning";
    default: return "neutral";
  }
};

const getOutcomeLabel = (outcome: string) => {
  switch (outcome) {
    case "approved": return "Aprovada";
    case "rejected": return "Reprovada";
    case "pending": return "Pendente";
    default: return outcome;
  }
};

const formatDate = (date: string | Date) => {
  return dayjs(date).tz("America/Sao_Paulo").format("DD/MM/YYYY");
};

// Commitment term generation
const generatingTermForVisit = ref<string | null>(null);

const generateTermForVisit = async (visit: TechnicalVisit) => {
  if (!bloodBanksLocationId.value) return;
  generatingTermForVisit.value = visit._id;

  try {
    const response = await fetchWithAuth(
      `/api/v1/bloodbank/${bloodBanksLocationId.value}/commitment-terms`,
      {
        method: "POST",
        body: {
          technicalVisitId: visit._id,
          sentTo: visit.address,
          templateParams: {
            bloodBankName: bloodbankData.value?.name || "",
            address: visit.address,
            date: new Date().toLocaleDateString("pt-BR"),
            institutionName: "",
            hostName: "",
          },
          status: "draft",
        },
      }
    ) as any;

    if (response.success && response.data?.accessToken) {
      const termUrl = `${window.location.origin}/termo/${response.data.accessToken}`;
      window.open(termUrl, "_blank");
      useToast().add({
        title: "Termo gerado!",
        description: "O termo de compromisso foi gerado com sucesso.",
        color: "success",
        duration: 5000,
      });
    }
  } catch (err: any) {
    console.error("Error generating commitment term:", err);
    useToast().add({
      title: "Erro ao gerar termo",
      description: err.message || "Tente novamente mais tarde.",
      color: "error",
      duration: 3000,
    });
  } finally {
    generatingTermForVisit.value = null;
  }
};

// Watchers
watch(selectedFilter, () => {
  currentPage.value = 1;
  loadVisits();
});

// Lifecycle
onMounted(() => {
  loadVisits();
  loadOpenRequests();
});
</script>
