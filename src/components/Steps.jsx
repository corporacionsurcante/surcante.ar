import React from 'react';

const STEPS = ['Flota', 'Recorrido', 'Presupuesto'];

export default function Steps({ current }) {
  return (
    <div className="steps">
      {STEPS.map((label, i) => {
        const num = i + 1;
        const state = num < current ? 'done' : num === current ? 'active' : 'idle';
        return (
          <React.Fragment key={num}>
            <div className="step-item">
              <div className={`step-num ${state}`}>
                {state === 'done' ? '✓' : num}
              </div>
              <span className={`step-label ${state === 'active' ? 'active' : ''}`}>{label}</span>
            </div>
            {i < STEPS.length - 1 && <div className="step-sep" />}
          </React.Fragment>
        );
      })}
    </div>
  );
}
