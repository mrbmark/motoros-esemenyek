const ENGEDELYEZETT_FORRASOK = new Set([
    "autosnaptar.hu",
    "zsakbamacska.eu",
    "programturizmus.hu",
    "csajokamotoron.hu"
]);

const alapForrasRendezvenyek = (typeof alapRendezvenyek !== "undefined" ? alapRendezvenyek : [])
    .filter(r => ENGEDELYEZETT_FORRASOK.has(r.forras));

let osszesRendezveny = [...alapForrasRendezvenyek];
let kozelgoEsemenyekLista = [];
let elmultEsemenyekLista = [];
let elmultSzuroMod = "osszes";

const honapKulcsok = [
    ["január", "jan."], ["február", "febr.", "feb."], ["március", "márc."],
    ["április", "ápr."], ["május", "máj."], ["június", "jún."],
    ["július", "júl."], ["augusztus", "aug."], ["szeptember", "szept.", "szep."],
    ["október", "okt."], ["november", "nov."], ["december", "dec."]
];

function htmlSzovegge(html) {
    const doc = new DOMParser().parseFromString(html || "", "text/html");
    return (doc.body.textContent || "").replace(/\s+/g, " ").trim();
}

function getForrasOsztaly(forras) {
    if (forras === "programturizmus.hu") return " pt";
    if (forras === "autosnaptar.hu") return " an";
    if (forras === "zsakbamacska.eu") return " zm";
    return "";
}

function getForrasSzin(forras) {
    if (forras === "programturizmus.hu") return "#60a5fa";
    if (forras === "autosnaptar.hu") return "#34d399";
    if (forras === "zsakbamacska.eu") return "#c084fc";
    return "#f472b6";
}

function kinyerDatumot(szoveg) {
    const honapok = "január|február|március|április|május|június|július|augusztus|szeptember|október|november|december|jan\\.|febr?\\.|márc\\.|ápr\\.|máj\\.|jún\\.|júl\\.|aug\\.|szept?\\.|okt\\.|nov\\.|dec\\.";
    const teljesDatumRegex = new RegExp(`(20\\d{2}\\.\\s*(?:${honapok})\\s*\\d{1,2}(?:\\s*[–-]\\s*(?:(?:${honapok})\\s*)?\\d{1,2})?\\.?)`, "i");
    const talalat1 = szoveg.match(teljesDatumRegex);
    if (talalat1) return talalat1[1];

    const isoDatumRegex = /(20\d{2}-\d{2}-\d{2}(?:\s*[–-]\s*(?:20\d{2}-)?\d{2}-\d{2})?)/;
    const talalatIso = szoveg.match(isoDatumRegex);
    if (talalatIso) return talalatIso[1];

    const szamosDatumRegex = /(20\d{2}\.\s*\d{1,2}\.\s*\d{1,2}\.?(?:\s*[–-]\s*(?:20\d{2}\.\s*)?(?:\d{1,2}\.\s*)?\d{1,2}\.?)?)/;
    const talalatSzamos = szoveg.match(szamosDatumRegex);
    if (talalatSzamos) return talalatSzamos[1];

    const rovidDatumRegex = new RegExp(`((?:${honapok})\\s*\\d{1,2}(?:\\s*[–-]\\s*\\d{1,2})?\\.?)`, "i");
    const talalat2 = szoveg.match(rovidDatumRegex);
    if (talalat2) return talalat2[1];

    return "Időpont a kiírásban";
}

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
        if (!ENGEDELYEZETT_FORRASOK.has(r.forras)) continue;

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
    renderEsemenyLegordulo(szuro);
    renderElmultRendezvenyek();
}

function valtElmultSzuro(mod) {
    elmultSzuroMod = mod;
    document.getElementById("btn-elmult-osszes").classList.toggle("aktiv", mod === "osszes");
    document.getElementById("btn-elmult-kozel").classList.toggle("aktiv", mod === "kozel");
    renderElmultRendezvenyek();
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
        const extraOsztaly = getForrasOsztaly(rend.forras);
        const forrasHtml = rend.forras
            ? `<span class="elo-jelveny${extraOsztaly}">🌐 <a class="elo-link" href="${rend.url || '#'}" target="_blank" rel="noopener" onclick="event.stopPropagation()">${rend.forras} ↗</a></span>`
            : "";
        const tavSzoveg = rend.tavKm !== null ? ` (${rend.tavKm === 0 ? "helyben" : rend.tavKm + " km"})` : "";
        const isKiemelt = kiemeltTalalkozoCel && kiemeltTalalkozoCel.nev === rend.nev;

        return `
            <li class="rendezveny-elem elmult-elem${isKiemelt ? ' aktiv' : ''}" onclick="mutatElmultRendezveny(${rend.eredetiIdx})">
                <div class="rendezveny-cim">${rend.nev}</div>
                <div class="rendezveny-meta">
                    <span>📅 <b>${rend.datum}</b> (lezajlott)</span>
                    <span>📍 ${rend.hely}${tavSzoveg}</span>
                    ${forrasHtml}
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

    valasztCelElem(varosIdx, true);
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
        document.getElementById("motoros-rendezvenyek-tartalom").innerHTML = `<p class="ures-allapot">Jelenleg nincs közelgő motoros találkozó rögzítve. A lezajlott programokat az <b>„Ez történt eddig...”</b> dobozban találod.</p>`;
        return;
    }

    const listaHtml = aktualisRendezvenyek.map((rend, index) => {
        const extraOsztaly = getForrasOsztaly(rend.forras);
        const forrasHtml = rend.forras ? `<span class="elo-jelveny${extraOsztaly}">🌐 <a class="elo-link" href="${rend.url || '#'}" target="_blank" rel="noopener" onclick="event.stopPropagation()">${rend.forras} ↗</a></span>` : "";
        const isKiemelt = kiemeltTalalkozoCel && kiemeltTalalkozoCel.nev === rend.nev;
        return `
            <li class="rendezveny-elem${isKiemelt ? ' aktiv' : ''}" id="rend-elem-${index}" onclick="mutatRendezveny(${index})">
                <div class="rendezveny-cim">${rend.nev}</div>
                <div class="rendezveny-meta">
                    <span>📅 <b>${rend.datum}</b></span>
                    <span>📍 ${rend.hely} (${rend.tavKm === 0 ? "helyben" : rend.tavKm + " km"})</span>
                    ${forrasHtml}
                </div>
            </li>
        `;
    }).join("");

    document.getElementById("motoros-rendezvenyek-tartalom").innerHTML = `<p class="nevezetessegek-tipp">${megjegyzes}</p><ul class="rendezveny-lista">${listaHtml}</ul>`;
}

// --- ÉLŐ RENDEZVÉNY LEKÉRDEZŐK (4 WEBOLDALRÓL) ---
function blokkoltValaszE(szoveg) {
    if (!szoveg || szoveg.length < 180) return true;
    return /(Just a moment\.\.\.|Attention Required! \| Cloudflare|Enable JavaScript and cookies to continue|403 Forbidden|Access Denied|DDoS-Guard)/i.test(szoveg);
}

function feldolgozJinaSzoveget(szoveg, forrasNev, alapUrl) {
    const sorok = (szoveg || "").split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    const talaltEsemenyek = [];
    const latottKulcsok = new Set();
    let korabbiSzekcio = false;

    for (let i = 0; i < sorok.length; i++) {
        const sor = sorok[i];
        if (/^(URL Source|Title|Markdown Content|Published Time):/i.test(sor)) continue;
        if (forrasNev === "zsakbamacska.eu") {
            if (/^#+\s*korábbi események/i.test(sor)) { korabbiSzekcio = true; continue; }
            if (/^#+\s*közelgő események/i.test(sor)) { korabbiSzekcio = false; continue; }
        }
        if (/01\.01\.\s*(?:\([^)]*\))?\s*-\s*(?:20\d{2}\.)?12\.31\./.test(sor)) continue;
        if (/(hotel|gyógyszálló|apartman|musical|jazz club|gospel|színház|wellness|süti beállítások|cookie)/i.test(sor)) continue;

        const kontextus = [sorok[i - 1] || "", sor, sorok[i + 1] || "", sorok[i + 2] || ""].join(" ");
        const datum = kinyerDatumot(kontextus);
        const vanHamarosan = (forrasNev === "zsakbamacska.eu" && !korabbiSzekcio && /(hamarosan|tervezés alatt|jelentkezés)/i.test(kontextus));

        if (datum === "Időpont a kiírásban" && !vanHamarosan) continue;

        let cim = "";
        let url = alapUrl;
        const mdLinkMatch = sor.match(/\[([^\]]{5,140})\]\((https?:\/\/[^)]+)\)/) || (sorok[i + 1] || "").match(/\[([^\]]{5,140})\]\((https?:\/\/[^)]+)\)/);

        if (mdLinkMatch) {
            cim = mdLinkMatch[1].replace(/[*#_`]/g, "").trim();
            url = mdLinkMatch[2].trim();
        } else {
            const tisztaSor = sor.replace(datum, "").replace(/[*#_`[\]]/g, "").replace(/\(https?:\/\/[^)]+\)/g, "").replace(/^[\s.,–:-]+/, "").replace(/\.$/, "").trim();
            if (tisztaSor.length >= 6 && tisztaSor.length <= 140) cim = tisztaSor;
            else if (sorok[i + 1]) {
                const kovTiszta = sorok[i + 1].replace(/[*#_`[\]]/g, "").replace(/\(https?:\/\/[^)]+\)/g, "").trim();
                if (kovTiszta.length >= 6 && kovTiszta.length <= 140) cim = kovTiszta;
            }
        }

        if (!cim || cim.length < 6) continue;
        if (/^(tovább|részletek|megnézem|jelentkezés|események|korábbi események|közelgő események|galéria|kapcsolat|főoldal|merch|regisztráció)$/i.test(cim)) continue;
        if (/\bautós\b/i.test(cim) && !/motoros/i.test(cim)) continue;

        const kulcs = ekezetNelkul(cim);
        if (latottKulcsok.has(kulcs)) continue;
        latottKulcsok.add(kulcs);

        const varosTalalat = keresHelyszintSzovegben(`${cim} ${kontextus}`);
        talaltEsemenyek.push({
            nev: cim,
            datum: datum !== "Időpont a kiírásban" ? datum : "Hamarosan (tervezés alatt)",
            hely: varosTalalat ? `${varosTalalat.nev} (${varosTalalat.rovidMegye})` : (forrasNev === "zsakbamacska.eu" ? "Meglepetés útvonal (Magyarország)" : "Magyarország (részletek a kiírásban)"),
            varosNev: varosTalalat ? varosTalalat.nev : "Budapest",
            lat: varosTalalat ? varosTalalat.lat : 47.4979,
            lng: varosTalalat ? varosTalalat.lng : 19.0402,
            forras: forrasNev, url: url, korabbi: korabbiSzekcio
        });
    }
    return talaltEsemenyek;
}

function feldolgozCsamTalalkozoOldalHtml(htmlSzoveg) {
    const doc = new DOMParser().parseFromString(htmlSzoveg || "", "text/html");
    doc.querySelectorAll("script, style, nav, footer").forEach(el => el.remove());
    const talaltEsemenyek = [];
    const latottKulcsok = new Set();
    const alapUrl = "https://csajokamotoron.hu/motoros-talalkozo/";
    const foKontener = doc.querySelector("main, #content, #primary, .site-main, .tribe-events, .td-ss-main-content") || doc.body;
    const kartyak = foKontener.querySelectorAll("article, .tribe-events-calendar-list__event, .tribe-common-g-row, .type-tribe_events, .post, .entry, .td_module_wrap, .elementor-post, .ecs-event");

    const feldolgozElemet = (el) => {
        const fejlecLink = el.querySelector("h1 a, h2 a, h3 a, h4 a, .entry-title a, .tribe-events-calendar-list__event-title a");
        const link = fejlecLink || el.querySelector('a[href*="csajokamotoron.hu/"]');
        if (!link) return;
        const href = link.getAttribute("href") || "";
        if (!href || href === alapUrl || /\/(page|category|tag|author)\//i.test(href)) return;

        let cim = htmlSzovegge(fejlecLink ? fejlecLink.textContent : link.textContent);
        if (cim.length < 5 || /^(tovább|részletek|bővebben|olvasd tovább|megnézem)$/i.test(cim)) {
            const h = el.querySelector("h1, h2, h3, h4");
            if (h) cim = htmlSzovegge(h.textContent);
        }
        if (cim.length < 5) return;

        const teljesSzoveg = htmlSzovegge(el.textContent).slice(0, 700);
        const timeElem = el.querySelector("time[datetime]");
        const timeSzoveg = timeElem ? htmlSzovegge(timeElem.textContent) : "";
        const datum = kinyerDatumot(`${cim} ${timeSzoveg} ${teljesSzoveg}`);

        const venueElem = el.querySelector(".tribe-events-calendar-list__event-venue, .tribe-venue, .event-venue, .location");
        const venueSzoveg = venueElem ? htmlSzovegge(venueElem.textContent) : "";
        const varosTalalat = keresHelyszintSzovegben(venueSzoveg) || keresHelyszintSzovegben(cim) || keresHelyszintSzovegben(teljesSzoveg);

        const kulcs = ekezetNelkul(cim);
        if (latottKulcsok.has(kulcs)) return;
        latottKulcsok.add(kulcs);

        talaltEsemenyek.push({
            nev: cim, datum: datum,
            hely: varosTalalat ? `${varosTalalat.nev} (${varosTalalat.rovidMegye})` : (venueSzoveg || "Magyarország (részletek a cikkben)"),
            varosNev: varosTalalat ? varosTalalat.nev : "Budapest",
            lat: varosTalalat ? varosTalalat.lat : 47.4979, lng: varosTalalat ? varosTalalat.lng : 19.0402,
            forras: "csajokamotoron.hu",
            url: href.startsWith("http") ? href : `https://csajokamotoron.hu${href.startsWith("/") ? "" : "/"}${href}`
        });
    };

    kartyak.forEach(feldolgozElemet);
    if (talaltEsemenyek.length === 0) foKontener.querySelectorAll("h2 a, h3 a, h4 a").forEach(a => { const kontener = a.closest("div, li, section") || a.parentElement; if (kontener) feldolgozElemet(kontener); });
    return talaltEsemenyek;
}

function feldolgozCikkeket(cikkLista) {
    const talaltEsemenyek = [];
    const latottCimek = new Set();
    for (const cikk of cikkLista) {
        const cim = htmlSzovegge(cikk.title);
        const leiras = htmlSzovegge(cikk.description);
        const teljesSzoveg = `${cim} ${leiras}`;
        if (!cim) continue;
        const kulcs = ekezetNelkul(cim);
        if (latottCimek.has(kulcs)) continue;

        const esemenyKulcsszo = /(találkozó|túra|gurulás|fesztivál|motoros nap|szezonnyitó|szezonzáró|tréning|felvonulás|program|tesztnap|majális|piknik)/i.test(teljesSzoveg);
        const varosTalalat = keresHelyszintSzovegben(cim) || keresHelyszintSzovegben(leiras);

        if ((varosTalalat && (esemenyKulcsszo || cikk.kiemeltFeed)) || cikk.talalkozoKategoria) {
            latottCimek.add(kulcs);
            talaltEsemenyek.push({
                nev: cim, datum: kinyerDatumot(teljesSzoveg),
                hely: varosTalalat ? `${varosTalalat.nev} (${varosTalalat.rovidMegye})` : "Magyarország (részletek a cikkben)",
                varosNev: varosTalalat ? varosTalalat.nev : "Budapest",
                lat: varosTalalat ? varosTalalat.lat : 47.4979, lng: varosTalalat ? varosTalalat.lng : 19.0402,
                forras: "csajokamotoron.hu",
                url: cikk.link || "https://csajokamotoron.hu/motoros-talalkozo/"
            });
        }
    }
    return talaltEsemenyek;
}

// Programturizmus.hu: „Kapcsolódó információk” alatti események feldolgozása
function kinyerPtLinkBol(a, latottKulcsok, talaltEsemenyek) {
    const href = a.getAttribute("href") || "";
    if (!href || href.includes("ajanlat-motoros-esemenynaptar") || href.includes("kategoria-motor")) return;
    if (!/(ajanlat-|program-|esemeny-)/i.test(href)) return;

    let cim = htmlSzovegge(a.textContent);
    if (cim.length < 5 || /^(tovább|részletek|bővebben|megnézem|érdekel|programturizmus)$/i.test(cim)) {
        const fejlec = a.closest("h1, h2, h3, h4, h5");
        if (fejlec) cim = htmlSzovegge(fejlec.textContent);
    }
    if (cim.length < 5) return;
    if (/(hotel|gyógyszálló|apartman|musical|jazz club|gospel|színház|wellness)/i.test(cim)) return;

    let kontener = a.closest("p, li, tr, article, .ajanlat, .program, .item, .card, .list-item, div");
    if (kontener && htmlSzovegge(kontener.textContent).length < cim.length + 12 && kontener.parentElement) {
        kontener = kontener.parentElement;
    }
    const kontenerSzoveg = (kontener ? htmlSzovegge(kontener.textContent) : cim).slice(0, 500);
    const datum = kinyerDatumot(`${cim} ${kontenerSzoveg}`);

    let tisztaCim = cim;
    if (datum !== "Időpont a kiírásban" && tisztaCim.includes(datum)) {
        tisztaCim = tisztaCim.replace(datum, "").replace(/^[\s.,–:-]+|[\s.,–:-]+$/g, "").trim();
    }
    if (tisztaCim.length < 5) tisztaCim = cim;

    const varosTalalat = keresHelyszintSzovegben(tisztaCim) || keresHelyszintSzovegben(kontenerSzoveg);
    const kulcs = ekezetNelkul(tisztaCim);
    if (latottKulcsok.has(kulcs)) return;
    latottKulcsok.add(kulcs);

    talaltEsemenyek.push({
        nev: tisztaCim,
        datum: datum,
        hely: varosTalalat ? `${varosTalalat.nev} (${varosTalalat.rovidMegye})` : "Magyarország (részletek a kiírásban)",
        varosNev: varosTalalat ? varosTalalat.nev : "Budapest",
        lat: varosTalalat ? varosTalalat.lat : 47.4979,
        lng: varosTalalat ? varosTalalat.lng : 19.0402,
        forras: "programturizmus.hu",
        url: href.startsWith("http") ? href : `https://www.programturizmus.hu${href.startsWith("/") ? "" : "/"}${href}`
    });
}

function feldolgozProgramturizmusHtml(htmlSzoveg) {
    const doc = new DOMParser().parseFromString(htmlSzoveg || "", "text/html");
    doc.querySelectorAll("script, style, nav, footer, header").forEach(el => el.remove());
    const talaltEsemenyek = [];
    const latottKulcsok = new Set();

    // 1. Megkeressük a „Kapcsolódó információk” címsort és az alatta található eseményeket
    const jeloltek = Array.from(doc.querySelectorAll("h1, h2, h3, h4, h5, strong, b, .title, .box-title, p, div"));
    const kapcsolodoFejlec = jeloltek.find(el => {
        if (el.children.length > 2) return false;
        const txt = ekezetNelkul(htmlSzovegge(el.textContent));
        return txt === "kapcsolodo informaciok" || txt === "kapcsolodo informaciok:";
    });

    if (kapcsolodoFejlec) {
        const szulo = kapcsolodoFejlec.parentElement;
        if (szulo && szulo !== doc.body && htmlSzovegge(szulo.textContent).length < 6000) {
            szulo.querySelectorAll('a[href*="ajanlat-"], a[href*="program-"], a[href*="esemeny-"]')
                .forEach(a => kinyerPtLinkBol(a, latottKulcsok, talaltEsemenyek));
        }

        if (talaltEsemenyek.length === 0) {
            let induloElem = kapcsolodoFejlec;
            if (induloElem.parentElement && htmlSzovegge(induloElem.parentElement.textContent).length < 60) {
                induloElem = induloElem.parentElement;
            }
            let kov = induloElem.nextElementSibling;
            while (kov) {
                const kovTxt = ekezetNelkul(htmlSzovegge(kov.textContent));
                if (/^H[1-4]$/.test(kov.tagName) && !kovTxt.includes("kapcsolodo")) break;
                if (/^(velemenyek|hozzaszolasok|szallas|kategoria|hirlevel)/.test(kovTxt)) break;

                kov.querySelectorAll('a[href*="ajanlat-"], a[href*="program-"], a[href*="esemeny-"]')
                    .forEach(a => kinyerPtLinkBol(a, latottKulcsok, talaltEsemenyek));
                kov = kov.nextElementSibling;
            }
        }
    }

    // 2. Tartalék: ha nem külön blokkban szerepelnek, az oldalon lévő eseménylinkeket olvassuk be
    if (talaltEsemenyek.length === 0) {
        doc.querySelectorAll('a[href*="ajanlat-"], a[href*="program-"], a[href*="esemeny-"]')
            .forEach(a => kinyerPtLinkBol(a, latottKulcsok, talaltEsemenyek));
    }

    return talaltEsemenyek;
}

function feldolgozProgramturizmusJina(szoveg, alapUrl) {
    const sorok = (szoveg || "").split(/\r?\n/);
    const idx = sorok.findIndex(s => /kapcsol[óo]d[óo]\s+inform[áa]ci[óo]k/i.test(s));
    if (idx !== -1) {
        const reszlet = sorok.slice(idx + 1, idx + 80).join("\n");
        const talalatok = feldolgozJinaSzoveget(reszlet, "programturizmus.hu", alapUrl);
        if (talalatok.length > 0) return talalatok;
    }
    return feldolgozJinaSzoveget(szoveg, "programturizmus.hu", alapUrl);
}

function feldolgozAutosnaptarHtml(htmlSzoveg) {
    const doc = new DOMParser().parseFromString(htmlSzoveg || "", "text/html");
    doc.querySelectorAll("script, style, nav, footer, header").forEach(el => el.remove());
    const talaltEsemenyek = [];
    const latottKulcsok = new Set();

    const linkek = doc.querySelectorAll('a[href]');
    for (const a of linkek) {
        const href = a.getAttribute("href") || "";
        if (!/\/\d{3,}-[a-z0-9-]+/i.test(href)) continue;

        const belsoFejlec = a.querySelector("h1, h2, h3, h4, h5, .title, .event-title");
        const kulsoFejlec = a.closest("h1, h2, h3, h4, h5, .title, .event-title");
        let cim = belsoFejlec ? htmlSzovegge(belsoFejlec.textContent) : (kulsoFejlec ? htmlSzovegge(kulsoFejlec.textContent) : htmlSzovegge(a.textContent));

        let kontener = a.closest("article, .card, .event, .item, .list-group-item, li, tr, div");
        if (kontener && htmlSzovegge(kontener.textContent).length < cim.length + 8 && kontener.parentElement) kontener = kontener.parentElement;

        if ((cim.length < 4 || /^(részletek|tovább|megnézem|érdekel)$/i.test(cim)) && kontener) {
            const kartyaFejlec = kontener.querySelector("h1, h2, h3, h4, h5, .title, .event-title");
            if (kartyaFejlec) cim = htmlSzovegge(kartyaFejlec.textContent);
        }

        const kontenerSzoveg = (kontener ? htmlSzovegge(kontener.textContent) : cim).slice(0, 750);
        const datum = kinyerDatumot(`${cim} ${kontenerSzoveg}`);

        if (datum !== "Időpont a kiírásban" && cim.includes(datum)) cim = cim.replace(datum, "").replace(/^[\s.,–-]+/, "").trim();
        if (cim.length > 130 && cim.includes("  ")) cim = cim.split(/\s{2,}/)[0].trim();
        if (cim.length < 4) continue;

        const varosTalalat = keresHelyszintSzovegben(cim) || keresHelyszintSzovegben(kontenerSzoveg);
        const kulcs = ekezetNelkul(cim);
        if (latottKulcsok.has(kulcs)) continue;
        latottKulcsok.add(kulcs);

        talaltEsemenyek.push({
            nev: cim, datum: datum,
            hely: varosTalalat ? `${varosTalalat.nev} (${varosTalalat.rovidMegye})` : "Magyarország (részletek az adatlapon)",
            varosNev: varosTalalat ? varosTalalat.nev : "Budapest",
            lat: varosTalalat ? varosTalalat.lat : 47.4979, lng: varosTalalat ? varosTalalat.lng : 19.0402,
            forras: "autosnaptar.hu",
            url: href.startsWith("http") ? href : `https://autosnaptar.hu${href.startsWith("/") ? "" : "/"}${href}`
        });
    }
    return talaltEsemenyek;
}

function feldolgozZsakbamacskaHtml(htmlSzoveg) {
    const doc = new DOMParser().parseFromString(htmlSzoveg || "", "text/html");
    doc.querySelectorAll("script, style, nav, footer").forEach(el => el.remove());
    const talaltEsemenyek = [];
    const latottKulcsok = new Set();
    const esemenyekSzekcio = doc.querySelector("#esemenyek") || doc.body;
    const elemek = esemenyekSzekcio.querySelectorAll("h2, h3, h4, a[href]");

    for (const el of elemek) {
        let cim = ""; let href = "";
        if (el.tagName === "A") {
            href = el.getAttribute("href") || "";
            if (!/(esemeny|tura|gurulas|zsakbamacska)/i.test(href + " " + el.textContent)) continue;
            cim = htmlSzovegge(el.textContent);
            if (/^(részletek|tovább|jelentkezés|események|korábbi események|összes esemény|galéria|kapcsolat)$/i.test(cim)) {
                const kartya = el.closest("article, .card, .item, section, div");
                const fejlec = kartya ? kartya.querySelector("h2, h3, h4") : null;
                if (fejlec) cim = htmlSzovegge(fejlec.textContent);
            }
        } else {
            cim = htmlSzovegge(el.textContent);
            const kartya = el.closest("article, .card, .item, section, div");
            const link = kartya ? kartya.querySelector("a[href]") : null;
            if (link) href = link.getAttribute("href") || "";
        }

        if (!cim || cim.length < 6) continue;
        if (/^(korábbi események|közelgő események|események|zsákbamacska motoros gurulások|mi az a zsákbamacska|hogyan működik|kapcsolat|galéria)$/i.test(cim)) continue;
        if (/\bautós\b/i.test(cim) && !/motoros/i.test(cim)) continue;

        let kontener = el.closest("article, .card, .item, li, div");
        if (kontener && htmlSzovegge(kontener.textContent).length < cim.length + 10 && kontener.parentElement) kontener = kontener.parentElement;
        const kontenerSzoveg = (kontener ? htmlSzovegge(kontener.textContent) : cim).slice(0, 750);

        let korabbiSzekcio = false;
        let elozo = kontener ? kontener.previousElementSibling : null;
        while (elozo) {
            const elozoTxt = htmlSzovegge(elozo.textContent);
            if (/korábbi események/i.test(elozoTxt)) { korabbiSzekcio = true; break; }
            if (/közelgő események/i.test(elozoTxt)) { korabbiSzekcio = false; break; }
            elozo = elozo.previousElementSibling;
        }

        const datumSzoveg = kinyerDatumot(kontenerSzoveg);
        const vanMotorosKulcsszo = /(zsákbamacska|gurulás|motoros|túra|csavargás)/i.test(kontenerSzoveg);
        if (!vanMotorosKulcsszo && datumSzoveg === "Időpont a kiírásban") continue;

        const kulcs = ekezetNelkul(cim);
        if (latottKulcsok.has(kulcs)) continue;
        latottKulcsok.add(kulcs);

        const varosTalalat = keresHelyszintSzovegben(cim) || keresHelyszintSzovegben(kontenerSzoveg);
        const teljesUrl = href ? (href.startsWith("http") ? href : `https://www.zsakbamacska.eu${href.startsWith("/") ? "" : "/"}${href}`) : "https://www.zsakbamacska.eu/#esemenyek";

        talaltEsemenyek.push({
            nev: cim, datum: datumSzoveg !== "Időpont a kiírásban" ? datumSzoveg : "Hamarosan (tervezés alatt)",
            hely: varosTalalat ? `${varosTalalat.nev} (${varosTalalat.rovidMegye})` : "Meglepetés útvonal (Magyarország)",
            varosNev: varosTalalat ? varosTalalat.nev : "Budapest",
            lat: varosTalalat ? varosTalalat.lat : 47.4979, lng: varosTalalat ? varosTalalat.lng : 19.0402,
            forras: "zsakbamacska.eu", url: teljesUrl, korabbi: korabbiSzekcio
        });
    }
    return talaltEsemenyek;
}

async function fetchIdokorlattal(url, ms = 8000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
        return await fetch(url, { signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

async function lekerProxySzoveg(celUrl) {
    const proxyk = [
        { url: `https://api.allorigins.win/get?url=${encodeURIComponent(celUrl)}`, jsonWrap: true },
        { url: `https://corsproxy.io/?url=${encodeURIComponent(celUrl)}`, jsonWrap: false },
        { url: `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(celUrl)}`, jsonWrap: false },
        { url: `https://api.allorigins.win/raw?url=${encodeURIComponent(celUrl)}`, jsonWrap: false }
    ];
    for (const p of proxyk) {
        try {
            const res = await fetchIdokorlattal(p.url, 6500);
            if (!res.ok) continue;
            if (p.jsonWrap) {
                const json = await res.json();
                const httpCode = json && json.status && json.status.http_code ? json.status.http_code : 200;
                if (httpCode >= 400) continue;
                if (json && typeof json.contents === "string" && !blokkoltValaszE(json.contents)) return json.contents;
            } else {
                const szoveg = await res.text();
                if (!blokkoltValaszE(szoveg)) return szoveg;
            }
        } catch (e) {}
    }
    throw new Error("Proxy lekérési hiba: " + celUrl);
}

async function lekerJinaSzoveg(celUrl) {
    const res = await fetchIdokorlattal(`https://r.jina.ai/${celUrl}`, 9500);
    if (!res.ok) throw new Error("Jina lekérési hiba");
    const szoveg = await res.text();
    if (!szoveg || szoveg.length < 150) throw new Error("Üres Jina válasz");
    return szoveg;
}

async function lekerRssFeed(rssUrl, kiemeltFeed = false, talalkozoKategoria = false) {
    try {
        const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;
        const res = await fetchIdokorlattal(apiUrl, 6500);
        if (res.ok) {
            const data = await res.json();
            if (data.status === "ok" && Array.isArray(data.items) && data.items.length > 0) {
                return data.items.map(item => ({
                    title: item.title, description: item.description || item.content || "",
                    pubDate: item.pubDate, link: item.link, kiemeltFeed, talalkozoKategoria
                }));
            }
        }
    } catch (e) {}

    const xmlSzoveg = await lekerProxySzoveg(rssUrl);
    const doc = new DOMParser().parseFromString(xmlSzoveg, "text/xml");
    return Array.from(doc.querySelectorAll("item")).map(item => ({
        title: (item.querySelector("title") || {}).textContent || "",
        description: (item.querySelector("description") || {}).textContent || "",
        pubDate: (item.querySelector("pubDate") || {}).textContent || "",
        link: (item.querySelector("link") || {}).textContent || "",
        kiemeltFeed, talalkozoKategoria
    }));
}

async function lekerWpApi(wpUrl) {
    let nyers = "";
    try {
        const directRes = await fetchIdokorlattal(wpUrl, 5000);
        if (directRes.ok) nyers = await directRes.text();
    } catch (e) {}
    if (!nyers) nyers = await lekerProxySzoveg(wpUrl);
    const posts = JSON.parse(nyers);
    if (!Array.isArray(posts)) return [];
    return posts.map(p => ({
        title: p.title && p.title.rendered ? p.title.rendered : "",
        description: p.excerpt && p.excerpt.rendered ? p.excerpt.rendered : "",
        pubDate: p.date, link: p.link, kiemeltFeed: true, talalkozoKategoria: true
    }));
}

async function lekerCsamTalalkozok() {
    const celUrl = "https://csajokamotoron.hu/motoros-talalkozo/";
    let lista = [];
    const [htmlRes, rssRes, wpRes] = await Promise.allSettled([
        lekerProxySzoveg(celUrl),
        lekerRssFeed("https://csajokamotoron.hu/motoros-talalkozo/feed/", true, true),
        lekerWpApi("https://csajokamotoron.hu/wp-json/wp/v2/posts?per_page=25&search=talalkozo")
    ]);

    if (htmlRes.status === "fulfilled") lista = lista.concat(feldolgozCsamTalalkozoOldalHtml(htmlRes.value));
    if (rssRes.status === "fulfilled") lista = lista.concat(feldolgozCikkeket(rssRes.value));
    if (wpRes.status === "fulfilled") lista = lista.concat(feldolgozCikkeket(wpRes.value));

    if (lista.length === 0) {
        try {
            const jinaTxt = await lekerJinaSzoveg(celUrl);
            lista = lista.concat(feldolgozJinaSzoveget(jinaTxt, "csajokamotoron.hu", celUrl));
        } catch (e) {}
    }
    return lista;
}

async function lekerProgramturizmus() {
    const celUrl = "https://www.programturizmus.hu/ajanlat-motoros-esemenynaptar.html";
    try {
        const html = await lekerProxySzoveg(celUrl);
        const lista = feldolgozProgramturizmusHtml(html);
        if (lista.length > 0) return lista;
    } catch (e) {}
    const jinaTxt = await lekerJinaSzoveg(celUrl);
    return feldolgozProgramturizmusJina(jinaTxt, celUrl);
}

async function lekerAutosnaptar() {
    const celUrl = "https://autosnaptar.hu/2027/motoros";
    let lista = [];
    try {
        const html = await lekerProxySzoveg(celUrl);
        lista = lista.concat(feldolgozAutosnaptarHtml(html));
    } catch (e) {}

    if (lista.length === 0) {
        try {
            const jinaTxt = await lekerJinaSzoveg(celUrl);
            lista = lista.concat(feldolgozJinaSzoveget(jinaTxt, "autosnaptar.hu", celUrl));
        } catch (e) {}
    }
    return lista;
}

async function lekerZsakbamacska() {
    const celUrl = "https://www.zsakbamacska.eu/#esemenyek";
    const [fooldalRes, aloldalRes] = await Promise.allSettled([
        lekerProxySzoveg("https://www.zsakbamacska.eu/"),
        lekerProxySzoveg("https://www.zsakbamacska.eu/Esemenyek")
    ]);

    let lista = [];
    if (fooldalRes.status === "fulfilled") lista = lista.concat(feldolgozZsakbamacskaHtml(fooldalRes.value));
    if (aloldalRes.status === "fulfilled") lista = lista.concat(feldolgozZsakbamacskaHtml(aloldalRes.value));

    if (lista.length === 0) {
        try {
            const jinaTxt = await lekerJinaSzoveg(celUrl);
            lista = lista.concat(feldolgozJinaSzoveget(jinaTxt, "zsakbamacska.eu", celUrl));
        } catch (e) {}
    }
    return lista;
}

async function frissitOsszesRendezveny(kezzelInditott = false) {
    const allapotDoboz = document.getElementById("forras-allapot");
    const frissitGomb = document.getElementById("btn-frissit-rendezvenyek");

    if (frissitGomb) frissitGomb.disabled = true;
    if (allapotDoboz) {
        allapotDoboz.classList.remove("sikeres");
        allapotDoboz.innerText = "⏳ Élő találkozók lekérése (4 weboldalról)...";
    }

    try {
        const mentett = localStorage.getItem("motoros_elo_rendezvenyek_v13");
        if (mentett && !kezzelInditott) {
            const parsed = JSON.parse(mentett);
            if (Array.isArray(parsed) && parsed.length > 0) {
                const szurtMentett = parsed.filter(e => ENGEDELYEZETT_FORRASOK.has(e.forras));
                const kulcsok = new Set(szurtMentett.map(e => ekezetNelkul(e.nev)));
                const egyediAlap = alapForrasRendezvenyek.filter(a => !kulcsok.has(ekezetNelkul(a.nev)));
                osszesRendezveny = [...szurtMentett, ...egyediAlap];
                frissitRendezettEsemenyeket();
            }
        }
    } catch (e) {}

    try {
        const [anEredmeny, zmEredmeny, ptEredmeny, csamEredmeny] = await Promise.allSettled([
            lekerAutosnaptar(),
            lekerZsakbamacska(),
            lekerProgramturizmus(),
            lekerCsamTalalkozok()
        ]);

        const anEsemenyek = (anEredmeny.status === "fulfilled" && Array.isArray(anEredmeny.value)) ? anEredmeny.value : [];
        const zmEsemenyek = (zmEredmeny.status === "fulfilled" && Array.isArray(zmEredmeny.value)) ? zmEredmeny.value : [];
        const ptEsemenyek = (ptEredmeny.status === "fulfilled" && Array.isArray(ptEredmeny.value)) ? ptEredmeny.value : [];
        const csamEsemenyek = (csamEredmeny.status === "fulfilled" && Array.isArray(csamEredmeny.value)) ? csamEredmeny.value : [];

        const kombinaltElo = [];
        const latottNevek = new Set();

        for (const ev of [...anEsemenyek, ...zmEsemenyek, ...ptEsemenyek, ...csamEsemenyek]) {
            const kulcs = ekezetNelkul(ev.nev);
            if (!latottNevek.has(kulcs)) {
                latottNevek.add(kulcs);
                kombinaltElo.push(ev);
            }
        }

        if (kombinaltElo.length > 0) {
            try { localStorage.setItem("motoros_elo_rendezvenyek_v13", JSON.stringify(kombinaltElo)); } catch (e) {}

            const egyediAlap = alapForrasRendezvenyek.filter(a => !latottNevek.has(ekezetNelkul(a.nev)));
            osszesRendezveny = [...kombinaltElo, ...egyediAlap];
            frissitRendezettEsemenyeket();

            const ido = new Date().toLocaleTimeString("hu-HU", { hour: "2-digit", minute: "2-digit" });
            if (allapotDoboz) {
                allapotDoboz.classList.add("sikeres");
                allapotDoboz.innerHTML = `🟢 Frissítve (${ido}): <b>autosnaptar.hu</b> (${anEsemenyek.length}), <b>zsakbamacska.eu</b> (${zmEsemenyek.length}), <b>programturizmus.hu</b> (${ptEsemenyek.length}), <b>csajokamotoron.hu</b> (${csamEsemenyek.length})`;
            }
        } else {
            frissitRendezettEsemenyeket();
            if (allapotDoboz) {
                allapotDoboz.classList.add("sikeres");
                allapotDoboz.innerHTML = `🟢 Betöltve: <b>autosnaptar.hu</b>, <b>zsakbamacska.eu</b>, <b>programturizmus.hu</b>, <b>csajokamotoron.hu</b>`;
            }
        }
    } catch (err) {
        frissitRendezettEsemenyeket();
        if (allapotDoboz) allapotDoboz.innerText = "⚠️ Offline mód: a beépített 4 forrásos rendezvénynaptár látható.";
    } finally {
        if (frissitGomb) frissitGomb.disabled = false;
        if (aktualisCel) {
            frissitMotorosRendezvenyek(aktualisCel);
            renderElmultRendezvenyek();
        }
    }
}