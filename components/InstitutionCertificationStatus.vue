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
        :href="certificationCtaHref"
        target="_blank"
        rel="noopener noreferrer"
        external
        color="info"
        size="sm"
        icon="i-lucide-arrow-up-right"
        data-testid="institution-certification-cta"
        :ui="{
          base: 'inline-flex! items-center! gap-1.5! rounded-md! px-2.5! py-1.5! text-xs! font-medium! transition-colors! bg-(--hemo-color-link)! text-white! hover:bg-[#0050c9]! active:bg-[#0050c9]! focus-visible:outline-(--hemo-color-link)!',
        }"
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
import { computed } from "vue";
import type { InstitutionCertificationStatus } from "~/utils/institutionCertification";

defineOptions({ name: "InstitutionCertificationStatus" });

const props = withDefaults(
  defineProps<{
    certificationStatus?: InstitutionCertificationStatus;
    hasCollectionBadge?: boolean;
    showCta?: boolean;
    institutionId?: string;
  }>(),
  {
    certificationStatus: "none",
    hasCollectionBadge: false,
    showCta: false,
    institutionId: "",
  }
);

const certificationCtaHref = computed(() => {
  const config = useRuntimeConfig();
  const base = config.public.institutionsUrl || "";
  const id = props.institutionId?.trim();
  return id ? `${base}/${id}/certificacao` : base;
});
</script>
