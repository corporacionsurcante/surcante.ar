import React, { useState } from 'react';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DIAS_SEMANA = ['Lu','Ma','Mi','Ju','Vi','Sa','Do'];

function isSameDay(a, b) {
  return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function isToday(d) { return isSameDay(d, new Date()); }
function stripTime(d) { const r = new Date(d); r.setHours(0,0,0,0); return r; }

export default function Calendario({ onChange }) {
  const today = stripTime(new Date());
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [inicio, setInicio] = useState(null);
  const [fin, setFin] = useState(null);
  const [hovered, setHovered] = useState(null);

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  function handleDay(day) {
    const d = stripTime(new Date(viewYear, viewMonth, day));
    if (d < today) return;
    if (!inicio || (inicio && fin)) {
      setInicio(d); setFin(null); setHovered(null);
    } else {
      if (d <= inicio) { setInicio(d); setFin(null); return; }
      setFin(d);
      const fmt = (dt) => dt.toISOString().split('T')[0];
      onChange && onChange({ fechaInicio: fmt(inicio), fechaFin: fmt(d) });
    }
  }

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const offset = (firstDay + 6) % 7;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const activeEnd = fin || hovered;

  function getDayClass(day) {
    const d = stripTime(new Date(viewYear, viewMonth, day));
    const classes = ['cal-day'];
    if (d < today) { classes.push('disabled'); return classes.join(' '); }
    if (isSameDay(d, inicio)) {
      classes.push('selected');
      if (activeEnd && activeEnd > inicio) classes.push('start');
      return classes.join(' ');
    }
    if (activeEnd && isSameDay(d, activeEnd) && inicio) {
      classes.push('selected', 'end');
      return classes.join(' ');
    }
    if (inicio && activeEnd && d > inicio && d < activeEnd) classes.push('in-range');
    if (isToday(d)) classes.push('today');
    return classes.join(' ');
  }

  function formatShort(d) {
    if (!d) return '—';
    return d.getDate() + ' ' + MESES[d.getMonth()].slice(0,3) + ' ' + d.getFullYear();
  }

  const nights = inicio && fin ? Math.round((fin - inicio) / 86400000) : null;

  return (
    <div className="cal-wrap">
      <div className="cal-header">
        <button className="cal-nav" onClick={prevMonth}>‹</button>
        <span className="cal-month">{MESES[viewMonth]} {viewYear}</span>
        <button className="cal-nav" onClick={nextMonth}>›</button>
      </div>
      <div className="cal-grid">
        {DIAS_SEMANA.map(d => <div key={d} className="cal-dow">{d}</div>)}
        {Array(offset).fill(null).map((_, i) => <div key={'e'+i} />)}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => (
          <div
            key={day}
            className={getDayClass(day)}
            onClick={() => handleDay(day)}
            onMouseEnter={() => {
              if (inicio && !fin) {
                const d = stripTime(new Date(viewYear, viewMonth, day));
                if (d > inicio) setHovered(d);
              }
            }}
            onMouseLeave={() => setHovered(null)}
          >
            {day}
          </div>
        ))}
      </div>
      <div className="cal-summary">
        <div className={`cal-chip ${inicio ? 'filled' : ''}`}>
          <div className="cal-chip-label">Salida</div>
          <div className="cal-chip-value">{formatShort(inicio)}</div>
        </div>
        <div className={`cal-chip ${fin ? 'filled' : ''}`}>
          <div className="cal-chip-label">Regreso</div>
          <div className="cal-chip-value">{formatShort(fin)}</div>
        </div>
      </div>
      {nights && (
        <div className="cal-nights">
          {nights} noche{nights !== 1 ? 's' : ''} en destino
        </div>
      )}
    </div>
  );
}
