// Endpoint deshabilitado — era temporal para datos de prueba.
export default function handler(_req, res) {
  return res.status(404).json({ error: 'No encontrado' });
}
