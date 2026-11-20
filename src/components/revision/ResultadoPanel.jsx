import { useState } from 'react'
import { Check, AlertTriangle, X, Copy } from 'lucide-react'
import { textoParaBuscar } from '@/lib/revision/textoParaBuscar'

// Copia al portapapeles el texto para buscar con Ctrl+F en el HTML de la pieza
// (ver lib/revision/textoParaBuscar). No dispara el "ver en la pieza".
function CopiarBuscable({ refHallazgo, html }) {
  const [copiado, setCopiado] = useState(false)

  async function copiar(e) {
    e.stopPropagation()
    const texto = textoParaBuscar(refHallazgo, html)
    if (!texto) return
    try {
      await navigator.clipboard.writeText(texto)
    } catch {
      const area = document.createElement('textarea')
      area.value = texto
      area.style.position = 'fixed'
      area.style.opacity = '0'
      document.body.appendChild(area)
      area.select()
      try { document.execCommand('copy') } catch { /* sin portapapeles disponible */ }
      area.remove()
    }
    setCopiado(true)
    setTimeout(() => setCopiado(false), 1200)
  }

  return (
    <button
      type="button"
      className={`re-copiar${copiado ? ' copiado' : ''}`}
      onClick={copiar}
      title="Copiar para buscar en el HTML (Ctrl+F)"
      aria-label="Copiar para buscar en el HTML"
    >
      {copiado ? <><Check size={12} strokeWidth={3} /> Copiado</> : <Copy size={12} />}
    </button>
  )
}

function ResultadoCard({ resultado, delay, children }) {
  if (!resultado) return null
  const esAdvertencia = resultado.advertencia && !resultado.ok
  const estado = resultado.ok ? 'ok' : esAdvertencia ? 'warn' : 'error'
  const Icon = estado === 'ok' ? Check : estado === 'warn' ? AlertTriangle : X

  return (
    <div className={`re-card ${estado}`} style={{ animationDelay: `${delay}ms` }}>
      <div className="re-card-body">
        <div className="re-card-title"><span className="re-card-num">{resultado.numero}</span>{resultado.tipo}</div>
        <div className="re-card-detail">{resultado.detalle}</div>
        {children}
      </div>
      <span className="re-card-icon"><Icon size={15} strokeWidth={estado === 'warn' ? 2.3 : 3} /></span>
    </div>
  )
}

function SubcheckList({ checks }) {
  if (!checks?.length) return null
  return (
    <div className="re-subchecks">
      {checks.map((c, i) => (
        <span key={i} className="re-subcheck"><Check size={12} strokeWidth={3} />{c.detalle}</span>
      ))}
    </div>
  )
}

// Lista de items secundarios dentro de una card (ej: "Detalle menor" en
// Links, "Requiere atención" en Alt de imágenes, imágenes pesadas
// ordenadas en Peso de imágenes) — el color sigue la severidad real de
// cada caso, no siempre es ámbar.
function ItemsList({ label, items, color = 'var(--yellow-text)', onIr, html }) {
  if (!items?.length) return null
  return (
    <div className="re-items-block">
      <div className="re-items-label" style={{ color }}>{label}</div>
      <div className="re-items-list">
        {items.map((it, i) => {
          const ref = typeof it === 'string' ? null : it.ref
          const clickeable = Boolean(ref && onIr)
          return (
            <div key={i} className="re-item-row">
              <span className="re-item-dot" style={{ background: color }} />
              <span
                className={`re-item-texto${clickeable ? ' re-item-clickeable' : ''}`}
                {...(clickeable && {
                  role: 'button',
                  tabIndex: 0,
                  title: 'Ver en la pieza',
                  onClick: () => onIr(ref),
                  onKeyDown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onIr(ref) } },
                })}
              >
                {typeof it === 'string' ? it : it.detalle}
              </span>
              {ref && <CopiarBuscable refHallazgo={ref} html={html} />}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// onIr(ref): opcional. Si viene, los ítems con `ref` se pueden clickear para
// ubicarlos en la pieza renderizada (ver lib/revision/localizarEnPreview).
// html: el HTML analizado, para que el botón de copiar arme el texto tal como
// está escrito en la pieza (ver lib/revision/textoParaBuscar).
export default function ResultadoPanel({ resultados, onIr, html }) {
  return (
    <div className="re-cards">

      <ResultadoCard resultado={{ ...resultados.estructuraHTML, numero: '01' }} delay={0}>
        <SubcheckList checks={resultados.estructuraHTML?.checks?.filter(c => c.ok)} />
        <ItemsList onIr={onIr} html={html} label="Requiere atención" items={resultados.estructuraHTML?.checks?.filter(c => !c.ok)} color="var(--accent-primary)" />
      </ResultadoCard>

      <ResultadoCard resultado={{ ...resultados.clasesCSS, numero: '02' }} delay={80} />

      <ResultadoCard resultado={{ ...resultados.legal, numero: '03' }} delay={160}>
        <SubcheckList checks={resultados.legal?.checks?.filter(c => c.ok)} />
        <ItemsList onIr={onIr} html={html} label="Requiere atención" items={resultados.legal?.checks?.filter(c => !c.ok)} color="var(--accent-primary)" />
      </ResultadoCard>

      <ResultadoCard resultado={{ ...resultados.links, numero: '04' }} delay={240}>
        <ItemsList onIr={onIr} html={html} label="Requiere atención" items={resultados.links?.checks?.filter(c => !c.ok)} color="var(--accent-primary)" />
        <ItemsList onIr={onIr} html={html} label="Detalle menor" items={resultados.links?.advertencias} color="var(--yellow-text)" />
      </ResultadoCard>

      <ResultadoCard resultado={{ ...resultados.dominioImagenes, numero: '05' }} delay={320}>
        <ItemsList onIr={onIr} html={html} label="Requiere atención" items={resultados.dominioImagenes?.checks?.filter(c => !c.ok)} color="var(--accent-primary)" />
      </ResultadoCard>

      <ResultadoCard resultado={{ ...resultados.altImagenes, numero: '06' }} delay={400}>
        <ItemsList onIr={onIr} html={html} label="Requiere atención" items={resultados.altImagenes?.checks?.filter(c => !c.ok)} color="var(--accent-primary)" />
        {/* Verificación con IA (el alt corresponde a lo que muestra la
            imagen): vive DENTRO de esta tarjeta, no es una prueba aparte.
            Ver combinarAltConIA en lib/revision/altIA. */}
        <ItemsList onIr={onIr} html={html} label="El alt no coincide con la imagen" items={resultados.altImagenes?.ia?.checks?.filter(c => !c.ok)} color="var(--accent-primary)" />
        <ItemsList onIr={onIr} html={html} label="Detalle menor" items={resultados.altImagenes?.ia && !resultados.altImagenes.ia.omitido ? resultados.altImagenes.ia.advertencias : []} color="var(--yellow-text)" />
        <ItemsList onIr={onIr} html={html} label="Verificación con IA" items={resultados.altImagenes?.ia?.omitido ? [resultados.altImagenes.ia.detalle] : []} color="var(--yellow-text)" />
      </ResultadoCard>

      <ResultadoCard resultado={{ ...resultados.dimensiones, numero: '07' }} delay={480}>
        <ItemsList onIr={onIr} html={html} label="Requiere atención" items={resultados.dimensiones?.checks?.filter(c => !c.ok)} color="var(--accent-primary)" />
        {/* Separadores estructurales estirados: mismo patrón que Links —
            no fallan la prueba, se listan en amarillo por si vale la
            pena mirarlos. Ver lib/imagenesEstructurales. */}
        <ItemsList onIr={onIr} html={html} label="Detalle menor" items={resultados.dimensiones?.advertencias} color="var(--yellow-text)" />
      </ResultadoCard>

      <ResultadoCard resultado={{ ...resultados.pesoImagenes, numero: '08' }} delay={560}>
        <ItemsList onIr={onIr} html={html} label="Ordenadas por peso" items={resultados.pesoImagenes?.checks} color="var(--accent-primary)" />
      </ResultadoCard>

      <ResultadoCard resultado={{ ...resultados.pesoHTML, numero: '09' }} delay={640} />

      {/* Estructuras obsoletas — siempre se muestra como card propia
          (no usa ResultadoCard porque su lógica visual es distinta: es
          roja apenas hay 1+ coincidencias, sin estado "warn" intermedio,
          y puede listar varias plantillas distintas, no un solo detalle). */}
      {(() => {
        const templates = resultados.resumenTemplates ?? []
        const hayObsoletas = templates.length > 0
        return (
          <div className={hayObsoletas ? 're-obsoleta-card' : 're-card ok'} style={{ animationDelay: '720ms' }}>
            {hayObsoletas ? (
              <div className="re-obsoleta-head">
                <div className="re-obsoleta-body">
                  <div className="re-obsoleta-title"><span className="re-card-num">10</span>Estructuras obsoletas detectadas</div>
                  <div className="re-obsoleta-detail">
                    Coincide con {templates.length === 1 ? 'una plantilla obsoleta conocida' : `${templates.length} plantillas obsoletas conocidas`}
                  </div>
                  {templates.map((t, i) => (
                    <div key={i} className="re-obsoleta-detail-box">
                      <div className="re-obsoleta-tpl-name">{t.banda ? t.nombre : <>Plantilla: <code>{t.nombre}</code></>}</div>
                      {t.errores.map((e, j) => {
                        const clickeable = Boolean(e.ref && onIr)
                        return (
                          <div key={j} className="re-obsoleta-tpl-detail">
                            <span
                              className={clickeable ? 're-item-clickeable' : undefined}
                              {...(clickeable && {
                                role: 'button',
                                tabIndex: 0,
                                title: 'Ver en la pieza',
                                onClick: () => onIr(e.ref),
                                onKeyDown: ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onIr(e.ref) } },
                              })}
                            ><strong>{e.tipo}:</strong> {e.detalle}</span>
                            {e.ref && <CopiarBuscable refHallazgo={e.ref} html={html} />}
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
                <span className="re-obsoleta-badge">Error grave</span>
              </div>
            ) : (
              <>
                <div className="re-card-body">
                  <div className="re-card-title"><span className="re-card-num">10</span>Estructuras obsoletas detectadas</div>
                  <div className="re-card-detail">No se detectaron coincidencias con plantillas obsoletas</div>
                </div>
                <span className="re-card-icon"><Check size={15} strokeWidth={3} /></span>
              </>
            )}
          </div>
        )
      })()}

      {/* Ortografía y redacción: tarjeta aparte, siempre amarilla (nunca
          error) y fuera del "X de 10 pruebas". Ver lib/revision/ortografia. */}
      <ResultadoCard resultado={resultados.ortografia ? { ...resultados.ortografia, numero: '11' } : null} delay={800}>
        <ItemsList onIr={onIr} html={html} label="Posibles errores de ortografía y redacción" items={resultados.ortografia?.hallazgos} color="var(--yellow-text)" />
        <ItemsList onIr={onIr} html={html} label="Términos desactualizados" items={resultados.ortografia?.obsoletos} color="var(--yellow-text)" />
        <ItemsList onIr={onIr} html={html} label="Aviso" items={resultados.ortografia?.avisos} color="var(--yellow-text)" />
      </ResultadoCard>

    </div>
  )
}
