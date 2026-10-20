// /analisis — herramienta pública (sin login) para revisar una pieza de icomm.
//
// Pegás el link de una pieza, se trae el HTML por el proxy propio
// (api/externo/proxy.js), se renderiza la vista previa y se arma el informe
// de calidad. También permite descargar el HTML de la pieza.
//
// Es INDEPENDIENTE del resto de la app: no usa Supabase, ni la sesión, ni los
// validadores de src/lib/revision (tiene su propia copia en src/lib/externo).
// Está pensada como la primera de varias páginas "externas".

import { useCallback, useEffect, useRef, useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import '../styles/Externo.css'
import AccesoDesdeApp from '../components/externo/AccesoDesdeApp.jsx'
import Encabezado from '../components/externo/Encabezado.jsx'
import FormularioUrl from '../components/externo/FormularioUrl.jsx'
import GuiaPruebas from '../components/externo/GuiaPruebas.jsx'
import InformeCalidad from '../components/externo/InformeCalidad.jsx'
import { MarcaFondo } from '../components/externo/Marca.jsx'
import PiePagina from '../components/externo/PiePagina.jsx'
import ProgresoAnalisis from '../components/externo/ProgresoAnalisis.jsx'
import PuntajeInforme from '../components/externo/PuntajeInforme.jsx'
import ResumenPieza from '../components/externo/ResumenPieza.jsx'
import VistaPrevia from '../components/externo/VistaPrevia.jsx'
import { useTemaExterno } from '../components/externo/useTemaExterno.js'
import { ejecutarAnalisis, esDesarrollo, mensajeDeError } from '../lib/externo/ejecutarAnalisis.js'
import { minificarHtml, ordenarHtml } from '../lib/externo/ordenar.js'
import { validarUrl } from '../lib/externo/url.js'

const TITULO = 'Análisis de piezas · TeamWorkHub'
const FUENTES = 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Inter:wght@400;500;600&family=Poppins:wght@600&display=swap'
const PROGRESO_INICIAL = { texto: '', porcentaje: 0, estados: {} }

export default function Analisis() {
  const { tema, alternar } = useTemaExterno()
  const [url, setUrl] = useState('')
  const [fase, setFase] = useState('vacio') // 'vacio' | 'analizando' | 'resultado'
  const [error, setError] = useState('')
  const [progreso, setProgreso] = useState(PROGRESO_INICIAL)
  const [analisis, setAnalisis] = useState(null)
  // Sin Shift sale minificado; con Shift, indentado (para leerlo en el editor).
  const salida = useCallback((texto, indentado) => (indentado ? ordenarHtml(texto) : minificarHtml(texto)), [])
  const control = useRef(null)

  // Título propio y sin indexar (es una herramienta interna con link público)
  useEffect(() => {
    const tituloAnterior = document.title
    document.title = TITULO
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    // Tipografías del diseño. Si no cargan (red corporativa, bloqueador),
    // la página se ve igual con las del sistema.
    const fuentes = document.createElement('link')
    fuentes.rel = 'stylesheet'
    fuentes.href = FUENTES
    document.head.appendChild(fuentes)
    return () => {
      document.title = tituloAnterior
      meta.remove()
      fuentes.remove()
      control.current?.abort()
    }
  }, [])

  const analizar = useCallback(async () => {
    const validacion = validarUrl(url)
    if (!validacion.ok) {
      setError(validacion.error)
      return
    }
    control.current?.abort()
    const actual = new AbortController()
    control.current = actual

    setError('')
    setAnalisis(null)
    setProgreso(PROGRESO_INICIAL)
    setFase('analizando')
    try {
      const resultado = await ejecutarAnalisis({
        url: validacion.url,
        signal: actual.signal,
        onActualizar: p => { if (control.current === actual) setProgreso(p) },
      })
      if (control.current !== actual) return
      setAnalisis(resultado)
      setFase('resultado')
    } catch (e) {
      if (e?.name === 'AbortError' || control.current !== actual) return
      setError(mensajeDeError(e, esDesarrollo))
      setFase('vacio')
    }
  }, [url])

  const reiniciar = useCallback(() => {
    control.current?.abort()
    control.current = null
    setUrl('')
    setError('')
    setAnalisis(null)
    setProgreso(PROGRESO_INICIAL)
    setFase('vacio')
  }, [])

  const bajar = useCallback(texto => {
    if (!analisis) return
    const blob = new Blob([texto], { type: 'text/html;charset=utf-8' })
    const href = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = href
    a.download = analisis.nombreArchivo
    document.body.appendChild(a)
    a.click()
    a.remove()
    // Revocar enseguida puede cortar la descarga en algunos navegadores
    setTimeout(() => URL.revokeObjectURL(href), 1000)
  }, [analisis])

  const descargar = useCallback(indentado => bajar(salida(analisis.recorte.html, indentado)), [analisis, bajar, salida])
  const descargarOriginal = useCallback(indentado => bajar(salida(analisis.recorte.htmlOriginal ?? analisis.recorte.html, indentado)), [analisis, bajar, salida])

  // Devuelve true si se pudo copiar. Primero la API moderna; si el navegador
  // la bloquea (permisos, contexto no seguro), se prueba con un textarea.
  const copiar = useCallback(async indentado => {
    if (!analisis) return false
    const texto = salida(analisis.recorte.html, indentado)
    try {
      await navigator.clipboard.writeText(texto)
      return true
    } catch {
      try {
        const area = document.createElement('textarea')
        area.value = texto
        area.setAttribute('readonly', '')
        area.className = 'ex-portapapeles-oculto'
        document.body.appendChild(area)
        area.select()
        const ok = document.execCommand('copy')
        area.remove()
        return ok
      } catch {
        return false
      }
    }
  }, [analisis, salida])

  const cambiarUrl = useCallback(valor => {
    setUrl(valor)
    setError('')
  }, [])

  return (
    <div className="ex-pantalla" data-theme={tema}>
      <MarcaFondo />
      <div className="ex-pantalla__interior">
        <AccesoDesdeApp />
        <Encabezado tema={tema} onAlternarTema={alternar} />

        <FormularioUrl
          url={url}
          onCambiar={cambiarUrl}
          onAnalizar={analizar}
          onReiniciar={reiniciar}
          analizando={fase === 'analizando'}
          error={error}
          puedeReiniciar={fase !== 'vacio' || Boolean(url) || Boolean(error)}
        />

        {fase === 'analizando' && <ProgresoAnalisis texto={progreso.texto} porcentaje={progreso.porcentaje} />}

        {fase === 'resultado' && analisis && (
          <>
            <ResumenPieza resumen={analisis.resumen} />
            <PuntajeInforme
              puntaje={analisis.puntaje}
              recorte={analisis.recorte}
              nombreArchivo={analisis.nombreArchivo}
              onDescargar={descargar}
              onDescargarOriginal={descargarOriginal}
              onCopiar={copiar}
            />
            {!analisis.recorte.recortado && (
              <p className="ex-aviso" role="status">
                <TriangleAlert className="ex-icono" aria-hidden="true" />
                No se encontró el contenedor principal de la pieza (Table_01 o backgroundTable). Se muestra y se descarga el HTML completo, tal como llegó.
              </p>
            )}
          </>
        )}

        <div className="ex-cuerpo">
          <VistaPrevia fase={fase} url={analisis?.url || url} recorte={analisis?.recorte} />
          {fase === 'resultado' && analisis ? (
            <InformeCalidad
              resultados={analisis.resultados}
              dominios={analisis.dominios}
              variables={analisis.variables}
              inventario={analisis.inventario}
              baseTest={{ html: analisis.html, nombreArchivo: analisis.nombreArchivo }}
            />
          ) : (
            <GuiaPruebas estados={progreso.estados} analizando={fase === 'analizando'} />
          )}
        </div>

        <PiePagina />
      </div>
    </div>
  )
}
