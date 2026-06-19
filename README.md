# Surcante — Cotizador de Viajes

App web PWA para cotizar viajes en omnibus, minibus y bus.

## Stack
- React 18
- PWA (funciona en cualquier celular con navegador)
- Dólar BNA en tiempo real (dolarapi.com)
- Deploy en Vercel

## Instalación local

```bash
npm install
npm start
```

## Deploy en Vercel

1. Subir este repositorio a GitHub (repo privado)
2. Entrar a vercel.com → "Add New Project"
3. Importar el repo de GitHub
4. Framework: **Create React App**
5. Build command: `npm run build`
6. Output directory: `build`
7. Click "Deploy"

Cada push a `main` se despliega automáticamente.

## Variables de entorno (futuro)

```
REACT_APP_GOOGLE_MAPS_KEY=tu_clave_aqui
```

## Estructura

```
src/
  data/       → constantes y configuración del negocio
  hooks/      → useDolar (tipo de cambio BNA)
  utils/      → cálculos de km y precios
  components/ → Topbar, Steps
  pages/      → PasoFlota, PasoRecorrido, PasoPresupuesto, Confirmacion
```
