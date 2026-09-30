(function () {
    "use strict";

    if (window.__roll20ExporterInstalado) {
        return;
    }
    window.__roll20ExporterInstalado = true;

    var MARCA = "__roll20Ex";
    var ESPERA_BLOB = 5000;
    var LOTE = 12;

    var peticionActual = null;

    function enviar(tipo, carga) {
        var mensaje = { __roll20Ex: tipo };
        Object.keys(carga || {}).forEach(function (clave) {
            mensaje[clave] = carga[clave];
        });
        window.postMessage(mensaje, "*");
    }

    function registrar(texto) {
        enviar("page-log", { requestId: peticionActual, texto: texto });
    }

    function obtenerCampana() {
        var candidatas = [window.Campaign, window.campaign];

        for (var i = 0; i < candidatas.length; i++) {
            var candidata = candidatas[i];
            try {
                if (candidata && (candidata.characters || candidata.handouts || candidata.journal)) {
                    return candidata;
                }
            } catch (e) {
                /* acceso bloqueado */
            }
        }

        return candidatas[0] || null;
    }

    function modelosDe(campana, clave) {
        var modelos = [];

        try {
            var coleccion = campana ? campana[clave] : null;

            if (typeof coleccion === "function") {
                try {
                    coleccion = coleccion.call(campana);
                } catch (e) {
                    coleccion = null;
                }
            }

            var crudos = coleccion && coleccion.models ? coleccion.models : coleccion;

            if (Array.isArray(crudos)) {
                modelos = crudos.slice();
            } else if (crudos && typeof crudos === "object") {
                modelos = Object.keys(crudos)
                    .map(function (clave) {
                        return crudos[clave];
                    })
                    .filter(function (modelo) {
                        return !!modelo;
                    });
            }
        } catch (e) {
            modelos = [];
        }

        return modelos;
    }

    function sinDuplicarModelos(listas) {
        var vistos = new Set();
        var idsVistos = new Set();
        var salida = [];

        listas.forEach(function (lista) {
            lista.forEach(function (modelo) {
                var id = valor(modelo, "id");

                if (id) {
                    if (idsVistos.has(id)) {
                        return;
                    }
                    idsVistos.add(id);
                } else {
                    if (vistos.has(modelo)) {
                        return;
                    }
                    vistos.add(modelo);
                }

                salida.push(modelo);
            });
        });

        return salida;
    }

    function valor(modelo, campos) {
        var lista = Array.isArray(campos) ? campos : [campos];

        for (var i = 0; i < lista.length; i++) {
            var campo = lista[i];

            try {
                if (modelo && typeof modelo.get === "function") {
                    var desdeGet = modelo.get(campo);
                    if (desdeGet !== undefined && desdeGet !== null && desdeGet !== "") {
                        return desdeGet;
                    }
                }
            } catch (e) {
                /* modelo sin get */
            }

            try {
                var attrs = (modelo && modelo.attributes) || {};
                var desdeAttrs = attrs[campo];
                if (desdeAttrs !== undefined && desdeAttrs !== null && desdeAttrs !== "") {
                    return desdeAttrs;
                }
            } catch (e) {
                /* modelo sin attributes */
            }
        }

        return "";
    }

    function textoReal(modelo, campo) {
        return new Promise(function (resolve) {
            var resuelto = false;

            function finalizar(texto) {
                if (resuelto) {
                    return;
                }
                resuelto = true;
                window.clearTimeout(guardia);
                resolve(texto || "");
            }

            var guardia = window.setTimeout(function () {
                finalizar(valor(modelo, campo));
            }, ESPERA_BLOB);

            try {
                if (modelo && typeof modelo._getLatestBlob === "function") {
                    modelo._getLatestBlob(campo, function (texto) {
                        finalizar(texto);
                    });
                    return;
                }
            } catch (e) {
                finalizar(valor(modelo, campo));
                return;
            }

            finalizar(valor(modelo, campo));
        });
    }

    function portadaDe(modelo) {
        var url = valor(modelo, "avatar");

        if (url && url.indexOf("http") === 0) {
            return url;
        }
        return "";
    }

    function tituloDe(modelo, campos, porDefecto) {
        var titulo = valor(modelo, campos || ["name", "title"]);

        if (!titulo || !String(titulo).trim()) {
            return porDefecto;
        }
        return String(titulo).trim();
    }

    async function recolectar(modelos, tipo, campoTexto, camposTitulo, prefijo, porDefecto) {
        var salida = new Array(modelos.length);
        var cursor = 0;

        async function trabajador() {
            while (cursor < modelos.length) {
                var indice = cursor;
                cursor += 1;

                var modelo = modelos[indice];

                salida[indice] = {
                    id: String(valor(modelo, "id") || prefijo + "-" + indice),
                    title: tituloDe(modelo, camposTitulo, porDefecto),
                    type: tipo,
                    cover: portadaDe(modelo),
                    raw_text: await textoReal(modelo, campoTexto)
                };
            }
        }

        var trabajadores = [];
        for (var i = 0; i < Math.min(LOTE, modelos.length); i++) {
            trabajadores.push(trabajador());
        }
        await Promise.all(trabajadores);

        return salida;
    }

    async function extraer() {
        var campana = obtenerCampana();

        if (!campana) {
            throw new Error(
                "No se encontró la campaña de Roll20. Abre la pestaña del juego (no la vista de jugador) y vuelve a intentarlo."
            );
        }

        var modelosFichas = modelosDe(campana, "characters");
        var modelosHandouts = sinDuplicarModelos([
            modelosDe(campana, "handouts"),
            modelosDe(campana, "journal")
        ]);

        registrar(
            "Extrayendo " + modelosFichas.length + " fichas y " + modelosHandouts.length + " handouts..."
        );

        var resultados = await Promise.all([
            recolectar(modelosFichas, "character", "bio", ["name", "title"], "character", "Sin Nombre"),
            recolectar(modelosHandouts, "handout", "notes", ["title", "name"], "handout", "Sin Título")
        ]);

        var fichas = resultados[0];
        var handouts = resultados[1];
        var items = fichas.concat(handouts);

        items.sort(function (a, b) {
            return a.title.localeCompare(b.title, "es", { sensitivity: "base" });
        });

        registrar("Exportación completada: " + fichas.length + " fichas y " + handouts.length + " handouts.");

        return {
            items: items,
            campana: tituloDe(campana, ["name", "title"], "Partida de Roll20"),
            url: window.location.href,
            capturado: new Date().toISOString(),
            conteo: { characters: fichas.length, handouts: handouts.length }
        };
    }

    window.addEventListener("message", function (evento) {
        if (evento.source !== window) {
            return;
        }

        var datos = evento.data;
        if (!datos || datos.__roll20Ex !== "page-extract") {
            return;
        }

        var requestId = datos.requestId;
        peticionActual = requestId;

        extraer()
            .then(function (carga) {
                enviar("page-result", { requestId: requestId, ok: true, payload: carga });
            })
            .catch(function (error) {
                enviar("page-result", {
                    requestId: requestId,
                    ok: false,
                    error: error && error.message ? error.message : String(error)
                });
            });
    });
})();