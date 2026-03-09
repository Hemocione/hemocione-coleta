<template>
  <div class="space-y-6">
    <!-- Loading State -->
    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <div class="text-center">
        <div
          class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"
        ></div>
        <p class="text-gray-600">Carregando configurações...</p>
      </div>
    </div>

    <template v-else>
      <!-- Auto Generate Toggle -->
      <div
        class="bg-white rounded-lg border border-gray-200 p-6 flex items-center justify-between"
      >
        <div>
          <h3 class="text-base font-semibold text-gray-900">
            Gerar termo automaticamente após visita técnica aprovada
          </h3>
          <p class="text-sm text-gray-500 mt-1">
            Quando ativado, um termo de compromisso será gerado automaticamente
            após uma visita técnica ser marcada como aprovada.
          </p>
        </div>
        <USwitch
          v-model="autoGenerate"
          @update:model-value="handleAutoGenerateChange"
        />
      </div>

      <!-- Template Editor -->
      <div class="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-base font-semibold text-gray-900">
            Template do Termo de Compromisso
          </h3>
          <div class="flex items-center gap-2">
            <UButton
              variant="outline"
              size="sm"
              icon="i-lucide-rotate-ccw"
              @click="restoreDefault"
              :disabled="isSaving"
            >
              Restaurar Padrão
            </UButton>
            <UButton
              color="primary"
              size="sm"
              icon="i-lucide-save"
              @click="saveTemplate"
              :loading="isSaving"
              :disabled="!hasChanges"
            >
              Salvar Template
            </UButton>
          </div>
        </div>

        <!-- Placeholders Reference -->
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 class="text-sm font-medium text-blue-800 mb-2">
            Placeholders disponíveis
          </h4>
          <p class="text-xs text-blue-600 mb-2">
            Use estes placeholders no template. Eles serão substituídos pelos
            dados reais ao gerar o termo.
          </p>
          <div class="flex flex-wrap gap-2">
            <span
              v-for="placeholder in placeholders"
              :key="placeholder.key"
              class="inline-flex items-center gap-1 px-2 py-1 bg-white border border-blue-200 rounded text-xs font-mono text-blue-700 cursor-pointer hover:bg-blue-100 transition-colors"
              :title="placeholder.description"
              @click="insertPlaceholder(placeholder.key)"
            >
              {{ placeholder.display }}
              <span class="text-blue-400 font-sans">{{
                placeholder.label
              }}</span>
            </span>
          </div>
        </div>

        <!-- Template Textarea -->
        <UFormField label="Conteúdo do template">
          <UTextarea
            ref="templateTextarea"
            v-model="templateContent"
            :rows="16"
            class="w-full font-mono text-sm"
            style="resize: vertical"
            :maxlength="10000"
            placeholder="Digite o conteúdo do template do termo de compromisso..."
          />
          <template #help>
            <div class="text-right text-sm text-gray-500">
              {{ templateContent.length }}/10000
            </div>
          </template>
        </UFormField>
      </div>

      <!-- Preview -->
      <div class="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-base font-semibold text-gray-900">
            Preview do Termo
          </h3>
          <UBadge color="neutral" variant="subtle"> Dados de exemplo </UBadge>
        </div>

        <div
          class="bg-gray-50 border border-gray-200 rounded-lg p-6 whitespace-pre-wrap text-sm text-gray-800 leading-relaxed font-serif"
        >
          {{ previewContent }}
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { fetchWithAuth } from "~/composables/useFetchWithAuth";
import { useUserStore } from "~/stores/user";

definePageMeta({
  layout: "default",
});

const route = useRoute();
const userStore = useUserStore();

const currentBloodBankRole = computed(() => userStore.currentBloodBankRole);
const bloodBanksLocationId = computed(
  () => currentBloodBankRole.value?.bloodBanksLocationId
);

const DEFAULT_TEMPLATE = `TERMO DE COMPROMISSO

Pelo presente instrumento, a instituição {{institutionName}}, localizada em {{address}}, se compromete a cumprir as condições estabelecidas pelo banco de sangue {{bloodBankName}} para a realização da coleta de sangue.

O(A) responsável pelo local, {{hostName}}, se compromete a:

1. Garantir espaço físico adequado para a realização da coleta;
2. Divulgar a campanha de doação de sangue entre os colaboradores e comunidade;
3. Assegurar o número mínimo de doadores conforme acordado previamente;
4. Fornecer apoio logístico necessário no dia da coleta;
5. Seguir todas as normas e orientações sanitárias indicadas pelo banco de sangue.

Data: {{date}}

___________________________
{{hostName}}
Representante da Instituição

___________________________
{{bloodBankName}}`;

const placeholders = [
  {
    key: "institutionName",
    label: "Instituição",
    description: "Nome da instituição",
  },
  {
    key: "address",
    label: "Endereço",
    description: "Endereço do local da coleta",
  },
  {
    key: "bloodBankName",
    label: "Banco de Sangue",
    description: "Nome do banco de sangue",
  },
  {
    key: "hostName",
    label: "Ponto Focal",
    description: "Nome do responsável na instituição",
  },
  { key: "date", label: "Data", description: "Data do termo" },
].map((p) => ({ ...p, display: `{{${p.key}}}` }));

const sampleData: Record<string, string> = {
  institutionName: "Universidade Federal de São Paulo",
  address: "Rua Botucatu, 740 - Vila Clementino, São Paulo - SP, 04023-062",
  bloodBankName: "Hemocentro São Paulo",
  hostName: "Maria da Silva",
  date: "08/03/2026",
};

const isLoading = ref(true);
const isSaving = ref(false);
const templateContent = ref("");
const savedTemplate = ref<string | null>(null);
const autoGenerate = ref(false);
const templateTextarea = ref<{ textareaRef: HTMLTextAreaElement } | null>(null);

const hasChanges = computed(() => {
  const currentSaved = savedTemplate.value ?? DEFAULT_TEMPLATE;
  return templateContent.value !== currentSaved;
});

const previewContent = computed(() => {
  let content = templateContent.value;
  for (const [key, value] of Object.entries(sampleData)) {
    content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  return content;
});

function insertPlaceholder(key: string) {
  const textarea = templateTextarea.value?.textareaRef;
  if (!textarea) {
    // Fallback: just append at the end
    templateContent.value += `{{${key}}}`;
    return;
  }

  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = `{{${key}}}`;

  templateContent.value =
    templateContent.value.substring(0, start) +
    text +
    templateContent.value.substring(end);

  nextTick(() => {
    textarea.focus();
    textarea.setSelectionRange(start + text.length, start + text.length);
  });
}

async function loadSettings() {
  if (!bloodBanksLocationId.value) return;

  try {
    const response = await fetchWithAuth<{
      success: boolean;
      data: {
        commitmentTermTemplate: string | null;
        autoGenerateCommitmentTerm: boolean;
      };
    }>(
      `/api/v1/bloodbank/${bloodBanksLocationId.value}/commitment-term-settings`
    );

    savedTemplate.value = response.data.commitmentTermTemplate;
    templateContent.value =
      response.data.commitmentTermTemplate || DEFAULT_TEMPLATE;
    autoGenerate.value = response.data.autoGenerateCommitmentTerm;
  } catch (error) {
    console.error("Error loading commitment term settings:", error);
    templateContent.value = DEFAULT_TEMPLATE;
  } finally {
    isLoading.value = false;
  }
}

async function saveTemplate() {
  if (!bloodBanksLocationId.value || isSaving.value) return;

  isSaving.value = true;
  try {
    const templateToSave =
      templateContent.value === DEFAULT_TEMPLATE
        ? null
        : templateContent.value;

    await fetchWithAuth(
      `/api/v1/bloodbank/${bloodBanksLocationId.value}/commitment-term-settings`,
      {
        method: "PUT",
        body: { commitmentTermTemplate: templateToSave },
      }
    );

    savedTemplate.value = templateToSave;

    useToast().add({
      title: "Template salvo!",
      description: "O template do termo de compromisso foi atualizado.",
      color: "success",
    });
  } catch (error) {
    console.error("Error saving template:", error);
    useToast().add({
      title: "Erro ao salvar template",
      description: "Tente novamente mais tarde.",
      color: "error",
    });
  } finally {
    isSaving.value = false;
  }
}

async function handleAutoGenerateChange(value: boolean) {
  if (!bloodBanksLocationId.value) return;

  try {
    await fetchWithAuth(
      `/api/v1/bloodbank/${bloodBanksLocationId.value}/commitment-term-settings`,
      {
        method: "PUT",
        body: { autoGenerateCommitmentTerm: value },
      }
    );

    useToast().add({
      title: value ? "Geração automática ativada" : "Geração automática desativada",
      color: "success",
    });
  } catch (error) {
    console.error("Error updating auto generate:", error);
    autoGenerate.value = !value;
    useToast().add({
      title: "Erro ao atualizar configuração",
      description: "Tente novamente mais tarde.",
      color: "error",
    });
  }
}

function restoreDefault() {
  templateContent.value = DEFAULT_TEMPLATE;
}

await loadSettings();
</script>
