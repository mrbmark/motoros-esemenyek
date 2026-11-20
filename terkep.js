let map = null;
let indulasIkon = null;
let nevezetessegIkon = null;
let rendezvenyIkon = null;
let utvonalLepesIkon = null;
let kivalasztottMod = "auto";
let aktualisNevezetessegek = [];
let aktualisRendezvenyek = [];
let aktualisUtvonalLepesek = [];
let indulasMarker = null;
let aktualisMarker = null;
let kiemeltMarker = null;
let routingControl = null;
let fallbackLine = null;
let utolsoUtvonalHatarok = null;

function inicializalTerkep() {
    if (typeof L === "undefined") {
        const terkepElem = document.getElementById("terkep");
        if (terkepElem) {
            terkepElem.innerHTML = `<p style="padding:30px;color:#ffb36b;">⚠️ A térképkönyvtár betöltése sikertelen (ellenőrizd az internetkapcsolatot).</p>`;
        }
        return;
    }

    map = L.map("terkep").setView([47.1625, 19.5033], 7);

    const esriLayer = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}", {
        attribution: "Tiles © Esri",
        maxZoom: 19
    });

    const osmFallbackLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19
    });

    let hibaSzamlalo = 0;
    esriLayer.on("tileerror", function() {
        hibaSzamlalo++;
        if (hibaSzamlalo === 3 && map.hasLayer(esriLayer)) {
            map.removeLayer(esriLayer);
            osmFallbackLayer.addTo(map);
        }
    });

    esriLayer.addTo(map);

    indulasIkon = L.divIcon({
        className: "custom-start-marker",
        html: `<div style="background-color: #10b981; color: white; width: 32px; height: 32px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; border: 2px solid #ffffff; box-shadow: 0 3px 10px rgba(0,0,0,0.6);"><span style="transform: rotate(45deg); font-size: 15px;">🚩</span></div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
    });

    nevezetessegIkon = L.divIcon({
        className: "custom-sight-marker",
        html: `<div style="background-color: #ef4444; color: white; width: 32px; height: 32px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; border: 2px solid #ffffff; box-shadow: 0 3px 10px rgba(0,0,0,0.6);"><span style="transform: rotate(45deg); font-size: 15px;">★</span></div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
    });

    rendezvenyIkon = L.divIcon({
        className: "custom-event-marker",
        html: `<div style="background-color: #ff6b00; color: white; width: 34px; height: 34px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; border: 2px solid #ffffff; box-shadow: 0 3px 12px rgba(255,107,0,0.7);"><span style="transform: rotate(45deg); font-size: 16px;">🏍️</span></div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 34],
        popupAnchor: [0, -34]
    });

    utvonalLepesIkon = L.divIcon({
        className: "custom-step-marker",
        html: `<div style="background-color: #3b82f6; color: white; width: 32px; height: 32px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; border: 2px solid #ffffff; box-shadow: 0 3px 10px rgba(0,0,0,0.6);"><span style="transform: rotate(45deg); font-size: 15px;">🧭</span></div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
    });

    frissitIndulasMarker(false);

    setTimeout(() => {
        if (map) map.invalidateSize();
    }, 300);

    window.addEventListener("resize", () => {
        if (map) map.invalidateSize();
    });
}

function frissitIndulasMarker(nyissaFelPopupot = false) {
    if (!map || !aktualisIndulas) return;
    if (indulasMarker) map.removeLayer(indulasMarker);
    indulasMarker = L.marker([aktualisIndulas.lat, aktualisIndulas.lng], { icon: indulasIkon })
        .addTo(map)
        .bindPopup(`<b>🚩 Kiindulási pont</b><br>${aktualisIndulas.nev}<br><small>${aktualisIndulas.megye}</small>`);
    if (nyissaFelPopupot) indulasMarker.openPopup();
}

function frissitIndulasAllapot() {
    const fejlecIndulas = document.getElementById("fejlec-indulas");
    if (fejlecIndulas) fejlecIndulas.innerText = aktualisIndulas.nev;
    if (aktualisCel) {
        frissitIndulasMarker(false);
        document.getElementById("tav-auto").innerText = "Számítás...";
        document.getElementById("tav-sima").innerText = "Számítás...";
        rajzolTerkep(aktualisCel);
    } else {
        frissitIndulasMarker(true);
        if (map) map.flyTo([aktualisIndulas.lat, aktualisIndulas.lng], 11, { duration: 0.9 });
    }
}

function valasztUt(mod) {
    kivalasztottMod = mod;
    document.getElementById("btn-auto").classList.remove("aktiv");
    document.getElementById("btn-sima").classList.remove("aktiv");
    if (mod === "auto") document.getElementById("btn-auto").classList.add("aktiv");
    else document.getElementById("btn-sima").classList.add("aktiv");
    if (aktualisCel) rajzolTerkep(aktualisCel);
}

async function betoltNevezetessegek(cel) {
    const nevezetessegTar = typeof kiemeltNevezetessegek !== "undefined" ? kiemeltNevezetessegek : {};
    if (nevezetessegTar[cel.nev]) {
        aktualisNevezetessegek = nevezetessegTar[cel.nev];
        renderVarosInfo(cel, aktualisNevezetessegek);
        return;
    }

    aktualisNevezetessegek = [
        { nev: `${cel.nev} – Településközpont`, lat: cel.lat, lng: cel.lng },
        { nev: `${cel.nev} – Fő tér és környéke`, lat: cel.lat + 0.0018, lng: cel.lng + 0.0022 }
    ];
    renderVarosInfo(cel, aktualisNevezetessegek, true);

    try {
        const query = `[out:json][timeout:8];(node["tourism"~"attraction|museum|viewpoint"]["name"](around:4500,${cel.lat},${cel.lng});node["historic"~"castle|monument|memorial|ruins"]["name"](around:4500,${cel.lat},${cel.lng});way["historic"="castle"]["name"](around:4500,${cel.lat},${cel.lng}););out center 6;`;
        const response = await fetch("https://overpass-api.de/api/interpreter", {
            method: "POST",
            body: "data=" + encodeURIComponent(query)
        });
        if (!response.ok) throw new Error("Overpass hiba");
        const data = await response.json();

        if (aktualisCel && aktualisCel.nev === cel.nev && data.elements && data.elements.length > 0) {
            const egyediNevek = new Set();
            const talaltHelyek = [];
            for (const el of data.elements) {
                const nev = el.tags && el.tags.name;
                const lat = el.lat || (el.center && el.center.lat);
                const lng = el.lon || (el.center && el.center.lon);
                if (nev && lat && lng && !egyediNevek.has(nev)) {
                    egyediNevek.add(nev);
                    talaltHelyek.push({ nev, lat, lng });
                    if (talaltHelyek.length === 4) break;
                }
            }
            if (talaltHelyek.length > 0) {
                aktualisNevezetessegek = talaltHelyek;
                renderVarosInfo(cel, aktualisNevezetessegek, false);
                return;
            }
        }
    } catch (e) {}

    if (aktualisCel && aktualisCel.nev === cel.nev) {
        renderVarosInfo(cel, aktualisNevezetessegek, false);
    }
}

function renderVarosInfo(cel, lista, toltesAlatt = false) {
    const listaElemek = lista.map((hely, index) => `
        <li id="nev-elem-${index}" onclick="mutatNevezetesseg(${index})">
            <span>📍 ${hely.nev}</span>
            <span class="nyil-jel">Térképen →</span>
        </li>
    `).join("");

    const extraAdatokHtml = (cel.jaras || cel.iranyitoszam)
        ? `<div class="adat-doboz"><div class="adat-cim">Járás</div><div class="adat-ertek">${cel.jaras || "—"}</div></div>
           <div class="adat-doboz"><div class="adat-cim">Irányítószám</div><div class="adat-ertek">${cel.iranyitoszam || "—"}</div></div>`
        : "";

    document.getElementById("varos-info-tartalom").innerHTML = `
        <div class="adat-racs">
            <div class="adat-doboz"><div class="adat-cim">Terület</div><div class="adat-ertek">${cel.terulet}</div></div>
            <div class="adat-doboz"><div class="adat-cim">Lakosság</div><div class="adat-ertek">${cel.lakossag}</div></div>
            ${extraAdatokHtml}
        </div>
        <p class="nevezetessegek-cim">Érdemes megnézni:${toltesAlatt ? " <small>(helyszínek keresése...)</small>" : ""}</p>
        <p class="nevezetessegek-tipp">Kattints valamelyik helyszínre a térképes megjelenítéshez:</p>
        <ul class="nevezetesseg-lista">${listaElemek}</ul>
        <button type="button" class="vissza-utvonal-gomb" id="btn-vissza-utvonal" onclick="visszaTeljesUtvonalra()">🗺️ Teljes útvonal mutatása</button>
    `;
}

function torolKijeloleseket() {
    document.querySelectorAll(".nevezetesseg-lista li").forEach(li => li.classList.remove("aktiv"));
    document.querySelectorAll(".rendezveny-elem").forEach(li => li.classList.remove("aktiv"));
    document.querySelectorAll(".utvonal-lepes").forEach(div => div.classList.remove("aktiv"));
}

function megjelenitVisszaGombokat(lathato) {
    const allapot = lathato ? "block" : "none";
    const visszaBtnJobb = document.getElementById("btn-vissza-utvonal");
    if (visszaBtnJobb) visszaBtnJobb.style.display = allapot;
    const visszaBtnBal = document.getElementById("btn-vissza-utvonal-bal");
    if (visszaBtnBal) visszaBtnBal.style.display = allapot;
}

function mutatUtvonalLepes(index) {
    if (!map || !aktualisCel || !aktualisUtvonalLepesek[index]) return;
    const lepes = aktualisUtvonalLepesek[index];

    torolKijeloleseket();
    const kivalasztottElem = document.getElementById(`lepes-elem-${index}`);
    if (kivalasztottElem) kivalasztottElem.classList.add("aktiv");

    if (kiemeltMarker) map.removeLayer(kiemeltMarker);
    const tavInfo = lepes.distance > 0 ? `<br><small>Szakasz hossza: ${formatTavolsag(lepes.distance)}</small>` : "";
    kiemeltMarker = L.marker([lepes.lat, lepes.lng], { icon: utvonalLepesIkon })
        .addTo(map)
        .bindPopup(`<b>${index + 1}. lépés</b><br>${lepes.szoveg}${tavInfo}`)
        .openPopup();

    map.flyTo([lepes.lat, lepes.lng], 15, { duration: 1.0 });
    megjelenitVisszaGombokat(true);
}

function mutatNevezetesseg(index) {
    if (!map || !aktualisCel || !aktualisNevezetessegek[index]) return;
    const hely = aktualisNevezetessegek[index];

    torolKijeloleseket();
    const kivalasztottLi = document.getElementById(`nev-elem-${index}`);
    if (kivalasztottLi) kivalasztottLi.classList.add("aktiv");

    if (kiemeltMarker) map.removeLayer(kiemeltMarker);
    kiemeltMarker = L.marker([hely.lat, hely.lng], { icon: nevezetessegIkon })
        .addTo(map)
        .bindPopup(`<b>★ ${hely.nev}</b><br><small>${aktualisCel.nev} – Nevezetesség</small>`)
        .openPopup();

    map.flyTo([hely.lat, hely.lng], 15, { duration: 1.1 });
    megjelenitVisszaGombokat(true);
}

function mutatRendezveny(index) {
    if (!map || !aktualisCel || !aktualisRendezvenyek[index]) return;
    const rend = aktualisRendezvenyek[index];

    torolKijeloleseket();
    const kivalasztottLi = document.getElementById(`rend-elem-${index}`);
    if (kivalasztottLi) kivalasztottLi.classList.add("aktiv");

    if (kiemeltMarker) map.removeLayer(kiemeltMarker);
    kiemeltMarker = L.marker([rend.lat, rend.lng], { icon: rendezvenyIkon })
        .addTo(map)
        .bindPopup(`<b>🏍️ ${rend.nev}</b><br><small>📅 ${rend.datum}<br>📍 ${rend.hely}</small>`)
        .openPopup();

    map.flyTo([rend.lat, rend.lng], 14, { duration: 1.1 });
    megjelenitVisszaGombokat(true);
}

function visszaTeljesUtvonalra() {
    if (!map) return;
    if (kiemeltMarker) {
        map.removeLayer(kiemeltMarker);
        kiemeltMarker = null;
    }
    if (utolsoUtvonalHatarok) map.fitBounds(utolsoUtvonalHatarok, { padding: [40, 40] });
    if (aktualisMarker) aktualisMarker.openPopup();
    torolKijeloleseket();
    megjelenitVisszaGombokat(false);
}

function formatTavolsag(meter) {
    if (meter < 1000) return Math.round(meter) + " m";
    return (meter / 1000).toFixed(1).replace(".", ",") + " km";
}

function forditUtasitas(inst) {
    const ut = inst.road ? ` (<b>${inst.road}</b>)` : "";
    const mod = inst.modifier || "";

    switch (inst.type) {
        case "Head": return { ikon: "⬆️", szoveg: `Indulj el${ut}` };
        case "Continue": return { ikon: "⬆️", szoveg: `Haladj tovább egyenesen${ut}` };
        case "SlightRight": return { ikon: "↗️", szoveg: `Tarts enyhén jobbra${ut}` };
        case "Right": return { ikon: "↱", szoveg: `Kanyarodj jobbra${ut}` };
        case "SharpRight": return { ikon: "↪️", szoveg: `Kanyarodj élesen jobbra${ut}` };
        case "TurnAround": return { ikon: "🔄", szoveg: `Fordulj vissza${ut}` };
        case "SharpLeft": return { ikon: "↩️", szoveg: `Kanyarodj élesen balra${ut}` };
        case "Left": return { ikon: "↰", szoveg: `Kanyarodj balra${ut}` };
        case "SlightLeft": return { ikon: "↖️", szoveg: `Tarts enyhén balra${ut}` };
        case "Roundabout":
        case "Rotary": return { ikon: "🔄", szoveg: `A körforgalomban hajts ki a(z) ${inst.exit || 1}. kijáraton${ut}` };
        case "OffRamp": return { ikon: "↗️", szoveg: `Hajts le a lehajtón${ut}` };
        case "OnRamp": return { ikon: "🛣️", szoveg: `Hajts fel a felhajtóra${ut}` };
        case "Fork": return { ikon: "🔱", szoveg: `Az elágazásnál tarts ${mod.includes("Left") ? "balra" : "jobbra"}${ut}` };
        case "Merge": return { ikon: "🔀", szoveg: `Sorolj be${ut}` };
        case "DestinationReached":
        case "WaypointReached": return { ikon: "🏁", szoveg: `Megérkeztél: <b>${aktualisCel.nev}</b>` };
        default:
            if (mod.includes("Left")) return { ikon: "↰", szoveg: `Kanyarodj balra${ut}` };
            if (mod.includes("Right")) return { ikon: "↱", szoveg: `Kanyarodj jobbra${ut}` };
            return { ikon: "⬆️", szoveg: `Haladj tovább${ut}` };
    }
}

function rajzolTerkep(cel) {
    if (!map) return;

    if (aktualisMarker) map.removeLayer(aktualisMarker);
    if (kiemeltMarker) { map.removeLayer(kiemeltMarker); kiemeltMarker = null; }
    if (fallbackLine) { map.removeLayer(fallbackLine); fallbackLine = null; }
    if (routingControl) { try { map.removeControl(routingControl); } catch (e) {} routingControl = null; }

    aktualisUtvonalLepesek = [];
    megjelenitVisszaGombokat(false);
    document.getElementById("utvonal-lista").innerHTML = `<p class="ures-allapot">Útvonal tervezése (${aktualisIndulas.nev} → ${cel.nev})...</p>`;

    const celPont = kiemeltTalalkozoCel
        ? { lat: kiemeltTalalkozoCel.lat, lng: kiemeltTalalkozoCel.lng }
        : { lat: cel.lat, lng: cel.lng };

    if (kiemeltTalalkozoCel) {
        aktualisMarker = L.marker([celPont.lat, celPont.lng], { icon: rendezvenyIkon })
            .addTo(map)
            .bindPopup(`<b>🏍️ ${kiemeltTalalkozoCel.nev}</b><br><small>📅 ${kiemeltTalalkozoCel.datum}<br>📍 ${kiemeltTalalkozoCel.hely}</small>`)
            .openPopup();
    } else {
        aktualisMarker = L.marker([celPont.lat, celPont.lng])
            .addTo(map)
            .bindPopup(`<b>🏁 ${cel.nev}</b><br>${cel.megye}`)
            .openPopup();
    }

    const vonalSzin = (kivalasztottMod === "auto") ? "#ff6b00" : "#10b981";

    const rajzolTartalekVonalat = () => {
        const pontok = [[aktualisIndulas.lat, aktualisIndulas.lng], [celPont.lat, celPont.lng]];
        fallbackLine = L.polyline(pontok, { color: vonalSzin, weight: 5, opacity: 0.85, dashArray: "10, 8" }).addTo(map);
        utolsoUtvonalHatarok = L.latLngBounds(pontok);
        map.fitBounds(utolsoUtvonalHatarok, { padding: [50, 50] });

        const becsultKm = Math.round(tavolsagKm(aktualisIndulas.lat, aktualisIndulas.lng, celPont.lat, celPont.lng) * 1.25);
        const simaKm = becsultKm <= 25 ? Math.max(0, becsultKm - 4) : Math.round(becsultKm * 0.93);
        document.getElementById("tav-auto").innerText = `kb. ${becsultKm} km`;
        document.getElementById("tav-sima").innerText = `kb. ${simaKm} km (főutakon)`;
        document.getElementById("utvonal-lista").innerHTML = `<p class="ures-allapot">A térképi jelölők megjelenítve. Az útvonalszerver jelenleg terhelt, így a becsült távolság látható.</p>`;
    };

    if (typeof L.Routing === "undefined") {
        rajzolTartalekVonalat();
        return;
    }

    routingControl = L.Routing.control({
        waypoints: [L.latLng(aktualisIndulas.lat, aktualisIndulas.lng), L.latLng(celPont.lat, celPont.lng)],
        routeWhileDragging: false,
        addWaypoints: false,
        show: false,
        lineOptions: { styles: [{ color: vonalSzin, opacity: 0.9, weight: 6 }] },
        createMarker: function() { return null; }
    }).addTo(map);

    routingControl.on("routingerror", function() {
        rajzolTartalekVonalat();
    });

    routingControl.on("routesfound", function(e) {
        const route = e.routes[0];
        utolsoUtvonalHatarok = L.latLngBounds(route.coordinates);

        const osszKm = Math.round(route.summary.totalDistance / 1000);
        const ora = Math.floor(route.summary.totalTime / 3600);
        const perc = Math.round((route.summary.totalTime % 3600) / 60);
        const idoSzoveg = ora > 0 ? `${ora} óra ${perc} perc` : `${perc} perc`;

        const autopalyaSzamok = [...new Set(
            route.instructions
                .map(i => i.road)
                .filter(r => r && /\bM\d+\b/.test(r))
                .map(r => r.match(/\bM\d+\b/)[0])
        )];
        const palyaInfo = autopalyaSzamok.length > 0 ? ` (${autopalyaSzamok.join(", ")})` : "";
        const simaKm = osszKm <= 25 ? Math.max(0, osszKm - 4) : Math.round(osszKm * 0.93);
        const azonosPont = (cel.nev === aktualisIndulas.nev && !kiemeltTalalkozoCel);

        document.getElementById("tav-auto").innerText = azonosPont ? "0 km (azonos település)" : `kb. ${osszKm} km${palyaInfo}`;
        document.getElementById("tav-sima").innerText = azonosPont ? "0 km (azonos település)" : `kb. ${simaKm} km (főutakon)`;

        const osszegzo = document.getElementById("utvonal-osszegzo");
        osszegzo.style.display = "block";
        osszegzo.innerText = `${aktualisIndulas.nev} → ${cel.nev} • ${osszKm} km • kb. ${idoSzoveg}`;

        aktualisUtvonalLepesek = route.instructions.map((inst, idx) => {
            const adat = forditUtasitas(inst);
            const coord = (typeof inst.index === "number" && route.coordinates && route.coordinates[inst.index])
                ? route.coordinates[inst.index]
                : (idx === route.instructions.length - 1
                    ? { lat: celPont.lat, lng: celPont.lng }
                    : { lat: aktualisIndulas.lat, lng: aktualisIndulas.lng });
            return { ikon: adat.ikon, szoveg: adat.szoveg, distance: inst.distance, lat: coord.lat, lng: coord.lng };
        });

        const lepesekHtml = aktualisUtvonalLepesek.map((lepes, idx) => {
            const tav = lepes.distance > 0 ? `<span class="lepes-tav">${formatTavolsag(lepes.distance)}</span>` : "";
            return `
                <div class="utvonal-lepes" id="lepes-elem-${idx}" onclick="mutatUtvonalLepes(${idx})" title="Kattints a térképes megjelenítéshez">
                    <span class="lepes-ikon">${lepes.ikon}</span>
                    <span class="lepes-szoveg">${lepes.szoveg}</span>
                    ${tav}
                </div>
            `;
        }).join("");

        document.getElementById("utvonal-lista").innerHTML = `<p class="nevezetessegek-tipp">Kattints bármelyik lépésre a helyszín térképes megtekintéséhez:</p>${lepesekHtml}`;
    });
}