<template>
  <div class="h-screen flex flex-col">
    <!-- Header -->
    <header class="bg-white shadow-sm border-b border-grey-200 px-6 py-4">
      <div class="flex items-center justify-between">
        <h1 class="text-3xl font-bold text-grey-800 tracking-tight">
          Geofencer
        </h1>
        <div class="flex items-center space-x-4">
          <!-- Map Style Selector -->
          <div class="relative">
            <select
              v-model="selectedMapStyle"
              @change="changeMapStyle"
              class="bg-white border border-grey-300 text-grey-700 py-2 px-3 pr-8 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 font-medium text-sm shadow-sm hover:shadow-md appearance-none cursor-pointer"
            >
              <option value="positron">Mapa Limpo</option>
              <option value="voyager">Mapa Detalhado</option>
              <option value="dark-matter">Mapa Escuro</option>
              <option value="openstreetmap">OpenStreetMap</option>
            </select>
            <div
              class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-grey-700"
            >
              <svg
                class="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>
          </div>

          <!-- Go to coordinates button -->
          <button
            @click="showCoordinateModal = true"
            class="bg-blue-500 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-all duration-200 font-semibold shadow-sm hover:shadow-md"
          >
            <svg
              class="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <span class="font-medium">Ir para coordenadas</span>
          </button>

          <!-- Go to address button -->
          <button
            @click="showAddressModal = true"
            class="bg-purple-500 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-all duration-200 font-semibold shadow-sm hover:shadow-md"
          >
            <svg
              class="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              />
            </svg>
            <span class="font-medium">Ir para endereço</span>
          </button>

          <!-- Register geofence button -->
          <button
            @click="showRegisterModal = true"
            :disabled="
              !currentGeofence || registeredGeofences.has(currentGeofence.id)
            "
            class="bg-green-500 hover:bg-green-700 disabled:bg-grey-300 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-all duration-200 font-semibold shadow-sm hover:shadow-md"
          >
            <svg
              class="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
            <span class="font-medium">Cadastrar na Vammo</span>
          </button>
        </div>
      </div>
    </header>

    <!-- Map Container -->
    <div class="flex-1 relative">
      <ClientOnly>
        <MglMap
          :map-style="mapStyle"
          :center="mapCenter"
          :zoom="zoom"
          ref="mapRef"
        >
          <MglNavigationControl />
        </MglMap>
      </ClientOnly>

      <!-- Geofence Info -->
      <div
        v-if="currentGeofence"
        class="absolute bottom-4 left-4 z-[1000] bg-white rounded-xl shadow-xl p-4 max-w-sm border border-grey-100"
      >
        <!-- Status Indicator -->
        <div
          v-if="hasActiveGeofence && !isCurrentGeofenceRegistered"
          class="absolute -top-2 -left-2 bg-yellow-500 text-white text-xs px-2 py-1 rounded-full font-medium"
        >
          Ativa
        </div>
        <!-- Geofence Counter -->
        <div
          v-if="getAllGeofences.length > 1"
          class="absolute -top-2 -right-2 bg-blue-500 text-white text-xs px-2 py-1 rounded-full font-medium"
        >
          {{ getAllGeofences.findIndex((g) => g.isActive) + 1 }}/{{
            getAllGeofences.length
          }}
        </div>
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center space-x-2">
            <h3 class="font-bold text-grey-800 text-lg tracking-tight">
              {{
                isCurrentGeofenceRegistered
                  ? currentGeofence.name || "Geofence Cadastrada"
                  : "Geofence Atual"
              }}
            </h3>
            <div
              v-if="isCurrentGeofenceRegistered"
              class="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-medium"
            >
              Cadastrada
            </div>
          </div>
          <div class="flex items-center space-x-2">
            <!-- Navigation buttons for multiple geofences -->
            <div
              v-if="getAllGeofences.length > 1"
              class="flex items-center space-x-1"
            >
              <button
                @click="selectPreviousGeofence"
                class="text-grey-600 hover:text-grey-800 transition-colors p-1 rounded-lg hover:bg-grey-50"
                title="Geofence anterior"
              >
                <svg
                  class="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
              <button
                @click="selectNextGeofence"
                class="text-grey-600 hover:text-grey-800 transition-colors p-1 rounded-lg hover:bg-grey-50"
                title="Próxima geofence"
              >
                <svg
                  class="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            </div>
            <!-- Discard button -->
            <button
              v-if="!isCurrentGeofenceRegistered"
              @click="discardGeofence"
              class="text-red-500 hover:text-red-700 transition-colors p-1 rounded-lg hover:bg-red-50"
              title="Descartar geofence"
            >
              <svg
                class="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          </div>
        </div>
        <div class="space-y-1 text-sm text-grey-600">
          <p class="flex items-center justify-between">
            <span class="font-semibold text-grey-700">Área:</span>
            <span class="font-medium">{{
              formatArea(currentGeofence.area)
            }}</span>
          </p>
          <p class="flex items-center justify-between">
            <span class="font-semibold text-grey-700">Centro:</span>
            <span class="font-mono text-xs bg-grey-100 px-2 py-1 rounded">{{
              formatCoordinates(currentGeofence.center)
            }}</span>
          </p>
          <p class="flex items-center justify-between">
            <span class="font-semibold text-grey-700">Pontos:</span>
            <span class="font-medium text-blue-600"
              >{{ currentGeofence.coordinates.length - 1 }} vértices</span
            >
          </p>
        </div>
      </div>

      <!-- Drawing Instructions with Transition -->
      <transition name="fade-slide" mode="out-in" appear>
        <div
          v-if="isDrawing"
          class="absolute top-4 left-1/2 transform -translate-x-1/2 z-[1000] bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg font-medium text-sm flex items-center space-x-2"
        >
          <svg
            class="w-4 h-4 animate-pulse"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
            />
          </svg>
          <span
            >Clique para adicionar pontos • Duplo clique ou Enter para
            finalizar</span
          >
        </div>
      </transition>

      <!-- Active Geofence Warning -->
      <transition name="fade-slide" mode="out-in" appear>
        <div
          v-if="hasActiveGeofence && !isCurrentGeofenceRegistered"
          class="absolute top-4 left-1/2 transform -translate-x-1/2 z-[1000] bg-yellow-500 text-white px-4 py-2 rounded-lg shadow-lg font-medium text-sm flex items-center space-x-2"
        >
          <svg
            class="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
          <span
            >Você tem uma geofence ativa. Descarte ou cadastre antes de criar
            uma nova.</span
          >
        </div>
      </transition>
    </div>

    <!-- Coordinate Modal -->
    <div
      v-if="showCoordinateModal"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[2000]"
    >
      <div
        class="bg-white rounded-xl p-6 w-96 shadow-2xl border border-grey-100"
      >
        <h3 class="text-xl font-bold mb-5 text-grey-800 tracking-tight">
          Ir para coordenadas
        </h3>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-semibold text-grey-700 mb-2"
              >Latitude</label
            >
            <input
              v-model="coordinateForm.lat"
              type="number"
              step="any"
              class="w-full px-4 py-3 border border-grey-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 font-mono"
              placeholder="Ex: -23.5505"
            />
          </div>
          <div>
            <label class="block text-sm font-semibold text-grey-700 mb-2"
              >Longitude</label
            >
            <input
              v-model="coordinateForm.lng"
              type="number"
              step="any"
              class="w-full px-4 py-3 border border-grey-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 font-mono"
              placeholder="Ex: -46.6333"
            />
          </div>
        </div>
        <div class="flex justify-end space-x-3 mt-6">
          <button
            @click="showCoordinateModal = false"
            class="px-4 py-2 text-grey-600 hover:text-grey-800 transition-colors font-medium"
          >
            Cancelar
          </button>
          <button
            @click="goToCoordinates"
            class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 font-semibold shadow-sm hover:shadow-md"
          >
            Ir
          </button>
        </div>
      </div>
    </div>

    <!-- Address Modal -->
    <div
      v-if="showAddressModal"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[2000]"
    >
      <div
        class="bg-white rounded-xl p-6 w-96 shadow-2xl border border-grey-100"
      >
        <h3 class="text-xl font-bold mb-5 text-grey-800 tracking-tight">
          Ir para endereço
        </h3>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-semibold text-grey-700 mb-2"
              >Endereço</label
            >
            <textarea
              v-model="addressForm.address"
              class="w-full px-4 py-3 border border-grey-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 font-medium resize-none"
              placeholder="Digite o endereço completo (ex: Av. Paulista, 1000, São Paulo, SP)"
              rows="3"
            ></textarea>
          </div>
          <div
            v-if="addressForm.isLoading"
            class="flex items-center justify-center py-2"
          >
            <div
              class="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500"
            ></div>
            <span class="ml-2 text-sm text-grey-600"
              >Buscando coordenadas...</span
            >
          </div>
          <div
            v-if="addressForm.error"
            class="bg-red-50 border border-red-200 rounded-lg p-3"
          >
            <p class="text-red-700 text-sm">{{ addressForm.error }}</p>
          </div>
        </div>
        <div class="flex justify-end space-x-3 mt-6">
          <button
            @click="showAddressModal = false"
            class="px-4 py-2 text-grey-600 hover:text-grey-800 transition-colors font-medium"
          >
            Cancelar
          </button>
          <button
            @click="goToAddress"
            :disabled="!addressForm.address.trim() || addressForm.isLoading"
            class="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-700 disabled:bg-grey-300 disabled:cursor-not-allowed transition-all duration-200 font-semibold shadow-sm hover:shadow-md"
          >
            Buscar
          </button>
        </div>
      </div>
    </div>

    <!-- Register Modal -->
    <div
      v-if="showRegisterModal"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[2000]"
    >
      <div
        class="bg-white rounded-xl p-6 w-96 shadow-2xl border border-grey-100"
      >
        <h3 class="text-xl font-bold mb-5 text-grey-800 tracking-tight">
          Cadastrar Geofence na Vammo
        </h3>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-semibold text-grey-700 mb-2"
              >Nome da Geofence</label
            >
            <input
              v-model="registerForm.name"
              type="text"
              class="w-full px-4 py-3 border border-grey-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 font-medium"
              placeholder="Digite um nome para a geofence"
            />
          </div>
          <div>
            <label class="block text-sm font-semibold text-grey-700 mb-2"
              >Tipo da Geofence</label
            >
            <select
              v-model="registerForm.type"
              class="w-full px-4 py-3 border border-grey-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 font-medium"
            >
              <option value="">Selecione um tipo</option>
              <option value="WATCH">WATCH</option>
              <option value="SAFE">SAFE</option>
              <option value="SERVICE">SERVICE</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-semibold text-grey-700 mb-2"
              >Segredo</label
            >
            <input
              v-model="registerForm.secret"
              type="password"
              class="w-full px-4 py-3 border border-grey-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 font-mono"
              placeholder="Digite o segredo"
            />
          </div>
          <div>
            <label class="block text-sm font-semibold text-grey-700 mb-2"
              >Confirmação</label
            >
            <input
              v-model="registerForm.confirmation"
              type="text"
              class="w-full px-4 py-3 border border-grey-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 font-mono"
              placeholder="Digite 'CONFIRMO' para confirmar"
            />
          </div>
        </div>
        <div class="flex justify-end space-x-3 mt-6">
          <button
            @click="showRegisterModal = false"
            class="px-4 py-2 text-grey-600 hover:text-grey-800 transition-colors font-medium"
          >
            Cancelar
          </button>
          <button
            @click="registerGeofence"
            :disabled="!canRegister"
            class="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-700 disabled:bg-grey-300 disabled:cursor-not-allowed transition-all duration-200 font-semibold shadow-sm hover:shadow-md flex items-center justify-center space-x-2"
          >
            <div
              v-if="isRegistering"
              class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"
            ></div>
            <span>{{ isRegistering ? "Cadastrando..." : "Cadastrar" }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Success Modal -->
    <div
      v-if="showSuccessModal"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[2000]"
    >
      <div
        class="bg-white rounded-xl p-6 w-96 shadow-2xl border border-grey-100"
      >
        <div class="text-center">
          <div
            class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4"
          >
            <svg
              class="h-6 w-6 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h3 class="text-xl font-bold mb-2 text-grey-800 tracking-tight">
            Geofence Cadastrada!
          </h3>
          <p class="text-grey-600 mb-6">
            A geofence foi cadastrada com sucesso. O que você gostaria de fazer
            agora?
          </p>
        </div>
        <div class="flex flex-col space-y-3">
          <button
            @click="createNewGeofence"
            class="w-full px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 font-semibold shadow-sm hover:shadow-md"
          >
            Cadastrar Nova Geofence
          </button>
          <button
            @click="goToBackoffice"
            class="w-full px-4 py-3 bg-grey-600 text-white rounded-lg hover:bg-grey-800 transition-all duration-200 font-semibold shadow-sm hover:shadow-md"
          >
            Ir para o backoffice
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from "vue";

// Reactive state
const mapRef = ref(null);
const map = ref(null);
const draw = ref(null);
const zoom = ref(13);
const mapCenter = ref([-46.6333, -23.5505]); // MapLibre uses [lng, lat] format
const currentGeofence = ref(null);
const registeredGeofences = ref(new Set());
const showCoordinateModal = ref(false);
const showRegisterModal = ref(false);
const showAddressModal = ref(false);
const showSuccessModal = ref(false);
const isDrawing = ref(false); // New state for drawing instructions
const hasActiveGeofence = ref(false); // Track if user has an active geofence

// MapLibre configuration
const selectedMapStyle = ref("voyager"); // Default to voyager style

const mapStyles = {
  positron: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  voyager: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
  "dark-matter":
    "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  openstreetmap: {
    version: 8,
    sources: {
      osm: {
        type: "raster",
        tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
        tileSize: 256,
        attribution: "© OpenStreetMap contributors",
      },
    },
    layers: [
      {
        id: "osm",
        type: "raster",
        source: "osm",
        minzoom: 0,
        maxzoom: 19,
      },
    ],
  },
};

const mapStyle = computed(() => mapStyles[selectedMapStyle.value]);

// Form data
const coordinateForm = ref({
  lat: "",
  lng: "",
});

const addressForm = ref({
  address: "",
  isLoading: false,
  error: "",
});

const registerForm = ref({
  name: "",
  type: "",
  secret: "",
  confirmation: "",
});

const isRegistering = ref(false);

// Computed properties
const isCurrentGeofenceRegistered = computed(() => {
  if (!draw.value || !currentGeofence.value) return false;
  const data = draw.value.getAll();
  if (data.features.length > 0) {
    const feature = data.features[0];
    return feature.properties?.registered === true;
  }
  return false;
});

// Check if current geofence is editable (not registered)
const isCurrentGeofenceEditable = computed(() => {
  return currentGeofence.value && !isCurrentGeofenceRegistered.value;
});

// Get all available geofences
const getAllGeofences = computed(() => {
  if (!draw.value) return [];

  const data = draw.value.getAll();
  return data.features
    .filter((feature) => feature.geometry.type === "Polygon")
    .map((feature) => ({
      id: feature.id,
      geofenceId: feature.properties?.geofenceId,
      isRegistered: feature.properties?.registered === true,
      isActive: feature.properties && feature.properties.active === true,
    }));
});

const canRegister = computed(() => {
  return (
    registerForm.value.name &&
    registerForm.value.type &&
    registerForm.value.secret &&
    registerForm.value.confirmation === "CONFIRMO" &&
    isCurrentGeofenceEditable.value &&
    !registeredGeofences.value.has(currentGeofence.value.id) &&
    !isRegistering.value
  );
});

// Methods
const changeMapStyle = () => {
  if (map.value) {
    map.value.setStyle(mapStyles[selectedMapStyle.value]);
  }
};

const initializeMap = async () => {
  // Wait for the map to be available
  await nextTick();

  if (mapRef.value && mapRef.value.map) {
    console.log("Map loaded:", mapRef.value.map);
    map.value = mapRef.value.map;

    try {
      // Check if MapboxDraw is available globally (loaded via CDN)
      console.log("Checking for MapboxDraw...");
      if (typeof window !== "undefined" && window.MapboxDraw) {
        console.log("MapboxDraw found globally:", window.MapboxDraw);

        // Configure MapboxDraw for MapLibre
        window.MapboxDraw.constants.classes.CANVAS = "maplibregl-canvas";
        window.MapboxDraw.constants.classes.CONTROL_BASE = "maplibregl-ctrl";
        window.MapboxDraw.constants.classes.CONTROL_PREFIX = "maplibregl-ctrl-";
        window.MapboxDraw.constants.classes.CONTROL_GROUP =
          "maplibregl-ctrl-group";
        window.MapboxDraw.constants.classes.ATTRIBUTION =
          "maplibregl-ctrl-attrib";

        console.log("Creating draw control...");
        // Initialize draw control
        draw.value = new window.MapboxDraw({
          displayControlsDefault: true,
          controls: {
            polygon: true,
            trash: true,
          },
          styles: [
            // Polygon fill - Active (editable)
            {
              id: "gl-draw-polygon-fill",
              type: "fill",
              filter: [
                "all",
                ["==", "$type", "Polygon"],
                ["!=", "mode", "static"],
              ],
              paint: {
                "fill-color": "#3388ff",
                "fill-outline-color": "#3388ff",
                "fill-opacity": 0.2,
              },
            },
            // Polygon fill - Registered (immutable)
            {
              id: "gl-draw-polygon-fill-registered",
              type: "fill",
              filter: [
                "all",
                ["==", "$type", "Polygon"],
                ["==", "mode", "static"],
                ["==", "meta", "registered"],
              ],
              paint: {
                "fill-color": "#10b981",
                "fill-outline-color": "#10b981",
                "fill-opacity": 0.1,
              },
            },
            // Polygon outline - Active
            {
              id: "gl-draw-polygon-stroke-active",
              type: "line",
              filter: [
                "all",
                ["==", "$type", "Polygon"],
                ["==", "active", "true"],
              ],
              layout: {
                "line-cap": "round",
                "line-join": "round",
              },
              paint: {
                "line-color": "#3388ff",
                "line-dasharray": [0.2, 2],
                "line-width": 2,
              },
            },
            // Polygon outline - Inactive (editable)
            {
              id: "gl-draw-polygon-stroke-inactive",
              type: "line",
              filter: [
                "all",
                ["==", "$type", "Polygon"],
                ["==", "active", "false"],
                ["!=", "meta", "registered"],
              ],
              layout: {
                "line-cap": "round",
                "line-join": "round",
              },
              paint: {
                "line-color": "#3388ff",
                "line-width": 2,
              },
            },
            // Polygon outline - Registered (immutable)
            {
              id: "gl-draw-polygon-stroke-registered",
              type: "line",
              filter: [
                "all",
                ["==", "$type", "Polygon"],
                ["==", "active", "false"],
                ["==", "meta", "registered"],
              ],
              layout: {
                "line-cap": "round",
                "line-join": "round",
              },
              paint: {
                "line-color": "#10b981",
                "line-width": 3,
                "line-dasharray": [5, 5],
              },
            },
            // Vertex points - ALWAYS VISIBLE
            {
              id: "gl-draw-polygon-and-line-vertex-halo-active",
              type: "circle",
              filter: [
                "all",
                ["==", "meta", "vertex"],
                ["==", "$type", "Point"],
              ],
              paint: {
                "circle-radius": 8,
                "circle-color": "#fff",
              },
            },
            {
              id: "gl-draw-polygon-and-line-vertex-active",
              type: "circle",
              filter: [
                "all",
                ["==", "meta", "vertex"],
                ["==", "$type", "Point"],
              ],
              paint: {
                "circle-radius": 6,
                "circle-color": "#3388ff",
              },
            },
            // Midpoints - ALWAYS VISIBLE
            {
              id: "gl-draw-line-midpoint",
              type: "circle",
              filter: [
                "all",
                ["==", "$type", "Point"],
                ["==", "meta", "midpoint"],
              ],
              paint: {
                "circle-radius": 3,
                "circle-color": "#3388ff",
              },
            },
            // Additional vertex points for static polygons
            {
              id: "gl-draw-polygon-and-line-vertex-halo-static",
              type: "circle",
              filter: [
                "all",
                ["==", "meta", "vertex"],
                ["==", "$type", "Point"],
                ["==", "mode", "static"],
              ],
              paint: {
                "circle-radius": 8,
                "circle-color": "#fff",
              },
            },
            {
              id: "gl-draw-polygon-and-line-vertex-static",
              type: "circle",
              filter: [
                "all",
                ["==", "meta", "vertex"],
                ["==", "$type", "Point"],
                ["==", "mode", "static"],
              ],
              paint: {
                "circle-radius": 6,
                "circle-color": "#3388ff",
              },
            },
          ],
        });

        console.log("Draw control created:", draw.value);

        // Add draw control to map
        console.log("Adding draw control to map...");
        map.value.addControl(draw.value);
        console.log("Draw control added successfully");

        // Add event listeners
        map.value.on("draw.create", updateGeofence);
        map.value.on("draw.delete", clearGeofence);
        map.value.on("draw.update", updateGeofence);

        // Add drawing mode detection
        map.value.on("draw.modechange", (e) => {
          console.log("Draw mode changed:", e.mode);
          isDrawing.value = e.mode === "draw_polygon";
        });

        console.log("Event listeners added");
      } else {
        // Fallback: try dynamic import
        console.log("MapboxDraw not found globally, trying dynamic import...");
        const MapboxDraw = await import("@mapbox/mapbox-gl-draw").catch(
          () => null
        );
        if (!MapboxDraw) {
          console.error("MapboxDraw not available");
          return;
        }
        console.log("MapboxDraw imported successfully:", MapboxDraw);

        // Configure MapboxDraw for MapLibre
        MapboxDraw.default.constants.classes.CANVAS = "maplibregl-canvas";
        MapboxDraw.default.constants.classes.CONTROL_BASE = "maplibregl-ctrl";
        MapboxDraw.default.constants.classes.CONTROL_PREFIX =
          "maplibregl-ctrl-";
        MapboxDraw.default.constants.classes.CONTROL_GROUP =
          "maplibregl-ctrl-group";
        MapboxDraw.default.constants.classes.ATTRIBUTION =
          "maplibregl-ctrl-attrib";

        console.log("Creating draw control...");
        // Initialize draw control
        draw.value = new MapboxDraw.default({
          displayControlsDefault: false,
          controls: {
            polygon: true,
            trash: true,
          },
          styles: [
            // Polygon fill
            {
              id: "gl-draw-polygon-fill",
              type: "fill",
              filter: [
                "all",
                ["==", "$type", "Polygon"],
                ["!=", "mode", "static"],
              ],
              paint: {
                "fill-color": "#3388ff",
                "fill-outline-color": "#3388ff",
                "fill-opacity": 0.2,
              },
            },
            // Polygon outline
            {
              id: "gl-draw-polygon-stroke-active",
              type: "line",
              filter: [
                "all",
                ["==", "$type", "Polygon"],
                ["==", "active", "true"],
              ],
              layout: {
                "line-cap": "round",
                "line-join": "round",
              },
              paint: {
                "line-color": "#3388ff",
                "line-dasharray": [0.2, 2],
                "line-width": 2,
              },
            },
            // Polygon outline (inactive)
            {
              id: "gl-draw-polygon-stroke-inactive",
              type: "line",
              filter: [
                "all",
                ["==", "$type", "Polygon"],
                ["==", "active", "false"],
              ],
              layout: {
                "line-cap": "round",
                "line-join": "round",
              },
              paint: {
                "line-color": "#3388ff",
                "line-width": 2,
              },
            },
            // Vertex points - ALWAYS VISIBLE
            {
              id: "gl-draw-polygon-and-line-vertex-halo-active",
              type: "circle",
              filter: [
                "all",
                ["==", "meta", "vertex"],
                ["==", "$type", "Point"],
              ],
              paint: {
                "circle-radius": 8,
                "circle-color": "#fff",
              },
            },
            {
              id: "gl-draw-polygon-and-line-vertex-active",
              type: "circle",
              filter: [
                "all",
                ["==", "meta", "vertex"],
                ["==", "$type", "Point"],
              ],
              paint: {
                "circle-radius": 6,
                "circle-color": "#3388ff",
              },
            },
            // Midpoints - ALWAYS VISIBLE
            {
              id: "gl-draw-line-midpoint",
              type: "circle",
              filter: [
                "all",
                ["==", "$type", "Point"],
                ["==", "meta", "midpoint"],
              ],
              paint: {
                "circle-radius": 3,
                "circle-color": "#3388ff",
              },
            },
            // Additional vertex points for static polygons
            {
              id: "gl-draw-polygon-and-line-vertex-halo-static",
              type: "circle",
              filter: [
                "all",
                ["==", "meta", "vertex"],
                ["==", "$type", "Point"],
                ["==", "mode", "static"],
              ],
              paint: {
                "circle-radius": 8,
                "circle-color": "#fff",
              },
            },
            {
              id: "gl-draw-polygon-and-line-vertex-static",
              type: "circle",
              filter: [
                "all",
                ["==", "meta", "vertex"],
                ["==", "$type", "Point"],
                ["==", "mode", "static"],
              ],
              paint: {
                "circle-radius": 6,
                "circle-color": "#3388ff",
              },
            },
          ],
        });

        console.log("Draw control created:", draw.value);

        // Add draw control to map
        console.log("Adding draw control to map...");
        map.value.addControl(draw.value);
        console.log("Draw control added successfully");

        // Add event listeners
        map.value.on("draw.create", updateGeofence);
        map.value.on("draw.delete", clearGeofence);
        map.value.on("draw.update", updateGeofence);

        // Add drawing mode detection
        map.value.on("draw.modechange", (e) => {
          console.log("Draw mode changed:", e.mode);
          isDrawing.value = e.mode === "draw_polygon";
        });

        console.log("Event listeners added");
      }
    } catch (error) {
      console.error("Error initializing MapboxDraw:", error);
      // Fallback: show error message to user
      alert(
        "Erro ao carregar ferramentas de desenho. Verifique o console para mais detalhes."
      );
    }
  } else {
    console.log("Map not ready yet, retrying...");
    setTimeout(initializeMap, 100);
  }
};

// Lifecycle
onMounted(() => {
  initializeMap();

  // Add selection change event listener after map initialization
  nextTick(() => {
    if (map.value) {
      map.value.on("draw.selectionchange", handleSelectionChange);

      // Hide the trash button
      hideTrashButton();

      // Force update geofence after a short delay to ensure it's displayed
      setTimeout(() => {
        updateGeofence();
      }, 500);

      // Hide trash button with additional delay to ensure MapboxDraw is loaded
      setTimeout(() => {
        hideTrashButton();
      }, 1000);
    }
  });
});

const updateGeofence = async () => {
  if (!draw.value) return;

  console.log("updateGeofence called");
  const data = draw.value.getAll();
  console.log("All features:", data.features);

  if (data.features.length > 0) {
    // Get the active feature or the first polygon feature
    const activeFeature = data.features.find(
      (f) => f.properties && f.properties.active === true
    );
    const polygonFeatures = data.features.filter(
      (f) => f.geometry.type === "Polygon"
    );
    const feature = activeFeature || polygonFeatures[0] || data.features[0];

    console.log("Active feature:", activeFeature);
    console.log("Polygon features:", polygonFeatures);
    console.log("Selected feature:", feature);

    if (!feature) {
      console.log("No feature found, setting currentGeofence to null");
      currentGeofence.value = null;
      hasActiveGeofence.value = false;

      // Re-enable polygon drawing control
      const polygonButton = document.querySelector(
        '.maplibregl-ctrl-group button[data-mode="draw_polygon"]'
      );
      if (polygonButton) {
        polygonButton.disabled = false;
        polygonButton.style.opacity = "1";
        polygonButton.title = "Desenhar polígono";
      }
      return;
    }

    // Check if this geofence is already registered
    const isRegistered = feature.properties?.registered === true;
    const geofenceId = feature.properties?.geofenceId;

    console.log("Feature properties:", feature.properties);
    console.log("Is registered:", isRegistered);

    // If registered, don't allow updates but still update the current geofence
    if (isRegistered) {
      console.log(
        "Geofence is registered, preventing updates but updating display"
      );
      await updateGeofenceFromFeature(feature);
      hasActiveGeofence.value = false; // User can draw new geofence

      // Re-enable polygon drawing control
      const polygonButton = document.querySelector(
        '.maplibregl-ctrl-group button[data-mode="draw_polygon"]'
      );
      if (polygonButton) {
        polygonButton.disabled = false;
        polygonButton.style.opacity = "1";
        polygonButton.title = "Desenhar polígono";
      }
      return;
    }

    // Update the geofence using the shared function
    await updateGeofenceFromFeature(feature);
    hasActiveGeofence.value = true; // User has an active geofence

    // If user has an active geofence, prevent drawing new ones
    if (hasActiveGeofence.value && draw.value) {
      // Disable polygon drawing control
      const polygonButton = document.querySelector(
        '.maplibregl-ctrl-group button[data-mode="draw_polygon"]'
      );
      if (polygonButton) {
        polygonButton.disabled = true;
        polygonButton.style.opacity = "0.5";
        polygonButton.title =
          "Você já tem uma geofence ativa. Desenhe ou cadastre a atual primeiro.";
      }

      // Block clicks on the MapboxDraw polygon button
      disableMapboxDrawButton();
    }
  } else {
    console.log("No features found, setting currentGeofence to null");
    currentGeofence.value = null;
    hasActiveGeofence.value = false;

    // Re-enable polygon drawing control
    const polygonButton = document.querySelector(
      '.maplibregl-ctrl-group button[data-mode="draw_polygon"]'
    );
    if (polygonButton) {
      polygonButton.disabled = false;
      polygonButton.style.opacity = "1";
      polygonButton.title = "Desenhar polígono";
    }

    // Remove custom styles when no geofence
    if (map.value) {
      const mapContainer = map.value.getContainer();
      mapContainer.classList.remove("registered-geofence");
    }
  }
};

const clearGeofence = () => {
  currentGeofence.value = null;
};

const discardGeofence = () => {
  if (isCurrentGeofenceRegistered.value) {
    alert("Não é possível descartar uma geofence já cadastrada.");
    return;
  }

  if (confirm("Tem certeza que deseja descartar esta geofence?")) {
    if (draw.value) {
      // Remove all features from the draw control
      draw.value.deleteAll();
      console.log("Geofence removido do mapa.");
    }
    currentGeofence.value = null;
    hasActiveGeofence.value = false;

    // Re-enable polygon drawing control
    const polygonButton = document.querySelector(
      '.maplibregl-ctrl-group button[data-mode="draw_polygon"]'
    );
    if (polygonButton) {
      polygonButton.disabled = false;
      polygonButton.style.opacity = "1";
      polygonButton.title = "Desenhar polígono";
    }

    // Re-enable MapboxDraw polygon button
    const mapboxPolygonButton = document.querySelector(
      ".mapbox-gl-draw_ctrl-draw-btn.mapbox-gl-draw_polygon"
    );
    if (mapboxPolygonButton) {
      mapboxPolygonButton.style.pointerEvents = "auto";
      mapboxPolygonButton.style.opacity = "1";
      mapboxPolygonButton.title = "Desenhar polígono";
    }
  }
};

const goToCoordinates = () => {
  const lat = parseFloat(coordinateForm.value.lat);
  const lng = parseFloat(coordinateForm.value.lng);

  if (!isNaN(lat) && !isNaN(lng)) {
    mapCenter.value = [lng, lat]; // MapLibre uses [lng, lat] format
    zoom.value = 15;
    showCoordinateModal.value = false;
    coordinateForm.value = { lat: "", lng: "" };
  }
};

const goToAddress = async () => {
  if (!addressForm.value.address.trim()) return;

  addressForm.value.isLoading = true;
  addressForm.value.error = "";

  try {
    const response = await $fetch("/api/v1/geofence/address", {
      method: "POST",
      body: { address: addressForm.value.address },
    });

    if (response.success) {
      const { lat, lng } = response.data;
      mapCenter.value = [lng, lat]; // MapLibre uses [lng, lat] format
      zoom.value = 15;
      showAddressModal.value = false;
      addressForm.value = { address: "", isLoading: false, error: "" };

      // Show success message with the found address
      const displayName = response.data.displayName || "Endereço encontrado";
    } else {
      addressForm.value.error =
        response.message || "Não foi possível encontrar o endereço.";
    }
  } catch (error) {
    console.error("Erro ao buscar endereço:", error);
    addressForm.value.error = "Erro ao buscar endereço. Tente novamente.";
  } finally {
    addressForm.value.isLoading = false;
  }
};

const registerGeofence = async () => {
  if (!canRegister.value || isRegistering.value) return;

  isRegistering.value = true;

  try {
    // Call our API endpoint
    const response = await $fetch("/api/v1/geofence", {
      method: "POST",
      body: {
        name: registerForm.value.name,
        type: registerForm.value.type,
        geofence: currentGeofence.value,
      },
      headers: {
        "x-geofence-secret": registerForm.value.secret,
      },
    });

    console.log("Resposta do endpoint:", response);

    // Add to registered geofences
    registeredGeofences.value.add(currentGeofence.value.id);

    // Mark the current geofence as registered
    if (draw.value && currentGeofence.value) {
      const data = draw.value.getAll();
      if (data.features.length > 0) {
        const feature = data.features[0];
        // Add metadata to mark as registered
        feature.properties = feature.properties || {};
        feature.properties.registered = true;
        feature.properties.geofenceId = currentGeofence.value.id;
        feature.properties.name = registerForm.value.name;
        feature.properties.type = registerForm.value.type;

        // Update the feature to trigger style change
        draw.value.set(data);
      }
    }

    // Reset form
    registerForm.value = { name: "", type: "", secret: "", confirmation: "" };
    showRegisterModal.value = false;

    // Show success modal
    showSuccessModal.value = true;
  } catch (error) {
    console.error("Erro ao cadastrar geofence:", error);

    // Handle different error types
    let errorMessage = "Erro ao cadastrar geofence. Tente novamente.";

    if (error.statusCode === 400) {
      errorMessage = "Dados inválidos. Verifique o tipo e a geofence.";
    } else if (error.statusCode === 401) {
      errorMessage = "Secret inválido. Verifique suas credenciais.";
    } else if (error.statusCode === 500) {
      errorMessage = "Erro interno do servidor. Tente novamente mais tarde.";
    }

    alert(errorMessage);
  } finally {
    isRegistering.value = false;
  }
};

// Function to handle selection changes
const handleSelectionChange = (e) => {
  if (!draw.value) return;

  // Get all features and find the active one
  const data = draw.value.getAll();
  const activeFeature = data.features.find(
    (f) => f.properties && f.properties.active === true
  );

  if (activeFeature && activeFeature.geometry.type === "Polygon") {
    updateGeofenceFromFeature(activeFeature);
    console.log("Geofence selected via selection change:", activeFeature.id);
  } else {
    // If no active feature, try to get the first polygon
    const polygonFeatures = data.features.filter(
      (f) => f.geometry.type === "Polygon"
    );
    if (polygonFeatures.length > 0) {
      updateGeofenceFromFeature(polygonFeatures[0]);
      console.log(
        "No active feature, using first polygon:",
        polygonFeatures[0].id
      );
    } else {
      currentGeofence.value = null;
    }
  }
};

// Function to handle map clicks and select geofences
const handleMapClick = (e) => {
  // This function is now simplified - selection is handled by draw.selectionchange
  // We only use this for deselection when clicking outside
  if (!draw.value) return;

  const allFeatures = draw.value.getAll();
  const polygonFeatures = allFeatures.features.filter(
    (f) => f.geometry.type === "Polygon"
  );

  if (polygonFeatures.length === 0) return;

  // Check if we clicked outside all polygons
  let clickedInside = false;

  for (const feature of polygonFeatures) {
    try {
      let turf;
      if (typeof window !== "undefined" && window.turf) {
        turf = window.turf;

        const clickPoint = {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [e.lngLat.lng, e.lngLat.lat],
          },
          properties: {},
        };

        if (turf.booleanPointInPolygon(clickPoint, feature)) {
          clickedInside = true;
          break;
        }
      }
    } catch (error) {
      console.error("Error checking point in polygon:", error);
    }
  }

  if (!clickedInside) {
    // If clicked outside, deselect all
    draw.value.changeMode("simple_select");
    console.log("Clicked outside geofences, deselecting all");
  }
};

// Function to update geofence from a specific feature
const updateGeofenceFromFeature = async (feature) => {
  console.log("updateGeofenceFromFeature called with:", feature);

  try {
    // Use Turf.js from CDN if available, otherwise import dynamically
    let turf;
    if (typeof window !== "undefined" && window.turf) {
      turf = window.turf;
    } else {
      const turfModule = await import("@turf/turf").catch(() => null);
      if (!turfModule) {
        console.error("Turf.js not available");
        return;
      }
      turf = turfModule.default;
    }

    // Calculate area in square meters
    const area = turf.area(feature);

    // Calculate center
    const center = turf.center(feature);

    // Create geofence object
    const geofence = {
      id: feature.properties?.geofenceId || feature.id,
      name: feature.properties?.name,
      type: feature.properties?.type,
      coordinates: feature.geometry.coordinates[0].map((coord) => [
        coord[1],
        coord[0],
      ]), // Convert to [lat, lng]
      center: {
        lat: center.geometry.coordinates[1],
        lng: center.geometry.coordinates[0],
      },
      area: area,
    };

    console.log("Created geofence object:", geofence);
    currentGeofence.value = geofence;
    console.log("currentGeofence.value set to:", currentGeofence.value);

    // Apply custom styles for registered geofences
    applyRegisteredGeofenceStyles();
  } catch (error) {
    console.error("Error updating geofence from feature:", error);
  }
};

// Function to select next geofence
const selectNextGeofence = () => {
  if (!draw.value) return;

  const geofences = getAllGeofences.value;
  if (geofences.length <= 1) return;

  const currentIndex = geofences.findIndex((g) => g.isActive);
  const nextIndex = (currentIndex + 1) % geofences.length;
  const nextGeofence = geofences[nextIndex];

  // Set the next geofence as active by updating its properties
  const data = draw.value.getAll();
  const feature = data.features.find((f) => f.id === nextGeofence.id);
  if (feature) {
    // Clear active state from all features
    data.features.forEach((f) => {
      if (f.properties) {
        f.properties.active = false;
      }
    });

    // Set the selected feature as active
    if (feature.properties) {
      feature.properties.active = true;
    }

    // Update the draw control
    draw.value.set(data);

    // Update the current geofence
    updateGeofenceFromFeature(feature);
  }
};

// Function to select previous geofence
const selectPreviousGeofence = () => {
  if (!draw.value) return;

  const geofences = getAllGeofences.value;
  if (geofences.length <= 1) return;

  const currentIndex = geofences.findIndex((g) => g.isActive);
  const prevIndex =
    currentIndex === 0 ? geofences.length - 1 : currentIndex - 1;
  const prevGeofence = geofences[prevIndex];

  // Set the previous geofence as active by updating its properties
  const data = draw.value.getAll();
  const feature = data.features.find((f) => f.id === prevGeofence.id);
  if (feature) {
    // Clear active state from all features
    data.features.forEach((f) => {
      if (f.properties) {
        f.properties.active = false;
      }
    });

    // Set the selected feature as active
    if (feature.properties) {
      feature.properties.active = true;
    }

    // Update the draw control
    draw.value.set(data);

    // Update the current geofence
    updateGeofenceFromFeature(feature);
  }
};

// Function to disable MapboxDraw polygon button
const disableMapboxDrawButton = () => {
  const mapboxPolygonButton = document.querySelector(
    ".mapbox-gl-draw_ctrl-draw-btn.mapbox-gl-draw_polygon"
  );
  if (mapboxPolygonButton) {
    mapboxPolygonButton.style.pointerEvents = "none";
    mapboxPolygonButton.style.opacity = "0.5";
    mapboxPolygonButton.title =
      "Você já tem uma geofence ativa. Desenhe ou cadastre a atual primeiro.";
  }
};

// Function to enable MapboxDraw polygon button
const enableMapboxDrawButton = () => {
  const mapboxPolygonButton = document.querySelector(
    ".mapbox-gl-draw_ctrl-draw-btn.mapbox-gl-draw_polygon"
  );
  if (mapboxPolygonButton) {
    mapboxPolygonButton.style.pointerEvents = "auto";
    mapboxPolygonButton.style.opacity = "1";
    mapboxPolygonButton.title = "Desenhar polígono";
  }
};

// Function to hide the trash button
const hideTrashButton = () => {
  const trashButton = document.querySelector(
    ".mapbox-gl-draw_ctrl-draw-btn.mapbox-gl-draw_trash"
  );
  if (trashButton) {
    trashButton.style.display = "none";
  }
};

// Function to create new geofence (reset everything)
const createNewGeofence = () => {
  // Close success modal
  showSuccessModal.value = false;

  // Clear all geofences from map
  if (draw.value) {
    draw.value.deleteAll();
  }

  // Reset all state
  currentGeofence.value = null;
  hasActiveGeofence.value = false;
  registeredGeofences.value.clear();

  // Re-enable drawing controls
  enableMapboxDrawButton();

  // Remove custom styles
  if (map.value) {
    const mapContainer = map.value.getContainer();
    mapContainer.classList.remove("registered-geofence");
  }

  console.log("Map reset for new geofence");
};

// Function to close application
const goToBackoffice = async () => {
  // Close the browser tab/window
  await navigateTo("https://backoffice.vammo.com", { external: true });
};

// Function to make geofence completely immutable (simplified)
const makeGeofenceImmutable = () => {
  // This function is now simplified to avoid performance issues
  // The geofence will be handled by the success modal instead
  console.log("Geofence marked as registered");
};

// Function to apply custom styles to registered geofences (simplified)
const applyRegisteredGeofenceStyles = () => {
  // This function is now simplified to avoid performance issues
  // The geofence will be handled by the success modal instead
  console.log("Styles applied to registered geofence");
};

// Utility functions
const generateId = () => {
  return (
    "geofence_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9)
  );
};

const formatArea = (area) => {
  return (area / 1000000).toFixed(2) + " km²";
};

const formatCoordinates = (coords) => {
  return `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`;
};
</script>

<style scoped>
/* Fade-slide transition */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.3s ease;
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translate(-50%, -20px);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translate(-50%, -20px);
}

.fade-slide-enter-to,
.fade-slide-leave-from {
  opacity: 1;
  transform: translate(-50%, 0);
}

/* Registered geofence styles */
.registered-geofence {
  pointer-events: none;
}

.registered-geofence .maplibregl-canvas {
  cursor: default !important;
}
</style>
