<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h1 class="text-3xl font-bold text-default">
        Bem-vindo ao {{ bloodBankName }}
      </h1>
      <p class="text-muted mt-2">Dashboard do hemocentro</p>
    </div>

    <!-- User Info Card -->
    <UCard>
      <template #header>
        <h2 class="text-lg font-semibold">Informações do Usuário</h2>
      </template>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="text-sm font-medium text-muted">Nome</label>
          <p class="text-default">
            {{ userStore.user?.givenName }} {{ userStore.user?.surName }}
          </p>
        </div>
        <div>
          <label class="text-sm font-medium text-muted">Email</label>
          <p class="text-default">{{ userStore.user?.email }}</p>
        </div>
        <div>
          <label class="text-sm font-medium text-muted">Tipo Sanguíneo</label>
          <p class="text-default">{{ userStore.user?.bloodType }}</p>
        </div>
        <div>
          <label class="text-sm font-medium text-muted">Função</label>
          <p class="text-default">{{ userRole }}</p>
        </div>
      </div>
    </UCard>

    <!-- Blood Bank Info Card -->
    <UCard>
      <template #header>
        <h2 class="text-lg font-semibold">Informações do Hemocentro</h2>
      </template>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="text-sm font-medium text-muted">Nome</label>
          <p class="text-default">{{ bloodBankName }}</p>
        </div>
        <div>
          <label class="text-sm font-medium text-muted">Slug</label>
          <p class="text-default">{{ bloodbankSlug }}</p>
        </div>
        <div>
          <label class="text-sm font-medium text-muted">Status</label>
          <p class="text-default">
            <UBadge
              :label="bloodBankRole?.active ? 'Ativo' : 'Inativo'"
              :color="bloodBankRole?.active ? 'success' : 'error'"
            />
          </p>
        </div>
        <div>
          <label class="text-sm font-medium text-muted"
            >ID de Localização</label
          >
          <p class="text-default font-mono text-sm">
            {{ bloodBankRole?.bloodBanksLocationId || "N/A" }}
          </p>
        </div>
      </div>
    </UCard>

    <!-- Actions -->
    <div class="flex flex-wrap gap-4">
      <UButton color="primary" size="lg" icon="i-lucide-calendar">
        Gerenciar Coletas
      </UButton>
      <UButton
        color="secondary"
        variant="outline"
        size="lg"
        icon="i-lucide-bar-chart-3"
      >
        Relatórios
      </UButton>
      <UButton
        color="error"
        variant="outline"
        size="lg"
        icon="i-lucide-log-out"
        @click="handleLogout"
      >
        Logout
      </UButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useUserStore } from "~/stores/user";
import type { EnrichedMe } from "~/server/services/hemocioneId";

const userStore = useUserStore();
const route = useRoute();

const bloodbankSlug = route.params.bloodbankSlug as string;

// Get blood bank info from user's roles
const bloodBankRole = computed(() => {
  return userStore.user?.bloodBankRoles?.find(
    (role) => role.slug === bloodbankSlug
  );
});

const bloodBankName = computed(() => {
  // Since we don't have bloodBankInfo in the current structure,
  // we'll use the slug as a fallback or fetch the name from somewhere else
  return bloodBankRole.value?.slug || "Hemocentro";
});

const userRole = computed(() => {
  return bloodBankRole.value?.role === "admin"
    ? "Administrador"
    : "Funcionário";
});

const handleLogout = async () => {
  await userStore.logOut();
};

// Set page meta
definePageMeta({
  // Global auth middleware will handle authentication
});
</script>
