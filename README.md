# Gestión de Pedidos ICBC × icomm

App interna para gestionar pedidos de email marketing del cliente ICBC. Permite crear, asignar, trackear y finalizar pedidos con un flujo completo desde la solicitud hasta el registro en Google Sheets.

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | React 19 + Vite |
| Estilos | Tailwind CSS v4 + CSS custom |
| Routing | React Router v7 |
| Backend / DB | Supabase (PostgreSQL + Auth + Realtime) |
| Edge Functions | Supabase Functions (Deno) |
| Deploy | Vercel |
| Iconos | Lucide React |
| Fechas | date-fns |

---

## Funcionalidades

### Pedidos
- Crear, editar y eliminar pedidos con asunto, descripción, tipo, prioridad, instancia, tipo de envío, fecha límite y tags
- Asignar pedidos a uno o más usuarios del equipo
- Actualizar estados (en proceso, en revisión, finalizado, etc.) con historial de cambios
- Papelera con soft delete y restauración

### Subtareas
- Agregar subtareas a cada pedido con asignación por usuario
- Marcar como completadas con timestamp
- Registro automático en Google Sheets para tareas del área de Diseño

### Piezas entregables
- Cargar piezas con nombre y link online
- Aprobar/desaprobar piezas individualmente
- Copiar nombres y links al portapapeles

### Registro en Google Sheets
- Al finalizar un pedido, se puede registrar en la hoja "Pedidos 2026" via Edge Function
- Las subtareas completadas del área Diseño se registran en la hoja "Diseño piezas 2026"

### Dashboard
- Vista de pedidos agrupados por día de creación
- Agenda del día: pedidos con vencimiento en los próximos 7 días
- Filtros por estado, prioridad, tipo, usuario, tag y rango de fechas
- Vista compacta y completa
- Stats generales: total, urgentes, finalizados, sin estado

### Calendario
- Vista mensual y semanal de pedidos por fecha límite
- Filtros y navegación por mes/semana

### Notificaciones
- Notificaciones en tiempo real via Supabase Realtime
- Toast al recibir una nueva notificación
- Sonido opcional configurable
- Límite de 50 notificaciones (elimina las más viejas automáticamente)

### Usuarios
- Invitar usuarios por email (Supabase invite)
- Roles con permisos diferenciados
- Asignación de área de equipo

### Configuración
- Gestión de estados, tipos e instancias desde la UI (sin tocar código)
- Colores personalizables por ítem

---

## Roles y permisos

| Rol | Crear pedidos | Editar pedidos | Gestión usuarios | Papelera | Configuración |
|-----|:---:|:---:|:---:|:---:|:---:|
| `super_admin` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `admin` | ✅ | ✅ | ✅ | ❌ | ✅ |
| `colaborador` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `viewer` | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## Estructura del proyecto

```
src/
├── components/
│   ├── auth/
│   │   └── ProtectedRoute.jsx
│   ├── layout/
│   │   └── AppLayout.jsx        # Sidebar, topbar mobile, toasts
│   ├── pedidos/
│   │   ├── PedidoForm.jsx       # Modal crear/editar pedido
│   │   └── PedidosList.jsx      # Lista con filtros
│   └── ui/
│       ├── Badge.jsx
│       ├── ConfirmModal.jsx
│       ├── DatePicker.jsx
│       └── TagSearch.jsx
├── context/
│   ├── AuthContext.jsx           # Sesión y perfil del usuario
│   ├── NotificacionesContext.jsx # Notificaciones + sistema de toasts
│   └── ThemeContext.jsx          # Dark / light mode
├── hooks/
│   ├── useActividad.js           # Registro de actividad en pedidos
│   ├── useEstados.js             # Estados (con cache)
│   ├── useInstancias.js          # Instancias (con cache)
│   ├── useLocalStorage.js
│   ├── usePedidos.js             # CRUD de pedidos + realtime
│   └── useTipos.js               # Tipos (con cache)
├── lib/
│   ├── constants.js              # Roles, prioridades, colores
│   ├── supabase.js               # Cliente Supabase
│   └── supabaseHelper.js         # Helpers runSupabase / runSupabaseSilent
├── pages/
│   ├── Calendario.jsx
│   ├── Configuracion.jsx
│   ├── Dashboard.jsx
│   ├── Login.jsx
│   ├── Notificaciones.jsx
│   ├── Papelera.jsx
│   ├── PedidoDetalle.jsx
│   ├── Pedidos.jsx
│   ├── SetPassword.jsx
│   └── Usuarios.jsx
└── styles/
    └── global.css                # Variables CSS, componentes, dark/light
```

---

## Edge Functions (Supabase)

| Función | Descripción |
|---------|-------------|
| `invite-user` | Invita un usuario nuevo vía Supabase Auth |
| `delete-user` | Elimina un usuario de Auth y su perfil |
| `escribir-sheet` | Escribe una fila en Google Sheets (hoja pedidos o diseño) |

---

## Variables de entorno

Crear un archivo `.env` en la raíz con:

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

---

## Correr localmente

```bash
npm install
npm run dev
```

---

## Deploy

El proyecto se deploya automáticamente en Vercel al hacer push a `main`. Las variables de entorno se configuran desde el panel de Vercel.

---

## Tema

La app soporta modo oscuro y claro. El tema se guarda en `localStorage` y se aplica via `data-theme` en el `<html>`. Las variables CSS están definidas en `global.css` bajo `[data-theme="dark"]` y `[data-theme="light"]`.