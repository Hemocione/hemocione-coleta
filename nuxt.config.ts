import { getPublicBaseUrl } from "./utils/publicUrl";

const siteUrl = getPublicBaseUrl();
const currentEnv = process.env.VERCEL_ENV || "dev";
const bugsnagApiKey = process.env.BUGSNAG_API_KEY?.trim();

export default defineNuxtConfig({
  devtools: { enabled: true },
  routeRules: {
    // prerender index route by default
    "/": { prerender: true },
  },
  runtimeConfig: {
    mongodbUri:
      process.env.MONGO_URI ||
      "mongodb://localhost:27017/coleta?authSource=admin&directConnection=true",
    dbName: process.env.DB_NAME || "coleta",
    secret: process.env.SECRET || "dev-secret",
    public: {
      bugsnagApiKey: process.env.BUGSNAG_API_KEY || "",
      authCookieKey: process.env.HEMOCIONE_AUTH_COOKIE_KEY || "devHemocioneId",
      hemocioneIdApiUrl:
        process.env.HEMOCIONE_ID_API_URL ||
        "https://hemocione-id-dev.cpt.hemocione.com.br",
      hemocioneIdUrl:
        process.env.HEMOCIONE_ID_URL ?? "https://id.d.hemocione.com.br",
      eventosHemocione:
        process.env.EVENTOS_HEMOCIONE || "https://eventos.d.hemocione.com.br/",
      siteUrl,
    },
    hemocioneIdJwtSecretKey:
      process.env.HEMOCIONE_ID_JWT_SECRET_KEY ?? "secret",
    hemocioneIdIntegrationSecret:
      process.env.HEMOCIONE_ID_INTEGRATION_SECRET ?? "secret",
    hemocioneDigitalEventUrl:
      process.env.HEMOCIONE_DIGITAL_EVENT_URL ||
      process.env.EVENTOS_HEMOCIONE ||
      "https://eventos.d.hemocione.com.br",
    coletaIntegrationSecret:
      process.env.COLETA_INTEGRATION_SECRET ?? "secret",
    ondedoarApiUrl: process.env.ONDEDOAR_API_URL || "",
    discordBloodBankInterestWebhookUrl:
      process.env.DISCORD_BLOODBANK_INTEREST_WEBHOOK_URL || "",
  },
  nitro: {
    preset: "vercel", // Deploy no Vercel
    plugins: ["~/server/plugins/mongoose.ts"], // Plugin do MongoDB
  },
  app: {
    pageTransition: { name: "fade", mode: "out-in" },
    layoutTransition: { name: "fade", mode: "out-in" },
  },
  css: [
    "~/assets/css/global.css",
    "~/assets/css/nuxt-ui-theme.css",
    "~/assets/css/transitions.css",
    "~/assets/css/maplibre.css",
  ],
  modules: [
    "@nuxt/ui",
    "nuxt-bugsnag",
    "@nuxt/fonts",
    "@pinia/nuxt",
    "@nuxt/image",
    "@formkit/auto-animate/nuxt",
    "nuxt-maplibre",
  ],
  image: {
    domains: ["cdn.hemocione.com.br"],
  },
  icon: {
    serverBundle: {
      remote: true,
    },
  },
  bugsnag: {
    publishRelease: Boolean(bugsnagApiKey),
    disableLog: false, // might activate later
    baseUrl: siteUrl,
    config: {
      apiKey: bugsnagApiKey || "",
      enabledReleaseStages: ["prod", "dev"],
      releaseStage: currentEnv,
      appVersion: `${currentEnv}-${process.env.VERCEL_GIT_COMMIT_SHA}`,
    },
  },

  compatibilityDate: "2025-10-23",
  ssr: false,
});
