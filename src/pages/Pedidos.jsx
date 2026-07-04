import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useState } from 'react'
import PedidosList from '@/components/pedidos/PedidosList'
import PedidoForm from '@/components/pedidos/PedidoForm'
import { usePedidos } from '@/hooks/usePedidos'

export default function Pedidos() {
  useDocumentTitle('Pedidos')

  const [showForm, setShowForm] = useState(false)
  const { crearPedido } = usePedidos()
  async function handleSave(data) { await crearPedido(data); setShowForm(false) }
  return (
    <>
      <PedidosList onNew={() => setShowForm(true)} />
      {showForm && <PedidoForm onSave={handleSave} onCancel={() => setShowForm(false)} />}
    </>
  )
}
