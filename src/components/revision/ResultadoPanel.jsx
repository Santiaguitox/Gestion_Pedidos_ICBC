function ResultadoBloque({ resultado, delay, children }) {
  if (!resultado) return null
  const esAdvertencia = resultado.advertencia && !resultado.ok
  return (
    <div className={`revision-bloque ${resultado.ok ? 'revision-bloque-ok' : esAdvertencia ? 'revision-bloque-warn' : 'revision-bloque-error'}`}
      style={{ animationDelay: `${delay}ms` }}>
      <div className={`revision-bloque-titulo ${resultado.ok ? 'revision-titulo-ok' : esAdvertencia ? 'revision-titulo-warn' : 'revision-titulo-error'}`}>
        <span className="revision-bloque-icon">{resultado.ok ? '✓' : esAdvertencia ? '⚠' : '✗'}</span>
        {resultado.tipo}
      </div>
      <div className="revision-bloque-detalle">{resultado.detalle}</div>
      {children}
    </div>
  )
}

function CheckList({ checks }) {
  if (!checks?.length) return null
  return (
    <div className="revision-checks">
      {checks.map((c, i) => (
        <div key={i} className={`revision-check ${c.ok ? 'revision-check-ok' : 'revision-check-error'}`}>
          {c.ok ? '✓' : '✗'} {c.detalle}
        </div>
      ))}
    </div>
  )
}

function AdvertenciaList({ advertencias }) {
  if (!advertencias?.length) return null
  return (
    <div className="revision-checks">
      <div className="revision-check-group-label">Detalle menor</div>
      {advertencias.map((a, i) => (
        <div key={i} className="revision-check revision-check-warn">⚠ {a.detalle}</div>
      ))}
    </div>
  )
}

export default function ResultadoPanel({ resultados }) {
  return (
    <div className="flex flex-col gap-0">
      <p className="revision-section-label">Análisis general</p>

      <ResultadoBloque resultado={resultados.estructuraHTML} delay={0}>
        <CheckList checks={resultados.estructuraHTML.checks} />
      </ResultadoBloque>

      <ResultadoBloque resultado={resultados.clasesCSS} delay={100} />

      <ResultadoBloque resultado={resultados.legal} delay={200}>
        <CheckList checks={resultados.legal.checks} />
      </ResultadoBloque>

      <ResultadoBloque resultado={resultados.links} delay={300}>
        {resultados.links.totalRevisados > 0 && (
          <div className="revision-check revision-check-ok" style={{ marginTop: '0.375rem' }}>
            ✓ {resultados.links.correctos} de {resultados.links.totalRevisados} links correctos
          </div>
        )}
        <CheckList checks={resultados.links.checks} />
        <AdvertenciaList advertencias={resultados.links.advertencias} />
      </ResultadoBloque>

      <ResultadoBloque resultado={resultados.dominioImagenes} delay={400}>
        <CheckList checks={resultados.dominioImagenes.checks} />
      </ResultadoBloque>

      <ResultadoBloque resultado={resultados.altImagenes} delay={500}>
        <CheckList checks={resultados.altImagenes.checks} />
      </ResultadoBloque>

      <ResultadoBloque resultado={resultados.dimensiones} delay={600}>
        <CheckList checks={resultados.dimensiones.checks} />
      </ResultadoBloque>

      <ResultadoBloque resultado={resultados.pesoImagenes} delay={700}>
        {resultados.pesoImagenes?.checks?.length > 0 && (
          <>
            <div className="revision-check-group-label">Imágenes más pesadas</div>
            <CheckList checks={resultados.pesoImagenes.checks} />
          </>
        )}
      </ResultadoBloque>

      <ResultadoBloque resultado={resultados.pesoHTML} delay={800} />

      {resultados.resumenTemplates?.length > 0 && (
        <>
          <p className="revision-section-label" style={{ marginTop: '1.25rem' }}>Estructuras obsoletas detectadas</p>
          {resultados.resumenTemplates.map((t, i) => (
            <div key={i} className="revision-bloque revision-bloque-error" style={{ animationDelay: `${900 + i * 100}ms` }}>
              <div className="revision-bloque-titulo revision-titulo-error"><span className="revision-bloque-icon">✗</span>{t.nombre}</div>
              {t.errores.map((e, j) => (
                <div key={j} className="revision-bloque-detalle"><span className="font-medium">{e.tipo}:</span> {e.detalle}</div>
              ))}
            </div>
          ))}
        </>
      )}
    </div>
  )
}
