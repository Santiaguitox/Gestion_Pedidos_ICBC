export function CompararConTemplates(doc, templates) {
  const deprecados = templates.filter(t => t.deprecado)
  const resultados = []

  deprecados.forEach(template => {
    const parser = new DOMParser()
    const templateDoc = parser.parseFromString(template.html, 'text/html')
    const divsEmail = [...doc.querySelectorAll('div[style*="inline-block"]')]
    const divsTemplate = [...templateDoc.querySelectorAll('div[style*="inline-block"]')]
    const encontrado = divsTemplate.length > 0 && divsEmail.length > 0

    if (encontrado) {
      resultados.push({
        nombre: template.nombre,
        deprecado: true,
        ok: false,
        encontrado: true,
        errores: [{
          tipo: 'Estructura obsoleta',
          detalle: `Se encontró lo que parece ser "${template.nombre}" — debe reemplazarse por la versión actual`,
        }],
      })
    }
  })

  return resultados
}