import React, { useState } from 'react';

export default function FooterLegal() {
  const [showTerminos, setShowTerminos] = useState(false);
  const [showCancelacion, setShowCancelacion] = useState(false);
  const [showArrepentimiento, setShowArrepentimiento] = useState(false);
  const [showPrivacidad, setShowPrivacidad] = useState(false);

  const Modal = ({ titulo, onClose, children }) => (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 9999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 0 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', width: '100%', maxWidth: 600, maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#0A0A0F' }}>{titulo}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#9090B0' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );

  const P = ({ children }) => <p style={{ fontSize: 13, color: '#4A4A6A', lineHeight: 1.7, marginBottom: 10 }}>{children}</p>;
  const H = ({ children }) => <div style={{ fontSize: 14, fontWeight: 700, color: '#0A0A0F', marginTop: 16, marginBottom: 6 }}>{children}</div>;

  return (
    <>
      <div style={{
        background: '#0A0A0F', borderTop: '1px solid rgba(255,255,255,.08)',
        padding: '28px 20px 20px', marginTop: 32,
      }}>
        {/* Datos institucionales */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <img src="/Logo_Surcante_01.png" alt="Surcante" style={{ height: 32, marginBottom: 10 }} />
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', lineHeight: 1.8 }}>
            <div style={{ fontWeight: 600, color: 'rgba(255,255,255,.7)' }}>SURCANTE S.R.L.</div>
            <div>CUIT: 30-71098078-7</div>
            <div>Servicio de transporte automotor de pasajeros</div>
            <div>Buenos Aires, Argentina</div>
          </div>
        </div>

        {/* Contacto */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
          <a href="https://wa.me/5491158100414" target="_blank" rel="noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#25D366', borderRadius: 10, padding: '10px 12px', textDecoration: 'none' }}>
            <span style={{ fontSize: 18 }}>📱</span>
            <div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,.7)', fontWeight: 600 }}>WHATSAPP</div>
              <div style={{ fontSize: 12, color: '#fff', fontWeight: 700 }}>11 5810-0414</div>
            </div>
          </a>
          <a href="https://wa.me/5492984524724" target="_blank" rel="noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#25D366', borderRadius: 10, padding: '10px 12px', textDecoration: 'none' }}>
            <span style={{ fontSize: 18 }}>📱</span>
            <div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,.7)', fontWeight: 600 }}>WHATSAPP</div>
              <div style={{ fontSize: 12, color: '#fff', fontWeight: 700 }}>298 452-4724</div>
            </div>
          </a>
        </div>

        {/* Links legales */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 16 }}>
          {[
            { label: 'Términos y condiciones', fn: () => setShowTerminos(true) },
            { label: 'Política de cancelación', fn: () => setShowCancelacion(true) },
            { label: 'Política de privacidad', fn: () => setShowPrivacidad(true) },
          ].map(({ label, fn }) => (
            <button key={label} onClick={fn}
              style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 20, padding: '6px 14px', fontSize: 11, color: 'rgba(255,255,255,.5)', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
              {label}
            </button>
          ))}
        </div>

        {/* Botón de arrepentimiento */}
        <button onClick={() => setShowArrepentimiento(true)}
          style={{
            width: '100%', padding: '12px 16px',
            background: 'rgba(207,19,34,.15)', border: '1.5px solid rgba(207,19,34,.4)',
            borderRadius: 10, color: '#FF4D5E', fontSize: 13, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'Inter, sans-serif', marginBottom: 16,
          }}>
          ⚠️ BOTÓN DE ARREPENTIMIENTO
        </button>

        <div style={{ textAlign: 'center', fontSize: 10, color: 'rgba(255,255,255,.2)' }}>
          © {new Date().getFullYear()} Surcante S.R.L. · Todos los derechos reservados
        </div>
      </div>

      {/* Modal Términos */}
      {showTerminos && (
        <Modal titulo="Términos y condiciones" onClose={() => setShowTerminos(false)}>
          <H>1. Objeto</H>
          <P>Surcante S.R.L. presta servicios de transporte turístico de pasajeros en la República Argentina. La presente plataforma permite cotizar y reservar servicios de charter, receptivo, disposición y traslados.</P>
          <H>2. Reserva y señas</H>
          <P>La reserva se confirma con el pago de la seña correspondiente (30% mediante transferencia o efectivo; 10% mediante MercadoPago o tarjeta). El saldo debe abonarse antes del inicio del servicio.</P>
          <H>3. Precios</H>
          <P>Los precios se expresan en pesos argentinos con IVA incluido. El valor del dólar utilizado para la conversión es el tipo de cambio BNA (Banco Nación Argentina) vigente al momento de la cotización.</P>
          <H>4. Modificaciones</H>
          <P>Surcante S.R.L. se reserva el derecho de modificar rutas, horarios o unidades por razones operativas, notificando al cliente con la mayor anticipación posible.</P>
          <H>5. Responsabilidad</H>
          <P>Surcante S.R.L. cuenta con los seguros y habilitaciones exigidos por la normativa vigente para el transporte de pasajeros en Argentina.</P>
          <H>6. Jurisdicción</H>
          <P>Ante cualquier controversia, las partes se someten a la jurisdicción de los tribunales ordinarios de la Ciudad Autónoma de Buenos Aires.</P>
        </Modal>
      )}

      {/* Modal Cancelación */}
      {showCancelacion && (
        <Modal titulo="Política de cancelación" onClose={() => setShowCancelacion(false)}>
          <H>Cancelaciones con más de 72 horas de anticipación</H>
          <P>Se devuelve el 100% de la seña abonada, descontando gastos administrativos del 5%.</P>
          <H>Cancelaciones entre 24 y 72 horas</H>
          <P>Se retiene el 50% de la seña como compensación por la inmovilización de la unidad.</P>
          <H>Cancelaciones con menos de 24 horas</H>
          <P>Se retiene el 100% de la seña. El cliente puede solicitar reprogramación del servicio sin cargo adicional, sujeto a disponibilidad.</P>
          <H>Cancelación por causas de fuerza mayor</H>
          <P>En caso de cancelación por causas de fuerza mayor debidamente acreditadas (clima extremo, disposiciones oficiales, etc.), Surcante S.R.L. ofrecerá reprogramación o devolución total de lo abonado.</P>
          <H>Contacto para cancelaciones</H>
          <P>Las cancelaciones deben comunicarse por WhatsApp al +54 9 11 5810-0414 o +54 9 298 452-4724, indicando el número de reserva.</P>
        </Modal>
      )}

      {/* Modal Arrepentimiento */}
      {showArrepentimiento && (
        <Modal titulo="⚠️ Botón de Arrepentimiento" onClose={() => setShowArrepentimiento(false)}>
          <P>De acuerdo con la Disposición 954/2025 de la Secretaría de Comercio y la Ley 24.240 de Defensa del Consumidor, el consumidor tiene derecho a revocar la aceptación de una contratación a distancia dentro de los 10 (diez) días corridos desde la fecha de contratación, sin costo ni penalidad.</P>
          <H>¿Cómo ejercer el derecho de arrepentimiento?</H>
          <P>Comunicarse por alguno de los siguientes medios, indicando número de reserva, nombre completo y motivo:</P>
          <div style={{ background: '#F4F2FA', borderRadius: 10, padding: 14, marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>📱 WhatsApp</div>
            <a href="https://wa.me/5491158100414?text=Quiero%20ejercer%20mi%20derecho%20de%20arrepentimiento" target="_blank" rel="noreferrer"
              style={{ display: 'block', background: '#25D366', color: '#fff', padding: '10px 14px', borderRadius: 8, textDecoration: 'none', fontWeight: 700, fontSize: 13, textAlign: 'center', marginBottom: 8 }}>
              Contactar por WhatsApp
            </a>
          </div>
          <P>Una vez recibida la solicitud, Surcante S.R.L. procesará la devolución dentro de los 10 días hábiles siguientes, de acuerdo con la política de cancelación vigente y la normativa aplicable a servicios turísticos con fecha determinada.</P>
          <P style={{ fontSize: 11, color: '#9090B0' }}>Para servicios turísticos con fecha de prestación determinada, el ejercicio del arrepentimiento puede estar sujeto a condiciones específicas conforme a la normativa vigente.</P>
        </Modal>
      )}

      {/* Modal Privacidad */}
      {showPrivacidad && (
        <Modal titulo="Política de privacidad" onClose={() => setShowPrivacidad(false)}>
          <H>Datos que recopilamos</H>
          <P>Recopilamos nombre y número de WhatsApp al momento de confirmar una reserva. Estos datos se utilizan exclusivamente para la gestión del servicio contratado.</P>
          <H>Uso de los datos</H>
          <P>Los datos personales no se comparten con terceros ni se utilizan con fines publicitarios. Se almacenan de forma segura en Firebase (Google) con acceso restringido.</P>
          <H>Derechos del titular</H>
          <P>El titular puede solicitar acceso, rectificación o eliminación de sus datos comunicándose por WhatsApp al +54 9 11 5810-0414.</P>
          <H>Ley aplicable</H>
          <P>El tratamiento de datos se rige por la Ley 25.326 de Protección de Datos Personales de la República Argentina.</P>
        </Modal>
      )}
    </>
  );
}
