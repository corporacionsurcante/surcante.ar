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
  const [mismodia, setMismodia] = useState(false);
  const [hovered, setHovered] = useState(null);
  const [horaInicio, setHoraInicio] = useState('08:00');
  const [horaFin, setHoraFin] = useState('20:00');

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  function fmt(dt) { return dt ? dt.toISOString().split('T')[0] : ''; }

  function notifyChange(i, f, md, hi, hf) {
    if (!i) return;
    onChange && onChange({
      fechaInicio: fmt(i),
      fechaFin: fmt(f || i),
      mismodia: md,
      horaInicio: md ? hi : null,
      horaFin: md ? hf : null,
    });
  }

  function handleDay(day) {
    const d = stripTime(new Date(viewYear, viewMonth, day));
    if (d < today) return;

    if (!inicio || (inicio && fin && !mismodia)) {
      // Primer click — seleccionar inicio
      setInicio(d); setFin(null); setHovered(null); setMismodia(false);
      notifyChange(d, null, false, horaInicio, horaFin);
    } else if (isSameDay(d, inicio)) {
      // Click en el mismo día → viaje en el día
      setFin(d); setMismodia(true);
      notifyChange(d, d, true, horaInicio, horaFin);
    } else if (d > inicio) {
      // Segundo click distinto → viaje multi día
      setFin(d); setMismodia(false);
      notifyChange(inicio, d, false, horaInicio, horaFin);
    } else {
      // Click antes del inicio → resetear
      setInicio(d); setFin(null); setMismodia(false);
      notifyChange(d, null, false, horaInicio, horaFin);
    }
  }

  function handleHora(field, val) {
    const hi = field === 'inicio' ? val : horaInicio;
    const hf = field === 'fin' ? val : horaFin;
    if (field === 'inicio') setHoraInicio(val);
    else setHoraFin(val);
    if (mismodia && inicio) notifyChange(inicio, inicio, true, hi, hf);
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
      if (activeEnd && !isSameDay(activeEnd, inicio)) classes.push('start');
      return classes.join(' ');
    }
    if (activeEnd && isSameDay(d, activeEnd) && inicio && !isSameDay(activeEnd, inicio)) {
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

  const nights = inicio && fin && !mismodia
    ? Math.round((fin - inicio) / 86400000)
    : null;

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
                if (d >= inicio) setHovered(d);
              }
            }}
            onMouseLeave={() => setHovered(null)}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Chips resumen */}
      <div className="cal-summary">
        <div className={`cal-chip ${inicio ? 'filled' : ''}`}>
          <div className="cal-chip-label">Salida</div>
          <div className="cal-chip-value">{formatShort(inicio)}</div>
        </div>
        <div className={`cal-chip ${fin ? 'filled' : ''}`}>
          <div className="cal-chip-label">Regreso</div>
          <div className="cal-chip-value">{mismodia ? 'Mismo día' : formatShort(fin)}</div>
        </div>
      </div>

      {/* Selector de horas — solo para mismo día */}
      {mismodia && inicio && (
        <div style={{
          background: 'var(--spl)', border: '1px solid var(--spm)',
          borderRadius: 10, padding: '12px 14px', marginTop: 10,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--spd)', marginBottom: 10, letterSpacing: '.05em', textTransform: 'uppercase' }}>
            🕐 Horario del viaje
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em' }}>Hora de salida</div>
              <input type="time" value={horaInicio} onChange={e => handleHora('inicio', e.target.value)}
                style={{ width: '100%', border: '1.5px solid var(--spm)', borderRadius: 8, padding: '8px 10px', fontSize: 15, fontFamily: 'Inter, sans-serif', outline: 'none', background: '#fff', color: 'var(--spd)', fontWeight: 600 }} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em' }}>Hora de regreso</div>
              <input type="time" value={horaFin} onChange={e => handleHora('fin', e.target.value)}
                style={{ width: '100%', border: '1.5px solid var(--spm)', borderRadius: 8, padding: '8px 10px', fontSize: 15, fontFamily: 'Inter, sans-serif', outline: 'none', background: '#fff', color: 'var(--spd)', fontWeight: 600 }} />
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--sp)', marginTop: 8, fontWeight: 500 }}>
            ⚡ Viaje en el día · la tarifa se calcula según km recorridos
          </div>
        </div>
      )}

      {nights > 0 && (
        <div className="cal-nights">
          {nights} noche{nights !== 1 ? 's' : ''} en destino
        </div>
      )}

      {mismodia && inicio && (
        <div className="cal-nights" style={{ background: 'var(--green-bg)', color: 'var(--green-text)' }}>
          ✈️ Viaje en el día · {horaInicio} → {horaFin}
        </div>
      )}

      {inicio && !fin && !mismodia && (
        <div style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'center', marginTop: 8 }}>
          Tocá otro día para el regreso, o tocá el mismo día para viaje en el día
        </div>
      )}
    </div>
  );
}
