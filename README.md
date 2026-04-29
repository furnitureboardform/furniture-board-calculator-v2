# Furniture Board Calculator v2

Aplikacja React + TypeScript do projektowania mebli w 3D, kalkulacji krojenia płyt meblowych i generowania raportów zamówień.

## Stack

| Warstwa | Technologia |
|---|---|
| Framework | React 19 + TypeScript |
| Build | Vite |
| 3D | Three.js |
| Backend/DB | Firebase Firestore (reguły bezpieczeństwa po stronie serwera) |
| PDF | pdfmake |
| Styl | CSS modules per komponent |

## Uruchamianie

```bash
npm install
npm run dev      # dev server
npm run build    # produkcja
npm run lint     # ESLint
```

## Architektura – mapa plików

```
src/
├── types.ts            # typy domenowe (BoxElement, BoardSize, opcje Firestore)
├── constants.ts        # JEDYNE źródło stałych fizycznych (grubości, inset-y, dystanse)
├── factories.ts        # createBox / createBoxKuchenny / createShelf / createBoard
│                         + counters (wspólna pula liczników nazw — importować obiekt!)
├── geometry.ts         # czyste funkcje geometryczne (overlap, stack, snap, fit-to-bay)
├── snapAttach.ts       # magnetyzm drag'n'drop (attach/detach, push-out, hysteresis)
├── computeElements.ts  # computeXForCabinet/ForGroup — pochodne wymiary/pozycje
│                         recomputeGroups — 7-stopniowy pipeline dla grup
├── builders.ts         # rebuild* — generuje siatki Three.js z BoxElement
├── useThreeScene.ts    # główny hook: scena, kamera, drag/select/ruler
├── App.tsx             # shell aplikacji — składa wszystkie hooki i komponenty
├── ElementLibrary.tsx  # lewy panel: katalog elementów + drzewo sceny
├── PropertiesPanel.tsx # prawy panel: właściwości zaznaczonego elementu
├── ModelOverlay.tsx    # górne przyciski (widoki, linijka, zapis/odczyt)
├── OrderModal.tsx      # raport + eksport PDF
└── hooks/
    ├── useHistory.ts         # reducer undo/redo; setElements = commit, setElementsRaw = bez wpisu
    ├── useElementActions.ts  # ~30 handlerów dodawania/modyfikowania elementów
    ├── useDragHandlers.ts    # handlery drag (resize boków, X/Z/Y, detach)
    ├── useFinishes.ts        # stream oklejin/laminatów/akryli z Firestore
    ├── useHandles.ts         # stream uchwytów z Firestore
    ├── useDrawerSystems.ts   # stream systemów szuflad (Modernbox etc.)
    ├── useCountertops.ts     # stream blatów z Firestore
    ├── useCargo.ts           # stream koszy cargo z Firestore
    ├── useCornerSystem.ts    # stream systemów narożnych z Firestore
    ├── useSavedModels.ts     # zapis/odczyt projektów (kolekcja models w Firestore)
    └── useKeyboard.ts        # skróty klawiszowe
```

## Model danych

Jedna tablica `BoxElement[]` trzymana w `useHistory`. Każdy element ma discriminated union `type`.

### Typy elementów

| type | opis |
|---|---|
| `cabinet` | szafka wolnostojąca (zawsze ma `rotationY`) |
| `boxkuchenny` | szafka kuchenna (dolna lub wisząca `isWall=true`, narożna `isCorner=true`) |
| `shelf` | półka wewnątrz szafki |
| `board` | wolnostojąca płyta |
| `front` | front szafki (pochodny) |
| `hdf` | plecy z płyty HDF 3 mm (pochodny) |
| `rearboard` | plecy z płyty 18 mm (pochodny) |
| `drawer` | szuflada (systemowa lub ręczna) |
| `drawerbox` | skrzynka szuflad z własną geometrią |
| `divider` | pionowy separator wewnątrz szafki |
| `leg` | nóżki (4 narożniki jako jeden element, pochodny) |
| `plinth` | cokół frontu (pochodny) |
| `blenda` | maskowanie boczne/górne (pochodny, `blendaSide`: left/right/top) |
| `maskowanica` | panel maskujący (pochodny, `maskownicaSide`: left/right/bottom/top) |
| `countertop` | blat (pochodny) |
| `cargo` | kosz cargo (pochodny) |
| `cornersystem` | system narożny (pochodny) |
| `rod` | drążek |
| `group` | wirtualny kontener; `dimensions`/`position` liczone z członków |

Elementy **pochodne** (front, hdf, leg, plinth, blenda, maskowanica, rearboard, countertop) mają `cabinetId` wskazujące rodzica. Ich pozycja/wymiary są w pełni determinowane przez rodzica — ręczne modyfikacje są nadpisywane przez `recomputeGroups`.

### Pola BoxElement (wybrane niuanse)

- `groupIds?: string[]` — szafka może należeć do wielu grup jednocześnie
- `rotationY?: 0 | 90 | 180 | 270` — tylko szafki; dzieci dziedziczą przez scene graph Three.js
- `blendaScope?: 'cabinet' | 'group'` — odróżnia blendę przypisaną do szafki od grupowej
- `stretchWithLegs?: boolean` — boczna blenda/maskowanica rozciąga się na wysokość nóżek/cokołu
- `cornerLeftArmDepth` / `cornerRightArmWidth` — niezależne długości ramion narożnej szafki wiszącej
- `hdfCornerW` / `hdfCornerD` — geometria drugiego HDF-panela narożnej szafki wiszącej

## Kluczowe stałe (`constants.ts`)

```ts
PANEL_T = 0.018          // grubość płyty meblowej 18 mm (ZAWSZE importować, nigdy redefiniować)
HDF_T = 0.003            // grubość HDF 3 mm
FRONT_INSET = 0.002      // 2 mm luz po każdej stronie frontu
HDF_INSET = 0.002        // 2 mm inset HDF
PLINTH_INSET = 0.002     // 2 mm inset cokołu
SNAP_DIST = 0.05         // snap side-by-side (5 cm) — NIE mylić z useThreeScene.SNAP_DIST = 0.08
STACK_OVERLAP = 0.10     // 10 cm overlap w XZ żeby wyzwolić stacking
DETACH_DIST = 0.08       // 80 mm przesunięcie drag żeby odpiąć od szafki
HYSTERESIS_DIST = 0.15   // 150 mm przed re-snapem do tej samej szafki
DRAWER_RAIL_CLEARANCE = 0.0125  // 12.5 mm luz po stronie na prowadnice szuflad
COUNTERTOP_MAX_SHEET = 4.1      // maks. szerokość arkusza blatu (4100 mm)
DEFAULT_HDF_FINISH_LABEL = 'Biały Korpusowy 0110'
BOX_OVERLAY_Y_OFFSET = 0.016    // 16 mm opuszczenie frontu overlay
```

**Jednostki:** stan = metry (Three.js); UI = milimetry. Konwersja na granicy komponentów.

## Pipeline `recomputeGroups` (7 kroków)

Wywoływany po każdej mutacji elementów. Kolejność jest istotna — nowe typy elementów bindowanych do grupy trzeba tu dopisać.

1. Przelicz bounds grupy z jej członków (`computeGroupBounds`)
2. Przelicz fronty grup (`computeFrontForGroup`)
3. Przelicz blendas grup (`computeBlendaForGroup`, `computeBlendaTopForGroup`)
4. Przelicz maskownice grup (`computeMaskowanicaForGroup`, poziome)
5. Przelicz cokoły grup (`computePlinthsForGroup`)
6. Przelicz blaty grup (`computeCountertopForGroup`)
7. Przelicz corgi/systemy narożne grup

## Firestore – kolekcje

| Kolekcja | Zawartość |
|---|---|
| `finishes` | okleiny, laminaty, akryle (korpus i front); pola: `id, label, colorHex?, price?` |
| `hdf` | kolory płyt HDF (plecy); pola: `id, label, colorHex?` |
| `handles` | uchwyty; pola: `id, label, price?` |
| `drawers` | systemy szuflad (Modernbox etc.); pola: `id, label, brand, depth, height, price` |
| `countertops` | blaty; pola: `id, label, colorHex?, thicknessMm?, price?` |
| `cargo` | kosze cargo; pola: `id, label, widthMm, heightMm, depthMm, heightFromMm, heightToMm, pricePln?` |
| `cornerSystems` | systemy narożne; pola: `id, label, side, modelType?, widthMm, depthMm, heightFromMm, heightToMm, pricePln?` |
| `models` | zapisane projekty; pola: `name, elements, boardSize, createdAt` |

Konfiguracja Firebase: `src/lib/firebase.ts` (klucz publiczny; bezpieczeństwo przez reguły Firestore).

## Raport zamówienia (`OrderModal.tsx`)

`useOrderData` hook → dla każdego elementu wylicza `PanelEntry` → grupuje po (wymiary, oklejenie, wykończenie) → sekcje:

1. Korpusy — panele boczne, górne/dolne, HDF plecy
2. Fronty — frontowe płyty, fronty szuflad
3. Szuflady — prowadnice, systemy szuflad
4. Blaty — z podziałem na arkusze ≤ 4100 mm
5. Dodatki — zawiasy (13 PLN/szt.), prowadnice (104 / 123 z PTO PLN), uchwyty, nóżki (6 PLN/szt.)
6. Podsumowanie kosztów

PDF przez pdfmake (`pdfmake/build/pdfmake` + `vfs_fonts`).

### Cennik (hardcoded w OrderModal.tsx)

```
Cięcie płyty:     6 PLN/m
Cięcie blatu:     9 PLN/m
Okleina krawędzi: 6 PLN/m
Okleina:          1 PLN/m
Drążek:           15 PLN
Zawias:           13 PLN
Prowadnica:      104 PLN  (123 PLN z PTO)
Tipon:            72 PLN  (16 PLN na front)
Złączka:          8 PLN
Nóżka:            6 PLN
Kołek wisz.:      5 PLN
```

## Znane pułapki (Gotchas)

- `SNAP_DIST` istnieje w dwóch miejscach z różnymi wartościami: `constants.ts = 0.05` (attach), `useThreeScene.ts = 0.08` (drag-snap). **Celowe — nie unifikować.**
- `isCabinetType(t)` — jedyny właściwy sposób sprawdzenia czy element to szafka (obejmuje `cabinet` i `boxkuchenny`). Nie pisać `type === 'cabinet'` dla tej semantyki.
- `counters` w `factories.ts` — wspólna pula. Importować obiekt, mutować przez `counters.X++`.
- `eslint-disable-next-line react-hooks/exhaustive-deps` w `useDragHandlers.ts` × 9 — świadome, nie poprawiać.
- Elementy pochodne bindowane do grupy: po dodaniu nowej kategorii trzeba dopisać ją do `recomputeGroups`.
- `DEFAULT_FINISH_ID = 'A2T61OgxOb5IpWNoMzsW'` — hardcoded ID domyślnej okleiny w `factories.ts`.

## Historia zmian (ostatnie)

- Narożna szafka wisząca: niezależne długości ramion L/P (`cornerLeftArmDepth`, `cornerRightArmWidth`)
- Narożny słupek zastępujący wewnętrzną listwę łączącą w szafce narożnej
- Nóżki cargo, systemy narożne z filtrem modelType i obsługą strony `both`
- Blenda z niestandardową głębokością, obsługa blend dla boxkuchenny
- Podziałki blatów > 4100 mm w raporcie i widoku 3D
- Obraz drag: szuflada z animacją otwierania w 3D, front 30 mm opuszczony
