# neanbit · Palabras

Juegos de adivinar una palabra por día, en varias versiones bajo un mismo dominio.
HTML, CSS y JavaScript puro (módulos ES). Sin build, sin dependencias y sin backend:
son archivos estáticos.

## Juegos

- **Clásico**: una palabra de 5 letras en 6 intentos.
- **Argentino**: jerga y lunfardo de 5 letras, con pista en cada partida.
- **Fútbol**: apellidos de jugadores y técnicos; el largo cambia en cada partida.
- **Fechas**: el año de un hecho de la historia argentina, con teclado numérico.

## Cómo está armado

Una sola app y varios juegos. Cada juego es un archivo en `js/modes/` que declara
sus datos y reglas; el motor, la interfaz, el teclado, los ajustes, las
estadísticas y las rutas son compartidos.

- Rutas limpias, sin `#`: `/` es el inicio y cada juego vive en `/<id>`
  (`/clasico`, `/argentino`, `/futbol`, `/fechas`). Los enlaces viejos con
  `#/clasico` se redirigen solos.
- El inicio muestra el estado de hoy de cada juego y la constancia: días seguidos
  con al menos un juego del día terminado.
- Cada juego tiene su palabra del día, su partida en curso y sus estadísticas
  (`localStorage`, claves `nbw:v1:*`).
- Los ajustes (tema, alto contraste, modo difícil, palabras que existen, partida
  del día o libre) valen para todos los juegos. El tipo de partida se cambia solo
  ahí: la vista de juego no repite el selector. Al terminar la del día, el cartel
  de fin ofrece continuar en libre sin pasar por ajustes.
- La interfaz se adapta: desde 960 px el inicio usa dos columnas de tarjetas y el
  juego (barra, pista, tablero y teclado) queda en una sola columna centrada. Las
  fichas escalan con el ancho y el alto de la ventana (`clamp()` y `dvh`) para que
  el tablero y el teclado entren sin cortarse.
- Los juegos se eligen desde un menú desplegable: el botón de la izquierda del
  logo abre un panel con Inicio, los cuatro juegos y el estado de hoy de cada uno.
  No ocupa alto en la página, se cierra con Escape, con un clic afuera o al elegir
  un juego, y bloquea el foco en el panel mientras está abierto.
- Instalable como app (`manifest.webmanifest`) y con arranque sin conexión
  (`sw.js`).
- Se actualiza sola: los archivos se piden sin caché (`_headers`) y, si la
  pestaña quedó abierta, `js/actualizador.js` compara el sello publicado
  (`version.json`) y ofrece recargar (o recarga al salir de la pestaña). No hace
  falta pedirle a nadie que borre la caché.

No se cargan recursos de terceros: las tipografías salen del sistema operativo.

## Correr local

```bash
npm start            # node server.mjs, http://localhost:8080
npm run sello        # regenera version.json (obligatorio si cambió algo publicado)
npm test             # sello + motor y datos
```

Hace falta un servidor porque los módulos ES no cargan desde `file://`.
`server.mjs` devuelve `index.html` en las rutas sin extensión, igual que
producción. Con `python3 -m http.server` las rutas como `/clasico` darían 404.

## Estructura

```
index.html              marcado de la app y los modales
version.json            sello de la versión publicada (lo genera npm run sello)
_headers                caché de Cloudflare Pages: todo se revalida
manifest.webmanifest    metadatos de la app instalable
sw.js                   service worker: red primero, caché de respaldo
css/app.css             tokens de diseño, temas, componentes
js/
  app.js                interfaz: rutas, inicio, tablero, teclado, modales
  actualizador.js       service worker y aviso de versión nueva
  engine.js             lógica pura: evaluar, palabra del día, modo difícil, constancia
  store.js              localStorage tolerante a fallos
  config.js             marca, día de lanzamiento, teclados
  modes/                un archivo por juego + registro (index.js) + ideas (proximamente.js)
  diccionario.js        reglas y API del diccionario de 5 letras
  data/diccionario.js   listas generadas: soluciones y formas válidas
assets/                 marca (wordmark y n), favicon e íconos de la app
deploy/                 configuraciones alternativas (nginx, Workers)
tests/                  node:test (motor, datos, marca, menú y juego)
tools/                  sello de versión y generador del diccionario (no se publican)
```

## Agregar un juego

1. Crear `js/modes/mi-juego.js`:

```js
export default {
  id: 'provincias',            // es la ruta: /provincias
  nombre: 'Provincias',
  seccion: 'Geografía',
  descripcion: 'Adiviná la provincia argentina.',
  enunciado: true,             // false oculta la descripción bajo el título en partida
  acento: '#2f7d6d',
  teclado: 'letras',           // 'letras' | 'numeros' (config.js)
  intentos: 7,
  respuestas: [{ palabra: 'Tucumán', pista: 'El Jardín de la República.' }],
  validacion: { tipo: 'ninguna' },   // o 'diccionario' / 'rango'
};
```

2. Importarlo y sumarlo a `DEFINICIONES` en `js/modes/index.js`.
3. Sacarlo de `proximamente.js` si estaba.
4. `npm test` comprueba que cada respuesta use solo caracteres del teclado, sin
   duplicados y sin que la pista la revele.

El motor ya resuelve el largo variable por respuesta, las tildes (se normalizan;
la Ñ se conserva), las letras repetidas, la palabra del día sin repetir hasta
agotar la lista y las estadísticas por juego.

## Modo difícil

Obliga a reutilizar lo descubierto: las letras correctas en su lugar y las
presentes en los intentos siguientes. Solo se puede activar antes de la primera
jugada de una partida. Al compartir, el resultado lleva un asterisco.

## Diccionario

`js/data/diccionario.js` es un archivo generado: no se edita a mano. Tiene dos
listas de pares `[original, normalizada]`:

- `SOLUCIONES`: 2.000 palabras que pueden salir como respuesta del día, las más
  frecuentes que pasaron los filtros.
- `VALIDAS`: 12.649 formas que se aceptan como intento; incluye a las soluciones.

`js/diccionario.js` arma los índices una sola vez y expone las reglas y la API
que usan los modos y las pruebas (`esValida`, `esSolucion`, `validarIntento`,
`formaParaMostrar`). Al jugar no se escriben tildes: se compara la forma
normalizada y se guarda la ortografía original para mostrarla al terminar. La ñ
es letra propia (no se pliega a n), la ü se pliega a u y ch, ll y rr ocupan dos
casillas.

Las formas salen de los diccionarios Hunspell de LibreOffice (es_AR y es_ES,
triple licencia GPLv3+/LGPLv3+/MPL1.1+) expandidos con `unmunch`, más el volcado
del Wiktionary en español de [Kaikki.org](https://kaikki.org/dictionary/Spanish/)
(CC BY-SA 3.0) como complemento neutro. Se filtran a 5 letras y solo letras y ñ,
se descartan siglas, nombres propios y arcaísmos, y las flexiones raras caen por
frecuencia de uso (`wordfreq`, escala ZIPF). El detalle de lo descartado queda en
`tools/diccionario/informe.json`.

Para regenerarlo (las fuentes no se versionan: pesan más de 1 GB):

```bash
tools/diccionario/fuentes.sh /tmp/dict-work    # es_AR, es_ES y el volcado de Wiktionary
python3 -m pip install --user wordfreq         # única dependencia de la herramienta
python3 tools/diccionario/construir.py --fuentes /tmp/dict-work --variante rioplatense
npm run sello                                  # el diccionario se publica: cambia el sello
```

Hace falta `unmunch` (paquete `hunspell-tools`). `--variante` acepta
`rioplatense` (por defecto: es_AR + es_ES), `neutro` (es_ES), `mexicano` o
`todas`; los umbrales de frecuencia y el tope de soluciones están en las opciones
de `construir.py`. No se toca `js/data/diccionario.js` a mano: el próximo
regenerado pisa los cambios.

`npm test` comprueba largo, alfabeto, duplicados, que toda solución esté entre las
válidas, que la ñ no se pliegue y que el diccionario no se haya achicado. También
fija el contrato de la marca del encabezado (`tests/marca.test.mjs`): un solo
wordmark en línea y el mismo dibujo que `assets/marca-ondark.svg`.

## Marca

Los archivos son los oficiales de neanbit (los mismos que usa `type.neanbit.com`):

- `assets/marca-ondark.svg` y `assets/marca-onlight.svg`: el wordmark completo
  (`neanbit`, no solo la n), en tinta clara y oscura. Son los originales
  recortados al dibujo: se les cambió el `viewBox` y se quitaron `width`/`height`
  para que el alto en CSS sea el del texto. El trazo no cambia. Quedan como
  fuente de la marca y como respaldo del dibujo: el encabezado usa una copia en
  línea (ver abajo) y un test compara las dos.
- `assets/neanbit-n.svg`: la n sola, en tinta oscura sobre transparente. Es la
  marca para usos sueltos (embeds, documentación), no va en la interfaz.
- `assets/favicon.svg` y `assets/favicon.ico`: la n en la caja azul redondeada.
- `assets/icono-192.png`, `assets/icono-512.png`: íconos de la app instalable.
- `assets/icono-maskable-512.png`: la n sobre el azul de marca y dentro de la
  zona segura del 80 %, para que ningún recorte de Android la corte.
- `assets/apple-touch-icon.png`: 180 px para iOS.

En el encabezado (`index.html`, `.marca`) va un solo SVG en línea con el dibujo
del wordmark: las letras usan `currentColor` y toman `--tinta-marca` (tinta oscura
en tema claro, clara en oscuro y en `auto` según `prefers-color-scheme`); el
cuadradito conserva el ámbar `#FCA311`. Es una sola pieza a propósito: con dos
`<img>` (uno por tinta) una hoja de estilos vieja dejaba los dos logos visibles a
la vez. `tests/marca.test.mjs` fija ese contrato y que el dibujo coincida con
`assets/marca-ondark.svg`.

Si llegan archivos nuevos de marca, reemplazarlos en `assets/` con estos nombres
y respetar el `viewBox` recortado del wordmark (el original trae mucho aire
alrededor y descuadra el encabezado). Después, copiar el dibujo al SVG en línea
de `index.html` (o correr el test: si no coinciden, falla).

## Verificación

- `npm test` (sello + motor, datos y contrato de los juegos).
- Abrir `/` y cada juego, jugar una partida y comprobar que la consola no muestra
  errores.
- Probar una ruta directa (`/clasico`) y una recarga a mitad de partida.
- Actualizador: con la app abierta, cambiar `version` en `version.json`, salir de
  la pestaña y volver. Tiene que aparecer “Hay una versión nueva”; al tocar
  “Actualizar” (o al volver a salir) se recarga con lo nuevo.

## Despliegue

Automático: cada push a `main` publica el repo en Cloudflare Pages
(https://word.neanbit.com), sin build, con `index.html` en la raíz.

El hosting ya devuelve `index.html` en cualquier ruta sin extensión, así que
`/clasico`, `/fechas` y las que se sumen funcionan directo. No hace falta un
archivo de rewrites: un `_redirects` que apunte a `/index.html` hace que el
hosting cancele con un 308 hacia `/` y rompe los enlaces profundos.

### Caché y versiones

Cloudflare Pages sirve JS y CSS con `max-age=14400`: sin nada más, un cambio
puede tardar 4 horas en llegar aunque el service worker use red primero. Por eso:

- `_headers` obliga a revalidar `/js/*`, `/css/*`, `/assets/*`, `/sw.js`, el
  manifest y `version.json`. Los archivos no llevan hash en el nombre y el ETag
  responde 304, así que revalidar es barato.
- `sw.js` pide con `cache: 'no-cache'` y usa la copia guardada solo sin conexión.
  Su nombre de caché es fijo: no hay que vaciarlo en cada deploy.
- `version.json` es el sello: un hash de los archivos publicados que genera
  `npm run sello`. Se commitea. `npm test` falla si quedó viejo, así que no se
  puede publicar un cambio sin sello.
- `js/actualizador.js` compara ese sello cada tanto, al volver a la pestaña y al
  recuperar la red. Si cambió, muestra el aviso para recargar; si la pestaña pasa
  a segundo plano, recarga solo. La partida vive en `localStorage`, así que no se
  pierde nada.

Un cambio en `index.html`, `css/`, `js/`, `assets/`, `manifest.webmanifest`,
`sw.js` o `_headers` tiene que ir acompañado de `npm run sello` en el mismo
commit. Si se suma una carpeta publicada nueva, agregarla en `tools/sello.mjs`
(`CARPETAS` o `ARCHIVOS`) y en `.assetsignore` si no se publica.

## Notas

- No romper el contrato de los juegos (`js/modes/index.js`). Si hace falta una
  mecánica nueva, extender el motor o la interfaz en vez de agregar excepciones
  por `id` en `app.js`.
- `engine.js` no toca el DOM ni el storage, así se prueba en Node.
- Las claves de `localStorage` llevan versión (`nbw:v1:`). Si cambia el formato
  de una partida o de las estadísticas, subir la versión o migrar.
- La palabra del día se calcula en el cliente con la hora local del jugador. Es
  determinista pero no es secreta: alcanza para un juego casual, no para
  competir. Para rankings o antitrampas habría que elegirla en el servidor.
- Solo la partida del día suma a rachas y constancia; la libre no.
