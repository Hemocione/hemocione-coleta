<template>
  <div
    data-testid="institution-certification-status"
    :data-has-collection-badge="props.hasCollectionBadge"
    class="inline-flex items-center gap-1.5 text-xs"
  >
    <template v-if="props.certificationStatus === 'certified'">
      <UIcon name="i-lucide-badge-check" class="size-4 text-emerald-600" />
      <span class="font-semibold text-emerald-700">Instituição Certificada</span>
    </template>

    <template v-else-if="props.certificationStatus === 'in_progress'">
      <UIcon name="i-lucide-clock-3" class="size-4 text-gray-500" />
      <span class="text-gray-600">Certificação em andamento</span>
    </template>

    <template v-else-if="props.showCta">
      <a
        href="https://instituicoes.hemocione.com.br"
        target="_blank"
        rel="noopener noreferrer"
        data-testid="institution-certification-cta"
        class="font-medium text-primary-600 underline-offset-2 hover:underline"
      >
        Iniciar processo de certificação
      </a>
    </template>

    <template v-else>
      <UIcon name="i-lucide-circle-help" class="size-4 text-gray-400" />
      <span class="text-gray-500">Certificação não iniciada</span>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { InstitutionCertificationStatus } from "~/utils/institutionCertification";

defineOptions({ name: "InstitutionCertificationStatus" });

const props = withDefaults(
  defineProps<{
    certificationStatus?: InstitutionCertificationStatus;
    hasCollectionBadge?: boolean;
    showCta?: boolean;
  }>(),
  {
    certificationStatus: "none",
    hasCollectionBadge: false,
    showCta: false,
  }
);
</script>
