export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  COLABORADOR: 'colaborador',
  VIEWER: 'viewer',
}

export const PRIORIDADES = [
  { value: 'baja',    label: 'Baja',    color: '#6B7280' },
  { value: 'media',   label: 'Media',   color: '#F59E0B' },
  { value: 'alta',    label: 'Alta',    color: '#F97316' },
  { value: 'urgente', label: 'Urgente', color: '#EF4444' },
]

export const TIPOS = [
  { value: 'creacion_email',     label: 'Creación de email' },
  { value: 'programacion_envio', label: 'Programación de envío' },
  { value: 'correccion',         label: 'Corrección / Ajuste' },
  { value: 'consulta',           label: 'Consulta' },
  { value: 'otro',               label: 'Otro' },
]

export const ESTADOS = [
  { value: 'en_diseno',           label: 'En diseño',           color: '#8B5CF6' },
  { value: 'en_desarrollo',       label: 'En desarrollo',       color: '#3B82F6' },
  { value: 'en_revision',         label: 'En revisión',         color: '#F59E0B' },
  { value: 'esperando_respuesta', label: 'Esperando respuesta', color: '#6B7280' },
  { value: 'programado',          label: 'Programado',          color: '#10B981' },
  { value: 'finalizado',          label: 'Finalizado',          color: '#059669' },
]

export const ROLE_COLORS = {
  super_admin: '#D0111B',
  admin:       '#F97316',
  colaborador: '#5B4EE8',
  viewer:      '#6B7280',
}

export const TIPO_ACTIVIDAD = {
  CREACION:         'creacion',
  CAMBIO_ESTADO:    'cambio_estado',
  CAMBIO_PRIORIDAD: 'cambio_prioridad',
  ASIGNACION:       'asignacion',
  ELIMINACION:      'eliminacion',
  RESTAURACION:     'restauracion',
  EDICION:          'edicion',
}