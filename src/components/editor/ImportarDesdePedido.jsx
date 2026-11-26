import { useState } from 'react'
import { AlertCircle, Loader2, Sparkles, Check } from 'lucide-react'
import { interpretarPedido } from '@/lib/editor/pedido/index.js'
import { llamarIaPedido } from '@/lib/editor/pedido/interpretarPedidoClient.js'

// Tercera pestaña de "Importar pieza": el PM pega el pedido del cliente y la
// pieza de referencia (link o HTML). La app importa la referencia con el
// importador de siempre, la IA propone cambios mínimos y acá se revisan antes
// de cargar nada al editor. Los estilos están en EditorPiezas.css (ep-pedido-*).

const ETIQUETA_TIPO = { texto: 'Texto', link: 'Link', imagen: 'Imagen', legal: 'Legal' }

function recorte(s, max = 160) {
  const t = String(s ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  return t.length > max ? `${t.slice(0, max)}…` : t
}

export default function ImportarDesdePedido({ onAplicar, onCancelar }) {
  const [pedido, setPedido] = useState('')
  const [referencia, setReferencia] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [salida, setSalida] = useState(null)
  const [confirmoDudas, setConfirmoDudas] = useState(false)

  async function interpretar() {
    setError('')
    if (!pedido.trim()) return setError('Pegá el texto del pedido.')
    if (!referencia.trim()) return setError('Pegá el link o el HTML de la pieza de referencia.')
    setCargando(true)
    try {
      const ref = referencia.trim()
      const referenciaHtml = /^https?:\/\/\S+$/i.test(ref)
        ? await fetch(`/api/proxy?url=${encodeURIComponent(ref)}`).then(r => {
            if (!r.ok) throw new Error('No se pudo obtener el HTML de ese link.')
            return r.text()
          })
        : ref
      const r = await interpretarPedido({ pedido, referenciaHtml, llamarIa: llamarIaPedido })
      if (r.error) setError(r.error)
      else { setSalida(r); setConfirmoDudas(false) }
    } catch (e) {
      setError(e?.message || 'No se pudo interpretar el pedido.')
    } finally {
      setCargando(false)
    }
  }

  if (cargando) {
    return (
      <div className="ep-pedido-cargando">
        <Loader2 size={18} className="ep-pedido-spin" />
        <span>Leyendo el pedido y comparándolo con la referencia…</span>
      </div>
    )
  }

  if (salida) {
    const bloqueantes = salida.dudas.filter(d => d.bloqueante)
    const otras = salida.dudas.filter(d => !d.bloqueante)
    const hayBloqueantes = bloqueantes.length > 0
    const puedeCargar = !hayBloqueantes || confirmoDudas
    return (
      <>
        <div className="ep-pedido-resultado">
          {hayBloqueantes && (
            <div className="ep-pedido-bloque ep-pedido-bloque-bloqueante">
              <div className="ep-pedido-bloque-titulo"><AlertCircle size={14} /> Resolvé esto antes de enviar</div>
              <ul>{bloqueantes.map((d, i) => <li key={i}>{d.texto}</li>)}</ul>
            </div>
          )}
          {otras.length > 0 && (
            <div className="ep-pedido-bloque ep-pedido-bloque-duda">
              <div className="ep-pedido-bloque-titulo">Dudas para confirmar</div>
              <ul>{otras.map((d, i) => <li key={i}>{d.texto}</li>)}</ul>
            </div>
          )}
          <div className="ep-pedido-bloque">
            <div className="ep-pedido-bloque-titulo">
              {salida.cambios.length > 0 ? `Cambios propuestos (${salida.cambios.length})` : 'Sin cambios propuestos'}
            </div>
            {salida.cambios.map(c => (
              <div className="ep-pedido-cambio" key={`${c.id}-${c.tipo}`}>
                <div className="ep-pedido-cambio-cab">
                  <span className="ep-pedido-chip">{ETIQUETA_TIPO[c.tipo] ?? c.tipo}</span>
                  <span className="ep-pedido-cambio-bloque">{c.bloque}</span>
                </div>
                <div className="ep-pedido-antes">{recorte(c.antes) || '(vacío)'}</div>
                <div className="ep-pedido-despues">{recorte(c.despues)}</div>
              </div>
            ))}
          </div>
          {hayBloqueantes && (
            <label className="ep-pedido-confirmar">
              <input type="checkbox" checked={confirmoDudas} onChange={e => setConfirmoDudas(e.target.checked)} />
              <span>Entiendo que hay puntos sin resolver y quiero cargar la pieza igual.</span>
            </label>
          )}
        </div>
        <div className="ep-importar-footer">
          <button className="ep-btn ep-btn-ghost" onClick={() => setSalida(null)}>Volver</button>
          <button className="ep-btn ep-btn-primary" disabled={!puedeCargar} onClick={() => onAplicar(salida.resultado)}>
            <Check size={13} /> Cargar en el editor
          </button>
        </div>
      </>
    )
  }

  return (
    <>
      <label className="ep-pedido-label" htmlFor="ep-pedido-texto">Pedido del cliente</label>
      <textarea
        id="ep-pedido-texto"
        className="ep-importar-input"
        autoComplete="off"
        placeholder="Pegá acá el pedido (Header, Copy, Fecha, CTA, Link, Legal…). Sin firmas ni datos que no aporten al pedido."
        rows={9}
        value={pedido}
        onChange={e => setPedido(e.target.value)}
      />
      <label className="ep-pedido-label" htmlFor="ep-pedido-ref">Pieza de referencia (link o HTML)</label>
      <textarea
        id="ep-pedido-ref"
        className="ep-importar-input ep-pedido-ref"
        autoComplete="off"
        placeholder="https://icbc-info.icommarketing.com/…  o el HTML de la pieza"
        rows={3}
        value={referencia}
        onChange={e => setReferencia(e.target.value)}
      />
      {error && <div className="ep-importar-error">{error}</div>}
      <div className="ep-importar-footer">
        <button className="ep-btn ep-btn-ghost" onClick={onCancelar}>Cancelar</button>
        <button className="ep-btn ep-btn-primary" onClick={interpretar}>
          <Sparkles size={13} /> Interpretar pedido
        </button>
      </div>
    </>
  )
}
