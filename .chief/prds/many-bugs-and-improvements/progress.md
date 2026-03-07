## Codebase Patterns
- Dashboard page is at `pages/[bloodbankSlug]/index.vue`, store at `stores/bloodbank.ts`
- Store has separate loading flags: `isLoading` (bloodbank data), `isLoadingDashboard`, `isLoadingTeams`, etc.
- Use `storeToRefs` for reactive store state, direct store access for actions
- Pre-existing type errors exist in: `pages/agendar/[bloodbankSlug]/index.vue`, `server/models/*.ts` (InferSchemaType import), `server/services/team.ts` (ObjectId null), `server/api/v1/bloodbank/.../available-dates/index.get.ts`
- Typecheck command: `npx nuxi typecheck`
- Use `fetchWithAuth` from `~/composables/useFetchWithAuth` for API calls
- Nuxt UI components: `UAlert`, `UCard`, `USkeleton`, `UButton`, `UIcon`, `UAvatar`

---

## 2026-03-07 - US-001
- Fixed dashboard loading stuttering by tracking both `isLoadingDashboard` AND `isLoading` (bloodbank data) in the page's computed `isLoading`
- Removed `v-auto-animate` from outer container to prevent layout animation causing visual stuttering
- Added error state with "Tentar novamente" button when loading fails, preventing infinite loading state
- Files changed: `pages/[bloodbankSlug]/index.vue`
- **Learnings for future iterations:**
  - The store has multiple independent loading flags (`isLoading`, `isLoadingDashboard`, etc.) — when a page loads multiple datasets in parallel, the page's loading state must track ALL of them
  - `loadBloodbankData` uses `isLoading` (generic), while `loadDashboardData` uses `isLoadingDashboard` — be aware of which flag each action uses
  - Pre-existing type errors don't block work on other files — just verify your file isn't in the error list
---
