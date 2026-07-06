// Fondo decorativo compartido por Login y SetPassword: el isotipo de
// TeamWorkHub, bien clarito, asomando en dos esquinas — mismo recurso
// que ya usamos en la imagen para redes (TeamWorkHubApp.jpg). Reusa
// directamente /icon-512.png (servido desde public/, sin pasar por el
// bundler) para no duplicar el asset ni depender de un SVG aparte.
export function AuthBrandBackdrop() {
  return (
    <>
      <img src="/icon-512.png" alt="" aria-hidden="true" className="auth-bg-iso auth-bg-iso-tr" />
      <img src="/icon-512.png" alt="" aria-hidden="true" className="auth-bg-iso auth-bg-iso-bl" />
    </>
  )
}
