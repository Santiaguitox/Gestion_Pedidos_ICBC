import { useState } from 'react'
import { DatePicker } from '@/components/ui/DatePicker'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { X, Plus, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const TIPOS_ENVIO_LABELS = { test: 'Test', real: 'Real', otro: 'Otro' }

function nuevoHorario() {
  return { id: `horario-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, dia: '', hora: '' }
}

function nuevoGrupo() {
  return { id: `grupo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, piezaIds: [], horarios: [nuevoHorario()] }
}

// Una repetición "cuenta" (para el total de envíos y para lo que
// efectivamente se registra en el Sheet) solo si tiene día Y hora
// cargados. Una fila a medio completar no es un envío todavía.
function esHorarioCompleto(h) {
  return !!(h.dia && h.hora?.trim())
}

// Lista de día/horario de UN grupo (o del envío único, si no hay
// múltiples piezas) — cada elemento es una "repetición": el mismo
// envío/grupo de piezas, registrado en el Sheet en otro día/horario
// distinto. Se usa tanto suelta (modo "mismo día"/envío único) como
// dentro de FilaGrupo (modo "varía por pieza").
function ListaHorarios({ horarios, onChange }) {
  function actualizar(id, campo, valor) {
    onChange(horarios.map(h => h.id === id ? { ...h, [campo]: valor } : h))
  }
  function eliminar(id) {
    onChange(horarios.filter(h => h.id !== id))
  }
  function agregar() {
    onChange([...horarios, nuevoHorario()])
  }

  return (
    <div className="sheet-horarios-wrap">
      {horarios.map((h, i) => (
        <div key={h.id} className="sheet-grid-2 sheet-horario-fila">
          <div className="sheet-field">
            <label className="field-label">{i === 0 ? 'Día de programación' : `Repetición ${i}`}</label>
            <DatePicker value={h.dia} onChange={val => actualizar(h.id, 'dia', val)} placeholder="Seleccionar fecha…" />
          </div>
          <div className="sheet-field sheet-horario-hora-row">
            <label className="field-label">Hora programación</label>
            <div className="sheet-horario-hora-input">
              <input value={h.hora} onChange={e => actualizar(h.id, 'hora', e.target.value)} placeholder="HH:MM" maxLength={5} />
              {horarios.length > 1 && (
                <button type="button" className="sheet-grupo-eliminar" onClick={() => eliminar(h.id)} title="Quitar esta repetición">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
      <button type="button" className="sheet-btn-agregar-grupo" onClick={agregar}>
        <Plus size={14} /> Agregar repetición
      </button>
    </div>
  )
}

// Selector de piezas + lista de día/horario para UN grupo. Las piezas
// ya asignadas a OTRO grupo no aparecen como opción acá — cada pieza
// sigue perteneciendo a un solo grupo a la vez (eso no cambia). Lo que
// sí puede repetirse es el DÍA/HORARIO dentro de un mismo grupo, vía
// ListaHorarios — así una pieza (o un conjunto de piezas) puede quedar
// registrada en el Sheet más de una vez, en fechas distintas.
function FilaGrupo({ grupo, piezasDisponibles, onChange, onEliminar, puedeEliminar }) {
  function togglePieza(id) {
    const yaEsta = grupo.piezaIds.includes(id)
    onChange({ ...grupo, piezaIds: yaEsta ? grupo.piezaIds.filter(p => p !== id) : [...grupo.piezaIds, id] })
  }

  return (
    <div className="sheet-grupo-card">
      <div className="sheet-grupo-header">
        <div style={{ flex: 1 }}>
          <ListaHorarios horarios={grupo.horarios} onChange={horarios => onChange({ ...grupo, horarios })} />
        </div>
        <button type="button" className="sheet-grupo-eliminar" onClick={onEliminar} disabled={!puedeEliminar} title="Eliminar grupo">
          <Trash2 size={14} />
        </button>
      </div>
      <div className="sheet-field">
        <label className="field-label">
          {grupo.piezaIds.length > 0 ? 'Piezas en este grupo' : 'Elegí cuáles van en este grupo'}
        </label>
        {grupo.piezaIds.length === 0 && piezasDisponibles.length > 0 && (
          <span className="sheet-grupo-piezas-hint">Ninguna pieza está asignada todavía — tocá para sumarlas a este grupo.</span>
        )}
        <div className="sheet-grupo-piezas">
          {piezasDisponibles.length === 0 && grupo.piezaIds.length === 0 && (
            <span className="sheet-grupo-piezas-vacio">No quedan piezas libres para asignar.</span>
          )}
          {piezasDisponibles.map(p => (
            <label key={p.id} className="sheet-grupo-pieza-chip">
              <input type="checkbox" checked={grupo.piezaIds.includes(p.id)} onChange={() => togglePieza(p.id)} />
              {p.nombre_pieza}
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}

export function SheetModal({ pedido, entregables, onClose, onConfirm }) {
  const primeraAprobacion = entregables.find(e => e.aprobado_at)
  const fechaAprobRef = primeraAprobacion ? new Date(primeraAprobacion.aprobado_at) : new Date()
  const piezasConNombre = entregables.filter(e => e.nombre_pieza)
  const tieneMultiplesPiezas = piezasConNombre.length > 1

  const [data, setData] = useState({
    nombre_campana:    pedido.asunto ?? '',
    fecha_pedido:      format(new Date(pedido.created_at), "dd/MM/yyyy", { locale: es }),
    hora_pedido:       format(new Date(pedido.created_at), "HH:mm", { locale: es }),
    descripcion:       pedido.descripcion ?? '',
    instancia:         pedido.instancia ?? '',
    fecha_aprobacion:  format(fechaAprobRef, "yyyy-MM-dd"),
    hora_aprobacion:   format(fechaAprobRef, "HH:mm", { locale: es }),
    cantidad_envios:   String(pedido.cantidad_envios ?? piezasConNombre.length),
    aclaraciones:      pedido.tipo_envio === 'otro' ? (pedido.tipo_envio_otro ?? '') : (TIPOS_ENVIO_LABELS[pedido.tipo_envio] ?? ''),
    dia_programacion:  pedido.fecha_programacion ?? '',
    hora_programacion: pedido.hora_programacion ?? '',
    fueraDeHora:       false,
  })
  // Solo relevante si hay 2+ piezas: 'mismo' (1 solo grupo implícito
  // para todo el pedido) o 'distinto' (editor de grupos, 1 pieza no
  // puede estar en 2 grupos a la vez). Con 0/1 pieza no hay nada que
  // "variar por pieza", así que ni se muestra este toggle — se usa
  // siempre el envío único (horariosUnico) de más abajo.
  const [modoProgramacion, setModoProgramacion] = useState('mismo')
  // Día/horario(s) del envío único — usado cuando modoProgramacion es
  // 'mismo', o directamente siempre que no haya múltiples piezas. Es
  // una lista (no un solo par día/hora) para poder cargar
  // repeticiones: mismas piezas, mismo resto de datos, pero registrado
  // en el Sheet en más de un día/horario.
  const [horariosUnico, setHorariosUnico] = useState([nuevoHorario()])
  const [grupos, setGrupos] = useState([nuevoGrupo()])
  const [confirmPendientes, setConfirmPendientes] = useState(null) // array de avisos, o null
  const [errorSinFilas, setErrorSinFilas] = useState(false)
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setData(d => ({ ...d, [k]: v }))

  const usaEnvioUnico = modoProgramacion === 'mismo' || !tieneMultiplesPiezas

  // "Cantidad envíos" = cantidad de día/horario COMPLETOS configurados
  // (cada combinación día+hora completa que se va a registrar en el
  // Sheet cuenta como 1 envío), sin importar cuántas piezas haya ni el
  // modo. Una repetición a medio completar no suma acá — recién cuenta
  // cuando tiene día y hora cargados. Se recalcula en tiempo real cada
  // vez que se agrega/quita/completa una repetición o un grupo; si el
  // usuario lo edita a mano y no vuelve a tocar día/horario, su valor
  // manual queda tal cual.
  const totalEnviosConfigurados = usaEnvioUnico
    ? horariosUnico.filter(esHorarioCompleto).length
    : grupos.filter(g => g.piezaIds.length > 0).reduce((acc, g) => acc + g.horarios.filter(esHorarioCompleto).length, 0)

  // Ajuste durante el render (mismo patrón que usePedidos.js para
  // prevFiltrosKey): en vez de un useEffect que llama setState en su
  // cuerpo (dispara un render en cascada), se compara contra el valor
  // del render anterior y se ajusta ahí mismo — React re-corre el
  // render con el estado nuevo antes de pintar. cantidad_envios se
  // recalcula solo cuando totalEnviosConfigurados cambia; si el
  // usuario lo edita a mano sin tocar día/horario, ese valor manual no
  // se pisa (ver comentario de arriba).
  const [prevTotalEnvios, setPrevTotalEnvios] = useState(totalEnviosConfigurados)
  if (prevTotalEnvios !== totalEnviosConfigurados) {
    setPrevTotalEnvios(totalEnviosConfigurados)
    set('cantidad_envios', String(totalEnviosConfigurados))
    if (totalEnviosConfigurados > 0) setErrorSinFilas(false)
  }

  function actualizarGrupo(id, nuevo) {
    setGrupos(gs => gs.map(g => g.id === id ? nuevo : g))
  }
  function eliminarGrupo(id) {
    setGrupos(gs => gs.filter(g => g.id !== id))
  }
  function agregarGrupo() {
    setGrupos(gs => [...gs, nuevoGrupo()])
  }

  function piezasAsignadasEnOtroGrupo(grupoId) {
    return new Set(grupos.filter(g => g.id !== grupoId).flatMap(g => g.piezaIds))
  }

  function piezasSinAsignar() {
    const asignadas = new Set(grupos.flatMap(g => g.piezaIds))
    return piezasConNombre.filter(p => !asignadas.has(p.id))
  }

  // Arma el array de "filas" a registrar en el Sheet:
  //   - Envío único (mismo día para todo el pedido, o 0/1 pieza): 1
  //     fila por cada horario cargado en horariosUnico — normalmente 1,
  //     más si se agregaron repeticiones.
  //   - Grupos por pieza ("varía por pieza"): 1 fila por cada
  //     combinación grupo × horario de ese grupo. Todos los campos del
  //     formulario se repiten igual entre filas, solo cambia
  //     dia_programacion/hora_programacion.
  //
  // Si quedaron piezas sin asignar a ningún grupo (el usuario decidió
  // continuar igual ante el aviso), 'aclaraciones' suma un aviso de qué
  // piezas quedaron afuera — concatenado al final de lo que el usuario
  // ya haya escrito ahí, para no perder ese texto. 'cantidad_envios' no
  // necesita ajuste acá: ya viene bien calculado en tiempo real más
  // arriba (totalEnviosConfigurados ya excluye a las piezas huérfanas,
  // porque nunca llegaron a sumar en ningún grupo). Las repeticiones
  // incompletas (sin día u hora) se descartan acá — nunca llegan a
  // convertirse en una fila del Sheet.
  function armarFilas() {
    const fechaAprobFmt = data.fecha_aprobacion ? format(new Date(data.fecha_aprobacion + 'T00:00:00'), "dd/MM/yyyy") : ''
    const base = { ...data, fecha_aprobacion: fechaAprobFmt }
    const fmtDia = dia => dia ? format(new Date(dia + 'T00:00:00'), "dd/MM/yyyy") : ''

    if (usaEnvioUnico) {
      return horariosUnico.filter(esHorarioCompleto).map(h => ({
        ...base,
        dia_programacion: fmtDia(h.dia),
        hora_programacion: h.hora,
      }))
    }

    const huerfanas = piezasSinAsignar()
    const avisoHuerfanas = huerfanas.length > 0
      ? `No se mandó: ${huerfanas.map(p => p.nombre_pieza).join(', ')}`
      : null
    const aclaracionesFinal = avisoHuerfanas
      ? (base.aclaraciones?.trim() ? `${base.aclaraciones.trim()} — ${avisoHuerfanas}` : avisoHuerfanas)
      : base.aclaraciones

    return grupos
      .filter(g => g.piezaIds.length > 0)
      .flatMap(g => g.horarios.filter(esHorarioCompleto).map(h => ({
        ...base,
        aclaraciones: aclaracionesFinal,
        dia_programacion: fmtDia(h.dia),
        hora_programacion: h.hora,
      })))
  }

  // Junta en un solo array los avisos que ameritan preguntar "¿continuar
  // igual?" antes de guardar: repeticiones sin día/hora completos (se
  // van a descartar) y, si aplica, piezas sin ningún grupo asignado.
  function construirAvisosPendientes() {
    const avisos = []

    const incompletos = usaEnvioUnico
      ? horariosUnico.filter(h => !esHorarioCompleto(h)).length
      : grupos.filter(g => g.piezaIds.length > 0).reduce((acc, g) => acc + g.horarios.filter(h => !esHorarioCompleto(h)).length, 0)
    if (incompletos > 0) {
      avisos.push(`${incompletos} repetición${incompletos > 1 ? 'es' : ''} sin día u hora completos (no se van a registrar)`)
    }

    if (!usaEnvioUnico) {
      const huerfanas = piezasSinAsignar()
      if (huerfanas.length > 0) {
        avisos.push(`Piezas sin grupo asignado: ${huerfanas.map(p => p.nombre_pieza).join(', ')}`)
      }
    }

    return avisos
  }

  async function handleConfirm() {
    setErrorSinFilas(false)
    if (totalEnviosConfigurados === 0) {
      setErrorSinFilas(true)
      return
    }
    const avisos = construirAvisosPendientes()
    if (avisos.length > 0) {
      setConfirmPendientes(avisos)
      return
    }
    await ejecutarConfirm()
  }

  async function ejecutarConfirm() {
    setSaving(true)
    setConfirmPendientes(null)
    await onConfirm(armarFilas())
    setSaving(false)
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: '560px' }}>
        <div className="modal-header">
          <h2 className="modal-title">Registrar en Google Sheets</h2>
          <button onClick={onClose} className="modal-close"><X size={18} /></button>
        </div>
        <div className="modal-body">
          <p className="text-muted-sm" style={{ marginBottom: '0.75rem' }}>Revisá y editá los datos antes de confirmar el registro.</p>
          <div className="flex flex-col gap-2">
            <div className="sheet-field">
              <label className="field-label">Nombre de campaña</label>
              <input value={data.nombre_campana} onChange={e => set('nombre_campana', e.target.value)} placeholder="Nombre de campaña…" />
            </div>
            <div className="sheet-field">
              <label className="field-label">Descripción</label>
              <input value={data.descripcion} onChange={e => set('descripcion', e.target.value)} placeholder="Descripción…" />
            </div>
            <div className="sheet-grid-2">
              <div className="sheet-field">
                <label className="field-label">Fecha pedido</label>
                <input value={data.fecha_pedido} onChange={e => set('fecha_pedido', e.target.value)} placeholder="Fecha pedido…" />
              </div>
              <div className="sheet-field">
                <label className="field-label">Hora pedido</label>
                <input value={data.hora_pedido} onChange={e => set('hora_pedido', e.target.value)} placeholder="HH:MM" maxLength={5} />
              </div>
            </div>
            <div className="sheet-grid-2">
              <div className="sheet-field">
                <label className="field-label">Instancia</label>
                <input value={data.instancia} onChange={e => set('instancia', e.target.value)} placeholder="Instancia…" />
              </div>
              <div className="sheet-field">
                <label className="field-label">Cantidad envíos</label>
                <input value={data.cantidad_envios} onChange={e => set('cantidad_envios', e.target.value)} placeholder="Cantidad…" />
              </div>
            </div>
            <div className="sheet-grid-2">
              <div className="sheet-field">
                <label className="field-label">Fecha aprobación</label>
                <DatePicker value={data.fecha_aprobacion} onChange={val => set('fecha_aprobacion', val)} placeholder="Seleccionar fecha…" />
              </div>
              <div className="sheet-field">
                <label className="field-label">Hora aprobación</label>
                <input value={data.hora_aprobacion} onChange={e => set('hora_aprobacion', e.target.value)} placeholder="HH:MM" maxLength={5} />
              </div>
            </div>
            <div className="sheet-field">
              <label className="field-label">Aclaraciones</label>
              <input value={data.aclaraciones} onChange={e => set('aclaraciones', e.target.value)} placeholder="Aclaraciones…" />
            </div>

            {tieneMultiplesPiezas && (
              <div className="sheet-field">
                <label className="field-label">¿Todas las piezas se configuran el mismo día y horario?</label>
                <div className="sheet-toggle-mismo-dia">
                  <button type="button"
                    className={`sheet-toggle-opcion${modoProgramacion === 'mismo' ? ' activo' : ''}`}
                    onClick={() => setModoProgramacion('mismo')}>
                    Sí, mismo día y horario
                  </button>
                  <button type="button"
                    className={`sheet-toggle-opcion${modoProgramacion === 'distinto' ? ' activo' : ''}`}
                    onClick={() => setModoProgramacion('distinto')}>
                    No, varía por pieza
                  </button>
                </div>
              </div>
            )}

            {usaEnvioUnico ? (
              <ListaHorarios horarios={horariosUnico} onChange={setHorariosUnico} />
            ) : (
              <div className="sheet-grupos-wrap">
                {grupos.map(grupo => (
                  <FilaGrupo
                    key={grupo.id}
                    grupo={grupo}
                    piezasDisponibles={piezasConNombre.filter(p => !piezasAsignadasEnOtroGrupo(grupo.id).has(p.id))}
                    onChange={nuevo => actualizarGrupo(grupo.id, nuevo)}
                    onEliminar={() => eliminarGrupo(grupo.id)}
                    puedeEliminar={grupos.length > 1}
                  />
                ))}
                <button type="button" className="sheet-btn-agregar-grupo" onClick={agregarGrupo}>
                  <Plus size={14} /> Agregar grupo
                </button>
                <p className="ap-hint" style={{ margin: 0 }}>
                  Se va a registrar una fila en el Sheet por cada grupo con piezas asignadas (y una más por cada repetición de día/horario que le agregues) — el resto de los datos del pedido se repite igual en todas.
                </p>
              </div>
            )}

            <label className="sheet-checkbox-fuera-hora">
              <input type="checkbox" checked={data.fueraDeHora} onChange={e => set('fueraDeHora', e.target.checked)} />
              Pedido fuera de hora
            </label>
          </div>
          <div className="modal-footer" style={{ marginTop: '1.25rem', flexDirection: 'column', alignItems: 'stretch', gap: '0.5rem' }}>
            {errorSinFilas && (
              <p className="msg-error" style={{ margin: 0 }}>
                No hay ningún día/horario completo para registrar — completá al menos uno.
              </p>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button onClick={onClose} className="btn-secondary">Cancelar</button>
              <button onClick={handleConfirm} disabled={saving} className="btn-primary"
                style={{ width: 'auto', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Registrando…' : 'Confirmar y registrar'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={!!confirmPendientes}
        variant="warning"
        title="Hay datos sin completar"
        message={confirmPendientes ? `${confirmPendientes.join('. ')}. ¿Continuar igual?` : ''}
        confirmLabel="Continuar igual"
        cancelLabel="Volver a completar"
        onConfirm={ejecutarConfirm}
        onCancel={() => setConfirmPendientes(null)}
      />
    </div>
  )
}
