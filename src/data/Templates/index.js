// Solo se importa Modulos_Obsoletos porque CompararConTemplates (ver
// src/lib/revision/templates.js) filtra explícitamente por
// `deprecado: true` antes de comparar nada — los demás templates que
// vivían acá (Bullet, Btn, Módulo Doble, etc.) eran DUPLICADOS de los
// archivos reales que usa el editor de piezas en
// src/data/Templates/ICBC/{Header,Contenido,Botones}/, pero
// CompararConTemplates nunca llegaba a usarlos (el .filter los
// descartaba antes de cualquier comparación real) — se importaban al
// bundle sin que ningún resultado de la app dependiera de su
// contenido. Se eliminaron para no mantener dos copias del mismo
// archivo sincronizadas a mano.
import modulosObsoletos from './ICBC/Modulos_Obsoletos.html?raw'

export const templates = [
  { id: 'Modulos_Obsoletos', nombre: 'Módulos con estructura obsoleta (DIV)', segmento: 'all', categoria: 'deprecado', deprecado: true, html: modulosObsoletos },
]
