// ============================================================================
// MOTOROS ESEMÉNYEK – FŐ ALKALMAZÁSLOGIKA (app.js)
// ============================================================================

// Biztonságos globális állapot-inicializálás (nem ütközik a terkep.js let változóival)
try { aktualisIndulas; } catch (e) { window.aktualisIndulas = null; }
try { aktualisCel; } catch (e) { window.aktualisCel = null; }
try { aktualisRendezvenyek; } catch (e) { window.aktualisRendezvenyek = []; }
try { kiemeltTalalkozoCel; } catch (e) { window.kiemeltTalalkozoCel = null; }
try { aktualisUtMod; } catch (e) { window.aktualisUtMod = "auto"; }

try { szurtIndulasLista; } catch (e) { window.szurtIndulasLista = []; }
try { szurtCelLista; } catch (e) { window.szurtCelLista = []; }
try { szurtEsemenyLista; } catch (e) { window.szurtEsemenyLista = []; }

try { sajatTerkep; } catch (e) { window.sajatTerkep = null; }
try { sajatIndulasMarker; } catch (e) { window.sajatIndulasMarker = null; }
try { sajatCelMarker; } catch (e) { window.sajatCelMarker = null; }
try { sajatUtvonalVonal; } catch (e) { window.sajatUtvonalVonal = null; }
try { sajatLepesMarker; } catch (e) { window.sajatLepesMarker = null; }
try { utolsoUtvonalAdatok; } catch (e) { window.utolsoUtvonalAdatok = { auto: null, sima: null }; }

// --- SEGÉDFÜGGVÉNYEK ---

function getVarosokLista() {
    if (typeof varosok !== "undefined" && Array.isArray(varosok) && varosok.length > 0) return varosok;
    if (typeof window !== "undefined" && Array.isArray(window.varosok) && window.varosok.length > 0) return window.varosok;
    // Tartalék keresés, ha a varosok.js más néven mentette a tömböt
    if (typeof window !== "undefined") {
        for (const kulcs of Object.keys(window)) {
            const val = window[kulcs];
            if (Array.isArray(val) && val.length > 50 && val[0] && typeof val[0].nev === "string" && typeof val[0].lat === "number") {
                window.varosok = val;
                return val;
            }
        }
    }
    return [];
}

function mentIndulasHelyet(pont) {
    if (!pont || !pont.nev || typeof pont.lat !== "number" || typeof pont.lng !== "number") return;
    try {
        localStorage.setItem("motoros_mentett_indulas_v1", JSON.stringify({
            nev: pont.nev,
            megye: pont.megye || "",
            rovidMegye: pont.rovidMegye || "",
            jaras: pont.jaras || "",
            irsz: pont.irsz || "",
            lakossag: pont.lakossag || "",
            terulet: pont.terulet || "",
            lat: pont.lat,
            lng: pont.lng,
            latnivalok: Array.isArray(pont.latnivalok) ? pont.latnivalok : []
        }));
    } catch (e) {}
}

function betoltMentettIndulast() {
    try {
        const nyers = localStorage.getItem("motoros_mentett_indulas_v1");
        if (!nyers) return null;
        const adat = JSON.parse(nyers);
        if (!adat || !adat.nev || typeof adat.lat !== "number" || typeof adat.lng !== "number") return null;

        const varosLista = getVarosokLista();
        if (varosLista.length > 0) {
            const egyezes = varosLista.find(v => ekezetNelkul(v.nev) === ekezetNelkul(adat.nev));
            if (egyezes) return egyezes;
        }
        return adat;
    } catch (e) {
        return null;
    }
}


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
    const lista = getVarosokLista();
    if (!szoveg || lista.length === 0) return null;
    const normSzoveg = ekezetNelkul(szoveg);
    if (!normSzoveg) return null;

    const elsoResz = ekezetNelkul(szoveg.split(",")[0].split("(")[0]);
    if (elsoResz) {
        const pontosElso = lista.find(v => ekezetNelkul(v.nev) === elsoResz);
        if (pontosElso) return pontosElso;
    }

    const rendezettVarosok = [...lista].sort((a, b) => b.nev.length - a.nev.length);

    for (const v of rendezettVarosok) {
        const normVaros = ekezetNelkul(v.nev);
        if (normVaros.length < 2) continue;
        const escaped = normVaros.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const minta = new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9]|ban|ben|on|en|ra|re|ba|be|nal|nel|bol|rol|hoz|hez|val|vel|i\\b)`);
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

function mutatLegordulo(listaElem) {
    if (!listaElem) return;
    listaElem.classList.add("nyitva", "aktiv");
    listaElem.style.setProperty("display", "block", "important");
    listaElem.style.setProperty("visibility", "visible", "important");
    listaElem.style.setProperty("opacity", "1", "important");
    listaElem.style.setProperty("pointer-events", "auto", "important");
    listaElem.style.setProperty("z-index", "9999", "important");
}

function elrejtLegordulo(listaElem) {
    if (!listaElem) return;
    listaElem.classList.remove("nyitva", "aktiv");
    listaElem.style.display = "none";
}

function nyitLista(tipus, mutatMind = false) {
    ["indulas", "cel", "esemeny"].forEach(t => {
        if (t !== tipus) {
            elrejtLegordulo(document.getElementById(`${t}-lista`));
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

    mutatLegordulo(listaElem);
}

function valtLista(tipus) {
    const listaElem = document.getElementById(`${tipus}-lista`);
    if (!listaElem) return;
    const nyitvaVan = listaElem.classList.contains("nyitva") || listaElem.style.display === "block";
    if (nyitvaVan) {
        elrejtLegordulo(listaElem);
    } else {
        nyitLista(tipus, true);
        const inputElem = document.getElementById(`${tipus}-input`);
        if (inputElem) inputElem.focus();
    }
}

function szurLista(tipus, kereses) {
    const listaElem = document.getElementById(`${tipus}-lista`);
    mutatLegordulo(listaElem);

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

    mutatLegordulo(document.getElementById(`${tipus}-lista`));
}

function renderVarosLegordulo(tipus, szuro = "") {
    const listaElem = document.getElementById(`${tipus}-lista`);
    const szamlaloElem = document.getElementById(`${tipus}-szamlalo`);
    if (!listaElem) return;

    const varosLista = getVarosokLista();
    if (varosLista.length === 0) {
        if (szamlaloElem) szamlaloElem.innerText = "0 település";
        listaElem.innerHTML = `<div class="combobox-ures">⚠️ A településlista (<b>varosok.js</b>) nem töltődött be. Ellenőrizd, hogy fent van-e a GitHubon!</div>`;
        return;
    }

    const normSzuro = ekezetNelkul(szuro);
    const talalatok = [];

    varosLista.forEach((v, idx) => {
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

    listaElem.innerHTML = talalatok.map(({ v, idx }) => {
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
    const listaElem = document.getElementById("esemeny-lista");
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
                    </div>
                    <span class="combobox-elem-nev">${escapeHtml(ev.nev)}</span>
                </div>
                <span class="combobox-elem-megye" style="max-width: 48%; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(ev.hely)}">📍 ${escapeHtml(ev.hely)}</span>
            </div>
        `;
    }).join("");
}

// --- PONT VÁLASZTÁSA (INDULÁS, CÉL, ESEMÉNY) ---

function valasztIndulasElem(varosIdx) {
    const varosLista = getVarosokLista();
    if (!varosLista[varosIdx]) return;
    aktualisIndulas = varosLista[varosIdx];
    mentIndulasHelyet(aktualisIndulas);

    const inputElem = document.getElementById("indulas-input");
    if (inputElem) inputElem.value = aktualisIndulas.nev;

    const fejlecIndulas = document.getElementById("fejlec-indulas");
    if (fejlecIndulas) fejlecIndulas.innerText = aktualisIndulas.nev;

    elrejtLegordulo(document.getElementById("indulas-lista"));

    frissitCsereGombAllapot();
    if (aktualisCel) {
        frissitKivalasztottCelNezet(true);
    } else {
        kozepreTerkepPont(aktualisIndulas.lat, aktualisIndulas.lng, `🚩 Indulás: ${aktualisIndulas.nev}`);
    }
}

function valasztCelElem(varosIdx, megtartTalalkozo = false) {
    const varosLista = getVarosokLista();
    if (!varosLista[varosIdx]) return;
    aktualisCel = varosLista[varosIdx];

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

    elrejtLegordulo(document.getElementById("cel-lista"));

    frissitCsereGombAllapot();
    frissitKivalasztottCelNezet(megtartTalalkozo);
}

function valasztEsemenyElem(kozelgoIdx) {
    if (typeof kozelgoEsemenyekLista === "undefined" || !kozelgoEsemenyekLista[kozelgoIdx]) return;
    const rend = kozelgoEsemenyekLista[kozelgoIdx];

    kiemeltTalalkozoCel = rend;
    const esemenyInput = document.getElementById("esemeny-input");
    if (esemenyInput) esemenyInput.value = rend.nev;

    elrejtLegordulo(document.getElementById("esemeny-lista"));

    const sav = document.getElementById("legkozelebbi-sav");
    if (sav) {
        sav.style.display = "block";
        sav.classList.remove("elmult-sav");
        sav.innerHTML = `🏍️ Kiválasztott esemény: <b>${escapeHtml(rend.nev)}</b><br>📅 ${escapeHtml(rend.datum)} • 📍 ${escapeHtml(rend.hely)}`;
    }

    const varosLista = getVarosokLista();
    let varosIdx = -1;
    if (varosLista.length > 0) {
        if (rend.varosNev) {
            varosIdx = varosLista.findIndex(v => ekezetNelkul(v.nev) === ekezetNelkul(rend.varosNev));
        }
        if (varosIdx === -1 && rend.hely) {
            const helyVaros = rend.hely.split(",")[0].split("(")[0].trim();
            varosIdx = varosLista.findIndex(v => ekezetNelkul(v.nev) === ekezetNelkul(helyVaros));
        }
        if (varosIdx === -1) {
            let minTav = Infinity;
            varosLista.forEach((v, idx) => {
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
    mentIndulasHelyet(aktualisIndulas);

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

    const varosLista = getVarosokLista();
    if (varosLista.length > 0) {
        const pontosIdx = varosLista.findIndex(v => ekezetNelkul(v.nev) === ekezetNelkul(kereses));
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

        elrejtLegordulo(document.getElementById(`${tipus}-lista`));

        if (tipus === "indulas") {
            aktualisIndulas = egyediPont;
            mentIndulasHelyet(aktualisIndulas);
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

function hasznalSajatHelyzetet() {
    if (!navigator.geolocation) {
        alert("A böngésződ nem támogatja a GPS-alapú helymeghatározást.");
        return;
    }

    const gombElem = document.getElementById("btn-gps-indulas");
    const eredetiSzoveg = gombElem ? gombElem.innerText : "";
    if (gombElem) {
        gombElem.disabled = true;
        gombElem.innerText = "⏳ Helyzet lekérése...";
    }

    navigator.geolocation.getCurrentPosition(
        async (pozicio) => {
            const lat = pozicio.coords.latitude;
            const lng = pozicio.coords.longitude;
            let talaltPont = null;

            try {
                const controller = new AbortController();
                const id = setTimeout(() => controller.abort(), 5000);
                const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10`;
                const res = await fetch(url, {
                    headers: { "Accept-Language": "hu" },
                    signal: controller.signal
                });
                clearTimeout(id);
                if (res.ok) {
                    const adat = await res.json();
                    const addr = adat && adat.address ? adat.address : {};
                    const telepulesNev = addr.city || addr.town || addr.village || addr.municipality || addr.suburb;
                    if (telepulesNev) {
                        const varosLista = getVarosokLista();
                        const egyezes = varosLista.find(v => ekezetNelkul(v.nev) === ekezetNelkul(telepulesNev));
                        if (egyezes) {
                            talaltPont = egyezes;
                        } else {
                            talaltPont = {
                                nev: telepulesNev,
                                megye: addr.county || "Magyarország",
                                rovidMegye: "HU",
                                lat: lat,
                                lng: lng
                            };
                        }
                    }
                }
            } catch (e) {}

            if (!talaltPont) {
                const varosLista = getVarosokLista();
                if (varosLista.length > 0) {
                    let legkozelebbi = varosLista[0];
                    let minTav = Infinity;
                    for (const v of varosLista) {
                        const t = tavolsagKm(lat, lng, v.lat, v.lng);
                        if (t < minTav) {
                            minTav = t;
                            legkozelebbi = v;
                        }
                    }
                    talaltPont = minTav <= 8
                        ? legkozelebbi
                        : {
                            nev: `${legkozelebbi.nev} környéke`,
                            megye: legkozelebbi.megye || "Magyarország",
                            rovidMegye: legkozelebbi.rovidMegye || "HU",
                            lat: lat,
                            lng: lng
                        };
                } else {
                    talaltPont = {
                        nev: "Sajat helyzetem",
                        megye: "Magyarország",
                        rovidMegye: "HU",
                        lat: lat,
                        lng: lng
                    };
                }
            }

            aktualisIndulas = talaltPont;
            mentIndulasHelyet(aktualisIndulas);

            const inputElem = document.getElementById("indulas-input");
            if (inputElem) inputElem.value = aktualisIndulas.nev;

            const fejlecIndulas = document.getElementById("fejlec-indulas");
            if (fejlecIndulas) fejlecIndulas.innerText = aktualisIndulas.nev;

            elrejtLegordulo(document.getElementById("indulas-lista"));
            frissitCsereGombAllapot();

            if (aktualisCel) {
                frissitKivalasztottCelNezet(true);
            } else {
                kozepreTerkepPont(aktualisIndulas.lat, aktualisIndulas.lng, `📡 Kiindulópont: ${aktualisIndulas.nev}`);
            }

            if (gombElem) {
                gombElem.disabled = false;
                gombElem.innerText = eredetiSzoveg;
            }
        },
        () => {
            if (gombElem) {
                gombElem.disabled = false;
                gombElem.innerText = eredetiSzoveg;
            }
            alert("Nem sikerült lekérni a jelenlegi helyzetedet. Ellenőrizd, hogy engedélyezve van-e a helymeghatározás a böngészőben!");
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
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
        const indulasNev = aktualisIndulas ? aktualisIndulas.nev : "Budapest";
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

    if (!aktualisIndulas) {
        const mentett = betoltMentettIndulast();
        if (mentett) {
            aktualisIndulas = mentett;
        } else {
            const varosLista = getVarosokLista();
            if (varosLista.length > 0) {
                aktualisIndulas = varosLista.find(v => ekezetNelkul(v.nev) === "budapest") || varosLista[0];
            }
        }
    }

    window.aktualisIndulas = aktualisIndulas;
    window.aktualisCel = aktualisCel;
    window.kiemeltTalalkozoCel = kiemeltTalalkozoCel;

    const btnSima = document.getElementById("btn-sima");
    const aktivMod = (btnSima && btnSima.classList.contains("aktiv")) ? "sima" : (aktualisUtMod || "auto");

    let terkepKezelte = false;
    const terkepFuggvenyek = [
        "tervezUtvonal", "tervezUtvonalat", "tervezUtvonalakat",
        "frissitUtvonal", "frissitUtvonalat", "frissitUtvonalakat",
        "frissitTerkepUtvonal", "szamolUtvonal", "szamolUtvonalat",
        "szamolUtvonalakat", "inditUtvonalTervezest", "utvonalTervezes", "tervezUtakat"
    ];

    for (const fnNev of terkepFuggvenyek) {
        if (typeof window[fnNev] === "function") {
            try {
                window[fnNev](aktualisIndulas, aktualisCel, kiemeltTalalkozoCel);
                terkepKezelte = true;
                break;
            } catch (e) {}
        }
    }

    if (typeof valasztUt === "function") {
        try {
            valasztUt(aktivMod);
            terkepKezelte = true;
        } catch (e) {}
    }

    if (!terkepKezelte) {
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

// --- BEÉPÍTETT TÉRKÉP ÉS ÚTVONALTERVEZÉS ---

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
    if (map) {
        if (sajatIndulasMarker) map.removeLayer(sajatIndulasMarker);
        if (sajatCelMarker) map.removeLayer(sajatCelMarker);
        if (sajatUtvonalVonal) map.removeLayer(sajatUtvonalVonal);

        sajatIndulasMarker = L.marker([indulas.lat, indulas.lng]).addTo(map).bindPopup(`🚩 Indulás: <b>${escapeHtml(indulas.nev)}</b>`);
        const celPopup = kiemeltTalalkozoCel
            ? `🏍️ <b>${escapeHtml(kiemeltTalalkozoCel.nev)}</b><br>📍 ${escapeHtml(kiemeltTalalkozoCel.hely)}`
            : `🏁 Úti cél: <b>${escapeHtml(cel.nev)}</b>`;
        sajatCelMarker = L.marker([cel.lat, cel.lng]).addTo(map).bindPopup(celPopup).openPopup();
    }

    const aktivRoute = utolsoUtvonalAdatok[aktualisUtMod] || utolsoUtvonalAdatok.auto;
    const osszegzoElem = document.getElementById("utvonal-osszegzo");
    const listaElem = document.getElementById("utvonal-lista");

    if (aktivRoute && aktivRoute.geometry) {
        if (map) {
            const szin = aktualisUtMod === "auto" ? "#ff6b00" : "#22c55e";
            sajatUtvonalVonal = L.geoJSON(aktivRoute.geometry, {
                style: { color: szin, weight: 5, opacity: 0.9 }
            }).addTo(map);
            map.fitBounds(sajatUtvonalVonal.getBounds(), { padding: [45, 45] });
        }

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
            elrejtLegordulo(document.getElementById(`${t}-lista`));
        });
    }
});

function inditAlkalmazast() {
    const varosLista = getVarosokLista();
    const mentettIndulas = betoltMentettIndulast();
    if (mentettIndulas) {
        aktualisIndulas = mentettIndulas;
    } else if (varosLista.length > 0) {
        aktualisIndulas = varosLista.find(v => ekezetNelkul(v.nev) === "budapest") || varosLista[0];
    }

    if (aktualisIndulas) {
        const indulasInput = document.getElementById("indulas-input");
        if (indulasInput) indulasInput.value = aktualisIndulas.nev;
        const fejlecIndulas = document.getElementById("fejlec-indulas");
        if (fejlecIndulas) fejlecIndulas.innerText = aktualisIndulas.nev;
    }

    renderVarosLegordulo("indulas", "");
    renderVarosLegordulo("cel", "");

    try {
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
    } catch (e) {
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
