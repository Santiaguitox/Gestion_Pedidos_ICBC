import { useAuth } from '@/context/useAuth'
import { supabase } from '@/lib/supabase'
import { logActividad } from '@/hooks/useActividad'
import { TIPO_ACTIVIDAD } from '@/lib/constants'

// Extraído de usePedidos.js (D1 del informe de revisión): las mutaciones
// (crear/actualizar/eliminar/restaurar) no dependen en absoluto de tener
// la lista de pedidos cargada, pero PedidoDetalle, Papelera y Pedidos
// montaban usePedidos() completo solo para llamarlas — pagando en cada
// mount un listar_pedidos entero (30 filas con relaciones) descartado, y
// un canal de realtime escuchando la tabla completa mientras la pantalla
// estuviera abierta. Este hook es SOLO las mutaciones: sin useState, sin
// useEffect, sin canal. Los consumidores que sí necesitan la lista
// (PedidosList, Calendario) siguen usando usePedidos(filters) como antes
// — ese hook internamente reusa este mismo código, no lo duplica.
export function usePedidosMutations() {
  const { user } = useAuth()

  function limpiarCampos(data) {
    const limpio = { ...data }
    if (limpio.cantidad_envios === '' || limpio.cantidad_envios === undefined) limpio.cantidad_envios = null
    if (limpio.instancia === '') limpio.instancia = null
    if (limpio.tipo_envio === '') limpio.tipo_envio = null
    if (limpio.tipo_envio_otro === '') limpio.tipo_envio_otro = null
    if (limpio.fecha_limite === '') limpio.fecha_limite = null
    if (limpio.fecha_programacion === '') limpio.fecha_programacion = null
    if (limpio.hora_programacion === '') limpio.hora_programacion = null
    if (limpio.fecha_pedido_cliente === '') limpio.fecha_pedido_cliente = null
    if (limpio.hora_pedido_cliente === '') limpio.hora_pedido_cliente = null
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
    // No se llama a ningún refetch acá: quien esté mirando una lista
    // (usePedidos) recibe este INSERT por su propio canal de realtime.
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
    // No se llama a ningún refetch acá: quien esté mirando una lista
    // actualiza esa fila puntual en memoria vía su propio realtime.
  }

  async function eliminarPedido(id) {
    const { error } = await supabase.from('pedidos')
      .update({ deleted_at: new Date().toISOString(), deleted_by: user?.id }).eq('id', id)
    if (error) throw error
    await logActividad(id, user?.id, TIPO_ACTIVIDAD.ELIMINACION)
  }

  async function restaurarPedido(id) {
    const { error } = await supabase.from('pedidos').update({ deleted_at: null, deleted_by: null }).eq('id', id)
    if (error) throw error
    await logActividad(id, user?.id, TIPO_ACTIVIDAD.RESTAURACION)
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

  return { crearPedido, actualizarPedido, eliminarPedido, restaurarPedido, eliminarPedidoDefinitivo }
}
