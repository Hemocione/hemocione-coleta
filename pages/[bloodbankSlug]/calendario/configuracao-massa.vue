<template>
  <div class="flex flex-col gap-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <UButton
          icon="i-lucide-arrow-left"
          variant="ghost"
          color="neutral"
          @click="navigateTo(`/${route.params.bloodbankSlug}/calendario`)"
        />
        <div>
          <h1 class="text-2xl font-bold">Configuração em Massa</h1>
          <p class="text-sm text-gray-500">
            Configure a disponibilidade do ano inteiro de uma vez
          </p>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <USelect
          v-model="selectedYear"
          :items="yearOptions"
          class="w-32"
        />
        <USelect
          v-model="selectedTeamId"
          :items="teamOptions"
          placeholder="Todos os times"
          class="w-48"
        />
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="isLoading" class="flex items-center justify-center py-20">
      <USpinner />
      <span class="ml-3 text-gray-500">Carregando disponibilidades...</span>
    </div>

    <!-- Error state -->
    <UCard v-else-if="loadError">
      <p class="text-sm text-red-600">{{ loadError }}</p>
    </UCard>

    <!-- Year grid -->
    <template v-else>
      <!-- Quick actions -->
      <UCard>
        <div class="flex flex-wrap items-center gap-3">
          <span class="text-sm font-medium text-gray-700">Ações rápidas:</span>
          <UButton
            size="sm"
            variant="outline"
            @click="selectAllWeekdays"
          >
            Marcar dias úteis
          </UButton>
          <UButton
            size="sm"
            variant="outline"
            @click="deselectAll"
          >
            Desmarcar todos
          </UButton>
          <div class="ml-auto flex items-center gap-2 text-xs text-gray-500">
            <span class="inline-block w-3 h-3 rounded bg-red-100 border border-red-300" />
            <span>Bloqueado (coleta agendada)</span>
            <span class="inline-block w-3 h-3 rounded bg-green-100 border border-green-300 ml-2" />
            <span>Já disponível</span>
          </div>
        </div>
      </UCard>

      <!-- Months grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <UCard v-for="month in 12" :key="month">
          <div class="flex items-center justify-between mb-3">
            <h3 class="font-semibold text-sm">{{ monthNames[month - 1] }}</h3>
            <UButton
              size="xs"
              variant="ghost"
              @click="toggleMonth(month)"
            >
              {{ isMonthFullySelected(month) ? 'Desmarcar' : 'Marcar' }} mês
            </UButton>
          </div>

          <!-- Day headers -->
          <div class="grid grid-cols-7 gap-0.5 mb-1">
            <div
              v-for="dayName in dayNames"
              :key="dayName"
              class="text-center text-[10px] text-gray-400 font-medium"
            >
              {{ dayName }}
            </div>
          </div>

          <!-- Days grid -->
          <div class="grid grid-cols-7 gap-0.5">
            <!-- Empty cells for offset -->
            <div
              v-for="n in getMonthStartOffset(month)"
              :key="`empty-${month}-${n}`"
            />

            <!-- Day cells -->
            <button
              v-for="day in getDaysInMonth(month)"
              :key="`${month}-${day}`"
              :disabled="isDayLocked(month, day) || isDayPast(month, day)"
              class="relative w-full aspect-square flex items-center justify-center text-xs rounded transition-all"
              :class="getDayClasses(month, day)"
              @click="toggleDay(month, day)"
            >
              {{ day }}
            </button>
          </div>
        </UCard>
      </div>

      <!-- Summary & Save -->
      <UCard>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-6 text-sm">
            <span>
              <strong class="text-green-600">{{ changesCount.toCreate }}</strong> a criar
            </span>
            <span>
              <strong class="text-red-600">{{ changesCount.toDelete }}</strong> a remover
            </span>
            <span>
              <strong class="text-gray-500">{{ changesCount.unchanged }}</strong> sem alteração
            </span>
          </div>
          <div class="flex items-center gap-3">
            <UButton
              variant="outline"
              @click="resetToOriginal"
            >
              Desfazer alterações
            </UButton>
            <UButton
              color="primary"
              :loading="isSaving"
              :disabled="!hasChanges"
              @click="saveBulk"
            >
              Salvar configuração
            </UButton>
          </div>
        </div>
      </UCard>

      <!-- Results modal -->
      <UModal v-model:open="showResultsModal">
        <template #content>
          <div class="p-6">
            <h3 class="text-lg font-semibold mb-4">Resultado da configuração</h3>
            <div class="flex flex-col gap-3">
              <div v-if="bulkResult" class="grid grid-cols-3 gap-4 text-center">
                <div class="p-3 bg-green-50 rounded-lg">
                  <div class="text-2xl font-bold text-green-600">{{ bulkResult.created }}</div>
                  <div class="text-xs text-green-700">Criadas</div>
                </div>
                <div class="p-3 bg-red-50 rounded-lg">
                  <div class="text-2xl font-bold text-red-600">{{ bulkResult.deleted }}</div>
                  <div class="text-xs text-red-700">Removidas</div>
                </div>
                <div class="p-3 bg-gray-50 rounded-lg">
                  <div class="text-2xl font-bold text-gray-600">{{ bulkResult.skipped }}</div>
                  <div class="text-xs text-gray-700">Ignoradas</div>
                </div>
              </div>
              <div v-if="bulkResult?.errors?.length" class="mt-3">
                <h4 class="text-sm font-medium text-red-600 mb-2">Erros:</h4>
                <ul class="text-xs text-red-500 space-y-1">
                  <li v-for="(error, i) in bulkResult.errors" :key="i">{{ error }}</li>
                </ul>
              </div>
              <UButton class="mt-4" color="primary" block @click="showResultsModal = false">
                Fechar
              </UButton>
            </div>
          </div>
        </template>
      </UModal>
    </template>
  </div>
</template>

<script setup lang="ts">
import { useBloodbankStore } from '~/stores/bloodbank'
import { useUserStore } from '~/stores/user'
import { storeToRefs } from 'pinia'
import { fetchWithAuth } from '~/composables/useFetchWithAuth'

const route = useRoute()
const store = useBloodbankStore()
const userStore = useUserStore()
const { teams } = storeToRefs(store)

// O id vem do papel do usuário (rota atual), não da store global:
// em deep link/reload a store de bloodbank ainda não foi populada.
const currentBloodBankRole = computed(() => userStore.currentBloodBankRole)

const monthNames = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]
const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const currentYear = new Date().getFullYear()
const selectedYear = ref(currentYear)
const selectedTeamId = ref<string | null>(null)
const isLoading = ref(true)
const isSaving = ref(false)
const loadError = ref<string | null>(null)
const showResultsModal = ref(false)
const bulkResult = ref<{ created: number; deleted: number; skipped: number; errors: string[] } | null>(null)

// Map of "YYYY-MM-DD" -> boolean (selected/available)
const daySelections = ref<Map<string, boolean>>(new Map())
// Track which dates are already in the database
const existingDates = ref<Set<string>>(new Set())
// Track which dates have locked slots
const lockedDates = ref<Set<string>>(new Set())

const yearOptions = computed(() => {
  return [currentYear, currentYear + 1].map(y => ({ label: String(y), value: y }))
})

const teamOptions = computed(() => {
  const options: Array<{ label: string; value: string | null }> = [
    { label: 'Todos os times', value: null }
  ]
  for (const team of teams.value) {
    options.push({ label: team.name, value: team._id })
  }
  return options
})

const bloodBanksLocationId = computed(
  () => currentBloodBankRole.value?.bloodBanksLocationId || ''
)

// Helper functions
function getDateKey(month: number, day: number): string {
  return `${selectedYear.value}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function getDaysInMonth(month: number): number {
  return new Date(selectedYear.value, month, 0).getDate()
}

function getMonthStartOffset(month: number): number {
  return new Date(selectedYear.value, month - 1, 1).getDay()
}

function isDayPast(month: number, day: number): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const date = new Date(selectedYear.value, month - 1, day)
  return date < today
}

function isDayLocked(month: number, day: number): boolean {
  return lockedDates.value.has(getDateKey(month, day))
}

function isDaySelected(month: number, day: number): boolean {
  return daySelections.value.get(getDateKey(month, day)) ?? false
}

function isDayExisting(month: number, day: number): boolean {
  return existingDates.value.has(getDateKey(month, day))
}

function isWeekday(month: number, day: number): boolean {
  const dayOfWeek = new Date(selectedYear.value, month - 1, day).getDay()
  return dayOfWeek >= 1 && dayOfWeek <= 5
}

function getDayClasses(month: number, day: number): string {
  const key = getDateKey(month, day)
  const past = isDayPast(month, day)
  const locked = isDayLocked(month, day)
  const selected = daySelections.value.get(key) ?? false
  const existing = existingDates.value.has(key)

  if (past) return 'text-gray-300 cursor-not-allowed'
  if (locked) return 'bg-red-100 text-red-400 border border-red-300 cursor-not-allowed'
  if (selected && existing) return 'bg-green-100 text-green-800 border border-green-300 hover:bg-green-200 cursor-pointer'
  if (selected && !existing) return 'bg-blue-100 text-blue-800 border border-blue-300 hover:bg-blue-200 cursor-pointer'
  if (!selected && existing) return 'bg-yellow-100 text-yellow-800 border border-yellow-300 hover:bg-yellow-200 cursor-pointer'
  return 'bg-gray-50 text-gray-600 hover:bg-gray-100 cursor-pointer'
}

function toggleDay(month: number, day: number) {
  if (isDayPast(month, day) || isDayLocked(month, day)) return
  const key = getDateKey(month, day)
  const current = daySelections.value.get(key) ?? false
  daySelections.value.set(key, !current)
}

function toggleMonth(month: number) {
  const fullySelected = isMonthFullySelected(month)
  const days = getDaysInMonth(month)
  for (let day = 1; day <= days; day++) {
    if (isDayPast(month, day) || isDayLocked(month, day)) continue
    const key = getDateKey(month, day)
    daySelections.value.set(key, !fullySelected)
  }
}

function isMonthFullySelected(month: number): boolean {
  const days = getDaysInMonth(month)
  for (let day = 1; day <= days; day++) {
    if (isDayPast(month, day) || isDayLocked(month, day)) continue
    const key = getDateKey(month, day)
    if (!(daySelections.value.get(key) ?? false)) return false
  }
  return true
}

function selectAllWeekdays() {
  for (let month = 1; month <= 12; month++) {
    const days = getDaysInMonth(month)
    for (let day = 1; day <= days; day++) {
      if (isDayPast(month, day) || isDayLocked(month, day)) continue
      const key = getDateKey(month, day)
      daySelections.value.set(key, isWeekday(month, day))
    }
  }
}

function deselectAll() {
  for (let month = 1; month <= 12; month++) {
    const days = getDaysInMonth(month)
    for (let day = 1; day <= days; day++) {
      if (isDayPast(month, day) || isDayLocked(month, day)) continue
      const key = getDateKey(month, day)
      daySelections.value.set(key, false)
    }
  }
}

function resetToOriginal() {
  // Reset to the original state from the database
  for (const [key] of daySelections.value) {
    daySelections.value.set(key, existingDates.value.has(key) || lockedDates.value.has(key))
  }
}

const changesCount = computed(() => {
  let toCreate = 0
  let toDelete = 0
  let unchanged = 0

  for (const [key, selected] of daySelections.value) {
    const existing = existingDates.value.has(key) || lockedDates.value.has(key)
    if (selected && !existing) toCreate++
    else if (!selected && existing && !lockedDates.value.has(key)) toDelete++
    else unchanged++
  }

  return { toCreate, toDelete, unchanged }
})

const hasChanges = computed(() => {
  return changesCount.value.toCreate > 0 || changesCount.value.toDelete > 0
})

async function loadAvailableDates() {
  isLoading.value = true
  try {
    const response = await fetchWithAuth(
      `/api/v1/bloodbank/${bloodBanksLocationId.value}/available-dates?year=${selectedYear.value}`
    )

    existingDates.value.clear()
    lockedDates.value.clear()
    daySelections.value.clear()

    if (response.success) {
      for (const ad of response.data as any[]) {
        const dateStr = ad.date as string
        const hasLockedSlot = ad.slots?.some((s: any) => s.locked || s.lockedBy)
        if (hasLockedSlot) {
          lockedDates.value.add(dateStr)
        }
        existingDates.value.add(dateStr)
      }
    }

    // Initialize selections: existing dates are selected, rest are not
    for (let month = 1; month <= 12; month++) {
      const days = getDaysInMonth(month)
      for (let day = 1; day <= days; day++) {
        const key = getDateKey(month, day)
        daySelections.value.set(key, existingDates.value.has(key))
      }
    }
  } catch (error) {
    console.error('Error loading available dates:', error)
  } finally {
    isLoading.value = false
  }
}

async function saveBulk() {
  if (!hasChanges.value) return
  isSaving.value = true

  try {
    const entries: Array<{ date: string; isAvailable: boolean; teamId?: string | null }> = []

    for (const [key, selected] of daySelections.value) {
      const existing = existingDates.value.has(key)
      const locked = lockedDates.value.has(key)

      // Only send changes
      if (selected && !existing) {
        entries.push({
          date: key,
          isAvailable: true,
          teamId: selectedTeamId.value,
        })
      } else if (!selected && existing && !locked) {
        entries.push({
          date: key,
          isAvailable: false,
        })
      }
    }

    if (entries.length === 0) return

    const response = await fetchWithAuth(
      `/api/v1/bloodbank/${bloodBanksLocationId.value}/available-dates/bulk`,
      {
        method: 'PUT',
        body: { entries },
      }
    )

    if (response.success) {
      bulkResult.value = response.data as any
      showResultsModal.value = true
      // Reload to reflect changes
      await loadAvailableDates()
    }
  } catch (error: any) {
    console.error('Error saving bulk dates:', error)
  } finally {
    isSaving.value = false
  }
}

// Load data on mount
onMounted(async () => {
  if (!bloodBanksLocationId.value) {
    isLoading.value = false
    loadError.value = 'Você não tem acesso a este banco de sangue.'
    return
  }
  await Promise.all([
    loadAvailableDates(),
    store.loadTeams(bloodBanksLocationId.value, false),
  ])
})

// Reload when year changes
watch(selectedYear, () => {
  if (bloodBanksLocationId.value) {
    loadAvailableDates()
  }
})
</script>
