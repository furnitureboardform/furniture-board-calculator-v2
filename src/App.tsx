import React, { useRef, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useThreeScene } from './useThreeScene';
import { HDF_GRAY } from './builders';
import { useFinishes } from './hooks/useFinishes';
import { useHandles } from './hooks/useHandles';
import { useDrawerSystems } from './hooks/useDrawerSystems';
import { useCountertops } from './hooks/useCountertops';
import { useCargo } from './hooks/useCargo';
import { useCornerSystem } from './hooks/useCornerSystem';
import { useHistory } from './hooks/useHistory';
import { useDragHandlers } from './hooks/useDragHandlers';
import { useElementActions } from './hooks/useElementActions';
import { useKeyboard } from './hooks/useKeyboard';
import { useSavedModels } from './hooks/useSavedModels';
import type { BoardSize } from './types';
import { DEFAULT_COUNTERTOP_THICKNESS_MM, DEFAULT_HDF_FINISH_LABEL } from './constants';
import ElementLibrary from './ElementLibrary';
import PropertiesPanel from './PropertiesPanel';
import ModelOverlay from './ModelOverlay';
import OrderModal from './OrderModal';
import './App.css';

const CURRENT_MODEL_KEY = 'currentModelId';

const App: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { elements, setElements, setElementsRaw, snapshotHistory, undo, redo, canUndo, canRedo } = useHistory();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [multiSelectedIds, setMultiSelectedIds] = useState<string[]>([]);
  const [boardSize, setBoardSize] = useState<{ width: number; depth: number; height: number }>({ width: 6000, depth: 6000, height: 2600 });
  const [showCeilingGrid, setShowCeilingGrid] = useState(false);
  const boardSizeRef = useRef(boardSize);
  React.useEffect(() => { boardSizeRef.current = boardSize; }, [boardSize]);
  const dividerYHintRef = useRef<Map<string, number>>(new Map());
  const dragDeltaRef = useRef<Map<string, { dx: number; dz: number }>>(new Map());
  const detachedFromRef = useRef<Map<string, string>>(new Map());
  const finishes = useFinishes();
  const hdfFinishes = useFinishes('hdf', false);
  const handles = useHandles();
  const drawerSystems = useDrawerSystems();
  const countertops = useCountertops();
  const cargoOptions = useCargo();
  const cornerSystemOptions = useCornerSystem();
  const finishColorMap = useMemo(() => new Map([...finishes, ...hdfFinishes].filter(f => f.colorHex).map(f => [f.id, f.colorHex!])), [finishes, hdfFinishes]);
  const defaultHdfFinishId = useMemo(() => (hdfFinishes.find(f => f.label === DEFAULT_HDF_FINISH_LABEL) ?? hdfFinishes[0])?.id, [hdfFinishes]);
  const countertopColorMap = useMemo(() => new Map(countertops.filter(c => c.colorHex).map(c => [c.id, c.colorHex!])), [countertops]);
  const { savedModels, loading: modelsLoading, saveModel, deleteModel, overwriteModel } = useSavedModels();
  const [rulerMode, setRulerMode] = useState(false);
  const [rulerPoints, setRulerPoints] = useState<{ x: number; y: number; z: number }[]>([]);
  const [currentModelId, setCurrentModelId] = useState<string | null>(() => localStorage.getItem(CURRENT_MODEL_KEY));
  const [ctrlSAction, setCtrlSAction] = useState<'new' | 'overwrite' | null>(null);
  const [ctrlSName, setCtrlSName] = useState('');
  const [ctrlSSaving, setCtrlSSaving] = useState(false);
  const setAndPersistModelId = (id: string | null) => {
    if (id) localStorage.setItem(CURRENT_MODEL_KEY, id);
    else localStorage.removeItem(CURRENT_MODEL_KEY);
    setCurrentModelId(id);
  };
  const handleSaveModel = async (name: string) => {
    const id = await saveModel(name, elements, boardSize);
    setAndPersistModelId(id);
  };
  const handleLoadModel = (model: { id: string; elements: typeof elements; boardSize?: BoardSize }) => {
    setElements(model.elements);
    if (model.boardSize) setBoardSize(model.boardSize);
    setAndPersistModelId(model.id);
  };
  const handleOverwriteModel = async (id: string) => { await overwriteModel(id, elements, boardSize); };
  const handleDeleteModel = (id: string) => {
    if (id === currentModelId) setAndPersistModelId(null);
    deleteModel(id);
  };
  const handleRulerClick = (pt: { x: number; y: number; z: number }) => {
    setRulerPoints((prev) => {
      if (prev.length >= 2) return [pt];
      if (prev.length === 1) {
        const a = prev[0];
        const dx = Math.abs(pt.x - a.x);
        const dy = Math.abs(pt.y - a.y);
        const dz = Math.abs(pt.z - a.z);
        const max = Math.max(dx, dy, dz);
        const b = max === dx ? { x: pt.x, y: a.y, z: a.z }
                : max === dy ? { x: a.x, y: pt.y, z: a.z }
                :               { x: a.x, y: a.y, z: pt.z };
        return [a, b];
      }
      return [pt];
    });
  };

  const toggleRuler = () => {
    if (rulerMode) setRulerPoints([]);
    setRulerMode((prev) => !prev);
  };

  const handleCtrlSave = () => {
    if (currentModelId) {
      setCtrlSAction('overwrite');
    } else {
      setCtrlSName('');
      setCtrlSAction('new');
    }
  };
  const withCtrlSSaving = async (fn: () => Promise<void>) => {
    setCtrlSSaving(true);
    try {
      await fn();
      setCtrlSAction(null);
    } finally {
      setCtrlSSaving(false);
    }
  };
  const handleCtrlSSaveNew = () => {
    if (!ctrlSName.trim()) return;
    withCtrlSSaving(() => handleSaveModel(ctrlSName.trim()));
  };
  const handleCtrlSOverwrite = () => {
    if (!currentModelId) return;
    withCtrlSSaving(() => handleOverwriteModel(currentModelId));
  };

  const {
    handleDimensionDrag,
    handleDimensionInput,
    handlePositionChange,
    handleMultiPositionChange,
    handleYChange,
    handleDividerXChange,
    handleYMove,
    handleDragStart,
  } = useDragHandlers({ setElements, setElementsRaw, snapshotHistory, boardSizeRef, dividerYHintRef, dragDeltaRef, detachedFromRef });

  const {
    handleSelect,
    handleMultiSelectToggle,
    handleAddShelfToCabinet,
    handleAddDrawerToCabinet,
    handleAddDrawerboxToCabinet,
    handleAddDividerToCabinet,
    handleAddFrontToCabinet,
    handleAddDoubleFrontToCabinet,
    handleAddLegsToCabinet,
    handleAddLegsToBoxKuchenny,
    handleAddHdfToCabinet,
    handleAddPlinthToCabinet,
    handleAddPlinthToGroup,
    handleAddBlendaToCabinet,
    handleAddBlendaToGroup,
    handleAddMaskowanicaToCabinet,
    handleAddMaskowanicaToGroup,
    handleAddRodToCabinet,
    handleAdd,
    handleDelete,
    handleUngroup,
    handleGroup,
    handleAddFrontToGroup,
    handleAddDoubleFrontToGroup,
    handleOpenFrontsChange,
    handleHasBottomPanelChange,
    handleHasRearHdfChange,
    handleAddRearboardToCabinet,
    handleHasTopRailsChange,
    handleHasSidePanelsChange,
    handleDrawerAdjustFrontChange,
    handleDrawerFrontHeightChange,
    handleDrawerPushToOpenChange,
    handleDrawerOpenChange,
    handleDrawerExternalFrontChange,
    handleDrawerInsetChange,
    handleMaskownicaNiepelnaChange,
    handleStretchWithLegsChange,
    handleFrontNoHandleChange,
    handleFrontTipOnChange,
    handleFrontWysowChange,
    handleFrontLoweredChange,
    handleShelfSwitchBay,
    handleDividerSwitchSlot,
    handleRotateCabinet,
    handleAddCountertopToCabinet,
    handleAddCountertopToGroup,
    handleAddCargoToBox,
    handleCargoIdChange,
    handleAddCornerSystemToBox,
    handleCornerSystemIdChange,
    handleCornerSystemSideChange,
    handleCornerSystemModelTypeChange,
    handleClearAll,
  } = useElementActions({ setElements, setSelectedId, setMultiSelectedIds, boardSizeRef, dividerYHintRef, dragDeltaRef, detachedFromRef, finishColorMap, defaultHdfFinishId, drawerSystems });

  useKeyboard({ selectedId, multiSelectedIds, handleDelete, elements, setElements, setMultiSelectedIds, undo, redo, handleDividerSwitchSlot, onCtrlSave: handleCtrlSave });

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && rulerMode) { setRulerMode(false); setRulerPoints([]); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rulerMode]);

  useThreeScene(containerRef, {
    elements,
    selectedId,
    multiSelectedIds,
    boardSize: { width: boardSize.width / 1000, depth: boardSize.depth / 1000, height: boardSize.height / 1000 },
    finishColorMap,
    countertopColorMap,
    onSelect: handleSelect,
    onMultiSelectToggle: handleMultiSelectToggle,
    onDimensionChange: handleDimensionDrag,
    onPositionChange: handlePositionChange,
    onMultiPositionChange: handleMultiPositionChange,
    onYMove: handleYMove,
    onDragStart: handleDragStart,
    rulerMode,
    rulerPoints,
    onRulerClick: handleRulerClick,
  }, showCeilingGrid);

  const handleHandleChange = (id: string, handleId: string | undefined) => {
    setElements((prev) => prev.map((e) => {
      if (e.id === id && (e.type === 'front' || e.type === 'drawer')) return { ...e, handleId };
      if (e.type === 'front' && e.cabinetId === id) return { ...e, handleId };
      return e;
    }));
  };

  const handleFinishChange = (id: string, finishId: string | undefined) => {
    setElements((prev) => prev.map((e) => {
      if (e.id !== id) return e;
      if (e.type === 'hdf') {
        const hex = finishId ? finishColorMap.get(finishId) : undefined;
        return { ...e, finishId, color: hex ?? HDF_GRAY };
      }
      return { ...e, finishId };
    }));
  };

  const handleDrawerFrontFinishChange = (id: string, finishId: string | undefined) => {
    setElements((prev) => prev.map((e) => e.id === id ? { ...e, frontFinishId: finishId } : e));
  };

  const handleCountertopTypeChange = (id: string, countertopId: string | undefined) => {
    const ct = countertops.find((c) => c.id === countertopId);
    const thickness = ct ? ct.thicknessMm / 1000 : DEFAULT_COUNTERTOP_THICKNESS_MM / 1000;
    setElements((prev) => prev.map((e) =>
      e.id === id ? { ...e, countertopId, dimensions: { ...e.dimensions, height: thickness } } : e
    ));
  };

  const rulerDistance = rulerPoints.length === 2
    ? Math.round(Math.sqrt(
        (rulerPoints[1].x - rulerPoints[0].x) ** 2 +
        (rulerPoints[1].y - rulerPoints[0].y) ** 2 +
        (rulerPoints[1].z - rulerPoints[0].z) ** 2
      ) * 1000 * 10) / 10
    : null;

  const selectedElement = elements.find((e) => e.id === selectedId) ?? null;
  const selectedCabHasFront = selectedElement?.type === 'cabinet' &&
    elements.some((e) => e.type === 'front' && e.cabinetId === selectedElement.id);
  const selectedGroupHasFront = selectedElement?.type === 'group' &&
    elements.some((e) => e.type === 'front' && e.cabinetId === selectedElement.id);

  return (
    <>
    <div className="app">
      <aside className="sidebar left">
        <ElementLibrary
          elements={elements}
          selectedId={selectedId}
          multiSelectedIds={multiSelectedIds}
          boardSize={boardSize}
          onBoardSizeChange={setBoardSize}
          onSelect={handleSelect}
          onMultiSelectToggle={handleMultiSelectToggle}
          onGroup={handleGroup}
          onAdd={handleAdd}
          onAddShelfToCabinet={handleAddShelfToCabinet}
          onAddDrawerToCabinet={handleAddDrawerToCabinet}
          onAddDrawerboxToCabinet={handleAddDrawerboxToCabinet}
          onAddDividerToCabinet={handleAddDividerToCabinet}
          onAddFrontToCabinet={handleAddFrontToCabinet}
          onAddDoubleFrontToCabinet={handleAddDoubleFrontToCabinet}
          onAddRodToCabinet={handleAddRodToCabinet}
          onAddLegsToCabinet={handleAddLegsToCabinet}
          onAddLegsToBoxKuchenny={handleAddLegsToBoxKuchenny}
          onAddHdfToCabinet={handleAddHdfToCabinet}
          onAddPlinthToCabinet={handleAddPlinthToCabinet}
          onAddPlinthToGroup={handleAddPlinthToGroup}
          onAddBlendaToCabinet={handleAddBlendaToCabinet}
          onAddBlendaToGroup={handleAddBlendaToGroup}
          onAddFrontToGroup={handleAddFrontToGroup}
          onAddDoubleFrontToGroup={handleAddDoubleFrontToGroup}
          onAddMaskowanicaToCabinet={handleAddMaskowanicaToCabinet}
          onAddMaskowanicaToGroup={handleAddMaskowanicaToGroup}
          onAddRearboardToCabinet={handleAddRearboardToCabinet}
          onAddCountertopToCabinet={handleAddCountertopToCabinet}
          onAddCountertopToGroup={handleAddCountertopToGroup}
          onAddCargoToBox={handleAddCargoToBox}
          cargoOptions={cargoOptions}
          onAddCornerSystemToBox={handleAddCornerSystemToBox}
          cornerSystemOptions={cornerSystemOptions}
          onUngroup={handleUngroup}
          onDelete={handleDelete}
          onClearAll={handleClearAll}
        />
      </aside>

      <main className="viewport" ref={containerRef}>
        <ModelOverlay
          elements={elements}
          showCeilingGrid={showCeilingGrid}
          onToggleCeilingGrid={setShowCeilingGrid}
          savedModels={savedModels}
          modelsLoading={modelsLoading}
          onSaveModel={handleSaveModel}
          onLoadModel={handleLoadModel}
          onDeleteModel={handleDeleteModel}
          onOverwriteModel={handleOverwriteModel}
          rulerMode={rulerMode}
          rulerPointCount={rulerPoints.length}
          rulerDistance={rulerDistance}
          onToggleRuler={toggleRuler}
        />
        <OrderModal elements={elements} handles={handles} drawerSystems={drawerSystems} countertops={countertops} cargoOptions={cargoOptions} cornerSystemOptions={cornerSystemOptions} />
        <div className="undo-redo-fab">
          <button
            className="undo-redo-btn"
            onClick={undo}
            disabled={!canUndo}
            title="Cofnij (Ctrl+Z)"
          >&#8592;</button>
          <button
            className="undo-redo-btn"
            onClick={redo}
            disabled={!canRedo}
            title="Przywróć (Ctrl+Y)"
          >&#8594;</button>
        </div>
      </main>

      <aside className="sidebar right">
        <PropertiesPanel
          element={selectedElement}
          elements={elements}
          finishes={finishes}
          hdfFinishes={hdfFinishes}
          onChange={handleDimensionInput}
          onDividerXChange={handleDividerXChange}
          onYChange={handleYChange}
          hasFront={selectedCabHasFront || selectedGroupHasFront}
          onOpenFrontsChange={(open) => selectedElement && handleOpenFrontsChange(selectedElement.id, open)}
          onHasBottomPanelChange={(has) => selectedElement && handleHasBottomPanelChange(selectedElement.id, has)}
          onHasRearHdfChange={(has) => selectedElement && handleHasRearHdfChange(selectedElement.id, has)}
          onHasTopRailsChange={(has) => selectedElement && handleHasTopRailsChange(selectedElement.id, has)}
          onHasSidePanelsChange={(has) => selectedElement && handleHasSidePanelsChange(selectedElement.id, has)}
          onDrawerAdjustFrontChange={(adj) => selectedElement && handleDrawerAdjustFrontChange(selectedElement.id, adj)}
          onDrawerFrontHeightChange={(h) => selectedElement && handleDrawerFrontHeightChange(selectedElement.id, h)}
          onDrawerPushToOpenChange={(v) => selectedElement && handleDrawerPushToOpenChange(selectedElement.id, v)}
          onDrawerOpenChange={(v) => selectedElement && handleDrawerOpenChange(selectedElement.id, v)}
          onDrawerExternalFrontChange={(v) => selectedElement && handleDrawerExternalFrontChange(selectedElement.id, v)}
          onDrawerInsetChange={(v) => selectedElement && handleDrawerInsetChange(selectedElement.id, v)}
          onMaskownicaNiepelnaChange={(v) => selectedElement && handleMaskownicaNiepelnaChange(selectedElement.id, v)}
          onStretchWithLegsChange={(v) => selectedElement && handleStretchWithLegsChange(selectedElement.id, v)}
          onFrontNoHandleChange={(v) => selectedElement && handleFrontNoHandleChange(selectedElement.id, v)}
          onFrontTipOnChange={(v) => selectedElement && handleFrontTipOnChange(selectedElement.id, v)}
          onFrontWysowChange={(v) => selectedElement && handleFrontWysowChange(selectedElement.id, v)}
          onFrontLoweredChange={(v) => selectedElement && handleFrontLoweredChange(selectedElement.id, v)}
          onShelfSwitchBay={handleShelfSwitchBay}
          onDividerSwitchSlot={handleDividerSwitchSlot}
          onRotate={(id) => handleRotateCabinet(id)}
          onFinishChange={handleFinishChange}
          onDrawerFrontFinishChange={handleDrawerFrontFinishChange}
          handles={handles}
          onHandleChange={handleHandleChange}
          drawerSystems={drawerSystems}
          countertops={countertops}
          onCountertopTypeChange={handleCountertopTypeChange}
          cargoOptions={cargoOptions}
          onCargoIdChange={handleCargoIdChange}
          cornerSystemOptions={cornerSystemOptions}
          onCornerSystemIdChange={handleCornerSystemIdChange}
          onCornerSystemSideChange={handleCornerSystemSideChange}
          onCornerSystemModelTypeChange={handleCornerSystemModelTypeChange}
        />
      </aside>
    </div>

    {ctrlSAction === 'new' && createPortal(
      <div className="clear-all-overlay" onClick={() => setCtrlSAction(null)}>
        <div className="clear-all-dialog" onClick={(e) => e.stopPropagation()}>
          <p>Podaj nazwę projektu:</p>
          <input
            className="mo-models-input"
            type="text"
            placeholder="Nazwa projektu..."
            value={ctrlSName}
            autoFocus
            onChange={(e) => setCtrlSName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCtrlSSaveNew(); if (e.key === 'Escape') setCtrlSAction(null); }}
          />
          <div className="clear-all-actions" style={{ marginTop: '16px' }}>
            <button className="clear-all-cancel" onClick={() => setCtrlSAction(null)}>Anuluj</button>
            <button
              className="clear-all-confirm"
              style={{ background: '#1a2d25', borderColor: '#4ec9b0', color: '#4ec9b0' }}
              onClick={handleCtrlSSaveNew}
              disabled={ctrlSSaving || !ctrlSName.trim()}
            >
              {ctrlSSaving ? '...' : 'Zapisz'}
            </button>
          </div>
        </div>
      </div>,
      document.body
    )}

    {ctrlSAction === 'overwrite' && createPortal(
      <div className="clear-all-overlay" onClick={() => setCtrlSAction(null)}>
        <div className="clear-all-dialog" onClick={(e) => e.stopPropagation()}>
          <p>Nadpisać projekt „{savedModels.find((m) => m.id === currentModelId)?.name ?? ''}" aktualnym stanem?</p>
          <div className="clear-all-actions">
            <button className="clear-all-cancel" onClick={() => setCtrlSAction(null)}>Anuluj</button>
            <button
              className="clear-all-confirm"
              style={{ background: '#1a2d25', borderColor: '#4ec9b0', color: '#4ec9b0' }}
              onClick={handleCtrlSOverwrite}
              disabled={ctrlSSaving}
            >
              {ctrlSSaving ? '...' : 'Nadpisz'}
            </button>
          </div>
        </div>
      </div>,
      document.body
    )}
    </>
  );
};

export default App;
