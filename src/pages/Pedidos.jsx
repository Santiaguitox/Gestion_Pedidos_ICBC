import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import PedidosList from '@/components/pedidos/PedidosList'
import PedidoForm from '@/components/pedidos/PedidoForm'
import { usePedidos } from '@/hooks/usePedidos'

export default function Pedidos() {
  useDocumentTitle('Pedidos')

  const location = useLocation()
  const navigate = useNavigate()
  const [showForm, setShowForm] = useState(false)
  const { crearPedido } = usePedidos()

  // ─── Abrir el form desde afuera (acción "Nuevo pedido" del Ctrl+K) ──
  // El buscador navega acá con state.abrirNuevo. Se detecta con el
  // patrón adjust-during-render (pasa el lint de React 19, un
  // useEffect con setState no): cada navigate() genera un location.key
  // NUEVO aunque la ruta sea la misma, así que comparar contra la
  // última key procesada cubre los dos casos — llegar desde otra
  // pantalla (montaje) y disparar la acción estando YA parado en
  // /pedidos (re-render sin remount).
  const [keyAbrirProcesada, setKeyAbrirProcesada] = useState(null)
  if (location.state?.abrirNuevo && location.key !== keyAbrirProcesada) {
    setKeyAbrirProcesada(location.key)
    if (!showForm) setShowForm(true)
  }

  // Al cerrar, además de esconder el form se limpia el state de la
  // entrada de history (replace) — sin esto, un F5 o un back/forward
  // sobre esta entrada volvería a encontrar abrirNuevo y reabriría el
  // modal solo.
  function cerrarForm() {
    setShowForm(false)
    if (location.state?.abrirNuevo) {
      navigate(location.pathname, { replace: true, state: null })
    }
  }

  async function handleSave(data) { await crearPedido(data); cerrarForm() }

  return (
    <>
      <PedidosList onNew={() => setShowForm(true)} />
      {showForm && <PedidoForm onSave={handleSave} onCancel={cerrarForm} />}
    </>
  )
}
