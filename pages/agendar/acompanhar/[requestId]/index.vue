<template>
  <div class="min-h-screen bg-gray-50 text-gray-900">
    <!-- Top Bar -->
    <header
      class="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-gray-200"
    >
      <div
        class="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between"
      >
        <div class="flex items-center gap-2">
          <img src="/logo.svg" alt="Hemocione Coleta" class="w-8 h-8" />
          <span class="font-semibold">Acompanhar Solicitação</span>
        </div>
      </div>
    </header>

    <main class="max-w-3xl mx-auto px-4 py-6 space-y-4">
      <!-- Loading -->
      <div v-if="loading" class="space-y-4">
        <USkeleton class="h-32" />
        <USkeleton class="h-48" />
        <USkeleton class="h-24" />
      </div>

      <!-- Error -->
      <div v-else-if="error" class="text-center py-12 text-gray-600">
        <UIcon
          name="i-lucide-alert-circle"
          class="w-10 h-10 mx-auto mb-3 text-gray-400"
        />
        <p>Solicitação não encontrada.</p>
      </div>

      <!-- Content -->
      <template v-else-if="request">
        <!-- Status Banner -->
        <UCard>
          <div class="flex items-center gap-3">
            <UAvatar
              :src="request.bloodBankLogo || undefined"
              size="lg"
            >
              {{ request.bloodBankName?.charAt(0) || "B" }}
            </UAvatar>
            <div class="flex-1 min-w-0">
              <div class="font-semibold text-lg">
                {{ request.bloodBankName }}
              </div>
              <div class="text-sm text-gray-500">
                Instituição: {{ request.institutionName }}
              </div>
            </div>
            <UBadge
              :color="statusColor"
              size="lg"
              variant="subtle"
            >
              {{ statusLabel }}
            </UBadge>
          </div>
        </UCard>

        <!-- Accepted Info -->
        <UCard v-if="request.status === 'accepted' && request.selectedDate">
          <template #header>
            <div class="flex items-center gap-2 text-green-700">
              <UIcon name="i-lucide-calendar-check" class="w-5 h-5" />
              <span class="font-semibold">Coleta Confirmada</span>
            </div>
          </template>
          <div class="space-y-2">
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-calendar" class="w-4 h-4 text-gray-400" />
              <span>{{ formatDate(request.selectedDate.date) }}</span>
            </div>
            <div
              v-if="request.selectedDate.startTime"
              class="flex items-center gap-2"
            >
              <UIcon name="i-lucide-clock" class="w-4 h-4 text-gray-400" />
              <span>
                {{ formatTime(request.selectedDate.startTime) }}
                <template v-if="request.selectedDate.endTime">
                  - {{ formatTime(request.selectedDate.endTime) }}
                </template>
              </span>
            </div>
            <div
              v-if="request.selectedDate.teamName"
              class="flex items-center gap-2"
            >
              <UIcon name="i-lucide-users" class="w-4 h-4 text-gray-400" />
              <span>{{ request.selectedDate.teamName }}</span>
            </div>
          </div>
        </UCard>

        <!-- Cancellation orientation for accepted requests -->
        <UAlert
          v-if="request.status === 'accepted'"
          color="info"
          icon="i-lucide-info"
          title="Precisa cancelar?"
          :description="`Entre em contato diretamente com ${request.bloodBankName} para solicitar o cancelamento.`"
        />

        <!-- Rejection Reason -->
        <UCard v-if="request.status === 'rejected'">
          <template #header>
            <div class="flex items-center gap-2 text-red-600">
              <UIcon name="i-lucide-x-circle" class="w-5 h-5" />
              <span class="font-semibold">Motivo da Rejeição</span>
            </div>
          </template>
          <p class="text-gray-700">
            {{ request.rejectionReason || "Não informado" }}
          </p>
        </UCard>

        <!-- Cancellation Reason -->
        <UCard v-if="request.status === 'cancelled' && cancellationReason">
          <template #header>
            <div class="flex items-center gap-2 text-gray-600">
              <UIcon name="i-lucide-ban" class="w-5 h-5" />
              <span class="font-semibold">Motivo do Cancelamento</span>
            </div>
          </template>
          <p class="text-gray-700 mb-3">{{ cancellationReason }}</p>
          <p class="text-sm text-gray-500">
            Para mais informações, entre em contato com
            {{ request.bloodBankName }}.
          </p>
        </UCard>

        <!-- Requested Dates -->
        <UCard v-if="request.status === 'pending'">
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon
                name="i-lucide-calendar-clock"
                class="w-5 h-5 text-yellow-600"
              />
              <span class="font-semibold">Datas Solicitadas</span>
            </div>
          </template>
          <div class="space-y-2">
            <div
              v-for="(rd, idx) in request.requestedDates"
              :key="idx"
              class="flex items-center gap-2 text-sm"
            >
              <UIcon name="i-lucide-calendar" class="w-4 h-4 text-gray-400" />
              <span>{{ formatDate(rd.date) }}</span>
              <span v-if="rd.startTime" class="text-gray-400">
                {{ formatTime(rd.startTime) }}
                <template v-if="rd.endTime">
                  - {{ formatTime(rd.endTime) }}
                </template>
              </span>
            </div>
          </div>
        </UCard>

        <!-- Withdraw button for pending requests (requires login) -->
        <UCard v-if="request.status === 'pending' && isLoggedIn">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-600">
                Deseja retirar esta solicitação?
              </p>
            </div>
            <UButton
              color="error"
              variant="soft"
              icon="i-lucide-x"
              @click="showWithdrawModal = true"
            >
              Retirar Pedido
            </UButton>
          </div>
        </UCard>

        <!-- Host Info -->
        <UCard v-if="request.host">
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-user" class="w-5 h-5 text-gray-500" />
              <span class="font-semibold">Ponto Focal</span>
            </div>
          </template>
          <div class="space-y-1 text-sm">
            <div>{{ request.host.name }}</div>
            <div>
              <a
                :href="`mailto:${request.host.email}`"
                class="text-primary-600 hover:underline"
              >
                {{ request.host.email }}
              </a>
            </div>
            <div>
              <a
                :href="`tel:${request.host.phone}`"
                class="text-primary-600 hover:underline"
              >
                {{ request.host.phone }}
              </a>
            </div>
          </div>
        </UCard>

        <!-- Address -->
        <UCard v-if="request.address">
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-map-pin" class="w-5 h-5 text-gray-500" />
              <span class="font-semibold">Local da Coleta</span>
            </div>
          </template>
          <p class="text-sm text-gray-700">{{ formattedAddress }}</p>
        </UCard>

        <!-- Status Timeline -->
        <UCard>
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-history" class="w-5 h-5 text-gray-500" />
              <span class="font-semibold">Histórico</span>
            </div>
          </template>
          <div class="space-y-3">
            <div
              v-for="(entry, idx) in sortedHistory"
              :key="idx"
              class="flex items-start gap-3"
            >
              <div
                class="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0"
                :class="historyDotColor(entry.status)"
              />
              <div>
                <div class="text-sm font-medium">
                  {{ historyStatusLabel(entry.status) }}
                </div>
                <div class="text-xs text-gray-500">
                  {{ formatDateTime(entry.changedAt) }}
                </div>
                <div
                  v-if="entry.reason && entry.status !== 'pending'"
                  class="text-xs text-gray-500 mt-0.5"
                >
                  {{ entry.reason }}
                </div>
              </div>
            </div>
          </div>
        </UCard>
      </template>
    </main>

    <!-- Withdraw Modal -->
    <UModal v-model:open="showWithdrawModal">
      <template #content>
        <div class="p-6 space-y-4">
          <h3 class="text-lg font-semibold">Retirar Solicitação</h3>
          <p class="text-sm text-gray-600">
            Tem certeza que deseja retirar esta solicitação? Ela será cancelada e
            você precisará criar uma nova caso queira agendar novamente.
          </p>
          <UFormField label="Motivo (opcional)">
            <UTextarea
              v-model="withdrawReason"
              placeholder="Informe o motivo da retirada..."
              :maxlength="1000"
            />
          </UFormField>
          <div class="flex justify-end gap-2">
            <UButton
              variant="ghost"
              @click="showWithdrawModal = false"
              :disabled="withdrawing"
            >
              Voltar
            </UButton>
            <UButton
              color="error"
              @click="handleWithdraw"
              :loading="withdrawing"
            >
              Confirmar Retirada
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { useUserStore } from "~/stores/user";

definePageMeta({ layout: false });

const route = useRoute();
const requestId = route.params.requestId as string;
const toast = useToast();

const userStore = useUserStore();
const { user } = storeToRefs(userStore);
const isLoggedIn = computed(() => Boolean(user.value));

interface PublicRequestData {
  _id: string;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  bloodBankName: string;
  bloodBankLogo?: string | null;
  institutionName: string;
  host: { name: string; email: string; phone: string };
  address?: {
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    zipCode: string;
  };
  requestedDates: Array<{
    date: string;
    startTime?: string;
    endTime?: string;
    teamName?: string;
  }>;
  selectedDate?: {
    date: string;
    startTime?: string;
    endTime?: string;
    teamName?: string;
  };
  rejectionReason?: string;
  statusHistory: Array<{
    status: string;
    changedAt: string;
    reason?: string;
  }>;
  createdAt: string;
}

const loading = ref(true);
const error = ref(false);
const request = ref<PublicRequestData | null>(null);
const showWithdrawModal = ref(false);
const withdrawReason = ref("");
const withdrawing = ref(false);

const statusColor = computed(() => {
  switch (request.value?.status) {
    case "pending":
      return "warning" as const;
    case "accepted":
      return "success" as const;
    case "rejected":
      return "error" as const;
    case "cancelled":
      return "neutral" as const;
    default:
      return "neutral" as const;
  }
});

const statusLabel = computed(() => {
  switch (request.value?.status) {
    case "pending":
      return "Pendente";
    case "accepted":
      return "Aceita";
    case "rejected":
      return "Rejeitada";
    case "cancelled":
      return "Cancelada";
    default:
      return "";
  }
});

const cancellationReason = computed(() => {
  if (!request.value) return null;
  const entry = [...(request.value.statusHistory || [])]
    .reverse()
    .find((h) => h.status === "cancelled");
  return entry?.reason || null;
});

const formattedAddress = computed(() => {
  const addr = request.value?.address;
  if (!addr) return "";
  let parts = `${addr.street}, ${addr.number}`;
  if (addr.complement) parts += `, ${addr.complement}`;
  parts += ` - ${addr.neighborhood}, ${addr.city} - ${addr.state}`;
  if (addr.zipCode) parts += `, ${addr.zipCode}`;
  return parts;
});

const sortedHistory = computed(() => {
  if (!request.value?.statusHistory) return [];
  return [...request.value.statusHistory].sort(
    (a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime()
  );
});

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatTime(timeStr: string) {
  const d = new Date(timeStr);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatDateTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function historyDotColor(status: string) {
  switch (status) {
    case "pending":
      return "bg-yellow-400";
    case "accepted":
      return "bg-green-500";
    case "rejected":
      return "bg-red-500";
    case "cancelled":
      return "bg-gray-400";
    default:
      return "bg-gray-300";
  }
}

function historyStatusLabel(status: string) {
  switch (status) {
    case "pending":
      return "Solicitação Criada";
    case "accepted":
      return "Aceita pelo Banco de Sangue";
    case "rejected":
      return "Rejeitada pelo Banco de Sangue";
    case "cancelled":
      return "Cancelada";
    default:
      return status;
  }
}

async function loadRequest() {
  loading.value = true;
  error.value = false;
  try {
    const response = await $fetch<{ success: boolean; data: PublicRequestData }>(
      `/api/v1/public/collection-requests/${requestId}`
    );
    request.value = response.data;
  } catch {
    error.value = true;
  } finally {
    loading.value = false;
  }
}

async function handleWithdraw() {
  if (!request.value) return;
  withdrawing.value = true;
  try {
    // We need the institutionId — we can get it from the auth context
    // The withdraw endpoint needs institutionId, which we don't have on the public page
    // We'll use a dedicated endpoint that finds the request by ID and validates user access
    const response = await $fetch<{ success: boolean; data: PublicRequestData }>(
      `/api/v1/public/collection-requests/${requestId}/withdraw`,
      {
        method: "POST",
        body: { reason: withdrawReason.value.trim() || undefined },
        headers: {
          Authorization: `Bearer ${userStore.token}`,
        },
      }
    );
    request.value = response.data;
    showWithdrawModal.value = false;
    withdrawReason.value = "";
    toast.add({ title: "Solicitação retirada com sucesso", color: "success" });
  } catch {
    toast.add({ title: "Erro ao retirar solicitação", color: "error" });
  } finally {
    withdrawing.value = false;
  }
}

onMounted(() => {
  loadRequest();
});
</script>
