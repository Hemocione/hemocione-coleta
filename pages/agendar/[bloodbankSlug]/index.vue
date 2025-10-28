<template>
  <div class="space-y-4 md:space-y-6">
    <!-- Authentication check -->
    <Transition name="fade" mode="out-in">
      <UIcon
        name="i-lucide-loader-2"
        class="animate-spin h-10 mx-auto w-full mt-10 text-gray-400"
        v-if="loading"
      />

      <div v-else-if="!isLoggedIn" class="text-center py-12 text-gray-600">
        <UIcon
          name="i-lucide-lock"
          class="w-10 h-10 mx-auto mb-3 text-gray-400"
        />
        <p>Você precisa estar logado para agendar coletas.</p>
        <UButton
          color="primary"
          icon="i-lucide-log-in"
          @click="onLogin"
          class="mt-4"
        >
          Entrar
        </UButton>
      </div>
      <!-- Institution check -->
      <div
        v-else-if="!selectedInstitution"
        class="text-center py-12 text-gray-600"
      >
        <UIcon
          name="i-lucide-building"
          class="w-10 h-10 mx-auto mb-3 text-gray-400"
        />
        <p>Selecione ou registre uma instituição para agendar coletas.</p>
      </div>

      <!-- Main content -->
      <UCard
        v-else-if="selectedInstitution && bank"
        :ui="{ body: 'p-4 md:p-6' }"
      >
        <template #header>
          <div
            class="flex items-center justify-between flex-wrap gap-2 md:gap-4"
          >
            <div class="flex items-center gap-3 min-w-0">
              <UAvatar :src="bank?.logo || undefined" size="md">{{
                bank?.name?.charAt(0) || "B"
              }}</UAvatar>
              <div class="truncate">
                <div class="text-base font-semibold truncate">
                  {{ bank?.name || "Banco de Sangue" }}
                </div>
                <div class="text-xs text-gray-500">Selecionar Datas</div>
              </div>
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
        <div v-if="loading" class="grid grid-cols-2 md:grid-cols-3 gap-3">
          <USkeleton v-for="i in 6" :key="i" class="h-24" />
        </div>
        <div v-else class="space-y-4">
          <!-- Explicação sobre as datas -->
          <div
            class="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800"
          >
            <div class="flex items-start gap-2">
              <UIcon name="i-lucide-info" class="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <strong>Datas possíveis para sua instituição:</strong> Selecione
                até 3 datas em que sua instituição pode receber a coleta. O
                banco de sangue escolherá a melhor data entre as opções
                fornecidas.
              </div>
            </div>
          </div>

          <UCalendar
            multiple
            v-model="calendarValue"
            color="primary"
            @update:model-value="onCalendarChange"
            :is-date-unavailable="(day) => isDateUnavailable(day)"
            :initial-focus="false"
          >
            <template #day="{ day }">
              <div
                class="relative inline-flex items-center justify-center w-8 h-8"
              >
                <span>{{ day.day }}</span>
                <UIcon
                  v-if="hasAvailability(day)"
                  name="i-lucide-map-pin"
                  class="absolute -top-1 -right-1 w-3.5 h-3.5 text-green-500"
                />
              </div>
            </template>
          </UCalendar>

          <div class="space-y-2">
            <div class="flex items-center justify-between gap-3">
              <div class="text-sm text-gray-600">
                Selecionadas: {{ selected.length }}/3
              </div>
              <!-- Alerta quando menos de 3 datas -->
              <Transition name="fade" mode="out-in">
                <div
                  v-if="selected.length > 0 && selected.length < 3"
                  class="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-md"
                >
                  <UIcon name="i-lucide-alert-circle" class="w-3.5 h-3.5" />
                  <span
                    >Recomendamos selecionar 3 datas para aumentar as chances de
                    aprovação</span
                  >
                </div>
              </Transition>
            </div>
            <div class="grid md:grid-cols-2 gap-3" v-auto-animate>
              <UCard v-for="sd in selected" :key="sd.availableDateId">
                <div class="font-medium">{{ formatPt(sd.date || "") }}</div>
                <div class="text-xs text-gray-500 mt-1" v-if="sd.date">
                  <template
                    v-if="uniqueTimeRanges(sd.availableDateId).length === 1"
                  >
                    <span>
                      Horário: {{ uniqueTimeRanges(sd.availableDateId)[0] }}
                    </span>
                  </template>
                  <template v-else>
                    <div class="space-y-2">
                      <div class="text-gray-600">
                        Selecione um horário (opcional)
                      </div>
                      <USelect
                        :items="getTimeItemsWithAny(sd.availableDateId)"
                        placeholder="Qualquer horário do dia"
                        v-model="selectedRangeByDateId[sd.availableDateId]"
                        class="max-w-xs"
                        :clearable="true"
                      />
                    </div>
                  </template>
                </div>
              </UCard>
            </div>
          </div>
        </div>

        <div class="mt-4 md:mt-6 flex items-center justify-end">
          <UButton
            :disabled="selected.length === 0"
            color="primary"
            @click="submit"
            >Agendar Coleta</UButton
          >
        </div>
      </UCard>
    </Transition>

    <!-- Confirmation Modal -->
    <UModal v-model:open="showConfirmationModal" :dismissible="false">
      <template #content>
        <div class="p-6 space-y-4">
          <div class="text-center">
            <UIcon
              name="i-lucide-check-circle"
              class="w-16 h-16 mx-auto mb-4 text-green-500"
            />
            <h3 class="text-xl font-semibold mb-2">Solicitação Enviada!</h3>
            <p class="text-gray-600 mb-4">
              Sua solicitação de coleta foi enviada com sucesso. Você será
              notificado quando o pedido for aceito ou recusado pelo banco de
              sangue.
            </p>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: "agendamento" });
import { useSchedulingStore } from "~/stores/scheduling";
import { useUserStore } from "~/stores/user";
import { redirectToID } from "~/middleware/auth";
import { CalendarDate, type DateValue } from "@internationalized/date";

const route = useRoute();
const slug = computed(() => route.params.bloodbankSlug as string);
const store = useSchedulingStore();
const { accessedAgendarPage, selectedInstitution } = storeToRefs(store);
const userStore = useUserStore();
const { user } = storeToRefs(userStore);

const isLoggedIn = computed(() => Boolean(user.value));
const showConfirmationModal = ref(false);
const loading = ref(true);

onBeforeMount(async () => {
  loading.value = true;
  if (!selectedInstitution.value) {
    await store.selectFirstInstitution();
  }

  // Load bank info for submission context (only if authenticated and has institution)
  if (isLoggedIn.value && selectedInstitution.value) {
    const { data: bankData } = await useFetchWithAuth(
      `/api/v1/bloodbanks/${slug.value}`
    );
    bank.value = (bankData.value?.data as any) || null;
    if (bank.value) {
      store.setSelectedBloodBank({
        _id: "",
        name: bank.value.name,
        slug: slug.value,
        logo: bank.value.logo || null,
        bloodBanksLocationId: bank.value.bloodBanksLocationId,
      });
    }
    await loadDates();
  }
  updateHeadTitle();
  loading.value = false;
});

const dates = ref<any[]>([]);
const bank = ref<{
  name: string;
  logo: string | null;
  bloodBanksLocationId: string;
} | null>(null);

const selected = computed(() => store.selectedDates);
const calendarValue = ref<any>([]);
const dateToAvailableMap = computed<Record<string, any>>(() => {
  const map: Record<string, any> = {};
  for (const d of dates.value) map[d.date] = d;
  return map;
});

// Guarda seleção opcional de horário por data selecionada
const selectedRangeByDateId = ref<Record<string, string | undefined>>({});

const onCalendarChange = (vals: any) => {
  // Limit to 3 selections
  if (!Array.isArray(vals)) {
    // Se não é array (null/undefined), limpar seleção
    store.selectedDates = [];
    calendarValue.value = [];
    return;
  }
  if (vals.length > 3) vals.splice(3);
  const toStr = (cd: any) =>
    `${cd.year}-${String(cd.month).padStart(2, "0")}-${String(cd.day).padStart(
      2,
      "0"
    )}`;
  const selectedDatesStrings = vals
    .map(toStr)
    .filter((s) => Boolean(dateToAvailableMap.value[s]));
  store.selectedDates = selectedDatesStrings.map((s) => ({
    availableDateId: dateToAvailableMap.value[s]._id,
    date: s,
  }));

  // Sincronizar calendarValue com as datas válidas selecionadas
  calendarValue.value = vals.filter((v: any) => {
    const dateStr = toStr(v);
    return Boolean(dateToAvailableMap.value[dateStr]);
  });
};

const formatPt = (dateStr: string) => {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
};

const formatTimeRange = (start: string | Date, end: string | Date) => {
  const s = new Date(start);
  const e = new Date(end);
  const fmt: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
  };
  return `${s.toLocaleTimeString("pt-BR", fmt)} - ${e.toLocaleTimeString(
    "pt-BR",
    fmt
  )}`;
};

const uniqueTimeRanges = (availableDateId: string) => {
  const ad = dates.value.find((d: any) => d._id === availableDateId);
  if (!ad) return [] as string[];
  const ranges = ad.slots.map((s: any) =>
    formatTimeRange(s.startTime, s.endTime)
  );
  return Array.from(new Set(ranges));
};

const getTimeItemsWithAny = (availableDateId: string) => {
  const ranges = uniqueTimeRanges(availableDateId) as string[];
  const items = ranges.map((r) => ({ label: r, value: r }));
  // Adicionar opção "Qualquer horário do dia" no início
  items.unshift({ label: "Qualquer horário do dia", value: "any" });
  return items;
};

const loadDates = async () => {
  loading.value = true;
  try {
    const { data } = await useFetchWithAuth(
      `/api/v1/bloodbanks/${slug.value}/available-dates`,
      { query: { monthsAhead: 12 } }
    );
    dates.value = data.value?.data || [];
  } finally {
    loading.value = false;
  }
};

const updateHeadTitle = () => {
  useHead({
    title: bank.value
      ? "Agendar Coleta - " + bank.value.name
      : "Agendar Coleta",
  });
};

updateHeadTitle();

const back = () => {
  navigateTo("/agendar");
};

const onLogin = () => {
  redirectToID(route.fullPath);
};

const submit = async () => {
  if (!isLoggedIn.value) {
    return redirectToID(route.fullPath);
  }
  if (!selectedInstitution.value) {
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
      `/api/v1/institutions/${selectedInstitution.value.id}/collection-requests`,
      {
        method: "POST",
        body: payload as any,
      }
    );
    showConfirmationModal.value = true;
  } catch (e: any) {
    // Verificar se é o erro de solicitação duplicada
    const errorMessage = e?.data?.message || e?.message || "";
    if (errorMessage.includes("já possui uma solicitação em aberto")) {
      useToast().add({
        title: "Solicitação duplicada",
        description:
          "Sua instituição já possui uma solicitação em aberto para este banco de sangue. Aguarde a resposta antes de criar uma nova solicitação.",
        color: "warning",
      });
    } else {
      useToast().add({
        title: "Erro ao enviar solicitação",
        description: errorMessage || "Tente novamente mais tarde",
        color: "error",
      });
    }
  }
};

const currentCalendarDate = computed<CalendarDate>((): CalendarDate => {
  const now = new Date();
  return new CalendarDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
});

const isDateUnavailable = (day: DateValue) => {
  // disable dates that are in the past (considerando ano, mês e dia)
  const today = currentCalendarDate.value;
  if (day.year < today.year) return true;
  if (day.year === today.year && day.month < today.month) return true;
  if (
    day.year === today.year &&
    day.month === today.month &&
    day.day <= today.day
  )
    return true;
  // bloquear clique em datas sem disponibilidade
  return !hasAvailability(day);
};

const hasAvailability = (day: DateValue) => {
  const key = `${day.year}-${String(day.month).padStart(2, "0")}-${String(
    day.day
  ).padStart(2, "0")}`;
  return Boolean(dateToAvailableMap.value[key]);
};
</script>

<style scoped>
/* Remove o destaque vermelho do dia atual */
:deep([data-today="true"]) {
  color: inherit !important;
  background-color: transparent !important;
}

/* Remove border/outline do dia atual */
:deep([data-today="true"]:not([data-selected="true"])) {
  border-color: transparent !important;
  outline: none !important;
}
</style>
