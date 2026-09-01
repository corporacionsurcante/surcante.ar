// Generación de PDF de cotización — Surcante
// El PDF se genera al instante desde los datos guardados en Firestore,
// tanto para el cliente (al finalizar) como para el admin (histórico día a día).
import { jsPDF } from 'jspdf';
import { formatARS, formatDate } from './calculos';

const SP = [74, 15, 168];      // violeta Surcante #4A0FA8
const SP_LIGHT = [244, 242, 250];
const TEXT = [26, 26, 46];
const TEXT_2 = [110, 110, 140];
const GREEN = [0, 150, 110];

const TIPO_LABELS = {
  charter: 'Charter',
  receptivo: 'Receptivo CABA',
  disposicion: 'Disposición / Disponibilidad',
  'movimientos-caba-gba': 'Movimientos CABA / GBA',
};

const PAGO_LABELS = {
  transferencia: 'Transferencia bancaria',
  efectivo: 'Efectivo',
  mercadopago: 'MercadoPago',
  tarjeta: 'Tarjeta (MercadoPago)',
};

export function generarNroCotizacion() {
  const f = new Date();
  const yy = String(f.getFullYear()).slice(-2);
  const mm = String(f.getMonth() + 1).padStart(2, '0');
  const dd = String(f.getDate()).padStart(2, '0');
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `SRC-${yy}${mm}${dd}-${rand}`;
}

function safeFormatDate(d) {
  if (!d) return '';
  try { return formatDate(d) || String(d); } catch (_) { return String(d); }
}

function fechaEmision(r) {
  if (r.creadoEn?.toDate) return r.creadoEn.toDate();
  if (r.creadoEn?.seconds) return new Date(r.creadoEn.seconds * 1000);
  return new Date();
}

function buildFilas(r) {
  const filas = [];
  const push = (k, v) => {
    if (v === undefined || v === null || v === '' || v === 'undefined') return;
    filas.push([k, String(v)]);
  };
  push('Tipo de servicio', TIPO_LABELS[r.tipo] || r.tipo || 'Charter');
  push('Base de salida', r.baseNombre);
  push('Origen', r.origen);
  push('Destino', r.destino);
  push('Fecha de salida', safeFormatDate(r.fechaInicio));
  if (r.fechaFin && r.fechaFin !== r.fechaInicio) push('Fecha de regreso', safeFormatDate(r.fechaFin));
  if (r.dias) push('Días de servicio', r.dias);
  if (r.horas) push('Horas de servicio', `${r.horas} hs`);
  if (r.kmTotal) push('Km totales', `${Number(r.kmTotal).toLocaleString('es-AR')} km`);
  if (r.unidad) push('Unidad', r.unidad);
  if (r.flotaUnidades?.length) {
    push('Unidades', r.flotaUnidades.map(u => u.label || u.id).join('  ·  '));
  }
  if (r.puntosCarga?.length) push('Puntos de carga', r.puntosCarga.length);
  push('Descripción', r.descripcion);
  return filas;
}

export function generarPdfCotizacion(r) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210;
  const M = 16;
  const nro = r.nroCotizacion || generarNroCotizacion();
  const emision = fechaEmision(r);
  let y = 0;

  // ---- Header ----
  doc.setFillColor(...SP);
  doc.rect(0, 0, W, 34, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('SURCANTE', M, 15);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Transporte turístico  ·  Charter  ·  Receptivo  ·  CABA / GBA', M, 22);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('PRESUPUESTO', W - M, 14, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`N° ${nro}`, W - M, 20, { align: 'right' });
  doc.text(`Emitido: ${emision.toLocaleDateString('es-AR')} ${emision.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs`, W - M, 26, { align: 'right' });

  y = 44;

  // ---- Cliente ----
  doc.setFillColor(...SP_LIGHT);
  doc.roundedRect(M, y, W - 2 * M, 18, 2, 2, 'F');
  doc.setTextColor(...TEXT_2);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('CLIENTE', M + 5, y + 6);
  doc.setTextColor(...TEXT);
  doc.setFontSize(11);
  doc.text(r.clienteNombre || 'Cliente sin nombre', M + 5, y + 13);
  if (r.clienteWhatsapp) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`WhatsApp: ${r.clienteWhatsapp}`, W - M - 5, y + 13, { align: 'right' });
  }
  y += 26;

  // ---- Detalle del servicio ----
  doc.setTextColor(...SP);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('DETALLE DEL SERVICIO', M, y);
  y += 3;
  doc.setDrawColor(...SP);
  doc.setLineWidth(0.5);
  doc.line(M, y, W - M, y);
  y += 6;

  const filas = buildFilas(r);
  doc.setFontSize(10);
  filas.forEach(([k, v]) => {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...TEXT_2);
    doc.text(k, M, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...TEXT);
    const lines = doc.splitTextToSize(v, 100);
    doc.text(lines, W - M, y, { align: 'right' });
    y += 6.5 * lines.length;
  });

  // ---- Programa (receptivo) ----
  if (r.programaResumen?.length) {
    y += 4;
    doc.setTextColor(...SP);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('PROGRAMA DÍA A DÍA', M, y);
    y += 3;
    doc.line(M, y, W - M, y);
    y += 6;
    doc.setFontSize(9.5);
    r.programaResumen.forEach(p => {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...TEXT);
      doc.text(`Día ${p.dia}`, M, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...TEXT_2);
      const lines = doc.splitTextToSize(p.actividades || 'Día libre', 145);
      doc.text(lines, M + 22, y);
      y += 5.5 * lines.length;
      if (y > 245) { doc.addPage(); y = 20; }
    });
  }

  // ---- Totales ----
  y += 6;
  if (y > 220) { doc.addPage(); y = 20; }
  const boxH = 34;
  doc.setFillColor(...SP_LIGHT);
  doc.roundedRect(M, y, W - 2 * M, boxH, 2, 2, 'F');
  const rowTotal = (label, value, dy, big, color) => {
    doc.setFont('helvetica', big ? 'bold' : 'normal');
    doc.setFontSize(big ? 13 : 10);
    doc.setTextColor(...(color || TEXT));
    doc.text(label, M + 6, y + dy);
    doc.text(value, W - M - 6, y + dy, { align: 'right' });
  };
  rowTotal('TOTAL DEL VIAJE (impuestos incluidos)', formatARS(r.grandTotal || 0), 9, true, SP);
  const porc = r.porcentaje ? Math.round(r.porcentaje * 100) : null;
  rowTotal(`Seña / pago inicial${porc ? ` (${porc}%)` : ''}`, formatARS(r.sena || 0), 18, false, GREEN);
  rowTotal('Saldo pendiente', formatARS(r.saldo != null ? r.saldo : (r.grandTotal || 0) - (r.sena || 0)), 25);
  rowTotal('Método de pago', PAGO_LABELS[r.payMethod] || r.payMethod || '-', 31);
  y += boxH + 10;

  // ---- Footer ----
  doc.setDrawColor(220, 220, 230);
  doc.setLineWidth(0.3);
  doc.line(M, 272, W - M, 272);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_2);
  doc.text('Surcante  ·  surcante.com  ·  WhatsApp +54 9 11 5810-0414', M, 278);
  doc.text('Presupuesto sujeto a disponibilidad. Validez: 48 hs. Valores en pesos argentinos según dólar BNA del día.', M, 283);
  doc.setTextColor(...SP);
  doc.text(`N° ${nro}`, W - M, 278, { align: 'right' });

  return { doc, nro };
}

export function descargarPdfCotizacion(r) {
  const { doc, nro } = generarPdfCotizacion(r);
  doc.save(`Surcante-Presupuesto-${nro}.pdf`);
}

export function abrirPdfCotizacion(r) {
  const { doc } = generarPdfCotizacion(r);
  window.open(doc.output('bloburl'), '_blank');
}
