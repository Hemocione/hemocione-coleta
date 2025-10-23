<template>
  <div
    :class="[
      'h-full w-full relative overflow-hidden',
      isMobile ? '' : 'border-2 border-gray-200 rounded-lg',
    ]"
  >
    <!-- Map Container - Full Screen -->
    <div class="absolute inset-0">
      <MglMap
        :map-style="mapStyle"
        :center="mapCenter"
        :zoom="zoom"
        ref="mapRef"
        @map:load="initializeMap"
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
          <template v-if="bloodbankData.logo" v-slot:marker>
            <div class="flex flex-col items-center">
              <NuxtImg
                :src="bloodbankData.logo"
                :alt="`Logo do ${bloodbankData.name}`"
                class="w-8 h-8 rounded-full object-cover border-2"
                style="border-color: #bb0a08"
              />
              <svg
                class="mt-[-2px]"
                width="10"
                height="6"
                viewBox="0 0 10 6"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <polygon points="5,6 0,0 10,0" fill="#bb0a08" />
              </svg>
            </div>
          </template>
          <MglPopup
            v-if="!bloodbankData.logo"
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
        <!-- Control Buttons Container with v-auto-animate -->
        <div v-auto-animate class="flex items-center space-x-3">
          <!-- Save Coverage Area button -->
          <button
            key="save-button"
            @click="saveCoverageArea"
            :disabled="!canSave || isSaving"
            class="bg-green-500 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-all duration-200 font-semibold shadow-lg hover:shadow-xl disabled:shadow-none cursor-pointer h-10 min-h-[2.5rem] min-w-[150px] whitespace-nowrap"
          >
            <div
              v-if="isSaving"
              class="animate-spin rounded-full h-4 w-4 border-b-2 border-white flex-shrink-0"
            ></div>
            <UIcon v-else name="i-lucide-save" class="w-5 h-5 flex-shrink-0" />
            <span class="font-medium flex-shrink-0">{{
              isSaving ? "Salvando..." : "Salvar Área"
            }}</span>
          </button>

          <!-- Polygon Drawing Button (only show when no pending changes) -->
          <button
            v-if="!hasChanges"
            key="edit-button"
            @click="activatePolygonTool"
            :class="[
              'drawing-control-btn h-10 min-h-[2.5rem]',
              isDrawing
                ? 'drawing-control-btn-active'
                : 'drawing-control-btn-inactive',
            ]"
            title="Desenhar área de cobertura"
          >
            <UIcon name="i-lucide-pen-line" class="w-6 h-6" />
          </button>

          <!-- Delete Button (only show during drawing mode or when has changes) -->
          <button
            v-if="isDrawing || hasChanges"
            key="delete-button"
            @click="activateDeleteTool"
            class="drawing-control-btn drawing-control-btn-danger h-10 min-h-[2.5rem]"
            title="Limpar área de cobertura"
          >
            <UIcon name="i-lucide-trash" class="w-6 h-6" />
          </button>
        </div>
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
      <transition name="fade" mode="out-in" appear>
        <div
          v-if="!hasCoverageArea && !isLoading && !isDrawing"
          class="absolute bottom-2 w-[calc(100%-1rem)] sm:max-w-sm sm:left-1/2 sm:-translate-x-1/2 z-[1000] bg-yellow-500 text-white px-2 py-2 rounded-lg shadow-lg font-medium text-sm flex items-center space-x-2 mx-2"
        >
          <UIcon name="i-lucide-alert-triangle" class="w-4 h-4" />
          <span
            >Nenhuma área de cobertura definida. Desenhe uma área no mapa.</span
          >
        </div>

        <!-- Drawing Instructions -->
        <div
          v-else-if="isDrawing"
          class="absolute bottom-2 w-[calc(100%-1rem)] sm:max-w-sm sm:left-1/2 sm:-translate-x-1/2 z-[1000] bg-blue-500 text-white px-2 py-2 rounded-lg shadow-lg font-medium text-sm flex items-center space-x-2 mx-2"
        >
          <UIcon name="i-lucide-pencil" class="w-4 h-4 animate-pulse" />
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from "vue";
import { useUserStore } from "~/stores/user";
import { useBloodbankStore } from "~/stores/bloodbank";
import MapboxDraw from "@mapbox/mapbox-gl-draw";

const isMobile = computed(() => {
  return window.innerWidth < 640;
});

// Define page meta to disable layout padding
definePageMeta({
  layout: "default",
  noPadding: isMobile.value,
  keepalive: false,
});

// Initialize stores
const userStore = useUserStore();
const bloodbankStore = useBloodbankStore();
const { bloodbankData } = storeToRefs(bloodbankStore);
const INITIAL_ZOOM = 10;

// Reactive state
type MapRef = ReturnType<typeof useMglMap>;
const mapRef = ref<MapRef | null>(null);
const draw = ref<any>(null);
const bloodbankPopup = ref<any>(null);
const zoom = ref<number>(INITIAL_ZOOM);
const mapCenter = ref<[number, number]>([-43.1915792, -22.9077772]); // MapLibre uses [lng, lat] format. Default at Rio de Janeiro, Brazil
const isDrawing = ref<boolean>(false);
const persistedCoverageAreaId = "existing-coverage-area";
// Initialize persistedArea from bloodbank store data
const persistedArea = computed(() => {
  if (!bloodbankData.value?.coverageArea) {
    return null;
  }

  return {
    id: persistedCoverageAreaId,
    coordinates: bloodbankData.value.coverageArea.coordinates[0], // Already in [lng, lat] format
    center: {
      lat: bloodbankData.value.coverageArea.coordinates[0][0][1], // First coordinate's lat
      lng: bloodbankData.value.coverageArea.coordinates[0][0][0], // First coordinate's lng
    },
    area: 0, // We'll calculate this if needed
  };
});

// MapLibre configuration
const mapStyle = "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";

// Computed properties
const hasCoverageArea = computed(() => bloodbankStore.hasCoverageArea);
const currentCoverageArea = computed(() => bloodbankStore.currentCoverageArea);
const isLoading = computed(() => bloodbankStore.isLoading);
const isSaving = computed(() => bloodbankStore.isSaving);

// Check if current coverage area is different from the persisted area
const hasChanges = computed(() => {
  // If there's no current coverage area, there are no changes
  if (!currentCoverageArea.value) {
    return false;
  }

  // If there's a current area but no persisted area, there are changes
  if (!persistedArea.value) {
    return true;
  }

  // Compare coordinates - both should be in [lng, lat][] format
  const currentCoords = currentCoverageArea.value.coordinates;
  const persistedCoords = persistedArea.value.coordinates;

  // Simple comparison - if lengths are different, there are changes
  if (currentCoords.length !== persistedCoords.length) {
    return true;
  }

  // Compare each coordinate pair
  for (let i = 0; i < currentCoords.length; i++) {
    const current = currentCoords[i];
    const persisted = persistedCoords[i];
    const diffLng = Math.abs(current[0] - persisted[0]);
    const diffLat = Math.abs(current[1] - persisted[1]);

    if (diffLng > 0 || diffLat > 0) {
      return true;
    }
  }
  return false;
});

const canSave = computed(() => {
  return (
    currentCoverageArea.value &&
    !isDrawing.value &&
    !isSaving.value &&
    hasChanges.value
  );
});

// Methods
const bloodbankPopupFadeClass = "fade-slide-enter-active fade-slide-enter-from";

// Define a custom locked draw mode to disable editing outside of draw mode
const LockedDrawMode: any = {
  onSetup() {
    // disable actionable controls while static
    // trash/combine/uncombine actions should be disabled
    // (selection is effectively ignored in this mode)
    // @ts-ignore - draw mode context
    this.setActionableState({
      trash: false,
      combineFeatures: false,
      uncombineFeatures: false,
    });
    return {};
  },
  toDisplayFeatures(_state: any, geojson: any, display: (g: any) => void) {
    display(geojson);
  },
  onClick() {
    return;
  },
  onTap() {
    return;
  },
  onMouseMove() {
    return;
  },
  onMouseDown() {
    return;
  },
  onDrag() {
    return;
  },
  onKeyUp() {
    return;
  },
  onTrash() {
    return;
  },
};
const loadBloodbankData = async () => {
  const currentBloodBankRole = userStore.currentBloodBankRole;

  const bloodBanksLocationId = currentBloodBankRole?.bloodBanksLocationId;

  if (!bloodBanksLocationId) {
    throw new Error("No blood bank access found");
  }

  try {
    const data = await bloodbankStore.loadBloodbankData(
      bloodBanksLocationId,
      true
    );

    // Set map center to bloodbank location if available
    if (data.location) {
      mapCenter.value = [
        data.location.coordinates[0], // lng
        data.location.coordinates[1], // lat
      ];
      zoom.value = INITIAL_ZOOM; // Moderate zoom to show the blood bank location and surrounding area

      // Center the map to the bloodbank location if map is already loaded
      if (mapRef.value?.map) {
        mapRef.value.map?.setCenter([
          data.location.coordinates[0], // lng
          data.location.coordinates[1], // lat
        ]);
        mapRef.value.map?.setZoom(INITIAL_ZOOM);
      }

      // Load existing coverage area if available
      if (data.coverageArea) {
        await loadExistingCoverageArea(data.coverageArea);
      }
    }
  } catch (error) {
    console.error("Error loading bloodbank data:", error);
    useToast().add({
      title: "Erro ao carregar dados do mapa",
      description: "Tente novamente mais tarde.",
      color: "error",
      duration: 3000,
    });
  }
};

const loadExistingCoverageArea = async (coverageArea: any) => {
  if (!draw.value || !coverageArea) return;

  try {
    // Database coverage area has structure: { type: "Polygon", coordinates: [[[lng, lat], [lng, lat], ...]] }
    // We need to extract the coordinates array
    const coordinates = coverageArea.coordinates[0]; // Get the first (and only) ring of the polygon

    // Convert coverage area to GeoJSON format for MapboxDraw
    const geojson = {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [coordinates], // Wrap in array for Polygon type
      },
      properties: {
        id: persistedCoverageAreaId,
        mode: "static", // Mark as static since it's from DB
      },
    };

    // Add to draw control
    if (draw.value) {
      draw.value.add(geojson);
    }

    // persistedArea is now computed from bloodbankData, so no need to set it manually
  } catch (error) {
    console.error("Error loading existing coverage area:", error);
  }
};

const mapExists = ref<boolean>(Boolean(mapRef.value?.map));
watch(
  mapRef,
  (newVal) => {
    mapExists.value = Boolean(newVal?.map);
  },
  { immediate: true }
);

const initializeMap = async () => {
  if (!bloodbankData.value) {
    console.log("Bloodbank data not found, waiting...");
    // Wait a bit and try again
    await nextTick(async () => {
      await initializeMap();
    });
    return;
  }
  try {
    // Initialize draw control
    const mapBoxDraw = MapboxDraw as any;
    mapBoxDraw.constants.classes.CANVAS = "maplibregl-canvas";
    mapBoxDraw.constants.classes.CONTROL_BASE = "maplibregl-ctrl";
    mapBoxDraw.constants.classes.CONTROL_PREFIX = "maplibregl-ctrl-";
    mapBoxDraw.constants.classes.CONTROL_GROUP = "maplibregl-ctrl-group";
    mapBoxDraw.constants.classes.ATTRIBUTION = "maplibregl-ctrl-attrib";
    draw.value = new MapboxDraw({
      // add locked mode to prevent edits when not drawing
      modes: { ...(mapBoxDraw.modes || {}), locked: LockedDrawMode },
      displayControlsDefault: false,
      controls: {
        polygon: true,
        trash: true,
        point: false,
        line_string: false,
        polyline: false,
        combine_features: false,
        uncombine_features: false,
        combine_points: false,
        uncombine_points: false,
        combine_lines: false,
        uncombine_lines: false,
        combine_polygons: false,
        uncombine_polygons: false,
      },
      styles: [
        // Polygon fill - Active/Inactive
        {
          id: "gl-draw-polygon-fill",
          type: "fill",
          filter: ["all", ["==", "$type", "Polygon"], ["!=", "mode", "static"]],
          paint: {
            "fill-color": "#10b981",
            "fill-outline-color": "#10b981",
            "fill-opacity": 0.2,
          },
        },
        // Polygon fill - Static (saved)
        {
          id: "gl-draw-polygon-fill-static",
          type: "fill",
          filter: ["all", ["==", "$type", "Polygon"], ["==", "mode", "static"]],
          paint: {
            "fill-color": "#6b7280",
            "fill-outline-color": "#6b7280",
            "fill-opacity": 0.3,
          },
        },
        // Polygon outline - Active (exclude persisted/static features)
        {
          id: "gl-draw-polygon-stroke-active",
          type: "line",
          filter: [
            "all",
            ["==", "$type", "Polygon"],
            ["==", "active", "true"],
            ["!=", "mode", "static"],
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
        // Polygon outline - Inactive (exclude persisted/static features)
        {
          id: "gl-draw-polygon-stroke-inactive",
          type: "line",
          filter: [
            "all",
            ["==", "$type", "Polygon"],
            ["==", "active", "false"],
            ["!=", "mode", "static"],
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
        // Polygon outline - Static (saved)
        {
          id: "gl-draw-polygon-stroke-static",
          type: "line",
          filter: ["all", ["==", "$type", "Polygon"], ["==", "mode", "static"]],
          layout: {
            "line-cap": "round",
            "line-join": "round",
          },
          paint: {
            "line-color": "#6b7280",
            "line-width": 3,
            "line-opacity": 0.8,
          },
        },
        // Vertex points
        {
          id: "gl-draw-polygon-and-line-vertex-halo-active",
          type: "circle",
          filter: ["all", ["==", "meta", "vertex"], ["==", "$type", "Point"]],
          paint: {
            "circle-radius": 8,
            "circle-color": "#fff",
          },
        },
        {
          id: "gl-draw-polygon-and-line-vertex-active",
          type: "circle",
          filter: ["all", ["==", "meta", "vertex"], ["==", "$type", "Point"]],
          paint: {
            "circle-radius": 6,
            "circle-color": "#10b981",
          },
        },
        // Midpoints
        {
          id: "gl-draw-line-midpoint",
          type: "circle",
          filter: ["all", ["==", "$type", "Point"], ["==", "meta", "midpoint"]],
          paint: {
            "circle-radius": 3,
            "circle-color": "#10b981",
          },
        },
      ],
    });

    console.log("Draw control created:", draw.value);

    // Add draw control to map
    console.log("Adding draw control to map?...");
    mapRef.value.map?.addControl(draw.value);
    console.log("Draw control added successfully");

    // Add event listeners
    mapRef.value.map?.on("draw.create", updateCoverageArea);
    mapRef.value.map?.on("draw.delete", clearCoverageAreaFromMap);
    mapRef.value.map?.on("draw.update", updateCoverageArea);

    // Add drawing mode detection
    mapRef.value.map?.on("draw.modechange", (e: any) => {
      console.log("Draw mode changed:", e.mode);
      isDrawing.value = e.mode === "draw_polygon";
    });

    // Add event listeners for when drawing is completed
    mapRef.value.map?.on("draw.create", () => {
      console.log("Polygon created, exiting drawing mode");
      isDrawing.value = false;
    });

    mapRef.value.map?.on("draw.update", () => {
      console.log("Polygon updated, exiting drawing mode");
      isDrawing.value = false;
    });

    console.log("Event listeners added");

    // Lock map in non-edit mode by default (no editing)
    try {
      draw.value.changeMode("locked");
    } catch (e) {
      // ignore if mode not available for any reason
    }

    // Center map to bloodbank location if available
    if (bloodbankData.value?.location) {
      mapRef.value.map?.setCenter([
        bloodbankData.value.location.coordinates[0], // lng
        bloodbankData.value.location.coordinates[1], // lat
      ]);
      mapRef.value.map?.setZoom(INITIAL_ZOOM);
    }

    if (bloodbankData.value?.coverageArea) {
      await loadExistingCoverageArea(bloodbankData.value.coverageArea);
    }
  } catch (error) {
    console.error("Error initializing map:", error);
  }
};

const updateCoverageArea = async () => {
  if (!draw.value) return;

  console.log("updateCoverageArea called");
  const data = draw.value.getAll();
  console.log("All features:", data.features);
  const nonStaticFeatures = data.features.filter(
    (feature: any) => feature.properties.mode !== "static"
  );

  if (nonStaticFeatures.length > 0) {
    const feature = nonStaticFeatures[0]; // Get the first (and should be only) polygon that is not static
    console.log("Selected feature:", feature);
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
      coordinates: feature.geometry.coordinates[0], // Keep as [lng, lat] format for database
      center: {
        lat: center.geometry.coordinates[1],
        lng: center.geometry.coordinates[0],
      },
      area: area,
    };

    console.log("Created coverage area object:", coverageArea);
    bloodbankStore.setCurrentCoverageArea(coverageArea);
    console.log("currentCoverageArea set to:", coverageArea);

    // Exit editing immediately; prevent moving polygon outside draw mode
    if (draw.value) {
      try {
        draw.value.changeMode("locked");
      } catch (e) {
        // ignore
      }
    }
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

    // Show success toast
    useToast().add({
      title: "Área salva com sucesso!",
      description: "A área de cobertura foi salva com sucesso.",
      color: "success",
      duration: 3000,
    });

    // Coverage area is already saved above, no need to save again

    // Reset the drawing state and clear current coverage area to disable save button
    isDrawing.value = false;
    bloodbankStore.setCurrentCoverageArea(null);

    // Set the polygon to static mode so it can't be dragged after saving
    if (draw.value) {
      try {
        draw.value.changeMode("locked");
      } catch (e) {
        // ignore
      }
      // Remove all features and re-add them in static mode
      const allFeatures = draw.value.getAll();

      if (allFeatures.features.length > 0) {
        // delete all features and reload the existing coverage area
        allFeatures.features.forEach((feature: any) => {
          draw.value.delete(feature.id);
        });
        await loadExistingCoverageArea(bloodbankData.value?.coverageArea);
      }
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

    useToast().add({
      title: "Erro ao salvar área de cobertura",
      description: errorMessage,
      color: "error",
      duration: 3000,
    });
  }
};

const activatePolygonTool = () => {
  // Switch Draw to polygon mode programmatically
  if (draw.value) {
    try {
      draw.value.changeMode("draw_polygon");
      isDrawing.value = true;
      console.log("Polygon tool activated");
    } catch (e) {
      console.warn("Failed to activate polygon mode", e);
    }
  }
};

const activateDeleteTool = () => {
  // Delete only non-persisted (non-static) polygons and exit any draw mode
  if (!draw.value) return;
  try {
    const all = draw.value.getAll();
    all.features
      .filter((f: any) => f?.properties?.mode !== "static")
      .forEach((f: any) => draw.value.delete(f.id));

    // cancel current drawing if active
    try {
      draw.value.changeMode("locked");
    } catch (_) {}

    // clear current in-store coverage area
    clearCoverageAreaFromMap();
    isDrawing.value = false;
    console.log("Non-static features deleted and mode set to static");
  } catch (e) {
    console.warn("Failed to delete features", e);
  }
};

const shouldShowBloodbankPopup = ref(false);
const showBloodbankInfo = () => {
  if (bloodbankPopup.value) {
    bloodbankPopup.value.addTo(mapRef.value.map);
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

await loadBloodbankData();
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

/* Custom Drawing Control Buttons */
.drawing-control-btn {
  width: 3rem;
  height: 2.5rem; /* Match the height of Salvar Área button (py-2 = 0.5rem top + 0.5rem bottom + text height) */
  min-height: 2.5rem; /* Ensure minimum height */
  border-radius: 0.5rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -1px rgba(0, 0, 0, 0.06);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  background: white;
  border: 2px solid #e5e7eb;
  color: #6b7280;
  cursor: pointer;
  opacity: 1;
  transform: scale(1);
  flex-shrink: 0; /* Prevent shrinking during animations */
}

.drawing-control-btn:hover {
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1),
    0 10px 10px -5px rgba(0, 0, 0, 0.04);
  transform: scale(1.05);
}

.drawing-control-btn-active {
  background: #3b82f6 !important;
  border-color: #2563eb !important;
  color: white !important;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.drawing-control-btn-active:hover {
  background: #2563eb !important;
  border-color: #1d4ed8 !important;
  color: white !important;
}

.drawing-control-btn-inactive {
  background: white;
  border-color: #e5e7eb;
  color: #6b7280;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.drawing-control-btn-inactive:hover {
  background: #3b82f6;
  border-color: #2563eb;
  color: white;
}

.drawing-control-btn-danger {
  background: #ef4444;
  border-color: #dc2626;
  color: white;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  animation: fade 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.drawing-control-btn-danger:hover {
  background: #dc2626;
  border-color: #b91c1c;
  color: white;
}

/* Ensure buttons are properly positioned */
.drawing-control-btn svg {
  pointer-events: none;
}

/* Trash button entrance animation */
@keyframes fade {
  0% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}

/* Animation for button state changes */
.drawing-control-btn {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.drawing-control-btn:active {
  transform: scale(0.95);
}
</style>
