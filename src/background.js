"use strict";

const CLAVE_ITEMS = "roll20Items";
const CLAVE_META = "roll20Meta";
const URL_ROLL20 = /^https:\/\/([a-z0-9-]+\.)*roll20\.net\//i;

async function guardar(payload) {
    const total = Array.isArray(payload.items) ? payload.items.length : 0;

    const meta = {
        campana: payload.campana || "Partida de Roll20",
        url: payload.url || "",
        capturado: payload.capturado || new Date().toISOString(),
        total: total
    };

    if (payload.conteo) {
        meta.conteo = payload.conteo;
    } else {
        meta.conteo = total
            ? {
                  characters: payload.items.filter((item) => item.type !== "handout").length,
                  handouts: payload.items.filter((item) => item.type === "handout").length
              }
            : { characters: 0, handouts: 0 };
    }

    await chrome.storage.local.set({ [CLAVE_ITEMS]: meta.total ? payload.items : [], [CLAVE_META]: meta });
    return meta;
}

async function leerEstado() {
    const guardado = await chrome.storage.local.get([CLAVE_ITEMS, CLAVE_META]);
    return {
        items: Array.isArray(guardado[CLAVE_ITEMS]) ? guardado[CLAVE_ITEMS] : [],
        meta: guardado[CLAVE_META] || null
    };
}

async function pestanaRoll20() {
    const [pestanaActiva] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (pestanaActiva && pestanaActiva.url && URL_ROLL20.test(pestanaActiva.url)) {
        return pestanaActiva;
    }

    const candidatas = await chrome.tabs.query({ url: ["https://app.roll20.net/*"] });
    return candidatas.find((pestana) => pestana && pestana.url && /\/campaigns\//.test(pestana.url)) || null;
}

async function extraer() {
    const pestana = await pestanaRoll20();

    if (!pestana) {
        throw new Error(
            "No encontré una pestaña de partida de Roll20 abierta. Abre la partida (app.roll20.net/campaigns/...) e inténtalo de nuevo."
        );
    }

    let respuesta;
    try {
        respuesta = await chrome.tabs.sendMessage(pestana.id, { type: "ROLL20_PEDIR_EXTRACCION" });
    } catch (e) {
        throw new Error(
            "No pude hablar con la pestaña de Roll20. Recarga la página de la partida y vuelve a intentarlo."
        );
    }

    if (!respuesta) {
        throw new Error("La pestaña de Roll20 no respondió a la extracción. Recarga la partida e inténtalo de nuevo.");
    }

    if (!respuesta.ok) {
        throw new Error(respuesta.error || "Falló la extracción en la página de Roll20.");
    }

    const meta = await guardar(respuesta.payload);

    return { ok: true, items: respuesta.payload.items, meta: meta, pestana: pestana.id };
}

chrome.runtime.onMessage.addListener((mensaje, emisor, responder) => {
    if (!mensaje || typeof mensaje.type !== "string") {
        return undefined;
    }

    if (mensaje.type === "ROLL20_GET_STATE") {
        leerEstado()
            .then((estado) => responder({ ok: true, estado }))
            .catch((error) => responder({ ok: false, error: String(error) }));
        return true;
    }

    if (mensaje.type === "ROLL20_EXTRACT") {
        extraer()
            .then((resultado) => responder(resultado))
            .catch((error) =>
                responder({ ok: false, error: error && error.message ? error.message : String(error) })
            );
        return true;
    }

    if (mensaje.type === "ROLL20_SAVE") {
        guardar({ items: mensaje.items, campana: mensaje.campana, url: mensaje.url })
            .then((meta) => responder({ ok: true, meta }))
            .catch((error) => responder({ ok: false, error: String(error) }));
        return true;
    }

    if (mensaje.type === "ROLL20_CLEAR") {
        chrome.storage.local
            .remove([CLAVE_ITEMS, CLAVE_META])
            .then(() => responder({ ok: true }))
            .catch((error) => responder({ ok: false, error: String(error) }));
        return true;
    }

    if (mensaje.type === "ROLL20_LOG") {
        console.info("[Roll20 Exporter]", mensaje.texto);
        return undefined;
    }

    return undefined;
});
