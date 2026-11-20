import { Check, AlertTriangle, X } from 'lucide-react'

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
function ItemsList({ label, items, color = 'var(--yellow-text)', onIr }) {
  if (!items?.length) return null
  return (
    <div className="re-items-block">
      <div className="re-items-label" style={{ color }}>{label}</div>
      <div className="re-items-list">
        {items.map((it, i) => {
          const ref = typeof it === 'string' ? null : it.ref
          const clickeable = Boolean(ref && onIr)
          return (
            <div
              key={i}
              className={`re-item-row${clickeable ? ' re-item-clickeable' : ''}`}
              {...(clickeable && {
                role: 'button',
                tabIndex: 0,
                title: 'Ver en la pieza',
                onClick: () => onIr(ref),
                onKeyDown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onIr(ref) } },
              })}
            >
              <span className="re-item-dot" style={{ background: color }} />
              {typeof it === 'string' ? it : it.detalle}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// onIr(ref): opcional. Si viene, los ítems con `ref` se pueden clickear para
// ubicarlos en la pieza renderizada (ver lib/revision/localizarEnPreview).
export default function ResultadoPanel({ resultados, onIr }) {
  return (
    <div className="re-cards">

      <ResultadoCard resultado={{ ...resultados.estructuraHTML, numero: '01' }} delay={0}>
        <SubcheckList checks={resultados.estructuraHTML?.checks?.filter(c => c.ok)} />
        <ItemsList onIr={onIr} label="Requiere atención" items={resultados.estructuraHTML?.checks?.filter(c => !c.ok)} color="var(--accent-primary)" />
      </ResultadoCard>

      <ResultadoCard resultado={{ ...resultados.clasesCSS, numero: '02' }} delay={80} />

      <ResultadoCard resultado={{ ...resultados.legal, numero: '03' }} delay={160}>
        <SubcheckList checks={resultados.legal?.checks?.filter(c => c.ok)} />
        <ItemsList onIr={onIr} label="Requiere atención" items={resultados.legal?.checks?.filter(c => !c.ok)} color="var(--accent-primary)" />
      </ResultadoCard>

      <ResultadoCard resultado={{ ...resultados.links, numero: '04' }} delay={240}>
        <ItemsList onIr={onIr} label="Requiere atención" items={resultados.links?.checks?.filter(c => !c.ok)} color="var(--accent-primary)" />
        <ItemsList onIr={onIr} label="Detalle menor" items={resultados.links?.advertencias} color="var(--yellow-text)" />
      </ResultadoCard>

      <ResultadoCard resultado={{ ...resultados.dominioImagenes, numero: '05' }} delay={320}>
        <ItemsList onIr={onIr} label="Requiere atención" items={resultados.dominioImagenes?.checks?.filter(c => !c.ok)} color="var(--accent-primary)" />
      </ResultadoCard>

      <ResultadoCard resultado={{ ...resultados.altImagenes, numero: '06' }} delay={400}>
        <ItemsList onIr={onIr} label="Requiere atención" items={resultados.altImagenes?.checks?.filter(c => !c.ok)} color="var(--accent-primary)" />
        {/* Verificación con IA (el alt corresponde a lo que muestra la
            imagen): vive DENTRO de esta tarjeta, no es una prueba aparte.
            Ver combinarAltConIA en lib/revision/altIA. */}
        <ItemsList onIr={onIr} label="El alt no coincide con la imagen" items={resultados.altImagenes?.ia?.checks?.filter(c => !c.ok)} color="var(--accent-primary)" />
        <ItemsList onIr={onIr} label="Detalle menor" items={resultados.altImagenes?.ia && !resultados.altImagenes.ia.omitido ? resultados.altImagenes.ia.advertencias : []} color="var(--yellow-text)" />
        <ItemsList onIr={onIr} label="Verificación con IA" items={resultados.altImagenes?.ia?.omitido ? [resultados.altImagenes.ia.detalle] : []} color="var(--yellow-text)" />
      </ResultadoCard>

      <ResultadoCard resultado={{ ...resultados.dimensiones, numero: '07' }} delay={480}>
        <ItemsList onIr={onIr} label="Requiere atención" items={resultados.dimensiones?.checks?.filter(c => !c.ok)} color="var(--accent-primary)" />
        {/* Separadores estructurales estirados: mismo patrón que Links —
            no fallan la prueba, se listan en amarillo por si vale la
            pena mirarlos. Ver lib/imagenesEstructurales. */}
        <ItemsList onIr={onIr} label="Detalle menor" items={resultados.dimensiones?.advertencias} color="var(--yellow-text)" />
      </ResultadoCard>

      <ResultadoCard resultado={{ ...resultados.pesoImagenes, numero: '08' }} delay={560}>
        <ItemsList onIr={onIr} label="Ordenadas por peso" items={resultados.pesoImagenes?.checks} color="var(--accent-primary)" />
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
                          <div
                            key={j}
                            className={`re-obsoleta-tpl-detail${clickeable ? ' re-item-clickeable' : ''}`}
                            {...(clickeable && {
                              role: 'button',
                              tabIndex: 0,
                              title: 'Ver en la pieza',
                              onClick: () => onIr(e.ref),
                              onKeyDown: ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onIr(e.ref) } },
                            })}
                          ><strong>{e.tipo}:</strong> {e.detalle}</div>
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
        <ItemsList onIr={onIr} label="Posibles errores de ortografía y redacción" items={resultados.ortografia?.hallazgos} color="var(--yellow-text)" />
        <ItemsList onIr={onIr} label="Términos desactualizados" items={resultados.ortografia?.obsoletos} color="var(--yellow-text)" />
        <ItemsList onIr={onIr} label="Aviso" items={resultados.ortografia?.avisos} color="var(--yellow-text)" />
      </ResultadoCard>

    </div>
  )
}
