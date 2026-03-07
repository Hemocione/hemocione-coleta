<template>
  <div class="flex flex-col gap-8">
    <!-- Calendário -->
    <UCard>
      <div class="p-8">
        <UCalendar
          v-model="selectedDate as CalendarDate | null"
          :default-value="currentCalendarDate"
          class="w-full calendar-past-dates calendar-with-availability"
          :is-date-unavailable="(day) => isDateUnavailable(day)"
          :year-controls="false"
        >
          <template #day="{ day }">
            <div v-if="isLoading" class="flex items-center justify-center">
              <USpinner />
            </div>
            <UChip
              v-else
              :show="!!getAvailabilityColor(day)"
              :color="getAvailabilityColor(day)"
              size="xs"
            >
              {{ day.day }}
            </UChip>
          </template>
        </UCalendar>

        <!-- Legenda -->
        <div class="flex items-center justify-center gap-4 mt-4 text-xs text-gray-500">
          <div class="flex items-center gap-1">
            <span class="inline-block w-2 h-2 rounded-full bg-green-500" />
            <span>Disponível</span>
          </div>
          <div class="flex items-center gap-1">
            <span class="inline-block w-2 h-2 rounded-full bg-yellow-500" />
            <span>Parcialmente bloqueado</span>
          </div>
          <div class="flex items-center gap-1">
            <span class="inline-block w-2 h-2 rounded-full bg-red-500" />
            <span>Totalmente bloqueado</span>
          </div>
        </div>
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
              v-model="formState.date as any"
              :default-value="selectedDate as any"
              :min-value="currentCalendarDate as any"
              size="lg"
            />
          </UFormField>

          <!-- Todas as equipes -->
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
                        (checked) =>
                          toggleTeamSelection(
                            team._id,
                            checked === 'indeterminate' ? false : checked
                          )
                      "
                      :disabled="formState.isAllTeams"
                      class="shrink-0"
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
          ? `Detalhes da Data: ${formatDateToYYYYMMDD(
              selectedAvailableDate.date
            )}`
          : 'Detalhes da Data'
      "
    >
      <template #body>
        <div v-if="selectedAvailableDate" class="space-y-6">
          <!-- Informações da data (DEBUG)-->
          <!-- <div class="bg-gray-50 rounded-lg p-4">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm text-gray-600">Data</p>
                <p class="font-semibold">
                  {{ formatDateToYYYYMMDD(selectedAvailableDate.date) }}
                </p>
              </div>
              <div>
                <p class="text-sm text-gray-600">Equipes</p>
                <p class="font-semibold">
                  {{ selectedAvailableDate.slots.length }} equipe(s)
                </p>
              </div>
              <div>
                <p class="text-sm text-gray-600">Tipo</p>
                <p class="font-semibold">
                  {{
                    selectedAvailableDate.isAllTeams
                      ? "Todas as equipes"
                      : "Individual"
                  }}
                </p>
              </div>
            </div>
          </div> -->

          <!-- Lista de slots -->
          <div class="space-y-2">
            <h4 class="font-medium text-gray-900 text-sm">
              Equipes e Horários
            </h4>
            <div
              v-for="slot in selectedAvailableDate.slots"
              :key="slot._id"
              class="border rounded-md p-3 relative"
              :style="{
                borderColor: getTeamColor(slot.teamId),
                backgroundColor: `${getTeamColor(slot.teamId)}10`,
              }"
            >
              <!-- Badge e botão posicionados no canto superior direito -->
              <div class="absolute top-2 right-2 flex items-center space-x-2">
                <UBadge
                  :color="slot.locked || slot.lockedBy ? 'error' : 'success'"
                  variant="subtle"
                  size="xs"
                >
                  {{ slot.locked || slot.lockedBy ? "Bloqueado" : "Disponível" }}
                </UBadge>
                <UButton
                  v-if="
                    !selectedAvailableDate.isAllTeams &&
                    selectedAvailableDate.slots.length > 1
                  "
                  variant="ghost"
                  size="xs"
                  color="error"
                  icon="i-lucide-trash-2"
                  :disabled="slot.locked || !!slot.lockedBy || isUpdating"
                  @click="handleRemoveSlot(slot)"
                >
                  Remover
                </UButton>
              </div>

              <div class="pr-24">
                <p
                  class="font-medium text-sm"
                  :style="{ color: getTeamColor(slot.teamId) }"
                >
                  {{ getTeamName(slot.teamId) }}
                </p>
                <div class="flex items-center space-x-2 mt-1">
                  <UInput
                    :model-value="editingTimes[slot._id]?.startTime"
                    @update:model-value="
                      (value) => updateEditingTime(slot._id, 'startTime', value)
                    "
                    type="time"
                    size="xs"
                    class="w-20"
                    :disabled="slot.locked || !!slot.lockedBy"
                    @input="markSlotAsChanged(slot._id)"
                  />
                  <span class="text-xs text-gray-400">–</span>
                  <UInput
                    :model-value="editingTimes[slot._id]?.endTime"
                    @update:model-value="
                      (value) => updateEditingTime(slot._id, 'endTime', value)
                    "
                    type="time"
                    size="xs"
                    class="w-20"
                    :disabled="slot.locked || !!slot.lockedBy"
                    @input="markSlotAsChanged(slot._id)"
                  />
                  <UButton
                    v-if="changedSlots.includes(slot._id)"
                    size="xs"
                    color="primary"
                    icon="i-lucide-check"
                    @click="saveSlotTime(slot._id)"
                    :loading="savingSlots.includes(slot._id)"
                  >
                    Salvar
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
            <div class="flex space-x-2">
              <UButton
                v-if="!selectedAvailableDate.isAllTeams"
                color="primary"
                icon="i-lucide-plus"
                @click="handleAddTeams"
              >
                Adicionar Equipes
              </UButton>
            </div>
          </div>
        </div>
      </template>
    </UModal>

    <!-- Add Teams Modal -->
    <UModal v-model:open="showAddTeamsModal" title="Adicionar Equipes">
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
                <p class="text-sm text-gray-600">Equipes atuais</p>
                <p class="font-semibold">
                  {{ selectedAvailableDate.slots.length }} equipe(s)
                </p>
              </div>
            </div>
          </div>

          <!-- Lista de equipes disponíveis -->
          <UFormField label="Selecionar Equipes">
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
                  :id="`add-team-${team._id}`"
                  :model-value="
                    addTeamsFormState.selectedTeamIds.includes(team._id)
                  "
                  @update:model-value="
                    (checked) =>
                      toggleAddTeamSelection(
                        team._id,
                        checked === 'indeterminate' ? false : checked
                      )
                  "
                  class="shrink-0"
                />

                <!-- Nome da equipe -->
                <label
                  :for="`add-team-${team._id}`"
                  class="flex-1 font-medium text-sm cursor-pointer"
                  :style="{ color: team.color }"
                >
                  {{ team.name }}
                </label>

                <!-- Horários da equipe -->
                <div class="flex items-center space-x-2">
                  <div class="flex items-center space-x-1">
                    <label class="text-xs text-gray-600">Início:</label>
                    <UInput
                      :model-value="
                        addTeamsFormState.teamTimes[team._id]?.startTime
                      "
                      @update:model-value="
                        (value) =>
                          updateAddTeamTime(team._id, 'startTime', value)
                      "
                      type="time"
                      size="sm"
                      class="w-24"
                      :disabled="
                        !addTeamsFormState.selectedTeamIds.includes(team._id)
                      "
                    />
                  </div>
                  <div class="flex items-center space-x-1">
                    <label class="text-xs text-gray-600">Fim:</label>
                    <UInput
                      :model-value="
                        addTeamsFormState.teamTimes[team._id]?.endTime
                      "
                      @update:model-value="
                        (value) => updateAddTeamTime(team._id, 'endTime', value)
                      "
                      type="time"
                      size="sm"
                      class="w-24"
                      :disabled="
                        !addTeamsFormState.selectedTeamIds.includes(team._id)
                      "
                    />
                  </div>
                </div>
              </div>
            </div>
          </UFormField>
        </div>
      </template>

      <template #footer="{ close }">
        <div class="flex justify-end space-x-3">
          <UButton variant="ghost" @click="close" :disabled="isSubmitting">
            Cancelar
          </UButton>
          <UButton
            color="primary"
            :loading="isSubmitting"
            :disabled="!canSubmitAddTeams"
            @click="handleAddTeamsSubmit"
          >
            {{ isSubmitting ? "Adicionando..." : "Adicionar Equipes" }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { useUserStore } from "~/stores/user";
import { useBloodbankStore } from "~/stores/bloodbank";
import type { AvailableDate } from "~/stores/bloodbank";
import { formatDateToYYYYMMDD } from "~/utils/dateHelpers";
import { CalendarDate, type DateValue } from "@internationalized/date";

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
const selectedDate = ref<DateValue | null>(null);
const showCreateModal = ref(false);
const showDetailModal = ref(false);
const showAddTeamsModal = ref(false);
const selectedAvailableDate = ref<AvailableDate | null>(null);
const isSubmitting = ref(false);
const isUpdating = ref(false);
const isInitialized = ref(false);

// Edição de horários
const editingTimes = ref<
  Record<string, { startTime: string; endTime: string }>
>({});
const changedSlots = ref<string[]>([]);
const savingSlots = ref<string[]>([]);

// Form state for create modal
const formState = ref({
  date: null as CalendarDate | null,
  isAllTeams: true,
  selectedTeamIds: [] as string[],
  teamTimes: {} as Record<string, { startTime: string; endTime: string }>,
  globalStartTime: "08:00",
  globalEndTime: "17:00",
});

// Form state for add teams modal
const addTeamsFormState = ref({
  selectedTeamIds: [] as string[],
  teamTimes: {} as Record<string, { startTime: string; endTime: string }>,
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

// Watch for selectedDate changes and handle date selection
watch(selectedDate, (newDate, oldDate) => {
  if (newDate && newDate !== oldDate && isInitialized.value) {
    handleDateSelect(newDate as CalendarDate);
  } else if (!newDate && oldDate && isInitialized.value) {
    // If the selection was cleared, restore it if it had availability
    const jsDate = new Date(oldDate.year, oldDate.month - 1, oldDate.day);
    const dateStr = formatDateToYYYYMMDD(jsDate);
    const availableDate = bloodbankStore.getAvailableDateByDate(dateStr);

    if (availableDate) {
      // Restore the selection for dates with availability
      selectedDate.value = oldDate as CalendarDate;
    }
  }
});

// Inicializar horários de edição quando modal abre
watch(showDetailModal, (isOpen) => {
  if (isOpen && selectedAvailableDate.value) {
    initializeEditingTimes();
  }
});

const isLoading = computed(
  () => isLoadingAvailableDates.value && !isInitialized.value
);

const currentCalendarDate = computed<CalendarDate>((): CalendarDate => {
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

const canSubmitAddTeams = computed(() => {
  if (addTeamsFormState.value.selectedTeamIds.length === 0) return false;

  // Verificar se todos os times selecionados têm horários definidos
  return addTeamsFormState.value.selectedTeamIds.every((teamId) => {
    const teamTime = addTeamsFormState.value.teamTimes[teamId];
    return teamTime?.startTime && teamTime?.endTime;
  });
});

// Methods
const loadCalendarData = async () => {
  if (!bloodBanksLocationId.value) return;

  try {
    const now = new Date();
    // Carregar equipes e datas disponíveis em paralelo
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
  console.log("date selected", date);
  if (!date || !isInitialized.value) return;

  // Converter CalendarDate para Date
  const jsDate = new Date(date.year, date.month - 1, date.day);
  const dateStr = formatDateToYYYYMMDD(jsDate);
  const availableDate = bloodbankStore.getAvailableDateByDate(dateStr);

  if (availableDate) {
    // Abrir modal de detalhes - não modificar selectedDate aqui
    selectedAvailableDate.value = availableDate;
    showDetailModal.value = true;
  } else {
    // Abrir modal de criação - selectedDate já está definido pelo v-model
    formState.value.date = date;
    showCreateModal.value = true;
  }
};

const handleCreateDate = () => {
  // Abrir modal de criação manualmente
  showCreateModal.value = true;
  // Resetar o form para valores padrão
  resetForm();
  // Não definir uma data padrão - deixar o usuário escolher
  formState.value.date = null;
};

const handleCreateDateSubmit = async () => {
  if (!bloodBanksLocationId.value || !canSubmit.value) return;

  // Verificar se a data já possui disponibilidade
  const dateStr = `${formState.value.date!.year}-${String(
    formState.value.date!.month
  ).padStart(2, "0")}-${String(formState.value.date!.day).padStart(2, "0")}`;

  const existingDate = bloodbankStore.getAvailableDateByDate(dateStr);
  if (existingDate) {
    useToast().add({
      title: "Data já possui disponibilidade",
      description: "Esta data já possui slots de disponibilidade cadastrados.",
      color: "warning",
    });
    return;
  }

  isSubmitting.value = true;

  try {
    // Construir payload baseado na configuração
    const payload: any = {
      date: dateStr,
      isAllTeams: formState.value.isAllTeams,
      slotsConfig: {
        type: formState.value.isAllTeams ? "global" : "individual",
      },
    };

    if (formState.value.isAllTeams) {
      // Para todas as equipes, usar horário global
      payload.slotsConfig.globalStartTime = formState.value.globalStartTime;
      payload.slotsConfig.globalEndTime = formState.value.globalEndTime;
    } else {
      // Horários individuais - usar os horários definidos para cada equipe
      payload.slotsConfig.teamIds = formState.value.selectedTeamIds;
      payload.slotsConfig.slots = formState.value.selectedTeamIds.map(
        (teamId) => ({
          teamId,
          startTime: formState.value.teamTimes[teamId]?.startTime || "08:00",
          endTime: formState.value.teamTimes[teamId]?.endTime || "17:00",
        })
      );
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
      title: "Equipes adicionadas!",
      description: `${teamIds.length} equipe(s) foram adicionadas à data.`,
      color: "success",
    });
  } catch (error: any) {
    console.error("Error adding teams to date:", error);
    useToast().add({
      title: "Erro ao adicionar equipes",
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
      title: "Equipe removida!",
      description: "A equipe foi removida da data.",
      color: "success",
    });
  } catch (error: any) {
    console.error("Error removing slot:", error);
    useToast().add({
      title: "Erro ao remover equipe",
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

const toggleAddTeamSelection = (teamId: string, checked: boolean) => {
  if (checked) {
    if (!addTeamsFormState.value.selectedTeamIds.includes(teamId)) {
      addTeamsFormState.value.selectedTeamIds.push(teamId);
    }
  } else {
    addTeamsFormState.value.selectedTeamIds =
      addTeamsFormState.value.selectedTeamIds.filter((id) => id !== teamId);
  }
};

const updateAddTeamTime = (
  teamId: string,
  field: "startTime" | "endTime",
  value: string
) => {
  if (!addTeamsFormState.value.teamTimes[teamId]) {
    addTeamsFormState.value.teamTimes[teamId] = {
      startTime: "08:00",
      endTime: "17:00",
    };
  }
  addTeamsFormState.value.teamTimes[teamId][field] = value;
};

const resetForm = () => {
  formState.value = {
    date: null,
    isAllTeams: true,
    selectedTeamIds: [],
    teamTimes: {},
    globalStartTime: "08:00",
    globalEndTime: "17:00",
  };
};

const resetAddTeamsForm = () => {
  addTeamsFormState.value = {
    selectedTeamIds: [],
    teamTimes: {},
  };

  // Inicializar horários para todas as equipes
  const teamTimes: Record<string, { startTime: string; endTime: string }> = {};
  teams.value.forEach((team) => {
    teamTimes[team._id] = {
      startTime: "08:00",
      endTime: "17:00",
    };
  });
  addTeamsFormState.value.teamTimes = teamTimes;
};

const getTeamName = (teamId: string) => {
  const team = teams.value.find((t) => t._id === teamId);
  return team?.name || "Equipe não encontrada";
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

const formatTimeForInput = (date: Date) => {
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

const initializeEditingTimes = () => {
  if (!selectedAvailableDate.value) return;

  const times: Record<string, { startTime: string; endTime: string }> = {};
  selectedAvailableDate.value.slots.forEach((slot) => {
    times[slot._id] = {
      startTime: formatTimeForInput(slot.startTime),
      endTime: formatTimeForInput(slot.endTime),
    };
  });

  editingTimes.value = times;
  changedSlots.value = [];
  savingSlots.value = [];
};

const updateEditingTime = (
  slotId: string,
  field: "startTime" | "endTime",
  value: string
) => {
  if (!editingTimes.value[slotId]) {
    editingTimes.value[slotId] = { startTime: "", endTime: "" };
  }
  editingTimes.value[slotId][field] = value;
};

const markSlotAsChanged = (slotId: string) => {
  if (!changedSlots.value.includes(slotId)) {
    changedSlots.value.push(slotId);
  }
};

const saveSlotTime = async (slotId: string) => {
  if (!bloodBanksLocationId.value || !selectedAvailableDate.value) return;

  savingSlots.value.push(slotId);

  try {
    const editingTime = editingTimes.value[slotId];
    if (!editingTime) return;

    // Converter strings HH:MM para Date
    const [startHours, startMinutes] = editingTime.startTime
      .split(":")
      .map(Number);
    const [endHours, endMinutes] = editingTime.endTime.split(":").map(Number);

    const startTime = new Date();
    startTime.setHours(startHours, startMinutes, 0, 0);

    const endTime = new Date();
    endTime.setHours(endHours, endMinutes, 0, 0);

    const updates = {
      startTime: editingTime.startTime,
      endTime: editingTime.endTime,
    };

    // A migração automática agora é feita diretamente na API
    const updatedDate = await bloodbankStore.updateSlot(
      bloodBanksLocationId.value,
      selectedAvailableDate.value._id,
      slotId,
      updates
    );

    // Atualizar o selectedAvailableDate com os dados retornados
    if (updatedDate) {
      selectedAvailableDate.value = {
        ...updatedDate,
        deletedAt: updatedDate.deletedAt
          ? new Date(updatedDate.deletedAt)
          : undefined,
        createdAt: new Date(updatedDate.createdAt),
        updatedAt: new Date(updatedDate.updatedAt),
        slots: updatedDate.slots.map((slot: any) => ({
          ...slot,
          startTime: new Date(slot.startTime),
          endTime: new Date(slot.endTime),
        })),
      };

      // Atualizar o editingTimes apenas para o slot que foi alterado
      const updatedSlot = selectedAvailableDate.value.slots.find(
        (s) => s._id === slotId
      );
      if (updatedSlot) {
        editingTimes.value[slotId] = {
          startTime: formatTimeForInput(updatedSlot.startTime),
          endTime: formatTimeForInput(updatedSlot.endTime),
        };
      }
    }

    // Remover da lista de slots alterados
    changedSlots.value = changedSlots.value.filter((id) => id !== slotId);

    useToast().add({
      title: "Horário atualizado!",
      description: "O horário da equipe foi atualizado com sucesso.",
      color: "success",
    });
  } catch (error: any) {
    console.error("Error updating slot time:", error);
    useToast().add({
      title: "Erro ao atualizar horário",
      description: error.message || "Tente novamente mais tarde.",
      color: "error",
    });
  } finally {
    savingSlots.value = savingSlots.value.filter((id) => id !== slotId);
  }
};

const handleRemoveSlot = async (slot: any) => {
  if (!bloodBanksLocationId.value || !selectedAvailableDate.value) return;

  try {
    // A migração automática agora é feita diretamente na API
    const updatedDate = await bloodbankStore.removeSlotFromDate(
      bloodBanksLocationId.value,
      selectedAvailableDate.value._id,
      slot._id
    );

    // Atualizar o selectedAvailableDate com os dados retornados
    if (updatedDate) {
      selectedAvailableDate.value = {
        ...updatedDate,
        deletedAt: updatedDate.deletedAt
          ? new Date(updatedDate.deletedAt)
          : undefined,
        createdAt: new Date(updatedDate.createdAt),
        updatedAt: new Date(updatedDate.updatedAt),
        slots: updatedDate.slots.map((slot: any) => ({
          ...slot,
          startTime: new Date(slot.startTime),
          endTime: new Date(slot.endTime),
        })),
      };
    }

    useToast().add({
      title: "Equipe removida!",
      description: "A equipe foi removida da data.",
      color: "success",
    });
  } catch (error: any) {
    console.error("Error removing slot:", error);
    useToast().add({
      title: "Erro ao remover equipe",
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
  showAddTeamsModal.value = true;
  resetAddTeamsForm();
};

const handleAddTeamsSubmit = async () => {
  if (
    !bloodBanksLocationId.value ||
    !selectedAvailableDate.value ||
    addTeamsFormState.value.selectedTeamIds.length === 0
  )
    return;

  isSubmitting.value = true;

  try {
    // Filtrar equipes que ainda não estão na data
    const existingTeamIds = selectedAvailableDate.value.slots.map(
      (slot) => slot.teamId
    );
    const newTeamIds = addTeamsFormState.value.selectedTeamIds.filter(
      (teamId) => !existingTeamIds.includes(teamId)
    );

    if (newTeamIds.length === 0) {
      useToast().add({
        title: "Nenhuma equipe nova",
        description: "Todas as equipes selecionadas já estão nesta data.",
        color: "warning",
      });
      return;
    }

    // Usar horários padrão (primeira equipe selecionada ou padrão)
    const firstTeamId = newTeamIds[0];
    const defaultTimes = {
      defaultStartTime:
        addTeamsFormState.value.teamTimes[firstTeamId]?.startTime || "08:00",
      defaultEndTime:
        addTeamsFormState.value.teamTimes[firstTeamId]?.endTime || "17:00",
    };

    await bloodbankStore.addTeamsToDate(
      bloodBanksLocationId.value,
      selectedAvailableDate.value._id,
      newTeamIds,
      defaultTimes
    );

    useToast().add({
      title: "Equipes adicionadas!",
      description: `${newTeamIds.length} equipe(s) foram adicionadas à data.`,
      color: "success",
    });

    showAddTeamsModal.value = false;
    resetAddTeamsForm();
  } catch (error: any) {
    console.error("Error adding teams:", error);
    useToast().add({
      title: "Erro ao adicionar equipes",
      description: error.message || "Tente novamente mais tarde.",
      color: "error",
    });
  } finally {
    isSubmitting.value = false;
  }
};

// Helper to format CalendarDate to YYYY-MM-DD string
const formatCalendarDateToYYYYMMDD = (calendarDate: any) => {
  return `${calendarDate.year}-${String(calendarDate.month).padStart(
    2,
    "0"
  )}-${String(calendarDate.day).padStart(2, "0")}`;
};

const dayAvailabilityColorMap = ref({});
const visibleDates = computed(() => {
  return availableDates.value.map((ad) => ad.date);
});
const isDateUnavailable = (day: DateValue) => {
  // disable dates that are in the past (considerando ano, mês e dia)
  const today = currentCalendarDate.value;
  if (day.year < today.year) return true;
  if (day.year === today.year && day.month < today.month) return true;
  if (
    day.year === today.year &&
    day.month === today.month &&
    day.day <= today.day
  )
    return true;
  return false;
};

// Get availability color for calendar day
const getAvailabilityColor = (
  day: DateValue
): "error" | "warning" | "success" | undefined => {
  // Don't show chips until data is loaded
  if (!isInitialized.value) {
    return undefined;
  }

  const dateStr = formatCalendarDateToYYYYMMDD(day);
  const availableDate = bloodbankStore.getAvailableDateByDate(dateStr);
  if (!availableDate || !availableDate.slots.length) {
    return undefined; // No availability data
  }

  const allSlotsLocked = availableDate.slots.every(
    (slot) => slot.locked || slot.lockedBy
  );

  if (allSlotsLocked) {
    return "error"; // All slots locked - red
  }

  const hasLockedSlots = availableDate.slots.some(
    (slot) => slot.locked || slot.lockedBy
  );

  if (hasLockedSlots) {
    return "warning"; // Some available, some locked - yellow
  }

  return "success"; // All available - green
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

// Lifecycle
onMounted(async () => {
  await loadCalendarData();
  // Marcar como inicializado após carregar os dados
  isInitialized.value = true;
});
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
</style>
