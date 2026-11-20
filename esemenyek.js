// --- 1. LÉPÉS: A GOOGLE TÁBLÁZATBÓL KÖZZÉTETT CSV LINK (Az űrlap válaszok) ---
const GOOGLE_SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ43JAhbtm-5Ga3P_248iizag7emZJOeeREPYFgPyI1F7GK0_xAeOjJoHkSyt2Xd9IEq6g1FpA4PlTW/pub?gid=1851516518&single=true&output=csv";

let osszesRendezveny = [];
let kozelgoEsemenyekLista = [];
let elmultEsemenyekLista = [];
let elmultSzuroMod = "osszes";

const honapKulcsok = [
    ["január", "jan."], ["február", "febr.", "feb."], ["március", "márc."],
    ["április", "ápr."], ["május", "máj."], ["június", "jún."],
    ["július", "júl."], ["augusztus", "aug."], ["szeptember", "szept.", "szep."],
    ["október", "okt."], ["november", "nov."], ["december", "dec."]
];

function getForrasOsztaly() { return " sa"; }
function getForrasSzin() { return "#fbbf24"; }

function elemzesEsemenyDatum(datumStr) {
    if (!datumStr) return null;
    const norm = datumStr.toLowerCase();
    const ma = new Date();
    ma.setHours(0, 0, 0, 0);
    const aktualisEv = ma.getFullYear();

    const szamosMatch = norm.match(/\b(20\d{2})\s*[.-]\s*(\d{1,2})\s*[.-]\s*(\d{1,2})\.?(?:\s*[–-]\s*(?:(20\d{2})\s*[.-]\s*)?(?:(\d{1,2})\s*[.-]\s*)?(\d{1,2})\.?)?/);
    if (szamosMatch) {
        const ev = parseInt(szamosMatch[1], 10);
        const ho = parseInt(szamosMatch[2], 10) - 1;
        const nap = parseInt(szamosMatch[3], 10);
        if (ho >= 0 && ho <= 11 && nap >= 1 && nap <= 31) {
            const start = new Date(ev, ho, nap);
            const endEv = szamosMatch[4] ? parseInt(szamosMatch[4], 10) : ev;
            const endHo = szamosMatch[5] ? parseInt(szamosMatch[5], 10) - 1 : ho;
            const endNap = szamosMatch[6] ? parseInt(szamosMatch[6], 10) : nap;
            return { start, end: new Date(endEv, endHo, endNap) };
        }
    }

    let honapIdx = -1;
    let talaltKulcs = "";
    for (let i = 0; i < honapKulcsok.length; i++) {
        for (const kulcs of honapKulcsok[i]) {
            if (norm.includes(kulcs)) {
                honapIdx = i;
                talaltKulcs = kulcs;
                break;
            }
        }
        if (honapIdx !== -1) break;
    }
    if (honapIdx === -1) return null;

    const evTalalat = norm.match(/\b(20\d{2})\b/);
    const vanExplicitEv = Boolean(evTalalat);
    let ev = vanExplicitEv ? parseInt(evTalalat[1], 10) : aktualisEv;
    const honapUtaniResz = norm.split(talaltKulcs)[1] || "";

    if (honapUtaniResz.includes("első szombat")) {
        const szamolElsoSzombat = (y) => {
            const elsoNap = new Date(y, honapIdx, 1);
            const eltolas = (6 - elsoNap.getDay() + 7) % 7;
            return new Date(y, honapIdx, 1 + eltolas);
        };
        let szombat = szamolElsoSzombat(ev);
        if (!vanExplicitEv && szombat < ma) szombat = szamolElsoSzombat(ev + 1);
        return { start: szombat, end: new Date(szombat) };
    }

    const napRangeTalalat = honapUtaniResz.match(/(\d{1,2})(?:\s*[–-]\s*(\d{1,2}))?/);
    if (napRangeTalalat) {
        const startNap = parseInt(napRangeTalalat[1], 10);
        const endNap = napRangeTalalat[2] ? parseInt(napRangeTalalat[2], 10) : startNap;
        let start = new Date(ev, honapIdx, startNap);
        let end = new Date(ev, honapIdx, endNap);
        if (!vanExplicitEv && end < ma) {
            start = new Date(ev + 1, honapIdx, startNap);
            end = new Date(ev + 1, honapIdx, endNap);
        }
        return { start, end };
    }

    let start = new Date(ev, honapIdx, 1);
    let end = new Date(ev, honapIdx + 1, 0);
    if (!vanExplicitEv && end < ma) {
        start = new Date(ev + 1, honapIdx, 1);
        end = new Date(ev + 1, honapIdx + 1, 0);
    }
    return { start, end };
}

function frissitRendezettEsemenyeket() {
    const ma = new Date();
    ma.setHours(0, 0, 0, 0);

    const kozelgo = [];
    const elmult = [];

    for (const r of osszesRendezveny) {
        const datumInfo = elemzesEsemenyDatum(r.datum);
        const isElmult = Boolean(r.korabbi) || (datumInfo !== null && datumInfo.end < ma);
        const elem = {
            ...r,
            datumObj: datumInfo ? datumInfo.start : null,
            datumVegeObj: datumInfo ? datumInfo.end : null,
            isElmult,
            rendezesiIdo: datumInfo ? datumInfo.start.getTime() : Number.MAX_SAFE_INTEGER
        };

        if (isElmult) elmult.push(elem);
        else kozelgo.push(elem);
    }

    kozelgo.sort((a, b) => a.rendezesiIdo - b.rendezesiIdo);
    elmult.sort((a, b) => b.rendezesiIdo - a.rendezesiIdo);

    kozelgoEsemenyekLista = kozelgo;
    elmultEsemenyekLista = elmult;

    const esemenyInput = document.getElementById("esemeny-input");
    const szuro = (esemenyInput && kiemeltTalalkozoCel && esemenyInput.value.trim() === kiemeltTalalkozoCel.nev)
        ? ""
        : (esemenyInput ? esemenyInput.value : "");
    if (typeof renderEsemenyLegordulo === "function") renderEsemenyLegordulo(szuro);
    if (typeof renderElmultRendezvenyek === "function") renderElmultRendezvenyek();
}

function valtElmultSzuro(mod) {
    elmultSzuroMod = mod;
    document.getElementById("btn-elmult-osszes").classList.toggle("aktiv", mod === "osszes");
    document.getElementById("btn-elmult-kozel").classList.toggle("aktiv", mod === "kozel");
    if (typeof renderElmultRendezvenyek === "function") renderElmultRendezvenyek();
}

function renderElmultRendezvenyek() {
    const kontener = document.getElementById("elmult-rendezvenyek-tartalom");
    const szamlalo = document.getElementById("elmult-szamlalo");
    const szuroSav = document.getElementById("elmult-szuro-sav");
    if (!kontener) return;

    if (aktualisCel && szuroSav) szuroSav.style.display = "flex";
    else if (szuroSav) szuroSav.style.display = "none";

    let lista = elmultEsemenyekLista.map((ev, eredetiIdx) => ({
        ...ev,
        eredetiIdx,
        tavKm: aktualisCel ? Math.round(tavolsagKm(aktualisCel.lat, aktualisCel.lng, ev.lat, ev.lng)) : null
    }));

    if (aktualisCel && elmultSzuroMod === "kozel") {
        lista = lista.filter(ev => ev.tavKm !== null && ev.tavKm <= 20);
    }

    if (szamlalo) szamlalo.innerText = `${lista.length} esemény`;

    if (lista.length === 0) {
        kontener.innerHTML = aktualisCel && elmultSzuroMod === "kozel"
            ? `<p class="ures-allapot">${aktualisCel.nev} 20 km-es körzetében nincs rögzített elmúlt esemény.</p>`
            : `<p class="ures-allapot">Jelenleg nincs elmúlt esemény a listában.</p>`;
        return;
    }

    const listaHtml = lista.map((rend) => {
        const tavSzoveg = rend.tavKm !== null ? ` (${rend.tavKm === 0 ? "helyben" : rend.tavKm + " km"})` : "";
        const isKiemelt = kiemeltTalalkozoCel && kiemeltTalalkozoCel.nev === rend.nev;

        return `
            <li class="rendezveny-elem elmult-elem${isKiemelt ? ' aktiv' : ''}" onclick="mutatElmultRendezveny(${rend.eredetiIdx})">
                <div class="rendezveny-cim">${rend.nev}</div>
                <div class="rendezveny-meta">
                    <span>📅 <b>${rend.datum}</b> (lezajlott)</span>
                    <span>📍 ${rend.hely}${tavSzoveg}</span>
                    <span class="elo-jelveny sa">👥 Közösségi naptár</span>
                </div>
            </li>
        `;
    }).join("");

    kontener.innerHTML = `<ul class="rendezveny-lista">${listaHtml}</ul>`;
}

function mutatElmultRendezveny(elmultIdx) {
    const rend = elmultEsemenyekLista[elmultIdx];
    if (!rend) return;

    let varosIdx = -1;
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
    if (varosIdx === -1) return;

    kiemeltTalalkozoCel = rend;
    const esemenyInput = document.getElementById("esemeny-input");
    if (esemenyInput) esemenyInput.value = "";

    const sav = document.getElementById("legkozelebbi-sav");
    if (sav) {
        sav.style.display = "block";
        sav.classList.add("elmult-sav");
        sav.innerHTML = `📜 Ez történt eddig: <b>${rend.nev}</b><br>📅 ${rend.datum} (lezajlott esemény) • 📍 ${rend.hely}`;
    }

    if (typeof valasztCelElem === "function") valasztCelElem(varosIdx, true);
    renderElmultRendezvenyek();
}

function frissitMotorosRendezvenyek(cel) {
    const feldolgozott = kozelgoEsemenyekLista.map(r => ({
        ...r, tavKm: Math.round(tavolsagKm(cel.lat, cel.lng, r.lat, r.lng))
    }));

    const kozeli = feldolgozott.filter(r => r.tavKm <= 20).sort((a, b) => a.tavKm - b.tavKm);
    let megjegyzes = "Kattints egy közelgő eseményre a helyszín térképes megtekintéséhez:";

    if (kozeli.length > 0) {
        aktualisRendezvenyek = kozeli;
    } else {
        aktualisRendezvenyek = feldolgozott.sort((a, b) => a.tavKm - b.tavKm).slice(0, 3);
        megjegyzes = "20 km-en belül nincs közelgő találkozó, a legközelebbi régiós események:";
    }

    if (aktualisRendezvenyek.length === 0) {
        document.getElementById("motoros-rendezvenyek-tartalom").innerHTML = `<p class="ures-allapot">Jelenleg nincs közelgő motoros találkozó a naptárban. Kattints a <b>➕ Beküldés</b> gombra, ha tudsz egyről!</p>`;
        return;
    }

    const listaHtml = aktualisRendezvenyek.map((rend, index) => {
        const isKiemelt = kiemeltTalalkozoCel && kiemeltTalalkozoCel.nev === rend.nev;
        return `
            <li class="rendezveny-elem${isKiemelt ? ' aktiv' : ''}" id="rend-elem-${index}" onclick="mutatRendezveny(${index})">
                <div class="rendezveny-cim">${rend.nev}</div>
                <div class="rendezveny-meta">
                    <span>📅 <b>${rend.datum}</b></span>
                    <span>📍 ${rend.hely} (${rend.tavKm === 0 ? "helyben" : rend.tavKm + " km"})</span>
                    <span class="elo-jelveny sa">👥 Közösségi naptár</span>
                </div>
            </li>
        `;
    }).join("");

    document.getElementById("motoros-rendezvenyek-tartalom").innerHTML = `<p class="nevezetessegek-tipp">${megjegyzes}</p><ul class="rendezveny-lista">${listaHtml}</ul>`;
}

function parseCsvSor(sor, elvalaszto) {
    const eredmeny = [];
    let aktualis = "";
    let idezojelben = false;

    for (let i = 0; i < sor.length; i++) {
        const kar = sor[i];
        if (kar === '"') {
            if (idezojelben && sor[i + 1] === '"') {
                aktualis += '"';
                i++;
            } else {
                idezojelben = !idezojelben;
            }
        } else if (kar === elvalaszto && !idezojelben) {
            eredmeny.push(aktualis.trim());
            aktualis = "";
        } else {
            aktualis += kar;
        }
    }
    eredmeny.push(aktualis.trim());
    return eredmeny;
}

function feldolgozCsvSzoveget(csvSzoveg) {
    const sorok = (csvSzoveg || "").replace(/^\uFEFF/, "").split(/\r?\n/).filter(s => s.trim().length > 0);
    const csvEsemenyek = [];

    if (sorok.length > 1) {
        const elvalaszto = sorok[0].includes(";") ? ";" : ",";

        for (let i = 1; i < sorok.length; i++) {
            const mezok = parseCsvSor(sorok[i], elvalaszto);
            
            // A Google Űrlap automatikusan betesz egy "Időbélyeg" oszlopot előre (0. index).
            // Ezt figyelembe vesszük egy +1 eltolással, ha létezik (mezok hossza alapján).
            const eltolas = mezok.length >= 5 ? 1 : 0;

            if (mezok.length >= 4 + eltolas && mezok[0 + eltolas]) {
                const nev = (mezok[0 + eltolas] || "").replace(/^["']|["']$/g, '');
                const datum = (mezok[1 + eltolas] || "").replace(/^["']|["']$/g, '');
                const idopont = (mezok[2 + eltolas] || "").replace(/^["']|["']$/g, '');
                const hely = (mezok[3 + eltolas] || "").replace(/^["']|["']$/g, '');

                const teljesDatum = idopont ? `${datum} (${idopont})` : datum;
                const varosTalalat = typeof keresHelyszintSzovegben === "function"
                    ? (keresHelyszintSzovegben(hely) || keresHelyszintSzovegben(nev))
                    : null;

                csvEsemenyek.push({
                    nev: nev,
                    datum: teljesDatum,
                    hely: varosTalalat ? `${varosTalalat.nev} (${varosTalalat.rovidMegye})` : hely,
                    varosNev: varosTalalat ? varosTalalat.nev : "Budapest",
                    lat: varosTalalat ? varosTalalat.lat : 47.4979,
                    lng: varosTalalat ? varosTalalat.lng : 19.0402,
                    forras: "saját",
                    url: "",
                    korabbi: false
                });
            }
        }
    }

    osszesRendezveny = csvEsemenyek;
    frissitRendezettEsemenyeket();

    if (typeof aktualisCel !== "undefined" && aktualisCel) {
        if (typeof frissitMotorosRendezvenyek === "function") frissitMotorosRendezvenyek(aktualisCel);
        if (typeof renderElmultRendezvenyek === "function") renderElmultRendezvenyek();
    }

    return csvEsemenyek.length;
}

// Automatikus Google Táblázat CSV betöltés
async function frissitOsszesRendezveny() {
    const allapotDoboz = document.getElementById("forras-allapot");
    const frissitGomb = document.getElementById("btn-frissit-rendezvenyek");

    if (frissitGomb) frissitGomb.disabled = true;
    if (allapotDoboz) {
        allapotDoboz.classList.remove("sikeres");
        allapotDoboz.innerText = "⏳ Események letöltése a Google felhőből...";
    }

    try {
        if (!GOOGLE_SHEET_CSV_URL || GOOGLE_SHEET_CSV_URL.includes("IDE_MASOLD")) {
            throw new Error("Nincs megadva a Google Sheets CSV link.");
        }

        // Random paraméter a gyorsítótár elkerülésére, hogy mindig a legfrissebb választ kapjuk
        const url = GOOGLE_SHEET_CSV_URL + (GOOGLE_SHEET_CSV_URL.includes('?') ? '&' : '?') + 't=' + new Date().getTime();
        
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) throw new Error("Nem elérhető a Google Táblázat.");

        const csvSzoveg = await response.text();
        const db = feldolgozCsvSzoveget(csvSzoveg);

        const ido = new Date().toLocaleTimeString("hu-HU", { hour: "2-digit", minute: "2-digit" });
        if (allapotDoboz) {
            allapotDoboz.classList.add("sikeres");
            allapotDoboz.innerHTML = `🟢 Naptár szinkronizálva (${ido}): <b>${db} esemény</b>`;
        }
    } catch (err) {
        if (allapotDoboz) {
            allapotDoboz.innerHTML = `⚠️ Hiba a letöltésnél. Ellenőrizd a CSV linket az <b>esemenyek.js</b> fájl tetején!`;
        }
    } finally {
        if (frissitGomb) frissitGomb.disabled = false;
    }
}