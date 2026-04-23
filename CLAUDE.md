# Project: Furniture Board Calculator v2

React + TypeScript app for calculating furniture board cuts and generating order reports.

## Stack
React 19, TypeScript, Vite, Three.js, Firebase/Firestore, pdfmake.

## Architecture

### Data model
Jedna tablica `BoxElement[]` trzymana w `useHistory` (reducer z undo/redo). Każdy element ma `type` (discriminated union) — patrz `src/types.ts`. Elementy dziecięce (front, hdf, leg, plinth, blenda, maskowanica, rearboard, countertop, shelf, drawer, drawerbox, divider, rod, cargo, cornersystem) mają `cabinetId` wskazujące rodzica (szafka, grupa lub drawerbox). `groupIds?: string[]` — szafka może należeć do wielu grup.

### Layer responsibilities
- **`src/types.ts`** — typy domenowe (`BoxElement`, `BoardSize`, opcje z Firestore).
- **`src/constants.ts`** — wymiary fizyczne (grubości płyt, inset-y, dystanse snap). Jedyne źródło prawdy — nie duplikować wartości lokalnie.
- **`src/factories.ts`** — `createBox`, `createShelf`, `createBoard`, `createBoxKuchenny` + `counters` (jedna współdzielona pula liczników nazw). Mutacja przez `counters.X++` przy tworzeniu.
- **`src/geometry.ts`** — czyste funkcje geometryczne (overlap, stack, fit-to-bay, snap-divider, clamp-Y). Bez Three.js.
- **`src/snapAttach.ts`** — magnetyzm drag'n'drop (attach/detach od szafki, push-out kolizji, hysteresis).
- **`src/computeElements.ts`** — funkcje `computeXForCabinet/ForGroup` liczące pochodne wymiary/pozycje elementów związanych z rodzicem. `recomputeGroups` — po mutacji przelicza grupy i ich bindowane elementy w 7-stopniowym pipeline.
- **`src/builders.ts`** — `rebuild*` generujące siatki Three.js z `BoxElement`. Mutuje `THREE.Mesh` przekazany jako `parent`.
- **`src/useThreeScene.ts`** — główny hook renderujący; zarządza sceną, kontrolami kamery, drag/select/ruler.
- **`src/hooks/useElementActions.ts`** — ~30 handlerów dodawania/modyfikowania elementów. Importuje `counters` z `factories.ts`.
- **`src/hooks/useDragHandlers.ts`** — handlery drag (resize boków, przesunięcia X/Z/Y, detach).
- **`src/hooks/useHistory.ts`** — reducer historii. `setElements` commituje (wpis do past), `setElementsRaw` bez wpisu do historii, `snapshotHistory` ręczny snapshot.
- **`src/hooks/useFinishes.ts`, `useHandles.ts`, `useDrawerSystems.ts`, `useCountertops.ts`, `useCargo.ts`, `useCornerSystem.ts`, `useSavedModels.ts`** — streamy/fetch z Firestore.
- **`src/lib/firebase.ts`** — konfiguracja Firestore (klucz publiczny, bezpieczeństwo przez reguły).
- **Komponenty UI**: `App.tsx` (shell), `ElementLibrary.tsx` (lewy panel — katalog + drzewo), `PropertiesPanel.tsx` (prawy panel), `ModelOverlay.tsx` (górne przyciski), `OrderModal.tsx` (raport + PDF).

### Key invariants
- **Jednostki w stanie** — metry (Three.js), jednostki w UI — milimetry. Konwersja na granicy.
- **`PANEL_T = 0.018`** — grubość płyty meblowej. Zawsze `import { PANEL_T } from './constants'`, nie redefiniować lokalnie.
- **Elementy bindowane** (front, hdf, leg, plinth, blenda, maskowanica, rearboard, countertop) są pochodne — ich pozycja/wymiary są przeliczane z rodzica funkcjami `computeXForCabinet`. Modyfikacja ręczna jest ignorowana lub nadpisywana.
- **Grupy** — `type: 'group'` to wirtualny kontener; jego `dimensions`/`position` liczone z członków przez `computeGroupBounds` wywoływane w `recomputeGroups`.
- **Rotacja** — tylko szafki (`cabinet`, `boxkuchenny`) mają `rotationY` (0/90/180/270). Children dziedziczą przez Three.js scene graph.
- **`isCabinetType(t)`** — jedyny właściwy sposób sprawdzenia czy element to szafka (pokrywa `cabinet` i `boxkuchenny`). Nie porównywać `type === 'cabinet'` dla tej semantyki.

### Firestore collections
- `finishes` — okleiny/laminaty/akryle dla korpusów i frontów.
- `hdf` — kolory płyt HDF (plecy szafek).
- `handles` — uchwyty.
- `drawers` — systemy szuflad (Modernbox etc.).
- `countertops` — blaty.
- `cargo` — kosze cargo.
- `cornerSystems` — systemy narożne.
- `models` — zapisane projekty użytkownika (`{name, elements, boardSize, createdAt}`).

### Report flow (OrderModal)
`useOrderData` → dla każdego elementu wylicza `PanelEntry` → grupuje po (wymiary, oklejenie, wykończenie) → generuje sekcje: korpusy, fronty, szuflady, blaty, dodatki (zawiasy, prowadnice, uchwyty, nóżki) → podsumowanie kosztów. PDF przez `pdfmake`.

### Gotchas
- `SNAP_DIST` — dwie różne wartości: `constants.SNAP_DIST = 0.05` (attach), `useThreeScene.SNAP_DIST = 0.08` (drag-snap). Celowe, nie unifikować bez weryfikacji.
- `recomputeGroups` — 7-stopniowy pipeline. Dodając nową kategorię elementu bindowanego do grupy, trzeba ją dopisać tutaj.
- `eslint-disable-next-line react-hooks/exhaustive-deps` w `useDragHandlers.ts` × 9 — świadome, nie „poprawiać".
- `counters` w `factories.ts` — wspólna pula liczników. Importować obiekt, mutacja przez `counters.X++`.

## Response Rules (follow strictly to minimize token usage)

1. **Be terse** — one sentence max per idea. No preamble, no trailing summaries.
2. **No restating the user's request** — jump straight to the solution.
3. **Read before editing** — always read a file before modifying it.
4. **Edit, don't rewrite** — use Edit tool for targeted changes; Write only for new files.
5. **No unsolicited improvements** — fix only what was asked; no cleanup, no extra comments.
6. **No docstrings or type annotations** on untouched code.
7. **No error handling for impossible scenarios** — trust React/TS guarantees.
8. **Parallel tool calls** — run independent reads/searches simultaneously.
9. **Skip confirmations for local reversible edits** — just do it.
10. **Polish language** — respond in Polish unless code/commands require English.
11. **No Co-Authored-By** — never add `Co-Authored-By: Claude` or any Claude/Anthropic attribution to commit messages.
12. **Code review before commit/push** — before every `git commit` or `git push`, run the `simplify` skill to review changed code for quality issues, then fix any found problems before proceeding.
13. **No TodoWrite for simple tasks** — skip TodoWrite when the task fits in 1–3 edits.
14. **No inline explanations** — don't narrate what a code change does unless asked.

## Build Errors Policy
- **Unused variables** — delete them; never suppress with eslint-disable or prefix with `_`.
- **Verify usage before finishing** — after every edit, scan all newly introduced variables (including destructured ones) and confirm each is referenced. If not used, remove it before calling the edit done.
- **Use exact import names** — when referencing an imported constant, always use the exact name from the import statement; never abbreviate or shorten it (e.g. `COUNTERTOP_MAX_SHEET`, not `MAX_SHEET`).
- Fix only the reported lines; don't touch surrounding code.

## Code Conventions
- Components in `src/` with matching `.css` files
- Types defined in `src/types.ts`
- Business logic in `src/builders.ts`, `src/computeElements.ts`, `src/factories.ts`
