<template>
  <div class="p-6">
    <!-- Loading State -->
    <div v-if="isLoadingTeams" class="flex items-center justify-center py-12">
      <div class="text-center">
        <div
          class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"
        ></div>
        <p class="text-gray-600">Carregando times...</p>
      </div>
    </div>

    <!-- Teams List -->
    <div v-else class="space-y-3">
      <!-- Existing Teams -->
      <div
        v-for="team in teams"
        :key="team._id"
        class="group bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-all duration-200 flex items-center space-x-4"
      >
        <!-- Team Color Avatar -->
        <div class="relative">
          <div
            class="w-10 h-10 rounded-full border-2 border-gray-200 shrink-0 cursor-pointer hover:scale-110 transition-transform"
            :style="{ backgroundColor: team.color }"
            @click.stop="toggleColorPicker(team._id)"
          ></div>
          <!-- Color Picker Dropdown -->
          <div
            v-if="showColorPicker === team._id"
            class="absolute top-12 left-12 bg-white border border-gray-200 rounded-xl shadow-xl p-4 z-20 min-w-[200px]"
            @click.stop
          >
            <div class="flex items-center justify-between mb-3">
              <p class="text-sm font-semibold text-gray-800">Alterar Cor</p>
              <button
                @click="showColorPicker = null"
                class="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <UIcon name="i-lucide-x" class="w-4 h-4" />
              </button>
            </div>
            <div class="grid grid-cols-4 gap-3">
              <button
                v-for="color in TEAM_COLORS"
                :key="color.hex"
                @click="updateTeamColor(team, color.hex)"
                :class="[
                  'w-10 h-10 rounded-full border-2 transition-all duration-200 hover:scale-110 hover:shadow-md',
                  team.color === color.hex
                    ? 'border-gray-800 ring-2 ring-blue-500 shadow-lg'
                    : 'border-gray-200 hover:border-gray-300',
                ]"
                :style="{ backgroundColor: color.hex }"
                :title="color.name"
              />
            </div>
            <div class="mt-3 pt-3 border-t border-gray-100">
              <p class="text-xs text-gray-500 text-center">
                Cor atual:
                <span class="font-medium">{{ getColorName(team.color) }}</span>
              </p>
            </div>
          </div>
        </div>

        <!-- Team Name -->
        <div class="flex-1 min-w-0">
          <input
            v-if="editingTeam === team._id"
            v-model="editingName"
            @blur="saveTeamName(team)"
            @keyup.enter="saveTeamName(team)"
            @keyup.escape="cancelEdit"
            @click.stop
            :disabled="isUpdatingName"
            :maxlength="50"
            class="w-full text-lg font-semibold text-gray-900 bg-transparent border-b-2 border-blue-500 focus:outline-none disabled:opacity-50"
            ref="nameInput"
          />
          <h3
            v-else
            class="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors cursor-pointer truncate"
            @click="startEditName(team)"
            :title="team.name"
          >
            {{ team.name }}
          </h3>
        </div>

        <!-- Actions -->
        <div class="flex items-center space-x-2">
          <!-- Delete Button -->
          <UButton
            variant="ghost"
            size="sm"
            color="error"
            icon="i-lucide-trash-2"
            @click.stop="confirmDeleteTeam(team)"
            class="hover:bg-red-50"
          />
        </div>
      </div>

      <!-- Add New Team Button or Limit Message -->
      <div
        v-if="teams.length < 5"
        class="group bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-blue-400 hover:bg-blue-50 transition-all duration-200 cursor-pointer flex items-center space-x-4"
        @click="showCreateTeamModal = true"
      >
        <div
          class="w-10 h-10 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 group-hover:text-blue-500 group-hover:border-blue-400 transition-colors"
        >
          <UIcon name="i-lucide-plus" class="w-5 h-5" />
        </div>
        <h3
          class="text-lg font-semibold text-gray-500 group-hover:text-blue-600 transition-colors"
        >
          Adicionar Equipe
        </h3>
      </div>

      <!-- Limit Reached Message -->
      <div
        v-else
        class="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center space-x-4"
      >
        <div
          class="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600"
        >
          <UIcon name="i-lucide-info" class="w-5 h-5" />
        </div>
        <div>
          <h3 class="text-lg font-semibold text-amber-800">
            Limite de Equipes Atingido
          </h3>
          <p class="text-sm text-amber-700">
            Você pode ter no máximo 5 equipes. Exclua uma equipe para adicionar
            uma nova.
          </p>
        </div>
      </div>
    </div>

    <!-- Create Team Modal -->
    <UModal v-model:open="showCreateTeamModal">
      <template #content>
        <div class="p-6 flex flex-col gap-4">
          <h3 class="text-lg font-semibold">Criar Nova Equipe</h3>

          <div class="space-y-6 flex flex-col gap-1">
            <UFormField label="Nome da Equipe" required>
              <UInput
                v-model="newTeam.name"
                placeholder="Ex: Equipe Matutina"
                :disabled="isLoadingTeams"
                size="lg"
              />
            </UFormField>

            <UFormField label="Cor da Equipe" required class="mb-0">
              <div class="grid grid-cols-8 gap-3">
                <button
                  v-for="color in TEAM_COLORS"
                  :key="color.hex"
                  @click="newTeam.color = color.hex"
                  :class="[
                    'w-10 h-10 rounded-full border-2 transition-all hover:scale-110',
                    newTeam.color === color.hex
                      ? 'border-gray-800 ring-2 ring-blue-500'
                      : 'border-gray-200',
                  ]"
                  :style="{ backgroundColor: color.hex }"
                  :title="color.name"
                />
              </div>
              <p class="text-sm text-gray-500 mt-2">
                Cor selecionada:
                <strong>{{ getColorName(newTeam.color) }}</strong>
              </p>
            </UFormField>
          </div>

          <div class="flex justify-end space-x-3 mt-6">
            <UButton
              @click="showCreateTeamModal = false"
              variant="ghost"
              :disabled="isLoadingTeams"
            >
              Cancelar
            </UButton>
            <UButton
              @click="createTeam"
              color="primary"
              :loading="isLoadingTeams"
              :disabled="
                !newTeam.name?.trim() ||
                !newTeam.color ||
                isLoadingTeams ||
                teams.length >= 5
              "
            >
              Criar Equipe
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- Delete Confirmation Modal -->
    <UModal v-model:open="showDeleteModal">
      <template #content>
        <div class="p-6">
          <h3 class="text-lg font-semibold text-red-600 mb-4">
            Confirmar Exclusão
          </h3>

          <p class="text-gray-700 mb-4">
            Tem certeza que deseja excluir a equipe
            <strong>{{ teamToDelete?.name }}</strong
            >? Esta ação não pode ser desfeita.
          </p>

          <div class="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <div class="flex items-start space-x-3">
              <UIcon
                name="i-lucide-alert-triangle"
                class="w-5 h-5 text-amber-600 mt-0.5 shrink-0"
              />
              <div>
                <p class="text-sm font-medium text-amber-800 mb-1">
                  Atenção: Horários da equipe serão removidos
                </p>
                <p class="text-sm text-amber-700">
                  Todos os horários desta equipe serão removidos das datas
                  disponibilizadas. Se uma data tiver apenas esta equipe, a data
                  inteira será deletada.
                </p>
              </div>
            </div>
          </div>

          <div class="flex justify-end space-x-3">
            <UButton
              @click="showDeleteModal = false"
              variant="ghost"
              :disabled="isLoadingTeams"
            >
              Cancelar
            </UButton>
            <UButton
              @click="deleteTeam"
              color="error"
              :loading="isLoadingTeams"
            >
              Excluir Equipe
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from "vue";
import { useUserStore } from "~/stores/user";
import { useBloodbankStore } from "~/stores/bloodbank";
import { TEAM_COLORS, type TeamColor, getColorName } from "~/utils/teamColors";

// Define page meta
definePageMeta({
  layout: "default",
});

// Get route params
const route = useRoute();

// Initialize stores
const userStore = useUserStore();
const bloodbankStore = useBloodbankStore();
const { teams, isLoadingTeams, error } = storeToRefs(bloodbankStore);

// Reactive state
const showCreateTeamModal = ref(false);
const showDeleteModal = ref(false);
const showColorPicker = ref<string | null>(null);
const editingTeam = ref<string | null>(null);
const editingName = ref("");
const nameInput = ref<HTMLInputElement[]>([]);
const teamToDelete = ref<any>(null);
const isUpdatingName = ref(false);

const newTeam = ref({
  name: "",
  color: TEAM_COLORS[0].hex,
});

// Computed
const currentBloodBankRole = computed(() => userStore.currentBloodBankRole);
const bloodBanksLocationId = computed(
  () => currentBloodBankRole.value?.bloodBanksLocationId
);

// Methods
const loadTeams = async () => {
  if (!bloodBanksLocationId.value) return;

  try {
    await bloodbankStore.loadTeams(bloodBanksLocationId.value);
  } catch (error) {
    console.error("Error loading teams:", error);
  }
};

const createTeam = async () => {
  if (
    !bloodBanksLocationId.value ||
    !newTeam.value.name ||
    !newTeam.value.color
  )
    return;

  // Check team limit
  if (teams.value.length >= 5) {
    useToast().add({
      title: "Limite de equipes atingido",
      description:
        "Você pode ter no máximo 5 equipes. Exclua uma equipe para adicionar uma nova.",
      color: "error",
    });
    return;
  }

  try {
    await bloodbankStore.createTeam(
      bloodBanksLocationId.value,
      newTeam.value.name,
      newTeam.value.color
    );

    useToast().add({
      title: "Equipe criada com sucesso!",
      description: `A equipe "${newTeam.value.name}" foi criada.`,
      color: "success",
    });

    showCreateTeamModal.value = false;
    newTeam.value = { name: "", color: TEAM_COLORS[0].hex };
  } catch (error: any) {
    useToast().add({
      title: "Erro ao criar equipe",
      description: "Tente novamente mais tarde.",
      color: "error",
    });
  }
};

const startEditName = (team: any) => {
  editingTeam.value = team._id;
  editingName.value = team.name;

  nextTick(() => {
    nameInput.value[0]?.focus();
  });
};

const saveTeamName = async (team: any) => {
  if (!bloodBanksLocationId.value || editingName.value === team.name) {
    cancelEdit();
    return;
  }

  // Prevent duplicate calls
  if (editingTeam.value !== team._id || isUpdatingName.value) {
    return;
  }

  const newName = editingName.value.trim();

  // Validate name is not empty
  if (!newName) {
    useToast().add({
      title: "Nome inválido",
      description: "O nome da equipe não pode estar vazio.",
      color: "error",
    });
    return;
  }

  isUpdatingName.value = true;

  try {
    await bloodbankStore.updateTeam(bloodBanksLocationId.value, team._id, {
      name: newName,
    });

    useToast().add({
      title: "Nome atualizado!",
      description: `O nome da equipe foi alterado para "${newName}".`,
      color: "success",
    });

    cancelEdit();
  } catch (error: any) {
    useToast().add({
      title: "Erro ao atualizar nome",
      color: "error",
    });
  } finally {
    isUpdatingName.value = false;
  }
};

const cancelEdit = () => {
  editingTeam.value = null;
  editingName.value = "";
};

const toggleColorPicker = (teamId: string) => {
  showColorPicker.value = showColorPicker.value === teamId ? null : teamId;
};

const updateTeamColor = async (team: any, color: string) => {
  if (!bloodBanksLocationId.value) return;

  try {
    await bloodbankStore.updateTeam(bloodBanksLocationId.value, team._id, {
      color,
    });

    useToast().add({
      title: "Cor atualizada!",
      description: `A cor da equipe "${team.name}" foi alterada.`,
      color: "success",
    });

    // Close color picker
    showColorPicker.value = null;
  } catch (error: any) {
    useToast().add({
      title: "Erro ao atualizar cor",
      color: "error",
    });
  }
};

const confirmDeleteTeam = (team: any) => {
  teamToDelete.value = team;
  showDeleteModal.value = true;
};

const deleteTeam = async () => {
  if (!bloodBanksLocationId.value || !teamToDelete.value) return;

  try {
    await bloodbankStore.deleteTeam(
      bloodBanksLocationId.value,
      teamToDelete.value._id
    );

    useToast().add({
      title: "Equipe excluída!",
      description: `A equipe "${teamToDelete.value.name}" foi excluída.`,
      color: "success",
    });

    showDeleteModal.value = false;
    teamToDelete.value = null;
  } catch (error: any) {
    useToast().add({
      title: "Erro ao excluir equipe",
      color: "error",
    });
  }
};

// Load teams on mount
await loadTeams();
</script>
