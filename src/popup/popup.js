"use strict";

const cleaner = window.Roll20Cleaner;

const ui = {
    estado: document.getElementById("estado"),
    resumen: document.getElementById("resumen"),
    exportar: document.getElementById("btn-exportar"),
    archivo: document.getElementById("btn-archivo"),
    inputArchivo: document.getElementById("input-archivo"),
    pegar: document.getElementById("btn-pegar"),
    panelPegar: document.getElementById("panel-pegar"),
    areaPegar: document.getElementById("area-pegar"),
    procesarPegado: document.getElementById("btn-procesar-pegado"),
    limpiar: document.getElementById("btn-limpiar"),
    aviso: document.getElementById("aviso"),
    filtros: document.getElementById("filtros"),
    buscador: document.getElementById("buscador"),
    filtroTipo: document.getElementById("filtro-tipo"),
    marcarTodo: document.getElementById("marcar-todo"),
    textoMarcar: document.getElementById("texto-marcar"),
    lista: document.getElementById("lista"),
    pie: document.getElementById("pie"),
    formato: document.getElementById("formato"),
    descargar: document.getElementById("btn-descargar"),
    copiar: document.getElementById("btn-copiar"),
    pieInfo: document.getElementById("pie-info")
};

let items = [];
let meta = null;
let seleccionados = new Set();
let vistaPrevia = -1;

function mostrarAviso(texto) {
    ui.aviso.textContent = texto || "";
    ui.aviso.hidden = !texto;
}

function chip(texto, clase) {
    ui.estado.textContent = texto;
    ui.estado.className = "chip " + clase;
}

function tituloCampana() {
    return (meta && meta.campana) || "Partida de Roll20";
}

function ordenar(lista) {
    return lista.slice().sort((a, b) => String(a.title).localeCompare(String(b.title), "es", { sensitivity: "base" }));
}

function itemsVisibles() {
    const consulta = ui.buscador.value.trim().toLowerCase();
    const tipo = ui.filtroTipo.value;

    return items
        .map((item, indice) => ({ item, indice }))
        .filter(({ item }) => {
            if (tipo !== "todos" && item.type !== tipo) {
                return false;
            }
            if (!consulta) {
                return true;
            }
            return String(item.title).toLowerCase().includes(consulta);
        });
}

function seleccionadosOrdenados() {
    return items.filter((_, indice) => seleccionados.has(indice));
}

function sincronizarBotonMarcar(visibles) {
    const marcados = visibles.filter(({ indice }) => seleccionados.has(indice)).length;
    const todos = visibles.length > 0 && marcados === visibles.length;

    ui.marcarTodo.checked = todos;
    ui.textoMarcar.textContent = todos ? "Ninguno" : "Todo";
}

function pintarLista() {
    const visibles = itemsVisibles();
    ui.lista.textContent = "";

    if (items.length === 0) {
        const vacio = document.createElement("p");
        vacio.className = "vacio";
        vacio.textContent = "Todavía no hay datos. Exporta la partida o pega un JSON.";
        ui.lista.appendChild(vacio);
        ui.filtros.hidden = true;
        ui.pie.hidden = true;
        chip("Sin datos", "chip--vacio");
        ui.resumen.textContent = "Abre tu partida de Roll20 y pulsa «Exportar partida».";
        return;
    }

    if (visibles.length === 0) {
        const vacio = document.createElement("p");
        vacio.className = "vacio";
        vacio.textContent = "Ningún elemento coincide con el filtro.";
        ui.lista.appendChild(vacio);
        ui.filtros.hidden = false;
        ui.pie.hidden = false;
    } else {
        const fragmento = document.createDocumentFragment();

        visibles.forEach(({ item, indice }) => {
            const fila = document.createElement("div");
            fila.className = "item";

            const caja = document.createElement("input");
            caja.type = "checkbox";
            caja.checked = seleccionados.has(indice);
            caja.addEventListener("click", (evento) => {
                evento.stopPropagation();
                if (caja.checked) {
                    seleccionados.add(indice);
                } else {
                    seleccionados.delete(indice);
                }
                actualizarPie();
                sincronizarBotonMarcar(itemsVisibles());
            });

            const nombre = document.createElement("span");
            nombre.className = "item__titulo";
            nombre.textContent = item.title || "Sin título";
            nombre.title = item.cover ? item.title + "\n" + item.cover : item.title || "";

            const tipo = document.createElement("span");
            tipo.className = "item__meta";
            tipo.textContent = item.type === "handout" ? "handout" : "ficha";

            const cabeza = document.createElement("div");
            cabeza.className = "item__cabeza";
            cabeza.append(caja, nombre, tipo);

            cabeza.addEventListener("click", () => {
                vistaPrevia = vistaPrevia === indice ? -1 : indice;
                pintarLista();
            });

            fila.appendChild(cabeza);

            if (vistaPrevia === indice) {
                const cuerpo = document.createElement("pre");
                cuerpo.className = "item__cuerpo";
                cuerpo.textContent = cleaner.desinfectarTexto(item.raw_text) || "(sin texto)";
                fila.appendChild(cuerpo);
            }

            fragmento.appendChild(fila);
        });

        ui.lista.appendChild(fragmento);
        ui.filtros.hidden = false;
        ui.pie.hidden = false;
    }

    sincronizarBotonMarcar(visibles);
    actualizarPie();
}

function actualizarPie() {
    const total = seleccionados.size;
    const visibles = itemsVisibles();
    const visiblesSel = visibles.filter(({ indice }) => seleccionados.has(indice)).length;

    ui.pie.hidden = items.length === 0;
    ui.descargar.disabled = total === 0;
    ui.copiar.disabled = total === 0;
    ui.pieInfo.textContent =
        total +
        " de " +
        items.length +
        " seleccionados" +
        (visiblesSel !== visibles.length ? " · " + visiblesSel + " de " + visibles.length + " visibles" : "");
}

function aplicarEstado(estado) {
    items = Array.isArray(estado.items) ? estado.items : [];
    meta = estado.meta || null;
    seleccionados = new Set(items.map((_, indice) => indice));
    vistaPrevia = -1;

    if (items.length && meta) {
        const conteo = meta.conteo || {};
        chip(items.length + " elementos", "chip--listo");
        ui.resumen.textContent =
            (meta.campana || "Partida de Roll20") +
            " · " +
            (conteo.characters || 0) +
            " fichas · " +
            (conteo.handouts || 0) +
            " handouts · " +
            new Date(meta.capturado).toLocaleString("es");
    } else if (items.length === 0 && meta && meta.capturado) {
        chip("0 elementos", "chip--error");
        ui.resumen.textContent =
            (meta.campana || "Partida de Roll20") +
            " · Roll20 no devolvió fichas ni handouts: revisa que estés en la pestaña del juego, no en la vista de jugador";
    } else {
        chip("Sin datos", "chip--vacio");
        ui.resumen.textContent = "Abre tu partida de Roll20 y pulsa «Exportar partida».";
    }

    pintarLista();
}

function pedirEstado() {
    return chrome.runtime
        .sendMessage({ type: "ROLL20_GET_STATE" })
        .then((respuesta) => {
            if (respuesta && respuesta.ok) {
                aplicarEstado(respuesta.estado);
            }
        })
        .catch(() => {});
}

function guardarItems(nuevos, campana, url) {
    return new Promise((resolver) => {
        chrome.runtime
            .sendMessage({ type: "ROLL20_SAVE", items: nuevos, campana: campana, url: url || "" })
            .then((respuesta) => {
                if (respuesta && respuesta.ok) {
                    aplicarEstado({ items: nuevos, meta: respuesta.meta });
                }
                mostrarAviso("");
                resolver(respuesta);
            })
            .catch((error) => {
                mostrarAviso("No se pudo guardar: " + error.message);
                resolver(null);
            });
    });
}

function exportar() {
    ui.exportar.disabled = true;
    ui.exportar.textContent = "Extrayendo…";
    chip("Exportando", "chip--vacio");
    ui.resumen.textContent = "Leyendo fichas y handouts de la pestaña de Roll20…";
    mostrarAviso("");

    chrome.runtime
        .sendMessage({ type: "ROLL20_EXTRACT" })
        .then((respuesta) => {
            if (!respuesta || !respuesta.ok) {
                throw new Error((respuesta && respuesta.error) || "Falló la extracción.");
            }

            aplicarEstado({ items: respuesta.items, meta: respuesta.meta });

            const conteo = (respuesta.meta && respuesta.meta.conteo) || {};

            if (!respuesta.items.length) {
                mostrarAviso(
                    "Roll20 devolvió 0 elementos. Comprueba que la pestaña activa sea la partida (app.roll20.net/campaigns/...) y no la vista de jugador, y que la página esté completamente cargada."
                );
                return;
            }

            if (!conteo.handouts) {
                mostrarAviso(
                    "Se exportaron " +
                        (conteo.characters || 0) +
                        " fichas pero ningún handout. En esta partida los handouts cuelgan de otra colección; si los necesitas, usa «Cargar archivo…» con el JSON que genera la consola de Roll20."
                );
            }
        })
        .catch((error) => {
            mostrarAviso(error.message);
            chip("Error", "chip--error");
            ui.resumen.textContent = "La exportación falló.";
        })
        .finally(() => {
            ui.exportar.disabled = false;
            ui.exportar.textContent = "Exportar partida";
        });
}

function leerArchivo(archivo) {
    const lector = new FileReader();

    lector.onload = () => {
        intentarCargar(String(lector.result || ""));
    };
    lector.onerror = () => {
        mostrarAviso("No se pudo leer el archivo.");
    };
    lector.readAsText(archivo, "utf-8");
}

function intentarCargar(texto) {
    let datos;

    try {
        datos = JSON.parse(texto);
    } catch (error) {
        mostrarAviso("El JSON no es válido: " + error.message);
        return;
    }

    if (Array.isArray(datos)) {
        if (datos.some((entrada) => entrada && Array.isArray(entrada.cards))) {
            mostrarAviso("Ese archivo ya está procesado. Usa el exportador para obtener el JSON crudo.");
            return;
        }
        guardarItems(ordenar(datos), "Partida importada", "");
        return;
    }

    if (datos && Array.isArray(datos.cards)) {
        const items = ordenar(
            datos.cards.map((tarjeta) => ({
                id: tarjeta.title,
                title: tarjeta.title || "",
                type: tarjeta.type || "character",
                cover: tarjeta.cover || "",
                raw_text: (tarjeta.blocks || []).map((bloque) => bloque.body || "").join("\n\n")
            }))
        );
        guardarItems(items, "Partida importada", "");
        return;
    }

    mostrarAviso("El archivo no contiene datos de Roll20 reconocibles.");
}

function contenidoActual() {
    return cleaner.serializar(seleccionadosOrdenados(), ui.formato.value);
}

function nombreActual() {
    return cleaner.nombreArchivo(seleccionadosOrdenados(), ui.formato.value, tituloCampana());
}

function aDataUrl(texto) {
    const bytes = new TextEncoder().encode(texto);
    let binario = "";

    for (let i = 0; i < bytes.length; i += 1) {
        binario += String.fromCharCode(bytes[i]);
    }
    return "data:application/json;charset=utf-8;base64," + btoa(binario);
}

async function descargar() {
    const texto = contenidoActual();
    const nombre = nombreActual();
    const blobUrl = URL.createObjectURL(new Blob([texto], { type: "application/json;charset=utf-8" }));

    try {
        try {
            await chrome.downloads.download({ url: blobUrl, filename: nombre, saveAs: true });
            return;
        } catch (e) {
            /* siguiente estrategia */
        }

        try {
            await chrome.downloads.download({ url: aDataUrl(texto), filename: nombre, saveAs: true });
            return;
        } catch (e) {
            /* siguiente estrategia */
        }

        const enlace = document.createElement("a");
        enlace.href = blobUrl;
        enlace.download = nombre;
        document.body.appendChild(enlace);
        enlace.click();
        enlace.remove();
    } finally {
        window.setTimeout(() => URL.revokeObjectURL(blobUrl), 15000);
    }
}

function copiar(texto) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(texto);
    }

    const area = document.createElement("textarea");
    area.value = texto;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
    return Promise.resolve();
}

function copiarSalida() {
    const original = ui.copiar.textContent;
    ui.copiar.textContent = "¡Copiado!";

    copiar(contenidoActual())
        .catch(() => mostrarAviso("El navegador bloqueó el portapapeles. Usa «Descargar»."))
        .finally(() => {
            window.setTimeout(() => {
                ui.copiar.textContent = original;
            }, 1500);
        });
}

ui.exportar.addEventListener("click", exportar);

ui.archivo.addEventListener("click", () => ui.inputArchivo.click());

ui.inputArchivo.addEventListener("change", () => {
    const archivo = ui.inputArchivo.files && ui.inputArchivo.files[0];
    if (archivo) {
        leerArchivo(archivo);
    }
    ui.inputArchivo.value = "";
});

ui.pegar.addEventListener("click", () => {
    ui.panelPegar.hidden = !ui.panelPegar.hidden;
    if (!ui.panelPegar.hidden) {
        ui.areaPegar.focus();
    }
});

ui.procesarPegado.addEventListener("click", () => {
    const texto = ui.areaPegar.value.trim();
    if (!texto) {
        mostrarAviso("Pega primero el JSON.");
        return;
    }
    intentarCargar(texto);
    ui.areaPegar.value = "";
    ui.panelPegar.hidden = true;
});

ui.limpiar.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "ROLL20_CLEAR" }).then(() => {
        mostrarAviso("");
        aplicarEstado({ items: [], meta: null });
    });
});

ui.buscador.addEventListener("input", pintarLista);
ui.filtroTipo.addEventListener("change", pintarLista);

ui.marcarTodo.addEventListener("change", () => {
    const visibles = itemsVisibles();
    const todosMarcados = visibles.length > 0 && visibles.every(({ indice }) => seleccionados.has(indice));

    visibles.forEach(({ indice }) => {
        if (todosMarcados) {
            seleccionados.delete(indice);
        } else {
            seleccionados.add(indice);
        }
    });

    pintarLista();
});

ui.formato.addEventListener("change", actualizarPie);
ui.descargar.addEventListener("click", descargar);
ui.copiar.addEventListener("click", copiarSalida);

chrome.runtime.onMessage.addListener((mensaje) => {
    if (mensaje && mensaje.type === "ROLL20_LOG") {
        ui.resumen.textContent = mensaje.texto;
    }
});

pedirEstado();
