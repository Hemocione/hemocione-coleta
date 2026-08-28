<template>
  <UCard
    :data-testid="`blood-bank-card-${bank._id || bank.bloodBanksLocationId}`"
    :data-availability="bank.availability || 'unknown'"
    :class="cardClass"
  >
    <div
      class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
    >
      <div class="flex min-w-0 items-start gap-3">
        <UAvatar
          :src="bank.logo || undefined"
          size="md"
          class="shrink-0"
        >
          {{ bank.name.charAt(0) }}
        </UAvatar>
        <div class="min-w-0">
          <h3
            :title="bank.name"
            class="line-clamp-3 break-words font-medium text-gray-900"
          >
            {{ bank.name }}
          </h3>
          <div
            v-if="typeof bank.distanceMeters === 'number'"
            class="text-xs text-gray-500"
          >
            {{ distanceLabel }}
          </div>
          <div
            v-if="isSchedulable"
            class="mt-2 flex items-center gap-1.5 text-xs font-medium text-success-700"
          >
            <UIcon
              name="i-lucide-calendar-check-2"
              class="size-4"
              aria-hidden="true"
            />
            <span>Agenda disponível</span>
          </div>
        </div>
      </div>

      <UButton
        v-if="isSchedulable"
        :data-testid="`select-bank-${bank._id || bank.bloodBanksLocationId}`"
        color="primary"
        size="sm"
        icon="i-lucide-calendar-plus"
        class="w-full shrink-0 justify-center sm:w-auto sm:min-w-52"
        :disabled="actionDisabled"
        @click="emit('select', bank)"
      >
        Agendar campanha
      </UButton>
      <UButton
        v-else
        :data-testid="`interest-bank-${bank._id || bank.bloodBanksLocationId}`"
        color="warning"
        size="sm"
        icon="i-lucide-hand-heart"
        class="w-full shrink-0 justify-center whitespace-nowrap sm:w-auto sm:min-w-60"
        :loading="interestLoading"
        :disabled="actionDisabled"
        @click="emit('interest', bank)"
      >
        Quero organizar com esse banco
      </UButton>
    </div>
  </UCard>
</template>

<script setup lang="ts">
import type { BloodBankListItem } from "~/stores/scheduling";

const props = defineProps<{
  bank: BloodBankListItem;
  actionDisabled?: boolean;
  interestLoading?: boolean;
}>();

const emit = defineEmits<{
  select: [bank: BloodBankListItem];
  interest: [bank: BloodBankListItem];
}>();

const isSchedulable = computed(
  () => props.bank.availability === "active" && Boolean(props.bank.slug),
);

const distanceLabel = computed(() => {
  const distanceMeters = props.bank.distanceMeters;
  if (typeof distanceMeters !== "number") return "";
  return `${(distanceMeters / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`;
});

const cardClass = computed(() =>
  isSchedulable.value
    ? "border-primary-200 bg-primary-50/30 ring-1 ring-primary-200 shadow-sm hover:shadow-md"
    : props.bank.availability === "missing"
      ? "border-gray-200 bg-white hover:shadow"
      : "border-gray-200 bg-gray-50/70 hover:shadow",
);
</script>
