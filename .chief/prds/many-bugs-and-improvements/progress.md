## Codebase Patterns
- Dashboard page is at `pages/[bloodbankSlug]/index.vue`, store at `stores/bloodbank.ts`
- Store has separate loading flags: `isLoading` (bloodbank data), `isLoadingDashboard`, `isLoadingTeams`, etc.
- Use `storeToRefs` for reactive store state, direct store access for actions
- Pre-existing type errors exist in: `pages/agendar/[bloodbankSlug]/index.vue`, `server/models/*.ts` (InferSchemaType import), `server/services/team.ts` (ObjectId null), `server/api/v1/bloodbank/.../available-dates/index.get.ts`
- Typecheck command: `npx nuxi typecheck`
- Use `fetchWithAuth` from `~/composables/useFetchWithAuth` for API calls
- Nuxt UI components: `UAlert`, `UCard`, `USkeleton`, `UButton`, `UIcon`, `UAvatar`
- When store actions change entity status (accept/reject/cancel), also update `dashboardData` counts manually since it's a separate cached snapshot

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

## 2026-03-07 - US-002
- Fixed pending requests alert not updating reactively after accept/reject actions
- Added `dashboardData.pendingRequestsCount--` in both `acceptCollectionRequest` and `rejectCollectionRequest` store actions
- The alert in the dashboard uses `dashboardData?.pendingRequestsCount` which is reactive via Pinia, so decrementing it triggers the `v-if` to hide the alert when count reaches 0
- Files changed: `stores/bloodbank.ts`
- **Learnings for future iterations:**
  - `dashboardData` is loaded once from the dashboard API and cached in the store — any action that changes the underlying data must also update `dashboardData` manually
  - The pending alert visibility is controlled by `(dashboardData?.pendingRequestsCount || 0) > 0` in the template — direct mutation of the count is sufficient for reactivity
  - Accept and reject actions already update `collectionRequests.data` locally but were missing the dashboard count update
---
