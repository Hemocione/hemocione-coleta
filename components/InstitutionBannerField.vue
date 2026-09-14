<template>
  <InstitutionImageField
    kind="banner"
    :model-value="props.modelValue"
    :disabled="props.disabled"
    @update:model-value="emit('update:modelValue', $event)"
    @uploading="emit('uploading', $event)"
  />
</template>

<script setup lang="ts">
import InstitutionImageField from "~/components/InstitutionImageField.vue";

defineOptions({ name: "InstitutionBannerField" });

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
</script>
