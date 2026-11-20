// ============================================================================
// MOTOROS ESEMÉNYEK – FŐ ALKALMAZÁSLOGIKA (app.js)
// ============================================================================

var aktualisIndulas = null;
var aktualisCel = null;
var aktualisRendezvenyek = [];
var kiemeltTalalkozoCel = null;
var aktualisUtMod = "auto";

var szurtIndulasLista = [];
var szurtCelLista = [];
var szurtEsemenyLista = [];

var sajatTerkep = null;
var sajatIndulasMarker = null;
var sajatCelMarker = null;
var sajatUtvonalVonal = null;
var sajatLepesMarker = null;
var utolsoUtvonalAdatok = { auto: null, sima: null };

// --- SEGÉDFÜGGVÉNYEK ---

function ekezetNelkul(szoveg) {
    return (szoveg || "")
        .toString()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
}

function tavolsagKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function formazIdotartam(masodperc) {
    if (!masodperc || isNaN(masodperc)) return "";
    const osszPerc = Math.round(masodperc / 60);
    const ora = Math.floor(osszPerc / 60);
    const perc = osszPerc % 60;
    if (ora > 0) return `${ora} óra ${perc} perc`;
    return `${perc} perc`;
}

function keresHelyszintSzovegben(szoveg) {
    if (!szoveg || typeof varosok === "undefined" || !Array.isArray(varosok)) return null;
    const normSzoveg = ekezetNelkul(szoveg);
    if (!normSzoveg) return null;

    // Először megnézzük a vessző vagy zárójel előtti első részt (pl. "Győr, Land-Plan Hotel" -> "Győr")
    const elsoResz = ekezetNelkul(szoveg.split(",")[0].split("(")[0]);
    if (elsoResz) {
        const pontosElso = varosok.find(v => ekezetNelkul(v.nev) === elsoResz);
        if (pontosElso) return pontosElso;
    }

    // Hosszabb városnevektől haladunk a rövidebbek felé, hogy pl. "Dunakeszi" előbb találjon, mint rövid töredékek
    const rendezettVarosok = [...varosok].sort((a, b) => b.nev.length - a.nev.length);

    for (const v of rendezettVarosok) {
        const normVaros = ekezetNelkul(v.nev);
        if (normVaros.length < 2) continue;
        const escaped = normVaros.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const minta = new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9]|ban|ben|on|en|ra|re|ba|be|nal|nel|bol|rol|hoz|hez|val|vel|i\b)`);
        if (minta.test(normSzoveg)) {
            return v;
        }
    }

    return null;
}

function escapeHtml(str) {
    return (str || "")
        .toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

// --- LEGÖRDÜLŐ LISTÁK KEZELÉSE (KIINDULÓPONT, ÚTI CÉL, ESEMÉNYEK) ---

function nyitLista(tipus, mutatMind = false) {
    ["indulas", "cel", "esemeny"].forEach(t => {
        if (t !== tipus) {
            const masik = document.getElementById(`${t}-lista`);
            if (masik) masik.classList.remove("nyitva");
        }
    });

    const listaElem = document.getElementById(`${tipus}-lista`);
    const inputElem = document.getElementById(`${tipus}-input`);
    if (!listaElem) return;

    const szuro = mutatMind ? "" : (inputElem ? inputElem.value : "");
    if (tipus === "esemeny") {
        renderEsemenyLegordulo(szuro);
    } else {
        renderVarosLegordulo(tipus, szuro);
    }

    listaElem.classList.add("nyitva");
}

function valtLista(tipus) {
    const listaElem = document.getElementById(`${tipus}-lista`);
    if (!listaElem) return;
    if (listaElem.classList.contains("nyitva")) {
        listaElem.classList.remove("nyitva");
    } else {
        nyitLista(tipus, true);
        const inputElem = document.getElementById(`${tipus}-input`);
        if (inputElem) inputElem.focus();
    }
}

function szurLista(tipus, kereses) {
    const listaElem = document.getElementById(`${tipus}-lista`);
    if (listaElem) listaElem.classList.add("nyitva");

    if (tipus === "esemeny") {
        renderEsemenyLegordulo(kereses);
    } else {
        renderVarosLegordulo(tipus, kereses);
    }
}

function torolMezo(tipus) {
    const inputElem = document.getElementById(`${tipus}-input`);
    if (inputElem) {
        inputElem.value = "";
        inputElem.focus();
    }

    if (tipus === "esemeny") {
        kiemeltTalalkozoCel = null;
        const sav = document.getElementById("legkozelebbi-sav");
        if (sav) {
            sav.style.display = "none";
            sav.classList.remove("elmult-sav");
        }
        renderEsemenyLegordulo("");
    } else {
        renderVarosLegordulo(tipus, "");
    }

    const listaElem = document.getElementById(`${tipus}-lista`);
    if (listaElem) listaElem.classList.add("nyitva");
}

function renderVarosLegordulo(tipus, szuro = "") {
    const listaElem = document.getElementById(`${tipus}-lista`);
    const szamlaloElem = document.getElementById(`${tipus}-szamlalo`);
    if (!listaElem || typeof varosok === "undefined") return;

    const normSzuro = ekezetNelkul(szuro);
    const talalatok = [];

    varosok.forEach((v, idx) => {
        if (!normSzuro ||
            ekezetNelkul(v.nev).includes(normSzuro) ||
            ekezetNelkul(v.megye || "").includes(normSzuro) ||
            (v.irsz && v.irsz.toString().includes(normSzuro))) {
            talalatok.push({ v, idx });
        }
    });

    if (tipus === "indulas") szurtIndulasLista = talalatok;
    else szurtCelLista = talalatok;

    if (szamlaloElem) {
        szamlaloElem.innerText = `${talalatok.length} település`;
    }

    if (talalatok.length === 0) {
        listaElem.innerHTML = `<div class="combobox-ures">Nincs találat a listában. Nyomj <b>Enter</b>-t vagy kattints az alatta lévő keresőgombra!</div>`;
        return;
    }

    const aktivPont = tipus === "indulas" ? aktualisIndulas : aktualisCel;
    const kattintasFn = tipus === "indulas" ? "valasztIndulasElem" : "valasztCelElem";

    listaElem.innerHTML = talalatok.slice(0, 120).map(({ v, idx }) => {
        const isSelected = aktivPont && ekezetNelkul(aktivPont.nev) === ekezetNelkul(v.nev);
        return `
            <div class="combobox-elem${isSelected ? " kivalasztva" : ""}" onmousedown="event.preventDefault(); ${kattintasFn}(${idx})">
                <span class="combobox-elem-nev">${escapeHtml(v.nev)}</span>
                <span class="combobox-elem-megye">${escapeHtml(v.rovidMegye || v.megye || "")}</span>
            </div>
        `;
    }).join("");
}

function renderEsemenyLegordulo(szuro = "") {
    const listaElem = document.getElementById(`${tipusPrefix("esemeny")}-lista`);
    const szamlaloElem = document.getElementById("esemeny-szamlalo");
    if (!listaElem) return;

    const forrasLista = typeof kozelgoEsemenyekLista !== "undefined" ? kozelgoEsemenyekLista : [];
    const normSzuro = ekezetNelkul(szuro);

    const talalatok = [];
    forrasLista.forEach((ev, idx) => {
        if (!normSzuro ||
            ekezetNelkul(ev.nev).includes(normSzuro) ||
            ekezetNelkul(ev.hely).includes(normSzuro) ||
            ekezetNelkul(ev.datum).includes(normSzuro)) {
            talalatok.push({ ev, idx });
        }
    });

    szurtEsemenyLista = talalatok;
    if (szamlaloElem) {
        szamlaloElem.innerText = `${talalatok.length} esemény`;
    }

    if (talalatok.length === 0) {
        listaElem.innerHTML = `<div class="combobox-ures">Nincs a keresésnek megfelelő közelgő esemény.</div>`;
        return;
    }

    listaElem.innerHTML = talalatok.map(({ ev, idx }) => {
        const isSelected = kiemeltTalalkozoCel && kiemeltTalalkozoCel.nev === ev.nev;
        return `
            <div class="combobox-elem${isSelected ? " kivalasztva" : ""}" onmousedown="event.preventDefault(); valasztEsemenyElem(${idx})">
                <div class="combobox-elem-bal">
                    <div class="combobox-elem-datum-sor">
                        <span>📅 ${escapeHtml(ev.datum)}</span>
                        <span class="dropdown-forras-pill">saját</span>
                    </div>
                    <span class="combobox-elem-nev">${escapeHtml(ev.nev)}</span>
                </div>
                <span class="combobox-elem-megye" style="max-width: 48%; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(ev.hely)}">📍 ${escapeHtml(ev.hely)}</span>
            </div>
        `;
    }).join("");
}

function tipusPrefix(t) { return t; }

// --- PONT VÁLASZTÁSA (INDULÁS, CÉL, ESEMÉNY) ---

function valasztIndulasElem(varosIdx) {
    if (typeof varosok === "undefined" || !varosok[varosIdx]) return;
    aktualisIndulas = varosok[varosIdx];

    const inputElem = document.getElementById("indulas-input");
    if (inputElem) inputElem.value = aktualisIndulas.nev;

    const fejlecIndulas = document.getElementById("fejlec-indulas");
    if (fejlecIndulas) fejlecIndulas.innerText = aktualisIndulas.nev;

    const listaElem = document.getElementById("indulas-lista");
    if (listaElem) listaElem.classList.remove("nyitva");

    frissitCsereGombAllapot();
    if (aktualisCel) {
        frissitKivalasztottCelNezet(true);
    } else {
        kozepreTerkepPont(aktualisIndulas.lat, aktualisIndulas.lng, `🚩 Indulás: ${aktualisIndulas.nev}`);
    }
}

function valasztCelElem(varosIdx, megtartTalalkozo = false) {
    if (typeof varosok === "undefined" || !varosok[varosIdx]) return;
    aktualisCel = varosok[varosIdx];

    if (!megtartTalalkozo) {
        kiemeltTalalkozoCel = null;
        const esemenyInput = document.getElementById("esemeny-input");
        if (esemenyInput) esemenyInput.value = "";
        const sav = document.getElementById("legkozelebbi-sav");
        if (sav) {
            sav.style.display = "none";
            sav.classList.remove("elmult-sav");
        }
    }

    const celInput = document.getElementById("cel-input");
    if (celInput) celInput.value = aktualisCel.nev;

    const listaElem = document.getElementById("cel-lista");
    if (listaElem) listaElem.classList.remove("nyitva");

    frissitCsereGombAllapot();
    frissitKivalasztottCelNezet(megtartTalalkozo);
}

function valasztEsemenyElem(kozelgoIdx) {
    if (typeof kozelgoEsemenyekLista === "undefined" || !kozelgoEsemenyekLista[kozelgoIdx]) return;
    const rend = kozelgoEsemenyekLista[kozelgoIdx];

    kiemeltTalalkozoCel = rend;
    const esemenyInput = document.getElementById("esemeny-input");
    if (esemenyInput) esemenyInput.value = rend.nev;

    const listaElem = document.getElementById("esemeny-lista");
    if (listaElem) listaElem.classList.remove("nyitva");

    const sav = document.getElementById("legkozelebbi-sav");
    if (sav) {
        sav.style.display = "block";
        sav.classList.remove("elmult-sav");
        sav.innerHTML = `🏍️ Kiválasztott esemény: <b>${escapeHtml(rend.nev)}</b><br>📅 ${escapeHtml(rend.datum)} • 📍 ${escapeHtml(rend.hely)}`;
    }

    let varosIdx = -1;
    if (typeof varosok !== "undefined") {
        if (rend.varosNev) {
            varosIdx = varosok.findIndex(v => ekezetNelkul(v.nev) === ekezetNelkul(rend.varosNev));
        }
        if (varosIdx === -1 && rend.hely) {
            const helyVaros = rend.hely.split(",")[0].split("(")[0].trim();
            varosIdx = varosok.findIndex(v => ekezetNelkul(v.nev) === ekezetNelkul(helyVaros));
        }
        if (varosIdx === -1) {
            let minTav = Infinity;
            varosok.forEach((v, idx) => {
                const t = tavolsagKm(v.lat, v.lng, rend.lat, rend.lng);
                if (t < minTav) { minTav = t; varosIdx = idx; }
            });
        }
    }

    if (varosIdx !== -1) {
        valasztCelElem(varosIdx, true);
    } else {
        aktualisCel = {
            nev: rend.varosNev || rend.hely,
            megye: "",
            rovidMegye: "",
            lat: rend.lat,
            lng: rend.lng
        };
        frissitCsereGombAllapot();
        frissitKivalasztottCelNezet(true);
    }
}

function mutatRendezveny(index) {
    if (!aktualisRendezvenyek || !aktualisRendezvenyek[index]) return;
    const rend = aktualisRendezvenyek[index];
    const kozelgoIdx = typeof kozelgoEsemenyekLista !== "undefined"
        ? kozelgoEsemenyekLista.findIndex(e => e.nev === rend.nev && e.datum === rend.datum)
        : -1;

    if (kozelgoIdx !== -1) {
        valasztEsemenyElem(kozelgoIdx);
    } else {
        kiemeltTalalkozoCel = rend;
        const sav = document.getElementById("legkozelebbi-sav");
        if (sav) {
            sav.style.display = "block";
            sav.classList.remove("elmult-sav");
            sav.innerHTML = `🏍️ Kiválasztott esemény: <b>${escapeHtml(rend.nev)}</b><br>📅 ${escapeHtml(rend.datum)} • 📍 ${escapeHtml(rend.hely)}`;
        }
        frissitKivalasztottCelNezet(true);
    }
}

function valasztLegkozelebbiTalalkozo() {
    if (typeof kozelgoEsemenyekLista === "undefined" || kozelgoEsemenyekLista.length === 0) {
        alert("Jelenleg nincs közelgő motoros program a naptárban.");
        return;
    }
    valasztEsemenyElem(0);
}

function felcserelPontokat() {
    if (!aktualisIndulas || !aktualisCel) return;
    const temp = aktualisIndulas;
    aktualisIndulas = aktualisCel;
    aktualisCel = temp;

    const indulasInput = document.getElementById("indulas-input");
    const celInput = document.getElementById("cel-input");
    const fejlecIndulas = document.getElementById("fejlec-indulas");

    if (indulasInput) indulasInput.value = aktualisIndulas.nev;
    if (celInput) celInput.value = aktualisCel.nev;
    if (fejlecIndulas) fejlecIndulas.innerText = aktualisIndulas.nev;

    kiemeltTalalkozoCel = null;
    const esemenyInput = document.getElementById("esemeny-input");
    if (esemenyInput) esemenyInput.value = "";
    const sav = document.getElementById("legkozelebbi-sav");
    if (sav) sav.style.display = "none";

    frissitKivalasztottCelNezet(false);
}

function frissitCsereGombAllapot() {
    const csereGomb = document.getElementById("btn-csere");
    if (csereGomb) {
        csereGomb.disabled = !(aktualisIndulas && aktualisCel);
    }
}

async function keresEgyebTelepulest(tipus) {
    const inputElem = document.getElementById(`${tipus}-input`);
    const kereses = inputElem ? inputElem.value.trim() : "";
    if (!kereses) {
        nyitLista(tipus, true);
        return;
    }

    // Először megnézzük, szerepel-e a beépített városlistában
    if (typeof varosok !== "undefined") {
        const pontosIdx = varosok.findIndex(v => ekezetNelkul(v.nev) === ekezetNelkul(kereses));
        if (pontosIdx !== -1) {
            if (tipus === "indulas") valasztIndulasElem(pontosIdx);
            else valasztCelElem(pontosIdx, false);
            return;
        }
    }

    const gombId = tipus === "indulas" ? "btn-egyeb-indulas" : "btn-egyeb-telepules";
    const gombElem = document.getElementById(gombId);
    const eredetiSzoveg = gombElem ? gombElem.innerText : "";
    if (gombElem) {
        gombElem.disabled = true;
        gombElem.innerText = "⏳ Település keresése...";
    }

    try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=hu&limit=1&q=${encodeURIComponent(kereses)}`;
        const res = await fetch(url, { headers: { "Accept-Language": "hu" } });
        const adatok = await res.json();

        if (!adatok || adatok.length === 0) {
            alert(`Nem található ilyen magyar település: "${kereses}"`);
            return;
        }

        const talalat = adatok[0];
        const nev = talalat.display_name.split(",")[0].trim();
        const egyediPont = {
            nev: nev,
            megye: "Magyarország",
            rovidMegye: "HU",
            lat: parseFloat(talalat.lat),
            lng: parseFloat(talalat.lon)
        };

        const listaElem = document.getElementById(`${tipus}-lista`);
        if (listaElem) listaElem.classList.remove("nyitva");

        if (tipus === "indulas") {
            aktualisIndulas = egyediPont;
            if (inputElem) inputElem.value = nev;
            const fejlecIndulas = document.getElementById("fejlec-indulas");
            if (fejlecIndulas) fejlecIndulas.innerText = nev;
            frissitCsereGombAllapot();
            if (aktualisCel) frissitKivalasztottCelNezet(true);
            else kozepreTerkepPont(egyediPont.lat, egyediPont.lng, `🚩 Indulás: ${nev}`);
        } else {
            aktualisCel = egyediPont;
            kiemeltTalalkozoCel = null;
            if (inputElem) inputElem.value = nev;
            frissitCsereGombAllapot();
            frissitKivalasztottCelNezet(false);
        }
    } catch (e) {
        alert("Hiba történt a település keresésekor. Ellenőrizd az internetkapcsolatot!");
    } finally {
        if (gombElem) {
            gombElem.disabled = false;
            gombElem.innerText = eredetiSzoveg;
        }
    }
}

// --- KÖZÉPSŐ KÁRTYA, JOBB OLDALI PANELEK ÉS ÚTVONAL FRISSÍTÉSE ---

function frissitKivalasztottCelNezet(megtartTalalkozo = false) {
    if (!aktualisCel) return;

    const varosElem = document.getElementById("varos");
    const megyeElem = document.getElementById("megye");
    const tavDoboz = document.getElementById("tavolsag-doboz");

    if (varosElem) {
        varosElem.innerText = kiemeltTalalkozoCel
            ? `${kiemeltTalalkozoCel.nev} (${aktualisCel.nev})`
            : aktualisCel.nev;
    }

    if (megyeElem) {
        const indulasNev = aktualisIndulas ? aktualisIndulas.nev : "Dunakeszi";
        const megyeSzoveg = aktualisCel.megye ? ` • ${aktualisCel.megye}` : "";
        megyeElem.innerText = `🚩 ${indulasNev} ➔ 🏁 ${aktualisCel.nev}${megyeSzoveg}`;
    }

    if (tavDoboz) {
        tavDoboz.style.display = "grid";
    }

    if (typeof frissitMotorosRendezvenyek === "function") {
        frissitMotorosRendezvenyek(aktualisCel);
    }
    if (typeof renderElmultRendezvenyek === "function") {
        renderElmultRendezvenyek();
    }
    renderVarosInfo(aktualisCel);

    // Térkép és útvonal frissítése (delegálás terkep.js-nek vagy beépített OSRM útvonaltervezés)
    if (typeof tervezUtvonal === "function") {
        tervezUtvonal(aktualisIndulas, aktualisCel, kiemeltTalalkozoCel);
    } else if (typeof frissitTerkepUtvonal === "function") {
        frissitTerkepUtvonal(aktualisIndulas, aktualisCel, kiemeltTalalkozoCel);
    } else if (typeof szamolUtvonal === "function") {
        szamolUtvonal(aktualisIndulas, aktualisCel, kiemeltTalalkozoCel);
    } else {
        tervezBeepitettUtvonal(aktualisIndulas, aktualisCel);
    }
}

function renderVarosInfo(cel) {
    const kontener = document.getElementById("varos-info-tartalom");
    if (!kontener || !cel) return;

    const vanAdat = cel.lakossag || cel.terulet || cel.jaras || cel.irsz || (cel.latnivalok && cel.latnivalok.length > 0);
    if (!vanAdat) {
        kontener.innerHTML = `<p class="ures-allapot"><b>${escapeHtml(cel.nev)}</b> településhez jelenleg nincs részletes adatlap.</p>`;
        return;
    }

    let html = `<div class="varos-adat-racs">`;
    if (cel.megye) html += `<div class="varos-adat-sor"><span>Vármegye:</span><b>${escapeHtml(cel.megye)}</b></div>`;
    if (cel.jaras) html += `<div class="varos-adat-sor"><span>Járás:</span><b>${escapeHtml(cel.jaras)}</b></div>`;
    if (cel.irsz) html += `<div class="varos-adat-sor"><span>Irányítószám:</span><b>${escapeHtml(cel.irsz)}</b></div>`;
    if (cel.lakossag) html += `<div class="varos-adat-sor"><span>Lakosság:</span><b>${escapeHtml(cel.lakossag)}</b></div>`;
    if (cel.terulet) html += `<div class="varos-adat-sor"><span>Terület:</span><b>${escapeHtml(cel.terulet)}</b></div>`;
    html += `</div>`;

    if (Array.isArray(cel.latnivalok) && cel.latnivalok.length > 0) {
        html += `<p class="nevezetessegek-tipp" style="margin-top:10px;">🏛️ Főbb látnivalók a közelben:</p><ul class="rendezveny-lista">`;
        html += cel.latnivalok.map(l => `<li class="rendezveny-elem" style="cursor:default;"><div class="rendezveny-cim" style="font-size:13px;">• ${escapeHtml(l)}</div></li>`).join("");
        html += `</ul>`;
    }

    kontener.innerHTML = html;
}

// --- BEÉPÍTETT TÉRKÉP ÉS ÚTVONALTERVEZÉS (HA A terkep.js NEM LÉPETT MŰKÖDÉSBE) ---

function inicializalTerkepHaKell() {
    const terkepDiv = document.getElementById("terkep");
    if (!terkepDiv || typeof L === "undefined") return null;

    if (typeof terkep !== "undefined" && terkep && typeof terkep.setView === "function") {
        sajatTerkep = terkep;
        return sajatTerkep;
    }

    if (sajatTerkep) return sajatTerkep;

    if (!terkepDiv._leaflet_id) {
        const alapLat = aktualisIndulas ? aktualisIndulas.lat : 47.6366;
        const alapLng = aktualisIndulas ? aktualisIndulas.lng : 19.1386;
        sajatTerkep = L.map("terkep").setView([alapLat, alapLng], 8);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 18,
            attribution: '&copy; OpenStreetMap'
        }).addTo(sajatTerkep);
    }

    return sajatTerkep;
}

function kozepreTerkepPont(lat, lng, cim) {
    const map = inicializalTerkepHaKell();
    if (!map) return;
    map.setView([lat, lng], 11);
    if (sajatIndulasMarker) map.removeLayer(sajatIndulasMarker);
    sajatIndulasMarker = L.marker([lat, lng]).addTo(map).bindPopup(cim).openPopup();
}

async function tervezBeepitettUtvonal(indulas, cel) {
    const map = inicializalTerkepHaKell();
    if (!indulas || !cel) return;

    const tavAutoElem = document.getElementById("tav-auto");
    const tavSimaElem = document.getElementById("tav-sima");
    if (tavAutoElem) tavAutoElem.innerText = "Számítás...";
    if (tavSimaElem) tavSimaElem.innerText = "Számítás...";

    const legvonalKm = Math.round(tavolsagKm(indulas.lat, indulas.lng, cel.lat, cel.lng));

    try {
        const urlAuto = `https://router.project-osrm.org/route/v1/driving/${indulas.lng},${indulas.lat};${cel.lng},${cel.lat}?overview=full&geometries=geojson&steps=true`;
        const urlSima = `https://router.project-osrm.org/route/v1/driving/${indulas.lng},${indulas.lat};${cel.lng},${cel.lat}?overview=full&geometries=geojson&steps=true&exclude=motorway`;

        const [resAuto, resSima] = await Promise.all([
            fetch(urlAuto).then(r => r.json()).catch(() => null),
            fetch(urlSima).then(r => r.json()).catch(() => null)
        ]);

        const routeAuto = resAuto && resAuto.routes && resAuto.routes[0] ? resAuto.routes[0] : null;
        const routeSima = resSima && resSima.routes && resSima.routes[0] ? resSima.routes[0] : routeAuto;

        utolsoUtvonalAdatok = { auto: routeAuto, sima: routeSima };

        if (tavAutoElem) {
            tavAutoElem.innerText = routeAuto
                ? `${Math.round(routeAuto.distance / 1000)} km • ${formazIdotartam(routeAuto.duration)}`
                : `~${Math.round(legvonalKm * 1.2)} km`;
        }
        if (tavSimaElem) {
            tavSimaElem.innerText = routeSima
                ? `${Math.round(routeSima.distance / 1000)} km • ${formazIdotartam(routeSima.duration)}`
                : `~${Math.round(legvonalKm * 1.25)} km`;
        }

        megjelenitAktivBeepitettUtvonal(map, indulas, cel);
    } catch (e) {
        if (tavAutoElem) tavAutoElem.innerText = `~${Math.round(legvonalKm * 1.2)} km`;
        if (tavSimaElem) tavSimaElem.innerText = `~${Math.round(legvonalKm * 1.25)} km`;
        if (map) {
            const bounds = L.latLngBounds([[indulas.lat, indulas.lng], [cel.lat, cel.lng]]);
            map.fitBounds(bounds, { padding: [45, 45] });
        }
    }
}

function megjelenitAktivBeepitettUtvonal(map, indulas, cel) {
    if (!map) return;

    if (sajatIndulasMarker) map.removeLayer(sajatIndulasMarker);
    if (sajatCelMarker) map.removeLayer(sajatCelMarker);
    if (sajatUtvonalVonal) map.removeLayer(sajatUtvonalVonal);

    sajatIndulasMarker = L.marker([indulas.lat, indulas.lng]).addTo(map).bindPopup(`🚩 Indulás: <b>${escapeHtml(indulas.nev)}</b>`);
    const celPopup = kiemeltTalalkozoCel
        ? `🏍️ <b>${escapeHtml(kiemeltTalalkozoCel.nev)}</b><br>📍 ${escapeHtml(kiemeltTalalkozoCel.hely)}`
        : `🏁 Úti cél: <b>${escapeHtml(cel.nev)}</b>`;
    sajatCelMarker = L.marker([cel.lat, cel.lng]).addTo(map).bindPopup(celPopup).openPopup();

    const aktivRoute = utolsoUtvonalAdatok[aktualisUtMod] || utolsoUtvonalAdatok.auto;
    const osszegzoElem = document.getElementById("utvonal-osszegzo");
    const listaElem = document.getElementById("utvonal-lista");

    if (aktivRoute && aktivRoute.geometry) {
        const szin = aktualisUtMod === "auto" ? "#ff6b00" : "#22c55e";
        sajatUtvonalVonal = L.geoJSON(aktivRoute.geometry, {
            style: { color: szin, weight: 5, opacity: 0.9 }
        }).addTo(map);
        map.fitBounds(sajatUtvonalVonal.getBounds(), { padding: [45, 45] });

        const km = Math.round(aktivRoute.distance / 1000);
        const ido = formazIdotartam(aktivRoute.duration);
        if (osszegzoElem) {
            osszegzoElem.style.display = "block";
            osszegzoElem.innerHTML = `<b>${km} km</b> • ${ido} (${aktualisUtMod === "auto" ? "autópályával" : "autópálya nélkül"})`;
        }

        if (listaElem && aktivRoute.legs && aktivRoute.legs[0] && aktivRoute.legs[0].steps) {
            const lepesek = aktivRoute.legs[0].steps.filter(s => s.distance > 150);
            listaElem.innerHTML = lepesek.map((s, idx) => {
                const utNev = s.name || s.ref || "Folytasd az utat";
                const tav = s.distance >= 1000 ? `${(s.distance / 1000).toFixed(1)} km` : `${Math.round(s.distance)} m`;
                return `<div class="lepes-elem"><b>${idx + 1}.</b> ${escapeHtml(utNev)} <span style="color:#9ca3af;">(${tav})</span></div>`;
            }).join("");
        }
    } else {
        const bounds = L.latLngBounds([[indulas.lat, indulas.lng], [cel.lat, cel.lng]]);
        map.fitBounds(bounds, { padding: [45, 45] });
    }
}

if (typeof valasztUt !== "function") {
    window.valasztUt = function(mod) {
        aktualisUtMod = mod;
        const btnAuto = document.getElementById("btn-auto");
        const btnSima = document.getElementById("btn-sima");
        if (btnAuto) btnAuto.classList.toggle("aktiv", mod === "auto");
        if (btnSima) btnSima.classList.toggle("aktiv", mod === "sima");

        if (aktualisIndulas && aktualisCel && sajatTerkep) {
            megjelenitAktivBeepitettUtvonal(sajatTerkep, aktualisIndulas, aktualisCel);
        }
    };
}

if (typeof visszaTeljesUtvonalra !== "function") {
    window.visszaTeljesUtvonalra = function() {
        const visszaGomb = document.getElementById("btn-vissza-utvonal-bal");
        if (visszaGomb) visszaGomb.style.display = "none";
        if (sajatTerkep && sajatUtvonalVonal) {
            sajatTerkep.fitBounds(sajatUtvonalVonal.getBounds(), { padding: [45, 45] });
        }
    };
}

// --- ALKALMAZÁS INDÍTÁSA ---

document.addEventListener("click", function(e) {
    if (!e.target.closest(".combobox-doboz")) {
        ["indulas", "cel", "esemeny"].forEach(t => {
            const lista = document.getElementById(`${t}-lista`);
            if (lista) lista.classList.remove("nyitva");
        });
    }
});

function inditAlkalmazast() {
    if (typeof varosok !== "undefined" && Array.isArray(varosok) && varosok.length > 0) {
        const dunakeszi = varosok.find(v => ekezetNelkul(v.nev) === "dunakeszi") || varosok[0];
        aktualisIndulas = dunakeszi;
        const indulasInput = document.getElementById("indulas-input");
        if (indulasInput) indulasInput.value = dunakeszi.nev;
        const fejlecIndulas = document.getElementById("fejlec-indulas");
        if (fejlecIndulas) fejlecIndulas.innerText = dunakeszi.nev;
        renderVarosLegordulo("indulas", "");
        renderVarosLegordulo("cel", "");
    }

    if (typeof initTerkep === "function") {
        initTerkep();
    } else if (typeof inicializalTerkep === "function") {
        inicializalTerkep();
    } else {
        const map = inicializalTerkepHaKell();
        if (map && aktualisIndulas) {
            kozepreTerkepPont(aktualisIndulas.lat, aktualisIndulas.lng, `🚩 Indulás: ${aktualisIndulas.nev}`);
        }
    }

    if (typeof frissitOsszesRendezveny === "function") {
        frissitOsszesRendezveny();
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", inditAlkalmazast);
} else {
    inditAlkalmazast();
}
