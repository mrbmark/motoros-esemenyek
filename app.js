listaElem.innerHTML = talalatok.map(({ ev, idx }) => {
        const isSelected = kiemeltTalalkozoCel && kiemeltTalalkozoCel.nev === ev.nev;
        return `
            <div class="combobox-elem${isSelected ? " kivalasztva" : ""}" onmousedown="event.preventDefault(); valasztEsemenyElem(${idx})">
                <div class="combobox-elem-bal">
                    <div class="combobox-elem-datum-sor">
                        <span>📅 ${ev.datum}</span>
                        <span class="dropdown-forras-pill">saját</span>
                    </div>
                    <span class="combobox-elem-nev">${ev.nev}</span>
                </div>
                <span class="combobox-elem-megye" style="max-width: 48%; overflow: hidden; text-overflow: ellipsis;" title="${ev.hely}">📍 ${ev.hely}</span>
            </div>
        `;
    }).join("");