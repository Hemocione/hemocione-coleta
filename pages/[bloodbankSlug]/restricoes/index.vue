<template>
  <div class="p-6">
    <!-- Loading State -->
    <div
      v-if="isLoadingRestrictions"
      class="flex items-center justify-center py-12"
    >
      <div class="text-center">
        <div
          class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"
        ></div>
        <p class="text-gray-600">Carregando restrições...</p>
      </div>
    </div>

    <!-- Restrictions List -->
    <div v-else class="space-y-4">
      <!-- Existing Restrictions -->
      <div
        v-for="restriction in restrictionChecklist"
        :key="restriction.slug"
        class="group bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-all duration-200"
      >
        <div class="flex items-start justify-between">
          <div class="flex-1 min-w-0">
            <h3 class="text-lg font-semibold text-gray-900 mb-2">
              {{ restriction.title }}
            </h3>
            <p class="text-sm text-gray-600 leading-relaxed">
              {{ restriction.description }}
            </p>
          </div>

          <!-- Actions -->
          <div class="flex items-center space-x-2 ml-4">
            <!-- Edit Button -->
            <UButton
              variant="ghost"
              size="sm"
              color="primary"
              icon="i-lucide-edit"
              @click="startEditRestriction(restriction)"
              class="hover:bg-blue-50"
            />

            <!-- Delete Button -->
            <UButton
              variant="ghost"
              size="sm"
              color="error"
              icon="i-lucide-trash-2"
              @click="confirmDeleteRestriction(restriction)"
              class="hover:bg-red-50"
            />
          </div>
        </div>
      </div>

      <!-- Add New Restriction Button -->
      <div
        class="group bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-blue-400 hover:bg-blue-50 transition-all duration-200 cursor-pointer"
        @click="showCreateRestrictionModal = true"
      >
        <div class="flex items-center space-x-4">
          <div
            class="w-10 h-10 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 group-hover:text-blue-500 group-hover:border-blue-400 transition-colors"
          >
            <UIcon name="i-lucide-plus" class="w-5 h-5" />
          </div>
          <div>
            <h3
              class="text-lg font-semibold text-gray-500 group-hover:text-blue-600 transition-colors"
            >
              Adicionar Restrição
            </h3>
            <p
              class="text-sm text-gray-400 group-hover:text-blue-500 transition-colors"
            >
              Adicione um item que instituições devem verificar antes de
              solicitar coleta
            </p>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="restrictionChecklist.length === 0" class="text-center py-12">
        <UIcon
          name="i-lucide-shield-alert"
          class="w-12 h-12 text-gray-400 mx-auto mb-4"
        />
        <h3 class="text-lg font-semibold text-gray-900 mb-2">
          Nenhuma restrição configurada
        </h3>
        <p class="text-gray-600 mb-6">
          Adicione itens que instituições devem verificar antes de solicitar
          coleta.
        </p>
        <UButton
          color="primary"
          icon="i-lucide-plus"
          @click="showCreateRestrictionModal = true"
        >
          Adicionar Primeira Restrição
        </UButton>
      </div>
    </div>

    <!-- Create/Edit Restriction Modal -->
    <UModal v-model:open="showCreateRestrictionModal">
      <template #content>
        <div class="p-6 flex flex-col gap-4">
          <h3 class="text-lg font-semibold">
            {{
              editingRestriction ? "Editar Restrição" : "Criar Nova Restrição"
            }}
          </h3>

          <div class="space-y-6 flex flex-col gap-1">
            <UFormField label="Título da Restrição" required>
              <UInput
                v-model="restrictionForm.title"
                placeholder="Ex: Tem autorização para coleta?"
                :disabled="isLoadingRestrictions"
                size="lg"
                :maxlength="100"
                class="w-full"
              />
              <template #help>
                <div class="text-right text-sm text-gray-500">
                  {{ restrictionForm.title.length }}/100
                </div>
              </template>
            </UFormField>

            <UFormField label="Descrição" required>
              <UTextarea
                v-model="restrictionForm.description"
                placeholder="Descreva detalhadamente o que a instituição deve verificar..."
                :disabled="isLoadingRestrictions"
                :rows="4"
                :maxlength="1000"
                class="w-full"
                style="resize: none"
              />
              <template #help>
                <div class="text-right text-sm text-gray-500">
                  {{ restrictionForm.description.length }}/1000
                </div>
              </template>
            </UFormField>
          </div>

          <div class="flex justify-end space-x-3 mt-6">
            <UButton
              @click="cancelEdit"
              variant="ghost"
              :disabled="isLoadingRestrictions"
            >
              Cancelar
            </UButton>
            <UButton
              @click="saveRestriction"
              color="primary"
              :loading="isLoadingRestrictions"
              :disabled="
                !restrictionForm.title?.trim() ||
                !restrictionForm.description?.trim() ||
                isLoadingRestrictions
              "
            >
              {{ editingRestriction ? "Salvar Alterações" : "Criar Restrição" }}
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
            Tem certeza que deseja excluir a restrição
            <strong>"{{ restrictionToDelete?.title }}"</strong>? Esta ação não
            pode ser desfeita.
          </p>

          <div class="flex justify-end space-x-3">
            <UButton
              @click="showDeleteModal = false"
              variant="ghost"
              :disabled="isLoadingRestrictions"
            >
              Cancelar
            </UButton>
            <UButton
              @click="deleteRestriction"
              color="error"
              :loading="isLoadingRestrictions"
            >
              Excluir Restrição
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useUserStore } from "~/stores/user";
import { useBloodbankStore } from "~/stores/bloodbank";
import type { RestrictionItem } from "~/stores/bloodbank";

// Define page meta
definePageMeta({
  layout: "default",
});

// Get route params
const route = useRoute();

// Initialize stores
const userStore = useUserStore();
const bloodbankStore = useBloodbankStore();
const { restrictionChecklist, isLoadingRestrictions, error } =
  storeToRefs(bloodbankStore);

// Reactive state
const showCreateRestrictionModal = ref(false);
const showDeleteModal = ref(false);
const editingRestriction = ref<RestrictionItem | null>(null);
const restrictionToDelete = ref<RestrictionItem | null>(null);

const restrictionForm = ref({
  title: "",
  description: "",
});

// Computed
const currentBloodBankRole = computed(() => userStore.currentBloodBankRole);
const bloodBanksLocationId = computed(
  () => currentBloodBankRole.value?.bloodBanksLocationId
);

// Methods
const loadRestrictions = async () => {
  if (!bloodBanksLocationId.value) return;

  try {
    await bloodbankStore.loadRestrictionChecklist(bloodBanksLocationId.value);
  } catch (error) {
    console.error("Error loading restrictions:", error);
  }
};

const startEditRestriction = (restriction: RestrictionItem) => {
  editingRestriction.value = restriction;
  restrictionForm.value = {
    title: restriction.title,
    description: restriction.description,
  };
  showCreateRestrictionModal.value = true;
};

const saveRestriction = async () => {
  if (
    !bloodBanksLocationId.value ||
    !restrictionForm.value.title?.trim() ||
    !restrictionForm.value.description?.trim()
  )
    return;

  try {
    if (editingRestriction.value) {
      // Update existing restriction
      await bloodbankStore.updateRestrictionItem(
        bloodBanksLocationId.value,
        editingRestriction.value.slug,
        {
          title: restrictionForm.value.title.trim(),
          description: restrictionForm.value.description.trim(),
        }
      );

      useToast().add({
        title: "Restrição atualizada!",
        description: `A restrição "${restrictionForm.value.title}" foi atualizada.`,
        color: "success",
      });
    } else {
      // Create new restriction
      await bloodbankStore.addRestrictionItem(
        bloodBanksLocationId.value,
        restrictionForm.value.title.trim(),
        restrictionForm.value.description.trim()
      );

      useToast().add({
        title: "Restrição criada!",
        description: `A restrição "${restrictionForm.value.title}" foi criada.`,
        color: "success",
      });
    }

    showCreateRestrictionModal.value = false;
    cancelEdit();
  } catch (error: any) {
    useToast().add({
      title: "Erro ao salvar restrição",
      description: "Tente novamente mais tarde.",
      color: "error",
    });
  }
};

const cancelEdit = () => {
  editingRestriction.value = null;
  restrictionForm.value = {
    title: "",
    description: "",
  };
  showCreateRestrictionModal.value = false;
};

const confirmDeleteRestriction = (restriction: RestrictionItem) => {
  restrictionToDelete.value = restriction;
  showDeleteModal.value = true;
};

const deleteRestriction = async () => {
  if (!bloodBanksLocationId.value || !restrictionToDelete.value) return;

  try {
    await bloodbankStore.deleteRestrictionItem(
      bloodBanksLocationId.value,
      restrictionToDelete.value.slug
    );

    useToast().add({
      title: "Restrição excluída!",
      description: `A restrição "${restrictionToDelete.value.title}" foi excluída.`,
      color: "success",
    });

    showDeleteModal.value = false;
    restrictionToDelete.value = null;
  } catch (error: any) {
    useToast().add({
      title: "Erro ao excluir restrição",
      color: "error",
    });
  }
};

// Load restrictions on mount
await loadRestrictions();
</script>
