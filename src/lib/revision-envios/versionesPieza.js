// Detecta si nombre_pieza termina en un sufijo de versión tipo "_v1",
// "_V2", "_v10" — separa el "nombre base" (todo antes del sufijo) del
// número de versión. Devuelve null si el nombre no tiene ese patrón,
// para poder distinguir "pieza sin versionar" de "versión 1 implícita".
//
// Solo reconoce el sufijo al FINAL del nombre, no en cualquier lugar —
// "Newsletter_v2_corregido" no matchea (el _v2 no es lo último), a
// propósito: si alguien usa "_v2" en medio del nombre con otro sentido,
// no queremos agruparlo por error con algo que no tiene relación.
const VERSION_SUFFIX_RE = /^(.*)_v(\d+)$/i

export function parseVersionPieza(nombrePieza) {
  if (!nombrePieza) return null
  const m = nombrePieza.trim().match(VERSION_SUFFIX_RE)
  if (!m) return null
  return { nombreBase: m[1], version: parseInt(m[2], 10) }
}

// Dado un conjunto de piezas (entregables), agrupa las que comparten
// nombre base y se queda solo con la de versión más alta de cada grupo.
// Las piezas sin patrón de versión pasan todas, sin agrupar entre sí
// (cada una es "única" salvo que coincida nombre completo, lo cual ya
// está bloqueado en otro lado por la validación de nombre duplicado).
//
// Devuelve { vigentes, excluidas } — vigentes es la lista a usar para
// la verificación automática; excluidas es la lista de versiones viejas
// que se dejaron afuera, útil solo para mostrar un aviso informativo
// ("se excluyeron 2 versiones anteriores"), nunca para bloquear nada:
// la asignación manual a una pieza específica (dropdown "Aplica a")
// sigue pudiendo elegir cualquier pieza, versionada o no, vigente o no.
export function filtrarSoloUltimaVersion(piezas) {
  const sinVersion = []
  const porNombreBase = new Map()

  piezas.forEach(p => {
    const v = parseVersionPieza(p.nombre_pieza)
    if (!v) { sinVersion.push(p); return }
    const actual = porNombreBase.get(v.nombreBase)
    if (!actual || v.version > actual.version) {
      porNombreBase.set(v.nombreBase, { ...v, pieza: p })
    }
  })

  const vigentesVersionadas = [...porNombreBase.values()].map(x => x.pieza)
  const vigentes = [...sinVersion, ...vigentesVersionadas]
  const idsVigentes = new Set(vigentes.map(p => p.id))
  const excluidas = piezas.filter(p => !idsVigentes.has(p.id))

  return { vigentes, excluidas }
}
