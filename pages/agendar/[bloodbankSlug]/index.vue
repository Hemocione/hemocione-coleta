<template>
  <div class="space-y-4 md:space-y-6">
    <UCard :ui="{ body: 'p-4 md:p-6' }">
      <template #header>
        <div class="flex items-center justify-between flex-wrap gap-2 md:gap-4">
          <div>
            <h2 class="text-lg font-semibold">Selecionar Datas</h2>
            <p class="text-sm text-gray-500">
              Escolha de 1 a 3 datas disponíveis.
            </p>
          </div>
          <UButton
            v-if="accessedAgendarPage"
            color="neutral"
            variant="ghost"
            icon="i-lucide-arrow-left"
            @click="back"
            class="ml-auto md:ml-0"
            >Voltar</UButton
          >
        </div>
      </template>

      <div class="flex items-center gap-2 mb-4 flex-wrap">
        <USelect v-model="year" :options="years" class="w-28 md:w-32" />
        <USelect v-model="month" :options="months" class="w-36 md:w-40" />
        <UButton color="neutral" @click="loadDates" :loading="loading"
          >Carregar</UButton
        >
      </div>

      <div v-if="loading" class="grid grid-cols-2 md:grid-cols-3 gap-3">
        <USkeleton v-for="i in 6" :key="i" class="h-24" />
      </div>
      <div v-else class="grid grid-cols-2 md:grid-cols-3 gap-3" v-auto-animate>
        <UCard
          v-for="d in dates"
          :key="d._id"
          :class="isSelected(d._id) ? 'ring-2 ring-red-500' : ''"
          class="cursor-pointer select-none"
          @click="toggle(d)"
        >
          <div class="flex items-center justify-between">
            <div class="font-medium">{{ formatPt(d.date) }}</div>
            <UBadge v-if="d.allSlotsLocked" color="neutral" variant="subtle"
              >Sem vagas</UBadge
            >
          </div>
          <div class="text-xs text-gray-500 mt-1">
            {{ d.slots.length }} slot(s)
          </div>
        </UCard>
      </div>

      <div
        class="mt-4 md:mt-6 flex items-center justify-between gap-2 flex-wrap"
      >
        <div class="text-sm text-gray-600">
          Selecionadas: {{ selected.length }}/3
        </div>
        <UButton
          :disabled="selected.length === 0"
          color="primary"
          @click="submit"
          >Agendar Coleta</UButton
        >
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: "agendamento" });
import { useSchedulingStore } from "~/stores/scheduling";
import { useUserStore } from "~/stores/user";
import { redirectToID } from "~/middleware/auth";

const route = useRoute();
const slug = computed(() => route.params.bloodbankSlug as string);
const store = useSchedulingStore();
const { accessedAgendarPage } = storeToRefs(store);
const userStore = useUserStore();

const now = new Date();
const years = [now.getFullYear(), now.getFullYear() + 1];
const months = [
  { label: "Janeiro", value: 1 },
  { label: "Fevereiro", value: 2 },
  { label: "Março", value: 3 },
  { label: "Abril", value: 4 },
  { label: "Maio", value: 5 },
  { label: "Junho", value: 6 },
  { label: "Julho", value: 7 },
  { label: "Agosto", value: 8 },
  { label: "Setembro", value: 9 },
  { label: "Outubro", value: 10 },
  { label: "Novembro", value: 11 },
  { label: "Dezembro", value: 12 },
];

const year = ref(now.getFullYear());
const month = ref(now.getMonth() + 1);
const dates = ref<any[]>([]);
const bank = ref<{ name: string; bloodBanksLocationId: string } | null>(null);
const loading = ref(false);

const selected = computed(() => store.selectedDates);

const isSelected = (id: string) =>
  selected.value.some((d) => d.availableDateId === id);
const toggle = (d: any) =>
  store.toggleSelectedDate({ availableDateId: d._id, date: d.date });

const formatPt = (dateStr: string) => {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
};

const loadDates = async () => {
  loading.value = true;
  try {
    const { data } = await useFetchWithAuth(
      `/api/v1/public/bloodbanks/${slug.value}/available-dates`,
      {
        query: { year: year.value, month: month.value },
      }
    );
    dates.value = data.value?.data || [];
  } finally {
    loading.value = false;
  }
};

// Load bank info for submission context
const { data: bankData } = await useFetchWithAuth(
  `/api/v1/public/bloodbanks/${slug.value}`
);
bank.value = bankData.value?.data || null;
if (bank.value) {
  store.setSelectedBloodBank({
    _id: "",
    name: bank.value.name,
    slug: slug.value,
    logo: null,
    bloodBanksLocationId: bank.value.bloodBanksLocationId,
  });
}
await loadDates();

const back = () => {
  navigateTo("/agendar");
};

const submit = async () => {
  if (!userStore.loggedIn) {
    return redirectToID(route.fullPath);
  }
  if (!store.selectedInstitution) {
    useToast().add({
      title: "Selecione ou crie uma instituição",
      color: "warning",
    });
    return;
  }
  if (!store.selectedBloodBank) {
    useToast().add({
      title: "Selecione um banco na etapa anterior",
      color: "warning",
    });
    return;
  }

  try {
    const payload = {
      bloodBanksLocationId: store.selectedBloodBank.bloodBanksLocationId,
      requestedDates: selected.value.map((d) => ({
        availableDateId: d.availableDateId,
      })),
    };
    const res = await fetchWithAuth(
      `/api/v1/institutions/${store.selectedInstitution.id}/collection-requests`,
      {
        method: "POST",
        body: payload as any,
      }
    );
    useToast().add({
      title: "Solicitação enviada com sucesso",
      color: "success",
    });
    navigateTo("/");
  } catch (e) {
    useToast().add({ title: "Erro ao enviar solicitação", color: "error" });
  }
};
</script>
