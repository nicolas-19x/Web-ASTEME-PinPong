# Sistema de diseño

Producto: herramienta privada de un entrenador para una academia de menos de 30
jugadores (recreativo, formativo y competitivo), con portales de solo lectura
para jugadores y familias. Su trabajo principal es **registrar rápido**
(marcadores, asistencia) desde el celular, a pie de mesa, y **mostrar progreso**
a niños y padres.

## Color (tokens predeterminados, todos personalizables en Configuración)

| Token | Hex | Rol |
|---|---|---|
| `--brand-ink` | `#0C1B33` | Azul tinta: barra lateral, títulos, texto sobre naranja |
| `--brand-table` | `#1B4F8C` | Azul mesa: bandas de torneo, marcador |
| `--brand-ball` | `#FF6B1A` | Naranja pelota: acción principal, estado "en juego" |
| `--brand-lime` | `#B4E33D` | Lima: ganador / positivo, solo sobre superficies oscuras |
| `--paper` | `#F4F6FA` | Fondo claro, frío (no crema) |
| `--loss` | `#D7263D` | Rojo deportivo: derrota, acciones destructivas |

El naranja nunca lleva texto blanco (contraste 2,9:1); siempre texto tinta
(≈7:1). Si el entrenador elige otro acento, el color del texto se calcula por
luminancia.

## Tipografía

Una sola familia, **Archivo** (variable, eje de ancho 62–125 %):

- Texto: Archivo 100 % de ancho, 16 px, interlineado 1,5.
- Títulos y cifras: Archivo condensado (68 %), peso 750–850, cifras tabulares.
- Escala 1,25: 13 · 16 · 20 · 25 · 31 · 39 px; marcador 96–160 px.

Sin mayúsculas sostenidas en etiquetas, sin "eyebrows", sin flechas en botones.

## Disposición

- Escritorio: barra lateral azul tinta fija (248 px) + contenido alineado a la
  izquierda, ancho máximo 1200 px.
- Móvil: barra superior con buscador + navegación inferior de 5 destinos
  (Panel, Jugadores, Torneos, Asistencia, Más).

```
┌────────┬──────────────────────────────────────┐
│ Logo   │ Título de página           [acción]  │
│        ├──────────────────────────┬───────────┤
│ Panel  │ contenido principal      │ lateral   │
│ Jug.   │ (listas, tablas)         │ (alertas, │
│ Torneos│                          │ actividad)│
│ …      │                          │           │
└────────┴──────────────────────────┴───────────┘
```

## Principios

1. **La línea central de la mesa** es el único motivo gráfico: una línea blanca
   de 2 px sobre azul mesa, usada en las bandas de torneo y en el marcador.
2. **El marcador es el momento audaz**: dos mitades azul mesa separadas por la
   línea central, cifras condensadas enormes, botones de +1 de 64 px. Todo lo
   demás es sobrio: superficies planas, bordes de 1 px, sin sombras de tarjeta.
3. Jerarquía por radio: paneles 12 px, controles 8 px, chips de estado en
   píldora. No todo es una tarjeta.
4. Movimiento solo como respuesta (sumar punto, guardar, abrir); se respeta
   `prefers-reduced-motion`.
5. Objetivos táctiles ≥ 44 px; foco visible; contraste ≥ 4,5:1 en ambos temas.

## Revisión frente al brief

- Paleta: el brief fija azul marino + acento vibrante, así que se mantiene; se
  evitó el "negro con un acento ácido" usando azul tinta y azul mesa reales.
- Tipografía: se descartó Inter/Geist (predeterminadas) por Archivo, cuyo eje
  de ancho da el aire de marcador sin añadir una segunda familia.
- Panel: se descartó la cuadrícula de tarjetas iguales con cifra grande; se usa
  una banda con el próximo evento y listas de lectura rápida.
