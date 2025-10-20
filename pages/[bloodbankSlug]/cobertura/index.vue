<template>
  <div
    class="h-screen w-full relative overflow-hidden"
    style="height: 100vh; height: 100dvh"
  >
    <!-- Map Container - Full Screen -->
    <div class="absolute inset-0">
      <ClientOnly>
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
          >
            <div class="bloodbank-marker">
              <div class="marker-icon">
                <svg
                  class="w-6 h-6 text-red-600"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"
                  />
                </svg>
              </div>
              <div class="marker-label">
                {{ bloodbankData.name }}
              </div>
            </div>
          </MglMarker>
        </MglMap>
      </ClientOnly>

      <!-- Top Controls Overlay -->
      <div class="absolute top-4 left-4 z-[1000] flex items-center space-x-3">
        <!-- Map Style Selector -->
        <div class="relative">
          <select
            v-model="selectedMapStyle"
            @change="changeMapStyle"
            class="bg-white border border-grey-300 text-grey-700 py-2 px-3 pr-8 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 font-medium text-sm shadow-lg hover:shadow-xl appearance-none cursor-pointer"
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

        <!-- Save Coverage Area button -->
        <button
          @click="saveCoverageArea"
          :disabled="!canSave || isSaving"
          class="bg-green-500 hover:bg-green-700 disabled:bg-grey-300 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-all duration-200 font-semibold shadow-lg hover:shadow-xl"
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
          <div class="flex items-center space-x-2">
            <!-- Edit button - More visible -->
            <button
              @click="toggleEditMode"
              class="bg-blue-500 hover:bg-blue-700 text-white px-3 py-2 rounded-lg flex items-center space-x-2 transition-all duration-200 font-semibold shadow-lg hover:shadow-xl"
              title="Editar área"
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
                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                />
              </svg>
              <span class="text-sm font-medium">Editar</span>
            </button>
          </div>
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
        class="absolute top-20 left-1/2 transform -translate-x-1/2 z-[1000] bg-yellow-500 text-white px-4 py-2 rounded-lg shadow-lg font-medium text-sm flex items-center space-x-2"
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
import { ref, computed, onMounted, onUnmounted, nextTick } from "vue";

// Define page meta to disable layout padding
definePageMeta({
  layout: "default",
  noPadding: true,
});

// Get route params
const route = useRoute();
const bloodbankSlug = route.params.bloodbankSlug as string;

// Types
interface BloodbankData {
  id: string;
  name: string;
  slug: string;
  location?: {
    type: "Point";
    coordinates: number[]; // [lng, lat]
  } | null;
  coverageArea?: {
    type: "Polygon";
    coordinates: any;
  } | null;
  hasLocation: boolean;
  hasCoverageArea: boolean;
}

interface CoverageArea {
  id: string;
  coordinates: [number, number][]; // [lat, lng]
  center: {
    lat: number;
    lng: number;
  };
  area: number;
}

// Reactive state
const mapRef = ref<any>(null);
const map = ref<any>(null);
const draw = ref<any>(null);
const zoom = ref(13);
const mapCenter = ref([-46.6333, -23.5505] as [number, number]); // MapLibre uses [lng, lat] format
const currentCoverageArea = ref<CoverageArea | null>(null);
const bloodbankData = ref<BloodbankData | null>(null);
const isLoading = ref(true);
const isSaving = ref(false);
const showSuccessModal = ref(false);
const isDrawing = ref(false);
const isEditMode = ref(false);

// MapLibre configuration
const selectedMapStyle = ref("voyager"); // Default to voyager style

const mapStyles: Record<string, any> = {
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

// Computed properties
const hasCoverageArea = computed(() => {
  return bloodbankData.value?.hasCoverageArea || false;
});

const canSave = computed(() => {
  return currentCoverageArea.value && !isSaving.value && !isDrawing.value;
});

// Methods
const changeMapStyle = () => {
  if (map.value) {
    map.value.setStyle(mapStyles[selectedMapStyle.value] as string);
  }
};

const loadBloodbankData = async () => {
  try {
    isLoading.value = true;
    // Get user data to extract bloodBanksLocationId
    const userResponse = await fetchWithAuth("/api/v1/me");

    const bloodBanksLocationId =
      userResponse.data.bloodBankRoles[0]?.bloodBanksLocationId;
    if (!bloodBanksLocationId) {
      throw new Error("No blood bank access found");
    }

    const response = await fetchWithAuth(
      `/api/v1/bloodbank/${bloodBanksLocationId}/coverage`
    );

    if (response.success) {
      bloodbankData.value = response.data;

      // Set map center to bloodbank location if available
      if (response.data.location) {
        mapCenter.value = [
          response.data.location.coordinates[0], // lng
          response.data.location.coordinates[1], // lat
        ];
        zoom.value = 16; // Closer zoom to better show the blood bank location
      }

      // Load existing coverage area if available
      if (response.data.coverageArea) {
        await loadExistingCoverageArea(response.data.coverageArea);
      }
    }
  } catch (error) {
    console.error("Error loading bloodbank data:", error);
    // Handle error - maybe show a message to user
  } finally {
    isLoading.value = false;
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
      currentCoverageArea.value = null;
      return;
    }

    // Update the coverage area using the shared function
    await updateCoverageAreaFromFeature(feature);
  } else {
    console.log("No features found, setting currentCoverageArea to null");
    currentCoverageArea.value = null;
  }
};

const clearCoverageAreaFromMap = () => {
  currentCoverageArea.value = null;
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
    currentCoverageArea.value = coverageArea;
    console.log("currentCoverageArea.value set to:", currentCoverageArea.value);
  } catch (error) {
    console.error("Error updating coverage area from feature:", error);
  }
};

const saveCoverageArea = async () => {
  if (!canSave.value || isSaving.value) return;

  isSaving.value = true;

  try {
    // Get user data to extract bloodBanksLocationId
    const userResponse = await fetchWithAuth("/api/v1/me");

    const bloodBanksLocationId =
      userResponse.bloodBankRoles[0]?.bloodBanksLocationId;
    if (!bloodBanksLocationId) {
      throw new Error("No blood bank access found");
    }

    // Call our API endpoint
    const response = await fetchWithAuth(
      `/api/v1/bloodbank/${bloodBanksLocationId}/coverage`,
      {
        method: "PUT",
        body: {
          coverageArea: {
            type: "Polygon",
            coordinates: [
              currentCoverageArea.value?.coordinates.map((coord: any) => [
                coord[1],
                coord[0],
              ]),
            ], // Convert back to [lng, lat]
          },
        },
      }
    );

    console.log("Resposta do endpoint:", response);

    if (response.success) {
      // Update bloodbank data
      bloodbankData.value = response.data;

      // Show success modal
      showSuccessModal.value = true;
    }
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
  } finally {
    isSaving.value = false;
  }
};

const clearCoverageArea = () => {
  if (confirm("Tem certeza que deseja limpar a área de cobertura?")) {
    if (draw.value) {
      // Remove all features from the draw control
      draw.value.deleteAll();
      console.log("Área de cobertura removida do mapa.");
    }
    currentCoverageArea.value = null;
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
