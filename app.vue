<template>
  <UApp :locale="pt_br">
    <NuxtLayout>
      <NuxtPage :keepalive="route.meta.keepalive" />
    </NuxtLayout>
  </UApp>
</template>

<script setup lang="ts">
import { pt_br } from "@nuxt/ui/locale";

const route = useRoute();

useHead({
  title: "Hemocione Coleta",
  htmlAttrs: { lang: "pt-BR" },
  meta: [{ name: "description", content: "Hemocione Coleta" }],
});
</script>
