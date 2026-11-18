// Lista de las herramientas públicas (sin login) de TeamWorkHub.
//
// De acá salen la navegación compartida y las tarjetas de la landing (/customer):
// para sumar una herramienta alcanza con agregar una entrada. Cada herramienta
// vive en su propia ruta, su propia página y su propia hoja de estilos
// (ver src/styles/Externo*.css).

export const RUTA_INICIO = '/customer'

/**
 * estado: 'activa' (aparece en la nav y en la landing, con link) o
 *         'proximamente' (solo en la landing, como tarjeta deshabilitada).
 * icono: nombre de un ícono de HerramientaIcono.jsx.
 */
export const HERRAMIENTAS = [
  {
    id: 'analisis',
    nombre: 'Análisis HTML',
    ruta: '/analisis',
    icono: 'analisis',
    estado: 'activa',
    nuevo: false,
    descripcion: 'Escaneá una comunicación cargada en la plataforma del cliente y descubrí si hay detalles que requieren atención.',
  },
  {
    id: 'estructuras',
    nombre: 'Estructura tipo tabla',
    ruta: '/estructuras-tabla',
    icono: 'estructuras',
    estado: 'activa',
    nuevo: true,
    descripcion: 'Aprendé cómo funciona con ejemplos básicos. Generá diseños personalizados para tus clientes y descargá el HTML y la base listos para testear.',
  },
  // Para mostrar una herramienta que todavía no está lista, descomentar y completar:
  // {
  //   id: 'proximo',
  //   nombre: 'Nueva herramienta',
  //   ruta: null,
  //   icono: 'proximamente',
  //   estado: 'proximamente',
  //   nuevo: false,
  //   descripcion: 'Estamos trabajando en la próxima. Cuando esté lista, aparece acá.',
  // },
]

export const herramientasActivas = () => HERRAMIENTAS.filter(h => h.estado === 'activa' && h.ruta)

/** Items de la navegación: Inicio + las herramientas activas. */
export function itemsDeNavegacion() {
  return [{ id: 'inicio', nombre: 'Inicio', ruta: RUTA_INICIO, icono: 'inicio' }, ...herramientasActivas()]
}
