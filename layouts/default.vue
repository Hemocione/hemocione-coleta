<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Sidebar -->
    <div
      class="fixed inset-y-0 left-0 z-[1100] bg-white shadow-xl transform transition-all duration-300 ease-in-out lg:translate-x-0 border-r border-gray-200 flex flex-col"
      :class="{
        '-translate-x-full': !sidebarOpen,
        'translate-x-0': sidebarOpen,
        'w-72': sidebarOpen,
        'w-16': !sidebarOpen,
      }"
    >
      <!-- Sidebar Header -->
      <div
        class="flex items-center h-16 pl-4 border-b border-gray-200 relative"
      >
        <div class="flex items-center gap-3">
          <div
            class="flex items-center justify-center w-8 h-8 bg-red-500 rounded-lg overflow-hidden"
          >
            <NuxtImg
              v-if="currentBloodBankLogo"
              :src="currentBloodBankLogo"
              alt="Logo"
              class="size-full object-cover"
            />
            <UIcon
              v-else
              name="i-lucide-droplets"
              class="size-full object-cover text-white"
            />
          </div>
          <Transition name="fade">
            <span
              v-if="shouldShowMenuDetail"
              class="font-bold text-xl text-gray-900 truncate max-w-[11rem] whitespace-nowrap"
            >
              {{ currentBloodBankName }}
            </span>
          </Transition>
        </div>
        <Transition name="fade">
          <UButton
            v-if="sidebarOpen && isMobile && shouldShowMenuDetail"
            icon="i-lucide-chevron-left"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="sidebarOpen = false"
            class="lg:hidden size-8 absolute top-1/2 right-[-16px] -translate-y-1/2 z-10 bg-white p-2 rounded-full border border-gray-200"
          />
        </Transition>
        <!-- Arrow buttons absolutely positioned at sidebar border -->
        <div
          v-if="!isMobile"
          class="absolute top-1/2 right-[-16px] -translate-y-1/2 z-10 hidden lg:block bg-white rounded-full p-0 border border-gray-200"
        >
          <Transition name="fade">
            <UButton
              v-if="sidebarOpen"
              icon="i-lucide-chevron-left"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="sidebarOpen = false"
            />
            <UButton
              v-else
              icon="i-lucide-chevron-right"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="sidebarOpen = true"
            />
          </Transition>
        </div>
      </div>

      <!-- Navigation -->
      <nav
        class="flex-1 px-5 py-6 flex flex-col gap-4 items-left vertical-align-middle"
      >
        <NuxtLink
          v-for="item in navigationItems"
          :key="item.to"
          :to="item.to"
          :class="[
            'rounded-lg text-sm font-medium transition-colors duration-200 w-full flex items-center hover:bg-gray-100 hover:text-gray-900',
            'min-h-[2.5rem]',
            sidebarOpen ? 'px-3 py-3 gap-3' : 'p-3 justify-center',
            isActiveRoute(item.to)
              ? 'bg-red-50 text-red-700 border border-red-200'
              : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900',
          ]"
          :title="!sidebarOpen ? item.label : undefined"
          style="overflow: hidden"
        >
          <div
            class="flex items-center w-full"
            style="width: 100%; gap: 0.75rem; min-width: 0"
          >
            <UIcon
              :name="item.icon"
              :class="[
                isActiveRoute(item.to)
                  ? 'text-red-600'
                  : 'text-gray-500 group-hover:text-gray-700',
              ]"
              style="
                min-width: 1.25rem;
                min-height: 1.25rem;
                display: inline-block;
                vertical-align: middle;
                flex-shrink: 0;
              "
            />
            <span
              v-auto-animate
              :aria-hidden="!shouldShowMenuDetail"
              :style="
                shouldShowMenuDetail
                  ? 'max-width: 11rem; opacity: 1; margin-left: 0.5rem; vertical-align: middle; line-height: 1.25rem;'
                  : 'max-width: 0; opacity: 0; margin-left: 0; overflow: hidden; pointer-events: none; transition: max-width 0.3s, opacity 0.3s; vertical-align: middle; line-height: 1.25rem;'
              "
              :class="[
                'truncate inline-block align-middle leading-none transition-all duration-300',
                isActiveRoute(item.to)
                  ? 'text-red-700'
                  : 'text-gray-700 group-hover:text-gray-900',
              ]"
              :title="item.label"
            >
              {{ shouldShowMenuDetail ? item.label : "\u00A0" }}
            </span>
          </div>
        </NuxtLink>
      </nav>

      <!-- User Info -->
      <div class="border-t border-gray-200 relative user-menu-container">
        <div
          :class="[
            'flex items-center p-3 rounded-lg hover:bg-gray-50 transition-colors',
            'min-h-[3.5rem]', // Fixed height to prevent layout shift
            sidebarOpen ? 'gap-3' : 'justify-center',
          ]"
          :title="!sidebarOpen ? userDisplayName : undefined"
        >
          <div
            class="flex items-center justify-center w-8 h-8 rounded-lg text-white text-sm font-semibold flex-shrink-0"
            :style="{ backgroundColor: userAvatarColor }"
          >
            {{ userInitials }}
          </div>
          <Transition name="fade">
            <div
              v-if="shouldShowMenuDetail && sidebarOpen"
              class="flex-1 min-w-0"
            >
              <p
                class="text-sm font-medium text-gray-900 truncate leading-none"
              >
                {{ userDisplayName }}
              </p>
              <p class="text-xs text-gray-500 truncate leading-none">
                {{ user?.email }}
              </p>
            </div>
          </Transition>
          <Transition name="fade">
            <UButton
              v-if="shouldShowMenuDetail && sidebarOpen"
              icon="i-lucide-more-vertical"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="showUserMenu = !showUserMenu"
              class="flex-shrink-0"
            />
          </Transition>
        </div>

        <!-- User Menu Dropdown -->
        <Transition name="fade">
          <div
            v-if="showUserMenu && sidebarOpen"
            class="absolute bottom-full left-3 right-3 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50"
          >
            <div class="py-2">
              <UButton
                variant="ghost"
                color="neutral"
                size="sm"
                class="w-full justify-start px-3 py-2 text-sm"
                @click="handleLogout"
              >
                <UIcon name="i-lucide-log-out" class="size-4 mr-2" />
                Sair
              </UButton>
            </div>
          </div>
        </Transition>
      </div>
    </div>

    <!-- Overlay for mobile only -->
    <div
      v-if="sidebarOpen && isMobile"
      class="fixed inset-0 z-[1050] bg-black/50 transition-all duration-300 ease-in-out"
      @click="sidebarOpen = false"
    />

    <!-- Main Content -->
    <div
      class="transition-all duration-300 ease-in-out flex flex-col h-screen"
      :class="sidebarOpen ? 'lg:ml-72' : 'lg:ml-16'"
    >
      <!-- Top Navigation -->
      <header
        :class="[
          'h-16 bg-white border-b border-gray-200 z-30 flex-shrink-0',
          isMobile ? 'px-4' : 'px-6',
        ]"
      >
        <div class="flex items-center justify-between h-16">
          <div class="flex items-center gap-4">
            <UButton
              icon="i-lucide-menu"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="sidebarOpen = true"
              class="lg:hidden"
            />
            <div>
              <Transition name="slide-right" mode="out-in">
                <h1
                  class="text-xl font-semibold text-gray-900"
                  :key="currentPageTitle"
                >
                  {{ currentPageTitle }}
                </h1>
              </Transition>
              <Transition name="slide-right" mode="out-in">
                <p class="text-sm text-gray-500" :key="currentPageDescription">
                  {{ currentPageDescription }}
                </p>
              </Transition>
            </div>
          </div>
        </div>
      </header>

      <!-- Page Content -->
      <main
        class="flex-1 overflow-y-auto scrollbar-thin"
        :class="route.meta.noPadding ? 'p-0' : 'p-6'"
      >
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useUserStore } from "~/stores/user";
import { generateAvatarColor, generateInitials } from "~/utils/avatarColor";

const userStore = useUserStore();
const { user } = storeToRefs(userStore);
const route = useRoute();

// Sidebar state - open by default on desktop, closed on mobile
const sidebarOpen = ref(false);
const showUserMenu = ref(false);

// Check if we're on mobile
const isMobile = ref(false);

// Get current blood bank slug from route
const bloodbankSlug = computed(() => route.params.bloodbankSlug as string);

// Current blood bank helpers from user roles
const currentBloodBankRole = computed(() => {
  return user.value?.bloodBankRoles?.find(
    (r) => r.slug === bloodbankSlug.value
  );
});

const currentBloodBankName = computed(() => {
  return currentBloodBankRole.value?.name || "Hemocione";
});

const currentBloodBankLogo = computed(() => {
  return currentBloodBankRole.value?.logo || null;
});

// Check if a route is active
const isActiveRoute = (routePath: string) => {
  const currentPath = route.path;

  // Exact match for home route
  if (routePath === `/${bloodbankSlug.value}`) {
    return currentPath === routePath;
  }

  // For other routes, check if current path starts with the route path
  return currentPath.startsWith(routePath);
};

// Page title and description based on current route
const currentPageTitle = computed(() => {
  const path = route.path;
  if (path.includes("/calendario/configuracao-massa")) return "Configuração em Massa";
  if (path.includes("/calendario")) return "Calendário";
  if (path.includes("/cobertura")) return "Área de Cobertura";
  if (path.includes("/equipes")) return "Equipes";
  if (path.includes("/restricoes")) return "Restrições";
  if (path.includes("/coletas")) return "Coletas";
  return "Painel";
});

const currentPageDescription = computed(() => {
  const path = route.path;
  if (path.includes("/calendario/configuracao-massa")) return "Configure a disponibilidade do ano inteiro";
  if (path.includes("/calendario")) return "Gerencie o calendário de coletas";
  if (path.includes("/cobertura"))
    return "Área de cobertura para coleta externa";
  if (path.includes("/equipes"))
    return "Organize as equipes disponíveis para coleta";
  if (path.includes("/restricoes"))
    return "Defina restrições e regras para coleta externa";
  if (path.includes("/coletas"))
    return "Gerencie as coletas externas e solicitações";
  return "Painel de controle";
});

// Navigation items
const navigationItems = [
  {
    label: "Painel",
    icon: "i-lucide-home",
    to: `/${bloodbankSlug.value}`,
  },
  {
    label: "Calendário",
    icon: "i-lucide-calendar",
    to: `/${bloodbankSlug.value}/calendario`,
  },
  {
    label: "Coletas",
    icon: "i-lucide-droplets",
    to: `/${bloodbankSlug.value}/coletas`,
  },
  {
    label: "Área de Cobertura",
    icon: "i-lucide-map-pin",
    to: `/${bloodbankSlug.value}/cobertura`,
  },
  {
    label: "Equipes de Coleta",
    icon: "i-lucide-users",
    to: `/${bloodbankSlug.value}/equipes`,
  },
  {
    label: "Restrições",
    icon: "i-lucide-shield-alert",
    to: `/${bloodbankSlug.value}/restricoes`,
  },
];

// User display name
const userDisplayName = computed(() => {
  return `${user.value?.givenName} ${user.value?.surName}`;
});

// User initials for avatar
const userInitials = computed(() => {
  if (!user.value?.givenName || !user.value?.surName) return "C";
  return generateInitials(user.value.givenName, user.value.surName);
});

// User avatar color
const userAvatarColor = computed(() => {
  if (!user.value?.givenName || !user.value?.surName) return "#6b7280";
  const fullName = `${user.value.givenName} ${user.value.surName}`;
  return generateAvatarColor(fullName);
});

// Logout handler
const handleLogout = async () => {
  await userStore.logOut();
};

// Close sidebar on route change (mobile only)
watch(
  () => route.path,
  () => {
    if (window.innerWidth < 1024) {
      sidebarOpen.value = false;
    }
    showUserMenu.value = false;
  }
);

const shouldShowMenuDetail = ref(sidebarOpen.value);
const msDelayToShowMenuDetail = 300;

watch(
  sidebarOpen,
  (newVal) => {
    if (newVal) {
      setTimeout(() => {
        if (sidebarOpen.value) {
          shouldShowMenuDetail.value = true;
        }
      }, msDelayToShowMenuDetail);
    } else {
      shouldShowMenuDetail.value = false;
      showUserMenu.value = false; // Close user menu when sidebar closes
    }
  },
  { immediate: true }
);

const handleResize = () => {
  isMobile.value = window.innerWidth < 1024;
  if (window.innerWidth >= 1024) {
    sidebarOpen.value = true;
  } else {
    sidebarOpen.value = false;
  }
};
// Close user menu when clicking outside
const closeUserMenu = (event: Event) => {
  const target = event.target as HTMLElement;
  const userMenuContainer = document.querySelector(".user-menu-container");

  if (userMenuContainer && !userMenuContainer.contains(target)) {
    showUserMenu.value = false;
  }
};

onMounted(() => {
  // Set initial mobile state
  isMobile.value = window.innerWidth < 1024;

  // Open sidebar on desktop screens
  if (window.innerWidth >= 1024) {
    sidebarOpen.value = true;
  }

  window.addEventListener("resize", handleResize);
  document.addEventListener("click", closeUserMenu);
});

onUnmounted(() => {
  window.removeEventListener("resize", handleResize);
  document.removeEventListener("click", closeUserMenu);
});
</script>
