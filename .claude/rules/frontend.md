---
paths:
  - "apps/web/**"
---

# Frontend rules (apps/web)

Complements CLAUDE.md (stack, `no any`, Zod as source of truth, kebab-case files) and `readability.md` (project-wide). Where they overlap, CLAUDE.md wins.

## Component responsibilities

There is no router: screens are switched in `App.tsx`. Responsibilities split by layer:

- **Shared components (`src/components/`)** — 100% "dumb" and domain-agnostic. No API calls, no TanStack Query hooks, no feature imports. Props in, callbacks out (`onSelect`, `onChange`…). They are the app's design system. A component that reads or writes server state is a feature widget, even if several features use it (e.g. the folder picker lives in `features/folders/`).
- **Feature components (`src/features/<feature>/`)** — two kinds coexist:
  - **Connected widgets** (e.g. `SourcesManager`, `ResolvePanel`) may call their own queries and mutations and own their local state. This keeps parents from becoming god components and avoids prop-drilling. Rules:
    1. Single responsibility: the widget handles only its own functional area.
    2. If state/effect logic grows past ~100–150 lines, extract a dedicated hook in a sibling `use-<name>.ts`.
  - **Presentational views** (e.g. `GameRow`, `SuggestionRow`) — no API calls; data and handlers come through props, so they are trivial to test.

## Business logic and pure functions

- Components orchestrate UI; they don't compute. Business rules, formatting and non-trivial state derivations go into pure, unit-tested functions.
- **Co-location:** a helper used by a single component lives next to it in its own kebab-case file (e.g. `build-items.ts` beside `ResolvePanel.tsx`). Move it to `src/lib/` only once a second feature needs it.
- **No god files:** split helpers by responsibility. A file over ~500 lines must be split **when you create or substantially modify it**. Known existing debt, not to refactor unprompted: `App.tsx` (~940 lines), `features/downloader/DownloadManager.tsx` (~710 lines).

## TanStack Query

### Query keys

- New code builds query keys from a single factory in `src/lib/query-keys.ts` — never inline string arrays. Invalidations use the same factory, so a key cannot drift between the query and its invalidation.
- Existing inline keys (`['dats']`, `['archive-sources', system]`, `['settings']`…) migrate to the factory when the file is touched; no bulk migration unprompted.

### Cache policy

**Absolute rule: `gcTime >= staleTime`.** Otherwise data still considered fresh gets garbage-collected while inactive, and coming back triggers a full refetch and an unexpected loading state.

| Data category | Examples here | `staleTime` | `gcTime` | Notes |
| --- | --- | --- | --- | --- |
| Immutable for the session | games of a loaded DAT (a reload gets a new id), game details pages, system icons | `Infinity` | `Infinity` | `refetchOnWindowFocus: false` |
| Slow-moving remote | Fresh1G1R DAT listing (GitHub) | minutes | ≥ `staleTime` | |
| Transactional / user-edited | settings, archive sources, DAT list, directory listing | `0` up to a few seconds | ≥ `staleTime` (default 5 min is fine) | invalidate after every mutation |
| Live progress | download progress | — | — | streamed over SSE (`EventSource`), not React Query; don't poll it |

### Mutations

- After every write (`POST`/`PUT`/`DELETE`), resync the related queries in the mutation's own `onSuccess` — never leave it to the caller. Either:
  - `setQueryData(key, response)` when the server returns the full updated resource (settings), saving a round-trip, or
  - `invalidateQueries` otherwise, using factory keys:

```ts
const queryClient = useQueryClient();

const { mutate } = useMutation({
  mutationFn: addSource,
  onSuccess: () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.archiveSources(system) });
  },
});
```

## TypeScript

- Use `import type { … }` whenever an import is only a type or interface.
- Don't constrain a generic `<T>` with `Record<string, unknown>`: interfaces and Zod-inferred object types have no index signature and would be rejected. Constrain only on what the generic actually reads (e.g. `T extends { id: string }`).

## Tests (Vitest + Testing Library)

- Tests are **co-located**: `GameList.tsx` → `GameList.test.tsx` in the same folder. Cross-cutting tests go in `src/__tests__/`.
- Every new component, helper or hook comes with its test file.
- Presentational components must be testable without mocking queries: inject data and callbacks through props. Connected widgets are tested with a real `QueryClient` and a mocked `fetch`/API layer.

## Output directives

When writing frontend code:

1. Never produce large catch-all files.
2. Type everything strictly.
3. Inject data through props for presentational components, or encapsulate it in connected feature widgets.
4. Keep it DRY, clean and readable.
