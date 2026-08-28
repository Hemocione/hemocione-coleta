<template>
  <UApp :locale="pt_br">
    <NuxtLayout>
      <NuxtPage :keepalive="route.meta.keepalive" />
    </NuxtLayout>
  </UApp>
</template>

<script setup lang="ts">
import { pt_br } from "@nuxt/ui/locale";
import { getOpenGraphMetadata } from "~/utils/openGraph";

const route = useRoute();
const config = useRuntimeConfig();
const openGraph = computed(() =>
  getOpenGraphMetadata(route.path, config.public.siteUrl)
);

useHead({
  title: "Hemocione Coleta",
  htmlAttrs: { lang: "pt-BR" },
  meta: [{ name: "description", content: "Hemocione Coleta" }],
});

useSeoMeta({
  ogTitle: () => openGraph.value?.title,
  ogDescription: () => openGraph.value?.description,
  ogType: "website",
  ogUrl: () => openGraph.value?.canonicalUrl,
  ogSiteName: () => openGraph.value?.siteName,
  ogImage: () => openGraph.value?.imageUrl,
  ogImageUrl: () => openGraph.value?.imageUrl,
  ogImageSecureUrl: () => openGraph.value?.imageUrl,
  ogImageType: () => openGraph.value?.imageType,
  ogImageWidth: () => openGraph.value?.imageWidth,
  ogImageHeight: () => openGraph.value?.imageHeight,
  ogImageAlt: () => openGraph.value?.imageAlt,
  twitterCard: "summary_large_image",
  twitterTitle: () => openGraph.value?.title,
  twitterDescription: () => openGraph.value?.description,
  twitterImage: () => openGraph.value?.imageUrl,
});
</script>
