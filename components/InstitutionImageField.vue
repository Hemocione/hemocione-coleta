<template>
  <div class="flex items-start gap-4 rounded-lg border border-gray-200 p-3">
    <div
      class="flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100"
      :class="imageConfig.previewClass"
    >
      <img
        v-if="modelValue"
        :src="modelValue"
        :alt="imageConfig.alt"
        class="size-full"
        :class="imageConfig.imageClass"
      />
      <UIcon v-else name="i-lucide-building-2" class="size-8 text-gray-400" />
    </div>
    <div class="min-w-0 flex-1">
      <div class="text-sm font-medium text-gray-900">{{ imageConfig.title }}</div>
      <p class="mt-1 text-xs leading-relaxed text-gray-500">
        {{ imageConfig.description }}
      </p>
      <input
        ref="input"
        type="file"
        accept="image/png,image/jpeg"
        class="sr-only"
        :data-testid="`institution-${kind}-input`"
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
          :data-testid="`institution-${kind}-select`"
          @click="openFilePicker"
        >
          {{ modelValue ? `Trocar ${imageConfig.noun}` : `Adicionar ${imageConfig.noun}` }}
        </UButton>
        <UButton
          v-if="modelValue"
          type="button"
          size="sm"
          color="neutral"
          variant="ghost"
          :disabled="disabled || uploading"
          :data-testid="`institution-${kind}-remove`"
          @click="removeImage"
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
import { computed, ref } from "vue";
import { fetchWithAuth } from "~/composables/useFetchWithAuth";
import { useUserStore } from "~/stores/user";
import {
  INSTITUTION_BANNER_MIME_TYPES,
  MAX_INSTITUTION_BANNER_BYTES,
} from "~/utils/institutionBanner";
import {
  INSTITUTION_LOGO_MIME_TYPES,
  MAX_INSTITUTION_LOGO_BYTES,
} from "~/utils/institutionLogo";
import type { InstitutionImageMimeType } from "~/utils/institutionImage";

type InstitutionImageKind = "logo" | "banner";

interface ImageFieldConfig {
  article: "a" | "o";
  noun: string;
  title: string;
  alt: string;
  description: string;
  endpoint: string;
  maxBytes: number;
  mimeTypes: readonly InstitutionImageMimeType[];
  dimensionsMessage: string;
  maxSizeMessage: string;
  invalidMimeTypeMessage: string;
  authMessage: string;
  previewClass: string;
  imageClass: string;
  requireSquare: boolean;
}

defineOptions({ name: "InstitutionImageField" });

const props = withDefaults(
  defineProps<{
    kind: InstitutionImageKind;
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

const imageConfig = computed<ImageFieldConfig>(() => {
  if (props.kind === "banner") {
    return {
      article: "o",
      noun: "banner",
      title: "Banner da instituição",
      alt: "Banner atual da instituição",
      description: "Envie uma imagem PNG ou JPEG retangular, com no máximo 4 MB.",
      endpoint: "/api/v1/me/institutions/banner",
      maxBytes: MAX_INSTITUTION_BANNER_BYTES,
      mimeTypes: INSTITUTION_BANNER_MIME_TYPES,
      dimensionsMessage: "Não foi possível ler as dimensões do banner.",
      maxSizeMessage: "O banner deve ter no máximo 4 MB.",
      invalidMimeTypeMessage: "O banner deve ser um arquivo PNG ou JPEG.",
      authMessage: "Entre para enviar o banner da instituição.",
      previewClass: "h-20 w-32",
      imageClass: "object-cover",
      requireSquare: false,
    };
  }

  return {
    article: "a",
    noun: "logo",
    title: "Logo da instituição",
    alt: "Logo atual da instituição",
    description: "Envie uma imagem PNG ou JPEG quadrada, com no máximo 2 MB.",
    endpoint: "/api/v1/me/institutions/logo",
    maxBytes: MAX_INSTITUTION_LOGO_BYTES,
    mimeTypes: INSTITUTION_LOGO_MIME_TYPES,
    dimensionsMessage: "Não foi possível ler as dimensões da logo.",
    maxSizeMessage: "A logo deve ter no máximo 2 MB.",
    invalidMimeTypeMessage: "A logo deve ser um arquivo PNG ou JPEG.",
    authMessage: "Entre para enviar a logo da instituição.",
    previewClass: "size-20",
    imageClass: "object-contain",
    requireSquare: true,
  };
});

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
      reject(new Error(imageConfig.value.dimensionsMessage));
    };
    image.src = objectUrl;
  });

const errorMessageOf = (error: unknown) => {
  const fallback = `Não foi possível enviar ${imageConfig.value.article} ${imageConfig.value.noun}.`;
  if (!error || typeof error !== "object") return fallback;
  const data =
    "data" in error && error.data && typeof error.data === "object"
      ? error.data
      : null;
  if (data && "statusMessage" in data && typeof data.statusMessage === "string") {
    return data.statusMessage;
  }
  if (data && "message" in data && typeof data.message === "string") {
    return data.message;
  }
  return "message" in error && typeof error.message === "string"
    ? error.message
    : fallback;
};

const onFileChange = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  target.value = "";
  errorMessage.value = "";
  if (!file) return;

  const config = imageConfig.value;
  if (!userStore.token) {
    errorMessage.value = config.authMessage;
    return;
  }

  if (file.size > config.maxBytes) {
    errorMessage.value = config.maxSizeMessage;
    return;
  }
  if (
    !config.mimeTypes.includes(file.type as InstitutionImageMimeType)
  ) {
    errorMessage.value = config.invalidMimeTypeMessage;
    return;
  }

  try {
    const dimensions = await readImageDimensions(file);
    if (config.requireSquare && dimensions.width !== dimensions.height) {
      errorMessage.value = "A logo deve ser quadrada.";
      return;
    }

    uploading.value = true;
    emit("uploading", true);
    const body = new FormData();
    body.append("image", file);
    const response = await fetchWithAuth<{ url: string }>(config.endpoint, {
      method: "POST",
      body,
    });
    emit("update:modelValue", response.url);
  } catch (error) {
    errorMessage.value = errorMessageOf(error);
  } finally {
    uploading.value = false;
    emit("uploading", false);
  }
};

const removeImage = () => {
  if (!props.disabled && !uploading.value) {
    errorMessage.value = "";
    emit("update:modelValue", null);
  }
};
</script>
