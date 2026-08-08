# Arquitectura del sistema — División `app` / `appfrontend`

> **Este archivo es la referencia canónica.** Antes de agregar cualquier feature, endpoint, validación o tipo, consultá esta guía para saber en qué repo va.

---

## Regla de oro

| Pregunta | Repo |
|---|---|
| ¿Persiste datos? ¿Valida reglas de negocio? ¿Emite eventos de dominio? | `app` (backend) |
| ¿Muestra datos al usuario? ¿Captura input? ¿Navega entre vistas? | `appfrontend` |
| ¿Es una validación de formulario client-side? | `appfrontend` |
| ¿Es una validación que protege la integridad de la BD? | `app` |
| ¿Es un tipo que modela la respuesta de la API? | `appfrontend` (`src/lib/types.ts`) |
| ¿Es un tipo que modela una entidad del dominio con comportamiento? | `app` (`src/domain/`) |

---

## `app` — Backend (API REST)

**Repo:** `Alejandro-Gabriel-Pozo/app`  
**Stack:** Node.js + TypeScript + Express + PostgreSQL  
**Deploy:** Render (Web Service)

### Qué vive acá

- **Dominio:** entidades con comportamiento (`Reservation`, `Resource`, `Customer`, `Order`, etc.) en `src/domain/`
- **Servicios:** lógica de negocio (`ReservationService`, `OrderService`, `CategoryService`, etc.) en `src/services/`
- **Repositorios:** acceso a base de datos (`SqlReservationRepository`, etc.) en `src/repositories/`
- **API REST:** rutas Express en `src/api/routes/` — definen los contratos HTTP
- **Autenticación:** JWT signing/verification, middlewares de `authorize()` y `authenticate()` en `src/security/`
- **Multi-tenant:** lógica de resolución de tenant, pool de conexiones por negocio, `tenantMiddleware` en `src/platform/`
- **Migraciones:** esquema de base de datos, seeds
- **Outbox / domain events:** `SqlDomainEventRepository`, `OutboxWorker`
- **Límites de plan:** `src/config/plan-limits.ts` — FREE/STARTER/PRO
- **Validaciones de integridad:** Zod schemas en `src/api/schemas/` que protegen la BD
- **Variables de entorno del servidor:** `DATABASE_URL`, `JWT_SECRET`, `ENCRYPTION_KEY`, etc.

### Qué NO va acá

- ❌ Componentes React o JSX de ningún tipo
- ❌ Lógica de navegación o estado de UI
- ❌ Llamadas a la API desde el cliente
- ❌ CSS, Tailwind, assets visuales
- ❌ Validaciones de UX (ej: "mostrar error si el campo está vacío" antes de hacer fetch)

---

## `appfrontend` — Frontend (Next.js)

**Repo:** `Alejandro-Gabriel-Pozo/appfrontend`  
**Stack:** Next.js 14 + TypeScript + Tailwind CSS  
**Deploy:** Render (Static Site / Web Service)

### Qué vive acá

- **Páginas y rutas:** `src/app/` (App Router de Next.js)
  - `src/app/dashboard/` — panel de empleados (ADMIN, RECEPTIONIST, WAITER)
  - `src/app/admin/` — panel de administración del negocio
  - `src/app/login/` — autenticación de empleados
  - `src/app/[businessSlug]/` — portal público de clientes *(pendiente de crear)*
- **Componentes:** `src/components/` — UI reutilizable (botones, modales, tablas, forms)
- **API Client:** `src/lib/api.ts` — todas las llamadas HTTP al backend van acá
- **Tipos de respuesta:** `src/lib/types.ts` — interfaces que modelan los DTOs de la API (NO lógica de dominio)
- **Contexto de sesión:** `src/context/` — estado de autenticación, usuario activo
- **Estilos:** `src/app/globals.css`, `tailwind.config.ts`
- **Variables de entorno del cliente:** solo `NEXT_PUBLIC_*` (actualmente `NEXT_PUBLIC_API_URL`)

### Qué NO va acá

- ❌ Conexiones directas a PostgreSQL o cualquier otra BD
- ❌ Lógica de negocio (calcular disponibilidad, validar transiciones de estado, aplicar límites de plan)
- ❌ Secretos del servidor (`JWT_SECRET`, `DATABASE_URL`, claves de encriptación)
- ❌ Validaciones que impliquen consultas a la BD
- ❌ Código que solo puede correr en Node.js (fs, crypto nativo del servidor, etc.)

---

## Contratos entre repos

La única interfaz entre `app` y `appfrontend` es la **API HTTP**. No hay código compartido entre repos.

### Regla de sincronización de tipos

Cuando el backend cambia un DTO (agrega un campo, cambia un tipo), el proceso es:

1. Hacer el cambio en `app` y deployar
2. Actualizar el tipo correspondiente en `appfrontend/src/lib/types.ts`
3. Actualizar la función en `appfrontend/src/lib/api.ts` si cambió la firma del endpoint

**Nunca** copiar entidades de dominio de `app` a `appfrontend`. Los tipos del frontend modelan *respuestas JSON*, no entidades con comportamiento.

### Endpoints actuales consumidos

| Módulo | Endpoint `app` | Función en `api.ts` |
|---|---|---|
| Recursos | `GET/POST/PUT/DELETE /api/resources` | `resourcesApi.*` |
| Categorías | `GET/POST/PUT/DELETE /api/categories` | `categoriesApi.*` |
| Reservas | `GET/POST /api/reservations` + actions | `reservationsApi.*` |
| Clientes | `GET/POST /api/customers` | `customersApi.*` |
| Productos | `GET/POST/PUT/DELETE /api/products` | `productsApi.*` |
| Variantes | `GET/POST/PUT/DELETE /api/products/:id/variants` | `variantsApi.*` |

### Endpoints pendientes de implementar en `appfrontend`

Estos endpoints **ya existen en `app`** pero aún no tienen consumidor en el frontend:

| Módulo | Endpoint | Prioridad |
|---|---|---|
| Reservas (paginación) | `GET /api/reservations?status=&from=&to=&page=&limit=` | Alta |
| Detalle de reserva | `GET /api/reservations/:id` | Alta |
| Cargos de reserva | `GET /api/reservations/:id/charges` | Media |
| Editar reserva | `PATCH /api/reservations/:id` | Alta |
| Órdenes completas | `GET/POST /api/orders` + items + transitions | Alta |
| Portal cliente — auth | `POST /api/customer/:slug/register` + `login` | Alta |
| Portal cliente — disponibilidad | `GET /api/customer/:slug/availability` | Alta |
| Portal cliente — mis reservas | `GET/POST/PATCH/DELETE /api/customer/me/reservations` | Alta |
| Reportes | `GET /api/reports/*` | Media |

---

## Validaciones: dónde van

Este es el punto de mayor confusión. La regla es:

```
┌─────────────────────────────────────────────────────┐
│  appfrontend                                        │
│  Validación UX: campo vacío, formato de email,      │
│  longitud mínima, fechas coherentes en el form.     │
│  Objetivo: feedback inmediato al usuario.           │
│  Herramienta: React Hook Form + Zod (client-side)   │
└────────────────────┬────────────────────────────────┘
                     │ fetch()
┌────────────────────▼────────────────────────────────┐
│  app (backend)                                      │
│  Validación de integridad: el recurso existe,       │
│  el cliente existe, no hay superposición de         │
│  reservas, el negocio no superó el límite de plan,  │
│  la transición de estado es válida.                 │
│  Objetivo: proteger la base de datos.               │
│  Herramienta: Zod schemas en src/api/schemas/ +     │
│  lógica de dominio en src/services/                 │
└─────────────────────────────────────────────────────┘
```

**Nunca** replicar validaciones de integridad en el frontend. El frontend puede pre-validar para UX, pero el backend es la fuente de verdad.

---

## Autenticación

| Responsabilidad | Repo |
|---|---|
| Firmar y verificar el JWT | `app` (`src/security/auth.service.ts`) |
| Middleware de protección de rutas | `app` (`src/security/auth.middleware.ts`) |
| Guardar el token en sesión | `appfrontend` (actualmente `localStorage` — ver nota) |
| Leer el token y enviarlo en `Authorization` | `appfrontend` (`src/lib/api.ts` → `getToken()`) |
| Redirigir si no hay token | `appfrontend` (middleware de Next.js o `useEffect`) |
| Decodificar el JWT para leer el rol | `appfrontend` (solo para UX — el backend siempre re-valida) |

> ⚠️ **Nota sobre `localStorage`:** el token actualmente se guarda en `localStorage` (`src/lib/api.ts`). Esto es vulnerable a XSS. Evaluá migrar a `httpOnly cookie` + un endpoint `POST /api/auth/refresh` en el backend cuando la seguridad sea prioritaria.

---

## Roles y acceso

Los roles están definidos en `app/src/types/enums.ts`:

```
ADMIN        — acceso total al panel de empleados
RECEPTIONIST — reservas, clientes, confirmar/cancelar/completar
WAITER       — ver reservas, completar órdenes
CUSTOMER     — solo portal público (/api/customer/*)
SUPERADMIN   — solo panel de plataforma (gestión de negocios)
```

El frontend debe:
1. Leer el rol del JWT decodificado para mostrar/ocultar elementos de UI
2. **Nunca** confiar solo en el rol del cliente para decidir si una acción es válida — el backend rechaza con 403 si el rol no tiene permiso

---

## Planes de suscripción

Definidos en `app/src/config/plan-limits.ts`:

| Plan | Categorías | Recursos |
|---|---|---|
| FREE | 1 | 5 |
| STARTER | 3 | 20 |
| PRO | ∞ | ∞ |

El backend rechaza la creación si se supera el límite. El frontend debe:
- Consultar el plan activo del negocio
- Deshabilitar el botón "Crear" con un tooltip explicativo cuando se alcanzó el límite
- **No** replicar la tabla de límites en el frontend — consumir el error `PLAN_LIMIT_REACHED` de la API

---

## Estructura de URLs por contexto

```
/login                          → Empleados: autenticación
/dashboard                      → Empleados: panel principal
/dashboard/reservations         → Empleados: listado de reservas
/dashboard/orders               → Empleados: listado de órdenes  
/dashboard/resources            → Empleados: recursos y categorías
/dashboard/customers            → Empleados: clientes
/dashboard/reports              → Empleados: reportes
/admin                          → Admin del negocio: configuración
/[businessSlug]                 → Portal público: home del negocio (pendiente)
/[businessSlug]/availability    → Portal público: buscador (pendiente)
/[businessSlug]/login           → Portal público: login de cliente (pendiente)
/[businessSlug]/me/reservations → Portal público: mis reservas (pendiente)
/platform                       → Superadmin: gestión de negocios (pendiente)
```

---

## Variables de entorno

| Variable | Repo | Descripción |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `appfrontend` | URL base del backend (ej: `https://app.onrender.com`) |
| `DATABASE_URL` | `app` | PostgreSQL platform DB |
| `TENANT_ENCRYPTION_KEY` | `app` | Clave para encriptar las DB URLs de tenants |
| `JWT_SECRET` | `app` | Secreto para firmar tokens |
| `PORT` | `app` | Puerto del servidor Express |

**Regla:** ninguna variable sin prefijo `NEXT_PUBLIC_` de `appfrontend` llega al browser. Nunca exponer secretos del servidor en el frontend.

---

## Issues y tracking

- **Backend `app`:** issues de API, dominio, infraestructura, seguridad, migraciones
- **Frontend `appfrontend`:** issues de UI, componentes, páginas, UX
- **Hoja de ruta del frontend:** ver [`app` issue #27](https://github.com/Alejandro-Gabriel-Pozo/app/issues/27)
- **Code review backend:** ver [`app` issue #26](https://github.com/Alejandro-Gabriel-Pozo/app/issues/26)
