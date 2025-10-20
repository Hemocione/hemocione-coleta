<template>
  <div class="flex flex-col gap-8">
    <UCard>
      <template #header>
        <h2 class="text-xl font-bold">Calendário Completo</h2>
      </template>
      <div v-auto-animate class="flex flex-col gap-6">
        <UAlert color="info">
          Role a página para testar o comportamento de rolagem!
        </UAlert>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <UCard
            v-for="i in 32"
            :key="i"
            class="flex flex-col h-44 justify-between transition-all"
          >
            <template #header>
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-calendar" class="text-red-600 mr-2" />
                <span class="font-semibold text-gray-800"
                  >Dia {{ i }} de julho, 2024</span
                >
              </div>
            </template>
            <div class="flex flex-1 items-center">
              Evento fictício {{ i }}, descrição longa para testar o layout e
              possíveis quebras de linha em cards da agenda.
            </div>
            <template #footer>
              <div class="flex items-center gap-3 text-sm text-gray-500">
                <UIcon name="i-lucide-clock-4" class="text-gray-400" />
                08:00 – 17:00
                <UBadge color="success">Ativo</UBadge>
                <UBadge color="warning">Urbano</UBadge>
              </div>
            </template>
          </UCard>
        </div>
        <UDivider />
        <div class="flex justify-center p-6">
          <UPagination :total="96" :page-count="32" />
        </div>
      </div>
    </UCard>
  </div>
</template>
