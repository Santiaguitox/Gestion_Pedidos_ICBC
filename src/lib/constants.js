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

// ESTADOS y TIPOS se gestionan desde Supabase — usar useEstados() y useTipos()