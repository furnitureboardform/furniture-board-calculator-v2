import React, { useRef, useState } from 'react';
import { useThreeScene } from './useThreeScene';
import { useHistory } from './hooks/useHistory';
import { useDragHandlers } from './hooks/useDragHandlers';
import { useElementActions } from './hooks/useElementActions';
import { useKeyboard } from './hooks/useKeyboard';
import ElementLibrary from './ElementLibrary';
import PropertiesPanel from './PropertiesPanel';
import ModelOverlay from './ModelOverlay';
import OrderModal from './OrderModal';
import './App.css';

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
    handleHasTopRailsChange,
    handleHasSidePanelsChange,
    handleDrawerAdjustFrontChange,
    handleDrawerFrontHeightChange,
    handleDrawerPushToOpenChange,
    handleMaskownicaNiepelnaChange,
    handleFrontNoHandleChange,
    handleShelfSwitchBay,
    handleDividerSwitchSlot,
    handleRotateCabinet,
    handleClearAll,
  } = useElementActions({ setElements, setSelectedId, setMultiSelectedIds, boardSizeRef, dividerYHintRef, dragDeltaRef, detachedFromRef });

  useKeyboard({ selectedId, multiSelectedIds, handleDelete, setElements, undo, redo, handleDividerSwitchSlot });

  useThreeScene(containerRef, {
    elements,
    selectedId,
    multiSelectedIds,
    boardSize: { width: boardSize.width / 1000, depth: boardSize.depth / 1000, height: boardSize.height / 1000 },
    onSelect: handleSelect,
    onMultiSelectToggle: handleMultiSelectToggle,
    onDimensionChange: handleDimensionDrag,
    onPositionChange: handlePositionChange,
    onMultiPositionChange: handleMultiPositionChange,
    onYMove: handleYMove,
    onDragStart: handleDragStart,
  }, showCeilingGrid);

  const selectedElement = elements.find((e) => e.id === selectedId) ?? null;
  const selectedCabHasFront = selectedElement?.type === 'cabinet' &&
    elements.some((e) => e.type === 'front' && e.cabinetId === selectedElement.id);
  const selectedGroupHasFront = selectedElement?.type === 'group' &&
    elements.some((e) => e.type === 'front' && e.cabinetId === selectedElement.id);

  return (
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
          onUngroup={handleUngroup}
          onDelete={handleDelete}
          onClearAll={handleClearAll}
        />
      </aside>

      <main className="viewport" ref={containerRef}>
        <ModelOverlay elements={elements} showCeilingGrid={showCeilingGrid} onToggleCeilingGrid={setShowCeilingGrid} />
        <OrderModal elements={elements} />
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
          onMaskownicaNiepelnaChange={(v) => selectedElement && handleMaskownicaNiepelnaChange(selectedElement.id, v)}
          onFrontNoHandleChange={(v) => selectedElement && handleFrontNoHandleChange(selectedElement.id, v)}
          onShelfSwitchBay={handleShelfSwitchBay}
          onDividerSwitchSlot={handleDividerSwitchSlot}
          onRotate={(id) => handleRotateCabinet(id)}
        />
      </aside>
    </div>
  );
};

export default App;
