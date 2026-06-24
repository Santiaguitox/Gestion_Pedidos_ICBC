// Simula progreso visual en ~1.5s independientemente de cuánto tarde la
// operación real — garantiza que el usuario vea que se está trabajando,
// en vez de quedarse con un botón en "Analizando…" sin ninguna señal de
// avance. Devuelve una Promise que resuelve cuando termina la animación;
// quien llama corre esto en paralelo (Promise.all) junto con el fetch
// real, así el resultado final espera a lo que tarde más de los dos.
//
// Usado por BaseDatosSection.jsx (verificación de compatibilidad base↔
// pieza desde el detalle de pedido) y RevisionEnvios.jsx (mismo análisis,
// corrido manual o auto-disparado al llegar con datos precargados) —
// mismo timing en los dos lugares para que la experiencia sea consistente
// sin importar desde dónde se dispara.
export function animarProgreso(onProgreso) {
  return new Promise(resolve => {
    const pasos = [
      { pct: 15, ms: 150 },
      { pct: 35, ms: 350 },
      { pct: 60, ms: 650 },
      { pct: 80, ms: 950 },
      { pct: 95, ms: 1200 },
      { pct: 100, ms: 1500 },
    ]
    pasos.forEach(({ pct, ms }) => {
      setTimeout(() => {
        onProgreso(pct)
        if (pct === 100) setTimeout(resolve, 150)
      }, ms)
    })
  })
}
