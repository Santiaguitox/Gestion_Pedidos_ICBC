# Gestión de Pedidos ICBC × icomm

App interna para gestionar pedidos de email marketing del cliente ICBC. Permite crear, asignar, trackear y finalizar pedidos con un flujo completo desde la solicitud hasta el registro en Google Sheets. Incluye además un set de herramientas de validación (BBDD, piezas HTML, campos de personalización) y un buscador global.

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
- Actualizar estados (en proceso, en revisión, finalizado, etc.) con historial de cambios — "Finalizado" es mutuamente excluyente con cualquier otro estado
- Papelera con soft delete y restauración
- Búsqueda global (`Cmd/Ctrl+K`) por asunto, tag, pieza, o persona asignada — incluye navegación rápida a cualquier sección de la app

### Subtareas
- Agregar subtareas a cada pedido con asignación por usuario
- Marcar como completadas con timestamp
- Registro automático en Google Sheets para tareas del área de Diseño

### Piezas entregables
- Cargar piezas con nombre y link online (link único por pedido)
- Aprobar/desaprobar piezas individualmente — una pieza aprobada solo puede editarla `super_admin`
- Revisión automática en segundo plano de cada pieza con link (estructura, links, imágenes, legales) — el resultado queda guardado como resumen clickeable
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
- Vista mensual (grilla) y timeline, con panel del día seleccionado
- En mobile siempre se usa timeline (sin grilla); en desktop se puede elegir
- Filtros y navegación por mes

### Notificaciones
- Notificaciones en tiempo real via Supabase Realtime
- Toast al recibir una nueva notificación
- Sonido opcional configurable
- Límite de 50 notificaciones (elimina las más viejas automáticamente)

### Usuarios
- Invitar usuarios por email (Supabase invite)
- Roles con permisos diferenciados
- Asignación de área de equipo
- Color de avatar personalizable por usuario

### Configuración
- Gestión de estados, tipos e instancias desde la UI (sin tocar código)
- Colores personalizables por ítem

### Herramientas

**Revisión de emails** — valida la estructura, links, imágenes y legales de una pieza HTML (pegada o por URL). Detecta coincidencias con plantillas obsoletas conocidas. El resultado se integra con Piezas entregables (revisión automática al cargar un link).

**Revisión de BBDD** — analiza, verifica y compara bases de contactos (CSV/TXT) antes de un envío. Soporta archivos grandes (validado con bases de 400MB+) con dos modos de cálculo de diffs: rápido (en memoria) o seguro (vía IndexedDB) según el tamaño de la base.

**Revisión de envíos** — valida que los campos de personalización (`<*Campo*>`) de un mail tengan su columna correspondiente en el encabezado de la base de contactos, evitando que el envío real deje placeholders sin reemplazar. Solo lee las primeras líneas de cualquier archivo subido (encabezado + una muestra chica de filas) — nunca la base completa.

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
│   │   ├── AppLayout.jsx           # Sidebar, topbar mobile, toasts
│   │   └── BuscadorGlobal.jsx      # Command palette (Cmd/Ctrl+K)
│   ├── pedidos/
│   │   ├── PedidoForm.jsx          # Modal crear/editar pedido
│   │   ├── PedidoCard.jsx          # Card de pedido (avatar, colorAvatar, iniciales)
│   │   ├── EntregablesSection.jsx  # Piezas + revisión automática integrada
│   │   ├── SubtareasTimeline.jsx   # Subtareas + flujo de registro en Sheet (Diseño)
│   │   ├── SheetModal.jsx          # Modal de registro en Sheet (pedido completo)
│   │   ├── SheetDisenoModal.jsx    # Modal de registro en Sheet (subtarea Diseño)
│   │   ├── PedidoHistorial.jsx     # Timeline de actividad
│   │   └── PedidosList.jsx         # Lista con filtros
│   ├── revision/
│   │   └── ResultadoPanel.jsx      # Cards de resultado de Revisión de emails
│   ├── revision-base/
│   │   └── CompareTabBase.jsx      # Pestaña "Comparar" de Revisión de BBDD
│   └── ui/
│       ├── Badge.jsx
│       ├── ConfirmModal.jsx
│       ├── DatePicker.jsx
│       ├── GrupoLabel.jsx          # Label "Pedidos Activos/Finalizados"
│       ├── CargaTrabajoModal.jsx
│       └── TagSearch.jsx
├── context/
│   ├── AuthContext.jsx              # Sesión y perfil del usuario
│   ├── NotificacionesContext.jsx    # Notificaciones + sistema de toasts
│   └── ThemeContext.jsx             # Dark / light mode
├── hooks/
│   ├── useActividad.js              # Registro de actividad en pedidos
│   ├── useEstados.js                # Estados (con cache)
│   ├── useInstancias.js             # Instancias (con cache)
│   ├── useLocalStorage.js
│   ├── usePedidos.js                # CRUD de pedidos + realtime + paginación
│   └── useTipos.js                  # Tipos (con cache)
├── lib/
│   ├── constants.js                 # Roles, prioridades, colores
│   ├── supabase.js                  # Cliente Supabase
│   ├── supabaseHelper.js            # Helpers runSupabase / runSupabaseSilent
│   ├── revision/                    # Lógica de Revisión de emails
│   │   ├── config.js
│   │   ├── ejecutarRevision.js
│   │   ├── generales.js
│   │   ├── imagenes.js
│   │   └── templates.js
│   └── revision-envios/
│       └── comparar.js              # Lógica de Revisión de envíos
├── pages/
│   ├── Calendario.jsx
│   ├── Configuracion.jsx
│   ├── Dashboard.jsx
│   ├── Login.jsx
│   ├── Notificaciones.jsx
│   ├── Papelera.jsx
│   ├── PedidoDetalle.jsx
│   ├── Pedidos.jsx
│   ├── RevisionEmail.jsx            # Revisión de emails
│   ├── RevisionBase.jsx             # Revisión de BBDD
│   ├── RevisionEnvios.jsx           # Revisión de envíos
│   ├── SetPassword.jsx
│   └── Usuarios.jsx
├── workers/
│   ├── validator.worker.js          # Análisis de Revisión de BBDD
│   └── compare.worker.js            # Comparación de Revisión de BBDD (modo seguro)
└── styles/
    ├── global.css                   # Variables CSS, componentes, dark/light
    ├── RevisionEmail.css            # Aislado, propio de esa herramienta
    ├── RevisionBase.css             # Aislado, propio de esa herramienta
    └── RevisionEnvios.css           # Aislado, propio de esa herramienta
```

---

## Edge Functions (Supabase)

| Función | Descripción |
|---------|-------------|
| `invite-user` | Invita un usuario nuevo vía Supabase Auth |
| `delete-user` | Elimina un usuario de Auth y su perfil |
| `escribir-sheet` | Escribe una fila en Google Sheets (hoja pedidos o diseño) |

---

## Funciones SQL (Supabase)

| Función | Descripción |
|---------|-------------|
| `listar_pedidos` | RPC central de listado/búsqueda/paginación de pedidos. Modos: `normal` (paginado, excluye finalizados por defecto), `historico`, `vencimiento` (sin límite de antigüedad, incluye finalizados — usado por Calendario), `dashboard`. Con búsqueda de texto, indica además en qué campo coincidió (`coincidencia_en`: asunto/tag/pieza/persona), usado por el buscador global. |

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

**Nota:** algunas funcionalidades (modo URL de Revisión de emails / Revisión de envíos) dependen de la Edge Function `/api/proxy`, que solo corre en el deploy de Vercel — en local, el modo URL puede no funcionar; usar el modo "Pegar HTML" para probar esa lógica sin depender del proxy.

---

## Deploy

El proyecto se deploya automáticamente en Vercel al hacer push a `main`. Las variables de entorno se configuran desde el panel de Vercel.

---

## Tema

La app soporta modo oscuro y claro. El tema se guarda en `localStorage` y se aplica via `data-theme` en el `<html>`. Las variables CSS están definidas en `global.css` bajo `[data-theme="dark"]` y `[data-theme="light"]`. Las 3 herramientas de revisión tienen su propio CSS aislado, con sus propias variables semánticas mapeadas a las del tema general (no usan `global.css` directamente, para evitar colisiones de nombres de clase).