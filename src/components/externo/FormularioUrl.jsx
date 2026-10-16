import { CircleAlert, Info, Link2, LoaderCircle, RotateCcw, ScanSearch } from 'lucide-react'

export default function FormularioUrl({ url, onCambiar, onAnalizar, onReiniciar, analizando, error, puedeReiniciar }) {
  function enviar(e) {
    e.preventDefault()
    onAnalizar()
  }

  return (
    <form className="ex-consulta" onSubmit={enviar} noValidate>
      <div className="ex-consulta__fila">
        <div className={`ex-campo-url${error ? ' ex-campo-url--error' : ''}`}>
          <Link2 className="ex-icono ex-campo-url__icono" aria-hidden="true" />
          <label className="ex-solo-lector" htmlFor="ex-url">URL de la pieza</label>
          <input
            id="ex-url"
            className="ex-campo-url__entrada"
            type="url"
            inputMode="url"
            placeholder="https://cliente.icommarketing.com/..."
            autoComplete="off"
            spellCheck={false}
            value={url}
            readOnly={analizando}
            onChange={e => onCambiar(e.target.value)}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby="ex-url-ayuda"
          />
        </div>
        <button className="ex-boton ex-boton--primario" type="submit" disabled={analizando}>
          {analizando
            ? <LoaderCircle className="ex-icono ex-icono--giro" aria-hidden="true" />
            : <ScanSearch className="ex-icono" aria-hidden="true" />}
          {analizando ? 'Analizando…' : 'Analizar'}
        </button>
        <button className="ex-boton ex-boton--secundario" type="button" onClick={onReiniciar} disabled={!puedeReiniciar}>
          <RotateCcw className="ex-icono" aria-hidden="true" />
          Reiniciar
        </button>
      </div>
      {error ? (
        <p className="ex-consulta__ayuda ex-consulta__ayuda--error" id="ex-url-ayuda" role="alert">
          <CircleAlert className="ex-icono" aria-hidden="true" />
          {error}
        </p>
      ) : (
        <p className="ex-consulta__ayuda" id="ex-url-ayuda">
          <Info className="ex-icono" aria-hidden="true" />
          Pegá el link completo de la pieza publicada en icomm.
        </p>
      )}
    </form>
  )
}
