# Panel de Reservas — Frontend

Panel operativo mínimo (recursos, reservas, ocupación) para consumir la
`reservations-api`. React + TypeScript + Vite, sin dependencias pesadas.

## Desarrollo local

```bash
npm install
cp .env.example .env   # editá VITE_API_URL si tu API no corre en localhost:3000
npm run dev
```

## Deploy en Render (Static Site)

1. Subí esta carpeta como repo (o subcarpeta `frontend/` del mismo repo del backend).
2. En Render Dashboard → **New → Static Site**.
3. Conectá el repo. Si el frontend vive en una subcarpeta, seteá **Root Directory** a `frontend`.
4. Build Command: `npm install && npm run build`
5. Publish Directory: `dist`
6. Variable de entorno: `VITE_API_URL` → la URL pública de tu backend en Render
   (ej. `https://app-chny.onrender.com`, sin barra final).
7. Agregá una regla de **Redirect/Rewrite**: `/*` → `/index.html` (tipo Rewrite),
   necesario porque es una SPA con rutas del lado del cliente. Si preferís,
   el `render.yaml` incluido ya trae esta config — Render lo puede levantar
   directo si lo detecta en el repo.

## Importante: CORS

Tu backend ya tiene la variable `CORS_ORIGIN` (ver `render.yaml` del repo de
la API). Una vez que el Static Site tenga su URL definitiva
(`https://reservations-panel-xxxx.onrender.com`), actualizá `CORS_ORIGIN` en
el servicio del **backend** con esa URL exacta y reiniciá el servicio — si
no, el navegador va a bloquear todas las peticiones desde el panel.

## Qué cubre

- Login con JWT (roles ADMIN / RECEPTIONIST / WAITER).
- Panorama: KPIs de recursos, reservas y ocupación promedio.
- Recursos: listado + verificación de disponibilidad por rango horario.
- Reservas: listado con acciones según rol (confirmar/cancelar/completar) y
  alta de reserva nueva.
- Ocupación: reporte por rango de fechas.

## Limitaciones conocidas (heredadas de la API actual)

- **Categorías sin nombre**: el panel muestra `categoryId` tal cual, porque
  `/api/categories` está implementado en el backend pero no está montado en
  `app.ts`. Si lo montás, se puede reemplazar fácilmente por el nombre real.
- **Alta de cliente nuevo** usa `POST /api/customer/register` (pensado para
  autoservicio) generando una contraseña temporal aleatoria — no hay hoy un
  endpoint pensado para que un empleado cargue un cliente "walk-in" sin
  contraseña. Funciona, pero vale la pena resolverlo del lado del backend
  más adelante.
- El formulario de nueva reserva pide nombre/email del cliente aunque ya
  tengas su ID, porque `CreateReservationSchema` los exige en el body aunque
  el servidor solo use el `id` para la búsqueda real.
