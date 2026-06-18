export function extraerBgColors(doc) {
  const elementos = doc.querySelectorAll('[bgcolor]')
  return [...elementos].map(el => el.getAttribute('bgcolor').toLowerCase())
}

export function extraerImagenes(doc) {
  const imgs = doc.querySelectorAll('img')
  return [...imgs].map(img => img.getAttribute('src')).filter(Boolean)
}

export function nombreImagen(src) {
  return src.split('/').pop()
}