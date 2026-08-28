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

        <!-- Nota da instituição -->
        <UCard v-if="currentCollectionRequest.note">
          <template #header>
            <h3 class="text-lg font-semibold text-gray-900">
              Nota da Instituição
            </h3>
          </template>

          <p class="text-sm text-gray-700 whitespace-pre-line">
            {{ currentCollectionRequest.note }}
          </p>
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
                    {{
                      slot.priority
                        ? priorityLabel(slot.priority)
                        : `Opção ${index + 1}`
                    }}
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

          <!-- Reject / Counter-propose Buttons -->
          <div
            v-if="currentCollectionRequest.status === 'pending'"
            class="mt-6 pt-4 border-t flex gap-3"
          >
            <UButton
              color="info"
              variant="outline"
              class="flex-1 cursor-pointer"
              @click="showCounterProposalDialog"
            >
              Propor Outra Data/Horário
            </UButton>
            <UButton
              color="error"
              variant="outline"
              class="flex-1 cursor-pointer"
              @click="showRejectDialog"
            >
              Rejeitar Solicitação
            </UButton>
          </div>
        </UCard>

        <!-- Confirmed schedule -->
        <UCard v-if="currentCollectionRequest.confirmedSchedule">
          <template #header>
            <div class="flex items-center gap-2 text-green-700">
              <UIcon name="i-lucide-calendar-check" class="w-5 h-5" />
              <h3 class="text-lg font-semibold text-gray-900">
                Coleta Confirmada
              </h3>
            </div>
          </template>
          <div class="space-y-2 text-sm">
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-calendar" class="w-4 h-4 text-gray-400" />
              <span>{{ formatDate(currentCollectionRequest.confirmedSchedule.date) }}</span>
            </div>
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-clock" class="w-4 h-4 text-gray-400" />
              <span>
                {{ currentCollectionRequest.confirmedSchedule.startTime }} -
                {{ currentCollectionRequest.confirmedSchedule.endTime }}
              </span>
            </div>
            <div
              v-if="currentCollectionRequest.confirmedSchedule.teamName"
              class="flex items-center gap-2"
            >
              <UIcon name="i-lucide-users" class="w-4 h-4 text-gray-400" />
              <span>{{ currentCollectionRequest.confirmedSchedule.teamName }}</span>
            </div>
          </div>
        </UCard>

        <!-- Counter Proposal Sent (read-only) -->
        <UCard
          v-if="
            currentCollectionRequest.status === 'counter_proposed' &&
            currentCollectionRequest.counterProposal
          "
        >
          <template #header>
            <h3 class="text-lg font-semibold text-gray-900">
              Contraproposta Enviada
            </h3>
          </template>
          <div class="space-y-3">
            <p
              v-if="currentCollectionRequest.counterProposal.note"
              class="text-sm text-gray-700"
            >
              {{ currentCollectionRequest.counterProposal.note }}
            </p>
            <div
              v-for="(d, idx) in currentCollectionRequest.counterProposal
                .proposedDates"
              :key="idx"
              class="border rounded-lg p-3 text-sm"
            >
              <p class="font-medium">
                {{ formatDate(d.date) }} · {{ formatProposalRange(d) }}
              </p>
              <p v-if="d.teamName" class="text-sm text-gray-600 mt-1">
                Equipe: {{ d.teamName }}
              </p>
              <p v-if="d.note" class="text-gray-600 mt-1">{{ d.note }}</p>
            </div>
            <p class="text-xs text-gray-500">
              Aguardando resposta da instituição.
            </p>
          </div>
        </UCard>

        <!-- Technical Visit Proposal Sent (read-only) -->
        <UCard
          v-if="
            currentCollectionRequest.status === 'awaiting_technical_visit' &&
            currentCollectionRequest.visitProposal
          "
        >
          <template #header>
            <h3 class="text-lg font-semibold text-gray-900">
              Visita Técnica Proposta
            </h3>
          </template>
          <div class="space-y-3">
            <p
              v-if="currentCollectionRequest.visitProposal.note"
              class="text-sm text-gray-700"
            >
              {{ currentCollectionRequest.visitProposal.note }}
            </p>
            <div
              v-for="(d, idx) in currentCollectionRequest.visitProposal
                .proposedDates"
              :key="idx"
              class="border rounded-lg p-3 text-sm"
            >
              <p class="font-medium">
                {{ formatDate(d.date) }} · {{ formatProposalRange(d) }}
              </p>
              <p v-if="d.note" class="text-gray-600 mt-1">{{ d.note }}</p>
            </div>
            <p class="text-xs text-gray-500">
              Aguardando resposta da instituição.
            </p>
          </div>
        </UCard>

        <!-- Technical Visit Proposal -->
        <UCard v-if="canProposeTechnicalVisit">
          <template #header>
            <div class="flex items-center gap-2 text-amber-700">
              <UIcon name="i-lucide-map-pinned" class="w-5 h-5" />
              <h3 class="text-lg font-semibold text-gray-900">
                Visita técnica necessária
              </h3>
            </div>
          </template>
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p class="text-sm text-gray-600">
              Envie opções de data e horário para a instituição escolher.
            </p>
            <UButton
              color="warning"
              class="cursor-pointer shrink-0"
              @click="showTechnicalVisitProposalDialog"
            >
              Propor visita técnica
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

    <!-- Counter Proposal Modal -->
    <UModal v-model:open="showCounterProposalModal" :dismissible="false">
      <template #content>
        <div class="p-6 max-h-[80vh] overflow-y-auto">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">
            Propor outra data e horário
          </h3>

          <div class="space-y-4">
            <div class="rounded-lg border border-blue-200 bg-blue-50 p-3">
              <p class="text-sm font-medium text-blue-900">
                Selecione os slots configurados
              </p>
              <p class="text-xs text-blue-800 mt-1">
                Escolha apenas datas e horários já cadastrados no calendário do banco.
              </p>
              <p v-if="!availableCounterProposalSlots.length" class="text-xs text-blue-800 mt-3">
                Não há slots disponíveis para esta solicitação.
              </p>
            </div>
            <div
              v-for="(d, idx) in counterProposalDates"
              :key="idx"
              class="border rounded-lg p-3 space-y-2"
            >
              <div class="flex items-center justify-between">
                <span class="text-sm font-medium text-gray-700"
                  >Opção {{ idx + 1 }}</span
                >
                <UButton
                  v-if="counterProposalDates.length > 1"
                  size="xs"
                  color="error"
                  variant="ghost"
                  icon="i-lucide-trash-2"
                  aria-label="Remover opção de data"
                  @click="removeCounterProposalDate(idx)"
                />
              </div>
              <UFormField label="Slot configurado">
                <USelect
                  v-model="d.slotKey"
                  :items="counterProposalSlotItems"
                  placeholder="Selecione uma data e um horário"
                  aria-label="Slot configurado"
                  class="w-full"
                  :disabled="!availableCounterProposalSlots.length"
                />
              </UFormField>
              <div
                v-if="selectedCounterProposalSlot(d)"
                class="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700"
              >
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-calendar" class="w-4 h-4 text-gray-400" />
                  <span>{{ formatDate(selectedCounterProposalSlot(d)!.date) }}</span>
                </div>
                <div class="flex items-center gap-2 mt-1">
                  <UIcon name="i-lucide-clock" class="w-4 h-4 text-gray-400" />
                  <span>
                    {{ formatSlotTime(selectedCounterProposalSlot(d)!.startTime) }} -
                    {{ formatSlotTime(selectedCounterProposalSlot(d)!.endTime) }}
                  </span>
                </div>
                <div v-if="selectedCounterProposalSlot(d)!.teamName" class="flex items-center gap-2 mt-1">
                  <UIcon name="i-lucide-users" class="w-4 h-4 text-gray-400" />
                  <span>{{ selectedCounterProposalSlot(d)!.teamName }}</span>
                </div>
              </div>
              <UFormField label="Nota desta opção">
                <UInput
                  v-model="d.note"
                  placeholder="Ex: sujeito a confirmação da equipe"
                  class="w-full"
                />
              </UFormField>
            </div>

            <UButton
              variant="ghost"
              icon="i-lucide-plus"
              @click="addCounterProposalDate"
            >
              Adicionar outra opção de data
            </UButton>

            <UFormField label="Nota geral para a instituição">
              <UTextarea
                v-model="counterProposalNote"
                placeholder="Explique o motivo da contraproposta..."
                :rows="3"
                class="w-full"
              />
            </UFormField>

            <UCheckbox
              v-model="counterProposalNeedsTechnicalVisit"
              label="Requer visita técnica antes da confirmação"
            />
          </div>

          <div class="flex justify-end space-x-3 mt-6">
            <UButton
              variant="ghost"
              @click="showCounterProposalModal = false"
              :disabled="isSendingCounterProposal"
            >
              Cancelar
            </UButton>
            <UButton
              color="info"
              @click="confirmCounterProposal"
              :loading="isSendingCounterProposal"
              :disabled="!isCounterProposalValid || isSendingCounterProposal"
            >
              Enviar Contraproposta
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- Technical Visit Proposal Modal -->
    <UModal v-model:open="showTechnicalVisitProposalModal">
      <template #content>
        <div class="p-6 max-h-[80vh] overflow-y-auto">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">
            Propor visita técnica
          </h3>

          <div class="space-y-4">
            <div
              v-for="(d, idx) in technicalVisitProposalDates"
              :key="idx"
              class="border rounded-lg p-3 space-y-2"
            >
              <div class="flex items-center justify-between">
                <span class="text-sm font-medium text-gray-700">
                  Opção {{ idx + 1 }}
                </span>
                <UButton
                  v-if="technicalVisitProposalDates.length > 1"
                  size="xs"
                  color="error"
                  variant="ghost"
                  icon="i-lucide-trash-2"
                  @click="removeTechnicalVisitProposalDate(idx)"
                />
              </div>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                <UFormField label="Data">
                  <UInput v-model="d.date" type="date" class="w-full" />
                </UFormField>
                <UFormField label="Início">
                  <UInput v-model="d.startTime" type="time" class="w-full" />
                </UFormField>
                <UFormField label="Fim">
                  <UInput v-model="d.endTime" type="time" class="w-full" />
                </UFormField>
              </div>
              <p
                v-if="isEndTimeInvalid(d)"
                class="text-xs text-red-600"
              >
                O horário final deve ser posterior ao horário inicial.
              </p>
              <UFormField label="Nota desta opção">
                <UInput
                  v-model="d.note"
                  placeholder="Ex: sujeito à confirmação da equipe"
                  class="w-full"
                />
              </UFormField>
            </div>

            <UButton
              variant="ghost"
              icon="i-lucide-plus"
              @click="addTechnicalVisitProposalDate"
            >
              Adicionar outra opção de data
            </UButton>

            <UFormField label="Nota geral para a instituição">
              <UTextarea
                v-model="technicalVisitProposalNote"
                placeholder="Inclua orientações para a visita técnica..."
                :rows="3"
                class="w-full"
              />
            </UFormField>
          </div>

          <div class="flex justify-end space-x-3 mt-6">
            <UButton
              variant="ghost"
              @click="showTechnicalVisitProposalModal = false"
              :disabled="isSendingTechnicalVisitProposal"
            >
              Cancelar
            </UButton>
            <UButton
              color="warning"
              @click="confirmTechnicalVisitProposal"
              :loading="isSendingTechnicalVisitProposal"
              :disabled="!isTechnicalVisitProposalValid"
            >
              Enviar proposta
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
import {
  getBloodbankCollectionRequestStatusLabel,
  getCollectionRequestStatusColor,
} from "~/utils/collectionRequestStatus";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

definePageMeta({
  layout: "default",
  keepalive: false,
});

const route = useRoute();
const router = useRouter();
const bloodbankStore = useBloodbankStore();
const userStore = useUserStore();
const { bloodbankData, currentCollectionRequest } = storeToRefs(bloodbankStore);
const { currentBloodBankRole } = storeToRefs(userStore);
const SCHEDULE_TIMEZONE = "America/Sao_Paulo";

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

const getStatusColor = (status: string) =>
  getCollectionRequestStatusColor(status);

const getStatusLabel = (status: string) =>
  getBloodbankCollectionRequestStatusLabel(status);

const formatDate = (date: string | Date) => {
  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return dayjs.tz(`${date}T12:00`, SCHEDULE_TIMEZONE).format("DD/MM/YYYY");
  }
  return dayjs(date).tz(SCHEDULE_TIMEZONE).format("DD/MM/YYYY");
};

const formatDateTime = (date: string | Date) => {
  return dayjs(date).tz(SCHEDULE_TIMEZONE).format("DD/MM/YYYY HH:mm");
};

const formatTimeRange = (
  startTime: Date | undefined,
  endTime: Date | undefined
) => {
  if (!startTime || !endTime) return "N/A";
  const start = dayjs(startTime).tz(SCHEDULE_TIMEZONE).format("HH:mm");
  const end = dayjs(endTime).tz(SCHEDULE_TIMEZONE).format("HH:mm");
  return `${start} - ${end}`;
};

interface ProposalDateLike {
  startTime: string;
  endTime?: string;
  durationMinutes?: number;
}

const timeToMinutes = (time: string) => {
  if (!/^\d{2}:\d{2}$/.test(time)) return null;
  const [hours, minutes] = time.split(":").map(Number);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
};

const addMinutesToTime = (time: string, durationMinutes?: number) => {
  const startMinutes = timeToMinutes(time);
  if (startMinutes === null || !durationMinutes || durationMinutes <= 0) {
    return "";
  }
  const endMinutes = (startMinutes + durationMinutes) % (24 * 60);
  return `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(
    endMinutes % 60
  ).padStart(2, "0")}`;
};

const formatProposalRange = (proposal: ProposalDateLike) => {
  const endTime = proposal.endTime
    ? proposal.endTime
    : addMinutesToTime(proposal.startTime, proposal.durationMinutes);
  return endTime ? `${proposal.startTime} - ${endTime}` : proposal.startTime;
};

// Rótulo da prioridade que a instituição atribuiu a esta data (índice 0 =
// a data que a instituição mais prefere). Texto alinhado à página de
// agendamento (pages/agendar/[bloodbankSlug]/index.vue).
const priorityLabel = (priority: number) => {
  const labels = ["1ª opção preferida", "2ª opção", "3ª opção"];
  return labels[priority - 1] || `${priority}ª opção`;
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

// Counter proposal (propor outra data/horário)
const showCounterProposalModal = ref(false);
const isSendingCounterProposal = ref(false);
const counterProposalNote = ref("");
const counterProposalNeedsTechnicalVisit = ref(false);
interface CounterProposalDateDraft {
  slotKey: string;
  note: string;
}

interface TechnicalVisitProposalDateDraft {
  date: string;
  startTime: string;
  endTime: string;
  note: string;
}

const isEndTimeInvalid = (
  draft: Pick<TechnicalVisitProposalDateDraft, "startTime" | "endTime">
) => {
  if (!draft.startTime || !draft.endTime) return false;
  const startMinutes = timeToMinutes(draft.startTime);
  const endMinutes = timeToMinutes(draft.endTime);
  return (
    startMinutes === null ||
    endMinutes === null ||
    endMinutes <= startMinutes
  );
};

const counterProposalDates = ref<CounterProposalDateDraft[]>([
  { slotKey: "", note: "" },
]);

const availableCounterProposalSlots = computed(() => {
  const seen = new Set<string>();
  const slots =
    currentCollectionRequest.value?.availableCounterProposalOptions ||
    currentCollectionRequest.value?.availableSlotOptions ||
    [];

  return slots.filter((slot) => {
    const slotKey = `${slot.availableDateId}:${slot.slotId}`;
    if (seen.has(slotKey) || slot.isLocked || !slot.startTime || !slot.endTime) {
      return false;
    }

    seen.add(slotKey);
    return true;
  });
});

const counterProposalSlotItems = computed(() =>
  availableCounterProposalSlots.value.map((slot) => ({
    label: `${formatDate(slot.date)} · ${formatSlotTime(slot.startTime)} - ${formatSlotTime(slot.endTime)} · ${slot.teamName || "Equipe não definida"}`,
    value: `${slot.availableDateId}:${slot.slotId}`,
  }))
);

const formatSlotTime = (time: Date | string | undefined) => {
  if (!time) return "--:--";
  if (typeof time === "string" && /^\d{2}:\d{2}$/.test(time)) return time;
  return dayjs(time).tz(SCHEDULE_TIMEZONE).format("HH:mm");
};

const selectedCounterProposalSlot = (draft: CounterProposalDateDraft) =>
  availableCounterProposalSlots.value.find(
    (slot) => `${slot.availableDateId}:${slot.slotId}` === draft.slotKey
  );

const canProposeTechnicalVisit = computed(() => {
  const request = currentCollectionRequest.value;
  return Boolean(
    request?.status === "awaiting_technical_visit" &&
      !request.visitProposal &&
      !request.technicalVisitId
  );
});

const showTechnicalVisitProposalModal = ref(false);
const isSendingTechnicalVisitProposal = ref(false);
const technicalVisitProposalNote = ref("");
const technicalVisitProposalDates = ref<TechnicalVisitProposalDateDraft[]>([
  { date: "", startTime: "", endTime: "", note: "" },
]);

const addTechnicalVisitProposalDate = () => {
  technicalVisitProposalDates.value.push({
    date: "",
    startTime: "",
    endTime: "",
    note: "",
  });
};

const removeTechnicalVisitProposalDate = (index: number) => {
  technicalVisitProposalDates.value.splice(index, 1);
};

const showTechnicalVisitProposalDialog = () => {
  showTechnicalVisitProposalModal.value = true;
};

const isTechnicalVisitProposalValid = computed(
  () =>
    technicalVisitProposalDates.value.length > 0 &&
    technicalVisitProposalDates.value.every(
      (d) => d.date && d.startTime && d.endTime && !isEndTimeInvalid(d)
    )
);

const addCounterProposalDate = () => {
  counterProposalDates.value.push({
    slotKey: "",
    note: "",
  });
};

const removeCounterProposalDate = (index: number) => {
  counterProposalDates.value.splice(index, 1);
};

const showCounterProposalDialog = () => {
  showCounterProposalModal.value = true;
};

const isCounterProposalValid = computed(
  () =>
    counterProposalDates.value.length > 0 &&
    counterProposalDates.value.every(
      (draft) => selectedCounterProposalSlot(draft)
    ) &&
    new Set(counterProposalDates.value.map((draft) => draft.slotKey)).size ===
      counterProposalDates.value.length
);

const serializeCounterProposalDate = (draft: CounterProposalDateDraft) => {
  const slot = selectedCounterProposalSlot(draft);
  if (!slot) {
    throw new Error("Selecione um slot configurado");
  }

  const startTime = formatSlotTime(slot.startTime);
  const endTime = formatSlotTime(slot.endTime);
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  if (startMinutes === null || endMinutes === null) {
    throw new Error("Horário da proposta inválido");
  }

  return {
    date: dayjs
      .tz(`${slot.date}T12:00`, SCHEDULE_TIMEZONE)
      .toISOString(),
    availableDateId: slot.availableDateId,
    slotId: slot.slotId,
    startTime,
    endTime,
    durationMinutes: endMinutes - startMinutes,
    teamName: slot.teamName || undefined,
    note: draft.note,
  };
};

const serializeTechnicalVisitProposalDate = (
  draft: TechnicalVisitProposalDateDraft
) => {
  const startMinutes = timeToMinutes(draft.startTime);
  const endMinutes = timeToMinutes(draft.endTime);
  if (startMinutes === null || endMinutes === null) {
    throw new Error("Horário da proposta inválido");
  }

  return {
    date: dayjs
      .tz(`${draft.date}T00:00`, SCHEDULE_TIMEZONE)
      .toISOString(),
    startTime: draft.startTime,
    endTime: draft.endTime,
    durationMinutes: endMinutes - startMinutes,
    note: draft.note,
  };
};

const confirmCounterProposal = async () => {
  if (!isCounterProposalValid.value) {
    useToast().add({
      title: "Preencha todas as datas propostas",
      color: "warning",
      duration: 3000,
    });
    return;
  }

  isSendingCounterProposal.value = true;

  try {
    if (!bloodBanksLocationId.value) {
      throw new Error("ID do banco de sangue não encontrado");
    }

    await bloodbankStore.counterProposeCollectionRequest(
      requestId,
      {
        proposedDates: counterProposalDates.value.map(
          serializeCounterProposalDate
        ),
        needsTechnicalVisit: counterProposalNeedsTechnicalVisit.value,
        note: counterProposalNote.value,
      },
      bloodBanksLocationId.value
    );

    useToast().add({
      title: "Contraproposta enviada!",
      description: "A instituição foi notificada das novas opções de data.",
      color: "success",
      duration: 3000,
    });

    showCounterProposalModal.value = false;
    counterProposalNote.value = "";
    counterProposalNeedsTechnicalVisit.value = false;
    counterProposalDates.value = [
      { slotKey: "", note: "" },
    ];

    await loadRequestDetails();

    if (bloodBanksLocationId.value) {
      await bloodbankStore.refreshCollectionRequests(
        bloodBanksLocationId.value,
        "pending"
      );
    }
  } catch (error: any) {
    console.error("Error sending counter proposal:", error);
    useToast().add({
      title: "Erro ao enviar contraproposta",
      description: error.message || "Tente novamente mais tarde.",
      color: "error",
      duration: 3000,
    });
  } finally {
    isSendingCounterProposal.value = false;
  }
};

const confirmTechnicalVisitProposal = async () => {
  if (!isTechnicalVisitProposalValid.value) {
    useToast().add({
      title: "Preencha todas as datas propostas",
      color: "warning",
      duration: 3000,
    });
    return;
  }

  isSendingTechnicalVisitProposal.value = true;

  try {
    if (!bloodBanksLocationId.value) {
      throw new Error("ID do banco de sangue não encontrado");
    }

    await bloodbankStore.proposeTechnicalVisit(
      requestId,
      {
        proposedDates: technicalVisitProposalDates.value.map(
          serializeTechnicalVisitProposalDate
        ),
        note: technicalVisitProposalNote.value,
      },
      bloodBanksLocationId.value
    );

    useToast().add({
      title: "Proposta de visita técnica enviada!",
      description: "A instituição foi notificada das opções de data.",
      color: "success",
      duration: 3000,
    });

    showTechnicalVisitProposalModal.value = false;
    technicalVisitProposalNote.value = "";
    technicalVisitProposalDates.value = [
      { date: "", startTime: "", endTime: "", note: "" },
    ];

    await loadRequestDetails();
  } catch (error: any) {
    console.error("Error sending technical visit proposal:", error);
    useToast().add({
      title: "Erro ao enviar proposta de visita técnica",
      description: error.message || "Tente novamente mais tarde.",
      color: "error",
      duration: 3000,
    });
  } finally {
    isSendingTechnicalVisitProposal.value = false;
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
