## Codebase Patterns
- Dashboard page is at `pages/[bloodbankSlug]/index.vue`, store at `stores/bloodbank.ts`
- Store has separate loading flags: `isLoading` (bloodbank data), `isLoadingDashboard`, `isLoadingTeams`, etc.
- Use `storeToRefs` for reactive store state, direct store access for actions
- Pre-existing type errors exist in: `pages/agendar/[bloodbankSlug]/index.vue`, `server/models/*.ts` (InferSchemaType import), `server/services/team.ts` (ObjectId null)
- Calendar page is at `pages/[bloodbankSlug]/calendario/index.vue`, uses `UCalendar` + `UChip` for availability indicators
- AvailableDate model has a virtual `allSlotsLocked` but `.lean()` doesn't include virtuals — compute locked state client-side using `slot.locked || slot.lockedBy`
- Slot locked state should check BOTH `slot.locked` and `slot.lockedBy` for consistency with the Mongoose virtual
- Typecheck command: `npx nuxi typecheck`
- Use `fetchWithAuth` from `~/composables/useFetchWithAuth` for API calls
- Nuxt UI components: `UAlert`, `UCard`, `USkeleton`, `UButton`, `UIcon`, `UAvatar`
- When store actions change entity status (accept/reject/cancel), also update `dashboardData` counts manually since it's a separate cached snapshot
- When store actions change an entity's status, REMOVE the item from `collectionRequests.data` (filter it out) instead of updating in-place, so it disappears from the current tab
- CollectionRequest model uses subdocument schemas with `{ _id: false }` — follow this pattern for new embedded objects
- Both institution and backoffice POST endpoints have their own Zod schemas — both must be updated when adding new fields
- The store's `CollectionRequest` interface in `stores/bloodbank.ts` mirrors the server's `CollectionRequestWithDetails` — keep them in sync
- Institution data from hemocione-id has `address` (single string), `city`, `state` — structured address on CollectionRequest is separate (for the collection location)
- Scheduling store (`stores/scheduling.ts`) has address state for institution creation flow — separate from collection request address
- Cancellation reason is stored in `statusHistory[].reason` (not a top-level field) — retrieve from statusHistory for display
- Use `method: "POST"` (not `"POST" as any`) in `fetchWithAuth` options to preserve proper response typing
- AvailableDate `date` field is a string (`YYYY-MM-DD`), NOT a Date object — always compare with formatted strings in MongoDB queries
- Public API routes go under `/api/v1/public/` — auth middleware skips them automatically
- BloodBank model has no contact info (phone/email) — only name, slug, logo; contact data lives in hemocione-id
- For public endpoints needing optional/conditional auth, call `useHemocioneUserAuth(event)` directly (reads from Authorization header)
- `CollectionRequest.requestedByUserId` stores the creating user's ID — use for ownership verification on institution-side actions

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

## 2026-03-07 - US-004
- Fixed calendar preview showing incorrect locked/available states
- Fixed API endpoint `available-dates/index.get.ts` passing `year` and `month` as positional args instead of options object
- Updated `getAvailabilityColor` to check both `slot.locked` and `slot.lockedBy` (consistent with Mongoose virtual `allSlotsLocked`)
- Added `lockedBy` to store's `Slot` interface so the data is available on the frontend
- Added visual legend below calendar showing the three states (green=available, yellow=partial, red=locked)
- Updated detail modal slot badges and input disabled states to also check `lockedBy`
- Files changed: `pages/[bloodbankSlug]/calendario/index.vue`, `stores/bloodbank.ts`, `server/api/v1/bloodbank/[bloodbanksLocationId]/available-dates/index.get.ts`
- **Learnings for future iterations:**
  - The `getAvailableDatesByBloodBank` service uses `.lean()` which skips Mongoose virtuals — `allSlotsLocked` is not returned from the API, so it must be computed client-side
  - Slot locked state should check BOTH `slot.locked` AND `slot.lockedBy` for consistency — there can be edge cases where only one is set
  - The API endpoint had a parameter mismatch bug — `getAvailableDatesByBloodBank` expects `(bloodBanksLocationId, options?)` but was called with `(id, year, month)` — this was a pre-existing type error that is now fixed
  - The `Slot` interface in `stores/bloodbank.ts` now includes `lockedBy` — needed for US-005 (click locked day to navigate to collection request)
---

## 2026-03-07 - US-005
- Modified `handleDateSelect` in the calendar page to check for locked slots before opening the detail modal
- If a day has slots locked by a single collection request (`lockedBy`), navigates directly to `/[bloodbankSlug]/coletas/[requestId]`
- If a day has slots locked by multiple collection requests, shows a navigation modal listing each collection request with a click-to-navigate action
- Days without locked slots keep the original behavior (open detail/edit modal)
- Added `showLockedNavigationModal` and `lockedCollectionRequestIds` state vars
- Added `navigateToCollectionRequest` helper using `navigateTo()` (Nuxt built-in)
- Files changed: `pages/[bloodbankSlug]/calendario/index.vue`
- **Learnings for future iterations:**
  - `lockedBy` on a slot contains the CollectionRequest `_id` — use `new Set()` to deduplicate across multiple slots
  - `navigateTo()` is a Nuxt composable available in setup context — no need to import `useRouter`
  - The route param for the bloodbank slug is accessed via `route.params.bloodbankSlug`
  - For the multiple-locked case, a simple UModal with clickable items is sufficient — no need for complex popover logic
---

## 2026-03-07 - US-006
- Added `host` field (name, email, phone) to CollectionRequest Mongoose schema with HostSchema subdocument
- Added Zod validation for `host` in both POST endpoints (institution and backoffice)
- Updated `CreateCollectionRequestData` interface and `createCollectionRequest` service to accept and persist host data
- Added `host` to `CollectionRequestWithDetails` interface (server) and `CollectionRequest` interface (store)
- Host is returned automatically in list/detail APIs via `.lean()` spread — no explicit changes needed in GET endpoints
- Files changed: `server/models/collectionRequest.ts`, `server/services/collectionRequest.ts`, `server/api/v1/institutions/[institutionId]/collection-requests/index.post.ts`, `server/api/backoffice/v1/bloodbanks/[bloodbanksLocationId]/collection-requests/index.post.ts`, `stores/bloodbank.ts`
- **Learnings for future iterations:**
  - The CollectionRequest model uses subdocument schemas (like `HostSchema`, `RequestedDateSchema`) with `{ _id: false }` — follow this pattern for new embedded objects
  - Both institution and backoffice POST endpoints have their own Zod schemas — both must be updated when adding new required fields
  - The `CreateCollectionRequestData` interface in `server/services/collectionRequest.ts` is the single source of truth for what data the service accepts
  - Default host values (from authenticated user) are a frontend concern (US-007) — the API just requires the fields to be present
  - The store's `CollectionRequest` interface in `stores/bloodbank.ts` mirrors the server's `CollectionRequestWithDetails` — keep them in sync
---

## 2026-03-07 - US-007
- Added host (Ponto Focal) form fields to the scheduling page (`pages/agendar/[bloodbankSlug]/index.vue`)
- Fields (Name, Email, Phone) are pre-filled with logged-in user data from `useUserStore` (givenName + surName, email, phone)
- Fields are editable so the host can be a different person
- Frontend validation: name required, email format check via regex, phone required
- Submit button disabled when host fields are invalid (`isHostValid` computed)
- Host data included in POST payload to institution collection request endpoint
- Host fields reset to user defaults when confirmation modal is closed
- Files changed: `pages/agendar/[bloodbankSlug]/index.vue`
- **Learnings for future iterations:**
  - User data is available via `useUserStore` → `user.value` with fields `givenName`, `surName`, `email`, `phone`
  - The institution POST endpoint already has `host` as a required Zod field (added in US-006) — frontend just needs to send it
  - `UFormField` with `required` prop shows the asterisk indicator; `UInput` handles type="email" and type="tel" natively
  - Phone mask was not added (just a tel input) — could be enhanced later with a mask library if needed
---

## 2026-03-07 - US-008
- Added "Ponto Focal" card to the collection request detail page (`pages/[bloodbankSlug]/coletas/[requestId].vue`) showing name, email (mailto: link), and phone (tel: link)
- Added host name display on the collection request listing cards (`pages/[bloodbankSlug]/coletas/index.vue`) below the institution name with "Ponto focal:" prefix
- Uses optional chaining (`request.host?.name`) for backward compatibility with requests created before host field existed
- Files changed: `pages/[bloodbankSlug]/coletas/[requestId].vue`, `pages/[bloodbankSlug]/coletas/index.vue`
- **Learnings for future iterations:**
  - The `host` field on `CollectionRequest` is available via `currentCollectionRequest.host` in the detail page (loaded by `loadCollectionRequestById`)
  - Use `v-if="currentCollectionRequest.host"` to conditionally render the host section for backward compatibility
  - The listing page's `collectionRequests.data` items also have the `host` field available from the API
---

## 2026-03-07 - US-009
- Added structured address schema (`AddressSchema`) to CollectionRequest model with fields: street, number, complement (optional), neighborhood, city, state, zipCode
- Added Zod validation for `address` (optional) in both institution and backoffice POST endpoints
- Updated `CreateCollectionRequestData` and `CollectionRequestWithDetails` interfaces in the service layer
- Updated `CollectionRequest` interface in `stores/bloodbank.ts` with `StructuredAddress` type
- Added address form section in the scheduling page (`pages/agendar/[bloodbankSlug]/index.vue`) with all structured fields, UF dropdown, and CEP mask (XXXXX-XXX)
- City and state are pre-filled from the selected institution's data
- Address is validated before submission (all required fields + 8-digit CEP)
- Added "Endereço do Local da Coleta" card in the backoffice detail page showing formatted address
- Institution header in detail page shows structured address when available, falls back to old `institutionAddress` string for backward compatibility
- Files changed: `server/models/collectionRequest.ts`, `server/services/collectionRequest.ts`, `server/api/v1/institutions/[institutionId]/collection-requests/index.post.ts`, `server/api/backoffice/v1/bloodbanks/[bloodbanksLocationId]/collection-requests/index.post.ts`, `stores/bloodbank.ts`, `pages/agendar/[bloodbankSlug]/index.vue`, `pages/[bloodbankSlug]/coletas/[requestId].vue`
- **Learnings for future iterations:**
  - The `address` field on CollectionRequest is optional for backward compatibility — old requests without it still work
  - The scheduling store (`stores/scheduling.ts`) already has address-related state (`cep`, `address`, `city`, `stateUF`) for the institution creation flow — these are separate from the collection request address
  - Institution data from hemocione-id has `address` (single string), `city`, `state` — the structured address on CollectionRequest is for the collection location specifically
  - CEP mask is implemented manually with `formatCep` — no external library needed
  - Brazilian states list is hardcoded as a simple array of 2-letter codes mapped to `{ label, value }` for USelect
  - The `institutionAddress` field (from hemocione-id) remains unchanged — it's still the fallback when no structured address is on the request
---

## 2026-03-07 - US-010
- Implemented blood bank cancellation flow for accepted collection requests
- Updated `cancelCollectionRequest` service to accept `cancellationReason` and `bloodBanksLocationId` parameters
- Created new API endpoint `POST /api/v1/bloodbank/[bloodbanksLocationId]/collection-requests/[requestId]/cancel.post.ts` with reason validation (required, max 1000 chars)
- Updated store action to send `cancellationReason` in the request body; fixed `method: "POST" as any` → `method: "POST"` to resolve type errors
- Added "Cancelar Coleta" button on the detail page (visible only for `status === 'accepted'`)
- Added cancel confirmation modal with textarea for reason (required, max 1000 chars, character counter)
- Added "Motivo do Cancelamento" card that displays when request is cancelled (reads reason from statusHistory)
- The service already had slot unlocking logic (sets `locked: false`, `lockedBy: null`) for accepted requests — no changes needed there
- Files changed: `server/services/collectionRequest.ts`, `server/api/v1/bloodbank/[bloodbanksLocationId]/collection-requests/[requestId]/cancel.post.ts` (new), `stores/bloodbank.ts`, `pages/[bloodbankSlug]/coletas/[requestId].vue`
- **Learnings for future iterations:**
  - The `cancelCollectionRequest` service already existed with slot unlocking logic but lacked `cancellationReason` and `bloodBanksLocationId` params
  - The store's `cancelCollectionRequest` already existed but didn't send a reason body — it also had `method: "POST" as any` which caused the response to be typed as `unknown`; using `method: "POST"` (without `as any`) fixes this
  - Cancellation reason is stored in `statusHistory[].reason`, not as a top-level field like `rejectionReason` — use `statusHistory` to retrieve it for display
  - Pre-existing type errors in `server/services/team.ts` (ObjectId null) are the only remaining errors — they don't affect this work
---

## 2026-03-07 - US-011
- Created public tracking page at `pages/agendar/acompanhar/[requestId]/index.vue` — shows request status, dates, host info, address, and status timeline
- For accepted requests, shows "Precisa cancelar?" info alert directing institution to contact the blood bank directly — no cancel button available
- For pending requests (with login), shows "Retirar Pedido" button that cancels with optional reason
- Added `getCollectionRequestPublic` service function — returns request details with blood bank name/logo, institution name, dates, and sanitized status history (no internal user IDs)
- Added `withdrawCollectionRequest` service function — only allows cancelling pending requests by the institution
- Created public API `GET /api/v1/public/collection-requests/[requestId]` — no auth required
- Created public API `POST /api/v1/public/collection-requests/[requestId]/withdraw` — requires auth (Bearer token), validates user is the request creator
- Also created institution-side `POST /api/v1/institutions/[institutionId]/collection-requests/[requestId]/withdraw` endpoint for API consumers
- Files changed: `server/services/collectionRequest.ts`, `server/api/v1/public/collection-requests/[requestId]/index.get.ts` (new), `server/api/v1/public/collection-requests/[requestId]/withdraw.post.ts` (new), `server/api/v1/institutions/[institutionId]/collection-requests/[requestId]/withdraw.post.ts` (new), `pages/agendar/acompanhar/[requestId]/index.vue` (new)
- **Learnings for future iterations:**
  - Public API routes are under `/api/v1/public/` — the auth middleware skips them automatically
  - The BloodBank model does NOT store contact info (phone/email) — only name, slug, logo. Contact info would need to come from hemocione-id
  - For public endpoints needing auth conditionally, manually call `useHemocioneUserAuth(event)` which reads from Authorization header directly
  - `CollectionRequest.requestedByUserId` stores the creating user's ID — use this to verify ownership for institution-side actions
  - Mongoose `.lean()` returns `_id` that can be null in TypeScript — use non-null assertion (`!`) when you've already verified the document exists
  - `statusHistory[].reason` can be `null` from Mongoose — convert to `undefined` with `|| undefined` for strict TypeScript interfaces
---

## 2026-03-07 - US-012
- Implemented async (fire-and-forget) job that adds a new team to all future available dates with `isAllTeams === true`
- Fixed bug in `addTeamToFutureAvailableDates`: was comparing string `date` field with `Date` object — now uses `dayjs().format("YYYY-MM-DD")` string comparison
- Made the job idempotent: checks if team already has a slot in each date before adding
- Added guard for dates with no existing slots (`firstSlot` check)
- Replaced commented-out TODO in team POST route with fire-and-forget `.catch()` pattern
- Files changed: `server/services/availableDate.ts`, `server/api/v1/bloodbank/[bloodbanksLocationId]/teams/index.post.ts`
- **Learnings for future iterations:**
  - The `date` field on AvailableDate is a string (`YYYY-MM-DD`), NOT a Date — always compare with formatted strings, not Date objects
  - Fire-and-forget pattern: call the async function without `await` and chain `.catch()` to log errors — this returns the response immediately while the job runs in background
  - `team._id` from Mongoose can be `ObjectId | null` — use `!.toString()` when you know the team was just created
---

## 2026-03-07 - US-013
- Implemented bulk available dates API endpoint `PUT /api/v1/bloodbank/[bloodbanksLocationId]/available-dates/bulk`
- Added `bulkSetAvailableDates` service function that processes up to 366 entries per call
- Creates dates with default 08:00-17:00 times (in blood bank timezone) when `isAvailable === true` and date doesn't exist
- Soft deletes dates when `isAvailable === false` and no locked slots exist
- Skips past dates, already-existing dates (for creation), and non-existing dates (for deletion)
- Returns summary: `{ created, deleted, skipped, errors[] }`
- Zod validation for the entire payload with date format, boolean, and optional teamId
- Idempotent: duplicate creation attempts are caught via unique index (11000) and counted as skipped
- Files changed: `server/services/availableDate.ts`, `server/api/v1/bloodbank/[bloodbanksLocationId]/available-dates/bulk.put.ts` (new)
- **Learnings for future iterations:**
  - Bulk operations should pre-fetch all needed data (existing dates, teams) to avoid N+1 queries
  - Use `Map` for O(1) lookups when matching entries against existing records
  - Mongoose duplicate key error code is `11000` — catch it for idempotent creates
  - Blood bank timezone is fetched via `getBloodBankByBloodBanksLocationId` — defaults to `America/Sao_Paulo`
  - The `z.string().nullish()` Zod type allows both `null` and `undefined` — useful for optional fields that can be explicitly null
---

## 2026-03-07 - US-014
- Created bulk setup page at `pages/[bloodbankSlug]/calendario/configuracao-massa.vue` — year-view calendar grid for configuring availability in bulk
- Page shows 12 month cards in a responsive grid (1/2/3 columns), each with a mini calendar view
- Each day is clickable to toggle availability; color-coded: green (existing+selected), blue (new), yellow (to remove), red (locked), gray (past)
- Quick actions: "Marcar dias úteis" (select weekdays), "Desmarcar todos", per-month "Marcar/Desmarcar mês" toggles
- Year selector (current + next year), team selector (all teams or specific team)
- Loads existing available dates from API, marks locked slots as non-editable
- On save, computes diff (only sends changes — creates and deletes), calls bulk API (US-013), shows results modal
- Added "Configuração em Massa" button on the calendar page linking to the new page
- Added page title/description in `layouts/default.vue` for the new route
- Files changed: `pages/[bloodbankSlug]/calendario/configuracao-massa.vue` (new), `pages/[bloodbankSlug]/calendario/index.vue`, `layouts/default.vue`
- **Learnings for future iterations:**
  - The existing available dates API (`GET /available-dates?year=X`) returns all dates for the year starting from 3 days in the future — past dates won't be in the response but that's fine since they're not editable anyway
  - `fetchWithAuth` can be used directly in page components (not just store actions) for one-off API calls
  - Nuxt file-based routing: `pages/[bloodbankSlug]/calendario/configuracao-massa.vue` becomes `/[bloodbankSlug]/calendario/configuracao-massa`
  - The layout's `currentPageTitle` computed uses `path.includes()` — more specific paths must be checked BEFORE broader ones (e.g., `/calendario/configuracao-massa` before `/calendario`)
  - `USelect` items use `{ label, value }` format; value can be `null` for "all" options
  - The bulk API endpoint returns `{ created, deleted, skipped, errors[] }` — display in a results modal after save
---
