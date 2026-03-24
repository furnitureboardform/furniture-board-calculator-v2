import React from 'react';
import type { BoxElement, BoxDimensions } from './types';
import './PropertiesPanel.css';

interface Props {
  element: BoxElement | null;
  onChange: (id: string, dims: BoxDimensions) => void;
}

const PropertiesPanel: React.FC<Props> = ({ element, onChange }) => {
  if (!element) {
    return (
      <div className="properties empty">
        <p>Wybierz element, aby edytować jego właściwości.</p>
      </div>
    );
  }

  const handleChange = (axis: keyof BoxDimensions, raw: string) => {
    const value = parseFloat(raw);
    if (isNaN(value) || value <= 0) return;
    onChange(element.id, { ...element.dimensions, [axis]: value });
  };

  return (
    <div className="properties">
      <h2 className="properties-title">{element.name}</h2>
      <div className="properties-hint">
        Przeciągnij uchwyty na modelu lub wpisz wartości
      </div>

      {(['width', 'height', 'depth'] as const).map((axis) => {
        const labels: Record<typeof axis, string> = {
          width: 'Szerokość (X)',
          height: 'Wysokość (Y)',
          depth: 'Głębokość (Z)',
        };
        const colors: Record<typeof axis, string> = {
          width: '#ff4444',
          height: '#44ff44',
          depth: '#4488ff',
        };
        return (
          <div className="prop-row" key={axis}>
            <label className="prop-label" style={{ color: colors[axis] }}>
              {labels[axis]}
            </label>
            <input
              className="prop-input"
              type="number"
              min={0.1}
              step={0.1}
              value={element.dimensions[axis].toFixed(2)}
              onChange={(e) => handleChange(axis, e.target.value)}
            />
            <span className="prop-unit">m</span>
          </div>
        );
      })}

      <div className="prop-row">
        <label className="prop-label" style={{ color: '#aaa' }}>Kolor</label>
        <input
          className="prop-color"
          type="color"
          value={element.color}
          onChange={(e) =>
            onChange(element.id, element.dimensions) /* color handled separately */
          }
        />
      </div>
    </div>
  );
};

export default PropertiesPanel;
