<template>
  <div class="flex flex-col gap-8">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">
          Detalhes da Solicitação
        </h1>
        <p class="text-gray-600 mt-1">
          Informações completas da solicitação de coleta
        </p>
      </div>
      <UButton variant="ghost" icon="i-lucide-arrow-left" @click="goBack">
        Voltar
      </UButton>
    </div>

    <!-- Loading State -->
    <Transition name="fade" mode="out-in">
      <div v-if="isLoading" class="flex items-center justify-center py-12">
        <USpinner size="lg" />
        <span class="ml-3 text-gray-600">Carregando detalhes...</span>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="text-center py-12">
        <UIcon
          name="i-lucide-alert-circle"
          class="w-16 h-16 text-red-400 mx-auto mb-4"
        />
        <h3 class="text-lg font-medium text-gray-900 mb-2">
          Erro ao carregar solicitação
        </h3>
        <p class="text-gray-600 mb-4">{{ error }}</p>
        <UButton @click="loadRequestDetails">Tentar novamente</UButton>
      </div>

      <!-- Request Details -->
      <div v-else-if="request" class="space-y-6">
        <!-- Institution Information Card -->
        <UCard>
          <template #header>
            <div class="flex items-center space-x-4">
              <UAvatar
                v-if="request.institutionLogo"
                :src="request.institutionLogo"
                :alt="request.institutionName"
                size="lg"
              />
              <UAvatar
                v-else
                :alt="request.institutionName"
                size="lg"
                class="bg-blue-500"
              >
                {{ request.institutionName.charAt(0) }}
              </UAvatar>
              <div>
                <h2 class="text-xl font-semibold text-gray-900">
                  {{ request.institutionName }}
                </h2>
                <p class="text-gray-600">{{ request.institutionAddress }}</p>
              </div>
            </div>
          </template>

          <div class="space-y-4">
            <!-- Status Badge -->
            <div class="flex items-center justify-between">
              <UBadge
                :color="getStatusColor(request.status)"
                variant="subtle"
                size="lg"
              >
                {{ getStatusLabel(request.status) }}
              </UBadge>
              <span class="text-sm text-gray-500">
                Criado em {{ formatDate(request.createdAt) }}
              </span>
            </div>

            <!-- Institution Details -->
            <!-- <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 class="text-sm font-medium text-gray-900 mb-2">
                Informações da Instituição
              </h4>
              <div class="space-y-2 text-sm">
                <div class="flex justify-between">
                  <span class="text-gray-600">ID da Instituição:</span>
                  <span class="font-mono text-xs">{{
                    request.institutionId
                  }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-600">Solicitado por:</span>
                  <span class="font-mono text-xs">{{
                    request.requestedByUserId
                  }}</span>
                </div>
              </div>
            </div>

            <div>
              <h4 class="text-sm font-medium text-gray-900 mb-2">
                Localização
              </h4>
              <div class="space-y-2 text-sm">
                <div class="flex justify-between">
                  <span class="text-gray-600">Latitude:</span>
                  <span>{{ request.institutionLocation.coordinates[1] }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-600">Longitude:</span>
                  <span>{{ request.institutionLocation.coordinates[0] }}</span>
                </div>
              </div>
            </div>
          </div> -->
          </div>
        </UCard>

        <!-- Map Card -->
        <UCard v-if="request.institutionLocation">
          <template #header>
            <h3 class="text-lg font-semibold text-gray-900">Localização</h3>
          </template>

          <div class="h-96 rounded-lg overflow-hidden">
            <MglMap
              :map-style="mapStyle"
              :center="mapCenter"
              :zoom="mapZoom"
              ref="mapRef"
              @map:load="initializeMap"
            >
              <MglNavigationControl />

              <!-- Institution Marker -->
              <MglMarker
                :coordinates="[
                  request.institutionLocation.coordinates[0],
                  request.institutionLocation.coordinates[1],
                ]"
                :color="'#3B82F6'"
              >
                <!-- MglPopup and marker visuals for institution -->
                <template v-if="request.institutionLogo" v-slot:marker>
                  <div class="flex flex-col items-center">
                    <NuxtImg
                      :src="request.institutionLogo"
                      :alt="`Logo da instituição ${request.institutionName}`"
                      class="w-8 h-8 rounded-full object-cover border-2"
                      style="border-color: #3b82f6"
                    />
                    <svg
                      class="mt-[-2px]"
                      width="10"
                      height="6"
                      viewBox="0 0 10 6"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <polygon points="5,6 0,0 10,0" fill="#3B82F6" />
                    </svg>
                  </div>
                </template>
                <MglPopup
                  v-if="!request.institutionLogo"
                  ref="institutionPopup"
                  :close-button="false"
                  :offset="[0, -40]"
                >
                  <div class="flex items-center space-x-3">
                    <div class="shrink-0">
                      <NuxtImg
                        v-if="request.institutionLogo"
                        :src="request.institutionLogo"
                        :alt="`Logo da instituição ${request.institutionName}`"
                        class="w-8 h-8 rounded-full object-cover"
                      />
                      <div
                        v-else
                        class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center"
                      >
                        <svg
                          class="w-5 h-5 text-blue-600"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"
                          />
                        </svg>
                      </div>
                    </div>
                    <div>
                      <h3 class="text-lg font-semibold text-gray-800">
                        {{ request.institutionName }}
                      </h3>
                      <p class="text-sm text-gray-600">
                        {{ request.institutionAddress }}
                      </p>
                    </div>
                  </div>
                </MglPopup>
              </MglMarker>

              <!-- Blood Bank Marker -->
              <MglMarker
                v-if="bloodbankData?.location"
                :coordinates="[
                  bloodbankData.location.coordinates[0],
                  bloodbankData.location.coordinates[1],
                ]"
                :color="'#bb0a08'"
              >
                <!-- MglPopup for bloodbank info -->
                <template v-if="bloodbankData.logo" v-slot:marker>
                  <div class="flex flex-col items-center">
                    <NuxtImg
                      :src="bloodbankData.logo"
                      :alt="`Logo do ${bloodbankData.name}`"
                      class="w-8 h-8 rounded-full object-cover border-2"
                      style="border-color: #bb0a08"
                    />
                    <svg
                      class="mt-[-2px]"
                      width="10"
                      height="6"
                      viewBox="0 0 10 6"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <polygon points="5,6 0,0 10,0" fill="#bb0a08" />
                    </svg>
                  </div>
                </template>
                <MglPopup
                  v-if="!bloodbankData.logo"
                  ref="bloodbankPopup"
                  :close-button="false"
                  :offset="[0, -40]"
                >
                  <div class="flex items-center space-x-3">
                    <div class="shrink-0">
                      <NuxtImg
                        v-if="bloodbankData.logo"
                        :src="bloodbankData.logo"
                        :alt="`Logo do ${bloodbankData.name}`"
                        class="w-8 h-8 rounded-full object-cover"
                      />
                      <div
                        v-else
                        class="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center"
                      >
                        <svg
                          class="w-5 h-5 text-red-600"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"
                          />
                        </svg>
                      </div>
                    </div>
                    <h3 class="text-lg font-semibold text-grey-800">
                      {{ bloodbankData.name }}
                    </h3>
                  </div>
                </MglPopup>
              </MglMarker>
            </MglMap>
          </div>
        </UCard>

        <!-- Requested Dates Card -->
        <UCard>
          <template #header>
            <h3 class="text-lg font-semibold text-gray-900">
              Opções de Horário
            </h3>
          </template>

          <div class="space-y-4">
            <div
              v-for="(slot, index) in request.availableSlotOptions"
              :key="index"
              class="border rounded-lg p-4 transition-all duration-200 hover:shadow-md"
              :class="{
                'border-green-500 bg-green-50':
                  request.status === 'accepted' &&
                  request.selectedAvailableDateId === slot.availableDateId &&
                  request.selectedSlotId === slot.slotId,
                'border-gray-300 bg-gray-100 opacity-60': slot.isLocked,
                'border-blue-300 bg-blue-50':
                  slot.isRequested && !slot.isLocked,
                'border-gray-200':
                  !(
                    request.status === 'accepted' &&
                    request.selectedAvailableDateId === slot.availableDateId &&
                    request.selectedSlotId === slot.slotId
                  ) && !slot.isLocked,
              }"
            >
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center space-x-2">
                  <h4
                    class="font-medium"
                    :class="slot.isLocked ? 'text-gray-500' : 'text-gray-900'"
                  >
                    Opção {{ index + 1 }}
                  </h4>
                  <UBadge
                    v-if="slot.isRequested"
                    color="primary"
                    variant="subtle"
                    size="sm"
                  >
                    Solicitado
                  </UBadge>
                  <UBadge
                    v-if="slot.isLocked"
                    color="error"
                    variant="subtle"
                    size="sm"
                  >
                    Bloqueado
                  </UBadge>
                </div>
                <div class="flex items-center space-x-2">
                  <UBadge
                    v-if="
                      request.status === 'accepted' &&
                      request.selectedAvailableDateId ===
                        slot.availableDateId &&
                      request.selectedSlotId === slot.slotId
                    "
                    color="success"
                    variant="subtle"
                  >
                    Selecionada
                  </UBadge>
                  <UButton
                    v-else-if="request.status === 'pending' && !slot.isLocked"
                    color="success"
                    size="sm"
                    @click="showAcceptDialog(slot)"
                    class="cursor-pointer"
                  >
                    Aceitar
                  </UButton>
                  <UButton
                    v-else-if="request.status === 'pending' && slot.isLocked"
                    color="neutral"
                    size="sm"
                    disabled
                    class="cursor-not-allowed"
                  >
                    Indisponível
                  </UButton>
                </div>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span
                    :class="slot.isLocked ? 'text-gray-400' : 'text-gray-600'"
                    >Data:</span
                  >
                  <p
                    class="font-medium"
                    :class="slot.isLocked ? 'text-gray-500' : 'text-gray-900'"
                  >
                    {{ formatDate(slot.date) }}
                  </p>
                </div>
                <div>
                  <span
                    :class="slot.isLocked ? 'text-gray-400' : 'text-gray-600'"
                    >Horário:</span
                  >
                  <p
                    class="font-medium"
                    :class="slot.isLocked ? 'text-gray-500' : 'text-gray-900'"
                  >
                    {{ formatTimeRange(slot.startTime, slot.endTime) }}
                  </p>
                </div>
                <div>
                  <span
                    :class="slot.isLocked ? 'text-gray-400' : 'text-gray-600'"
                    >Equipe:</span
                  >
                  <div class="flex items-center space-x-2">
                    <div
                      class="w-3 h-3 rounded-full"
                      :style="{
                        backgroundColor: slot.teamColor,
                        opacity: slot.isLocked ? 0.5 : 1,
                      }"
                    ></div>
                    <span
                      class="font-medium"
                      :class="slot.isLocked ? 'text-gray-500' : 'text-gray-900'"
                      >{{ slot.teamName }}</span
                    >
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Reject Button -->
          <div v-if="request.status === 'pending'" class="mt-6 pt-4 border-t">
            <UButton
              color="error"
              variant="outline"
              @click="showRejectDialog"
              class="w-full cursor-pointer"
            >
              Rejeitar Solicitação
            </UButton>
          </div>
        </UCard>

        <!-- Status History Card -->
        <!-- <UCard>
        <template #header>
          <h3 class="text-lg font-semibold text-gray-900">
            Histórico de Status
          </h3>
        </template>

        <div class="space-y-4">
          <div
            v-for="(history, index) in request.statusHistory"
            :key="index"
            class="flex items-start space-x-3"
          >
            <div class="shrink-0">
              <div
                class="w-3 h-3 rounded-full mt-2"
                :class="getStatusColor(history.status)"
              ></div>
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between">
                <p class="text-sm font-medium text-gray-900">
                  {{ getStatusLabel(history.status) }}
                </p>
                <p class="text-xs text-gray-500">
                  {{ formatDateTime(history.changedAt) }}
                </p>
              </div>
              <p v-if="history.reason" class="text-sm text-gray-600 mt-1">
                {{ history.reason }}
              </p>
              <p v-if="history.changedBy" class="text-xs text-gray-500 mt-1">
                Alterado por: {{ history.changedBy }}
              </p>
            </div>
          </div>
        </div>
      </UCard> -->

        <!-- Rejection Reason (if rejected) -->
        <UCard v-if="request.status === 'rejected' && request.rejectionReason">
          <template #header>
            <h3 class="text-lg font-semibold text-gray-900">
              Motivo da Rejeição
            </h3>
          </template>

          <p class="text-gray-700">{{ request.rejectionReason }}</p>
        </UCard>

        <!-- Back Button -->
        <div class="flex items-center justify-start pt-6 border-t">
          <UButton
            variant="ghost"
            icon="i-lucide-arrow-left"
            @click="goBack"
            class="cursor-pointer"
          >
            Voltar para Lista
          </UButton>
        </div>
      </div>
    </Transition>

    <!-- Accept Confirmation Modal -->
    <UModal v-model:open="showAcceptModal">
      <template #content>
        <div class="p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">
            Confirmar Aceitação
          </h3>

          <div class="space-y-4">
            <p class="text-gray-600">
              Tem certeza que deseja aceitar esta solicitação de coleta?
            </p>

            <div v-if="selectedTimeSlot" class="bg-gray-50 p-4 rounded-lg">
              <h4 class="font-medium text-gray-900 mb-2">
                Horário Selecionado:
              </h4>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span class="text-gray-600">Data:</span>
                  <p class="font-medium">
                    {{ formatDate(selectedTimeSlot.date) }}
                  </p>
                </div>
                <div>
                  <span class="text-gray-600">Horário:</span>
                  <p class="font-medium">
                    {{
                      formatTimeRange(
                        selectedTimeSlot.startTime,
                        selectedTimeSlot.endTime
                      )
                    }}
                  </p>
                </div>
                <div>
                  <span class="text-gray-600">Equipe:</span>
                  <div class="flex items-center space-x-2">
                    <div
                      class="w-3 h-3 rounded-full"
                      :style="{ backgroundColor: selectedTimeSlot.teamColor }"
                    ></div>
                    <span class="font-medium">{{
                      selectedTimeSlot.teamName
                    }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="flex justify-end space-x-3 mt-6">
            <UButton
              variant="ghost"
              @click="showAcceptModal = false"
              class="cursor-pointer"
            >
              Cancelar
            </UButton>
            <UButton
              color="success"
              @click="confirmAccept"
              :loading="isAccepting"
              class="cursor-pointer"
            >
              Confirmar Aceitação
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- Reject Confirmation Modal -->
    <UModal v-model:open="showRejectModal">
      <template #content>
        <div class="p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">
            Rejeitar Solicitação
          </h3>

          <div class="space-y-4">
            <p class="text-gray-600">
              Tem certeza que deseja rejeitar esta solicitação de coleta?
            </p>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Motivo da rejeição <span class="text-red-500">*</span>
              </label>
              <UTextarea
                v-model="rejectionReason"
                placeholder="Explique o motivo da rejeição desta solicitação..."
                :rows="4"
                class="w-full resize-y"
                required
              />
            </div>
          </div>

          <div class="flex justify-end space-x-3 mt-6">
            <UButton
              variant="ghost"
              @click="showRejectModal = false"
              class="cursor-pointer"
            >
              Cancelar
            </UButton>
            <UButton
              color="error"
              @click="confirmReject"
              :loading="isRejecting"
              :disabled="!rejectionReason.trim()"
              class="cursor-pointer"
            >
              Confirmar Rejeição
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useBloodbankStore } from "~/stores/bloodbank";
import { useUserStore } from "~/stores/user";
import type { CollectionRequest } from "~/stores/bloodbank";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

const route = useRoute();
const router = useRouter();
const bloodbankStore = useBloodbankStore();
const userStore = useUserStore();
const { bloodbankData } = storeToRefs(bloodbankStore);
const { currentBloodBankRole } = storeToRefs(userStore);

const requestId = route.params.requestId as string;
const bloodbankSlug = route.params.bloodbankSlug as string;
const bloodBanksLocationId = computed(
  () => currentBloodBankRole.value?.bloodBanksLocationId
);

const request = ref<CollectionRequest | null>(null);
const isLoading = ref(true);
const error = ref<string | null>(null);
const selectedTimeSlot = ref<any>(null);

// Modal states
const showAcceptModal = ref(false);
const showRejectModal = ref(false);
const isAccepting = ref(false);
const isRejecting = ref(false);
const rejectionReason = ref("");

// Map configuration
const mapRef = ref<any>(null);
const mapStyle = "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";
const mapCenter = ref<[number, number]>([-43.1915792, -22.9077772]);
const mapZoom = ref<number>(10);

const loadRequestDetails = async () => {
  isLoading.value = true;
  error.value = null;

  try {
    if (!bloodBanksLocationId.value) {
      error.value = "ID do banco de sangue não encontrado";
      return;
    }

    await bloodbankStore.loadCollectionRequestById(
      requestId,
      bloodBanksLocationId.value
    );
    request.value = bloodbankStore.currentCollectionRequest;

    if (!request.value) {
      error.value = "Solicitação não encontrada";
    } else {
      // Set map center to institution location
      if (request.value.institutionLocation) {
        mapCenter.value = [
          request.value.institutionLocation.coordinates[0],
          request.value.institutionLocation.coordinates[1],
        ];
      }
    }
  } catch (err: any) {
    error.value = err.message || "Erro ao carregar detalhes da solicitação";
  } finally {
    isLoading.value = false;
  }
};

const goBack = () => {
  router.push(`/${bloodbankSlug}/coletas`);
};

const showAcceptDialog = (timeSlot: any) => {
  selectedTimeSlot.value = timeSlot;
  showAcceptModal.value = true;
};

const showRejectDialog = () => {
  showRejectModal.value = true;
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "pending":
      return "warning";
    case "accepted":
      return "success";
    case "rejected":
      return "neutral";
    case "cancelled":
      return "neutral";
    default:
      return "primary";
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case "pending":
      return "Pendente";
    case "accepted":
      return "Aceita";
    case "rejected":
      return "Rejeitada";
    case "cancelled":
      return "Cancelada";
    case "institution_needs_validation":
      return "Aguardando Validação";
    default:
      return status;
  }
};

const formatDate = (date: string | Date) => {
  return dayjs(date).tz("America/Sao_Paulo").format("DD/MM/YYYY");
};

const formatDateTime = (date: string | Date) => {
  return dayjs(date).tz("America/Sao_Paulo").format("DD/MM/YYYY HH:mm");
};

const formatTimeRange = (
  startTime: Date | undefined,
  endTime: Date | undefined
) => {
  if (!startTime || !endTime) return "N/A";
  const start = dayjs(startTime).tz("America/Sao_Paulo").format("HH:mm");
  const end = dayjs(endTime).tz("America/Sao_Paulo").format("HH:mm");
  return `${start} - ${end}`;
};

const initializeMap = () => {
  // Map will be initialized by MglMap component
  console.log("Map initialized");
};

const confirmAccept = async () => {
  if (!selectedTimeSlot.value) {
    useToast().add({
      title: "Erro",
      description: "Nenhum horário selecionado.",
      color: "error",
      duration: 3000,
    });
    return;
  }

  isAccepting.value = true;

  try {
    if (!bloodBanksLocationId.value) {
      throw new Error("ID do banco de sangue não encontrado");
    }

    // Call API to accept request with selected time slot
    await bloodbankStore.acceptCollectionRequest(
      requestId,
      selectedTimeSlot.value.availableDateId,
      selectedTimeSlot.value.slotId,
      bloodBanksLocationId.value
    );

    useToast().add({
      title: "Solicitação aceita!",
      description: "A solicitação foi aceita com sucesso.",
      color: "success",
      duration: 3000,
    });

    // Close modal and update local data
    showAcceptModal.value = false;

    // Update request data from store (already updated by the store)
    request.value = bloodbankStore.currentCollectionRequest;

    // Refresh the collection requests list to reflect changes
    if (bloodBanksLocationId.value) {
      await bloodbankStore.refreshCollectionRequests(
        bloodBanksLocationId.value,
        "accepted"
      );
    }
  } catch (error: any) {
    console.error("Error accepting request:", error);
    useToast().add({
      title: "Erro ao aceitar solicitação",
      description: error.message || "Tente novamente mais tarde.",
      color: "error",
      duration: 3000,
    });
  } finally {
    isAccepting.value = false;
  }
};

const confirmReject = async () => {
  if (!rejectionReason.value.trim()) {
    useToast().add({
      title: "Motivo obrigatório",
      description: "Por favor, informe o motivo da rejeição.",
      color: "warning",
      duration: 3000,
    });
    return;
  }

  isRejecting.value = true;

  try {
    if (!bloodBanksLocationId.value) {
      throw new Error("ID do banco de sangue não encontrado");
    }

    // Call API to reject request with reason
    await bloodbankStore.rejectCollectionRequest(
      requestId,
      rejectionReason.value.trim(),
      bloodBanksLocationId.value
    );

    useToast().add({
      title: "Solicitação rejeitada!",
      description: "A solicitação foi rejeitada com sucesso.",
      color: "success",
      duration: 3000,
    });

    // Close modal and update local data
    showRejectModal.value = false;
    rejectionReason.value = "";

    // Update request data from store (already updated by the store)
    request.value = bloodbankStore.currentCollectionRequest;

    // Refresh the collection requests list to reflect changes
    if (bloodBanksLocationId.value) {
      await bloodbankStore.refreshCollectionRequests(
        bloodBanksLocationId.value,
        "pending"
      );
    }
  } catch (error: any) {
    console.error("Error rejecting request:", error);
    useToast().add({
      title: "Erro ao rejeitar solicitação",
      description: error.message || "Tente novamente mais tarde.",
      color: "error",
      duration: 3000,
    });
  } finally {
    isRejecting.value = false;
  }
};

onMounted(async () => {
  if (!bloodBanksLocationId.value) {
    return;
  }
  await bloodbankStore.loadBloodbankData(
    bloodBanksLocationId.value as string,
    true
  );
  await loadRequestDetails();
});
</script>
