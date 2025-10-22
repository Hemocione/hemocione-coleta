<template>
  <div class="flex flex-col gap-8">
    <!-- Calendário -->
    <UCard>
      <div class="p-8">
        <UCalendar
          v-model="selectedDate"
          :default-value="currentCalendarDate"
          class="w-full calendar-past-dates calendar-with-availability"
        />
      </div>
    </UCard>

    <!-- Botão Adicionar Data -->
    <div class="flex justify-center">
      <UButton
        color="primary"
        icon="i-lucide-plus"
        @click="handleCreateDate"
        size="lg"
      >
        Adicionar data de disponibilidade
      </UButton>
    </div>

    <!-- Create Date Modal -->
    <UModal v-model:open="showCreateModal" title="Criar Nova Data">
      <template #body>
        <UForm
          ref="form"
          :state="formState"
          @submit="handleCreateDateSubmit"
          class="space-y-6"
        >
          <!-- Data -->
          <UFormField label="Data" required>
            <UCalendar
              v-model="formState.date"
              :default-value="selectedDate || currentCalendarDate"
              :min-value="currentCalendarDate"
              size="lg"
            />
          </UFormField>

          <!-- Todos os times -->
          <UFormField>
            <UCheckbox
              v-model="formState.isAllTeams"
              label="Todas as equipes"
              description="Incluir automaticamente todas as equipes cadastradas"
            />
          </UFormField>

          <!-- Lista de equipes com horários individuais -->
          <Transition
            enter-active-class="transition-opacity duration-300"
            enter-from-class="opacity-0"
            enter-to-class="opacity-100"
            leave-active-class="transition-opacity duration-300"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
          >
            <div v-if="!formState.isAllTeams" class="space-y-4">
              <UFormField label="Equipes e Horários">
                <div class="space-y-3">
                  <div
                    v-for="team in teams"
                    :key="team._id"
                    class="flex items-center space-x-4 p-3 border-2 rounded-lg"
                    :style="{
                      borderColor: team.color,
                      backgroundColor: `${team.color}10`,
                    }"
                  >
                    <!-- Checkbox da equipe -->
                    <UCheckbox
                      :id="`team-${team._id}`"
                      :model-value="
                        formState.selectedTeamIds.includes(team._id)
                      "
                      @update:model-value="
                        (checked) => toggleTeamSelection(team._id, checked)
                      "
                      :disabled="formState.isAllTeams"
                      class="flex-shrink-0"
                    />

                    <!-- Nome da equipe -->
                    <label
                      :for="`team-${team._id}`"
                      class="flex-1 font-medium text-sm"
                      :class="{
                        'cursor-pointer': !formState.isAllTeams,
                        'cursor-not-allowed': formState.isAllTeams,
                      }"
                      :style="{ color: team.color }"
                    >
                      {{ team.name }}
                    </label>

                    <!-- Horários da equipe -->
                    <div
                      v-if="!formState.isAllTeams"
                      class="flex items-center space-x-2"
                    >
                      <div class="flex items-center space-x-1">
                        <label class="text-xs text-gray-600">Início:</label>
                        <UInput
                          :model-value="
                            formState.teamTimes[team._id]?.startTime
                          "
                          @update:model-value="
                            (value) =>
                              updateTeamTime(team._id, 'startTime', value)
                          "
                          type="time"
                          size="sm"
                          class="w-24"
                          :disabled="
                            !formState.selectedTeamIds.includes(team._id)
                          "
                        />
                      </div>
                      <div class="flex items-center space-x-1">
                        <label class="text-xs text-gray-600">Fim:</label>
                        <UInput
                          :model-value="formState.teamTimes[team._id]?.endTime"
                          @update:model-value="
                            (value) =>
                              updateTeamTime(team._id, 'endTime', value)
                          "
                          type="time"
                          size="sm"
                          class="w-24"
                          :disabled="
                            !formState.selectedTeamIds.includes(team._id)
                          "
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </UFormField>
            </div>
          </Transition>

          <!-- Horário global (apenas quando "Todas as equipes" está marcado) -->
          <div v-if="formState.isAllTeams" class="space-y-4">
            <UFormField label="Horário">
              <div class="grid grid-cols-2 gap-4">
                <UFormField label="Início" required>
                  <UInput
                    v-model="formState.globalStartTime"
                    type="time"
                    size="lg"
                  />
                </UFormField>
                <UFormField label="Fim" required>
                  <UInput
                    v-model="formState.globalEndTime"
                    type="time"
                    size="lg"
                  />
                </UFormField>
              </div>
            </UFormField>
          </div>
        </UForm>
      </template>

      <template #footer="{ close }">
        <div class="flex justify-end space-x-3">
          <UButton variant="ghost" @click="close" :disabled="isSubmitting">
            Cancelar
          </UButton>
          <UButton
            color="primary"
            :loading="isSubmitting"
            :disabled="!canSubmit"
            @click="handleCreateDateSubmit"
          >
            {{ isSubmitting ? "Criando..." : "Criar Data" }}
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Day Detail Modal -->
    <UModal
      v-model:open="showDetailModal"
      :title="
        selectedAvailableDate
          ? `Detalhes da Data - ${formatDateToYYYYMMDD(
              selectedAvailableDate.date
            )}`
          : 'Detalhes da Data'
      "
    >
      <template #body>
        <div v-if="selectedAvailableDate" class="space-y-6">
          <!-- Informações da data -->
          <div class="bg-gray-50 rounded-lg p-4">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm text-gray-600">Data</p>
                <p class="font-semibold">
                  {{ formatDateToYYYYMMDD(selectedAvailableDate.date) }}
                </p>
              </div>
              <div>
                <p class="text-sm text-gray-600">Times</p>
                <p class="font-semibold">
                  {{ selectedAvailableDate.slots.length }} time(s)
                </p>
              </div>
            </div>
          </div>

          <!-- Lista de slots -->
          <div class="space-y-3">
            <h4 class="font-medium text-gray-900">Times e Horários</h4>
            <div
              v-for="slot in selectedAvailableDate.slots"
              :key="slot._id"
              class="border border-gray-200 rounded-lg p-4"
            >
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-3">
                  <div
                    class="w-4 h-4 rounded-full"
                    :style="{ backgroundColor: getTeamColor(slot.teamId) }"
                  ></div>
                  <div>
                    <p class="font-medium">{{ getTeamName(slot.teamId) }}</p>
                    <p class="text-sm text-gray-600">
                      {{ formatTimeRange(slot.startTime, slot.endTime) }}
                    </p>
                  </div>
                </div>
                <div class="flex items-center space-x-2">
                  <UBadge
                    :color="slot.locked ? 'error' : 'success'"
                    variant="subtle"
                    size="sm"
                  >
                    {{ slot.locked ? "Bloqueado" : "Disponível" }}
                  </UBadge>
                  <UButton
                    variant="ghost"
                    size="sm"
                    color="error"
                    icon="i-lucide-trash-2"
                    :disabled="slot.locked || isUpdating"
                    @click="handleRemoveSlot(slot)"
                  >
                    Remover Time
                  </UButton>
                </div>
              </div>
            </div>
          </div>

          <!-- Botões de ação -->
          <div class="flex justify-between pt-4">
            <UButton
              variant="ghost"
              color="error"
              icon="i-lucide-trash-2"
              @click="handleDeleteDate"
            >
              Deletar Data
            </UButton>
            <UButton
              color="primary"
              icon="i-lucide-plus"
              @click="handleAddTeams"
            >
              Adicionar Times
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { useUserStore } from "~/stores/user";
import { useBloodbankStore } from "~/stores/bloodbank";
import type { AvailableDate, Team } from "~/stores/bloodbank";
import { formatDateToYYYYMMDD, getMonthName } from "~/utils/dateHelpers";
import { CalendarDate } from "@internationalized/date";

// Define page meta
definePageMeta({
  layout: "default",
});

// Get route params
const route = useRoute();

// Initialize stores
const userStore = useUserStore();
const bloodbankStore = useBloodbankStore();
const { teams, availableDates, isLoadingAvailableDates, bloodbank } =
  storeToRefs(bloodbankStore);

// Timezone do banco de sangue (padrão America/Sao_Paulo)
const bloodBankTimezone = computed(
  () => bloodbank.value?.timezone || "America/Sao_Paulo"
);

// State
const selectedDate = ref<CalendarDate | null>(null);
const showCreateModal = ref(false);
const showDetailModal = ref(false);
const selectedAvailableDate = ref<AvailableDate | null>(null);
const isSubmitting = ref(false);
const isUpdating = ref(false);
const isInitialized = ref(false);

// Form state for create modal
const formState = ref({
  date: null as CalendarDate | null,
  isAllTeams: true,
  selectedTeamIds: [] as string[],
  teamTimes: {} as Record<string, { startTime: string; endTime: string }>,
  timeConfig: "global" as "global" | "individual",
  globalStartTime: "08:00",
  globalEndTime: "17:00",
  individualTimes: [] as Array<{ startTime: string; endTime: string }>,
});

// Computed
const currentBloodBankRole = computed(() => userStore.currentBloodBankRole);
const bloodBanksLocationId = computed(
  () => currentBloodBankRole.value?.bloodBanksLocationId
);

// Watch teams to initialize team times
watch(
  teams,
  (newTeams) => {
    if (newTeams.length > 0) {
      const teamTimes: Record<string, { startTime: string; endTime: string }> =
        {};
      newTeams.forEach((team) => {
        teamTimes[team._id] = {
          startTime: "08:00",
          endTime: "17:00",
        };
      });
      formState.value.teamTimes = teamTimes;
    }
  },
  { immediate: true }
);

const isLoading = computed(() => isLoadingAvailableDates.value);

const currentCalendarDate = computed(() => {
  const now = new Date();
  return new CalendarDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
});

// Computed for form
const teamOptions = computed(() => {
  return teams.value.map((team) => ({
    label: team.name,
    value: team._id,
  }));
});

const canSubmit = computed(() => {
  if (!formState.value.date) return false;

  if (
    !formState.value.isAllTeams &&
    formState.value.selectedTeamIds.length === 0
  ) {
    return false;
  }

  if (formState.value.isAllTeams) {
    return formState.value.globalStartTime && formState.value.globalEndTime;
  }

  // Verificar se todos os times selecionados têm horários definidos
  return formState.value.selectedTeamIds.every((teamId) => {
    const teamTime = formState.value.teamTimes[teamId];
    return teamTime?.startTime && teamTime?.endTime;
  });
});

// Methods
const loadCalendarData = async () => {
  if (!bloodBanksLocationId.value) return;

  try {
    const now = new Date();
    // Carregar times e datas disponíveis em paralelo
    await Promise.all([
      bloodbankStore.loadTeams(bloodBanksLocationId.value, false),
      bloodbankStore.loadAvailableDates(
        bloodBanksLocationId.value,
        now.getFullYear(),
        now.getMonth()
      ),
    ]);
  } catch (error) {
    console.error("Error loading calendar data:", error);
    useToast().add({
      title: "Erro ao carregar calendário",
      description: "Tente novamente mais tarde.",
      color: "error",
    });
  }
};

const handleDateSelect = (date: CalendarDate | null) => {
  if (!date || !isInitialized.value) return;

  // Converter CalendarDate para Date
  const jsDate = new Date(date.year, date.month - 1, date.day);
  const dateStr = formatDateToYYYYMMDD(jsDate);
  const availableDate = bloodbankStore.getAvailableDateByDate(dateStr);

  if (availableDate) {
    // Abrir modal de detalhes
    selectedAvailableDate.value = availableDate;
    showDetailModal.value = true;
  } else {
    // Abrir modal de criação
    selectedDate.value = date;
    formState.value.date = date;
    showCreateModal.value = true;
  }
};

const handleCreateDate = () => {
  // Abrir modal de criação manualmente
  showCreateModal.value = true;
  formState.value.date = selectedDate.value || currentCalendarDate.value;
  // Resetar o form para valores padrão
  resetForm();
  formState.value.date = selectedDate.value || currentCalendarDate.value;
};

const handleCreateDateSubmit = async () => {
  if (!bloodBanksLocationId.value || !canSubmit.value) return;

  isSubmitting.value = true;

  try {
    // Converter CalendarDate para string no formato YYYY-MM-DD
    const dateStr = `${formState.value.date!.year}-${String(
      formState.value.date!.month
    ).padStart(2, "0")}-${String(formState.value.date!.day).padStart(2, "0")}`;

    // Construir payload baseado na configuração
    const payload: any = {
      date: dateStr,
      isAllTeams: formState.value.isAllTeams,
      slotsConfig: {
        type: formState.value.timeConfig,
      },
    };

    if (formState.value.isAllTeams) {
      // Para todos os times, usar horário global
      payload.slotsConfig.globalStartTime = formState.value.globalStartTime;
      payload.slotsConfig.globalEndTime = formState.value.globalEndTime;
    } else {
      payload.slotsConfig.teamIds = formState.value.selectedTeamIds;

      if (formState.value.timeConfig === "global") {
        payload.slotsConfig.globalStartTime = formState.value.globalStartTime;
        payload.slotsConfig.globalEndTime = formState.value.globalEndTime;
      } else {
        // Horários individuais - usar os horários definidos para cada equipe
        payload.slotsConfig.slots = formState.value.selectedTeamIds.map(
          (teamId) => ({
            teamId,
            startTime: formState.value.teamTimes[teamId]?.startTime || "08:00",
            endTime: formState.value.teamTimes[teamId]?.endTime || "17:00",
          })
        );
      }
    }

    await bloodbankStore.createAvailableDate(
      bloodBanksLocationId.value,
      payload
    );

    useToast().add({
      title: "Data criada com sucesso!",
      description: `Disponibilidade adicionada ao calendário.`,
      color: "success",
    });

    showCreateModal.value = false;
    resetForm();
  } catch (error: any) {
    console.error("Error creating available date:", error);
    useToast().add({
      title: "Erro ao criar data",
      description: error.message || "Tente novamente mais tarde.",
      color: "error",
    });
  } finally {
    isSubmitting.value = false;
  }
};

const handleSlotUpdate = async (slotId: string, updates: any) => {
  if (!bloodBanksLocationId.value || !selectedAvailableDate.value) return;

  try {
    await bloodbankStore.updateSlot(
      bloodBanksLocationId.value,
      selectedAvailableDate.value._id,
      slotId,
      updates
    );

    useToast().add({
      title: "Slot atualizado!",
      description: "As alterações foram salvas.",
      color: "success",
    });
  } catch (error: any) {
    console.error("Error updating slot:", error);
    useToast().add({
      title: "Erro ao atualizar slot",
      description: error.message || "Tente novamente mais tarde.",
      color: "error",
    });
  }
};

const handleTeamsAdded = async (
  availableDateId: string,
  teamIds: string[],
  times: any
) => {
  if (!bloodBanksLocationId.value) return;

  try {
    await bloodbankStore.addTeamsToDate(
      bloodBanksLocationId.value,
      availableDateId,
      teamIds,
      times
    );

    useToast().add({
      title: "Times adicionados!",
      description: `${teamIds.length} time(s) foram adicionados à data.`,
      color: "success",
    });
  } catch (error: any) {
    console.error("Error adding teams to date:", error);
    useToast().add({
      title: "Erro ao adicionar times",
      description: error.message || "Tente novamente mais tarde.",
      color: "error",
    });
  }
};

const handleSlotRemoved = async (availableDateId: string, slotId: string) => {
  if (!bloodBanksLocationId.value) return;

  try {
    await bloodbankStore.removeSlotFromDate(
      bloodBanksLocationId.value,
      availableDateId,
      slotId
    );

    useToast().add({
      title: "Time removido!",
      description: "O time foi removido da data.",
      color: "success",
    });
  } catch (error: any) {
    console.error("Error removing slot:", error);
    useToast().add({
      title: "Erro ao remover time",
      description: error.message || "Tente novamente mais tarde.",
      color: "error",
    });
  }
};

const handleDateDeleted = async (availableDateId: string) => {
  if (!bloodBanksLocationId.value) return;

  try {
    await bloodbankStore.deleteAvailableDate(
      bloodBanksLocationId.value,
      availableDateId
    );

    useToast().add({
      title: "Data deletada!",
      description: "A data foi removida do calendário.",
      color: "success",
    });

    showDetailModal.value = false;
    selectedAvailableDate.value = null;
  } catch (error: any) {
    console.error("Error deleting available date:", error);
    useToast().add({
      title: "Erro ao deletar data",
      description: error.message || "Tente novamente mais tarde.",
      color: "error",
    });
  }
};

// Helper methods
const toggleTeamSelection = (teamId: string, checked: boolean) => {
  if (checked) {
    if (!formState.value.selectedTeamIds.includes(teamId)) {
      formState.value.selectedTeamIds.push(teamId);
    }
  } else {
    formState.value.selectedTeamIds = formState.value.selectedTeamIds.filter(
      (id) => id !== teamId
    );
  }
};

const updateTeamTime = (
  teamId: string,
  field: "startTime" | "endTime",
  value: string
) => {
  if (!formState.value.teamTimes[teamId]) {
    formState.value.teamTimes[teamId] = {
      startTime: "08:00",
      endTime: "17:00",
    };
  }
  formState.value.teamTimes[teamId][field] = value;
};

const resetForm = () => {
  formState.value = {
    date: null,
    isAllTeams: true,
    selectedTeamIds: [],
    teamTimes: {},
    timeConfig: "global",
    globalStartTime: "08:00",
    globalEndTime: "17:00",
    individualTimes: [],
  };
};

const getTeamName = (teamId: string) => {
  const team = teams.value.find((t) => t._id === teamId);
  return team?.name || "Time não encontrado";
};

const getTeamColor = (teamId: string) => {
  const team = teams.value.find((t) => t._id === teamId);
  return team?.color || "#6b7280";
};

const formatTimeRange = (startTime: Date, endTime: Date) => {
  const formatTime = (date: Date) =>
    date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${formatTime(startTime)} – ${formatTime(endTime)}`;
};

const handleRemoveSlot = async (slot: any) => {
  if (!bloodBanksLocationId.value || !selectedAvailableDate.value) return;

  try {
    await bloodbankStore.removeSlotFromDate(
      bloodBanksLocationId.value,
      selectedAvailableDate.value._id,
      slot._id
    );

    useToast().add({
      title: "Time removido!",
      description: "O time foi removido da data.",
      color: "success",
    });
  } catch (error: any) {
    console.error("Error removing slot:", error);
    useToast().add({
      title: "Erro ao remover time",
      description: error.message || "Tente novamente mais tarde.",
      color: "error",
    });
  }
};

const handleDeleteDate = async () => {
  if (!bloodBanksLocationId.value || !selectedAvailableDate.value) return;

  try {
    await bloodbankStore.deleteAvailableDate(
      bloodBanksLocationId.value,
      selectedAvailableDate.value._id
    );

    useToast().add({
      title: "Data deletada!",
      description: "A data foi removida do calendário.",
      color: "success",
    });

    showDetailModal.value = false;
    selectedAvailableDate.value = null;
  } catch (error: any) {
    console.error("Error deleting available date:", error);
    useToast().add({
      title: "Erro ao deletar data",
      description: error.message || "Tente novamente mais tarde.",
      color: "error",
    });
  }
};

const handleAddTeams = () => {
  // TODO: Implementar modal para adicionar times
  console.log("Add teams functionality to be implemented");
};

// Watchers
watch(
  () => formState.value.isAllTeams,
  (newValue) => {
    if (newValue) {
      formState.value.selectedTeamIds = [];
    }
  }
);

watch(
  () => formState.value.selectedTeamIds,
  (newTeamIds) => {
    if (formState.value.timeConfig === "individual") {
      // Atualizar individualTimes baseado nos teams selecionados
      formState.value.individualTimes = newTeamIds.map(() => ({
        startTime: "08:00",
        endTime: "17:00",
      }));
    }
  }
);

// Lifecycle
onMounted(async () => {
  await loadCalendarData();
  // Marcar como inicializado após carregar os dados
  isInitialized.value = true;
  // Adicionar indicadores após carregar
  nextTick(() => {
    addAvailabilityIndicators();
  });
});

// Método para adicionar indicadores visuais de disponibilidade
const addAvailabilityIndicators = () => {
  // Remover indicadores existentes
  document
    .querySelectorAll(".availability-indicator")
    .forEach((el) => el.remove());

  availableDates.value.forEach((availableDate) => {
    const date = new Date(availableDate.date);
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();

    // Encontrar o botão da data no calendário
    const dateButton = document.querySelector(
      `button[aria-label*="${day} de ${getMonthName(month - 1)} de ${year}"]`
    );

    if (dateButton) {
      // Verificar se há slots disponíveis (não bloqueados)
      const hasAvailableSlots = availableDate.slots.some(
        (slot) => !slot.locked
      );

      // Criar indicador visual
      const indicator = document.createElement("div");
      indicator.className = "availability-indicator";
      indicator.style.cssText = `
        position: absolute;
        bottom: 2px;
        left: 50%;
        transform: translateX(-50%);
        width: 8px;
        height: 8px;
        border-radius: 50%;
        z-index: 10;
        ${
          hasAvailableSlots
            ? "background-color: #10b981; box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2); animation: pulse-availability 2s infinite;"
            : "background-color: #ef4444; box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.2);"
        }
      `;

      // Adicionar tooltip
      indicator.title = hasAvailableSlots
        ? `Disponível - ${availableDate.slots.length} time(s)`
        : "Indisponível - Todos os slots bloqueados";

      // Posicionar o indicador
      const buttonContainer = dateButton.closest(
        ".calendar-cell"
      ) as HTMLElement;
      if (buttonContainer) {
        buttonContainer.style.position = "relative";
        buttonContainer.appendChild(indicator);
      }
    }
  });
};

// Watcher para atualizar indicadores quando availableDates mudar
watch(
  availableDates,
  () => {
    nextTick(() => {
      addAvailabilityIndicators();
    });
  },
  { deep: true }
);
</script>

<style scoped>
/* Estilizar datas do passado com cor mais cinza */
.calendar-past-dates :deep(.calendar-cell button) {
  transition: all 0.2s ease;
}

/* Aplicar estilo para datas do passado baseado no aria-label */
.calendar-past-dates :deep(.calendar-cell button[aria-label*="setembro"]),
.calendar-past-dates :deep(.calendar-cell button[aria-label*="agosto"]),
.calendar-past-dates :deep(.calendar-cell button[aria-label*="julho"]),
.calendar-past-dates :deep(.calendar-cell button[aria-label*="junho"]),
.calendar-past-dates :deep(.calendar-cell button[aria-label*="maio"]),
.calendar-past-dates :deep(.calendar-cell button[aria-label*="abril"]),
.calendar-past-dates :deep(.calendar-cell button[aria-label*="março"]),
.calendar-past-dates :deep(.calendar-cell button[aria-label*="fevereiro"]),
.calendar-past-dates :deep(.calendar-cell button[aria-label*="janeiro"]) {
  color: #9ca3af !important;
  background-color: #f3f4f6 !important;
  opacity: 0.7;
}

/* Manter estilo normal para o mês atual */
.calendar-past-dates :deep(.calendar-cell button[aria-label*="outubro"]) {
  color: #374151 !important;
  background-color: transparent !important;
  opacity: 1;
}

/* Estilos para indicadores de disponibilidade */
.calendar-with-availability :deep(.calendar-cell) {
  position: relative;
}

/* Garantir que os indicadores fiquem visíveis */
.calendar-with-availability :deep(.calendar-cell button) {
  position: relative;
  z-index: 1;
}

/* Animação para indicador de disponibilidade */
@keyframes pulse-availability {
  0%,
  100% {
    transform: translateX(-50%) scale(1);
    opacity: 1;
  }
  50% {
    transform: translateX(-50%) scale(1.1);
    opacity: 0.8;
  }
}
</style>
