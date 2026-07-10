// Avatares por usuario — util puro compartido por toda la app (cards,
// menciones, buscador, subtareas, modal de carga). Vivía en
// PedidoCard.jsx, que lo exportaba; mudado acá por
// react-refresh/only-export-components y porque un util de identidad
// visual no pertenece a una card.

// Paleta fija de colores para avatares — cada persona obtiene siempre el
// mismo color en toda la app, derivado de su user_id (estable aunque el
// nombre cambie), sin necesitar guardar nada nuevo en la base.
const PALETA_AVATARES = [
  '#5B4EE8', '#D0111B', '#10B981', '#F59E0B',
  '#3B82F6', '#EC4899', '#8B5CF6', '#14B8A6',
]

export function colorAvatar(userId) {
  if (!userId) return PALETA_AVATARES[0]
  let hash = 0
  for (let i = 0; i < userId.length; i++) hash = (hash + userId.charCodeAt(i)) % PALETA_AVATARES.length
  return PALETA_AVATARES[hash]
}

// Iniciales de nombre + apellido (primera y última palabra del nombre
// completo) — si solo hay una palabra, usa esa única inicial.
export function iniciales(nombreCompleto) {
  const partes = (nombreCompleto ?? '').trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '?'
  if (partes.length === 1) return partes[0][0].toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

