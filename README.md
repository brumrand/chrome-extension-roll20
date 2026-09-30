# Roll20 Exporter

Extensión de Chrome (Manifest V3) que exporta los datos de una partida de Roll20
(fichas de personaje y handouts), limpia el texto y permite **descargar el JSON**
o **copiarlo al portapapeles**.

Es una versión empaquetada de los dos scripts originales:

| Origen | Destino en la extensión |
| --- | --- |
| `data-obtain.js` (se ejecutaba en la consola de Roll20) | `src/page/exporter.page.js` |
| `data-clenaer.js` (se ejecutaba con Node) | `src/lib/cleaner.js` |

## Instalación

1. Abre `chrome://extensions`.
2. Activa **Modo de desarrollador** (arriba a la derecha).
3. Pulsa **Cargar descomprimida** y selecciona esta carpeta.
4. Fija el icono de la extensión en la barra (opcional, para abrirla rápido).

## Uso

1. Abre tu partida en `https://app.roll20.net/campaigns/...`
   (debe ser la pestaña del juego, **no** la vista de jugador).
2. Haz clic en el icono de la extensión → **Exportar partida**.
3. Revisa la lista: busca por título, filtra por tipo y marca qué elementos incluir.
   El resumen muestra cuántos **fichas** y cuántos **handouts** se han leído de Roll20.
   Haz clic en el nombre de un elemento para ver su texto ya limpio.
4. Elige el formato y pulsa **Descargar** o **Copiar**.

También puedes cargar un JSON previamente exportado con **Cargar archivo…**
o **Pegar JSON** (útil si ya tenías `roll20_raw_data.json`).

### Formatos de salida

Siempre se descarga un `.json`. Elige el contenido:

- `JSON { cards: [...] }` — cada elemento con `title`, `type`, `cover`,
  `players_info`, `tags` y `blocks` (un bloque de texto titulado «Datos básicos»).
- `JSON array crudo` — los elementos tal cual los devuelve Roll20.

El nombre del archivo se genera solo: `roll20_<campaña>_<AAAAMMDD-HHMM>.json`.

## Detalles técnicos

- El extractor se registra como *content script* en el mundo `MAIN`, así que
  accede a `window.Campaign` aunque Roll20 tenga una CSP restrictiva.
- El texto real de cada ficha/handout se pide con `_getLatestBlob` (con timeout
  de 5 s y en lotes de 12 en paralelo), no con `get()`, para evitar los
  «blob pending» de Roll20 y no agotar el tiempo de espera.
- Los handouts se leen de `campaign.handouts` **y** de `campaign.journal`,
  deduplicados por `id`; el texto de cada modelo se pide una sola vez.
- El puente entre la página y la extensión usa `window.postMessage` con
  `requestId`; la extracción corre desde el *service worker* para que no se
  cancele si cierras el popup.
- La limpieza decodifica %-escapes y `%uXXXX`, entidades HTML (numéricas,
  hexadecimales y con nombre), quita `<script>`/`<style>`, convierte
  `<br>`, `<p>`, `<li>` y encabezados, y normaliza saltos de línea.

## Archivos

```
manifest.json
src/background.js              service worker: busca la pestaña, guarda el resultado
src/content/bridge.js          puente postMessage (mundo aislado)
src/page/exporter.page.js      extractor de Roll20 (mundo MAIN)
src/lib/cleaner.js             limpieza de texto y armado de la salida
src/popup/popup.html|css|js    interfaz
```

Los scripts originales (`data-obtain.js`, `data-clenaer.js`) se conservan sin
cambios como referencia.