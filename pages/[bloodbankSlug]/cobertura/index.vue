<template>
  <div class="h-full w-full relative overflow-hidden">
    <!-- Map Container - Full Screen -->
    <div class="absolute inset-0">
      <MglMap
        :map-style="mapStyle"
        :center="mapCenter"
        :zoom="zoom"
        ref="mapRef"
      >
        <MglNavigationControl />
        <!-- Bloodbank Location Marker -->
        <MglMarker
          v-if="bloodbankData?.location"
          :coordinates="[
            bloodbankData.location.coordinates[0],
            bloodbankData.location.coordinates[1],
          ]"
          :color="'#bb0a08'"
        >
          <!-- MglPopup for bloodbank info -->
          <MglPopup
            ref="bloodbankPopup"
            :close-button="false"
            :class-name="bloodbankPopupFadeClass"
            :offset="[0, -40]"
          >
            <div class="flex items-center space-x-3">
              <div class="flex-shrink-0">
                <NuxtImg
                  v-if="bloodbankData.logo"
                  :src="bloodbankData.logo"
                  :alt="`Logo do ${bloodbankData.name}`"
                  class="w-8 h-8 rounded-full object-cover"
                />
                <div
                  v-else
                  class="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center"
                >
                  <svg
                    class="w-5 h-5 text-red-600"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"
                    />
                  </svg>
                </div>
              </div>
              <h3 class="text-lg font-semibold text-grey-800">
                {{ bloodbankData.name }}
              </h3>
            </div>
          </MglPopup>
        </MglMarker>
      </MglMap>

      <!-- Top Controls Overlay -->
      <div class="absolute top-4 left-4 z-[1000] flex items-center space-x-3">
        <!-- Save Coverage Area button -->
        <button
          @click="saveCoverageArea"
          :disabled="!canSave || isSaving"
          class="bg-green-500 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-all duration-200 font-semibold shadow-lg hover:shadow-xl disabled:shadow-none"
        >
          <div
            v-if="isSaving"
            class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"
          ></div>
          <svg
            v-else
            class="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
            />
          </svg>
          <span class="font-medium">{{
            isSaving ? "Salvando..." : "Salvar Área"
          }}</span>
        </button>

        <!-- Clear Coverage Area button -->
        <button
          v-if="hasCoverageArea"
          @click="clearCoverageArea"
          class="bg-red-500 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-all duration-200 font-semibold shadow-lg hover:shadow-xl"
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
          <span class="font-medium">Limpar Área</span>
        </button>
      </div>

      <!-- Coverage Area Info -->
      <div
        v-if="currentCoverageArea"
        class="absolute bottom-4 left-4 z-[1000] bg-white rounded-xl shadow-xl p-4 max-w-sm border border-grey-100"
      >
        <div class="flex items-center justify-between mb-3">
          <h3 class="font-bold text-grey-800 text-lg tracking-tight">
            Área de Cobertura
          </h3>
        </div>
        <div class="space-y-1 text-sm text-grey-600">
          <p class="flex items-center justify-between">
            <span class="font-semibold text-grey-700">Área:</span>
            <span class="font-medium">{{
              formatArea(currentCoverageArea.area)
            }}</span>
          </p>
          <p class="flex items-center justify-between">
            <span class="font-semibold text-grey-700">Centro:</span>
            <span class="font-mono text-xs bg-grey-100 px-2 py-1 rounded">{{
              formatCoordinates(currentCoverageArea.center)
            }}</span>
          </p>
          <p class="flex items-center justify-between">
            <span class="font-semibold text-grey-700">Pontos:</span>
            <span class="font-medium text-blue-600"
              >{{ currentCoverageArea.coordinates.length - 1 }} vértices</span
            >
          </p>
        </div>
      </div>

      <!-- No Coverage Area Message -->
      <div
        v-if="!hasCoverageArea && !isLoading"
        class="absolute bottom-2 w-[calc(100%-1rem)] sm:max-w-sm sm:left-1/2 sm:-translate-x-1/2 z-[1000] bg-yellow-500 text-white px-2 py-2 rounded-lg shadow-lg font-medium text-sm flex items-center space-x-2 mx-2"
      >
        <UIcon name="i-lucide-alert-triangle" class="w-4 h-4" />
        <span
          >Nenhuma área de cobertura definida. Desenhe uma área no mapa.</span
        >
      </div>

      <!-- Drawing Instructions -->
      <transition name="fade-slide" mode="out-in" appear>
        <div
          v-if="isDrawing"
          class="absolute top-20 left-1/2 transform -translate-x-1/2 z-[1000] bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg font-medium text-sm flex items-center space-x-2"
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

      <!-- Loading State -->
      <div
        v-if="isLoading"
        class="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-[1000]"
      >
        <div class="text-center">
          <div
            class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"
          ></div>
          <p class="text-grey-600 font-medium">Carregando dados...</p>
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
            Área Salva!
          </h3>
          <p class="text-grey-600 mb-6">
            A área de cobertura foi salva com sucesso.
          </p>
        </div>
        <div class="flex justify-end">
          <button
            @click="showSuccessModal = false"
            class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 font-semibold shadow-sm hover:shadow-md"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from "vue";
import { useUserStore } from "~/stores/user";
import { useBloodbankStore } from "~/stores/bloodbank";

// Define page meta to disable layout padding
definePageMeta({
  layout: "default",
  noPadding: true,
});

// Get route params
const route = useRoute();
const bloodbankSlug = route.params.bloodbankSlug as string;

// Initialize stores
const userStore = useUserStore();
const bloodbankStore = useBloodbankStore();

// Reactive state
const mapRef = ref<any>(null);
const map = ref<any>(null);
const draw = ref<any>(null);
const bloodbankPopup = ref<any>(null);
const zoom = ref(13);
const mapCenter = ref([-46.6333, -23.5505] as [number, number]); // MapLibre uses [lng, lat] format
const showSuccessModal = ref(false);
const isDrawing = ref(false);
const isEditMode = ref(false);

// MapLibre configuration
const mapStyle = "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";

// Computed properties
const hasCoverageArea = computed(() => bloodbankStore.hasCoverageArea);
const canSave = computed(() => bloodbankStore.canSave && !isDrawing.value);
const bloodbankData = computed(() => bloodbankStore.bloodbankData);
const currentCoverageArea = computed(() => bloodbankStore.currentCoverageArea);
const isLoading = computed(() => bloodbankStore.isLoading);
const isSaving = computed(() => bloodbankStore.isSaving);

// Methods
const bloodbankPopupFadeClass = "fade-slide-enter-active fade-slide-enter-from";
const loadBloodbankData = async () => {
  try {
    // Get user data from store to extract bloodBanksLocationId
    const user = userStore.user;
    if (!user) {
      console.log("User not found in store, waiting...");
      // Wait a bit and try again
      setTimeout(() => {
        if (userStore.user) {
          loadBloodbankData();
        }
      }, 1000);
      return;
    }

    const bloodBanksLocationId = user.bloodBankRoles[0]?.bloodBanksLocationId;

    if (!bloodBanksLocationId) {
      throw new Error("No blood bank access found");
    }

    const data = await bloodbankStore.loadBloodbankData(bloodBanksLocationId);

    // Set map center to bloodbank location if available
    if (data.location) {
      mapCenter.value = [
        data.location.coordinates[0], // lng
        data.location.coordinates[1], // lat
      ];
      zoom.value = 13; // Moderate zoom to show the blood bank location and surrounding area

      // Center the map to the bloodbank location if map is already loaded
      if (map.value) {
        map.value.setCenter([
          data.location.coordinates[0], // lng
          data.location.coordinates[1], // lat
        ]);
        map.value.setZoom(13);
      }
    }

    // Load existing coverage area if available
    if (data.coverageArea) {
      await loadExistingCoverageArea(data.coverageArea);
    }
  } catch (error) {
    console.error("Error loading bloodbank data:", error);
    // Handle error - maybe show a message to user
  }
};

const loadExistingCoverageArea = async (coverageArea: any) => {
  if (!draw.value || !coverageArea) return;

  try {
    // Convert coverage area to GeoJSON format for MapboxDraw
    const geojson = {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: coverageArea.coordinates,
      },
      properties: {
        id: "existing-coverage-area",
      },
    };

    // Add to draw control
    draw.value.add(geojson);

    // Update current coverage area
    await updateCoverageAreaFromFeature(geojson);
  } catch (error) {
    console.error("Error loading existing coverage area:", error);
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
      if (typeof window !== "undefined" && (window as any).MapboxDraw) {
        console.log("MapboxDraw found globally:", (window as any).MapboxDraw);

        // Configure MapboxDraw for MapLibre
        (window as any).MapboxDraw.constants.classes.CANVAS =
          "maplibregl-canvas";
        (window as any).MapboxDraw.constants.classes.CONTROL_BASE =
          "maplibregl-ctrl";
        (window as any).MapboxDraw.constants.classes.CONTROL_PREFIX =
          "maplibregl-ctrl-";
        (window as any).MapboxDraw.constants.classes.CONTROL_GROUP =
          "maplibregl-ctrl-group";
        (window as any).MapboxDraw.constants.classes.ATTRIBUTION =
          "maplibregl-ctrl-attrib";

        console.log("Creating draw control...");
        // Initialize draw control
        draw.value = new (window as any).MapboxDraw({
          displayControlsDefault: true,
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
                "fill-color": "#10b981",
                "fill-outline-color": "#10b981",
                "fill-opacity": 0.2,
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
                "line-color": "#10b981",
                "line-dasharray": [0.2, 2],
                "line-width": 2,
              },
            },
            // Polygon outline - Inactive
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
                "line-color": "#10b981",
                "line-width": 2,
              },
            },
            // Vertex points
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
                "circle-color": "#10b981",
              },
            },
            // Midpoints
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
                "circle-color": "#10b981",
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
        map.value.on("draw.create", updateCoverageArea);
        map.value.on("draw.delete", clearCoverageAreaFromMap);
        map.value.on("draw.update", updateCoverageArea);

        // Add drawing mode detection
        map.value.on("draw.modechange", (e: any) => {
          console.log("Draw mode changed:", e.mode);
          isDrawing.value = e.mode === "draw_polygon";
        });

        console.log("Event listeners added");

        // Center map to bloodbank location if available
        if (bloodbankData.value?.location) {
          map.value.setCenter([
            bloodbankData.value.location.coordinates[0], // lng
            bloodbankData.value.location.coordinates[1], // lat
          ]);
          map.value.setZoom(12);
        }
      } else {
        // Fallback: try dynamic import
        console.log("MapboxDraw not found globally, trying dynamic import...");
        const MapboxDraw = (await import("@mapbox/mapbox-gl-draw").catch(
          () => null
        )) as any;
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
          displayControlsDefault: true,
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
                "fill-color": "#10b981",
                "fill-outline-color": "#10b981",
                "fill-opacity": 0.2,
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
                "line-color": "#10b981",
                "line-dasharray": [0.2, 2],
                "line-width": 2,
              },
            },
            // Polygon outline - Inactive
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
                "line-color": "#10b981",
                "line-width": 2,
              },
            },
            // Vertex points
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
                "circle-color": "#10b981",
              },
            },
            // Midpoints
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
                "circle-color": "#10b981",
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
        map.value.on("draw.create", updateCoverageArea);
        map.value.on("draw.delete", clearCoverageAreaFromMap);
        map.value.on("draw.update", updateCoverageArea);

        // Add drawing mode detection
        map.value.on("draw.modechange", (e: any) => {
          console.log("Draw mode changed:", e.mode);
          isDrawing.value = e.mode === "draw_polygon";
        });

        console.log("Event listeners added");

        // Center map to bloodbank location if available
        if (bloodbankData.value?.location) {
          map.value.setCenter([
            bloodbankData.value.location.coordinates[0], // lng
            bloodbankData.value.location.coordinates[1], // lat
          ]);
          map.value.setZoom(10);
        }
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

const updateCoverageArea = async () => {
  if (!draw.value) return;

  console.log("updateCoverageArea called");
  const data = draw.value.getAll();
  console.log("All features:", data.features);

  if (data.features.length > 0) {
    const feature = data.features[0]; // Get the first (and should be only) polygon
    console.log("Selected feature:", feature);

    if (!feature) {
      console.log("No feature found, setting currentCoverageArea to null");
      bloodbankStore.setCurrentCoverageArea(null);
      return;
    }

    // Update the coverage area using the shared function
    await updateCoverageAreaFromFeature(feature);
  } else {
    console.log("No features found, setting currentCoverageArea to null");
    bloodbankStore.setCurrentCoverageArea(null);
  }
};

const clearCoverageAreaFromMap = () => {
  bloodbankStore.setCurrentCoverageArea(null);
};

const updateCoverageAreaFromFeature = async (feature: any) => {
  console.log("updateCoverageAreaFromFeature called with:", feature);

  try {
    // Use Turf.js from CDN if available, otherwise import dynamically
    let turf: any;
    if (typeof window !== "undefined" && (window as any).turf) {
      turf = (window as any).turf;
    } else {
      const turfModule = await import("@turf/turf").catch(() => null);
      if (!turfModule) {
        console.error("Turf.js not available");
        return;
      }
      turf = turfModule;
    }

    // Calculate area in square meters
    const area = turf.area(feature);

    // Calculate center
    const center = turf.center(feature);

    // Create coverage area object
    const coverageArea: CoverageArea = {
      id: feature.properties?.id || feature.id,
      coordinates: feature.geometry.coordinates[0].map((coord: any) => [
        coord[1],
        coord[0],
      ]), // Convert to [lat, lng]
      center: {
        lat: center.geometry.coordinates[1],
        lng: center.geometry.coordinates[0],
      },
      area: area,
    };

    console.log("Created coverage area object:", coverageArea);
    bloodbankStore.setCurrentCoverageArea(coverageArea);
    console.log("currentCoverageArea set to:", coverageArea);
  } catch (error) {
    console.error("Error updating coverage area from feature:", error);
  }
};

const saveCoverageArea = async () => {
  if (!canSave.value) return;

  try {
    // Get user data from store to extract bloodBanksLocationId
    const user = userStore.user;
    if (!user) {
      throw new Error("User not found in store");
    }

    const bloodBanksLocationId = user.bloodBankRoles[0]?.bloodBanksLocationId;
    if (!bloodBanksLocationId) {
      throw new Error("No blood bank access found");
    }

    if (!currentCoverageArea.value) {
      throw new Error("No coverage area to save");
    }

    // Call store method to save coverage area
    await bloodbankStore.saveCoverageArea(
      bloodBanksLocationId,
      currentCoverageArea.value
    );

    // Show success modal
    showSuccessModal.value = true;
  } catch (error: any) {
    console.error("Erro ao salvar área de cobertura:", error);

    // Handle different error types
    let errorMessage = "Erro ao salvar área de cobertura. Tente novamente.";

    if (error.statusCode === 400) {
      errorMessage = "Dados inválidos. Verifique a área de cobertura.";
    } else if (error.statusCode === 404) {
      errorMessage = "Hemocentro não encontrado.";
    } else if (error.statusCode === 500) {
      errorMessage = "Erro interno do servidor. Tente novamente mais tarde.";
    }

    alert(errorMessage);
  }
};

const clearCoverageArea = () => {
  if (confirm("Tem certeza que deseja limpar a área de cobertura?")) {
    if (draw.value) {
      // Remove all features from the draw control
      draw.value.deleteAll();
      console.log("Área de cobertura removida do mapa.");
    }
    bloodbankStore.clearCurrentCoverageArea();
  }
};

const toggleEditMode = () => {
  isEditMode.value = !isEditMode.value;

  if (isEditMode.value) {
    // Enable drawing mode
    draw.value.changeMode("draw_polygon");
  } else {
    // Exit drawing mode
    draw.value.changeMode("simple_select");
  }
};

const shouldShowBloodbankPopup = ref(false);
const showBloodbankInfo = () => {
  if (bloodbankPopup.value) {
    bloodbankPopup.value.addTo(map.value);
  }
};

watch(bloodbankPopup, (newVal, oldVal) => {
  if (newVal !== oldVal) {
    setTimeout(() => {
      if (bloodbankPopup.value) {
        shouldShowBloodbankPopup.value = false;
      }
    }, 300);
  }
});

// Utility functions
const formatArea = (area: number) => {
  return (area / 1000000).toFixed(2) + " km²";
};

const formatCoordinates = (coords: { lat: number; lng: number }) => {
  return `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`;
};

// Lifecycle
onMounted(async () => {
  // Prevent body scroll on mobile
  document.body.style.overflow = "hidden";
  document.body.style.height = "100vh";
  document.body.style.height = "100dvh";

  await loadBloodbankData();
  await initializeMap();
});

onUnmounted(() => {
  // Restore body scroll when leaving the page
  document.body.style.overflow = "";
  document.body.style.height = "";
});
</script>

<style scoped>
/* Prevent scrolling and ensure full height on mobile */
:deep(html),
:deep(body) {
  overflow: hidden !important;
  height: 100vh !important;
  height: 100dvh !important;
}

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

/* Bloodbank marker styles */
.bloodbank-marker {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.bloodbank-marker:hover {
  transform: scale(1.1);
}

.marker-icon {
  background: white;
  border: 2px solid #dc2626;
  border-radius: 50%;
  padding: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
}

.marker-label {
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  margin-top: 4px;
  white-space: nowrap;
  max-width: 150px;
  text-align: center;
}
</style>
