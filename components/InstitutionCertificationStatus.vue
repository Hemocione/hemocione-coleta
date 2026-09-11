<template>
  <div
    data-testid="institution-certification-status"
    :data-has-collection-badge="props.hasCollectionBadge"
    class="inline-flex items-center gap-1.5 text-xs"
  >
    <template v-if="props.certificationStatus === 'certified'">
      <UBadge
        color="success"
        variant="solid"
        size="sm"
        icon="i-lucide-badge-check"
      >
        Instituição Certificada
      </UBadge>
    </template>

    <template v-else-if="props.certificationStatus === 'in_progress'">
      <UBadge
        color="warning"
        variant="subtle"
        size="sm"
        icon="i-lucide-clock-3"
      >
        Certificação em andamento
      </UBadge>
    </template>

    <template v-else-if="props.showCta">
      <UButton
        as="a"
        href="https://instituicoes.hemocione.com.br"
        target="_blank"
        rel="noopener noreferrer"
        external
        color="primary"
        size="sm"
        icon="i-lucide-arrow-up-right"
        data-testid="institution-certification-cta"
      >
        Iniciar processo de certificação
      </UButton>
    </template>

    <template v-else>
      <UBadge
        color="neutral"
        variant="subtle"
        size="sm"
        icon="i-lucide-circle-help"
      >
        Certificação não iniciada
      </UBadge>
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
