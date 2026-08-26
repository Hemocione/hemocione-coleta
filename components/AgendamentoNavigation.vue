<template>
  <nav
    aria-label="Navegação do agendamento"
    class="relative"
    @keydown.esc="closeMobileMenu"
  >
    <div class="hidden items-center gap-2 md:flex">
      <NuxtLink to="/agendar" data-testid="agendar-link">
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-lucide-calendar-plus"
        >
          Agendar
        </UButton>
      </NuxtLink>

      <NuxtLink
        v-if="isLoggedIn"
        to="/agendar/meus-agendamentos"
        data-testid="meus-agendamentos-link"
      >
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-lucide-calendar-clock"
        >
          Meus Agendamentos
        </UButton>
      </NuxtLink>

      <UButton
        v-if="!isLoggedIn"
        color="primary"
        icon="i-lucide-log-in"
        @click="handleLogin"
      >
        Entrar
      </UButton>
      <UButton
        v-else
        color="neutral"
        icon="i-lucide-log-out"
        @click="handleLogout"
      >
        Sair ({{ firstName }})
      </UButton>
    </div>

    <div class="md:hidden">
      <UButton
        :icon="mobileMenuOpen ? 'i-lucide-x' : 'i-lucide-menu'"
        color="neutral"
        variant="ghost"
        :aria-label="mobileMenuOpen ? 'Fechar menu' : 'Abrir menu'"
        aria-controls="agendamento-mobile-menu"
        :aria-expanded="mobileMenuOpen"
        data-testid="mobile-menu-trigger"
        @click="mobileMenuOpen = !mobileMenuOpen"
      />

      <div
        v-if="mobileMenuOpen"
        id="agendamento-mobile-menu"
        data-testid="mobile-menu"
        class="absolute right-0 top-full z-40 mt-3 w-[min(18rem,calc(100vw-2rem))] rounded-xl border border-gray-200 bg-white p-2 shadow-lg"
      >
        <NuxtLink
          to="/agendar"
          data-testid="agendar-link"
          class="block"
          @click="closeMobileMenu"
        >
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-calendar-plus"
            class="w-full justify-start"
          >
            Agendar
          </UButton>
        </NuxtLink>

        <NuxtLink
          v-if="isLoggedIn"
          to="/agendar/meus-agendamentos"
          data-testid="meus-agendamentos-link"
          class="block"
          @click="closeMobileMenu"
        >
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-calendar-clock"
            class="w-full justify-start"
          >
            Meus Agendamentos
          </UButton>
        </NuxtLink>

        <div class="my-2 border-t border-gray-100" />

        <UButton
          v-if="!isLoggedIn"
          color="primary"
          icon="i-lucide-log-in"
          class="w-full justify-start"
          @click="handleLogin"
        >
          Entrar
        </UButton>
        <UButton
          v-else
          color="neutral"
          icon="i-lucide-log-out"
          class="w-full justify-start"
          @click="handleLogout"
        >
          Sair ({{ firstName }})
        </UButton>
      </div>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { ref } from "vue";

defineProps<{
  isLoggedIn: boolean;
  firstName: string;
}>();

const emit = defineEmits<{
  login: [];
  logout: [];
}>();

const mobileMenuOpen = ref(false);

const closeMobileMenu = () => {
  mobileMenuOpen.value = false;
};

const handleLogin = () => {
  closeMobileMenu();
  emit("login");
};

const handleLogout = () => {
  closeMobileMenu();
  emit("logout");
};
</script>
