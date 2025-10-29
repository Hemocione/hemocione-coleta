<template>
  <div class="min-h-screen bg-default flex items-center justify-center">
    <div class="text-center">
      <div
        class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"
      ></div>
      <p class="text-muted">Redirecionando para seu hemocentro...</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useUserStore } from "~/stores/user";

const userStore = useUserStore();

// Redirect to the user's first blood bank
onMounted(() => {
  const firstBloodBankSlug = userStore.firstBloodBankSlug;

  if (firstBloodBankSlug) {
    // Redirect to the blood bank dashboard
    navigateTo(`/${firstBloodBankSlug}`, { replace: true });
  } else {
    // If no blood bank slug is available, redirect to the agendar page (user is either not logged in or not a blood bank user)
    navigateTo("/agendar", { replace: true });
  }
});

// Set page meta
definePageMeta({
  layout: false,
});
</script>
