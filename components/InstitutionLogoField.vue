<template>
  <div class="flex items-start gap-4 rounded-lg border border-gray-200 p-3">
    <div
      class="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100"
    >
      <img
        v-if="modelValue"
        :src="modelValue"
        alt="Logo atual da instituição"
        class="size-full object-contain"
      />
      <UIcon v-else name="i-lucide-building-2" class="size-8 text-gray-400" />
    </div>
    <div class="min-w-0 flex-1">
      <div class="text-sm font-medium text-gray-900">Logo da instituição</div>
      <p class="mt-1 text-xs leading-relaxed text-gray-500">
        Envie uma imagem PNG ou JPEG quadrada, com no máximo 2 MB.
      </p>
      <input
        ref="input"
        type="file"
        accept="image/png,image/jpeg"
        class="sr-only"
        data-testid="institution-logo-input"
        :disabled="disabled || uploading"
        @change="onFileChange"
      />
      <div class="mt-3 flex flex-wrap gap-2">
        <UButton
          type="button"
          size="sm"
          variant="soft"
          icon="i-lucide-upload"
          :loading="uploading"
          :disabled="disabled || uploading"
          data-testid="institution-logo-select"
          @click="openFilePicker"
        >
          {{ modelValue ? "Trocar logo" : "Adicionar logo" }}
        </UButton>
        <UButton
          v-if="modelValue"
          type="button"
          size="sm"
          color="neutral"
          variant="ghost"
          :disabled="disabled || uploading"
          data-testid="institution-logo-remove"
          @click="removeLogo"
        >
          Remover
        </UButton>
      </div>
      <p v-if="errorMessage" class="mt-2 text-xs text-red-600" role="alert">
        {{ errorMessage }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { fetchWithAuth } from "~/composables/useFetchWithAuth";
import { useUserStore } from "~/stores/user";
import {
  INSTITUTION_LOGO_MIME_TYPES,
  MAX_INSTITUTION_LOGO_BYTES,
} from "~/utils/institutionLogo";

defineOptions({ name: "InstitutionLogoField" });

const props = withDefaults(
  defineProps<{
    modelValue?: string | null;
    disabled?: boolean;
  }>(),
  {
    modelValue: null,
    disabled: false,
  }
);

const emit = defineEmits<{
  "update:modelValue": [value: string | null];
  uploading: [value: boolean];
}>();

const input = ref<HTMLInputElement | null>(null);
const uploading = ref(false);
const errorMessage = ref("");
const userStore = useUserStore();

const openFilePicker = () => {
  if (!props.disabled && !uploading.value) input.value?.click();
};

const readImageDimensions = (file: File) =>
  new Promise<{ width: number; height: number }>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Não foi possível ler as dimensões da logo."));
    };
    image.src = objectUrl;
  });

const errorMessageOf = (error: unknown) => {
  if (!error || typeof error !== "object") return "Não foi possível enviar a logo.";
  const data = "data" in error && typeof error.data === "object" ? error.data : null;
  if (data && "statusMessage" in data && typeof data.statusMessage === "string") {
    return data.statusMessage;
  }
  if (data && "message" in data && typeof data.message === "string") {
    return data.message;
  }
  return "message" in error && typeof error.message === "string"
    ? error.message
    : "Não foi possível enviar a logo.";
};

const onFileChange = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  target.value = "";
  errorMessage.value = "";
  if (!file) return;

  if (!userStore.token) {
    errorMessage.value = "Entre para enviar a logo da instituição.";
    return;
  }

  if (file.size > MAX_INSTITUTION_LOGO_BYTES) {
    errorMessage.value = "A logo deve ter no máximo 2 MB.";
    return;
  }
  if (
    !INSTITUTION_LOGO_MIME_TYPES.includes(
      file.type as (typeof INSTITUTION_LOGO_MIME_TYPES)[number]
    )
  ) {
    errorMessage.value = "A logo deve ser um arquivo PNG ou JPEG.";
    return;
  }

  try {
    const dimensions = await readImageDimensions(file);
    if (dimensions.width !== dimensions.height) {
      errorMessage.value = "A logo deve ser quadrada.";
      return;
    }

    uploading.value = true;
    emit("uploading", true);
    const body = new FormData();
    body.append("image", file);
    const response = await fetchWithAuth<{ url: string }>(
      "/api/v1/me/institutions/logo",
      { method: "POST", body }
    );
    emit("update:modelValue", response.url);
  } catch (error) {
    errorMessage.value = errorMessageOf(error);
  } finally {
    uploading.value = false;
    emit("uploading", false);
  }
};

const removeLogo = () => {
  if (!props.disabled && !uploading.value) {
    errorMessage.value = "";
    emit("update:modelValue", null);
  }
};
</script>
