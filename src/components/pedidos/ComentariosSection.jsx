import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { useNotificaciones } from '@/context/NotificacionesContext'
import { colorAvatar, iniciales } from '@/lib/avatares'
import {
  EMOJIS_COMPOSER,
  EMOJIS_REACCION,
  agruparReacciones,
  contenidoAFormularioAmigable,
  detectarMencionActiva,
  extraerMenciones,
  extraerUrlsDeImagen,
  filtrarUsuarios,
  insertarMencionAmigable,
  reconstruirMenciones,
  segmentarContenido,
} from '@/lib/comentarios'
import { Pencil, Trash2, SmilePlus, Smile, SendHorizontal, ExternalLink, Copy } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

// Conversación interna del equipo sobre un pedido. Esta sección NUNCA
// se monta para el rol viewer (lo decide PedidoDetalle) y aunque se
// montara, RLS devuelve 0 filas — la barrera real está en la base.
//
// Diseño: dirección "1b — Aireado (estilo Slack)" del mockup aprobado.
// Todos los tokens de color vienen de las variables del tema (ver el
// mapeo comentado al inicio del bloque .coment-* en global.css).
//
// El contenido del usuario jamás pasa por dangerouslySetInnerHTML: el
// render intercala spans de React (RenderContenido) — XSS imposible
// por construcción.
//
// POPOVERS CON position: fixed — no absolute. El acordeón que contiene
// la sección anima con grid-template-rows y su .acordeon-anim-clip
// lleva overflow: hidden (necesario para esa animación): cualquier
// popover absolute de adentro queda RECORTADO por ese clip. fixed
// posiciona contra el viewport y escapa de todo contexto de overflow;
// usePosicionFija mide el ancla al abrir y re-mide en scroll (captura,
// para cubrir el scroll interno de la lista) y resize.

// Auto-crecimiento tipo Slack: el textarea sube de alto con el
// contenido (así Shift+Enter no "esconde" la línea anterior arriba,
// como pasaba con una altura fija) hasta un tope, a partir del cual
// scrollea internamente en vez de seguir creciendo. Se recalcula en
// cada cambio de `value` — cubre tipeo, inserción de mención y de
// emoji, todos pasan por acá porque todos terminan cambiando `value`.
const ALTO_MAXIMO_TEXTAREA = 160 // ~7-8 líneas antes de scrollear

function useAutoAltura(taRef, value) {
  useLayoutEffect(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, ALTO_MAXIMO_TEXTAREA) + 'px'
  }, [taRef, value])
}

function usePosicionFija(abierto, anchorRef) {
  const [rect, setRect] = useState(null)
  useLayoutEffect(() => {
    if (!abierto || !anchorRef.current) { setRect(null); return }
    const medir = () => {
      const el = anchorRef.current
      if (el) setRect(el.getBoundingClientRect())
    }
    medir()
    window.addEventListener('resize', medir)
    window.addEventListener('scroll', medir, true) // true: también scrolls internos
    return () => {
      window.removeEventListener('resize', medir)
      window.removeEventListener('scroll', medir, true)
    }
  }, [abierto, anchorRef])
  return rect
}

// Estilo inline del popover fijo. Por default abre ARRIBA del ancla
// (patrón chat: el input está abajo); si no hay lugar (ancla cerca del
// borde superior del viewport), abre abajo. alinear 'derecha' pega el
// borde derecho del popover al del ancla (para botones al borde).
function estiloPopover(rect, { alinear = 'izquierda', altoEstimado = 240 } = {}) {
  if (!rect) return { display: 'none' }
  const arriba = rect.top > altoEstimado + 12
  const s = { position: 'fixed', zIndex: 200 }
  const transformas = []
  if (arriba) { s.top = rect.top - 6; transformas.push('translateY(-100%)') }
  else s.top = rect.bottom + 6
  if (alinear === 'derecha') { s.left = rect.right; transformas.push('translateX(-100%)') }
  else s.left = rect.left
  if (transformas.length) s.transform = transformas.join(' ')
  return s
}

// Dominio legible para el chip de link ("cdn.icomm.com" en vez de la
// URL completa) — si por algo raro no parsea (URL mal formada que
// igual matcheó la regex laxa), se muestra el link crudo como fallback
// en vez de romper el render.
function dominioDe(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

// Copiar al portapapeles — compartido entre el chip de link y la
// miniatura de imagen. navigator.clipboard requiere contexto seguro
// (https, o localhost en desarrollo); si por lo que sea falla (permiso
// denegado, navegador viejo), se avisa en vez de fallar en silencio.
async function copiarAlPortapapeles(texto, showSuccess, showError) {
  try {
    await navigator.clipboard.writeText(texto)
    showSuccess('Copiado al portapapeles')
  } catch {
    showError('No se pudo copiar')
  }
}

function RenderContenido({ contenido }) {
  const { showSuccess, showError } = useNotificaciones()
  return (
    <>
      {segmentarContenido(contenido).map((seg, i) => {
        if (seg.tipo === 'mencion') return <span key={i} className="coment-mencion">@{seg.valor}</span>
        if (seg.tipo === 'url') {
          // El chip (adentro, clickeable) redirige; el botón de copiar
          // va PEGADO afuera, a la derecha — dos zonas de click
          // distintas en una sola píldora visual.
          return (
            <span key={i} className="coment-url-wrap">
              <a href={seg.valor} target="_blank" rel="noopener noreferrer" className="coment-url-chip">
                <ExternalLink size={11} />{dominioDe(seg.valor)}
              </a>
              <button
                type="button"
                className="coment-url-copy"
                title="Copiar link"
                onClick={() => copiarAlPortapapeles(seg.valor, showSuccess, showError)}
              >
                <Copy size={11} />
              </button>
            </span>
          )
        }
        return <span key={i}>{seg.valor}</span>
      })}
    </>
  )
}

// Miniatura de una imagen pegada como link. Si la imagen no carga (404,
// bloqueada por el sitio de origen, etc.) se oculta sola en vez de
// mostrar el ícono roto del navegador — el chip de arriba (dentro del
// texto) sigue ahí como respaldo para abrirla o copiarla igual.
//
// El botón de copiar es HERMANO del <a>, no está anidado adentro:
// un <button> dentro de un <a> es HTML inválido y complica el evento
// (necesitaría stopPropagation para no disparar la navegación). Como
// hermano, con position:absolute sobre el mismo contenedor relativo,
// el click en el botón nunca llega al link de abajo.
function ImagenPreview({ url }) {
  const [error, setError] = useState(false)
  const { showSuccess, showError } = useNotificaciones()
  if (error) return null
  return (
    <div className="coment-imagen-wrap">
      <a href={url} target="_blank" rel="noopener noreferrer" className="coment-imagen-link">
        <img src={url} alt="" loading="lazy" className="coment-imagen-preview" onError={() => setError(true)} />
      </a>
      <button
        type="button"
        className="coment-imagen-copy"
        title="Copiar ruta de la imagen"
        onClick={() => copiarAlPortapapeles(url, showSuccess, showError)}
      >
        <Copy size={13} />
      </button>
    </div>
  )
}

// Hook compartido: detección de @mención en curso + inserción de emoji
// en el cursor + auto-crecimiento del textarea. Usado tanto por el
// composer de comentario nuevo (fila con ícono de emoji + botón de
// enviar) como por la edición inline (caja bordeada con
// Cancelar/Guardar) — misma lógica, dos wrappers visuales distintos,
// fieles al mockup aprobado.
//
// La mención se inserta con insertarMencionAmigable: el textarea
// SOLO muestra "@Nombre", nunca el token @[Nombre](uuid) — el uuid no
// tiene por qué estar a la vista mientras se escribe, y mostrarlo
// crudo confundía. La reconstrucción al formato persistido pasa recién
// al enviar/guardar (reconstruirMenciones, en el componente padre).
function useComposerLogica(value, onChange, taRef) {
  const [mencion, setMencion] = useState(null) // { inicio, query } | null
  const [idxActivo, setIdxActivo] = useState(0)

  useAutoAltura(taRef, value)

  const refrescarMencion = (texto, cursor) => {
    const activa = detectarMencionActiva(texto, cursor)
    setMencion(activa)
    if (activa) setIdxActivo(0)
  }

  function handleChange(e) {
    onChange(e.target.value)
    refrescarMencion(e.target.value, e.target.selectionStart)
  }

  function elegirUsuario(u) {
    const cursor = taRef.current?.selectionStart ?? value.length
    const { texto, cursor: nuevoCursor } = insertarMencionAmigable(value, mencion.inicio, cursor, u)
    onChange(texto)
    setMencion(null)
    requestAnimationFrame(() => {
      taRef.current?.focus()
      taRef.current?.setSelectionRange(nuevoCursor, nuevoCursor)
    })
  }

  function insertarEmoji(emoji) {
    const ta = taRef.current
    const pos = ta?.selectionStart ?? value.length
    const nuevo = value.slice(0, pos) + emoji + value.slice(ta?.selectionEnd ?? pos)
    onChange(nuevo)
    requestAnimationFrame(() => {
      ta?.focus()
      ta?.setSelectionRange(pos + emoji.length, pos + emoji.length)
    })
  }

  return { mencion, setMencion, idxActivo, setIdxActivo, handleChange, elegirUsuario, insertarEmoji, refrescarMencion }
}

function PopupMenciones({ candidatos, idxActivo, setIdxActivo, elegirUsuario, rect, altoEstimado }) {
  return (
    <div className="coment-mention-popup" role="listbox" style={estiloPopover(rect, { altoEstimado })}>
      {candidatos.map((u, i) => (
        <button
          key={u.id}
          type="button"
          role="option"
          aria-selected={i === idxActivo}
          className={`coment-mention-item${i === idxActivo ? ' activo' : ''}`}
          // onMouseDown (no onClick) para ganarle al blur del textarea.
          onMouseDown={(e) => { e.preventDefault(); elegirUsuario(u) }}
          onMouseEnter={() => setIdxActivo(i)}
        >
          <span className="avatar-xs-secondary" style={{ background: u.avatar_color || colorAvatar(u.id) }}>
            {iniciales(u.full_name)}
          </span>
          {u.full_name}
        </button>
      ))}
    </div>
  )
}

// Composer de comentario NUEVO — fila con textarea, ícono de emoji y
// botón de enviar (flecha), tal cual el mockup. Enter envía,
// Shift+Enter salto de línea.
function ComposerNuevo({ value, onChange, onSubmit, usuarios }) {
  const [emojiOpen, setEmojiOpen] = useState(false)
  const taRef = useRef(null)
  const emojiBtnRef = useRef(null)
  const wrapRef = useRef(null)

  const { mencion, setMencion, idxActivo, setIdxActivo, handleChange, elegirUsuario, insertarEmoji, refrescarMencion } =
    useComposerLogica(value, onChange, taRef)

  const candidatos = mencion ? filtrarUsuarios(usuarios, mencion.query).slice(0, 6) : []
  const popupAbierto = mencion !== null && candidatos.length > 0
  const rectMencion = usePosicionFija(popupAbierto, taRef)
  const rectEmoji = usePosicionFija(emojiOpen, emojiBtnRef)

  useEffect(() => {
    if (!emojiOpen) return
    function onDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setEmojiOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [emojiOpen])

  function handleKeyDown(e) {
    if (popupAbierto) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setIdxActivo(i => (i + 1) % candidatos.length); return }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setIdxActivo(i => (i - 1 + candidatos.length) % candidatos.length); return }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); elegirUsuario(candidatos[idxActivo]); return }
      if (e.key === 'Escape') { e.preventDefault(); setMencion(null); return }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit(); return }
  }

  return (
    <div className="coment-composer" ref={wrapRef}>
      {popupAbierto && (
        <PopupMenciones
          candidatos={candidatos} idxActivo={idxActivo} setIdxActivo={setIdxActivo}
          elegirUsuario={elegirUsuario} rect={rectMencion} altoEstimado={44 * candidatos.length + 12}
        />
      )}

      <div className="coment-input-row">
        <textarea
          ref={taRef}
          className="coment-input"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onClick={(e) => refrescarMencion(e.target.value, e.target.selectionStart)}
          placeholder="Escribí un comentario… usá @ para mencionar a alguien del equipo"
          rows={1}
          maxLength={4000}
        />
        <div className="coment-input-actions">
          <button
            ref={emojiBtnRef}
            type="button"
            className="coment-emoji-toggle"
            title="Insertar emoji"
            onClick={() => setEmojiOpen(v => !v)}
          >
            <Smile size={17} />
          </button>
          <button
            type="button"
            className="coment-enviar"
            title="Publicar"
            disabled={!value.trim()}
            onClick={onSubmit}
          >
            <SendHorizontal size={16} />
          </button>
        </div>
      </div>

      {emojiOpen && (
        <div className="coment-emoji-grid" style={estiloPopover(rectEmoji, { alinear: 'derecha', altoEstimado: 130 })}>
          {EMOJIS_COMPOSER.map(e => (
            <button key={e} type="button" className="coment-emoji-btn"
              onClick={() => { insertarEmoji(e); setEmojiOpen(false) }}>{e}</button>
          ))}
        </div>
      )}

      <span className="coment-hint">Enter envía · Shift+Enter salto de línea · @ para mencionar</span>
    </div>
  )
}

// Edición inline — caja bordeada en rojo con Cancelar/Guardar debajo,
// distinta a propósito del composer de arriba (así se distingue de un
// vistazo que se está editando algo existente, no creando algo nuevo).
// Mantiene el autocomplete de @mención por si la edición agrega una.
function ComposerEdicion({ value, onChange, onGuardar, onCancelar, usuarios }) {
  const taRef = useRef(null)
  const { mencion, setMencion, idxActivo, setIdxActivo, handleChange, elegirUsuario, refrescarMencion } =
    useComposerLogica(value, onChange, taRef)

  const candidatos = mencion ? filtrarUsuarios(usuarios, mencion.query).slice(0, 6) : []
  const popupAbierto = mencion !== null && candidatos.length > 0
  const rectMencion = usePosicionFija(popupAbierto, taRef)

  function handleKeyDown(e) {
    if (popupAbierto) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setIdxActivo(i => (i + 1) % candidatos.length); return }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setIdxActivo(i => (i - 1 + candidatos.length) % candidatos.length); return }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); elegirUsuario(candidatos[idxActivo]); return }
      if (e.key === 'Escape') { e.preventDefault(); setMencion(null); return }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onGuardar(); return }
    if (e.key === 'Escape') { e.preventDefault(); onCancelar() }
  }

  return (
    <div className="coment-edit-box">
      {popupAbierto && (
        <PopupMenciones
          candidatos={candidatos} idxActivo={idxActivo} setIdxActivo={setIdxActivo}
          elegirUsuario={elegirUsuario} rect={rectMencion} altoEstimado={44 * candidatos.length + 12}
        />
      )}
      <textarea
        ref={taRef}
        className="coment-input"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onClick={(e) => refrescarMencion(e.target.value, e.target.selectionStart)}
        rows={2}
        maxLength={4000}
        autoFocus
      />
      <div className="coment-edit-actions">
        <button type="button" className="coment-btn-cancelar" onClick={onCancelar}>Cancelar</button>
        <button type="button" className="coment-btn-guardar" disabled={!value.trim()} onClick={onGuardar}>Guardar</button>
      </div>
    </div>
  )
}

function Reacciones({ comentarioId, reacciones, userId, onToggle }) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const wrapRef = useRef(null)
  const addBtnRef = useRef(null)
  const grupos = agruparReacciones(reacciones, userId)
  const rectPicker = usePosicionFija(pickerOpen, addBtnRef)

  useEffect(() => {
    if (!pickerOpen) return
    function onDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setPickerOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [pickerOpen])

  return (
    <div className="coment-reacciones" ref={wrapRef}>
      {grupos.map(g => (
        <button
          key={g.emoji}
          type="button"
          className={`coment-reaccion${g.mia ? ' mia' : ''}`}
          title={g.nombres.join(', ')}
          onClick={() => onToggle(comentarioId, g.emoji)}
        >
          {g.emoji} <span className="coment-reaccion-count">{g.count}</span>
        </button>
      ))}
      <button
        ref={addBtnRef}
        type="button"
        className="coment-reaccion-add"
        title="Reaccionar"
        onClick={() => setPickerOpen(v => !v)}
      >
        <SmilePlus size={14} />
      </button>
      {pickerOpen && (
        <div className="coment-reaccion-picker" style={estiloPopover(rectPicker, { altoEstimado: 48 })}>
          {EMOJIS_REACCION.map(e => (
            <button
              key={e}
              type="button"
              className="coment-emoji-btn"
              onClick={() => { onToggle(comentarioId, e); setPickerOpen(false) }}
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function ComentariosSection({ pedidoId, comentarios, reacciones, loading, errorCarga, onRecargar, user, role, usuarios, onAgregar, onEditar, onEliminar, onToggleReaccion, setConfirm, resaltarId }) {
  const { showError } = useNotificaciones()
  // Borrador persistente POR PEDIDO: un comentario a medio escribir
  // sobrevive a navegar a otra pantalla, cerrar la pestaña o que la PWA
  // se recargue en background. Se guarda el texto AMIGABLE (el que se
  // ve en el textarea, con @Nombre sin uuid) — la reconstrucción al
  // formato persistido pasa recién al enviar, como siempre. La clave se
  // limpia del storage al publicar para no acumular entradas vacías.
  const claveBorrador = `coment-borrador:${pedidoId}`
  const [nuevo, setNuevo] = useLocalStorage(claveBorrador, '')
  const [editandoId, setEditandoId] = useState(null)
  const [textoEdicion, setTextoEdicion] = useState('')
  const listRef = useRef(null)
  // El resaltado del deep-link se aplica UNA vez (cuando el comentario
  // destino ya está en la lista cargada); después la sección se
  // comporta igual que siempre.
  const resaltadoAplicado = useRef(false)

  const esAdmin = role === 'super_admin' || role === 'admin'
  // No tiene sentido ofrecerte a vos mismo en el autocomplete de @: el
  // trigger de notificaciones ya te excluye como destinatario de tus
  // propias menciones, así que elegirte a vos mismo del popup no hacía
  // nada — solo confundía. Se filtra acá, SOLO para el picker: la
  // reconstrucción de menciones (reconstruirMenciones/
  // contenidoAFormularioAmigable, más abajo) sigue usando la lista
  // completa `usuarios`, para no romper el round-trip de un comentario
  // viejo que por algún motivo ya tuviera una automención guardada.
  const usuariosMencionables = usuarios.filter(u => u.id !== user.id)

  // La lista tiene alto máximo con scroll interno (ver CSS): al montar
  // y con cada comentario nuevo se baja al final, que es donde está lo
  // último de la conversación — patrón chat.
  //
  // Excepción: si se llegó por deep-link de una notificación
  // (?comentario=<id>), la primera pasada con datos scrollea AL
  // COMENTARIO destino (scrollIntoView sube por todos los ancestros
  // scrolleables: acomoda la lista interna Y la página hasta dejarlo a
  // la vista) y le aplica el pulso de resaltado. Consumido el
  // resaltado, la sección vuelve al comportamiento de siempre.
  useEffect(() => {
    const el = listRef.current
    if (!el) return
    if (resaltarId && !resaltadoAplicado.current) {
      const destino = el.querySelector(`[data-coment-id="${resaltarId}"]`)
      if (destino) {
        resaltadoAplicado.current = true
        destino.scrollIntoView({ block: 'center' })
        destino.classList.add('coment-resaltado')
        // La clase se saca al terminar la animación para que el DOM no
        // quede "sucio" (y por si el mismo comentario se re-linkea).
        setTimeout(() => destino.classList.remove('coment-resaltado'), 2600)
        return
      }
      // Si el destino todavía no está (carga en curso, o el comentario
      // fue borrado en el ínterin), cae al scroll normal; si aparece en
      // un render posterior, esta rama lo agarra ahí.
    }
    el.scrollTop = el.scrollHeight
  }, [loading, comentarios.length, resaltarId])

  async function enviarNuevo() {
    const amigable = nuevo.trim()
    if (!amigable) return
    // El textarea solo tenía "@Nombre" (sin uuid a la vista) — acá,
    // justo antes de persistir, se reconstruye el token @[Nombre](uuid)
    // que necesitan el storage y el trigger de notificaciones.
    const contenido = reconstruirMenciones(amigable, usuarios)
    const { error } = await onAgregar(user.id, contenido, extraerMenciones(contenido))
    if (error) { showError('No se pudo publicar el comentario'); return }
    setNuevo('')
    // El set('') de arriba ya dejó la UI limpia; esto además borra la
    // clave del storage para no acumular borradores vacíos por cada
    // pedido visitado. Mismo criterio defensivo que useLocalStorage:
    // si localStorage falla, no pasa nada — es limpieza, no estado.
    try { localStorage.removeItem(claveBorrador) } catch { /* no crítico */ }
  }

  async function guardarEdicion(id) {
    const amigable = textoEdicion.trim()
    if (!amigable) return
    const contenido = reconstruirMenciones(amigable, usuarios)
    const { error } = await onEditar(id, contenido, extraerMenciones(contenido))
    if (error) { showError(error.message || 'No se pudo editar el comentario'); return }
    setEditandoId(null)
  }

  function pedirEliminar(c) {
    setConfirm({
      title: 'Eliminar comentario',
      message: 'El comentario se va a mostrar como eliminado para todo el equipo. ¿Continuar?',
      confirmLabel: 'Eliminar',
      onConfirm: async () => {
        setConfirm(null)
        const { error } = await onEliminar(c.id)
        if (error) showError('No se pudo eliminar el comentario')
      },
    })
  }

  async function toggleReaccion(comentarioId, emoji) {
    const { error } = await onToggleReaccion(comentarioId, emoji, user.id)
    if (error) showError('No se pudo registrar la reacción')
  }

  if (loading) return <p className="text-muted-sm">Cargando comentarios…</p>

  // Falla de la carga inicial: NO mostrar el empty state ("Sin
  // comentarios todavía") sobre una conversación que quizás sí existe,
  // ni el composer (publicar a ciegas sin ver el hilo invita a
  // duplicar). Mensaje honesto + reintento.
  if (errorCarga) {
    return (
      <div className="coment-error">
        <p className="text-muted-sm">No se pudieron cargar los comentarios. Revisá tu conexión.</p>
        <button type="button" className="coment-btn-cancelar" onClick={onRecargar}>Reintentar</button>
      </div>
    )
  }

  return (
    <div className="coment-section">
      {comentarios.length === 0 && (
        <p className="text-muted-sm">Sin comentarios todavía — arrancá la conversación del equipo sobre este pedido.</p>
      )}

      <div className="coment-list" ref={listRef}>
        {comentarios.map(c => {
          const nombre = c.profiles?.full_name ?? 'Usuario eliminado'
          const color = c.profiles?.avatar_color || colorAvatar(c.user_id ?? c.id)
          const propio = c.user_id === user.id
          const eliminado = !!c.deleted_at
          const reaccionesDelComentario = reacciones.filter(r => r.comentario_id === c.id)

          return (
            <div key={c.id} className="coment-item" data-coment-id={c.id}>
              <span
                className={`coment-avatar-circle${eliminado ? ' eliminado' : ''}`}
                style={{ background: color }}
              >
                {c.profiles ? iniciales(nombre) : '?'}
              </span>
              <div className="coment-body">
                <div className="coment-header">
                  <span className={`coment-nombre${eliminado ? ' eliminado' : ''}`}>{nombre}</span>
                  <span className={`coment-fecha${eliminado ? ' eliminado' : ''}`}>
                    {format(new Date(c.created_at), "d MMM yyyy, HH:mm", { locale: es })}
                  </span>
                  {c.edited_at && !eliminado && <span className="coment-editado">(editado)</span>}
                </div>

                {eliminado ? (
                  <p className="coment-eliminado">Comentario eliminado</p>
                ) : editandoId === c.id ? (
                  <ComposerEdicion
                    value={textoEdicion}
                    onChange={setTextoEdicion}
                    onGuardar={() => guardarEdicion(c.id)}
                    onCancelar={() => setEditandoId(null)}
                    usuarios={usuariosMencionables}
                  />
                ) : (
                  <>
                    <p className="coment-texto"><RenderContenido contenido={c.contenido} /></p>
                    {(() => {
                      const imagenes = extraerUrlsDeImagen(c.contenido)
                      return imagenes.length > 0 && (
                        <div className="coment-imagenes">
                          {imagenes.map((url, i) => <ImagenPreview key={i} url={url} />)}
                        </div>
                      )
                    })()}
                    <Reacciones
                      comentarioId={c.id}
                      reacciones={reaccionesDelComentario}
                      userId={user.id}
                      onToggle={toggleReaccion}
                    />
                  </>
                )}
              </div>

              {!eliminado && (propio || esAdmin) && editandoId !== c.id && (
                <span className="coment-acciones">
                  {propio && (
                    <button type="button" className="coment-icon-btn" title="Editar"
                      onClick={() => { setEditandoId(c.id); setTextoEdicion(contenidoAFormularioAmigable(c.contenido)) }}>
                      <Pencil size={13} />
                    </button>
                  )}
                  <button type="button" className="coment-icon-btn eliminar" title="Eliminar"
                    onClick={() => pedirEliminar(c)}>
                    <Trash2 size={13} />
                  </button>
                </span>
              )}
            </div>
          )
        })}
      </div>

      <ComposerNuevo value={nuevo} onChange={setNuevo} onSubmit={enviarNuevo} usuarios={usuariosMencionables} />
    </div>
  )
}
