## Codebase Patterns
- Dashboard page is at `pages/[bloodbankSlug]/index.vue`, store at `stores/bloodbank.ts`
- Store has separate loading flags: `isLoading` (bloodbank data), `isLoadingDashboard`, `isLoadingTeams`, etc.
- Use `storeToRefs` for reactive store state, direct store access for actions
- Pre-existing type errors exist in: `pages/agendar/[bloodbankSlug]/index.vue`, `server/models/*.ts` (InferSchemaType import), `server/services/team.ts` (ObjectId null), `server/api/v1/bloodbank/.../available-dates/index.get.ts`
- Typecheck command: `npx nuxi typecheck`
- Use `fetchWithAuth` from `~/composables/useFetchWithAuth` for API calls
- Nuxt UI components: `UAlert`, `UCard`, `USkeleton`, `UButton`, `UIcon`, `UAvatar`
- When store actions change entity status (accept/reject/cancel), also update `dashboardData` counts manually since it's a separate cached snapshot
- When store actions change an entity's status, REMOVE the item from `collectionRequests.data` (filter it out) instead of updating in-place, so it disappears from the current tab

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

## 2026-03-07 - US-003
- Fixed accepted requests appearing in the "Pendentes" tab by changing store actions (accept/reject/cancel) to remove the item from the list instead of updating in-place
- Fixed backend pagination using `requestsWithDetails.length` instead of original MongoDB `total` count
- Removed debug console.log statements from `getCollectionRequestsByBloodBank`
- Files changed: `stores/bloodbank.ts`, `server/services/collectionRequest.ts`
- **Learnings for future iterations:**
  - The collection requests listing page (`pages/[bloodbankSlug]/coletas/index.vue`) uses tabs with status filters — each tab shows only requests with that status
  - The store's `collectionRequests.data` is the list rendered in the current tab — when a status changes, the item must be REMOVED (not updated) so it no longer appears in the wrong tab
  - The same pattern applies to accept, reject, and cancel actions — all three should filter out the item
  - Backend pagination in `getCollectionRequestsByBloodBank` was incorrectly recalculated after institution filtering — use the original MongoDB `total` from `countDocuments`
---
