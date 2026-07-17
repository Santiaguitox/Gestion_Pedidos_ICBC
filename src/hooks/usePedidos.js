import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { logActividad } from '@/hooks/useActividad'
import { TIPO_ACTIVIDAD } from '@/lib/constants'

function limpiarCampos(data) {
  const limpio = { ...data }
  if (limpio.cantidad_envios === '' || limpio.cantidad_envios === undefined) limpio.cantidad_envios = null
  if (limpio.instancia === '') limpio.instancia = null
  if (limpio.tipo_envio === '') limpio.tipo_envio = null
  if (limpio.tipo_envio_otro === '') limpio.tipo_envio_otro = null
  if (limpio.fecha_limite === '') limpio.fecha_limite = null
  if (limpio.fecha_programacion === '') limpio.fecha_programacion = null
  if (limpio.hora_programacion === '') limpio.hora_programacion = null
  // tipo y prioridad son NOT NULL con CHECK en la base — un '' los viola.
  // El formulario ya preselecciona un valor válido, esto es solo respaldo.
  if (limpio.tipo === '') limpio.tipo = 'creacion_email'
  if (limpio.prioridad === '') limpio.prioridad = 'media'
  // updated_at NO es un campo editable: es el token del lock optimista
  // que PedidoForm agrega a su estado (ver ahí). Se saca acá para que
  // jamás llegue al INSERT/UPDATE como columna — la mantiene el trigger
  // pedidos_updated_at, no el cliente.
  delete limpio.updated_at
  return limpio
}

const PAGINA_SIZE_DEFAULT = 30

// Llama a la función RPC listar_pedidos con los filtros actuales.
// p_solo_id (opcional) restringe a un único pedido — usado por el
// realtime para traer un pedido puntual con sus relaciones, reusando
// toda la lógica de filtrado de la función en vez de duplicarla en JS.
// 'pagina' viene como parámetro explícito (no de filters) porque ahora
// la paginación es manejada internamente por el hook, no por quien lo
// llama — ver paginaActual/cargarMas más abajo.
async function rpcListarPedidos(filters, pagina = 0, soloId = null) {
  const { data, error } = await supabase.rpc('listar_pedidos', {
    p_modo: filters.modo ?? 'normal',
    p_dias_normal: filters.diasNormal ?? 30,
    p_vence_desde: filters.venceDesde || null,
    p_vence_hasta: filters.venceHasta || null,
    p_busqueda: filters.busqueda || null,
    p_prioridad: filters.prioridad || null,
    p_tipo: filters.tipo || null,
    p_estado: filters.estado || null,
    p_tag: filters.tag || null,
    p_usuario_id: filters.usuarioId || null,
    p_mostrar_finalizados: !!filters.mostrarFinalizados,
    p_pagina: pagina,
    p_pagina_size: filters.paginaSize ?? PAGINA_SIZE_DEFAULT,
    p_solo_id: soloId,
  })
  if (error) throw new Error(error.message)
  // La función devuelve una tabla de 1 fila: { pedidos: [...], total: N }
  const fila = data?.[0]
  return { pedidos: fila?.pedidos ?? [], total: fila?.total ?? 0 }
}

export function usePedidos(filters = {}) {
  const { user } = useAuth()
  const [pedidos, setPedidos] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [hayNuevos, setHayNuevos] = useState(false)

  // Clave estable para detectar cambios reales en los FILTROS (sin
  // incluir la página — la paginación ahora es interna al hook, ver
  // paginaActual más abajo, y no debe disparar el efecto de "reemplazar
  // todo" como si fuera un cambio de filtro).
  const filtrosKey = [
    filters.modo, filters.diasNormal, filters.venceDesde, filters.venceHasta,
    filters.busqueda, filters.prioridad, filters.tipo, filters.estado,
    filters.tag, filters.usuarioId, filters.mostrarFinalizados, filters.paginaSize,
  ].join('|')

  // Página actual gestionada internamente por el hook — ya no viene de
  // filters. Se resetea a 0 cada vez que cambian los filtros (ver el
  // efecto principal más abajo).
  const [paginaActual, setPaginaActual] = useState(0)

  // Función pura: solo busca los datos y los devuelve (o lanza si falla).
  // No toca ningún setState — el setState queda visible en cada callsite
  // (más abajo) para que el linter pueda verificar que está bien diferido
  // respecto al cuerpo síncrono del efecto que la invoca.
  const queryPedidos = useCallback((pagina = 0) => rpcListarPedidos(filters, pagina), [filtrosKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Wrapper usado por las mutaciones (crearPedido, actualizarPedido, etc.)
  // y por quien necesite forzar un refetch manual sin pasar por loading.
  // Siempre reemplaza todo desde la página 0 — para agregar más sin
  // reemplazar, usar cargarMas().
  const fetchPedidos = useCallback(async () => {
    try {
      const { pedidos: data, total: t } = await queryPedidos(0)
      setError(null)
      setPedidos(data)
      setTotal(t)
      setPaginaActual(0)
    } catch (err) {
      setError(err.message)
    }
  }, [queryPedidos])

  // Reset por CAMBIO de filtros, ajustado DURANTE el render (patrón
  // oficial "adjusting state when props change", el mismo que
  // useComentarios usa para el cambio de pedido): se compara contra la
  // clave del render anterior y se resetea ahí mismo — React re-corre
  // el render con el estado nuevo antes de pintar, así que el loading
  // aparece un frame ANTES que con el useEffect que había acá (que
  // además era el setState-sincrónico-en-efecto que marca la regla de
  // React 19). En el primer render no entra: loading ya arranca en true
  // desde el useState.
  const [prevFiltrosKey, setPrevFiltrosKey] = useState(filtrosKey)
  if (prevFiltrosKey !== filtrosKey) {
    setPrevFiltrosKey(filtrosKey)
    setLoading(true)
    setHayNuevos(false)
    setPaginaActual(0)
  }

  // El efecto queda solo con el trabajo async — sin setState sincrónico.
  useEffect(() => {
    queryPedidos(0)
      .then(({ pedidos: data, total: t }) => { setError(null); setPedidos(data); setTotal(t) })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [filtrosKey, queryPedidos])

  // Set con los ids actualmente visibles, mantenido en un ref para que
  // el callback del realtime (que vive fuera del ciclo de render) pueda
  // consultarlo SIN meterse dentro de un updater de setPedidos. Antes
  // esta decisión se tomaba adentro de setPedidos(actuales => ...), con
  // dos problemas reales: (a) los updaters deben ser puros — React los
  // puede invocar más de una vez (StrictMode en dev los duplica
  // adrede), así que el RPC puntual se disparaba dos veces por evento;
  // (b) llamar setHayNuevos() dentro de otro updater es un setState
  // durante la fase de render de esa actualización. Con el ref, la
  // decisión y los efectos quedan fuera del updater y el updater que
  // queda (aplicar el resultado del RPC) es puro.
  const idsVisiblesRef = useRef(new Set())
  useEffect(() => {
    idsVisiblesRef.current = new Set(pedidos.map(p => p.id))
  }, [pedidos])

  // Realtime: nunca refetchea toda la lista. Dos casos:
  // 1) El pedido que cambió YA está en la página visible actual -> se
  //    vuelve a pedir ESE pedido puntual (con sus relaciones) y se
  //    actualiza/quita en memoria. Si la función ya no lo devuelve (por
  //    ejemplo, se finalizó y mostrarFinalizados está en false), se
  //    saca de la lista local.
  // 2) El pedido es nuevo (no estaba en la lista) -> no se inserta
  //    automáticamente (rompería la paginación visible). Se prende
  //    hayNuevos para mostrar el indicador "hay pedidos nuevos".
  useEffect(() => {
    const ch = supabase
      .channel(`pedidos-rt-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, (payload) => {
        const id = payload.new?.id ?? payload.old?.id
        if (!id) return

        if (!idsVisiblesRef.current.has(id)) {
          // Caso 2: el pedido no está visible. Antes esto prendía
          // "hay pedidos nuevos" a ciegas, con falsos positivos para
          // TODO el equipo: editar un pedido viejo de la página 3, o
          // uno finalizado con mostrarFinalizados apagado, avisaba
          // "nuevos" sin que hubiera nada nuevo que ver. Ahora se
          // consulta la misma RPC puntual del caso 1: solo si el pedido
          // realmente matchea los filtros actuales se prende el aviso.
          // Un DELETE físico ni se consulta — una fila que ya no existe
          // no puede ser "nueva" (y su old record solo trae el id).
          if (payload.eventType === 'DELETE') return
          rpcListarPedidos(filters, 0, id).then(({ pedidos: encontrados }) => {
            if (encontrados.length > 0) setHayNuevos(true)
          }).catch(err => console.warn('[realtime pedidos]', err))
          return
        }

        // Caso 1: actualizar/quitar en memoria, pidiendo solo esa fila
        // con los filtros actuales (reusa la lógica de la función SQL).
        // pagina=0 explícito: con p_solo_id seteado, el resultado tiene
        // como máximo 1 fila, así que cualquier offset mayor a 0
        // devolvería vacío — siempre hay que pedir la página 0 acá.
        rpcListarPedidos(filters, 0, id).then(({ pedidos: encontrados }) => {
          setPedidos(prev => {
            if (encontrados.length === 0) {
              // Ya no matchea los filtros actuales (ej: se finalizó)
              return prev.filter(p => p.id !== id)
            }
            return prev.map(p => (p.id === id ? encontrados[0] : p))
          })
        }).catch(err => console.warn('[realtime pedidos]', err))
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [filtrosKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Trae la SIGUIENTE página con los filtros actuales y la agrega al
  // final de lo que ya hay (no reemplaza) — usado por el botón "Cargar
  // más". Tiene su propio estado de carga (cargandoMas), separado de
  // 'loading', para no disparar el mensaje de carga de pantalla completa.
  const [cargandoMas, setCargandoMas] = useState(false)
  async function cargarMas() {
    if (cargandoMas) return
    setCargandoMas(true)
    try {
      const siguiente = paginaActual + 1
      const { pedidos: data } = await queryPedidos(siguiente)
      // Dedup contra el corrimiento de offset: si entre la carga de la
      // página N y este "Cargar más" entró un pedido nuevo (o se
      // restauró uno) que ordena antes, toda la paginación se corre un
      // lugar y la página N+1 repite el último ítem de la N — sin este
      // filtro aparecía la card duplicada (y el warning de keys
      // repetidas de React). verNuevos ya deduplicaba; esto lo empareja.
      setPedidos(prev => {
        const vistos = new Set(prev.map(p => p.id))
        return [...prev, ...data.filter(p => !vistos.has(p.id))]
      })
      setPaginaActual(siguiente)
    } catch (err) {
      setError(err.message)
    } finally {
      setCargandoMas(false)
    }
  }

  // Usado por el botón "Ver nuevos": en vez de un refetch que reemplaza
  // todo (lo que perdería lo acumulado con "Cargar más"), pide la página
  // 0 fresca con los filtros actuales, identifica cuáles de esos pedidos
  // son GENUINAMENTE nuevos (su id no está en ningún lugar de la lista
  // ya acumulada, sin importar en qué tanda haya llegado) y los inserta
  // al principio — el resto de lo ya cargado no se toca.
  // Devuelve los ids insertados, para que el componente pueda hacer
  // scroll + resaltado hacia ellos.
  async function verNuevos() {
    setHayNuevos(false)
    try {
      const { pedidos: frescos, total: totalFresco } = await queryPedidos(0)
      const idsActuales = new Set(pedidos.map(p => p.id))
      const nuevos = frescos.filter(p => !idsActuales.has(p.id))
      if (nuevos.length > 0) {
        setPedidos(prev => [...nuevos, ...prev])
      }
      setTotal(totalFresco)
      return nuevos.map(p => p.id)
    } catch (err) {
      setError(err.message)
      return []
    }
  }

  async function crearPedido(data) {
    const { asignados, ...rest } = data
    const campos = limpiarCampos(rest)
    const { data: nuevo, error } = await supabase
      .from('pedidos').insert({ ...campos, created_by: user?.id }).select().single()
    if (error) throw error
    if (asignados?.length) {
      // La notificación de "te asignaron al pedido" la genera el trigger
      // trg_notif_asignacion en la base (excluye automáticamente a quien
      // hizo la asignación). No insertar notificación manual aquí para
      // evitar duplicados.
      const { error: errorAsignados } = await supabase.from('pedido_asignados').insert(asignados.map(uid => ({ pedido_id: nuevo.id, user_id: uid })))
      // El pedido ya existe: reintentar la creación entera lo duplicaría,
      // así que el mensaje orienta a completar la asignación editando.
      if (errorAsignados) throw new Error('El pedido se creó, pero no se pudieron guardar los asignados — abrilo y asignalos desde la edición')
    }
    await logActividad(nuevo.id, user?.id, TIPO_ACTIVIDAD.CREACION)
    // No se llama a fetchPedidos() aquí: el realtime ya recibe el INSERT.
    // Como es un pedido nuevo, va a disparar el indicador "hay nuevos"
    // (caso 2 de arriba) en vez de insertarse directo en la lista.
    return nuevo
  }

  async function actualizarPedido(id, data) {
    const { asignados, ...rest } = data
    const campos = limpiarCampos(rest)
    // updated_at entra al select para el lock optimista de abajo. La
    // lectura ahora también valida: sin el estado anterior no hay
    // contra qué lockear (y antes un error acá seguía de largo y
    // registraba actividad con "anterior: undefined").
    const { data: anterior, error: errorAnterior } = await supabase
      .from('pedidos').select('updated_at, prioridad, estados, fecha_limite, asunto, pedido_asignados(user_id, profiles(full_name))').eq('id', id).single()
    if (errorAnterior || !anterior) throw new Error('No se pudo leer el estado actual del pedido — reintentá')

    // LOCK OPTIMISTA contra el update perdido: dos personas con el
    // mismo pedido abierto en el form, la primera guarda, la segunda
    // guarda después con datos viejos y pisa TODO en silencio (el form
    // manda todos los campos). El .eq('updated_at', ...) hace que el
    // segundo update matchee 0 filas — el trigger pedidos_updated_at
    // ya movió el timestamp — y acá se corta con un mensaje claro.
    //
    // ⚠️ El token correcto es data.updated_at: el updated_at que el
    // FORM capturó al abrirse. La primera versión de este lock usaba
    // anterior.updated_at — la lectura fresca de tres líneas arriba —
    // o sea, comparaba la fila contra sí misma de milisegundos antes:
    // cubría solo esa micro-ventana y el escenario real (form abierto
    // con datos viejos) pasaba de largo, como demostró el test de dos
    // pestañas del 2026-07-10. La lectura fresca queda solo como
    // fallback para un caller hipotético que no traiga token (hoy el
    // único caller es el form, que siempre lo trae).
    const tokenLock = data.updated_at ?? anterior.updated_at
    const { data: filas, error } = await supabase
      .from('pedidos').update(campos).eq('id', id)
      .eq('updated_at', tokenLock)
      .select('id')
    if (error) throw error
    if (!filas?.length) {
      throw new Error('Otra persona modificó este pedido mientras lo editabas. Cerrá el formulario para ver los cambios nuevos y volvé a aplicar los tuyos.')
    }

    if (campos.prioridad && anterior?.prioridad !== campos.prioridad) {
      await logActividad(id, user?.id, TIPO_ACTIVIDAD.CAMBIO_PRIORIDAD, { anterior: anterior.prioridad, nuevo: campos.prioridad })
    }
    if (campos.estados) {
      const anteriores = anterior?.estados ?? []
      if (JSON.stringify([...anteriores].sort()) !== JSON.stringify([...campos.estados].sort())) {
        await logActividad(id, user?.id, TIPO_ACTIVIDAD.CAMBIO_ESTADO, { anteriores, nuevos: campos.estados })
      }
    }
    // Reprogramación: si el form mandó fecha_limite y difiere de la que
    // había, queda su propio evento con {anterior, nueva} — EDICION no
    // guarda detalle, así que sin esto la métrica de Estadísticas no
    // tendría de dónde salir. limpiarCampos ya convirtió '' en null, y
    // la columna es date (string 'YYYY-MM-DD' o null): la comparación
    // directa con ?? null cubre también fijar o quitar la fecha.
    if ('fecha_limite' in campos && (anterior?.fecha_limite ?? null) !== (campos.fecha_limite ?? null)) {
      await logActividad(id, user?.id, TIPO_ACTIVIDAD.REPROGRAMACION, {
        anterior: anterior?.fecha_limite ?? null,
        nueva: campos.fecha_limite ?? null,
      })
    }
    if (asignados !== undefined) {
      const idsAnteriores = (anterior?.pedido_asignados ?? []).map(a => a.user_id)
      const agregados = asignados.filter(uid => !idsAnteriores.includes(uid))
      const removidos = idsAnteriores.filter(uid => !asignados.includes(uid))
      // Se tocan solo las filas que realmente cambian (no se borra/reinserta
      // todo) para que el trigger trg_notif_asignacion no le mande
      // "te asignaron al pedido" de nuevo a alguien que ya estaba asignado.
      if (removidos.length) {
        const { error: errorQuitar } = await supabase.from('pedido_asignados').delete().eq('pedido_id', id).in('user_id', removidos)
        if (errorQuitar) throw errorQuitar
      }
      if (agregados.length) {
        const { error: errorAgregar } = await supabase.from('pedido_asignados').insert(agregados.map(uid => ({ pedido_id: id, user_id: uid })))
        if (errorAgregar) throw errorAgregar
      }
      if (agregados.length || removidos.length) {
        const { data: perfiles } = await supabase.from('profiles').select('id, full_name').in('id', [...agregados, ...removidos])
        const nombre = uid => perfiles?.find(p => p.id === uid)?.full_name ?? uid
        await logActividad(id, user?.id, TIPO_ACTIVIDAD.ASIGNACION, { agregados: agregados.map(nombre), removidos: removidos.map(nombre) })
      }
    }
    const camposEditados = Object.keys(campos).filter(k => !['prioridad', 'estados'].includes(k))
    if (camposEditados.length > 0) {
      await logActividad(id, user?.id, TIPO_ACTIVIDAD.EDICION)
    }
    // No se llama a fetchPedidos() aquí: el realtime actualiza esa fila
    // puntual en memoria si está visible (ver caso 1 más arriba).
  }

  async function eliminarPedido(id) {
    const { error } = await supabase.from('pedidos')
      .update({ deleted_at: new Date().toISOString(), deleted_by: user?.id }).eq('id', id)
    if (error) throw error
    await logActividad(id, user?.id, TIPO_ACTIVIDAD.ELIMINACION)
    // No se llama a fetchPedidos() aquí: el realtime saca la fila de la
    // lista local si ya no matchea los filtros (deleted_at no es null).
  }

  async function restaurarPedido(id) {
    const { error } = await supabase.from('pedidos').update({ deleted_at: null, deleted_by: null }).eq('id', id)
    if (error) throw error
    await logActividad(id, user?.id, TIPO_ACTIVIDAD.RESTAURACION)
    // No se llama a fetchPedidos() aquí: el realtime actualiza/agrega
    // según corresponda (ver casos 1 y 2 más arriba).
  }

  // Borrado DEFINITIVO — irreversible, solo super_admin y solo sobre
  // pedidos ya en la papelera; la RPC valida todo server-side y limpia
  // los hijos sin cascade en una sola transacción (ver migración
  // 20260710100000). No se registra actividad: la actividad del pedido
  // se va con él.
  async function eliminarPedidoDefinitivo(id) {
    const { error } = await supabase.rpc('eliminar_pedido_definitivo', { p_pedido_id: id })
    if (error) throw error
  }

  return {
    pedidos, total, loading, error, hayNuevos, verNuevos,
    cargarMas, cargandoMas, hayMas: pedidos.length < total,
    crearPedido, actualizarPedido, eliminarPedido, restaurarPedido, eliminarPedidoDefinitivo,
    refetch: fetchPedidos,
  }
}
