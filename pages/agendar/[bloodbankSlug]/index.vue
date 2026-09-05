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
          <!-- Restrições do Banco de Sangue -->
          <div v-if="restrictions.length > 0" class="space-y-3">
            <UCollapsible
              v-model:open="restrictionsOpen"
              @update:open="onRestrictionsOpenChange"
              class="bg-amber-50 border border-amber-200 rounded-lg overflow-hidden"
            >
              <UButton
                class="w-full justify-between group"
                color="neutral"
                variant="ghost"
                :ui="{
                  trailingIcon:
                    'group-data-[state=open]:rotate-180 transition-transform duration-200',
                }"
                trailing-icon="i-lucide-chevron-down"
              >
                <div class="flex items-center gap-2 flex-1 text-left">
                  <UIcon
                    name="i-lucide-shield-alert"
                    class="w-5 h-5 shrink-0 text-amber-600"
                  />
                  <span class="font-semibold text-amber-900">
                    Restrições e Requisitos do Banco de Sangue
                  </span>
                </div>
              </UButton>
              <template #content>
                <div class="p-4 pt-0 space-y-4">
                  <p class="text-sm text-amber-800">
                    Antes de solicitar a coleta, verifique se sua instituição
                    atende aos seguintes requisitos:
                  </p>
                  <div class="space-y-3" v-auto-animate>
                    <div
                      v-for="restriction in restrictions"
                      :key="restriction.slug"
                      class="bg-white rounded-md p-3 border border-amber-200"
                    >
                      <h4 class="font-medium text-gray-900 mb-1">
                        {{ restriction.title }}
                      </h4>
                      <p class="text-sm text-gray-700 leading-relaxed">
                        {{ restriction.description }}
                      </p>
                    </div>
                  </div>
                </div>
              </template>
            </UCollapsible>
            <div class="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <UCheckbox
                v-model="hasReadRestrictions"
                :disabled="!hasOpenedRestrictions"
                label="Li e compreendi todas as restrições acima"
                :ui="{
                  label: 'text-sm font-medium text-amber-900',
                }"
              />
              <p
                v-if="!hasOpenedRestrictions"
                class="text-xs text-amber-700 mt-2 ml-6"
              >
                Leia as restrições acima antes de aceitá-las
              </p>
            </div>
          </div>

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
            <div v-if="selected.length > 1" class="text-xs text-gray-500">
              Use as setas para ordenar da sua opção preferida para a menos
              preferida.
            </div>
            <div class="grid md:grid-cols-2 gap-3" v-auto-animate>
              <UCard v-for="(sd, index) in selected" :key="sd.availableDateId">
                <div class="flex items-start justify-between gap-2">
                  <div>
                    <UBadge color="primary" variant="subtle" size="sm">
                      {{ priorityLabel(index) }}
                    </UBadge>
                    <div class="font-medium mt-1">
                      {{ formatPt(sd.date || "") }}
                    </div>
                  </div>
                  <div v-if="selected.length > 1" class="flex flex-col gap-1">
                    <UButton
                      icon="i-lucide-chevron-up"
                      color="neutral"
                      variant="ghost"
                      size="xs"
                      :disabled="index === 0"
                      aria-label="Subir prioridade"
                      @click="store.moveSelectedDate(index, 'up')"
                    />
                    <UButton
                      icon="i-lucide-chevron-down"
                      color="neutral"
                      variant="ghost"
                      size="xs"
                      :disabled="index === selected.length - 1"
                      aria-label="Descer prioridade"
                      @click="store.moveSelectedDate(index, 'down')"
                    />
                  </div>
                </div>
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

        <!-- Estimativa do Evento -->
        <div class="space-y-3 mt-4">
          <h3 class="text-sm font-semibold text-gray-700">
            Estimativa do Evento
          </h3>
          <p class="text-xs text-gray-500">
            {{ estimateSectionHint }}
          </p>
          <div class="grid md:grid-cols-2 gap-3">
            <UFormField
              v-if="isCompanyInstitution"
              label="Funcionários no recinto"
              required
            >
              <UInput
                v-model="venueAudienceSize"
                placeholder="Ex: 1200"
                icon="i-lucide-building-2"
                type="number"
                inputmode="numeric"
                min="1"
                max="200000"
                size="xl"
                class="w-full"
              />
            </UFormField>
            <UFormField :label="participantFieldLabel" required>
              <UInput
                v-model="estimatedAttendees"
                placeholder="Ex: 300"
                icon="i-lucide-users"
                type="number"
                inputmode="numeric"
                min="1"
                max="200000"
                size="xl"
                class="w-full"
              />
            </UFormField>
          </div>
          <div
            class="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800"
          >
            <div class="flex items-start gap-2">
              <UIcon
                name="i-lucide-truck"
                class="w-4 h-4 mt-0.5 shrink-0 text-amber-600"
              />
              <div>
                <strong>Logística do espaço:</strong> o local precisa estar
                disponível <strong>1 hora antes</strong> do horário da coleta
                para montagem e por <strong>ao menos 1 hora depois</strong>
                para desmontagem da equipe e dos equipamentos.
              </div>
            </div>
          </div>
        </div>

        <!-- Ponto Focal (Host) -->
        <div class="space-y-3 mt-4">
          <h3 class="text-sm font-semibold text-gray-700">
            Ponto Focal no Local
          </h3>
          <p class="text-xs text-gray-500">
            Informe os dados da pessoa responsável por receber a equipe de coleta
            no local.
          </p>
          <div class="grid md:grid-cols-2 gap-3">
            <UFormField label="Nome" required>
              <UInput
                v-model="hostName"
                placeholder="Nome completo"
                icon="i-lucide-user"
              />
            </UFormField>
            <UFormField label="Email" required>
              <UInput
                v-model="hostEmail"
                placeholder="email@exemplo.com"
                icon="i-lucide-mail"
                type="email"
              />
            </UFormField>
            <UFormField label="Telefone" required>
              <UInput
                v-model="hostPhone"
                placeholder="(11) 99999-9999"
                icon="i-lucide-phone"
                type="tel"
              />
            </UFormField>
          </div>
        </div>

        <!-- Endereço do Local da Coleta -->
        <div class="space-y-3 mt-4">
          <h3 class="text-sm font-semibold text-gray-700">
            Endereço do Local da Coleta
          </h3>
          <p class="text-xs text-gray-500">
            Informe o endereço onde a coleta será realizada. Pode ser diferente
            do endereço da instituição.
          </p>
          <div class="grid md:grid-cols-2 gap-3">
            <UFormField label="CEP" required>
              <UInput
                :model-value="addressZipCode"
                @update:model-value="onCepInput"
                placeholder="00000-000"
                icon="i-lucide-map-pin"
                maxlength="9"
              />
            </UFormField>
            <UFormField label="Rua" required>
              <UInput
                v-model="addressStreet"
                placeholder="Nome da rua"
                icon="i-lucide-map"
              />
            </UFormField>
            <UFormField label="Número" required>
              <UInput
                v-model="addressNumber"
                placeholder="123"
              />
            </UFormField>
            <UFormField label="Complemento">
              <UInput
                v-model="addressComplement"
                placeholder="Sala, andar, bloco..."
              />
            </UFormField>
            <UFormField label="Bairro" required>
              <UInput
                v-model="addressNeighborhood"
                placeholder="Bairro"
              />
            </UFormField>
            <UFormField label="Cidade" required>
              <UInput
                v-model="addressCity"
                placeholder="Cidade"
              />
            </UFormField>
            <UFormField label="Estado" required>
              <USelect
                v-model="addressState"
                :items="brStates"
                placeholder="UF"
              />
            </UFormField>
          </div>
        </div>

        <!-- Nota adicional -->
        <div class="space-y-3 mt-4">
          <h3 class="text-sm font-semibold text-gray-700">
            Nota Adicional (opcional)
          </h3>
          <p class="text-xs text-gray-500">
            Informe qualquer detalhe relevante para o banco de sangue, como um
            evento com mais de um dia de coleta.
          </p>
          <UFormField>
            <UTextarea
              v-model="note"
              placeholder="Ex: evento com dois dias de coleta, atender pela manhã..."
              :rows="3"
              :maxlength="500"
              class="w-full"
            />
          </UFormField>
        </div>

        <div class="mt-4 md:mt-6 flex items-center justify-end">
          <UButton
            :disabled="
              selected.length === 0 ||
              (restrictions.length > 0 && !hasReadRestrictions) ||
              !isHostValid ||
              !isAddressValid ||
              !isEstimateValid
            "
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
            <div v-if="trackingUrl" class="bg-gray-50 rounded-lg p-3 text-sm">
              <p class="text-gray-600 mb-2">
                Acompanhe o status da sua solicitação pelo link abaixo:
              </p>
              <div class="flex items-center gap-2">
                <UInput
                  :model-value="trackingUrl"
                  readonly
                  class="flex-1"
                  size="sm"
                />
                <UButton
                  size="sm"
                  variant="soft"
                  icon="i-lucide-copy"
                  @click="copyTrackingUrl"
                >
                  Copiar
                </UButton>
              </div>
            </div>
          </div>
          <div class="flex justify-end gap-2">
            <UButton
              v-if="trackingUrl"
              variant="soft"
              @click="navigateTo(trackingUrl, { external: true })"
            >
              Acompanhar Pedido
            </UButton>
            <UButton color="primary" @click="closeConfirmationModal">
              Fechar
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: "agendamento", keepalive: false });
import { useSchedulingStore } from "~/stores/scheduling";
import { useUserStore } from "~/stores/user";
import { redirectToID } from "~/utils/redirectToID";
import { CalendarDate, type DateValue } from "@internationalized/date";

const route = useRoute();
const slug = computed(() => route.params.bloodbankSlug as string);
const store = useSchedulingStore();
const { accessedAgendarPage, selectedInstitution } = storeToRefs(store);
const userStore = useUserStore();
const { user } = storeToRefs(userStore);

const isLoggedIn = computed(() => Boolean(user.value));
const SCHEDULE_TIMEZONE = "America/Sao_Paulo";
const showConfirmationModal = ref(false);
const trackingUrl = ref("");
const loading = ref(true);

// Host (Ponto Focal) fields - pre-filled with logged-in user data
const hostName = ref("");
const hostEmail = ref("");
const hostPhone = ref("");

const initHostFromUser = () => {
  if (user.value) {
    hostName.value =
      `${user.value.givenName || ""} ${user.value.surName || ""}`.trim();
    hostEmail.value = user.value.email || "";
    hostPhone.value = user.value.phone || "";
  }
};

const isValidEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const isHostValid = computed(
  () =>
    hostName.value.trim().length > 0 &&
    isValidEmail(hostEmail.value) &&
    hostPhone.value.trim().length > 0
);

// Address fields - pre-filled from institution if available
const addressStreet = ref("");
const addressNumber = ref("");
const addressComplement = ref("");
const addressNeighborhood = ref("");
const addressCity = ref("");
const addressState = ref("");
const addressZipCode = ref("");

const note = ref("");

// Estimativa do evento (participantes esperados e, para empresas, o
// total de funcionários no recinto). As bolsas não são estimadas pela
// instituição: o banco de sangue aplica a taxa de conversão (≈80%).
const estimatedAttendees = ref<number | null>(null);
const venueAudienceSize = ref<number | null>(null);

const isCompanyInstitution = computed(
  () => (selectedInstitution.value?.kind as string | undefined) === "company"
);
const isSchoolInstitution = computed(() =>
  ["school", "university"].includes(
    (selectedInstitution.value?.kind as string | undefined) || ""
  )
);

const estimateSectionHint = computed(() => {
  if (isCompanyInstitution.value) {
    return "Quantos funcionários a empresa tem no recinto e quantos você espera que participem do evento.";
  }
  if (isSchoolInstitution.value) {
    return "Quantos alunos, pais, amigos e professores você espera que participem da coleta.";
  }
  return "Quantas pessoas você espera que participem do evento.";
});

const participantFieldLabel = computed(() => {
  if (isCompanyInstitution.value) {
    return "Funcionários que devem participar";
  }
  if (isSchoolInstitution.value) {
    return "Alunos, pais, amigos e professores esperados";
  }
  return "Participantes esperados";
});

const isEstimateValid = computed(
  () =>
    Number(estimatedAttendees.value) >= 1 &&
    (!isCompanyInstitution.value || Number(venueAudienceSize.value) >= 1)
);

const brStates = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO",
].map((s) => ({ label: s, value: s }));

const formatCep = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length > 5) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return digits;
};

const onCepInput = (value: string) => {
  addressZipCode.value = formatCep(value);
};

const isAddressValid = computed(
  () =>
    addressStreet.value.trim().length > 0 &&
    addressNumber.value.trim().length > 0 &&
    addressNeighborhood.value.trim().length > 0 &&
    addressCity.value.trim().length > 0 &&
    addressState.value.length === 2 &&
    addressZipCode.value.replace(/\D/g, "").length === 8
);

const initAddressFromInstitution = () => {
  if (selectedInstitution.value) {
    addressCity.value = selectedInstitution.value.city || "";
    addressState.value = selectedInstitution.value.state || "";
  }
};

onBeforeMount(async () => {
  loading.value = true;
  if (!selectedInstitution.value) {
    await store.selectFirstInstitution();
  }

  // Pre-fill host fields with user data
  initHostFromUser();
  initAddressFromInstitution();

  // Load bank info for submission context (only if authenticated and has institution)
  if (isLoggedIn.value && selectedInstitution.value) {
    const bankData = await fetchWithAuth(
      `/api/v1/bloodbanks/${slug.value}`
    );
    bank.value = (bankData?.data as any) || null;
    if (bank.value) {
      store.setSelectedBloodBank({
        _id: "",
        name: bank.value.name,
        slug: slug.value,
        logo: bank.value.logo || null,
        bloodBanksLocationId: bank.value.bloodBanksLocationId,
      });
    }
    await Promise.all([loadDates(), loadRestrictions()]);
  }
  updateHeadTitle();
  loading.value = false;
});

const dates = ref<any[]>([]);
const restrictions = ref<
  Array<{
    slug: string;
    title: string;
    description: string;
  }>
>([]);
const hasReadRestrictions = ref(false);
const restrictionsOpen = ref(false);
const hasOpenedRestrictions = ref(false);

const onRestrictionsOpenChange = (open: boolean) => {
  if (open && !hasOpenedRestrictions.value) {
    hasOpenedRestrictions.value = true;
  }
};
const bank = ref<{
  name: string;
  logo: string | null;
  bloodBanksLocationId: string;
} | null>(null);

const restoreSelectedBloodBank = () => {
  if (!bank.value) return;
  store.setSelectedBloodBank({
    _id: "",
    name: bank.value.name,
    slug: slug.value,
    logo: bank.value.logo || null,
    bloodBanksLocationId: bank.value.bloodBanksLocationId,
  });
};

const selected = computed(() => store.selectedDates);
const calendarValue = ref<any>([]);
const dateToAvailableMap = computed<Record<string, any>>(() => {
  const map: Record<string, any> = {};
  for (const d of dates.value) map[d.date] = d;
  return map;
});

// Guarda seleção opcional de horário por data selecionada
const selectedRangeByDateId = ref<Record<string, string | undefined>>({});

watch(
  () => selectedInstitution.value?.id,
  (institutionId, previousInstitutionId) => {
    if (!institutionId || institutionId === previousInstitutionId) return;

    initAddressFromInstitution();
    store.selectedDates = [];
    calendarValue.value = [];
    selectedRangeByDateId.value = {};
    hasReadRestrictions.value = false;
    restoreSelectedBloodBank();
  }
);

const priorityLabel = (index: number) => {
  const labels = ["1ª opção preferida", "2ª opção", "3ª opção"];
  return labels[index] || `${index + 1}ª opção`;
};

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

  // Preserva a ordem (prioridade) das datas já selecionadas e reordenadas
  // manualmente; novas datas escolhidas no calendário entram no fim da lista.
  const selectedSet = new Set(selectedDatesStrings);
  const kept = store.selectedDates.filter(
    (d) => d.date && selectedSet.has(d.date)
  );
  const keptDates = new Set(kept.map((d) => d.date));
  const added = selectedDatesStrings
    .filter((s) => !keptDates.has(s))
    .map((s) => ({
      availableDateId: dateToAvailableMap.value[s]._id,
      date: s,
    }));
  store.selectedDates = [...kept, ...added];

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

const formatTime = (time: string | Date) => {
  if (typeof time === "string" && /^\d{2}:\d{2}$/.test(time)) {
    return time;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: SCHEDULE_TIMEZONE,
  }).format(typeof time === "string" ? new Date(time) : time);
};

const formatTimeRange = (start: string | Date, end: string | Date) => {
  return `${formatTime(start)} - ${formatTime(end)}`;
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

const getSelectedSlotRange = (availableDateId: string) => {
  const availableDate = dates.value.find(
    (date: any) => date._id === availableDateId
  );
  if (!availableDate) return undefined;

  const ranges = uniqueTimeRanges(availableDateId);
  const selectedRange = selectedRangeByDateId.value[availableDateId];
  if (selectedRange === "any" || (!selectedRange && ranges.length !== 1)) {
    return undefined;
  }

  const range = selectedRange || ranges[0];
  const matchingSlots = availableDate.slots.filter(
    (slot: any) => formatTimeRange(slot.startTime, slot.endTime) === range
  );
  const firstSlot = matchingSlots[0];
  if (!firstSlot) return undefined;

  return {
    slotIds: matchingSlots.map((slot: any) => slot._id),
    startTime: formatTime(firstSlot.startTime),
    endTime: formatTime(firstSlot.endTime),
  };
};

const loadDates = async () => {
  try {
    const data = await fetchWithAuth(
      `/api/v1/bloodbanks/${slug.value}/available-dates`,
      { query: { monthsAhead: 12 } }
    );
    dates.value = data?.data || [];
  } catch (error) {
    console.error("Error loading dates:", error);
  }
};

const loadRestrictions = async () => {
  try {
    const data = await fetchWithAuth(
      `/api/v1/bloodbanks/${slug.value}/restrictions`
    );
    restrictions.value = data?.data || [];
    // Reset checkbox quando carregar novas restrições
    hasReadRestrictions.value = false;
  } catch (error) {
    console.error("Error loading restrictions:", error);
    restrictions.value = [];
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

const copyTrackingUrl = async () => {
  try {
    await navigator.clipboard.writeText(trackingUrl.value);
    useToast().add({ title: "Link copiado!", color: "success" });
  } catch {
    useToast().add({ title: "Erro ao copiar link", color: "error" });
  }
};

const closeConfirmationModal = () => {
  showConfirmationModal.value = false;
  trackingUrl.value = "";
  // Reset form state
  store.selectedDates = [];
  calendarValue.value = [];
  hasReadRestrictions.value = false;
  selectedRangeByDateId.value = {};
  initHostFromUser();
  initAddressFromInstitution();
  addressStreet.value = "";
  addressNumber.value = "";
  addressComplement.value = "";
  addressNeighborhood.value = "";
  addressZipCode.value = "";
  note.value = "";
  estimatedAttendees.value = null;
  venueAudienceSize.value = null;
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

  if (restrictions.value.length > 0 && !hasReadRestrictions.value) {
    useToast().add({
      title: "Leia as restrições",
      description:
        "Você precisa confirmar que leu e compreendeu todas as restrições antes de enviar a solicitação.",
      color: "warning",
    });
    return;
  }

  if (!isEstimateValid.value) {
    useToast().add({
      title: "Preencha a estimativa do evento",
      description:
        "Informe o público estimado do recinto e o número de bolsas esperadas.",
      color: "warning",
    });
    return;
  }

  try {
    const payload = {
      bloodBanksLocationId: store.selectedBloodBank.bloodBanksLocationId,
      requestedDates: selected.value.map((d, index) => ({
        availableDateId: d.availableDateId,
        priority: index + 1,
        ...getSelectedSlotRange(d.availableDateId),
      })),
      host: {
        name: hostName.value.trim(),
        email: hostEmail.value.trim(),
        phone: hostPhone.value.trim(),
      },
      address: {
        street: addressStreet.value.trim(),
        number: addressNumber.value.trim(),
        complement: addressComplement.value.trim() || undefined,
        neighborhood: addressNeighborhood.value.trim(),
        city: addressCity.value.trim(),
        state: addressState.value,
        zipCode: addressZipCode.value.replace(/\D/g, ""),
      },
      note: note.value.trim() || undefined,
      estimatedAttendees: Number(estimatedAttendees.value),
      venueAudienceSize: isCompanyInstitution.value
        ? Number(venueAudienceSize.value)
        : undefined,
    };
    const res = await fetchWithAuth<{ success: boolean; data: { accessToken?: string } }>(
      `/api/v1/institutions/${selectedInstitution.value.id}/collection-requests`,
      {
        method: "POST",
        body: payload as any,
      }
    );
    const token = res?.data?.accessToken;
    if (token) {
      const baseUrl = window.location.origin;
      trackingUrl.value = `${baseUrl}/agendar/acompanhar/${token}`;
    }
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
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SCHEDULE_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)])
  );
  return new CalendarDate(values.year, values.month, values.day);
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
