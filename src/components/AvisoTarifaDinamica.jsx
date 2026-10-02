import React from 'react';
import { formatARS } from '../utils/calculos';

// Aviso al cliente cuando su viaje cae en un fin de semana largo (tarifa dinámica activa).
// `info` es el resumen que arma resumenTarifa(); si no aplica no muestra nada.
export default function AvisoTarifaDinamica({ info }) {
  if (!info || !info.aplica) return null;
  return (
    <div style={{
      background: '#FFF8E6', border: '1px solid #FFD166', borderRadius: 12,
      padding: '10px 12px', margin: '12px 0', fontSize: 12.5, color: '#7A5200', lineHeight: 1.5,
    }}>
      <div style={{ fontWeight: 800, marginBottom: 2 }}>📅 Tarifa de fin de semana largo</div>
      <div>
        Tus fechas coinciden con un fin de semana largo{info.motivo ? ` (${info.motivo})` : ''}, de muy alta demanda.
        El precio ya incluye el recargo (×{String(info.multiplicador).replace('.', ',')}): {formatARS(info.recargo)} con impuestos.
      </div>
    </div>
  );
}
