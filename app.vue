<template>
  <UApp :locale="pt_br">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>

<script setup lang="ts">
import { pt_br } from "@nuxt/ui/locale";

useHead({
  title: "Hemocione Coleta",
  meta: [{ name: "description", content: "Hemocione Coleta" }],
});
</script>
