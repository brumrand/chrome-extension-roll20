(async function exportRoll20Raw() {
    var campaign = window.Campaign;
    if (!campaign) {
        console.error("❌ Error: No se encontró window.Campaign. Abre la consola dentro de la partida de Roll20.");
        return;
    }

    // Función clave: extrae el texto real desde el blob de Roll20
    function fetchBlobText(model, field) {
        return new Promise(function(resolve) {
            try {
                if (typeof model._getLatestBlob === "function") {
                    model._getLatestBlob(field, function(val) {
                        resolve(val || "");
                    });
                } else {
                    resolve(model.get(field) || "");
                }
            } catch (e) {
                resolve("");
            }
        });
    }

    var items = [];

    // 1. Personajes (Fichas)
    var characters = (campaign.characters && campaign.characters.models) ? campaign.characters.models : [];
    console.log("Extrayendo " + characters.length + " fichas de personaje...");

    for (var i = 0; i < characters.length; i++) {
        var char = characters[i];
        var charAttrs = char.attributes || {};

        // bio contiene las notas públicas de la ficha
        var bioRaw = await fetchBlobText(char, "bio");
        var avatarUrl = (typeof char.get === "function" ? char.get("avatar") : "") || charAttrs.avatar || "";
        var name = (typeof char.get === "function" ? char.get("name") : "") || charAttrs.name || "Sin Nombre";

        items.push({
            title: String(name).trim(),
            type: "character",
            cover: avatarUrl,
            raw_text: bioRaw
        });
    }

    // 2. Handouts
    var handouts = (campaign.handouts && campaign.handouts.models) ? campaign.handouts.models : [];
    console.log("Extrayendo " + handouts.length + " handouts...");

    for (var j = 0; j < handouts.length; j++) {
        var handout = handouts[j];
        var handoutAttrs = handout.attributes || {};

        // notes contiene el texto del handout
        var notesRaw = await fetchBlobText(handout, "notes");
        var handoutAvatar = (typeof handout.get === "function" ? handout.get("avatar") : "") || handoutAttrs.avatar || "";
        var handoutName = (typeof handout.get === "function" ? handout.get("name") : "") || handoutAttrs.name || "Sin Título";

        items.push({
            title: String(handoutName).trim(),
            type: "handout",
            cover: handoutAvatar,
            raw_text: notesRaw
        });
    }

    // Ordenar alfabéticamente
    items.sort(function(a, b) {
        return a.title.localeCompare(b.title, "es", { sensitivity: "base" });
    });

    var json = JSON.stringify(items, null, 2);
    window.roll20RawData = items;

    // Descarga automática del archivo
    try {
        var blob = new Blob([json], { type: "application/json;charset=utf-8" });
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = "roll20_raw_data.json";
        document.body.appendChild(a);
        a.click();
        setTimeout(function() {
            URL.revokeObjectURL(url);
            a.remove();
        }, 2000);
        console.log("✅ Descarga completada con textos reales: roll20_raw_data.json");
    } catch (e) {
        console.warn("⚠️ Descarga automática bloqueada. El objeto está listo en window.roll20RawData");
    }

    return items;
})();