<template>
  <div class="flex flex-col gap-8">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Detalhes da Coleta</h1>
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
        <div
          class="mx-auto mb-4 w-14 h-14 rounded-full border-4 border-red-500 border-t-transparent animate-spin transition-all"
          role="status"
          aria-label="Carregando"
        />
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
      <div v-else-if="currentCollectionRequest" class="space-y-6">
        <!-- Institution Information Card -->
        <UCard>
          <template #header>
            <div class="flex items-center space-x-4">
              <UAvatar
                v-if="currentCollectionRequest.institutionLogo"
                :src="currentCollectionRequest.institutionLogo"
                :alt="currentCollectionRequest.institutionName"
                size="lg"
              />
              <UAvatar
                v-else
                :alt="currentCollectionRequest.institutionName"
                size="lg"
                class="bg-blue-500"
              >
                {{ currentCollectionRequest.institutionName.charAt(0) }}
              </UAvatar>
              <div>
                <h2 class="text-xl font-semibold text-gray-900">
                  {{ currentCollectionRequest.institutionName }}
                </h2>
                <p class="text-gray-600">
                  {{ currentCollectionRequest.address
                    ? formatStructuredAddress(currentCollectionRequest.address)
                    : currentCollectionRequest.institutionAddress }}
                </p>
              </div>
            </div>
          </template>

          <div class="space-y-4">
            <!-- Status Badge -->
            <div class="flex items-center justify-between">
              <UBadge
                :color="getStatusColor(currentCollectionRequest.status)"
                variant="subtle"
                size="lg"
              >
                {{ getStatusLabel(currentCollectionRequest.status) }}
              </UBadge>
              <span class="text-sm text-gray-500">
                Criado em {{ formatDate(currentCollectionRequest.createdAt) }}
              </span>
            </div>
          </div>
        </UCard>

        <!-- Technical Visit Status Badge -->
        <div
          class="flex items-center gap-3 p-4 rounded-lg border cursor-pointer hover:shadow-md transition-shadow"
          :class="technicalVisitBadgeClasses"
          @click="handleVisitBadgeClick"
        >
          <UIcon :name="technicalVisitBadgeIcon" class="w-5 h-5 shrink-0" />
          <div class="flex-1 min-w-0">
            <p class="font-medium text-sm">{{ technicalVisitBadgeLabel }}</p>
            <p v-if="latestTechnicalVisit" class="text-xs opacity-75">
              {{ formatDate(latestTechnicalVisit.visitDate) }}
              <template v-if="latestTechnicalVisit.outcome === 'rejected' && latestTechnicalVisit.notes">
                — {{ latestTechnicalVisit.notes }}
              </template>
            </p>
          </div>
          <UIcon name="i-lucide-chevron-right" class="w-4 h-4 shrink-0 opacity-50" />
        </div>

        <!-- Ponto Focal (Host) Card -->
        <UCard v-if="currentCollectionRequest.host">
          <template #header>
            <h3 class="text-lg font-semibold text-gray-900">Ponto Focal</h3>
          </template>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <span class="text-sm text-gray-600">Nome</span>
              <p class="font-medium text-gray-900">
                {{ currentCollectionRequest.host.name }}
              </p>
            </div>
            <div>
              <span class="text-sm text-gray-600">Email</span>
              <p class="font-medium text-gray-900">
                <a
                  :href="`mailto:${currentCollectionRequest.host.email}`"
                  class="text-blue-600 hover:underline"
                >
                  {{ currentCollectionRequest.host.email }}
                </a>
              </p>
            </div>
            <div>
              <span class="text-sm text-gray-600">Telefone</span>
              <p class="font-medium text-gray-900">
                <a
                  :href="`tel:${currentCollectionRequest.host.phone}`"
                  class="text-blue-600 hover:underline"
                >
                  {{ currentCollectionRequest.host.phone }}
                </a>
              </p>
            </div>
          </div>
        </UCard>

        <!-- Endereço do Local da Coleta -->
        <UCard v-if="currentCollectionRequest.address">
          <template #header>
            <h3 class="text-lg font-semibold text-gray-900">
              Endereço do Local da Coleta
            </h3>
          </template>

          <div class="space-y-2">
            <p class="font-medium text-gray-900">
              {{ formatStructuredAddress(currentCollectionRequest.address) }}
            </p>
            <p class="text-sm text-gray-500">
              CEP: {{ formatCep(currentCollectionRequest.address.zipCode) }}
            </p>
          </div>
        </UCard>

        <!-- Technical Visit History -->
        <UCard>
          <template #header>
            <h3 class="text-lg font-semibold text-gray-900">
              Historico de Visitas Tecnicas
            </h3>
          </template>

          <div v-if="isLoadingVisits" class="flex items-center justify-center py-4">
            <div
              class="w-6 h-6 rounded-full border-2 border-red-500 border-t-transparent animate-spin"
            />
          </div>
          <div v-else-if="technicalVisits.length === 0" class="text-center py-4">
            <p class="text-sm text-gray-500">
              Nenhuma visita tecnica registrada para este local
            </p>
          </div>
          <div v-else class="space-y-3">
            <div
              v-for="visit in technicalVisits"
              :key="visit._id"
              class="border rounded-lg p-3 cursor-pointer hover:shadow-md transition-shadow"
              @click="navigateToVisit(visit._id)"
            >
              <div class="flex items-center justify-between mb-1">
                <UBadge
                  :color="getVisitOutcomeColor(visit.outcome)"
                  variant="subtle"
                  size="sm"
                >
                  {{ getVisitOutcomeLabel(visit.outcome) }}
                </UBadge>
                <span class="text-xs text-gray-500">
                  {{ formatDate(visit.visitDate) }}
                </span>
              </div>
              <p class="text-sm text-gray-700 truncate">{{ visit.address }}</p>
              <p
                v-if="visit.notes"
                class="text-xs text-gray-500 mt-1 line-clamp-2"
              >
                {{ visit.notes }}
              </p>
            </div>
          </div>
        </UCard>

        <!-- Map Card -->
        <UCard v-if="currentCollectionRequest.institutionLocation">
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
                  currentCollectionRequest.institutionLocation.coordinates[0],
                  currentCollectionRequest.institutionLocation.coordinates[1],
                ]"
                :color="'#3B82F6'"
              >
                <!-- MglPopup and marker visuals for institution -->
                <template
                  v-if="currentCollectionRequest.institutionLogo"
                  v-slot:marker
                >
                  <NuxtImg
                    :src="currentCollectionRequest.institutionLogo"
                    :alt="`Logo da instituição ${currentCollectionRequest.institutionName}`"
                    class="w-8 h-8 rounded-full object-cover border-2"
                    style="border-color: #3b82f6"
                  />
                </template>
                <MglPopup
                  v-if="!currentCollectionRequest.institutionLogo"
                  ref="institutionPopup"
                  :close-button="false"
                  :offset="[0, -40]"
                >
                  <div class="flex items-center space-x-3">
                    <div class="shrink-0">
                      <NuxtImg
                        v-if="currentCollectionRequest.institutionLogo"
                        :src="currentCollectionRequest.institutionLogo"
                        :alt="`Logo da instituição ${currentCollectionRequest.institutionName}`"
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
                        {{ currentCollectionRequest.institutionName }}
                      </h3>
                      <p class="text-sm text-gray-600">
                        {{ currentCollectionRequest.institutionAddress }}
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
                  <NuxtImg
                    :src="bloodbankData.logo"
                    :alt="`Logo do ${bloodbankData.name}`"
                    class="w-8 h-8 rounded-full object-cover border-2"
                    style="border-color: #bb0a08"
                  />
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
              v-for="(
                slot, index
              ) in currentCollectionRequest.availableSlotOptions"
              :key="index"
              class="border rounded-lg p-4 transition-all duration-200 hover:shadow-md"
              :class="{
                'border-green-500 bg-green-50':
                  currentCollectionRequest.status === 'accepted' &&
                  currentCollectionRequest.selectedAvailableDateId ===
                    slot.availableDateId &&
                  currentCollectionRequest.selectedSlotId === slot.slotId,
                'border-gray-300 bg-gray-100 opacity-60': slot.isLocked,
                'border-blue-300 bg-blue-50':
                  slot.isRequested && !slot.isLocked,
                'border-gray-200':
                  !(
                    currentCollectionRequest.status === 'accepted' &&
                    currentCollectionRequest.selectedAvailableDateId ===
                      slot.availableDateId &&
                    currentCollectionRequest.selectedSlotId === slot.slotId
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
                    v-if="slot.isRequested && slot.priority"
                    color="info"
                    variant="subtle"
                    size="sm"
                  >
                    {{ priorityLabel(slot.priority) }}
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
                      currentCollectionRequest.status === 'accepted' &&
                      currentCollectionRequest.selectedAvailableDateId ===
                        slot.availableDateId &&
                      currentCollectionRequest.selectedSlotId === slot.slotId
                    "
                    color="success"
                    variant="subtle"
                  >
                    Selecionada
                  </UBadge>
                  <UButton
                    v-else-if="
                      currentCollectionRequest.status === 'pending' &&
                      !slot.isLocked
                    "
                    color="success"
                    size="sm"
                    @click="showAcceptDialog(slot)"
                    class="cursor-pointer"
                  >
                    Aceitar
                  </UButton>
                  <UButton
                    v-else-if="
                      currentCollectionRequest.status === 'pending' &&
                      slot.isLocked
                    "
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
          <div
            v-if="currentCollectionRequest.status === 'pending'"
            class="mt-6 pt-4 border-t"
          >
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

        <!-- Rejection Reason (if rejected) -->
        <UCard
          v-if="
            currentCollectionRequest.status === 'rejected' &&
            currentCollectionRequest.rejectionReason
          "
        >
          <template #header>
            <h3 class="text-lg font-semibold text-gray-900">
              Motivo da Rejeição
            </h3>
          </template>

          <p class="text-gray-700">
            {{ currentCollectionRequest.rejectionReason }}
          </p>
        </UCard>

        <!-- Cancellation Reason (if cancelled) -->
        <UCard
          v-if="currentCollectionRequest.status === 'cancelled'"
        >
          <template #header>
            <h3 class="text-lg font-semibold text-gray-900">
              Motivo do Cancelamento
            </h3>
          </template>

          <p class="text-gray-700">
            {{ getCancellationReason() || 'Sem motivo informado' }}
          </p>
        </UCard>

        <!-- Cancel Button (for accepted requests) -->
        <div
          v-if="currentCollectionRequest.status === 'accepted'"
          class="pt-2"
        >
          <UButton
            color="error"
            variant="outline"
            @click="showCancelDialog"
            class="w-full cursor-pointer"
          >
            Cancelar Coleta
          </UButton>
        </div>

        <!-- Generate Commitment Term Button -->
        <div class="pt-2">
          <UButton
            variant="outline"
            color="primary"
            icon="i-lucide-file-signature"
            :loading="isGeneratingTerm"
            class="w-full cursor-pointer"
            @click="generateCommitmentTerm"
          >
            Gerar Termo de Compromisso
          </UButton>
        </div>

        <!-- Commitment Term Link (after generation) -->
        <UCard v-if="generatedTermUrl">
          <template #header>
            <h3 class="text-lg font-semibold text-gray-900">
              Termo de Compromisso
            </h3>
          </template>
          <div class="flex items-center gap-3">
            <UIcon name="i-lucide-file-check" class="w-5 h-5 text-green-600 shrink-0" />
            <p class="text-sm text-gray-700 flex-1">
              Termo gerado com sucesso e enviado ao ponto focal.
            </p>
            <UButton
              variant="soft"
              size="sm"
              icon="i-lucide-external-link"
              @click="openTermUrl"
              class="cursor-pointer"
            >
              Visualizar
            </UButton>
          </div>
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

    <!-- Cancel Confirmation Modal -->
    <UModal v-model:open="showCancelModal">
      <template #content>
        <div class="p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">
            Cancelar Coleta
          </h3>

          <div class="space-y-4">
            <p class="text-gray-600">
              Tem certeza que deseja cancelar esta coleta? O slot reservado será
              liberado e ficará disponível novamente.
            </p>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Motivo do cancelamento <span class="text-red-500">*</span>
              </label>
              <UTextarea
                v-model="cancellationReason"
                placeholder="Explique o motivo do cancelamento desta coleta..."
                :rows="4"
                :maxlength="1000"
                class="w-full resize-y"
                required
              />
              <p class="text-xs text-gray-500 mt-1">
                {{ cancellationReason.length }}/1000 caracteres
              </p>
            </div>
          </div>

          <div class="flex justify-end space-x-3 mt-6">
            <UButton
              variant="ghost"
              @click="showCancelModal = false"
              class="cursor-pointer"
            >
              Voltar
            </UButton>
            <UButton
              color="error"
              @click="confirmCancel"
              :loading="isCancelling"
              :disabled="!cancellationReason.trim()"
              class="cursor-pointer"
            >
              Confirmar Cancelamento
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
import { fetchWithAuth } from "~/composables/useFetchWithAuth";
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
const { bloodbankData, currentCollectionRequest } = storeToRefs(bloodbankStore);
const { currentBloodBankRole } = storeToRefs(userStore);

const requestId = route.params.requestId as string;
const bloodbankSlug = route.params.bloodbankSlug as string;
const bloodBanksLocationId = computed(
  () => currentBloodBankRole.value?.bloodBanksLocationId
);

const isLoading = ref(true);
const error = ref<string | null>(null);
const selectedTimeSlot = ref<any>(null);

// Technical visits
interface TechnicalVisitSummary {
  _id: string;
  address: string;
  visitDate: string;
  outcome: "approved" | "rejected" | "pending";
  notes?: string | null;
}
const technicalVisits = ref<TechnicalVisitSummary[]>([]);
const isLoadingVisits = ref(false);

// Modal states
const showAcceptModal = ref(false);
const showRejectModal = ref(false);
const showCancelModal = ref(false);
const isAccepting = ref(false);
const isRejecting = ref(false);
const isCancelling = ref(false);
const rejectionReason = ref("");
const cancellationReason = ref("");

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

    if (!currentCollectionRequest.value) {
      error.value = "Solicitação não encontrada";
    } else {
      // Set map center to institution location
      if (currentCollectionRequest.value.institutionLocation) {
        mapCenter.value = [
          currentCollectionRequest.value.institutionLocation.coordinates[0],
          currentCollectionRequest.value.institutionLocation.coordinates[1],
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

const showCancelDialog = () => {
  showCancelModal.value = true;
};

const getCancellationReason = () => {
  if (!currentCollectionRequest.value?.statusHistory) return null;
  const cancelEntry = [...currentCollectionRequest.value.statusHistory]
    .reverse()
    .find((sh) => sh.status === "cancelled");
  return cancelEntry?.reason || null;
};

const formatStructuredAddress = (addr: {
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
}) => {
  const parts = [`${addr.street}, ${addr.number}`];
  if (addr.complement) parts[0] += `, ${addr.complement}`;
  parts.push(`${addr.neighborhood}`);
  parts.push(`${addr.city} - ${addr.state}`);
  return parts.join(" - ");
};

const formatCep = (cep: string) => {
  const digits = cep.replace(/\D/g, "");
  if (digits.length > 5) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return digits;
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

// Rótulo da prioridade que a instituição atribuiu a esta data (1 = a data
// que a instituição mais prefere).
const priorityLabel = (priority: number) => {
  const labels: Record<number, string> = {
    1: "1ª preferência da instituição",
    2: "2ª preferência da instituição",
    3: "3ª preferência da instituição",
  };
  return labels[priority] || `${priority}ª preferência da instituição`;
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

    // Close modal
    showAcceptModal.value = false;

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

    // Close modal and clear
    showRejectModal.value = false;
    rejectionReason.value = "";

    // Refresh collection requests list if needed
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

const confirmCancel = async () => {
  if (!cancellationReason.value.trim()) {
    useToast().add({
      title: "Motivo obrigatório",
      description: "Por favor, informe o motivo do cancelamento.",
      color: "warning",
      duration: 3000,
    });
    return;
  }

  isCancelling.value = true;

  try {
    if (!bloodBanksLocationId.value) {
      throw new Error("ID do banco de sangue não encontrado");
    }

    await bloodbankStore.cancelCollectionRequest(
      requestId,
      cancellationReason.value.trim(),
      bloodBanksLocationId.value
    );

    useToast().add({
      title: "Coleta cancelada!",
      description: "A coleta foi cancelada com sucesso.",
      color: "success",
      duration: 3000,
    });

    // Close modal and clear
    showCancelModal.value = false;
    cancellationReason.value = "";

    // Refresh collection requests list
    if (bloodBanksLocationId.value) {
      await bloodbankStore.refreshCollectionRequests(
        bloodBanksLocationId.value,
        "accepted"
      );
    }
  } catch (error: any) {
    console.error("Error cancelling request:", error);
    useToast().add({
      title: "Erro ao cancelar coleta",
      description: error.message || "Tente novamente mais tarde.",
      color: "error",
      duration: 3000,
    });
  } finally {
    isCancelling.value = false;
  }
};

// Commitment term generation
const isGeneratingTerm = ref(false);
const generatedTermUrl = ref<string | null>(null);

const generateCommitmentTerm = async () => {
  if (!bloodBanksLocationId.value || !currentCollectionRequest.value) return;
  isGeneratingTerm.value = true;
  try {
    const req = currentCollectionRequest.value;
    const addr = req.address
      ? formatStructuredAddress(req.address)
      : req.institutionAddress;

    const response = await fetchWithAuth(
      `/api/v1/bloodbank/${bloodBanksLocationId.value}/commitment-terms`,
      {
        method: "POST",
        body: {
          collectionRequestId: req._id,
          sentTo: req.host?.phone || req.host?.email || "",
          templateParams: {
            institutionName: req.institutionName || "",
            address: addr || "",
            bloodBankName: bloodbankData.value?.name || "",
            hostName: req.host?.name || "",
            date: new Date().toLocaleDateString("pt-BR"),
          },
          status: "sent",
        },
      }
    ) as any;

    if (response.success && response.data?.accessToken) {
      const baseUrl = window.location.origin;
      generatedTermUrl.value = `${baseUrl}/termo/${response.data.accessToken}`;
      useToast().add({
        title: "Termo gerado!",
        description: "O termo de compromisso foi gerado e enviado ao ponto focal.",
        color: "success",
        duration: 5000,
      });
    }
  } catch (err: any) {
    console.error("Error generating commitment term:", err);
    useToast().add({
      title: "Erro ao gerar termo",
      description: err.message || "Tente novamente mais tarde.",
      color: "error",
      duration: 3000,
    });
  } finally {
    isGeneratingTerm.value = false;
  }
};

const openTermUrl = () => {
  if (generatedTermUrl.value) {
    window.open(generatedTermUrl.value, "_blank");
  }
};

const loadTechnicalVisits = async () => {
  if (!bloodBanksLocationId.value || !currentCollectionRequest.value) return;
  isLoadingVisits.value = true;
  try {
    const institutionId = currentCollectionRequest.value.institutionId;
    const params = new URLSearchParams();
    if (institutionId) {
      params.append("institutionId", institutionId);
    }
    params.append("limit", "10");
    const response = await fetchWithAuth(
      `/api/v1/bloodbank/${bloodBanksLocationId.value}/technical-visits?${params.toString()}`
    ) as any;
    if (response.success) {
      technicalVisits.value = response.data;
    }
  } catch (err) {
    console.error("Error loading technical visits:", err);
  } finally {
    isLoadingVisits.value = false;
  }
};

const getVisitOutcomeColor = (outcome: string) => {
  switch (outcome) {
    case "approved": return "success";
    case "rejected": return "error";
    case "pending": return "warning";
    default: return "neutral";
  }
};

const getVisitOutcomeLabel = (outcome: string) => {
  switch (outcome) {
    case "approved": return "Aprovada";
    case "rejected": return "Reprovada";
    case "pending": return "Pendente";
    default: return outcome;
  }
};

const latestTechnicalVisit = computed(() => {
  if (technicalVisits.value.length === 0) return null;
  // Prioritize: approved > rejected > pending, then most recent
  const sorted = [...technicalVisits.value].sort((a, b) => {
    const priority: Record<string, number> = { approved: 0, rejected: 1, pending: 2 };
    const pDiff = (priority[a.outcome] ?? 3) - (priority[b.outcome] ?? 3);
    if (pDiff !== 0) return pDiff;
    return new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime();
  });
  return sorted[0];
});

const technicalVisitBadgeLabel = computed(() => {
  if (isLoadingVisits.value) return "Carregando visitas...";
  if (!latestTechnicalVisit.value) return "Sem Visita Tecnica";
  switch (latestTechnicalVisit.value.outcome) {
    case "approved": return "Visita Tecnica Aprovada";
    case "rejected": return "Visita Tecnica Reprovada";
    case "pending": return "Visita Tecnica Pendente";
    default: return "Visita Tecnica";
  }
});

const technicalVisitBadgeIcon = computed(() => {
  if (!latestTechnicalVisit.value) return "i-lucide-clipboard-x";
  switch (latestTechnicalVisit.value.outcome) {
    case "approved": return "i-lucide-clipboard-check";
    case "rejected": return "i-lucide-clipboard-x";
    case "pending": return "i-lucide-clipboard-list";
    default: return "i-lucide-clipboard";
  }
});

const technicalVisitBadgeClasses = computed(() => {
  if (!latestTechnicalVisit.value) {
    return "bg-gray-50 border-gray-200 text-gray-600";
  }
  switch (latestTechnicalVisit.value.outcome) {
    case "approved": return "bg-green-50 border-green-200 text-green-700";
    case "rejected": return "bg-red-50 border-red-200 text-red-700";
    case "pending": return "bg-yellow-50 border-yellow-200 text-yellow-700";
    default: return "bg-gray-50 border-gray-200 text-gray-600";
  }
});

const handleVisitBadgeClick = () => {
  if (latestTechnicalVisit.value) {
    navigateTo(`/${bloodbankSlug}/visitas-tecnicas`);
  } else {
    navigateTo(`/${bloodbankSlug}/visitas-tecnicas`);
  }
};

const navigateToVisit = (visitId: string) => {
  navigateTo(`/${bloodbankSlug}/visitas-tecnicas`);
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
  await loadTechnicalVisits();
});
</script>
