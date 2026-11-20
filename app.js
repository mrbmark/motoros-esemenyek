if (typeof osszesVarosNyers === "undefined") {
    const megyeElem = document.getElementById("megye");
    if (megyeElem) {
        megyeElem.innerHTML = `<span style="color:#fca5a5;">⚠️ Hiányzik a <b>varosok.js</b> fájl! Helyezd ugyanabba a mappába az <b>index.html</b> mellé.</span>`;
    }
}

const hivatalosVarosObjektumok = (typeof osszesVarosNyers !== "undefined" ? osszesVarosNyers : []).map(item => {
    const isBudapest = item[0] === "Budapest" || item[1] === "Főváros";
    return {
        nev: item[0],
        tipus: isBudapest ? "főváros" : "város",
        megye: isBudapest ? "Főváros (Budapest)" : `${item[1]} vármegye`,
        rovidMegye: isBudapest ? "Főváros" : item[1],
        jaras: item[2],
        iranyitoszam: item[3],
        lat: item[4],
        lng: item[5],
        terulet: item[6],
        lakossag: item[7]
    };
});

const varosok = [...hivatalosVarosObjektumok, ...(typeof extraMotorosHelyek !== "undefined" ? extraMotorosHelyek : [])]
    .sort((a, b) => a.nev.localeCompare(b.nev, "hu"));

const dunakesziAlapIdx = varosok.findIndex(v => v.nev === "Dunakeszi");
let aktualisIndulas = dunakesziAlapIdx !== -1
    ? varosok[dunakesziAlapIdx]
    : (varosok[0] || { nev: "Dunakeszi", megye: "Pest vármegye", lat: 47.6333, lng: 19.1333 });
let aktualisCel = null;
let kiemeltTalalkozoCel = null;

function ekezetNelkul(szoveg) {
    return (szoveg || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function tavolsagKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

const varosKeresoMintak = varosok
    .slice()
    .sort((a, b) => b.nev.length - a.nev.length)
    .map(v => {
        const escaped = v.nev.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const variansok = [escaped];
        if (v.nev.endsWith("a")) variansok.push(escaped.slice(0, -1) + "á");
        else if (v.nev.endsWith("e")) variansok.push(escaped.slice(0, -1) + "é");
        else if (v.nev.endsWith("o")) variansok.push(escaped.slice(0, -1) + "ó");
        else if (v.nev.endsWith("ö")) variansok.push(escaped.slice(0, -1) + "ő");

        const alap = `(?:${variansok.join("|")})`;
        const ragok = `(?:n|on|en|ön|an|ban|ben|ra|re|ba|be|ról|ről|ból|ből|tól|től|nak|nek|nál|nél|hoz|hez|höz|ig|val|vel|kor|i|iak|iek)?`;
        const flags = v.nev.length <= 4 ? "" : "i";
        const regex = new RegExp(`(?:^|[\\s,.;:!?()„"–-])(${alap}${ragok})(?:$|[\\s,.;:!?()„"–-])`, flags);
        return { varos: v, regex };
    });

const tajegysegHelyszinek = [
    { minta: /\bvelencei-t[óo]/i, varosNev: "Velence" },
    { minta: /\btisza-t[óo]/i, varosNev: "Tiszafüred" },
    { minta: /\bbalaton(?:i|on|ra|ról|hoz)?\b/i, varosNev: "Balatonfüred" },
    { minta: /\bdunakanyar/i, varosNev: "Visegrád" },
    { minta: /\bbörzsöny/i, varosNev: "Nagymaros" },
    { minta: /\bmátr[aá]/i, varosNev: "Mátrafüred" },
    { minta: /\bbükk(?:i|ben|be)?\b/i, varosNev: "Lillafüred" },
    { minta: /\bbakony/i, varosNev: "Zirc" },
    { minta: /\bmecsek/i, varosNev: "Pécs" },
    { minta: /\bőrség/i, varosNev: "Őriszentpéter" },
    { minta: /\bzemplén/i, varosNev: "Sárospatak" },
    { minta: /\bpilis/i, varosNev: "Dobogókő" },
    { minta: /\bvértes/i, varosNev: "Tata" },
    { minta: /\bbadacsony/i, varosNev: "Badacsonytomaj" },
    { minta: /\bsóstó/i, varosNev: "Nyíregyháza" },
    { minta: /\bfertő-t[óo]/i, varosNev: "Fertőd" }
];

function keresHelyszintSzovegben(szoveg) {
    for (const minta of varosKeresoMintak) {
        if (minta.regex.test(szoveg)) return minta.varos;
    }
    for (const taj of tajegysegHelyszinek) {
        if (taj.minta.test(szoveg)) {
            const talalt = varosok.find(v => v.nev === taj.varosNev);
            if (talalt) return talalt;
        }
    }
    return null;
}

// --- EGYEDI SÖTÉT TÉMÁJÚ LEGÖRDÜLŐ LISTÁK ---
function renderLegordulo(tipus, szuroSzoveg = "") {
    if (tipus === "esemeny") {
        renderEsemenyLegordulo(szuroSzoveg);
        return;
    }

    const isIndulas = tipus === "indulas";
    const listaElem = document.getElementById(isIndulas ? "indulas-lista" : "cel-lista");
    const szamlaloElem = document.getElementById(isIndulas ? "indulas-szamlalo" : "cel-szamlalo");
    const egyebBtn = document.getElementById(isIndulas ? "btn-egyeb-indulas" : "btn-egyeb-telepules");
    const aktivObj = isIndulas ? aktualisIndulas : aktualisCel;

    const keresettNyers = (szuroSzoveg || "").trim();
    const keresettNorm = ekezetNelkul(keresettNyers);

    const talalatok = varosok
        .map((v, idx) => ({ v, idx }))
        .filter(({ v }) =>
            !keresettNorm ||
            ekezetNelkul(v.nev).includes(keresettNorm) ||
            ekezetNelkul(v.megye).includes(keresettNorm) ||
            ekezetNelkul(v.jaras).includes(keresettNorm)
        );

    if (szamlaloElem) {
        szamlaloElem.innerText = keresettNorm ? `${talalatok.length} találat` : `${varosok.length} település`;
    }

    if (talalatok.length === 0) {
        listaElem.innerHTML = `<div class="combobox-ures">Nincs találat a listában: „${keresettNyers}”</div>`;
        if (egyebBtn && keresettNyers.length >= 2) {
            egyebBtn.style.display = "inline-block";
            egyebBtn.innerText = `📍 „${keresettNyers}” betöltése településként a térképen`;
        }
    } else {
        if (egyebBtn) egyebBtn.style.display = "none";
        const fnNev = isIndulas ? "valasztIndulasElem" : "valasztCelElem";
        listaElem.innerHTML = talalatok.map(({ v, idx }) => {
            const isSelected = aktivObj && aktivObj.nev === v.nev && aktivObj.lat === v.lat;
            return `
                <div class="combobox-elem${isSelected ? " kivalasztva" : ""}" onmousedown="event.preventDefault(); ${fnNev}(${idx})">
                    <span class="combobox-elem-nev">${v.nev}</span>
                    <span class="combobox-elem-megye">${v.rovidMegye}</span>
                </div>
            `;
        }).join("");
    }
}

function renderEsemenyLegordulo(szuroSzoveg = "") {
    const listaElem = document.getElementById("esemeny-lista");
    const szamlaloElem = document.getElementById("esemeny-szamlalo");
    if (!listaElem) return;

    const keresettNyers = (szuroSzoveg || "").trim();
    const keresettNorm = ekezetNelkul(keresettNyers);

    const talalatok = kozelgoEsemenyekLista
        .map((ev, idx) => ({ ev, idx }))
        .filter(({ ev }) =>
            !keresettNorm ||
            ekezetNelkul(ev.nev).includes(keresettNorm) ||
            ekezetNelkul(ev.datum).includes(keresettNorm) ||
            ekezetNelkul(ev.hely).includes(keresettNorm)
        );

    if (szamlaloElem) {
        szamlaloElem.innerText = keresettNorm ? `${talalatok.length} találat` : `${kozelgoEsemenyekLista.length} közelgő esemény`;
    }

    if (talalatok.length === 0) {
        listaElem.innerHTML = `<div class="combobox-ures">Nincs ilyen közelgő motoros esemény: „${keresettNyers}”</div>`;
        return;
    }

    listaElem.innerHTML = talalatok.map(({ ev, idx }) => {
        const isSelected = kiemeltTalalkozoCel && kiemeltTalalkozoCel.nev === ev.nev;
        const helyRovid = (ev.hely || "").split(",")[0];
        return `
            <div class="combobox-elem${isSelected ? " kivalasztva" : ""}" onmousedown="event.preventDefault(); valasztEsemenyElem(${idx})">
                <div class="combobox-elem-bal">
                    <div class="combobox-elem-datum-sor">
                        <span>📅 ${ev.datum}</span>
                        <span class="dropdown-forras-pill">saját</span>
                    </div>
                    <span class="combobox-elem-nev">${ev.nev}</span>
                </div>
                <span class="combobox-elem-megye">📍 ${helyRovid}</span>
            </div>
        `;
    }).join("");
}

function getListaElemek(tipus) {
    if (tipus === "indulas") return { input: document.getElementById("indulas-input"), lista: document.getElementById("indulas-lista"), aktivNev: aktualisIndulas ? aktualisIndulas.nev : "" };
    if (tipus === "cel") return { input: document.getElementById("cel-input"), lista: document.getElementById("cel-lista"), aktivNev: aktualisCel ? aktualisCel.nev : "" };
    return { input: document.getElementById("esemeny-input"), lista: document.getElementById("esemeny-lista"), aktivNev: kiemeltTalalkozoCel ? kiemeltTalalkozoCel.nev : "" };
}

function nyitLista(tipus, teljesListaHaEgyezik = false) {
    ["indulas", "cel", "esemeny"].forEach(t => { if (t !== tipus) zarLista(t); });
    const { input, lista, aktivNev } = getListaElemek(tipus);
    const szuro = (teljesListaHaEgyezik && aktivNev && input.value.trim() === aktivNev) ? "" : input.value;
    renderLegordulo(tipus, szuro);
    lista.classList.add("nyitva");
}

function zarLista(tipus) {
    const { lista } = getListaElemek(tipus);
    if (lista) lista.classList.remove("nyitva");
}

function valtLista(tipus) {
    const { input, lista } = getListaElemek(tipus);
    if (lista.classList.contains("nyitva")) {
        zarLista(tipus);
    } else {
        input.focus();
        nyitLista(tipus, true);
    }
}

function szurLista(tipus, szoveg) {
    const { lista } = getListaElemek(tipus);
    renderLegordulo(tipus, szoveg);
    lista.classList.add("nyitva");
}

function torolMezo(tipus) {
    const { input } = getListaElemek(tipus);
    input.value = "";
    input.focus();
    nyitLista(tipus, false);
}

function valasztIndulasElem(idx) {
    aktualisIndulas = varosok[idx];
    document.getElementById("indulas-input").value = aktualisIndulas.nev;
    document.getElementById("btn-egyeb-indulas").style.display = "none";
    zarLista("indulas");
    frissitIndulasAllapot();
}

function valasztCelElem(idx, megtartKiemeltTalalkozot = false) {
    if (!megtartKiemeltTalalkozot) elrejtLegkozelebbiSav();

    aktualisCel = varosok[idx];
    document.getElementById("cel-input").value = aktualisCel.nev;
    document.getElementById("btn-egyeb-telepules").style.display = "none";
    zarLista("cel");

    const csereGomb = document.getElementById("btn-csere");
    if (csereGomb) csereGomb.disabled = false;

    document.getElementById("varos").innerText = aktualisCel.nev;
    document.getElementById("megye").innerText = aktualisCel.megye;
    document.getElementById("tav-auto").innerText = "Számítás...";
    document.getElementById("tav-sima").innerText = "Számítás...";
    document.getElementById("tavolsag-doboz").style.display = "grid";

    betoltNevezetessegek(aktualisCel);
    frissitMotorosRendezvenyek(aktualisCel);
    renderElmultRendezvenyek();
    rajzolTerkep(aktualisCel);
}

function valasztEsemenyElem(sortedIdx) {
    const rend = kozelgoEsemenyekLista[sortedIdx];
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
    document.getElementById("esemeny-input").value = rend.nev;
    zarLista("esemeny");

    const ma = new Date();
    ma.setHours(0, 0, 0, 0);
    let mikorSzoveg = "";
    if (rend.datumObj && rend.datumObj >= ma) {
        const napKulonbseg = Math.round((rend.datumObj.getTime() - ma.getTime()) / (1000 * 60 * 60 * 24));
        mikorSzoveg = napKulonbseg === 0 ? " (ma)" : (napKulonbseg === 1 ? " (holnap)" : ` (${napKulonbseg} nap múlva)`);
    }

    const sav = document.getElementById("legkozelebbi-sav");
    if (sav) {
        sav.classList.remove("elmult-sav");
        sav.style.display = "block";
        sav.innerHTML = `🏍️ Kiválasztott motoros program: <b>${rend.nev}</b><br>📅 ${rend.datum}${mikorSzoveg} • 📍 ${rend.hely}`;
    }

    valasztCelElem(varosIdx, true);
}

function valasztLegkozelebbiTalalkozo() {
    if (kozelgoEsemenyekLista.length === 0) frissitRendezettEsemenyeket();
    if (kozelgoEsemenyekLista.length === 0) return;
    valasztEsemenyElem(0);
}

function felcserelPontokat() {
    if (!aktualisCel || !aktualisIndulas) return;
    const regiIndulas = aktualisIndulas;
    aktualisIndulas = aktualisCel;
    aktualisCel = regiIndulas;

    elrejtLegkozelebbiSav();
    document.getElementById("indulas-input").value = aktualisIndulas.nev;
    document.getElementById("cel-input").value = aktualisCel.nev;
    renderLegordulo("indulas", "");
    renderLegordulo("cel", "");

    const fejlecIndulas = document.getElementById("fejlec-indulas");
    if (fejlecIndulas) fejlecIndulas.innerText = aktualisIndulas.nev;

    frissitIndulasMarker(false);
    document.getElementById("varos").innerText = aktualisCel.nev;
    document.getElementById("megye").innerText = aktualisCel.megye;
    document.getElementById("tav-auto").innerText = "Számítás...";
    document.getElementById("tav-sima").innerText = "Számítás...";
    document.getElementById("tavolsag-doboz").style.display = "grid";

    betoltNevezetessegek(aktualisCel);
    frissitMotorosRendezvenyek(aktualisCel);
    renderElmultRendezvenyek();
    rajzolTerkep(aktualisCel);
}

function elrejtLegkozelebbiSav() {
    const sav = document.getElementById("legkozelebbi-sav");
    if (sav) { sav.style.display = "none"; sav.classList.remove("elmult-sav"); }
    kiemeltTalalkozoCel = null;
    const esemenyInput = document.getElementById("esemeny-input");
    if (esemenyInput) esemenyInput.value = "";
}

async function keresEgyebTelepulest(tipus = "cel") {
    const isIndulas = tipus === "indulas";
    const inputElem = document.getElementById(isIndulas ? "indulas-input" : "cel-input");
    const egyebBtn = document.getElementById(isIndulas ? "btn-egyeb-indulas" : "btn-egyeb-telepules");

    const keresett = inputElem.value.trim();
    if (keresett.length < 2) return;

    const pontosIndex = varosok.findIndex(v => ekezetNelkul(v.nev) === ekezetNelkul(keresett));
    if (pontosIndex !== -1) {
        if (isIndulas) valasztIndulasElem(pontosIndex);
        else valasztCelElem(pontosIndex);
        return;
    }

    egyebBtn.style.display = "inline-block";
    egyebBtn.innerText = `⏳ „${keresett}” keresése...`;

    try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&countrycodes=hu&limit=1&q=${encodeURIComponent(keresett)}`;
        const res = await fetch(url);
        const data = await res.json();

        if (Array.isArray(data) && data.length > 0) {
            const talalat = data[0];
            const addr = talalat.address || {};
            const nev = addr.city || addr.town || addr.village || addr.municipality || keresett;
            const megye = addr.county ? `${addr.county}` : "Magyarország (egyéb település)";

            const ujTelepules = {
                nev: nev,
                tipus: "település",
                megye: megye,
                rovidMegye: addr.county ? addr.county.replace(" vármegye", "") : "település",
                jaras: "",
                iranyitoszam: addr.postcode || "",
                lat: parseFloat(talalat.lat),
                lng: parseFloat(talalat.lon),
                terulet: "Nincs adat",
                lakossag: "Község / település"
            };

            varosok.push(ujTelepules);
            varosok.sort((a, b) => a.nev.localeCompare(b.nev, "hu"));
            const ujIdx = varosok.findIndex(v => v.nev === ujTelepules.nev && v.lat === ujTelepules.lat);

            egyebBtn.style.display = "none";
            if (isIndulas) valasztIndulasElem(ujIdx);
            else valasztCelElem(ujIdx);
        } else {
            egyebBtn.innerText = `❌ Nem található ilyen település: „${keresett}”`;
        }
    } catch (e) {
        egyebBtn.innerText = "⚠️ Hálózati hiba a település keresésekor.";
    }
}

document.addEventListener("click", function(e) {
    const indulasBlokk = document.getElementById("indulas-blokk");
    const celBlokk = document.getElementById("cel-blokk");
    const esemenyBlokk = document.getElementById("esemeny-blokk");
    if (indulasBlokk && !indulasBlokk.contains(e.target)) zarLista("indulas");
    if (celBlokk && !celBlokk.contains(e.target)) zarLista("cel");
    if (esemenyBlokk && !esemenyBlokk.contains(e.target)) zarLista("esemeny");
});

// Alkalmazás indítása
inicializalTerkep();
renderLegordulo("indulas", "");
renderLegordulo("cel", "");
frissitOsszesRendezveny();