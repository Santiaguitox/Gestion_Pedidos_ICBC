import {
  Braces, ChevronDown, CircleAlert, CircleCheck, CircleX, Globe, Image as ImagenIcono,
  Info, Link as LinkIcono, Lock, LockOpen, TriangleAlert, Type,
} from 'lucide-react'
import BaseTest from './BaseTest.jsx'
import { PRUEBAS } from '../../lib/externo/puntaje.js'
import { GRUPOS_VARIABLES } from '../../lib/externo/variables.js'
import { TIPOS_LINK } from '../../lib/externo/inventarioLinks.js'
import { formatoKb, formatoNumero, formatoPeso } from '../../lib/externo/formato.js'

const ESTADOS = {
  ok: { texto: 'Correcto', Icono: CircleCheck },
  aviso: { texto: 'Advertencia', Icono: TriangleAlert },
  error: { texto: 'Error', Icono: CircleX },
}

function estadoDe(resultado) {
  if (resultado.ok) return 'ok'
  return resultado.advertencia ? 'aviso' : 'error'
}

const plural = (n, uno, varios) => `${formatoNumero(n)} ${n === 1 ? uno : varios}`

// ── Piezas comunes ─────────────────────────────────────────────────────

function Tarjeta({ estado, numero, titulo, resumen, children }) {
  const { texto, Icono } = ESTADOS[estado]
  return (
    <article className={`ex-tarjeta ex-tarjeta--${estado}`}>
      <header className="ex-tarjeta__cabecera">
        <span className="ex-tarjeta__numero">{numero}</span>
        <div className="ex-tarjeta__titulos">
          <h3 className="ex-tarjeta__titulo">{titulo}</h3>
          {resumen && <p className="ex-tarjeta__resumen">{resumen}</p>}
        </div>
        <span className={`ex-estado ex-estado--${estado}`}><Icono className="ex-icono" aria-hidden="true" />{texto}</span>
      </header>
      {children && <div className="ex-tarjeta__cuerpo">{children}</div>}
    </article>
  )
}

function TarjetaInfo({ Icono, titulo, resumen, children }) {
  return (
    <article className="ex-tarjeta">
      <header className="ex-tarjeta__cabecera">
        <span className="ex-tarjeta__icono-info"><Icono className="ex-icono" aria-hidden="true" /></span>
        <div className="ex-tarjeta__titulos">
          <h3 className="ex-tarjeta__titulo">{titulo}</h3>
          {resumen && <p className="ex-tarjeta__resumen">{resumen}</p>}
        </div>
        <span className="ex-estado ex-estado--info">Sin puntaje</span>
      </header>
      <div className="ex-tarjeta__cuerpo">{children}</div>
    </article>
  )
}

function Bloque({ clase, titulo, cantidad, children }) {
  return (
    <section className={`ex-lista-bloque ex-lista-bloque--${clase}`}>
      <h4 className="ex-lista-bloque__titulo">{titulo}{cantidad != null && <> <span className="ex-contador">{cantidad}</span></>}</h4>
      {children}
    </section>
  )
}

// Junta los items con exactamente el mismo texto: devuelve [{ it, veces }].
// Los que traen estilosPartidos no se juntan (cada uno tiene su detalle).
function agruparRepetidos(items) {
  const grupos = []
  const porTexto = new Map()
  for (const it of items) {
    const texto = typeof it === 'string' ? it : it.detalle
    if (typeof it !== 'string' && it.estilosPartidos) { grupos.push({ it, veces: 1 }); continue }
    const g = porTexto.get(texto)
    if (g) g.veces++
    else { const nuevo = { it, veces: 1 }; porTexto.set(texto, nuevo); grupos.push(nuevo) }
  }
  return grupos
}

function Items({ items, clase, Icono }) {
  return (
    <ul className="ex-lista-items">
      {agruparRepetidos(items).map(({ it, veces }, i) => (
        <li key={i} className={`ex-item ex-item--${clase}`}>
          <Icono className="ex-icono" aria-hidden="true" />
          {it.estilosPartidos ? (
            <div className="ex-item__cuerpo">
              <span className="ex-nombre-largo">{it.detalle}</span>
              <EtiquetasPartidas datos={it.estilosPartidos} />
            </div>
          ) : it.corrige ? (
            <div className="ex-item__cuerpo">
              <span className="ex-nombre-largo">{it.detalle}</span>
              <SelloCorreccion total={it.corrige.total} corregidas={it.corrige.corregidas} />
            </div>
          ) : (
            <span className="ex-nombre-largo">{typeof it === 'string' ? it : it.detalle}</span>
          )}
          {veces > 1 && <span className="ex-item__veces" title={`Aparece ${veces} veces`}>×{formatoNumero(veces)}</span>}
        </li>
      ))}
    </ul>
  )
}

// Con muchos items distintos, la lista queda plegada como el resto de los
// listados largos.
const ITEMS_VISIBLES = 3

function ItemsPlegables({ items, clase, Icono, etiqueta }) {
  const distintos = agruparRepetidos(items).length
  if (distintos <= ITEMS_VISIBLES) return <Items items={items} clase={clase} Icono={Icono} />
  return (
    <details className="ex-plegable">
      <summary className="ex-plegable__resumen">
        <Icono className="ex-icono" aria-hidden="true" />
        Ver {etiqueta(items.length)}
        <ChevronDown className="ex-icono ex-plegable__flecha" aria-hidden="true" />
      </summary>
      <div className="ex-plegable__contenido ex-plegable__contenido--items">
        <Items items={items} clase={clase} Icono={Icono} />
      </div>
    </details>
  )
}

// Sello "se corrige al descargar o copiar" (total/corregidas).
function SelloCorreccion({ total, corregidas }) {
  if (!(corregidas > 0)) return null
  return (
    <span className="ex-tipo-link ex-tipo-link--ok ex-item__sello">
      <CircleCheck className="ex-icono" aria-hidden="true" />
      {corregidas === total ? 'Se corrige al descargar o copiar' : `Se corrigen ${corregidas} de ${total} al descargar o copiar`}
    </span>
  )
}

// Style partido por comillas: indica si la descarga ya lo corrige y deja el
// detalle de cada etiqueta en un plegable.
function EtiquetasPartidas({ datos }) {
  const { total, corregidas, etiquetas } = datos
  return (
    <>
      <SelloCorreccion total={total} corregidas={corregidas} />
      <details className="ex-plegable ex-item__detalle">
        <summary className="ex-plegable__resumen">
          <Braces className="ex-icono" aria-hidden="true" />
          Ver {total === 1 ? 'la etiqueta' : `las ${formatoNumero(total)} etiquetas`}
          <ChevronDown className="ex-icono ex-plegable__flecha" aria-hidden="true" />
        </summary>
        <div className="ex-plegable__contenido">
          <div className="ex-tabla-envoltorio">
            <table className="ex-tabla">
              <thead>
                <tr><th scope="col">Etiqueta</th><th scope="col">Dónde se corta</th><th scope="col">Style sugerido</th></tr>
              </thead>
              <tbody>
                {etiquetas.map((e, i) => (
                  <tr key={i}>
                    <td className="ex-tabla__etiqueta">{e.etiqueta}</td>
                    <td className="ex-tabla__corte">
                      {e.corte ? (
                        <code className="ex-corte">
                          …{e.corte.antes}<mark className="ex-corte__comilla">{e.corte.comilla}</mark>{e.corte.despues}…
                        </code>
                      ) : '—'}
                    </td>
                    <td className="ex-tabla__estilo">{e.sugerido ?? e.nota}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </details>
    </>
  )
}

function NotaOk({ children }) {
  return <p className="ex-nota-ok"><CircleCheck className="ex-icono" aria-hidden="true" />{children}</p>
}

// ── Pruebas con el formato común del motor: { ok, detalle, checks, advertencias } ──

function CuerpoGenerico({ resultado, estado }) {
  const checks = resultado.checks || []
  const correctos = checks.filter(c => c.ok)
  const atencion = checks.filter(c => !c.ok)
  const menores = resultado.advertencias || []
  const claseAtencion = estado === 'aviso' ? 'aviso' : 'error'
  const IconoAtencion = estado === 'aviso' ? TriangleAlert : CircleX

  const sinNada = !correctos.length && !atencion.length && !menores.length
  return (
    <>
      {atencion.length > 0 && (
        <Bloque clase="atencion" titulo="Requiere atención" cantidad={atencion.length}>
          <Items items={atencion} clase={claseAtencion} Icono={IconoAtencion} />
        </Bloque>
      )}
      {/* Prueba que falló pero sin lista: se muestra el detalle como único aviso */}
      {estado !== 'ok' && atencion.length === 0 && (
        <Bloque clase="atencion" titulo="Requiere atención" cantidad={1}>
          <Items items={[resultado.detalle]} clase={claseAtencion} Icono={IconoAtencion} />
        </Bloque>
      )}
      {(resultado.consejos || []).map(c => (
        <Bloque key={c.titulo} clase="menor" titulo={c.titulo}>
          <Items items={[c.texto]} clase="menor" Icono={Info} />
        </Bloque>
      ))}
      {menores.length > 0 && (
        <Bloque clase="menor" titulo="Detalle menor" cantidad={menores.length}>
          <ItemsPlegables items={menores} clase="menor" Icono={CircleAlert} etiqueta={n => `los ${formatoNumero(n)} detalles menores`} />
        </Bloque>
      )}
      {correctos.length > 0 && (
        <Bloque clase="menor" titulo="Verificado" cantidad={correctos.length}>
          <Items items={correctos} clase="ok" Icono={CircleCheck} />
        </Bloque>
      )}
      {estado === 'ok' && sinNada && <NotaOk>{resultado.detalle}</NotaOk>}
    </>
  )
}

// ── 03 · Links: inventario completo ────────────────────────────────────

function claseTipoLink(tipo) {
  if (tipo === 'vacio' || tipo === 'placeholder') return ' ex-tipo-link--error'
  if (tipo === 'otro') return ' ex-tipo-link--aviso'
  return ''
}

function InventarioLinks({ inventario }) {
  if (!inventario.length) return null
  return (
    <details className="ex-plegable">
      <summary className="ex-plegable__resumen">
        <LinkIcono className="ex-icono" aria-hidden="true" />
        Ver {inventario.length === 1 ? 'el link' : `los ${formatoNumero(inventario.length)} links`}
        <ChevronDown className="ex-icono ex-plegable__flecha" aria-hidden="true" />
      </summary>
      <div className="ex-plegable__contenido">
        <div className="ex-tabla-envoltorio">
          <table className="ex-tabla">
            <thead>
              <tr><th scope="col">Texto o imagen</th><th scope="col">Destino</th><th scope="col">Tipo</th><th scope="col">Target</th></tr>
            </thead>
            <tbody>
              {inventario.map((l, i) => (
                <tr key={i} className={l.tipo === 'vacio' || l.tipo === 'placeholder' ? 'ex-tabla__fila-error' : undefined}>
                  <td>
                    <span className="ex-tabla__origen">
                      {l.esImagen && <ImagenIcono className="ex-icono" aria-hidden="true" />}
                      <span className="ex-nombre-largo">{l.etiqueta}</span>
                    </span>
                  </td>
                  <td className="ex-tabla__destino">{l.destino || '—'}</td>
                  <td><span className={`ex-tipo-link${claseTipoLink(l.tipo)}`}>{TIPOS_LINK[l.tipo]}</span></td>
                  <td>{l.target || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </details>
  )
}

// ── 06 · Peso de imágenes ──────────────────────────────────────────────

function CuerpoPesoImagenes({ r, estado }) {
  if (!r.imagenesConPeso) {
    return <p className="ex-nota"><CircleAlert className="ex-icono" aria-hidden="true" />{r.detalle}. El servicio no pudo consultar las imágenes de esta pieza.</p>
  }
  const claseAtencion = estado === 'aviso' ? 'aviso' : 'error'
  const avisos = []
  if (r.superaTotal) avisos.push(`Las imágenes pesan ${formatoPeso(r.pesoTotalBytes)} en total. Conviene dejarlas por debajo de ${formatoPeso(r.limiteTotalBytes)}.`)
  for (const img of r.ranking.filter(i => i.heavy)) {
    avisos.push(`${img.nombre} pesa ${formatoPeso(img.peso)}. Conviene dejarla por debajo de ${formatoPeso(r.limitePorImagenBytes)}.`)
  }
  const maximo = r.ranking[0]?.peso || 1
  return (
    <>
      {avisos.length > 0 && (
        <Bloque clase="atencion" titulo="Requiere atención" cantidad={avisos.length}>
          <Items items={avisos} clase={claseAtencion} Icono={claseAtencion === 'aviso' ? TriangleAlert : CircleX} />
        </Bloque>
      )}
      <details className="ex-plegable">
        <summary className="ex-plegable__resumen">
          <ImagenIcono className="ex-icono" aria-hidden="true" />
          Ver el ranking de {r.ranking.length === 1 ? 'la imagen' : `las ${formatoNumero(r.ranking.length)} imágenes`} por peso
          <ChevronDown className="ex-icono ex-plegable__flecha" aria-hidden="true" />
        </summary>
        <div className="ex-plegable__contenido">
          <ol className="ex-ranking">
            {r.ranking.map((img, i) => (
              <li key={i} className="ex-ranking__fila">
                <span className="ex-ranking__posicion">{i + 1}</span>
                <span className="ex-ranking__nombre">{img.nombre}</span>
                <progress className={`ex-medidor${img.heavy ? ' ex-medidor--aviso' : ''}`} max={maximo} value={img.peso}>{formatoPeso(img.peso)}</progress>
                <span className="ex-ranking__peso">{formatoPeso(img.peso)}</span>
              </li>
            ))}
          </ol>
        </div>
      </details>
    </>
  )
}

function resumenPesoImagenes(r) {
  if (!r.imagenesConPeso) return r.detalle
  const pesadas = r.ranking.filter(i => i.heavy).length
  const base = `${formatoPeso(r.pesoTotalBytes)} en total`
  return pesadas ? `${base} · ${plural(pesadas, 'imagen pesada', 'imágenes pesadas')}` : base
}

// ── 07 · Peso del HTML ─────────────────────────────────────────────────

function CuerpoPesoHtml({ r, estado }) {
  return (
    <div className="ex-limite">
      <progress className={`ex-medidor ex-medidor--${estado}`} max={r.limiteError} value={Math.min(r.kb, r.limiteError)}>
        {formatoKb(r.kb)} de {formatoKb(r.limiteError)}
      </progress>
      <div className="ex-limite__fila">
        <span>0 kb</span>
        <span>{formatoKb(r.limiteError)} · Gmail recorta el mensaje desde acá</span>
      </div>
    </div>
  )
}

// ── Datos adicionales ──────────────────────────────────────────────────

const ICONO_AVISO = { http: LockOpen }

function claseProtocolo(p) {
  return p === 'https' ? ' ex-tipo-link--ok' : ' ex-tipo-link--aviso'
}

// Lista de imágenes afectadas por un aviso. Con muchas, queda plegada.
const NOMBRES_VISIBLES = 4

function NombresAfectados({ nombres, etiqueta = 'imágenes', Icono = ImagenIcono }) {
  const lista = (
    <ul className="ex-afectadas">
      {nombres.map((n, i) => (
        <li key={i} className="ex-afectada" title={n}>
          <Icono className="ex-icono" aria-hidden="true" />
          <span className="ex-afectada__texto">{n}</span>
        </li>
      ))}
    </ul>
  )
  if (nombres.length <= NOMBRES_VISIBLES) return lista
  return (
    <details className="ex-plegable ex-item__detalle">
      <summary className="ex-plegable__resumen">
        <Icono className="ex-icono" aria-hidden="true" />
        Ver las {formatoNumero(nombres.length)} {etiqueta}
        <ChevronDown className="ex-icono ex-plegable__flecha" aria-hidden="true" />
      </summary>
      <div className="ex-plegable__contenido ex-plegable__contenido--afectadas">{lista}</div>
    </details>
  )
}

function TarjetaDominios({ datos }) {
  const { dominios, avisos, total } = datos
  const dinamicas = datos.dinamicas || []
  const restan = total - dinamicas.length
  const variablesDinamicas = [...new Set(dinamicas.map(d => d.variable))]
  const partes = []
  if (dominios.length) partes.push(`${plural(dominios.length, 'dominio', 'dominios')} · ${plural(restan, 'imagen', 'imágenes')}`)
  else if (restan) partes.push(`${plural(restan, 'imagen', 'imágenes')} sin dominio propio`)
  if (dinamicas.length) partes.push(`${plural(dinamicas.length, 'imagen dinámica', 'imágenes dinámicas')}`)
  const resumen = partes.length ? partes.join(' · ') : 'La pieza no tiene imágenes'
  return (
    <TarjetaInfo Icono={Globe} titulo="Dominios de imágenes" resumen={resumen}>
      {dominios.length > 0 && (
        <div className="ex-tabla-envoltorio">
          <table className="ex-tabla">
            <thead>
              <tr>
                <th scope="col">Dominio</th>
                <th scope="col" className="ex-tabla__cifra">Imágenes</th>
                <th scope="col" className="ex-tabla__cifra">Peso total</th>
                <th scope="col">Protocolo</th>
              </tr>
            </thead>
            <tbody>
              {dominios.map(d => (
                <tr key={d.host}>
                  <td><span className="ex-tabla__origen"><Globe className="ex-icono" aria-hidden="true" /><span className="ex-nombre-largo">{d.host}</span></span></td>
                  <td className="ex-tabla__cifra">{formatoNumero(d.cantidad)}</td>
                  <td className="ex-tabla__cifra">{d.medidas ? formatoPeso(d.pesoBytes) : '—'}</td>
                  <td>
                    <span className={`ex-tipo-link${claseProtocolo(d.protocolo)}`}>
                      {d.protocolo === 'https' ? <Lock className="ex-icono" aria-hidden="true" /> : <LockOpen className="ex-icono" aria-hidden="true" />}
                      {d.protocolo}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {avisos.length > 0 ? (
        <Bloque clase="menor" titulo="Avisos" cantidad={avisos.length}>
          <ul className="ex-lista-items">
            {avisos.map(a => {
              const Icono = ICONO_AVISO[a.tipo] || TriangleAlert
              const varios = a.nombres.length > 1
              return (
                <li key={a.tipo} className="ex-item ex-item--aviso">
                  <Icono className="ex-icono" aria-hidden="true" />
                  <div className="ex-item__cuerpo">
                    <span className="ex-nombre-largo">
                      <strong>{varios ? plural(a.nombres.length, 'imagen', 'imágenes') : a.nombres[0]}</strong> {a.predicado}
                      {a.detalle && <> {a.detalle}</>}
                    </span>
                    {varios && <NombresAfectados nombres={a.nombres} />}
                  </div>
                </li>
              )
            })}
          </ul>
        </Bloque>
      ) : restan > 0 && <NotaOk>Sin avisos: todas las imágenes se cargan por https y se pudieron medir.</NotaOk>}
      {dinamicas.length > 0 && (
        <Bloque clase="info" titulo="Imágenes dinámicas" cantidad={dinamicas.length}>
          <ul className="ex-lista-items">
            <li className="ex-item">
              <Info className="ex-icono" aria-hidden="true" />
              <div className="ex-item__cuerpo">
                <span className="ex-nombre-largo">
                  {variablesDinamicas.length === 1
                    ? <><strong>{variablesDinamicas[0]}</strong> completa la URL de la imagen con el dato de la base de cada envío. No se puede medir desde acá.</>
                    : <><strong>{plural(variablesDinamicas.length, 'variable', 'variables')}</strong> completan la URL de la imagen con el dato de la base de cada envío. No se pueden medir desde acá.</>}
                </span>
                {variablesDinamicas.length > 1 && <NombresAfectados nombres={variablesDinamicas} etiqueta="variables" Icono={Braces} />}
              </div>
            </li>
          </ul>
        </Bloque>
      )}
    </TarjetaInfo>
  )
}

const GRUPOS = {
  texto: { titulo: 'En texto', Icono: Type },
  links: { titulo: 'En links', Icono: LinkIcono },
  imagenes: { titulo: 'En imágenes', Icono: ImagenIcono },
  otros: { titulo: 'Otros', Icono: Braces },
}

function TarjetaVariables({ datos, baseTest }) {
  const resumen = datos.unicas === 0
    ? 'No se encontraron variables'
    : `${plural(datos.unicas, 'variable', 'variables')} en la pieza`
  return (
    <TarjetaInfo Icono={Braces} titulo="Variables de personalización" resumen={resumen}>
      {datos.unicas === 0 ? (
        <p className="ex-nota"><CircleAlert className="ex-icono" aria-hidden="true" />La pieza no usa variables del tipo {'<*Nombre*>'}.</p>
      ) : (
        <div className="ex-grupos-variables">
          {GRUPOS_VARIABLES.filter(g => datos.grupos[g].length > 0).map(g => {
            const { titulo, Icono } = GRUPOS[g]
            const lista = datos.grupos[g]
            return (
              <section key={g} className="ex-grupo-variables">
                <h4 className="ex-grupo-variables__titulo"><Icono className="ex-icono" aria-hidden="true" />{titulo}<span className="ex-contador">{lista.length}</span></h4>
                <div className="ex-archivos">
                  {lista.map(v => (
                    <span key={v.variable} className="ex-archivo" title={v.cantidad > 1 ? `${v.cantidad} veces` : undefined}>
                      {v.variable}{v.cantidad > 1 && <> ×{v.cantidad}</>}
                    </span>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
      {datos.unicas > 0 && baseTest && <BaseTest html={baseTest.html} nombreArchivo={baseTest.nombreArchivo} />}
      {datos.escapadas > 0 && (
        <p className="ex-nota">
          <CircleAlert className="ex-icono" aria-hidden="true" />
          {plural(datos.escapadas, 'aparición viene', 'apariciones vienen')} escapada{datos.escapadas === 1 ? '' : 's'} en el HTML (por ejemplo &amp;lt;*Nombre*&amp;gt;). Acá se muestran igual.
        </p>
      )}
    </TarjetaInfo>
  )
}

// ── Informe completo ───────────────────────────────────────────────────

export default function InformeCalidad({ resultados, dominios, variables, inventario, baseTest }) {
  return (
    <div className="ex-informe">
      <div className="ex-informe__cabecera">
        <h2 className="ex-seccion-titulo">Informe de calidad</h2>
        <span className="ex-informe__cabecera-nota">{PRUEBAS.length} pruebas</span>
      </div>

      {PRUEBAS.map(p => {
        const r = resultados[p.clave]
        if (!r) return null
        const estado = estadoDe(r)
        let resumen = r.detalle
        let cuerpo = <CuerpoGenerico resultado={r} estado={estado} />

        if (p.clave === 'pesoImagenes') {
          resumen = resumenPesoImagenes(r)
          cuerpo = <CuerpoPesoImagenes r={r} estado={estado} />
        } else if (p.clave === 'pesoHTML') {
          resumen = formatoKb(r.kb)
          cuerpo = <CuerpoPesoHtml r={r} estado={estado} />
        } else if (p.clave === 'links') {
          cuerpo = <><CuerpoGenerico resultado={r} estado={estado} /><InventarioLinks inventario={inventario} /></>
        }
        return <Tarjeta key={p.clave} estado={estado} numero={p.numero} titulo={p.titulo} resumen={resumen}>{cuerpo}</Tarjeta>
      })}

      <div className="ex-informe__cabecera ex-informe__separador">
        <h2 className="ex-seccion-titulo">Datos adicionales</h2>
        <span className="ex-informe__cabecera-nota">Informativo, no suma al puntaje</span>
      </div>
      <TarjetaDominios datos={dominios} />
      <TarjetaVariables datos={variables} baseTest={baseTest} />
    </div>
  )
}
