// Vercel Serverless Function — crea preferencia de pago en MercadoPago
// Se ejecuta en el servidor, nunca expone el Access Token al cliente

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { monto, titulo, descripcion, totalViaje } = req.body;

  if (!monto || monto <= 0) {
    return res.status(400).json({ error: 'Monto inválido' });
  }

  try {
    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.REACT_APP_MP_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        items: [{
          title: titulo,
          description: descripcion,
          quantity: 1,
          unit_price: monto,
          currency_id: 'ARS',
        }],
        back_urls: {
          success: `${process.env.REACT_APP_URL || 'https://surcante-ar.vercel.app'}/pago-exitoso`,
          failure: `${process.env.REACT_APP_URL || 'https://surcante-ar.vercel.app'}/pago-fallido`,
          pending: `${process.env.REACT_APP_URL || 'https://surcante-ar.vercel.app'}/pago-pendiente`,
        },
        auto_return: 'approved',
        statement_descriptor: 'SURCANTE',
        metadata: {
          total_viaje: totalViaje,
          monto_sena: monto,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Error MP:', error);
      return res.status(500).json({ error: 'Error al crear preferencia en MercadoPago' });
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
