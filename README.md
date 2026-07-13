# Gestión de Pedidos ICBC × icomm

App interna para gestionar pedidos de email marketing del cliente ICBC. Permite crear, asignar, trackear y finalizar pedidos con un flujo completo desde la solicitud hasta el registro en Google Sheets. Incluye además un set de herramientas de validación y auditoría (BBDD, piezas HTML, campos de personalización, escaneo masivo de piezas), un editor visual de piezas, comentarios internos por pedido con menciones y reacciones, una pantalla de estadísticas del equipo, notificaciones en tiempo real con Web Push (PWA) y un buscador global.

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
- Papelera con soft delete y restauración; borrado **definitivo** solo `super_admin`, vía RPC (`eliminar_pedido_definitivo`)
- Búsqueda global (`Cmd/Ctrl+K`) por asunto, tag, pieza, o persona asignada — incluye navegación rápida a cualquier sección de la app

### Subtareas
- Agregar subtareas a cada pedido con asignación por usuario
- Marcar como completadas con timestamp
- Registro automático en Google Sheets para tareas del área de Diseño

### Comentarios internos (por pedido)
- Conversación del equipo dentro del detalle de cada pedido, estilo Slack: menciones con autocomplete (`@usuario`), reacciones con emoji, picker de emojis en el composer
- Detección automática de links e imágenes en el texto — preview y botón de copiar
- El contenido del usuario **nunca** pasa por `dangerouslySetInnerHTML`: el render intercala spans de React, XSS imposible por construcción
- Invisible para el rol `viewer` en tres capas: la UI no monta la sección, Realtime no suscribe, y RLS devuelve 0 filas (la barrera real está en la base)
- Moderación vía RPC (`eliminar_comentario`), NULL-safe — el autor no puede "resucitar" un comentario moderado editándolo
- Borrador persistente del composer por pedido, y menciones al **editar** notifican solo el diff (no re-notifica a todos)
- Deep-link `?comentario=<id>` desde la campanita, el toast o el push: navega al pedido, scrollea hasta el comentario y lo resalta — marca leído solo ese ítem
- Resiliente sin websocket: si Realtime no está disponible degrada con recarga, y el error de carga se muestra honesto (no una lista vacía)

### Piezas entregables
- Cargar piezas con nombre y link online (link único por pedido)
- Aprobar/desaprobar piezas individualmente — una pieza aprobada solo puede editarla `super_admin`
- Revisión automática en segundo plano de cada pieza con link (estructura, links, imágenes, legales) — el resultado queda guardado como resumen clickeable
- Descargar todas las piezas del pedido como ZIP, o una individual — valida balance de tags HTML antes de descargar y avisa si hay algo raro
- Copiar nombres y links al portapapeles

### Base de datos (del pedido)
- Adjuntar la base de contactos real de un pedido (mismo lector liviano que Revisión de envíos: solo header + muestra chica, nunca la base completa)
- Verificación automática de compatibilidad contra la(s) pieza(s) del pedido — pill OK / campos faltantes por pieza
- Deep-link a "Revisión de envíos" con el header y la pieza ya precargados, para ver el detalle completo sin volver a pegar nada

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

### Estadísticas
- KPIs del período con acento de color (pedidos, finalizados, reprogramaciones, etc.), gráfico de distribución (donut) y throughput por día
- Filtros por mes y filtros globales (tipo, instancia, usuario)
- Todo el cómputo pesado vive en la base: la RPC `estadisticas_periodo` devuelve KPIs y series ya calculados — el front solo pinta
- Acceso restringido a `admin` y `super_admin`
- Fondo de marca (isotipo en las esquinas) — el mismo recurso se aplicó después a toda la app (ver `AuthBrandBackdrop`)

### Notificaciones
- **Eventos inmutables agrupados por `grupo_key`** (patrón de apps grandes): cada evento es una fila individual que nunca se edita, y el colapso de casi-duplicados (ej. varios cambios de estado del mismo pedido) es 100% capa de presentación
- Notificaciones en tiempo real via Supabase Realtime, con toast al recibir una nueva — las entradas agrupadas son clickeables individualmente, cada una navega a su deep-link y marca leído solo ese ítem
- Sonido opcional configurable
- Límite de 50 notificaciones (elimina las más viejas automáticamente)
- **Web Push (PWA)**: notificaciones push reales en el dispositivo, con toggle por usuario. El service worker se registra temprano en `main.jsx` (idempotente y best-effort); el despacho lo hace el trigger `notif_despachar_push` invocando la Edge Function `enviar-push`, con colapso por `grupo_key` para no apilar avisos casi iguales. Suscripciones en la tabla `push_suscripciones`
- Aviso a los `admin`/`super_admin` asignados cuando un `viewer` descarga piezas de un pedido — la descarga además queda registrada en el historial de actividad del pedido

### Usuarios
- Invitar usuarios por email (Supabase invite)
- Roles con permisos diferenciados
- Asignación de área de equipo
- Color de avatar personalizable por usuario

### Configuración
- Gestión de estados, tipos e instancias desde la UI (sin tocar código)
- Colores personalizables por ítem
- **Unificar y renombrar tags** en todos los pedidos de una sola vez (solo `super_admin`, RPC `unificar_tags`) — acompañado de normalización de tags en la base y validación de "tag pendiente" al guardar un pedido

### Herramientas

**Revisión de emails** — valida la estructura, links, imágenes y legales de una pieza HTML (pegada o por URL). Detecta coincidencias con plantillas obsoletas conocidas. El resultado se integra con Piezas entregables (revisión automática al cargar un link).

**Revisión de BBDD** — 4 pasos sobre una base de contactos (CSV/TXT): **Analizar** (validación general), **Verificar** (detalle de errores por fila), **Comparar** (diff contra otra base — dos modos de cálculo, rápido en memoria o seguro vía IndexedDB, según el tamaño) y **Segmentar** (armar condiciones AND/OR sobre las columnas — es igual a / contiene / empieza con / es vacío, etc. — y descargar el CSV filtrado). Comparar y Segmentar corren en Web Workers (`compare.worker.js` / `segmentar.worker.js`) en streaming, validado con bases de 400MB+ sin problemas de memoria.

**Revisión de envíos** — dos modos:
- **Comparar con mi base**: valida que los campos de personalización (`<*Campo*>`) de un mail tengan su columna correspondiente en el encabezado de la base de contactos, evitando que el envío real deje placeholders sin reemplazar. Solo lee las primeras líneas de cualquier archivo subido (encabezado + una muestra chica de filas) — nunca la base completa.
- **Generar base de test**: detecta los campos `<*Campo*>` de una pieza (pegada o por URL) y arma una base de test descargable (CSV) con un valor de prueba editable por campo — campos que el nombre delata como link o imagen arrancan con una URL real de ejemplo en vez de un placeholder de texto. Incluye preview en vivo de la pieza con los valores ya reemplazados (a tamaño real de escritorio, no la versión mobile) y permite cargar uno o más emails de destino, una fila de base por cada uno.

**Auditoría de Piezas** — escanea una lista de piezas (pegadas como texto simple `Nombre | URL` o pegando una tabla completa de Excel/Sheets) buscando coincidencias de texto visible, links o imágenes contra reglas definidas por el usuario (ej. "¿en cuáles de estas 40 piezas todavía aparece este link viejo?"). Devuelve piezas con coincidencia, sin coincidencia y con error, exportable como TXT.

**Editor de Piezas** — editor visual de emails por bloques drag-and-drop. La UI vive en `EditorPiezas.jsx`; toda la lógica pura de HTML (export, import, campos, redes, catálogo de bloques) vive en `src/lib/editor/` como funciones testeables sin React — ver "Arquitectura del Editor de Piezas" más abajo. Permite armar una pieza arrastrando bloques de contenido (texto, imágenes, módulos) desde una biblioteca lateral a un canvas central, con las siguientes capacidades:

- **Templates visuales** (ICBC / Avisos / Mall): cambian fondo, color de texto y borde de la pieza sin tocar el contenido de cada bloque. El color del borde sigue al header elegido (CG_* rojo, EB_* negro, PAY_* marrón), no al tema.
- **Header seleccionable**: 8 variantes (CG, CG Mall, CG Comex, CG Malba, EB, EB Malba, EB Inversiones, Pay Sueldos), seleccionable por click o drag. Las redes sociales del header se pueden reordenar por drag-and-drop y activar/desactivar individualmente.
- **Imagen principal e imagen de footer** opcionales.
- **Legales adicionales**: se pueden agregar varios bloques de texto legal sobre el legal fijo; opción "separar en secciones" (recomendada para Mall con legales largos).
- **Firma institucional** (FCI — ICBC Investments / Sociedad Gerente-Depositaria): sección fija de 2 filas × 2 columnas (izq/der) con 4 campos editables, toggle on/off.
- **Indicadores financieros**: filas de indicador (referencia, sigla, valor) agregables dinámicamente.
- **Preview en vivo** con switch Desktop/Mobile. Todos los previews del editor (y los de Revisión de emails/envíos) se renderizan en iframes con `sandbox` **sin** `allow-scripts`: el HTML de una pieza puede venir de afuera (importación por URL o pegado) y un `<script>` ahí adentro correría con el origen de la app — bloquearlo no cambia el render (los clientes de correo eliminan el JS igual) y de paso el preview se comporta más parecido a Gmail/Outlook.
- **Versión mobile propia** (mismo componente, árbol de UI aparte decidido por `useIsMobile`): navegación por pantallas y bottom-sheets (canvas, biblioteca, edición de bloque, menú, importar) en lugar del layout de 3 columnas, con preview full-screen. Mientras un sheet está abierto, el scroll de fondo se congela (`useLockAppScroll`).
- **Exportación**: "Descargar HTML" y "Copiar HTML" (al portapapeles, con feedback visual de 2s).
- **Borrador automático** en `localStorage` con debounce de 500ms — persiste al cambiar de sección y se restaura al volver. Botón "Reiniciar" con confirmación borra el borrador y resetea todo el estado.
- **Importación de piezas** (desde HTML pegado o URL): reconstruye el estado completo del editor a partir de una pieza ya exportada o de una pieza externa de la plataforma — ver sección dedicada más abajo.

### Arranque y errores
- **Splash de arranque** estático en `index.html`: CSS crítico embebido (pinta en el primer frame, sin esperar el bundle), isotipo armado 100% en CSS con animación "breathe". Vive **fuera** de `#root` para que React no lo pise al montar; `main.jsx` lo retira con fade garantizando un mínimo de exhibición de 2s (antes duraba lo que tardaba el bundle — con caché era un flash que parecía un error). La ruta `/PreviewDeCarga` (⚠️ temporal) permite verlo sin recargar.
- **Fondo de marca en toda la app**: `AuthBrandBackdrop` (el isotipo asomando en dos esquinas, bien clarito) se renderiza una sola vez en `AppLayout` para todas las páginas, y también en Login/SetPassword/ErrorPage.
- **ErrorBoundary + ErrorPage** de marca: si un chunk lazy quedó desactualizado tras un deploy, intenta **un** auto-reload (con bandera en `sessionStorage` para no loopear); si el error es otro, muestra la página de error con opción de recargar.

---

## Arquitectura del Editor de Piezas

`EditorPiezas.jsx` contiene únicamente la UI (componentes, estado de React, drag-and-drop). Toda la lógica de manipulación de HTML vive en `src/lib/editor/` como funciones puras string → string/estructura, sin React ni DOM (la regla de oro de "nunca DOMParser" aplica igual acá):

| Módulo | Qué contiene |
|--------|--------------|
| `constantes.js` | `TEMAS`, `LEGAL_FIJO_HTML`, `FIRMA_INSTITUCIONAL_DEFAULT`, `colorPorPrefijoHeader`, data de `REDES_SOCIALES` (los íconos React quedan en el JSX como `REDES_ICONOS`) |
| `bloques.js` | Catálogo de bloques cargado con `import.meta.glob` sobre los templates reales. Único módulo que depende de Vite — aislado a propósito |
| `htmlUtils.js` | Utilidades genéricas: `extraerTdsConBalance`, `formaDeTags`/`similitudDeForma`, `quitarWrapperSiEnvuelveTodo`, `normalizarNegritas`, `limpiarHtml*`, `validarUrl` |
| `campos.js` | `detectarCampos` / `actualizarCampoEnHtml` (contrato posicionOrden vs posicionContenido documentado ahí) |
| `redesSociales.js` | `detectarRedesSociales` / `reordenarRedesSociales` |
| `exportar.js` | `generarExport` + helpers de estilo (`construirCanvasStyles`, `aplicarColorTexto`/`revertirColorTexto`, `wrapPreview`) |
| `importar.js` | `importarDesdeHtml` (marcadores) + `importarHeuristico` (piezas externas) y todos sus clasificadores |
| `thumbs.js` | Miniaturas SVG de la biblioteca |

El grafo de dependencias es acíclico: `constantes` y `bloques` son hojas; `importar` es el único que depende de casi todo lo demás.

---

## Tests

```bash
npm test          # corre la suite una vez
npm run test:watch
```

La suite (Vitest, `src/**/__tests__/*.test.js`, entorno node — sin DOM) cubre la lógica pura más frágil del proyecto, usando los **templates HTML reales** de `src/data/Templates` como fixtures:

- **Roundtrip completo** `generarExport → importarDesdeHtml` con todo el estado posible: tema Mall (tinte/destinte de color), redes activas/inactivas y reordenadas, legales en modo corrido y separado, firma institucional, indicadores con sigla multi-palabra, imágenes principal/footer, y los caminos de fail-soft (slug desconocido → código personalizado con aviso).
- **Campos**: detección texto/imagen/link, exclusión de links sociales y de `<a>` dentro de texto editable, y el fix de vaciar-y-reescribir por `posicionOrden`.
- **Redes sociales**: detección por dominio y por `data-red`, reordenamiento estable, red desactivada que sigue siendo detectable.
- **htmlUtils**: balance real de `<td>` anidados, wrapper que envuelve todo vs. parcial, vector de forma de tags.
- **Revisión** (`lib/revision/generales.js`): `DetectarContenidoDuplicado` (incluyendo el descarte del `<style>` VML de la plataforma) y `DetectarInlineEnvolviendoOutlook`.
- **Notificaciones** (`lib/notificaciones.js`): agrupamiento por `grupo_key` (colapso de no leídas, ruteo de deep-links).
- **Comentarios** (`lib/comentarios.js`): formato de mención `@[Nombre](uuid)`, detección de links e imágenes.
- **Fechas** (`lib/fechas.js`): el criterio único de "vencido" compartido por toda la app.
- **Imágenes estructurales** (`lib/imagenesEstructurales.js`): el criterio compartido entre editor y revisión.

La config vive en `vitest.config.js` (separada de `vite.config.js` para no cargar los plugins de React/Tailwind al testear). Al agregar lógica nueva a `lib/editor`, `lib/revision` o cualquier módulo puro de `lib/` (notificaciones, comentarios, fechas…), sumá el caso ahí — estas funciones se rompen en silencio al ajustar una regex, y la suite es lo único que lo hace visible.

---

## Marcadores del Editor de Piezas

El HTML que exporta el Editor de Piezas (`Copiar HTML` / `Descargar HTML`, en `src/lib/editor/exportar.js` → `generarExport()`) incluye comentarios y atributos invisibles en cualquier cliente de correo. Son los cimientos del **sistema de importación** (botón "🔗 Importar" en el editor, ya habilitado) que puede reconstruir una pieza completa a partir de su HTML ya exportado (vía marcadores, 100% determinístico) o a partir de una pieza externa de la plataforma sin marcadores (vía heurística).

Esta sección documenta el formato exacto para que la implementación del parser no dependa de releer `generarExport()` línea por línea.

### Por qué existen

Sin marcadores, reconocer "esto es un bloque de tipo X" o "esto es la imagen principal" requiere inferir por estructura de tags — frágil, porque distintos bloques pueden compartir estructura parecida (varios `<tr><td>texto</td></tr>` se parecen entre sí). Con marcadores, el parser solo necesita buscar el comentario o atributo correspondiente; no hay ambigüedad.

### Regla de oro: nunca DOMParser

Todo el manipuleo de HTML en el editor (lectura y escritura) se hace **sobre el string crudo**, nunca con `DOMParser`/serialización del DOM — usar el DOM contamina el HTML con estilos computados por el browser y rompe el output. Cualquier parser de importación que se construya sobre estos marcadores debe seguir la misma regla: regex / manipulación de string, no DOM.

### Formato de cada marcador

| Zona | Marcador | Único o repetible | Notas |
|------|----------|:---:|-------|
| Bloque de contenido (cada ítem del canvas) | `<!--BLOQUE slug="X" idx="N"--> ... <!--/BLOQUE-->` | Repetible | `slug` = el mismo slug que usa `BLOQUES` (nombre del archivo `.html` sin extensión, en `Header/Contenido/Botones`). `idx` = posición del bloque en el array `canvas` (no un contador por slug) — necesario porque un mismo bloque puede repetirse varias veces en una pieza. |
| Banda de header | `<!--HEADER:slug--> ... <!--/HEADER-->` | Único | Sin `idx` — solo hay una banda de header por pieza. |
| Imagen principal | `<!--IMG_PRINCIPAL--> ... <!--/IMG_PRINCIPAL-->` | Único | Solo aparece si `imgPrincipal.activo && imgPrincipal.src`. |
| Imagen de footer | `<!--IMG_FOOTER--> ... <!--/IMG_FOOTER-->` | Único | Solo aparece si `imgFooter.activo && imgFooter.src`. |
| Firma institucional | `<!--FIRMA_INSTITUCIONAL--> ... <!--/FIRMA_INSTITUCIONAL-->` | Único | Envuelve las 2 filas de firma (ICBC Investments / Sociedad Gerente-Depositaria). Cada celda lleva un span con atributo `data-firma-fila1-izq`, `data-firma-fila1-der`, `data-firma-fila2-izq` o `data-firma-fila2-der` según posición. Si la heurística detecta la sección sin marcadores (2 `<td class="Texto_Legales">` izq/der sin colspan, patrón exclusivo de esta sección), la fila 2 queda vacía si no viene en el HTML real — nunca se inventa contenido. |
| Indicadores | `<!--INDICADORES--> ... <!--/INDICADORES-->` | Único (agrupa todas las filas) | Envuelve **todo el grupo** de indicadores, no cada fila individualmente. Si se necesitara reimportar cada indicador por separado, hay que parsear las filas internas por estructura (son todas idénticas entre sí: `<sup>{ref}</sup> {sigla} {valor}`), no por marcador — o sumar un marcador por fila el día que haga falta. |
| Legal adicional | `<span data-legal-especifico="true" data-legal-idx="N">` | Repetible | `data-legal-idx` es un atributo **separado** del flag de tipo, a propósito — `data-legal-especifico="true"` dice *qué es* el span, `data-legal-idx` dice *qué posición* ocupa en el array `legalesAdicionales`. No se mezclan en un solo atributo para no romper ningún chequeo que solo necesite el tipo. |
| Legal fijo | `<span data-legal-fijo="true">` | Único | Sin `idx` — es siempre el mismo texto institucional, no se repite. |

**Por qué `idx` es un atributo del comentario y no parte del slug** (`<!--BLOQUE slug="x" idx="0"-->`, no `<!--BLOQUE:x:0-->`): un slug con dos puntos o guion bajo no introduce ambigüedad de dónde corta un `split`. El formato de atributos con comillas es parseable con un regex simple y sin casos borde:

```js
/<!--BLOQUE\s+slug="([^"]+)"\s+idx="(\d+)"-->/g
```

### Estado de implementación

1. **Parser de marcadores** — **implementado** (`importarDesdeHtml()` en `src/lib/editor/importar.js`). Lee el HTML completo buscando cada marcador de la tabla arriba y reconstruye el estado equivalente al que recibe `generarExport`. El bloque de contenido se reconstruye cruzando el `slug` contra `BLOQUES` (mismo patrón que ya usa `headerDesdeSlug()` al restaurar el borrador de `localStorage`), tomando el HTML interno del marcador como `htmlEditado`.

   - **Tema**: sin marcador propio — se infiere por igualdad exacta contra el `<td>` específico que `generarExport` usa para `bgContenido` (no contra el color suelto en cualquier parte del HTML, que puede coincidir por casualidad con el color de la banda de header).
   - **Color de texto**: si el tema detectado no es ICBC, el HTML interno de cada bloque tiene el color del tema "quemado" (`aplicarColorTexto` lo escribe así al exportar) — `revertirColorTexto()` lo revierte al valor base `#333333` antes de guardarlo como `htmlEditado`, para que cambiar de tema después de importar siga funcionando igual que en una pieza armada nativamente en el editor.
   - **Slug desconocido** (template renombrado/borrado desde que se exportó esa pieza): ese bloque puntual entra como "Código personalizado" con su contenido intacto, en vez de fallar la importación completa — la función devuelve `{ resultado, avisos }`, nunca tira excepción por un problema parcial.
   - **HTML sin ningún marcador de bloque**: `resultado` es `null` — no es un caso de "bloques desactualizados", es "no hay nada reconocible".
   - Validado con una batería de pruebas manuales (roundtrip básico, bloques repetidos del mismo slug, tema Mall con reversión de color, legales corridos/separados, imágenes, indicadores, slug desconocido, HTML ajeno) — no hay suite automatizada corriendo en CI todavía, las pruebas se hicieron ad hoc durante el desarrollo.

2. **Heurística sin marcadores** (caso "pieza externa", armada fuera de este editor o de una versión vieja sin marcadores) — **implementada** (`importarHeuristico()`, en `src/lib/editor/importar.js` junto a `importarDesdeHtml()`). Se usa solo cuando `importarDesdeHtml()` devuelve `resultado: null` (no encontró ningún marcador).

   Validada contra **10 piezas reales de la plataforma + 1 pieza vieja de 2019** (no contra un solo supuesto) — el análisis confirmó **tres familias estructurales reales**, no una sola con variaciones menores:

   - **Familia A** (la mayoría de las piezas modernas: newsletters con banda de redes sociales en el header — EB, Mall, MALBA, etc.): el contenedor de contenido es `<td style="width: 530px; ...padding: 35px;">` con `<table id="Show" style="max-width: 530px;">` adentro — `id="Show"` está siempre presente en esta familia.
   - **Familia B** (comunicaciones de Inversiones/Empresas, sin banda de redes — ON, Split Payments, Sueldos): el contenedor exterior es `<td style="max-width: 600px; padding: 35px;">` (max-width 600, no width 530) y la tabla de contenido interna **no tiene** `id="Show"`.
   - **Familia C** (piezas viejas, vista en una pieza real de 2019): ni `id="Show"` ni ningún ancho de 530px en absoluto — la tabla de contenido declara `max-width: 600px` igual que la pieza entera, y confía solo en el `padding: 35px` del `<td>` que la envuelve para angostarse visualmente. Ese `<td>` sí tiene un ancla estable: `padding: 35px` combinado con `background-color` de alguno de los 3 temas conocidos, en cualquier orden dentro del atributo `style` (confirmado: en la pieza de 2019 el orden real era `padding` antes de `background-color`, al revés de cómo lo escribe `generarExport`).

   El rasgo común a las tres, confirmado sin excepción: la tabla de contenido real es la única `<table>` con `max-width` o `width` igual a 530 (Familias A/B) o, en su defecto, la primera `<table>` que aparece dentro del `<td>` con el combo `padding: 35px` + color de tema (Familia C). `encontrarTablaContenido()` prueba estas tres anclas en orden de confiabilidad — `id="Show"` primero (100%), ancho 530px después, combo de color como último recurso — nunca al revés.

   También confirmado en la muestra: puede haber wrappers externos variables que esta misma plataforma no siempre genera igual (una de las 10 piezas traía un `<table id="Table_01">` envolviendo *toda* la pieza, que no existe en la plantilla del editor) — por eso la función nunca ancla el inicio del parseo a comentarios como `<!-- INICIO CONTENEDOR -->`, va directo a buscar la tabla de contenido sin importar qué la envuelve por fuera. Los comentarios manuales del diseñador (`<!-- INICIO CAJA -->`, `<!-- CONOCE MÁS -->`, etc., vistos en varias piezas) son ruido — anotaciones personales, no marcadores estructurales — y no se usan como ancla de nada.

   - **Separación de bloques**: cada `<tr>` de nivel superior dentro de la tabla de contenido (con balance real de profundidad, no regex naive) es un bloque candidato completo — confirmado contra los 9 templates de `BLOQUES_CONTENIDO`, desde 1 hasta 8 `<tr>` internos, sin excepción.
   - **Reconocimiento de cada bloque**: compara la *forma* del fragmento (cantidad de cada tag — `tr`, `td`, `table`, `img`, etc. — más un bucket grueso de cuánto texto visible tiene) contra cada template conocido, no el contenido de texto en sí. La dimensión de texto fue necesaria tras un bug real encontrado en testing: un párrafo simple y un espaciador vacío tienen *exactamente* la misma forma de tags (un `<tr>` y un `<td>`, nada más) y sin distinguir el volumen de texto el espaciador "ganaba" por coincidencia perfecta de tags. Por debajo del umbral de similitud (`UMBRAL_SIMILITUD_BLOQUE`, calibrado contra los 9 templates reales — no es 100% confiable con muy pocos templates de referencia, conviene recalibrar si se agregan muchos más), el bloque entra como "Código personalizado" en vez de forzar un match incorrecto.
   - **Tema**: a diferencia de `importarDesdeHtml()` (donde el HTML viene siempre de `generarExport`, con un orden de atributos fijo y conocido), acá la pieza puede ser de cualquier época, así que la detección no busca un substring exacto. Dos bugs reales encontrados y corregidos en testing contra la pieza de 2019: (1) buscar el color en *todo* el HTML da falso positivo casi siempre, porque el `<td>` exterior que envuelve la pieza completa también tiene fondo blanco (`background-color: #ffffff; bgcolor="#ffffff"`, el blanco general de la plantilla, no el del tema) y aparece *antes* que el verdadero `<td>` de contenido — por eso la búsqueda se acota a una ventana inmediatamente anterior a la tabla de contenido recién encontrada, no a todo el documento. (2) Dentro de esa ventana, el `<td>` de color no es necesariamente el más cercano en texto a la tabla (puede haber otro `<td>` intermedio sin color, como el de `width:530px;padding:35px` en Familia A) — la búsqueda toma el *primer* `<td>` con color de tema dentro de la ventana, no el último.
   - **Header**: no se intenta adivinar cuál era exactamente (compartir color de banda no implica el mismo slug — un header CG y su variante Mall pueden ser ambos rojos) — la función avisa explícitamente que hay que revisar y volver a seleccionarlo en vez de adivinar uno concreto.
   - **Confianza**: la función devuelve `confianza` (`'alta'` | `'media'` | `'baja'`) además de `{ resultado, avisos }` — alta solo si vino por `id="Show"` y casi todos los bloques matchearon bien; baja si no se pudo identificar ninguna tabla de contenido reconocible. La UI debe tratar confianza baja (o `resultado: null`) como "no se pudo reconocer con seguridad — preferible armar la pieza a mano", nunca mostrarlo como un resultado parcial silencioso.

3. **Entrada de datos** — **implementada** (modal "Importar pieza" en `EditorPiezas.jsx`, botón "🔗 Importar" del header del canvas). Flujo en 3 pasos dentro del mismo modal, sin un `ConfirmModal` aparte:

   1. **Entrada**: tabs HTML (pegar) / URL, mismo patrón visual que Revisión de emails y Revisión de envíos pero con clases propias (`ep-importar-*`, sin depender de `.re-tabs` externo — ver nota más abajo). El modo URL reusa el proxy `/api/proxy` tal cual, sin cambios.
   2. **Análisis**: llama a `importarDesdeHtml()` primero; solo si devuelve `resultado: null` (ningún marcador encontrado) cae a `importarHeuristico()`.
   3. **Resumen + preview**: muestra cuántos bloques se detectaron, los avisos de cualquiera de las dos funciones, y un preview real renderizado del resultado (mismo `generarExport()` que usa la Vista previa de la pieza en curso) — para que el usuario vea el resultado antes de aceptar, no solo un texto descriptivo.

   El botón final ("Cargar en el editor") cumple una doble función a propósito: confirma la importación y, si había contenido armado en el canvas, lo reemplaza — no hay una segunda confirmación tipo "esto va a borrar lo que tenías", el mismo gesto cubre ambas cosas. Solo se **bloquea** cuando `resultado` es `null` (no hay absolutamente nada reconocible para cargar); con `confianza: 'baja'` pero `resultado` no-null (la heurística sí armó algo, aunque con poca certeza) el botón queda habilitado, cambiando de texto a "Cargar igual (no recomendado)" — nunca se le impide al usuario decidir cuando hay datos reales, solo se le avisa con claridad.

4. **Feedback visual de bloques no reconocidos** — **implementado** (`marcarBloquesNoReconocidosParaPreview()` en `src/lib/editor/importar.js`). En el preview del paso 3, los bloques que no matchearon ningún template se marcan visualmente antes de que el usuario confirme:

   - **Outline punteado amarillo** + etiqueta "No reconocido": bloque que cayó como código personalizado (no matcheó ningún template por similitud insuficiente).
   - **Outline punteado rojo** + etiqueta "Fuera de lugar": bloque detectado fuera del área de contenido esperada (posible HTML mal armado en la pieza original).
   - Cada aviso clickeable en la lista tiene un **link directo al bloque marcado en el preview**: hace scroll suave hasta él y dispara un pulso de resaltado breve (animación `ep-preview-pulso`, se reinicia si se hace click dos veces sobre el mismo aviso).
   - El marcado vive **solo en este preview** — `marcarBloquesNoReconocidosParaPreview()` es un post-proceso separado de `generarExport()`. El HTML real que se exporta/copia nunca lleva outlines ni etiquetas.
   - El preview de importación también tiene switch **Desktop/Mobile** (independiente del switch del modal de Vista previa principal).

   **Nota de inconsistencia preexistente, no resuelta acá**: el editor ya usaba `.re-tabs` (clase definida en `RevisionEmail.css`) en dos lugares (selector de template ICBC/Avisos/Mall, switch Desktop/Mobile del preview) sin definirla en su propio `EditorPiezas.css` — contradice la regla de arquitectura de CSS aislado por herramienta. La UI de importación nueva usa clases 100% propias (`ep-importar-tabs`, no `.re-tabs`) para no sumar más a esa misma inconsistencia, pero los dos usos viejos quedan sin tocar.

---

## Roles y permisos

| Rol | Crear pedidos | Editar pedidos | Gestión usuarios | Papelera | Configuración |
|-----|:---:|:---:|:---:|:---:|:---:|
| `super_admin` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `admin` | ✅ | ✅ | ✅ | ❌ | ✅ |
| `colaborador` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `viewer` | ❌ | ❌ | ❌ | ❌ | ❌ |

Matices por fuera de la tabla: el **borrado definitivo** desde la Papelera es solo `super_admin` (la tabla refleja el acceso a la sección); **unificar/renombrar tags** en Configuración es solo `super_admin`; los **comentarios internos** no existen para `viewer` (UI + Realtime + RLS); **Estadísticas** es visible para `admin` y `super_admin`.

---

## Estructura del proyecto

```
src/
├── components/
│   ├── ErrorBoundary.jsx           # Captura errores de render; auto-reload único si el chunk quedó viejo tras un deploy
│   ├── auth/
│   │   ├── ProtectedRoute.jsx
│   │   ├── PerfilUsuario.jsx       # Modal de perfil del usuario logueado
│   │   ├── CambiarPassword.jsx     # Modal de cambio de contraseña (usado desde PerfilUsuario)
│   │   └── AuthBrandBackdrop.jsx   # Isotipo de fondo en dos esquinas — Login/SetPassword/ErrorPage y toda la app vía AppLayout
│   ├── layout/
│   │   ├── AppLayout.jsx           # Sidebar, topbar mobile, toasts
│   │   ├── BuscadorGlobal.jsx      # Command palette (Cmd/Ctrl+K)
│   │   └── LogoRotator.jsx         # Rotador de logos icomm/ICBC (blur dissolve) del sidebar y la topbar mobile — el splash de arranque real vive en index.html
│   ├── pedidos/
│   │   ├── PedidoForm.jsx          # Modal crear/editar pedido
│   │   ├── PedidoCard.jsx          # Card de pedido (avatar, colorAvatar, iniciales)
│   │   ├── ComentariosSection.jsx  # Comentarios internos: menciones, reacciones, deep-link — nunca se monta para viewer
│   │   ├── EntregablesSection.jsx  # Piezas + revisión automática integrada
│   │   ├── BaseDatosSection.jsx    # Sección "Base de datos" — adjuntar base y verificar compatibilidad (ver Funcionalidades)
│   │   ├── SubtareasTimeline.jsx   # Subtareas + flujo de registro en Sheet (Diseño)
│   │   ├── SheetModal.jsx          # Modal de registro en Sheet (pedido completo)
│   │   ├── SheetDisenoModal.jsx    # Modal de registro en Sheet (subtarea Diseño)
│   │   ├── PedidoHistorial.jsx     # Timeline de actividad
│   │   ├── PedidosList.jsx         # Lista con filtros
│   │   ├── DetalleAcordeon.jsx     # Acordeón con ícono+badge, usado en las 4 secciones de Detalle de Pedido
│   │   ├── DetalleInfoBloques.jsx  # Bloques de info del header de Detalle de Pedido
│   │   ├── EstadoPopover.jsx       # Popover de cambio de estado (con registro de actividad)
│   │   ├── Section.jsx             # Acordeón genérico reusable (usado fuera de Detalle de Pedido)
│   │   ├── SuccessModal.jsx        # Modal de confirmación genérico (ícono ✓ + mensaje)
│   │   └── CopyBtn.jsx             # Botón "copiar al portapapeles" con feedback de 1.5s
│   ├── revision/
│   │   └── ResultadoPanel.jsx      # Cards de resultado de Revisión de emails
│   ├── revision-base/
│   │   ├── CompareTabBase.jsx      # Pestaña "Comparar" de Revisión de BBDD
│   │   └── SegmentarTabBase.jsx    # Pestaña "Segmentar" de Revisión de BBDD (filtros AND/OR + export CSV)
│   └── ui/
│       ├── Badge.jsx
│       ├── ConfirmModal.jsx
│       ├── DatePicker.jsx
│       ├── GrupoLabel.jsx          # Label "Pedidos Activos/Finalizados"
│       ├── CargaTrabajoModal.jsx
│       ├── HelpPopover.jsx         # Ícono de ayuda clickeable con popover (reemplaza texto explicativo siempre visible)
│       └── TagSearch.jsx
├── context/
│   ├── AuthContext.jsx              # Sesión y perfil del usuario
│   ├── NotificacionesContext.jsx    # Notificaciones + sistema de toasts
│   └── ThemeContext.jsx             # Dark / light mode
├── hooks/
│   ├── createCachedResource.js      # Fábrica del patrón "fetch con cache compartido" que usan los hooks de catálogos
│   ├── useActividad.js              # Registro de actividad en pedidos
│   ├── useComentarios.js            # Comentarios internos: carga, realtime, reacciones, borrador persistente
│   ├── useDocumentTitle.js          # Título del documento por página
│   ├── useEstadisticas.js           # Datos de la pantalla Estadísticas (RPC estadisticas_periodo)
│   ├── useEstados.js                # Estados (con cache)
│   ├── useInstancias.js             # Instancias (con cache)
│   ├── useIsMobile.js               # Hook reactivo de breakpoint (resize listener, no solo lectura una vez)
│   ├── useLocalStorage.js           # Lectura lazy + escritura con try/catch (usado por el borrador del Editor de Piezas)
│   ├── useLockAppScroll.js          # Congela el scroll de fondo mientras hay overlays mobile abiertos (drawer, sheets del editor)
│   ├── usePedidos.js                # CRUD de pedidos + realtime + paginación + lock optimista contra updates perdidos
│   ├── usePush.js                   # Suscripción/desuscripción a Web Push (toggle por usuario)
│   ├── useTagsDisponibles.js        # Tags únicos de TODOS los pedidos, sin paginar (para el selector de filtro)
│   ├── useTipos.js                  # Tipos (con cache)
│   └── useUsuarios.js               # Usuarios (con cache compartido entre instancias del hook)
├── data/
│   └── Templates/
│       ├── index.js                 # Solo exporta el template marcado `deprecado: true`, para Revisión de emails
│       └── ICBC/
│           ├── Header/              # Bandas de header — cargadas por import.meta.glob, no requieren tocar código
│           ├── Contenido/           # Bloques de contenido — idem
│           ├── Botones/             # Bloques de botones/CTA — idem
│           └── Modulos_Obsoletos.html
├── lib/
│   ├── __tests__/                   # Suite de Vitest (ver sección Tests)
│   ├── constants.js                 # Roles, prioridades, colores
│   ├── supabase.js                  # Cliente Supabase
│   ├── supabaseHelper.js            # Helpers runSupabase / runSupabaseSilent
│   ├── avatares.js                  # Iniciales y colores de avatar (antes vivía en PedidoCard)
│   ├── comentarios.js               # Lógica pura de comentarios (parseo de menciones, links, imágenes)
│   ├── fechas.js                    # Criterio único de "vencido" compartido por toda la app
│   ├── imagenesEstructurales.js     # Criterio compartido de imágenes/separadores estructurales (editor + revisión)
│   ├── notificaciones.js            # Agrupado por grupo_key y ruteo de deep-links de la campanita
│   ├── push.js                      # Registro del service worker + helpers de suscripción Web Push
│   ├── severidad.js                 # Escala de severidad compartida (antes vivía en PedidoCard)
│   ├── descargarPiezas.js           # Descarga de piezas (ZIP o individual) con validación de estructura previa
│   ├── auditoria/                   # Lógica de Auditoría de Piezas
│   │   └── ejecutarAuditoria.js
│   ├── revision/                    # Lógica de Revisión de emails
│   │   ├── config.js
│   │   ├── ejecutarRevision.js
│   │   ├── generales.js
│   │   ├── helpers.js
│   │   ├── imagenes.js
│   │   └── templates.js
│   └── revision-envios/             # Lógica de Revisión de envíos
│       ├── comparar.js              # Modo "Comparar con mi base"
│       ├── generarBase.js           # Modo "Generar base de test"
│       ├── animarProgreso.js        # Animación de progreso compartida por los dos modos
│       └── versionesPieza.js        # Detecta sufijos _v1/_v2/etc. en el nombre y filtra a la última versión (usado por BaseDatosSection)
├── pages/
│   ├── AuditoriaPiezas.jsx          # Auditoría de Piezas
│   ├── Calendario.jsx
│   ├── Configuracion.jsx
│   ├── Dashboard.jsx
│   ├── ErrorPage.jsx                # Página de error de marca (usada por ErrorBoundary)
│   ├── Estadisticas.jsx             # Pantalla de Estadísticas (admin + super_admin)
│   ├── Login.jsx
│   ├── Notificaciones.jsx
│   ├── Papelera.jsx
│   ├── PedidoDetalle.jsx
│   ├── Pedidos.jsx
│   ├── PreviewCarga.jsx             # ⚠️ TEMPORAL — preview del splash de arranque, borrar al aprobarlo definitivamente
│   ├── RevisionEmail.jsx            # Revisión de emails
│   ├── RevisionBase.jsx             # Revisión de BBDD
│   ├── RevisionEnvios.jsx           # Revisión de envíos
│   ├── EditorPiezas.jsx             # Editor de piezas — solo la UI; la lógica está en lib/editor/
│   ├── SetPassword.jsx
│   └── Usuarios.jsx
├── workers/
│   ├── validator.worker.js          # Análisis de Revisión de BBDD
│   ├── compare.worker.js            # Comparación de Revisión de BBDD (modo seguro)
│   ├── segmentar.worker.js          # Segmentación de Revisión de BBDD (streaming, filtros AND/OR)
│   └── worker-utils.js              # Lectura/parseo de archivos compartido entre los 3 workers
└── styles/
    ├── global.css                   # Variables CSS, componentes, dark/light
    ├── RevisionEmail.css            # Aislado, propio de esa herramienta
    ├── RevisionBase.css             # Aislado, propio de esa herramienta
    ├── RevisionEnvios.css           # Aislado, propio de esa herramienta
    ├── AuditoriaPiezas.css          # Aislado, propio de esa herramienta
    ├── EditorPiezas.css             # Aislado, propio de esa herramienta
    └── Estadisticas.css             # Aislado, propio de esa pantalla
```

---

## Edge Functions (Supabase)

| Función | Descripción |
|---------|-------------|
| `invite-user` | Invita un usuario nuevo vía Supabase Auth |
| `delete-user` | Elimina un usuario de Auth y su perfil |
| `reset-user-password` | Fuerza el reset de contraseña de otro usuario — solo `super_admin` |
| `escribir-sheet` | Escribe una fila en Google Sheets (hoja pedidos o diseño) — soporta repeticiones de día/horario al registrar |
| `enviar-push` | Envía las notificaciones Web Push (VAPID) a las suscripciones del usuario — invocada por el trigger `notif_despachar_push`, con colapso por `grupo_key` |

---

## Funciones SQL (Supabase)

| Función | Descripción |
|---------|-------------|
| `listar_pedidos` | RPC central de listado/búsqueda/paginación de pedidos. Modos: `normal` (paginado, excluye finalizados por defecto), `historico`, `vencimiento` (sin límite de antigüedad, incluye finalizados — usado por Calendario), `dashboard`. Con búsqueda de texto, indica además en qué campo coincidió (`coincidencia_en`: asunto/tag/pieza/persona), usado por el buscador global. |
| `estadisticas_periodo` | Cómputo completo de la pantalla Estadísticas en la base (KPIs + series), con filtros de fechas, tipo, instancia y usuario — el front no calcula nada. |
| `eliminar_pedido_definitivo` | Borrado definitivo desde la Papelera — solo `super_admin`. |
| `unificar_tags` | Unificar/renombrar un tag en todos los pedidos (Configuración) — solo `super_admin`. |
| `eliminar_comentario` | Moderación de comentarios internos (NULL-safe; el autor no puede resucitar un comentario moderado). |
| Familia `notif_*` | Triggers que crean los eventos de notificación: `notif_asignacion`, `notif_cambio_estado`, `notif_aprobacion`, `notif_vencimientos`, `notif_comentario_nuevo`/`_editado`, `notificar_descarga_pieza` y `notif_despachar_push` (el que dispara la Edge Function de push). Todos escriben eventos inmutables con `grupo_key`. |

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

**Nota:** el modo URL de Revisión de emails, Revisión de envíos, Auditoría de Piezas, "Base de datos" del pedido y la descarga de piezas dependen todos de la misma función serverless de Vercel `/api/proxy.js` (no confundir con las Edge Functions de Supabase de la tabla arriba — corre como función Node normal porque usa `dns`/`net`, incompatibles con runtime edge), que solo corre en el deploy de Vercel — en local, el modo URL puede no funcionar; usar el modo "Pegar HTML" (donde esté disponible) para probar esa lógica sin depender del proxy.

---

## Deploy

El proyecto se deploya automáticamente en Vercel al hacer push a `main`. Las variables de entorno se configuran desde el panel de Vercel.

---

## Tema

La app soporta modo oscuro y claro. El tema se guarda en `localStorage` y se aplica via `data-theme` en el `<html>`. Las variables CSS están definidas en `global.css` bajo `[data-theme="dark"]` y `[data-theme="light"]`. Las secciones con CSS propio (4 herramientas de revisión/auditoría + Editor de Piezas + Estadísticas) tienen su hoja aislada, con sus propias variables semánticas mapeadas a las del tema general (no usan `global.css` directamente, para evitar colisiones de nombres de clase).