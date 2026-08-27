<template>
  <div class="min-h-screen bg-white text-gray-900 print-page">
    <!-- Header (hidden on print) -->
    <header
      class="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-gray-200 print:hidden"
    >
      <div
        class="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between"
      >
        <div class="flex items-center gap-2">
          <img src="/logo.svg" alt="Hemocione Coleta" class="w-8 h-8" />
          <span class="font-semibold">Termo de Compromisso</span>
        </div>
        <div class="flex items-center gap-2">
          <UButton
            v-if="term && term.status !== 'acknowledged'"
            variant="soft"
            color="primary"
            icon="i-lucide-check-circle"
            :loading="acknowledging"
            @click="acknowledgeTerm"
          >
            Confirmar Recebimento
          </UButton>
          <UButton
            variant="outline"
            icon="i-lucide-printer"
            :loading="downloadingPdf"
            @click="downloadPdf"
          >
            Baixar PDF
          </UButton>
        </div>
      </div>
    </header>

    <main class="max-w-3xl mx-auto px-4 py-6">
      <!-- Loading -->
      <div v-if="loading" class="space-y-4">
        <USkeleton class="h-8 w-64" />
        <USkeleton class="h-96" />
      </div>

      <!-- Error -->
      <div v-else-if="error" class="text-center py-12 text-gray-600">
        <UIcon
          name="i-lucide-alert-circle"
          class="w-10 h-10 mx-auto mb-3 text-gray-400"
        />
        <p>Termo de compromisso não encontrado.</p>
      </div>

      <!-- Content -->
      <template v-else-if="term">
        <!-- Status badge (hidden on print) -->
        <div class="mb-4 print:hidden">
          <span
            class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium"
            :class="statusBadgeClasses"
          >
            <UIcon :name="statusIcon" class="w-4 h-4" />
            {{ statusLabel }}
          </span>
          <span
            v-if="term.acknowledgedAt"
            class="ml-2 text-sm text-gray-500"
          >
            Confirmado em
            {{
              new Date(term.acknowledgedAt).toLocaleDateString("pt-BR")
            }}
          </span>
        </div>

        <!-- Term content (print-friendly) -->
        <div class="term-content prose prose-sm max-w-none whitespace-pre-wrap leading-relaxed">{{ term.generatedContent }}</div>
      </template>
    </main>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false });

const route = useRoute();
const token = route.params.token as string;

const loading = ref(true);
const error = ref(false);
const acknowledging = ref(false);
const downloadingPdf = ref(false);
const term = ref<{
  _id: string;
  generatedContent: string;
  status: "draft" | "sent" | "acknowledged";
  sentAt?: string | null;
  acknowledgedAt?: string | null;
  createdAt: string;
} | null>(null);

const statusBadgeClasses = computed(() => {
  switch (term.value?.status) {
    case "acknowledged":
      return "bg-green-100 text-green-800";
    case "sent":
      return "bg-blue-100 text-blue-800";
    default:
      return "bg-gray-100 text-gray-600";
  }
});

const statusIcon = computed(() => {
  switch (term.value?.status) {
    case "acknowledged":
      return "i-lucide-check-circle";
    case "sent":
      return "i-lucide-send";
    default:
      return "i-lucide-file-text";
  }
});

const statusLabel = computed(() => {
  switch (term.value?.status) {
    case "acknowledged":
      return "Confirmado";
    case "sent":
      return "Enviado";
    default:
      return "Rascunho";
  }
});

async function loadTerm() {
  loading.value = true;
  error.value = false;
  try {
    const response = await $fetch<{
      success: boolean;
      data: typeof term.value;
    }>(`/api/v1/public/commitment-terms/${token}`);
    term.value = response.data;
  } catch {
    error.value = true;
  } finally {
    loading.value = false;
  }
}

async function acknowledgeTerm() {
  acknowledging.value = true;
  try {
    const response = await $fetch<{
      success: boolean;
      data: { status: string; acknowledgedAt: string };
    }>(`/api/v1/public/commitment-terms/${token}/acknowledge`, {
      method: "POST",
    });
    if (term.value) {
      term.value.status = response.data.status as typeof term.value.status;
      term.value.acknowledgedAt = response.data.acknowledgedAt;
    }
  } catch {
    // silently fail
  } finally {
    acknowledging.value = false;
  }
}

async function downloadPdf() {
  if (downloadingPdf.value) return;

  downloadingPdf.value = true;
  try {
    const response = await fetch(
      `/api/v1/public/commitment-terms/${encodeURIComponent(token)}/pdf`
    );
    if (!response.ok) {
      throw new Error("PDF download failed");
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "termo-de-compromisso.pdf";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    useToast().add({
      title: "Erro ao baixar PDF",
      description: "Tente novamente mais tarde.",
      color: "error",
    });
  } finally {
    downloadingPdf.value = false;
  }
}

onMounted(() => {
  loadTerm();
});
</script>

<style>
@media print {
  @page {
    size: A4;
    margin: 2cm;
  }

  .print-page {
    min-height: auto !important;
    background: white !important;
  }

  .print\\:hidden {
    display: none !important;
  }

  .term-content {
    font-size: 12pt;
    line-height: 1.6;
    color: black;
  }
}
</style>
