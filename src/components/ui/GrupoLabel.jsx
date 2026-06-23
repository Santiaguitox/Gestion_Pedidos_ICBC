// Label de sub-sección con línea decorativa a los costados — usado para
// distinguir "Pedidos Activos" de "Pedidos Finalizados" dentro de un
// grupo más grande (un día, una vista, etc). La palabra principal
// ("Activos"/"Finalizados") siempre va en rojo de marca, "Pedidos" en
// gris secundario — mismo criterio en todos los lugares donde se usa,
// para que la jerarquía visual sea reconocible de un vistazo en
// cualquier pantalla de la app.
export function GrupoLabel({ texto }) {
  return (
    <div className="dia-group-header">
      <div className="dia-group-line" />
      <span className="dia-group-label dia-group-label-hoy">
        <span style={{ color: 'var(--text-secondary)' }}>Pedidos</span> {texto}
      </span>
      <div className="dia-group-line-flex" />
    </div>
  )
}
