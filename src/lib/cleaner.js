(function (raiz, fabrica) {
    "use strict";

    var api = fabrica();

    if (typeof module === "object" && module.exports) {
        module.exports = api;
    }
    if (raiz) {
        raiz.Roll20Cleaner = api;
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    "use strict";

    var MAPAS_LETRAS = {
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

    var MAPAS_NOMBRES = {
        agrave: "à",
        aacute: "á",
        acirc: "â",
        atilde: "ã",
        auml: "ä",
        aring: "å",
        egrave: "è",
        eacute: "é",
        ecirc: "ê",
        euml: "ë",
        igrave: "ì",
        iacute: "í",
        icirc: "î",
        iuml: "ï",
        ograve: "ò",
        oacute: "ó",
        ocirc: "ô",
        otilde: "õ",
        ouml: "ö",
        oslash: "ø",
        ugrave: "ù",
        uacute: "ú",
        ucirc: "û",
        uuml: "ü",
        yacute: "ý",
        yuml: "ÿ",
        ccedil: "ç",
        ntilde: "ñ",
        szlig: "ß",
        shy: "",
        ensp: " ",
        emsp: " ",
        thinsp: " ",
        prime: "´",
        Prime: "″"
    };

    var MAPAS_NOMBRES_MIN = {};

    Object.keys(MAPAS_NOMBRES).forEach(function (nombre) {
        MAPAS_NOMBRES_MIN[nombre.toLowerCase()] = MAPAS_NOMBRES[nombre];
    });

    var REGLAS_NOMBRES = new RegExp(
        "&(?:" + Object.keys(MAPAS_NOMBRES_MIN).join("|") + ");",
        "gi"
    );

    var ENTIDADES = [
        [/&nbsp;/gi, " "],
        [/&quot;/gi, '"'],
        [/&apos;/gi, "'"],
        [/&#0*39;/g, "'"],
        [/&lt;/gi, "<"],
        [/&gt;/gi, ">"],
        [/&hellip;/gi, "…"],
        [/&mdash;/gi, "—"],
        [/&ndash;/gi, "–"],
        [/&laquo;/gi, "«"],
        [/&raquo;/gi, "»"],
        [/&ldquo;/gi, "“"],
        [/&rdquo;/gi, "”"],
        [/&lsquo;/gi, "‘"],
        [/&rsquo;/gi, "’"],
        [/&middot;/gi, "·"],
        [/&bull;/gi, "•"],
        [/&copy;/gi, "©"],
        [/&reg;/gi, "®"],
        [/&trade;/gi, "™"],
        [/&deg;/gi, "°"],
        [/&euro;/gi, "€"],
        [/&pound;/gi, "£"],
        [/&amp;/gi, "&"]
    ];

    function desdePunto(codigo) {
        var numero = parseInt(codigo, 10);
        if (!isFinite(numero) || numero < 0 || numero > 0x10ffff) {
            return "";
        }
        try {
            return String.fromCodePoint(numero);
        } catch (e) {
            return "";
        }
    }

    function desdeCodigoHex(codigo) {
        var numero = parseInt(codigo, 16);
        if (!isFinite(numero) || numero < 0 || numero > 0x10ffff) {
            return "";
        }
        try {
            return String.fromCodePoint(numero);
        } catch (e) {
            return "";
        }
    }

    function decodificarPorcentajesManuales(texto) {
        return texto.replace(/%([0-9A-Fa-f]{2})/g, function (match, hex) {
            var numero = parseInt(hex, 16);
            if (numero >= 128) {
                return MAPAS_LETRAS[hex.toUpperCase()] || String.fromCharCode(numero);
            }
            return String.fromCharCode(numero);
        });
    }

    function decodificarPercentU(texto) {
        return texto.replace(/%u([0-9a-fA-F]{4})/g, function (match, grupo) {
            return desdeCodigoHex(grupo);
        });
    }

    function decodificarEntidades(texto) {
        var salida = texto
            .replace(/&#(\d+);/g, function (match, numero) {
                return desdePunto(numero);
            })
            .replace(/&#x([0-9a-fA-F]+);/g, function (match, numero) {
                return desdeCodigoHex(numero);
            });

        ENTIDADES.forEach(function (par) {
            salida = salida.replace(par[0], par[1]);
        });

        salida = salida.replace(REGLAS_NOMBRES, function (match) {
            var nombre = match.slice(1, -1).toLowerCase();
            return MAPAS_NOMBRES_MIN[nombre] !== undefined ? MAPAS_NOMBRES_MIN[nombre] : match;
        });

        return salida;
    }

    function normalizarEspaciado(texto) {
        return texto
            .replace(/\u00A0/g, " ")
            .replace(/\r/g, "")
            .replace(/[ \t]+\n/g, "\n")
            .replace(/\n[ \t]+/g, "\n")
            .replace(/\n{3,}/g, "\n\n")
            .replace(/[ \t]{2,}/g, " ")
            .trim();
    }

    function desinfectarTexto(textoSucio) {
        if (!textoSucio) {
            return "";
        }

        try {
            var texto = String(textoSucio);

            try {
                texto = decodeURIComponent(texto);
            } catch (e) {
                texto = decodificarPorcentajesManuales(texto);
            }

            texto = decodificarPercentU(texto);

            texto = texto
                .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
                .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
                .replace(/<!--[\s\S]*?-->/g, "");

            texto = texto
                .replace(/<br\s*\/?>/gi, "\n")
                .replace(/<\/p>/gi, "\n\n")
                .replace(/<\/div>/gi, "\n")
                .replace(/<\/li>/gi, "\n")
                .replace(/<\/h[1-6]>/gi, "\n\n")
                .replace(/<li\b[^>]*>/gi, "• ")
                .replace(/<h1\b[^>]*>/gi, "## ")
                .replace(/<h2\b[^>]*>/gi, "## ")
                .replace(/<h3\b[^>]*>/gi, "### ")
                .replace(/<h4\b[^>]*>/gi, "### ")
                .replace(/<h5\b[^>]*>/gi, "#### ")
                .replace(/<h6\b[^>]*>/gi, "#### ")
                .replace(/<[^>]*>/g, "");

            texto = decodificarEntidades(texto);

            return normalizarEspaciado(texto);
        } catch (err) {
            return String(textoSucio)
                .replace(/<[^>]*>/g, "")
                .trim();
        }
    }

    function construirTarjetas(items) {
        var lista = Array.isArray(items) ? items : [];

        return lista.map(function (item) {
            var cuerpo = desinfectarTexto(item && item.raw_text);
            var bloques = [];

            if (cuerpo) {
                bloques.push({
                    block_type: "text",
                    title: "Datos básicos",
                    body: cuerpo,
                    sort_order: 0
                });
            }

            return {
                title: (item && item.title) || "",
                type: (item && item.type) || "character",
                cover: (item && item.cover) || "",
                players_info: null,
                tags: [],
                blocks: bloques
            };
        });
    }

    function serializar(items, formato) {
        if (formato === "array") {
            return JSON.stringify(items, null, 2);
        }
        return JSON.stringify({ cards: construirTarjetas(items) }, null, 2);
    }

    function marcaDeTiempo(fecha) {
        var d = fecha instanceof Date ? fecha : new Date();
        var dos = function (n) {
            return String(n).padStart(2, "0");
        };

        return (
            d.getFullYear() +
            dos(d.getMonth() + 1) +
            dos(d.getDate()) +
            "-" +
            dos(d.getHours()) +
            dos(d.getMinutes())
        );
    }

    function normalizarNombre(nombre) {
        return String(nombre || "roll20")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-zA-Z0-9]+/g, "_")
            .replace(/^_+|_+$/g, "")
            .toLowerCase()
            .slice(0, 48) || "roll20";
    }

    function nombreArchivo(items, formato, campana) {
        return "roll20_" + normalizarNombre(campana) + "_" + marcaDeTiempo() + ".json";
    }

    return {
        desinfectarTexto: desinfectarTexto,
        construirTarjetas: construirTarjetas,
        serializar: serializar,
        nombreArchivo: nombreArchivo
    };
});
