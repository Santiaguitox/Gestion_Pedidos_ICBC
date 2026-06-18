import bandaHeaderRojaCG from './ICBC/CG_Banda_Roja_Header.html?raw'
import destacadoGiftCardBigBox from './ICBC/Destacado_GiftCard_BigBox.html?raw'
import bloqueTextoBase from './ICBC/Bloque_Texto_Base.html?raw'
import bulletTitularNegro from './ICBC/Bullet_Titular_Negro.html?raw'
import bulletTitularRojo from './ICBC/Bullet_Titular_Rojo.html?raw'
import btn from './ICBC/Btn.html?raw'
import iconoSeparadorRojoTexto from './ICBC/Icono_Separador_Rojo_Texto.html?raw'
import moduloDobleClasico from './ICBC/Modulo_Doble_Clasico.html?raw'
import moduloDobleConImagenPunteada from './ICBC/Modulo_Doble_Con_Imagen_Punteada.html?raw'
import destacadoTopesPromo from './ICBC/Destacado_Topes_Promo.html?raw'
import modulosObsoletos from './ICBC/Modulos_Obsoletos.html?raw'

export const templates = [
  { id: 'CG_Banda_Roja_Header',             nombre: 'CG Banda Header Roja',               segmento: 'CG',  categoria: 'header',    html: bandaHeaderRojaCG },
  { id: 'Destacado_GiftCard_BigBox',         nombre: 'Destacado Gift Card BigBox',          segmento: 'CG',  categoria: 'destacado', html: destacadoGiftCardBigBox },
  { id: 'Bloque_Texto_Base',                 nombre: 'Bloque Texto Base',                   segmento: 'all', categoria: 'texto',     html: bloqueTextoBase },
  { id: 'Bullet_Titular_Negro',              nombre: 'Bullet Titular Negro',                segmento: 'all', categoria: 'texto',     html: bulletTitularNegro },
  { id: 'Bullet_Titular_Rojo',               nombre: 'Bullet Titular Rojo',                 segmento: 'all', categoria: 'texto',     html: bulletTitularRojo },
  { id: 'Btn',                               nombre: 'Botón',                               segmento: 'all', categoria: 'boton',     html: btn },
  { id: 'Icono_Separador_Rojo_Texto',        nombre: 'Icono Separador Rojo con Texto',      segmento: 'all', categoria: 'modulo',    html: iconoSeparadorRojoTexto },
  { id: 'Modulo_Doble_Clasico',              nombre: 'Módulo Doble Clásico',                segmento: 'all', categoria: 'modulo',    html: moduloDobleClasico },
  { id: 'Modulo_Doble_Con_Imagen_Punteada',  nombre: 'Módulo Doble con Imagen Punteada',    segmento: 'all', categoria: 'modulo',    html: moduloDobleConImagenPunteada },
  { id: 'Destacado_Topes_Promo',             nombre: 'Destacado Topes Promo',               segmento: 'all', categoria: 'destacado', html: destacadoTopesPromo },
  { id: 'Modulos_Obsoletos',                 nombre: 'Módulos con estructura obsoleta (DIV)', segmento: 'all', categoria: 'deprecado', deprecado: true, html: modulosObsoletos },
]
