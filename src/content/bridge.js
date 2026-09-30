(function () {
    "use strict";

    if (window.__roll20BridgeInstalado) {
        return;
    }
    window.__roll20BridgeInstalado = true;

    var ESPERA_MAXIMA = 180000;

    var pendientes = {};

    function registrarLog(texto) {
        try {
            chrome.runtime
                .sendMessage({ type: "ROLL20_LOG", texto: texto })
                .catch(function () {
                    /* sin popup abierto */
                });
        } catch (e) {
            /* sin popup abierto */
        }
    }

    window.addEventListener("message", function (evento) {
        if (evento.source !== window) {
            return;
        }

        var datos = evento.data;
        if (!datos || datos.__roll20Ex === "page-extract") {
            return;
        }

        if (datos.__roll20Ex === "page-log") {
            registrarLog(datos.texto);
            return;
        }

        if (datos.__roll20Ex !== "page-result") {
            return;
        }

        var pendiente = pendientes[datos.requestId];
        if (!pendiente) {
            return;
        }

        delete pendientes[datos.requestId];
        window.clearTimeout(pendiente.guardia);
        pendiente.resolver(datos);
    });

    chrome.runtime.onMessage.addListener(function (mensaje, emisor, responder) {
        if (!mensaje || mensaje.type !== "ROLL20_PEDIR_EXTRACCION") {
            return undefined;
        }

        var requestId = "req-" + Date.now() + "-" + Math.random().toString(36).slice(2, 9);

        new Promise(function (resolver, rechazar) {
            pendientes[requestId] = {
                resolver: resolver,
                guardia: window.setTimeout(function () {
                    delete pendientes[requestId];
                    rechazar(
                        new Error(
                            "La extracción tardó demasiado. Recarga la partida de Roll20 y vuelve a intentarlo."
                        )
                    );
                }, ESPERA_MAXIMA)
            };

            window.postMessage({ __roll20Ex: "page-extract", requestId: requestId }, "*");
        })
            .then(function (resultado) {
                responder({ ok: true, payload: resultado.payload });
            })
            .catch(function (error) {
                responder({ ok: false, error: error && error.message ? error.message : String(error) });
            });

        return true;
    });
})();