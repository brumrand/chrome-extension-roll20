const fs = require('fs').promises;
const path = require('path');

// Limpieza de URLs y etiquetas HTML sin dependencias externas
function desinfectarTexto(textoSucio) {
    if (!textoSucio) return "";

    try {
        let textoLimpio = String(textoSucio);

        // 1. Decodificación tolerante a codificaciones antiguas de Roll20
        try {
            textoLimpio = decodeURIComponent(textoLimpio);
        } catch (e) {
            textoLimpio = textoLimpio.replace(
                /%([0-9A-Fa-f]{2})/g,
                (match, p1) => {
                    const num = parseInt(p1, 16);

                    if (num >= 128) {
                        const mapasLetras = {
                            E1: "á",
                            E9: "é",
                            ED: "í",
                            F3: "ó",
                            FA: "ú",

                            C1: "Á",
                            C9: "É",
                            CD: "Í",
                            D3: "Ó",
                            DA: "Ú",

                            F1: "ñ",
                            D1: "Ñ",

                            DC: "Ü",
                            FC: "ü"
                        };

                        return mapasLetras[p1.toUpperCase()]
                            || String.fromCharCode(num);
                    }

                    return String.fromCharCode(num);
                }
            );
        }

        // Caracteres Unicode específicos de Roll20
        textoLimpio = textoLimpio.replace(
            /%u([0-9a-fA-F]{4})/g,
            (match, grupo) => {
                return String.fromCharCode(parseInt(grupo, 16));
            }
        );

        // 2. Reemplazar bloques estructurales HTML por saltos de línea
        textoLimpio = textoLimpio
            // <br>, <br/>, <br />
            .replace(/<br\s*\/?>/gi, "\n")

            // Párrafos
            .replace(/<\/p>/gi, "\n\n")

            // Divisiones
            .replace(/<\/div>/gi, "\n")

            // Listas
            .replace(/<\/li>/gi, "\n")

            // Encabezados
            .replace(/<\/h[1-6]>/gi, "\n\n");

        // 3. Eliminar etiquetas HTML residuales
        textoLimpio = textoLimpio.replace(/<[^>]*>/g, "");

        // 4. Decodificar entidades HTML comunes
        textoLimpio = textoLimpio
            .replace(/&nbsp;/gi, " ")
            .replace(/&quot;/gi, '"')
            .replace(/&amp;/gi, "&")
            .replace(/&lt;/gi, "<")
            .replace(/&gt;/gi, ">")
            .replace(/&#39;/gi, "'")
            .replace(/&apos;/gi, "'");

        // Entidades numéricas decimales: &#225;
        textoLimpio = textoLimpio.replace(
            /&#(\d+);/g,
            (match, numero) => {
                return String.fromCharCode(parseInt(numero, 10));
            }
        );

        // Entidades numéricas hexadecimales: &#xE1;
        textoLimpio = textoLimpio.replace(
            /&#x([0-9a-f]+);/gi,
            (match, numero) => {
                return String.fromCharCode(parseInt(numero, 16));
            }
        );

        // 5. Normalizar espaciados
        return textoLimpio
            .replace(/\u00A0/g, " ")
            .replace(/\r/g, "")
            .replace(/[ \t]+\n/g, "\n")
            .replace(/\n[ \t]+/g, "\n")
            .replace(/\n{3,}/g, "\n\n")
            .trim();

    } catch (err) {
        // Fallback en caso de error
        return String(textoSucio)
            .replace(/<[^>]*>/g, "")
            .trim();
    }
}


async function procesarArchivo(rutaEnLocal) {
    try {
        await fs.access(rutaEnLocal);
    } catch {
        console.error(`❌ El archivo no existe en: ${rutaEnLocal}`);
        return;
    }

    try {
        const rawContent = await fs.readFile(rutaEnLocal, "utf-8");
        const listaCruda = JSON.parse(rawContent);

        if (!Array.isArray(listaCruda)) {
            throw new Error("El JSON debe contener un array de elementos.");
        }

        console.log(`🧼 Procesando ${listaCruda.length} elementos...`);

        const cards = listaCruda.map(item => {
            const cuerpoLimpio = desinfectarTexto(item.raw_text);
            const blocks = [];

            if (cuerpoLimpio) {
                blocks.push({
                    block_type: "text",
                    title: "Datos básicos",
                    body: cuerpoLimpio,
                    sort_order: 0
                });
            }

            return {
                title: item.title || "",
                type: item.type || "character",
                cover: item.cover || "",
                players_info: null,
                tags: [],
                blocks: blocks
            };
        });

        const resultadoFinal = {
            cards
        };

        // Crear carpeta destino "clean_data" si no existe
        const directorioBase = path.dirname(rutaEnLocal);
        const carpetaDestino = path.join(
            directorioBase,
            "clean_data"
        );

        await fs.mkdir(carpetaDestino, {
            recursive: true
        });

        // Guardar resultado
        const nombreArchivo = path.basename(rutaEnLocal);
        const rutaFinal = path.join(
            carpetaDestino,
            nombreArchivo
        );

        await fs.writeFile(
            rutaFinal,
            JSON.stringify(resultadoFinal, null, 2),
            "utf-8"
        );

        console.log(
            `✅ Archivo limpio generado con éxito en: ${rutaFinal}`
        );

    } catch (err) {
        console.error(
            "❌ Fallo durante el procesamiento:",
            err.message
        );
    }
}


// Ejecutar
procesarArchivo("./roll20_raw_data.json");
