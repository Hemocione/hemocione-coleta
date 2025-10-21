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

    <!-- Teams Grid -->
    <div
      v-else
      class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4"
    >
      <!-- Existing Teams -->
      <div
        v-for="team in teams"
        :key="team._id"
        class="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer group relative"
        @click="startEdit(team)"
      >
        <div
          class="flex flex-col items-center justify-center h-full min-h-[120px]"
        >
          <!-- Color Indicator -->
          <div
            class="w-16 h-16 rounded-full border-2 border-gray-200 mb-4 group-hover:scale-110 transition-transform"
            :style="{ backgroundColor: team.color }"
          ></div>

          <!-- Team Name -->
          <input
            v-if="editingTeam === team._id"
            v-model="editingName"
            @blur="saveTeamName(team)"
            @keyup.enter="saveTeamName(team)"
            @keyup.escape="cancelEdit"
            @click.stop
            :disabled="isUpdatingName"
            class="text-center text-lg font-semibold text-gray-900 bg-transparent border-b-2 border-blue-500 focus:outline-none w-full disabled:opacity-50"
            ref="nameInput"
          />
          <h3
            v-else
            class="text-lg font-semibold text-gray-900 text-center group-hover:text-blue-600 transition-colors"
          >
            {{ team.name }}
          </h3>
        </div>

        <!-- Actions (hidden by default, shown on hover) -->
        <div
          class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <div class="flex items-center space-x-1">
            <!-- Color Picker -->
            <div class="relative">
              <UButton
                variant="ghost"
                size="sm"
                :style="{ backgroundColor: team.color }"
                class="w-6 h-6 rounded-full border border-gray-300 hover:scale-110 transition-transform"
                @click.stop="toggleColorPicker(team._id)"
              />
              <!-- Color Picker Dropdown -->
              <div
                v-if="showColorPicker === team._id"
                class="absolute top-8 right-0 bg-white border border-gray-200 rounded-xl shadow-xl p-4 z-20 min-w-[200px]"
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
                    <span class="font-medium">{{
                      getColorName(team.color)
                    }}</span>
                  </p>
                </div>
              </div>
            </div>

            <!-- Delete Button -->
            <UButton
              @click.stop="confirmDeleteTeam(team)"
              variant="ghost"
              color="error"
              size="sm"
              icon="i-lucide-trash-2"
            />
          </div>
        </div>
      </div>

      <!-- Add New Team Card -->
      <div
        @click="showCreateTeamModal = true"
        class="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-blue-400 hover:bg-blue-50 transition-colors cursor-pointer group"
      >
        <div
          class="flex flex-col items-center justify-center h-full min-h-[120px]"
        >
          <div
            class="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mb-4 group-hover:bg-blue-100 group-hover:scale-110 transition-all"
          >
            <UIcon
              name="i-lucide-plus"
              class="w-8 h-8 text-gray-400 group-hover:text-blue-500"
            />
          </div>
          <h3
            class="text-lg font-semibold text-gray-700 group-hover:text-blue-600 transition-colors text-center"
          >
            Adicionar Equipe
          </h3>
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
                !newTeam.name?.trim() || !newTeam.color || isLoadingTeams
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

          <p class="text-gray-700 mb-6">
            Tem certeza que deseja excluir a equipe
            <strong>{{ teamToDelete?.name }}</strong
            >? Esta ação não pode ser desfeita.
          </p>

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
      description: error.message || "Tente novamente mais tarde.",
      color: "error",
    });
  }
};

const startEdit = (team: any) => {
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
      description: error.message || "Tente novamente mais tarde.",
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
      description: error.message || "Tente novamente mais tarde.",
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
      description: error.message || "Tente novamente mais tarde.",
      color: "error",
    });
  }
};

// Load teams on mount
await loadTeams();
</script>
