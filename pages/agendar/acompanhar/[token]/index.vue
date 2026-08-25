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

        <!-- Counter Proposal -->
        <UCard v-if="request.status === 'counter_proposed' && request.counterProposal">
          <template #header>
            <div class="flex items-center gap-2 text-blue-700">
              <UIcon name="i-lucide-calendar-sync" class="w-5 h-5" />
              <span class="font-semibold">O Banco de Sangue Propôs Outra Data</span>
            </div>
          </template>
          <div class="space-y-3">
            <p v-if="request.counterProposal.note" class="text-sm text-gray-700">
              {{ request.counterProposal.note }}
            </p>
            <div v-if="!isLoggedIn" class="text-sm text-gray-600">
              Faça login para responder a esta contraproposta.
            </div>
            <template v-else>
              <div
                v-for="(d, idx) in request.counterProposal.proposedDates"
                :key="idx"
                class="border rounded-lg p-3 flex items-center justify-between gap-3"
                :class="{ 'border-primary-400 bg-primary-50': selectedCounterProposalIndex === idx }"
              >
                <div>
                  <p class="font-medium text-sm">
                    {{ formatCounterProposalDate(d.date) }} às {{ d.startTime }}
                  </p>
                  <p class="text-xs text-gray-500">{{ d.durationMinutes }} minutos</p>
                  <p v-if="d.note" class="text-xs text-gray-600 mt-1">{{ d.note }}</p>
                </div>
                <UButton
                  size="sm"
                  color="success"
                  :loading="respondingToCounterProposal && selectedCounterProposalIndex === idx"
                  @click="
                    selectedCounterProposalIndex = idx;
                    respondToCounterProposal('accepted', idx);
                  "
                >
                  Aceitar esta opção
                </UButton>
              </div>
              <UButton
                color="error"
                variant="soft"
                class="w-full"
                @click="showDeclineCounterProposalModal = true"
              >
                Recusar Contraproposta
              </UButton>
            </template>
          </div>
        </UCard>

        <!-- Technical Visit Proposal -->
        <UCard v-if="request.visitProposal">
          <template #header>
            <div class="flex items-center gap-2 text-amber-700">
              <UIcon name="i-lucide-map-pinned" class="w-5 h-5" />
              <span class="font-semibold">Proposta de visita técnica</span>
            </div>
          </template>
          <div class="space-y-3">
            <p v-if="request.visitProposal.note" class="text-sm text-gray-700">
              {{ request.visitProposal.note }}
            </p>
            <div v-if="!isLoggedIn" class="text-sm text-gray-600">
              Faça login para responder a esta proposta de visita técnica.
            </div>
            <template v-else>
              <div
                v-for="(d, idx) in request.visitProposal.proposedDates"
                :key="idx"
                class="border rounded-lg p-3 flex items-center justify-between gap-3"
                :class="{
                  'border-primary-400 bg-primary-50':
                    selectedTechnicalVisitProposalIndex === idx,
                }"
              >
                <div>
                  <p class="font-medium text-sm">
                    {{ formatCounterProposalDate(d.date) }} às {{ d.startTime }}
                  </p>
                  <p class="text-xs text-gray-500">
                    {{ d.durationMinutes }} minutos
                  </p>
                  <p v-if="d.note" class="text-xs text-gray-600 mt-1">
                    {{ d.note }}
                  </p>
                </div>
                <UButton
                  size="sm"
                  color="success"
                  :loading="
                    respondingToTechnicalVisitProposal &&
                    selectedTechnicalVisitProposalIndex === idx
                  "
                  @click="
                    selectedTechnicalVisitProposalIndex = idx;
                    respondToTechnicalVisitProposal('accepted', idx);
                  "
                >
                  Aceitar esta opção
                </UButton>
              </div>
              <UButton
                color="error"
                variant="soft"
                class="w-full"
                @click="showDeclineTechnicalVisitProposalModal = true"
              >
                Recusar proposta
              </UButton>
            </template>
          </div>
        </UCard>

        <!-- Scheduled Technical Visit -->
        <UCard v-if="request.technicalVisit">
          <template #header>
            <div class="flex items-center gap-2 text-blue-700">
              <UIcon name="i-lucide-map-pinned" class="w-5 h-5" />
              <span class="font-semibold">Visita técnica agendada</span>
            </div>
          </template>
          <div class="space-y-2">
            <UBadge :color="technicalVisitOutcomeColor" variant="subtle">
              {{ technicalVisitOutcomeLabel }}
            </UBadge>
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-calendar" class="w-4 h-4 text-gray-400" />
              <span>{{ formatTechnicalVisitDate(request.technicalVisit.visitDate) }}</span>
            </div>
            <div
              v-if="request.technicalVisit.address"
              class="flex items-start gap-2"
            >
              <UIcon
                name="i-lucide-map-pin"
                class="w-4 h-4 text-gray-400 mt-0.5 shrink-0"
              />
              <span>{{ request.technicalVisit.address }}</span>
            </div>
            <p
              v-if="request.technicalVisit.notes"
              class="text-sm text-gray-600 whitespace-pre-line"
            >
              {{ request.technicalVisit.notes }}
            </p>
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

        <!-- Note -->
        <UCard v-if="request.note">
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-sticky-note" class="w-5 h-5 text-gray-500" />
              <span class="font-semibold">Nota</span>
            </div>
          </template>
          <p class="text-sm text-gray-700 whitespace-pre-line">
            {{ request.note }}
          </p>
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

    <!-- Decline Counter Proposal Modal -->
    <UModal v-model:open="showDeclineCounterProposalModal">
      <template #content>
        <div class="p-6 space-y-4">
          <h3 class="text-lg font-semibold">Recusar Contraproposta</h3>
          <p class="text-sm text-gray-600">
            Tem certeza que deseja recusar todas as opções propostas pelo banco de
            sangue? A solicitação ficará marcada como recusada.
          </p>
          <div class="flex justify-end gap-2">
            <UButton
              variant="ghost"
              @click="showDeclineCounterProposalModal = false"
              :disabled="respondingToCounterProposal"
            >
              Voltar
            </UButton>
            <UButton
              color="error"
              @click="respondToCounterProposal('declined', null)"
              :loading="respondingToCounterProposal"
            >
              Confirmar Recusa
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- Decline Technical Visit Proposal Modal -->
    <UModal v-model:open="showDeclineTechnicalVisitProposalModal">
      <template #content>
        <div class="p-6 space-y-4">
          <h3 class="text-lg font-semibold">Recusar proposta de visita técnica</h3>
          <p class="text-sm text-gray-600">
            Tem certeza que deseja recusar todas as opções de visita técnica?
          </p>
          <div class="flex justify-end gap-2">
            <UButton
              variant="ghost"
              @click="showDeclineTechnicalVisitProposalModal = false"
              :disabled="respondingToTechnicalVisitProposal"
            >
              Voltar
            </UButton>
            <UButton
              color="error"
              @click="respondToTechnicalVisitProposal('declined', null)"
              :loading="respondingToTechnicalVisitProposal"
            >
              Confirmar Recusa
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
const accessToken = route.params.token as string;
const toast = useToast();

const userStore = useUserStore();
const { user } = storeToRefs(userStore);
const isLoggedIn = computed(() => Boolean(user.value));

interface PublicRequestData {
  _id: string;
  status:
    | "pending"
    | "accepted"
    | "rejected"
    | "cancelled"
    | "counter_proposed"
    | "counter_proposal_declined"
    | "awaiting_technical_visit"
    | "technical_visit_confirmed"
    | "scheduled";
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
  note?: string;
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
  counterProposal?: {
    proposedDates: Array<{
      date: string;
      startTime: string;
      durationMinutes: number;
      note: string;
    }>;
    needsTechnicalVisit: boolean;
    note: string;
    proposedAt: string;
  };
  visitProposal?: {
    proposedDates: Array<{
      date: string;
      startTime: string;
      durationMinutes: number;
      note: string;
    }>;
    note: string;
    proposedAt: string;
  };
  technicalVisit?: {
    id: string;
    visitDate: string;
    address: string;
    outcome: "approved" | "rejected" | "pending";
    notes?: string;
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
    case "counter_proposed":
      return "info" as const;
    case "counter_proposal_declined":
      return "error" as const;
    case "awaiting_technical_visit":
      return "warning" as const;
    case "technical_visit_confirmed":
      return "success" as const;
    case "scheduled":
      return "success" as const;
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
    case "counter_proposed":
      return "Contraproposta Recebida";
    case "counter_proposal_declined":
      return "Contraproposta Recusada";
    case "awaiting_technical_visit":
      return "Aguardando visita técnica";
    case "technical_visit_confirmed":
      return "Visita técnica confirmada";
    case "scheduled":
      return "Solicitação agendada";
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

const technicalVisitOutcomeColor = computed(() => {
  switch (request.value?.technicalVisit?.outcome) {
    case "approved":
      return "success" as const;
    case "rejected":
      return "error" as const;
    default:
      return "warning" as const;
  }
});

const technicalVisitOutcomeLabel = computed(() => {
  switch (request.value?.technicalVisit?.outcome) {
    case "approved":
      return "Aprovada";
    case "rejected":
      return "Recusada";
    default:
      return "Pendente";
  }
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

// counterProposal.proposedDates[].date é um Date completo (com hora, em UTC),
// diferente de requestedDates[].date/selectedDate.date que são strings
// "YYYY-MM-DD" sem hora — por isso não pode reusar formatDate() aqui, que
// assume "YYYY-MM-DD" e concatena "T12:00:00". Fixamos o timezone
// explicitamente para bater com o calendário do banco de sangue.
function formatCounterProposalDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  });
}

// technicalVisit.visitDate é um Date completo (data + hora, em UTC) e a visita
// acontece na instituição, então exibimos data e hora no mesmo timezone fixo
// usado pela proposta (America/Sao_Paulo), igual ao calendário do banco.
function formatTechnicalVisitDate(dateStr: string) {
  const d = new Date(dateStr);
  const date = formatCounterProposalDate(dateStr);
  const time = d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
  return `${date} às ${time}`;
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
    case "counter_proposed":
      return "bg-blue-400";
    case "counter_proposal_declined":
      return "bg-red-400";
    case "awaiting_technical_visit":
      return "bg-amber-400";
    case "technical_visit_confirmed":
      return "bg-green-500";
    case "scheduled":
      return "bg-green-500";
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
    case "counter_proposed":
      return "Banco de Sangue Propôs Outra Data";
    case "counter_proposal_declined":
      return "Contraproposta Recusada";
    case "awaiting_technical_visit":
      return "Aguardando visita técnica";
    case "technical_visit_confirmed":
      return "Visita técnica confirmada";
    case "scheduled":
      return "Solicitação agendada";
    default:
      return status;
  }
}

async function loadRequest(options: { quiet?: boolean } = {}) {
  const { quiet = false } = options;
  if (!quiet) {
    loading.value = true;
    error.value = false;
  }
  try {
    const response = await $fetch<{ success: boolean; data: PublicRequestData }>(
      `/api/v1/public/collection-requests/track/${accessToken}`
    );
    request.value = response.data;
  } catch {
    if (!quiet) {
      error.value = true;
    }
  } finally {
    if (!quiet) {
      loading.value = false;
    }
  }
}

const respondingToCounterProposal = ref(false);
const selectedCounterProposalIndex = ref<number | null>(null);
const showDeclineCounterProposalModal = ref(false);

const respondingToTechnicalVisitProposal = ref(false);
const selectedTechnicalVisitProposalIndex = ref<number | null>(null);
const showDeclineTechnicalVisitProposalModal = ref(false);

async function respondToCounterProposal(
  decision: "accepted" | "declined",
  selectedIndex: number | null
) {
  if (!request.value) return;
  respondingToCounterProposal.value = true;
  try {
    await $fetch<{ success: boolean; data: PublicRequestData }>(
      `/api/v1/public/collection-requests/track/${accessToken}/respond-counter-proposal`,
      {
        method: "POST",
        body: {
          decision,
          selectedDateId: selectedIndex !== null ? String(selectedIndex) : "",
        },
        headers: {
          Authorization: `Bearer ${userStore.token}`,
        },
      }
    );
    await loadRequest({ quiet: true });
    showDeclineCounterProposalModal.value = false;
    toast.add({
      title:
        decision === "accepted"
          ? "Data confirmada com sucesso"
          : "Contraproposta recusada",
      color: decision === "accepted" ? "success" : "neutral",
    });
  } catch {
    toast.add({ title: "Erro ao responder à contraproposta", color: "error" });
  } finally {
    respondingToCounterProposal.value = false;
    selectedCounterProposalIndex.value = null;
  }
}

async function respondToTechnicalVisitProposal(
  decision: "accepted" | "declined",
  selectedIndex: number | null
) {
  if (!request.value) return;
  respondingToTechnicalVisitProposal.value = true;
  try {
    await $fetch<{ success: boolean; data: PublicRequestData }>(
      `/api/v1/public/collection-requests/track/${accessToken}/respond-technical-visit-proposal`,
      {
        method: "POST",
        body: {
          decision,
          selectedDateId: selectedIndex !== null ? String(selectedIndex) : "",
        },
        headers: {
          Authorization: `Bearer ${userStore.token}`,
        },
      }
    );
    await loadRequest({ quiet: true });
    showDeclineTechnicalVisitProposalModal.value = false;
    toast.add({
      title:
        decision === "accepted"
          ? "Visita técnica agendada com sucesso"
          : "Proposta de visita técnica recusada",
      color: decision === "accepted" ? "success" : "neutral",
    });
  } catch {
    toast.add({
      title: "Erro ao responder à proposta de visita técnica",
      color: "error",
    });
  } finally {
    respondingToTechnicalVisitProposal.value = false;
    selectedTechnicalVisitProposalIndex.value = null;
  }
}

async function handleWithdraw() {
  if (!request.value) return;
  withdrawing.value = true;
  try {
    const response = await $fetch<{ success: boolean; data: PublicRequestData }>(
      `/api/v1/public/collection-requests/track/${accessToken}/withdraw`,
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
