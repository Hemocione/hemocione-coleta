<template>
  <div class="min-h-screen bg-gray-50 flex items-center justify-center px-4">
    <div class="text-center max-w-md">
      <UIcon
        name="i-lucide-shield-off"
        class="w-16 h-16 text-red-400 mx-auto mb-4"
      />
      <h1 class="text-xl font-semibold text-gray-900 mb-2">
        Sem acesso a nenhum hemocentro
      </h1>
      <p class="text-gray-600 mb-6">
        Sua conta não está vinculada a nenhum hemocentro. Se isso é um engano,
        entre em contato com o administrador do seu hemocentro.
      </p>
      <div class="flex flex-col sm:flex-row gap-3 justify-center">
        <UButton color="primary" @click="userStore.logOut()">
          Sair e entrar com outra conta
        </UButton>
        <UButton variant="outline" @click="navigateTo('/agendar')">
          Agendar uma doação
        </UButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useUserStore } from "~/stores/user";

const userStore = useUserStore();

definePageMeta({ layout: false });
</script>
