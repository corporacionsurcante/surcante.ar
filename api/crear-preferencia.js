// Vercel Serverless Function — crea preferencia de pago en MercadoPago.
// Se ejecuta en el servidor: el Access Token nunca llega al navegador.
// Acepta MP_ACCESS_TOKEN (recomendado) o REACT_APP_MP_ACCESS_TOKEN (nombre histórico).

function leerBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch (_) { return {}; }
}

const texto = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const token = process.env.MP_ACCESS_TOKEN || process.env.REACT_APP_MP_ACCESS_TOKEN;
  if (!token) {
    console.error('Falta MP_ACCESS_TOKEN');
    return res.status(500).json({ error: 'MercadoPago no configurado' });
  }

  const body = leerBody(req);
  const monto = Math.round(Number(body.monto) * 100) / 100;
  if (!Number.isFinite(monto) || monto <= 0 || monto > 1e9) {
    return res.status(400).json({ error: 'Monto inválido' });
  }

  const titulo = texto(body.titulo, 200) || 'Reserva Surcante';
  const descripcion = texto(body.descripcion, 250);
  const referencia = texto(body.referencia, 64); // N° de cotización (SRC-...)
  const base = (process.env.REACT_APP_URL || process.env.SITE_URL || 'https://surcante.com').replace(/\/$/, '');

  try {
    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        items: [{
          title: titulo,
          description: descripcion,
          quantity: 1,
          unit_price: monto,
          currency_id: 'ARS',
        }],
        external_reference: referencia || undefined,
        back_urls: {
          success: `${base}/pago-exitoso`,
          failure: `${base}/pago-fallido`,
          pending: `${base}/pago-pendiente`,
        },
        auto_return: 'approved',
        statement_descriptor: 'SURCANTE',
        metadata: {
          total_viaje: Number(body.totalViaje) || null,
          monto_sena: monto,
          nro_cotizacion: referencia || null,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error('Error MP:', error);
      return res.status(502).json({ error: 'Error al crear preferencia en MercadoPago' });
    }

    const data = await response.json();
    return res.status(200).json({
      id: data.id,
      init_point: data.init_point,
      sandbox_init_point: data.sandbox_init_point,
    });
  } catch (error) {
    console.error('Error servidor:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
