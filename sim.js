(() => {
  const DATA = window.GEOSIM_DATA;
  const MAP_COUNTRIES = window.WORLD_MAP_COUNTRIES || [];
  if (!DATA) {
    document.getElementById("tickerHeadline").textContent = "geosim_events.js 데이터를 불러오지 못했습니다.";
    return;
  }

  const SVG_NS = "http://www.w3.org/2000/svg";
  const LON_MIN = -175.0, LON_MAX = 180.0;
  const LAT_MIN = -58.0, LAT_MAX = 82.0;
  const WIDTH = 1000.0, HEIGHT = 500.0;

  const TYPE_META = {
    military: { label: "전쟁/군사", icon: "⚔️", color: "#dc2626" },
    unrest: { label: "시위/내정", icon: "🔥", color: "#d97706" },
    diplomacy: { label: "외교/교류", icon: "✈️", color: "#059669" },
    economy: { label: "경제/제재", icon: "💵", color: "#2563eb" },
  };

  const SUBTYPE_META = {
    missile: { label: "미사일·드론", icon: "🚀" },
    naval: { label: "함대·항모·해상", icon: "⚓" },
    airstrike: { label: "공습·전투기", icon: "💣" },
    ground: { label: "교전·병력파견", icon: "🔫" },
    ceasefire: { label: "휴전·종전", icon: "🕊️" },
    summit: { label: "정상방문·회담", icon: "✈️" },
    envoy: { label: "특사·고위회담", icon: "🤝" },
    deal_ok: { label: "협상타결·협정", icon: "📜" },
    deal_fail: { label: "협상결렬·중단", icon: "❌" },
    criticism: { label: "외교비난·경고", icon: "📢" },
    protest: { label: "시위·총파업", icon: "🔥" },
    election: { label: "선거·정변", icon: "🗳️" },
    crisis: { label: "사회·치안위기", icon: "⚠️" },
    sanction: { label: "경제제재·관세", icon: "🛡️" },
    aid_tech: { label: "투자·원조·기술", icon: "💰" },
    macro: { label: "거시·시장동향", icon: "📈" },
  };

  const STATUS_COLOR = {
    red: "#ef4444",
    amber: "#f59e0b",
    green: "#10b981",
    gray: "#64748b",
  };

  const state = {
    dates: DATA.dates || [],
    currentDate: (DATA.dates && DATA.dates[DATA.dates.length - 1]) || "",
    activeType: "all",
    selectedCountries: new Set(),
    lastFocusedCountry: null,
    isPlayingEvents: true,
    isTimelapse: false,
    speed: 1,
    activeEventIdx: 0,
    filteredEvents: [],
    animFrameId: null,
    eventTimerId: null,
    timelapseTimerId: null,
    vx: 122,
    vy: 54,
    vw: 795,
    vh: 380,
    panFrameId: null,
    didDrag: false,
    marqueeOffset: 0,
    marqueePassWidth: 0,
    marqueeRanges: [],
    marqueeHovered: false,
    marqueeLastTs: 0,
    marqueeRafId: null,
    popupAnchorMeta: null,
    popupOffset: { dx: 0, dy: 0 },
  };

  // DOM Elements
  const els = {
    calYearNum: document.getElementById("calYearNum"),
    calWeekday: document.getElementById("calWeekday"),
    calMonthCard: document.getElementById("calMonthCard"),
    calMonthNum: document.getElementById("calMonthNum"),
    calDayCard: document.getElementById("calDayCard"),
    calDayNum: document.getElementById("calDayNum"),
    dateSelect: document.getElementById("dateSelect"),
    prevDateBtn: document.getElementById("prevDateBtn"),
    nextDateBtn: document.getElementById("nextDateBtn"),
    timelapseBtn: document.getElementById("timelapseBtn"),
    globalTensionBar: document.getElementById("globalTensionBar"),
    globalTensionVal: document.getElementById("globalTensionVal"),
    globalTensionBadge: document.getElementById("globalTensionBadge"),
    selectedChips: document.getElementById("selectedChips"),
    resetSelectionBtn: document.getElementById("resetSelectionBtn"),
    gridLayer: document.getElementById("gridLayer"),
    countriesMapLayer: document.getElementById("countriesMapLayer"),
    arcsLayer: document.getElementById("arcsLayer"),
    countriesLayer: document.getElementById("countriesLayer"),
    animLayer: document.getElementById("animLayer"),
    worldSvg: document.getElementById("worldSvg"),
    mapBg: document.getElementById("mapBg"),
    mapTooltip: document.getElementById("mapTooltip"),
    mapEventPopup: document.getElementById("mapEventPopup"),
    dossierCard: document.getElementById("dossierCard"),
    dossierFlag: document.getElementById("dossierFlag"),
    dossierName: document.getElementById("dossierName"),
    dossierMeta: document.getElementById("dossierMeta"),
    dossierScore: document.getElementById("dossierScore"),
    dossierScoreBar: document.getElementById("dossierScoreBar"),
    dossierAxes: document.getElementById("dossierAxes"),
    dossierTrend: document.getElementById("dossierTrend"),
    dossierCounts: document.getElementById("dossierCounts"),
    dossierInfo: document.getElementById("dossierInfo"),
    dossierEventCount: document.getElementById("dossierEventCount"),
    dossierEventsList: document.getElementById("dossierEventsList"),
    closeDossierBtn: document.getElementById("closeDossierBtn"),
    playEventsBtn: document.getElementById("playEventsBtn"),
    speedBtn: document.getElementById("speedBtn"),
    tickerTypeBadge: document.getElementById("tickerTypeBadge"),
    tickerRoute: document.getElementById("tickerRoute"),
    tickerHeadline: document.getElementById("tickerHeadline"),
    tickerQueue: document.getElementById("tickerQueue"),
    tickerMarqueeTrack: document.getElementById("tickerMarqueeTrack"),
    zoomInBtn: document.getElementById("zoomInBtn"),
    zoomOutBtn: document.getElementById("zoomOutBtn"),
    zoomResetBtn: document.getElementById("zoomResetBtn"),
  };

  function project(lat, lon) {
    const x = ((lon - LON_MIN) / (LON_MAX - LON_MIN)) * WIDTH;
    const y = ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * HEIGHT;
    return { x, y };
  }

  function applyViewBox() {
    els.worldSvg.setAttribute(
      "viewBox",
      `${state.vx.toFixed(1)} ${state.vy.toFixed(1)} ${state.vw.toFixed(1)} ${state.vh.toFixed(1)}`
    );
    positionMapEventPopup(true);
  }

  function clampViewBox() {
    state.vw = Math.max(180, Math.min(980, state.vw));
    state.vh = state.vw * (380 / 795);
    state.vx = Math.max(0, Math.min(1000 - state.vw, state.vx));
    state.vy = Math.max(0, Math.min(500 - state.vh, state.vy));
  }

  function zoomMap(factor, clientX = null, clientY = null) {
    const rect = els.worldSvg.getBoundingClientRect();
    let fx = 0.5, fy = 0.5;
    if (clientX !== null && clientY !== null && rect.width && rect.height) {
      fx = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      fy = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    }
    const anchorX = state.vx + state.vw * fx;
    const anchorY = state.vy + state.vh * fy;
    state.vw = Math.max(180, Math.min(980, state.vw * factor));
    state.vh = state.vw * (380 / 795);
    state.vx = anchorX - state.vw * fx;
    state.vy = anchorY - state.vh * fy;
    clampViewBox();
    applyViewBox();
  }

  function resetZoom() {
    state.vx = 122;
    state.vy = 54;
    state.vw = 795;
    state.vh = 380;
    applyViewBox();
  }

  function syncViewBox() {
    applyViewBox();
  }

  function svgEl(tag, attrs = {}) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) {
      el.setAttribute(k, v);
    }
    return el;
  }

  // Build static grid & world country borders once
  const countryPolyMap = new Map();

  function initBaseMap() {
    for (let x = 100; x < WIDTH; x += 100) {
      els.gridLayer.appendChild(svgEl("line", { x1: x, y1: 0, x2: x, y2: HEIGHT }));
    }
    for (let y = 80; y < HEIGHT; y += 80) {
      els.gridLayer.appendChild(svgEl("line", { x1: 0, y1: y, x2: WIDTH, y2: y }));
    }
    const frag = document.createDocumentFragment();
    for (const item of MAP_COUNTRIES) {
      const path = svgEl("path", {
        d: item.d,
        class: `land-poly${item.k ? " interactive" : ""}`,
      });
      if (item.k) {
        path.dataset.country = item.k;
        path.addEventListener("click", (e) => {
          e.stopPropagation();
          toggleCountry(item.k);
        });
        path.addEventListener("mouseenter", (e) => {
          const meta = DATA.countries[item.k];
          const st = (DATA.statusByDate[state.currentDate] || {})[item.k];
          if (meta) showTooltip(e, item.k, meta, st);
        });
        path.addEventListener("mousemove", moveTooltip);
        path.addEventListener("mouseleave", hideTooltip);
        if (!countryPolyMap.has(item.k)) countryPolyMap.set(item.k, []);
        countryPolyMap.get(item.k).push(path);
      }
      frag.appendChild(path);
    }
    els.countriesMapLayer.appendChild(frag);
  }

  function initDateSelect() {
    const frag = document.createDocumentFragment();
    for (let i = state.dates.length - 1; i >= 0; i--) {
      const d = state.dates[i];
      const opt = document.createElement("option");
      opt.value = d;
      opt.textContent = d;
      frag.appendChild(opt);
    }
    els.dateSelect.appendChild(frag);
    els.dateSelect.value = state.currentDate;
  }

  function getFilteredEvents() {
    const raw = DATA.eventsByDate[state.currentDate] || [];
    return raw.filter((ev) => {
      if (state.activeType !== "all" && ev.type !== state.activeType) return false;
      if (state.selectedCountries.size > 0) {
        const hitFrom =
          state.selectedCountries.has(ev.from) ||
          (ev.fromList && ev.fromList.some((k) => state.selectedCountries.has(k)));
        const hitTo = ev.to && state.selectedCountries.has(ev.to);
        if (!hitFrom && !hitTo) return false;
      }
      return true;
    });
  }

  function toggleCountry(cKey) {
    if (state.didDrag) {
      state.didDrag = false;
      return;
    }
    if (state.selectedCountries.has(cKey)) {
      state.selectedCountries.clear();
      state.lastFocusedCountry = null;
    } else {
      state.selectedCountries.clear();
      state.selectedCountries.add(cKey);
      state.lastFocusedCountry = cKey;
    }
    state.activeEventIdx = 0;
    renderAll();
  }

  function clearSelection() {
    if (state.selectedCountries.size === 0) return;
    state.selectedCountries.clear();
    state.lastFocusedCountry = null;
    state.activeEventIdx = 0;
    renderAll();
  }

  function triggerCalFlip(cardEl) {
    if (!cardEl) return;
    cardEl.classList.remove("flipping");
    void cardEl.offsetWidth;
    cardEl.classList.add("flipping");
  }

  function renderHeader() {
    els.dateSelect.value = state.currentDate;
    if (state.currentDate && els.calYearNum && els.calMonthNum && els.calDayNum && els.calWeekday) {
      const [yr, mo, dy] = state.currentDate.split("-");
      const prevMo = els.calMonthNum.textContent;
      const prevDy = els.calDayNum.textContent;
      const newMo = String(Number(mo));
      const newDy = String(Number(dy));

      els.calYearNum.textContent = yr;
      els.calMonthNum.textContent = newMo;
      els.calDayNum.textContent = newDy;

      if (prevMo && prevMo !== newMo) triggerCalFlip(els.calMonthCard);
      if (prevDy && prevDy !== newDy) triggerCalFlip(els.calDayCard);

      const dt = new Date(`${state.currentDate}T00:00:00`);
      const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
      const dayIdx = Number.isNaN(dt.getTime()) ? -1 : dt.getDay();
      els.calWeekday.textContent = dayIdx >= 0 ? `${weekdays[dayIdx]}요일` : "";
      els.calWeekday.classList.toggle("sun", dayIdx === 0);
      els.calWeekday.classList.toggle("sat", dayIdx === 6);
    }
    const t = DATA.globalTension[state.currentDate] ?? 50;
    els.globalTensionVal.textContent = t;
    els.globalTensionBar.style.width = `${t}%`;

    let badge = "안정", bg = "rgba(5,150,105,0.12)", fg = "#065f46";
    if (t >= 65) {
      badge = "위기"; bg = "rgba(220,38,38,0.12)"; fg = "#991b1b";
    } else if (t >= 52) {
      badge = "긴장"; bg = "rgba(217,119,6,0.14)"; fg = "#92400e";
    } else if (t >= 42) {
      badge = "경계"; bg = "rgba(3,105,161,0.12)"; fg = "#075985";
    }
    els.globalTensionBadge.textContent = badge;
    els.globalTensionBadge.style.background = bg;
    els.globalTensionBadge.style.color = fg;
  }

  function renderSelectionChips() {
    els.selectedChips.innerHTML = "";
    if (state.selectedCountries.size === 0) {
      const hint = document.createElement("span");
      hint.className = "hint-text";
      hint.textContent = "국가 클릭: 단독 집중 · 재클릭 또는 배경 클릭: 전체 보기";
      els.selectedChips.appendChild(hint);
      els.resetSelectionBtn.classList.add("hidden");
      return;
    }
    els.resetSelectionBtn.classList.remove("hidden");
    for (const cKey of state.selectedCountries) {
      const meta = DATA.countries[cKey];
      if (!meta) continue;
      const chip = document.createElement("button");
      chip.className = "country-chip";
      chip.textContent = `${meta.flag} ${meta.ko} ×`;
      chip.title = "클릭하여 선택 해제";
      chip.addEventListener("click", () => toggleCountry(cKey));
      els.selectedChips.appendChild(chip);
    }
  }

  function renderCountries() {
    els.countriesLayer.innerHTML = "";
    const statusMap = DATA.statusByDate[state.currentDate] || {};
    const hasSel = state.selectedCountries.size > 0;

    // Determine countries connected to selected countries via filtered events
    const connectedSet = new Set(state.selectedCountries);
    if (hasSel) {
      for (const ev of state.filteredEvents) {
        const hitFrom =
          state.selectedCountries.has(ev.from) ||
          (ev.fromList && ev.fromList.some((k) => state.selectedCountries.has(k)));
        if (hitFrom && ev.to) connectedSet.add(ev.to);
        if (ev.to && state.selectedCountries.has(ev.to)) {
          connectedSet.add(ev.from);
          if (ev.fromList) ev.fromList.forEach((k) => connectedSet.add(k));
        }
      }
    }

    // Update country border polygon highlights
    for (const [cKey, polys] of countryPolyMap.entries()) {
      const st = statusMap[cKey];
      const colorName = st ? st.color : "gray";
      const isSelected = state.selectedCountries.has(cKey);
      const isDimmed = hasSel && !connectedSet.has(cKey);
      for (const poly of polys) {
        poly.setAttribute(
          "class",
          `land-poly interactive${colorName !== "gray" ? ` status-${colorName}` : ""}${isSelected ? " selected" : ""}${isDimmed ? " dimmed" : ""}`
        );
      }
    }

    const CORE_COUNTRIES = new Set([
      "korea", "usa", "china", "japan", "russia", "uk", "france", "germany",
      "india", "australia", "canada", "brazil", "italy", "spain", "ukraine",
      "israel", "iran", "saudi-arabia", "turkey", "indonesia", "vietnam", "mexico",
    ]);
    const activeInEvents = new Set();
    for (const ev of state.filteredEvents) {
      if (ev.from) activeInEvents.add(ev.from);
      if (ev.to) activeInEvents.add(ev.to);
      if (ev.fromList) ev.fromList.forEach((k) => activeInEvents.add(k));
    }

    const frag = document.createDocumentFragment();
    for (const [cKey, meta] of Object.entries(DATA.countries)) {
      const st = statusMap[cKey];
      const isSelected = state.selectedCountries.has(cKey);
      // Only show pins for major core countries, selected countries, or countries with active news/status
      if (!st && !isSelected && !activeInEvents.has(cKey) && !CORE_COUNTRIES.has(cKey)) {
        continue;
      }

      const { x, y } = project(meta.lat, meta.lon);
      const colorName = st ? st.color : "gray";
      const fill = STATUS_COLOR[colorName] || STATUS_COLOR.gray;
      const isDimmed = hasSel && !connectedSet.has(cKey);

      const g = svgEl("g", {
        class: `country-node${isSelected ? " selected" : ""}${isDimmed ? " dimmed" : ""}`,
        "data-country": cKey,
      });

      if ((colorName === "red" || isSelected) && !isDimmed) {
        g.appendChild(svgEl("circle", {
          cx: x, cy: y, r: isSelected ? 7 : 5,
          stroke: isSelected ? "#0284c7" : fill,
          class: "pulse-ring",
        }));
      }

      const core = svgEl("circle", {
        cx: x, cy: y,
        r: isSelected ? 6 : (st ? 4.4 : 3.2),
        fill: isSelected ? "#0284c7" : fill,
        stroke: isSelected ? "#ffffff" : "#fcfbf9",
        "stroke-width": isSelected ? 1.6 : 1.0,
        class: "country-core",
      });
      if (colorName === "red" && !isDimmed) {
        core.setAttribute("filter", "url(#glowRed)");
      }
      g.appendChild(core);

      const label = svgEl("text", { x, y: y - 7.5, class: "country-label" });
      label.textContent = meta.ko;
      g.appendChild(label);

      g.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleCountry(cKey);
      });
      g.addEventListener("mouseenter", (e) => showTooltip(e, cKey, meta, st));
      g.addEventListener("mousemove", moveTooltip);
      g.addEventListener("mouseleave", hideTooltip);

      frag.appendChild(g);
    }
    els.countriesLayer.appendChild(frag);
  }

  function getTrendDirection(score, daily) {
    const diff = (daily ?? score) - score;
    if (diff >= 3) return { symbol: "▲", cls: "up", label: "상승 중" };
    if (diff <= -3) return { symbol: "▼", cls: "down", label: "하강 중" };
    return { symbol: "▶", cls: "flat", label: "보합" };
  }

  function showTooltip(e, cKey, meta, st) {
    let scoreTxt = "보도 없음";
    if (st) {
      const daily = st.daily ?? st.score;
      const dir = getTrendDirection(st.score, daily);
      const statusSuffix = st.asOf && st.asOf !== state.currentDate
        ? `(${st.asOf} 유지)`
        : "";
      scoreTxt = `긴장도 ${st.score} · 당일 ${daily} <span class="trend-dir ${dir.cls}">${dir.symbol}</span> ${statusSuffix}`.trim();
    }
    els.mapTooltip.innerHTML = `<strong>${meta.flag} ${meta.ko}</strong> <span style="color:#64748b">(${meta.region})</span><br><span style="color:#0369a1">${scoreTxt}</span>`;
    els.mapTooltip.classList.remove("hidden");
    moveTooltip(e);
  }

  function moveTooltip(e) {
    const stage = els.mapTooltip.parentElement;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const relY = e.clientY - rect.top;
    const tipW = els.mapTooltip.offsetWidth || 190;
    const tipH = els.mapTooltip.offsetHeight || 44;
    const pad = 10;
    const gap = 14;

    const preferLeft = relX > rect.width * 0.55;
    const preferTop = relY > rect.height * 0.45;
    const rawCandidates = [
      { x: relX - tipW - gap, y: relY - tipH - gap, order: (preferLeft ? 0 : 2) + (preferTop ? 0 : 1) },
      { x: relX + gap, y: relY - tipH - gap, order: (preferLeft ? 2 : 0) + (preferTop ? 0 : 1) },
      { x: relX - tipW - gap, y: relY + gap, order: (preferLeft ? 0 : 2) + (preferTop ? 1 : 0) },
      { x: relX + gap, y: relY + gap, order: (preferLeft ? 2 : 0) + (preferTop ? 1 : 0) },
    ];
    rawCandidates.sort((a, b) => a.order - b.order);

    const ctm = els.worldSvg ? els.worldSvg.getScreenCTM() : null;
    const pinPts = [];
    if (ctm) {
      Object.values(DATA.countries).forEach((meta) => {
        const pt = project(meta.lat, meta.lon);
        pinPts.push({
          x: pt.x * ctm.a + ctm.e - rect.left,
          y: pt.y * ctm.d + ctm.f - rect.top,
        });
      });
    }

    let best = null;
    let bestPenalty = Infinity;
    for (const c of rawCandidates) {
      const oob =
        (c.x < pad ? pad - c.x : 0) +
        (c.x + tipW > rect.width - pad ? c.x + tipW - (rect.width - pad) : 0) +
        (c.y < pad ? pad - c.y : 0) +
        (c.y + tipH > rect.height - pad ? c.y + tipH - (rect.height - pad) : 0);

      const cx = Math.max(pad, Math.min(rect.width - tipW - pad, c.x));
      const cy = Math.max(pad, Math.min(rect.height - tipH - pad, c.y));

      const coversCursor =
        relX >= cx - 6 && relX <= cx + tipW + 6 && relY >= cy - 6 && relY <= cy + tipH + 6;

      let pinHits = 0;
      for (const p of pinPts) {
        if (p.x >= cx - 10 && p.x <= cx + tipW + 10 && p.y >= cy - 10 && p.y <= cy + tipH + 10) {
          pinHits++;
        }
      }

      const penalty = oob * 5 + (coversCursor ? 500 : 0) + pinHits * 15 + c.order;
      if (penalty < bestPenalty) {
        bestPenalty = penalty;
        best = { x: cx, y: cy };
      }
    }

    els.mapTooltip.style.left = `${Math.round(best.x)}px`;
    els.mapTooltip.style.top = `${Math.round(best.y)}px`;
  }

  function hideTooltip() {
    els.mapTooltip.classList.add("hidden");
  }

  function makeArcPath(fromKey, toKey) {
    const a = DATA.countries[fromKey];
    const b = DATA.countries[toKey];
    if (!a || !b) return null;
    const p1 = project(a.lat, a.lon);
    const p2 = project(b.lat, b.lon);
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dist = Math.hypot(dx, dy);
    const mx = (p1.x + p2.x) / 2;
    const my = (p1.y + p2.y) / 2 - Math.min(75, dist * 0.25);
    return {
      d: `M ${p1.x} ${p1.y} Q ${mx} ${my} ${p2.x} ${p2.y}`,
      p1,
      p2,
    };
  }

  function formatEventRoute(ev, compact = false) {
    const fromMeta = DATA.countries[ev.from];
    const toMeta = ev.to ? DATA.countries[ev.to] : null;
    if (!fromMeta) return "-";
    if (ev.fromList && ev.fromList.length > 1 && toMeta) {
      const grp = ev.groupLabel || `${fromMeta.flag} ${fromMeta.ko} 외 ${ev.fromList.length - 1}개국`;
      return compact ? `${grp}→${toMeta.ko}` : `${grp} → ${toMeta.flag} ${toMeta.ko}`;
    }
    if (toMeta) {
      return compact ? `${fromMeta.ko}→${toMeta.ko}` : `${fromMeta.flag} ${fromMeta.ko} → ${toMeta.flag} ${toMeta.ko}`;
    }
    return compact ? fromMeta.ko : `${fromMeta.flag} ${fromMeta.ko} (국내)`;
  }

  function renderBackgroundArcs() {
    els.arcsLayer.innerHTML = "";
    const frag = document.createDocumentFragment();
    state.filteredEvents.forEach((ev, idx) => {
      if (!ev.to || !DATA.countries[ev.to]) return;
      const isActive = idx === state.activeEventIdx;
      const sources = ev.fromList && ev.fromList.length > 1 ? ev.fromList : [ev.from];
      sources.forEach((fKey) => {
        const arc = makeArcPath(fKey, ev.to);
        if (!arc) return;
        const path = svgEl("path", {
          d: arc.d,
          class: `event-arc ${ev.type} ${isActive ? "active" : "bg"}`,
        });
        frag.appendChild(path);
      });
    });
    els.arcsLayer.appendChild(frag);
  }

  function summarizePopupText(text, maxLen = 40) {
    const clean = (text || "").replace(/\s+/g, " ").trim();
    if (clean.length <= maxLen) return clean;
    const cut = clean.slice(0, maxLen - 1);
    const comma = cut.indexOf(",");
    if (comma > 14) return cut.slice(0, comma) + "…";
    const sp = cut.lastIndexOf(" ");
    if (sp > maxLen * 0.55) return cut.slice(0, sp) + "…";
    return cut + "…";
  }

  function positionMapEventPopup(instant = false) {
    if (!state.popupAnchorMeta || els.mapEventPopup.classList.contains("hidden")) return;
    const ctm = els.worldSvg.getScreenCTM();
    const stage = els.worldSvg.parentElement;
    if (!ctm || !stage) return;
    const stageRect = stage.getBoundingClientRect();
    const pt = project(state.popupAnchorMeta.lat, state.popupAnchorMeta.lon);
    const px = pt.x * ctm.a + ctm.e - stageRect.left;
    const py = pt.y * ctm.d + ctm.f - stageRect.top;
    els.mapEventPopup.style.transition = instant ? "none" : "";
    els.mapEventPopup.style.left = `${Math.round(px + state.popupOffset.dx)}px`;
    els.mapEventPopup.style.top = `${Math.round(py + state.popupOffset.dy)}px`;
  }

  function showMapEventPopup(ev, fromMeta, toMeta, tMeta) {
    if (!fromMeta) {
      state.popupAnchorMeta = null;
      els.mapEventPopup.classList.add("hidden");
      return;
    }

    // Anchor below the focused country if single-selected, otherwise below destination (or source)
    let anchorMeta = toMeta || fromMeta;
    if (state.selectedCountries.size === 1 && state.lastFocusedCountry && DATA.countries[state.lastFocusedCountry]) {
      anchorMeta = DATA.countries[state.lastFocusedCountry];
    }
    state.popupAnchorMeta = anchorMeta;

    const sMeta = SUBTYPE_META[ev.sub] || tMeta;
    const routeText = formatEventRoute(ev, false);

    els.mapEventPopup.className = `map-event-popup ${ev.type}`;
    els.mapEventPopup.innerHTML = `
      <div class="mep-meta-row">
        <span class="mep-badge ${ev.type}">${sMeta.icon} ${sMeta.label}</span>
        <span class="mep-date">${state.currentDate}</span>
      </div>
      <div class="mep-head">
        <span class="mep-route">${routeText}</span>
      </div>
      <div class="mep-body">${ev.short || summarizePopupText(ev.headline)}</div>
    `;

    const ctm = els.worldSvg.getScreenCTM();
    const stage = els.worldSvg.parentElement;
    if (!ctm || !stage) return;
    const stageRect = stage.getBoundingClientRect();
    const pt = project(anchorMeta.lat, anchorMeta.lon);
    const px = pt.x * ctm.a + ctm.e - stageRect.left;
    const py = pt.y * ctm.d + ctm.f - stageRect.top;

    const popupW = Math.min(245, stageRect.width - 24);
    const maxRight = stageRect.width - 12;

    let left = Math.round(px - popupW / 2);
    left = Math.max(12, Math.min(maxRight - popupW, left));

    let top = Math.round(py + (state.selectedCountries.size > 0 ? 24 : 18));
    if (top + 115 > stageRect.height) {
      top = Math.max(12, Math.round(py - 110));
    }

    state.popupOffset = { dx: left - px, dy: top - py };
    els.mapEventPopup.style.transition = "";
    els.mapEventPopup.style.left = `${left}px`;
    els.mapEventPopup.style.top = `${top}px`;
  }

  function stopEventAnimation() {
    if (state.animFrameId) {
      cancelAnimationFrame(state.animFrameId);
      state.animFrameId = null;
    }
    if (state.eventTimerId) {
      clearTimeout(state.eventTimerId);
      state.eventTimerId = null;
    }
  }

  function playActiveEvent() {
    stopEventAnimation();
    els.animLayer.innerHTML = "";

    const events = state.filteredEvents;
    if (!events.length) {
      els.tickerTypeBadge.className = "ev-badge";
      els.tickerTypeBadge.textContent = "NONE";
      els.tickerRoute.textContent = "-";
      els.tickerHeadline.textContent = "선택된 조건에 해당하는 이벤트가 없습니다.";
      els.mapEventPopup.classList.add("hidden");
      renderTickerQueue();
      return;
    }

    if (state.activeEventIdx >= events.length) state.activeEventIdx = 0;
    const ev = events[state.activeEventIdx];
    const tMeta = TYPE_META[ev.type] || TYPE_META.diplomacy;
    const sMeta = SUBTYPE_META[ev.sub] || tMeta;
    const fromMeta = DATA.countries[ev.from];
    const toMeta = ev.to ? DATA.countries[ev.to] : null;

    // Update ticker UI
    els.tickerTypeBadge.className = `ev-badge ${ev.type}`;
    els.tickerTypeBadge.textContent = `${sMeta.icon} ${sMeta.label}`;
    els.tickerRoute.textContent = formatEventRoute(ev, false);
    els.tickerHeadline.textContent = ev.headline;

    showMapEventPopup(ev, fromMeta, toMeta, tMeta);
    renderBackgroundArcs();
    renderTickerQueue();
    highlightDossierEvent(ev.id);
    highlightMarqueeItem(state.activeEventIdx);

    // Draw SVG animation for active event (supports single or multilateral converging arcs)
    const sub = ev.sub || "";
    const spawnMoneyFountain = (cx, cy) => {
      const particles = [];
      const count = 11;
      for (let i = 0; i < count; i++) {
        const isBill = i % 3 === 0;
        const pg = svgEl("g", { transform: `translate(${cx}, ${cy})` });
        if (isBill) {
          pg.appendChild(svgEl("rect", {
            x: -6, y: -3.5, width: 12, height: 7, rx: 1.5,
            fill: "#22c55e", stroke: "#15803d", "stroke-width": "0.9",
          }));
          const bt = svgEl("text", {
            x: 0, y: 0.4, "text-anchor": "middle", "dominant-baseline": "central",
            fill: "#fef08a", "font-size": "6.5", "font-weight": "900",
          });
          bt.textContent = "$";
          pg.appendChild(bt);
        } else {
          pg.appendChild(svgEl("circle", {
            cx: 0, cy: 0, r: 4.6,
            fill: "#facc15", stroke: "#ca8a04", "stroke-width": "0.9",
          }));
          const ct = svgEl("text", {
            x: 0, y: 0.4, "text-anchor": "middle", "dominant-baseline": "central",
            fill: "#15803d", "font-size": "6.5", "font-weight": "900",
          });
          ct.textContent = "$";
          pg.appendChild(ct);
        }
        els.animLayer.appendChild(pg);
        const spread = (i - (count - 1) / 2) / ((count - 1) / 2);
        particles.push({
          el: pg,
          vx: spread * (16 + Math.random() * 14),
          vy: -(28 + Math.random() * 20),
          rot: (Math.random() - 0.5) * 180,
          delay: (i % 4) * 0.08,
        });
      }
      const fStart = performance.now();
      const fDur = Math.round(1600 / state.speed);
      const gravity = 76;
      function stepFountain(now) {
        const rawT = (now - fStart) / fDur;
        let alive = false;
        for (const p of particles) {
          const lt = Math.max(0, rawT - p.delay);
          if (lt <= 1) alive = true;
          const px = cx + p.vx * lt;
          const py = cy + p.vy * lt + 0.5 * gravity * lt * lt;
          const op = lt >= 1 ? 0 : Math.max(0, 1 - Math.pow(lt, 1.8));
          p.el.setAttribute("transform", `translate(${px.toFixed(1)}, ${py.toFixed(1)}) rotate(${(p.rot * lt).toFixed(1)})`);
          p.el.setAttribute("opacity", op.toFixed(2));
        }
        if (alive) {
          state.animFrameId = requestAnimationFrame(stepFountain);
        }
      }
      state.animFrameId = requestAnimationFrame(stepFountain);
    };

    if (toMeta) {
      const sources = ev.fromList && ev.fromList.length > 1 ? ev.fromList : [ev.from];
      const isDirectional = sub === "summit" || sub === "airstrike" || sub === "missile" || (ev.type === "diplomacy" && sub === "envoy");

      const createVehicleGroup = (p1) => {
        const vg = svgEl("g", {
          transform: `translate(${p1.x}, ${p1.y})`,
          filter: "url(#glowSoft)",
        });
        if (sub === "summit" || (ev.type === "diplomacy" && sub === "envoy")) {
          vg.appendChild(svgEl("path", {
            d: "M 13,0 C 10,-2 6,-2.2 2,-2.2 L -3,-12.5 L -6,-12.5 L -2.5,-2.2 L -9,-1.7 L -11.8,-5 L -13.6,-5 L -11.5,0 L -13.6,5 L -11.8,5 L -9,1.7 L -2.5,2.2 L -6,12.5 L -3,12.5 L 2,2.2 C 6,2.2 10,2 13,0 Z",
            fill: "#34d399",
            stroke: "#064e3b",
            "stroke-width": "0.85",
          }));
        } else if (sub === "missile") {
          vg.appendChild(svgEl("path", {
            d: "M 14,0 L 6,-2.5 L -8,-2.5 L -12,-5.5 L -10,-2 L -10,2 L -12,5.5 L -8,2.5 L 6,2.5 Z",
            fill: "#ef4444",
            stroke: "#fef08a",
            "stroke-width": "0.8",
          }));
          vg.appendChild(svgEl("path", {
            d: "M -10,-1.5 L -16,0 L -10,1.5 Z",
            fill: "#f97316",
          }));
        } else if (sub === "airstrike") {
          vg.appendChild(svgEl("path", {
            d: "M 14,0 L 3,-2 L -9,-10.5 L -11,-8 L -7,-2 L -12,-3.5 L -10.5,0 L -12,3.5 L -7,2 L -11,8 L -9,10.5 L 3,2 Z",
            fill: "#f87171",
            stroke: "#7f1d1d",
            "stroke-width": "0.85",
          }));
        } else if (sub === "naval") {
          vg.appendChild(svgEl("path", {
            d: "M -13,2 L -10,6 L 10,6 L 14,1 L 6,1 L 4,-3 L 1,-3 L 1,-7 L -2,-7 L -2,-3 L -6,-3 L -7,1 L -13,1 Z",
            fill: "#f87171",
            stroke: "#fef2f2",
            "stroke-width": "0.7",
          }));
        } else if (sub === "ground") {
          vg.appendChild(svgEl("path", {
            d: "M -13,2 L -9,2 L -7,5 L -4,5 L -5,2 L 4,2 L 4,0.5 L 13,0.5 L 13,-1 L 3,-1 L 1,-3 L -4,-3 L -6,-1 L -13,-1 Z",
            fill: "#f87171",
            stroke: "#7f1d1d",
            "stroke-width": "0.6",
          }));
        } else if (sub === "sanction") {
          // Tariff / Sanction Shield + Hazard Barricade Emblem
          vg.appendChild(svgEl("path", {
            d: "M 0,-11.5 L 9.5,-7.5 L 9.5,1 C 9.5,7 0,11.5 0,11.5 C 0,11.5 -9.5,7 -9.5,1 L -9.5,-7.5 Z",
            fill: "#991b1b",
            stroke: "#fbbf24",
            "stroke-width": "1.3",
          }));
          vg.appendChild(svgEl("rect", {
            x: -10.5, y: -2.6, width: 21, height: 5.2, rx: 1.2,
            fill: "#f59e0b",
            stroke: "#451a03",
            "stroke-width": "0.9",
          }));
          vg.appendChild(svgEl("path", {
            d: "M -7.5,-2.4 L -4,2.4 M -1.5,-2.4 L 2,2.4 M 4.5,-2.4 L 8,2.4",
            stroke: "#451a03",
            "stroke-width": "1.8",
            "stroke-linecap": "butt",
          }));
        } else if (sub === "aid_tech") {
          // Bright gold coin + emerald green $ emblem
          vg.appendChild(svgEl("circle", {
            cx: 0, cy: 0, r: 10.5,
            fill: "#facc15",
            stroke: "#ca8a04",
            "stroke-width": "1.4",
          }));
          vg.appendChild(svgEl("circle", {
            cx: 0, cy: 0, r: 8.2,
            fill: "none",
            stroke: "#fef08a",
            "stroke-width": "0.9",
          }));
          const dText = svgEl("text", {
            x: 0, y: 0.6,
            "text-anchor": "middle",
            "dominant-baseline": "central",
            fill: "#15803d",
            "font-size": "13.5",
            "font-weight": "900",
          });
          dText.textContent = "$";
          vg.appendChild(dText);
        } else {
          const iconText = svgEl("text", { class: "moving-badge", x: 0, y: 0 });
          iconText.textContent = sMeta.icon;
          vg.appendChild(iconText);
        }
        return vg;
      };

      const movers = [];
      sources.forEach((fKey) => {
        const arc = makeArcPath(fKey, ev.to);
        if (!arc) return;
        const animPath = svgEl("path", {
          d: arc.d,
          class: `event-arc ${ev.type} active`,
          filter: "url(#glowSoft)",
        });
        els.arcsLayer.appendChild(animPath);
        const vg = createVehicleGroup(arc.p1);
        els.animLayer.appendChild(vg);
        movers.push({ animPath, totalLen: animPath.getTotalLength(), vg });
      });

      if (movers.length > 0) {
        const duration = Math.round(1600 / state.speed);
        const start = performance.now();
        let rippleSpawned = false;

        function step(now) {
          const prog = Math.min(1, (now - start) / duration);
          for (const m of movers) {
            const dist = prog * m.totalLen;
            const pt = m.animPath.getPointAtLength(dist);
            if (isDirectional && m.totalLen > 4) {
              const pBack = m.animPath.getPointAtLength(Math.max(0, dist - 2));
              const pFwd = m.animPath.getPointAtLength(Math.min(m.totalLen, dist + 2));
              const angle = Math.atan2(pFwd.y - pBack.y, pFwd.x - pBack.x) * (180 / Math.PI);
              m.vg.setAttribute("transform", `translate(${pt.x}, ${pt.y}) rotate(${angle.toFixed(1)})`);
            } else {
              m.vg.setAttribute("transform", `translate(${pt.x}, ${pt.y})`);
            }
          }
          if (prog >= 1 && !rippleSpawned) {
            rippleSpawned = true;
            const destPt = project(toMeta.lat, toMeta.lon);
            if (sub === "aid_tech") {
              spawnMoneyFountain(destPt.x, destPt.y);
            } else if (sources.length > 1) {
              els.animLayer.appendChild(svgEl("circle", {
                cx: destPt.x, cy: destPt.y, r: 8,
                stroke: tMeta.color,
                class: "ripple-wave",
              }));
            }
          }
          if (prog < 1) {
            state.animFrameId = requestAnimationFrame(step);
          }
        }
        state.animFrameId = requestAnimationFrame(step);
      }
    } else if (fromMeta) {
      const pt = project(fromMeta.lat, fromMeta.lon);
      els.animLayer.appendChild(svgEl("circle", {
        cx: pt.x, cy: pt.y, r: 6.5,
        stroke: tMeta.color,
        class: "ripple-wave",
      }));
      if (sub === "aid_tech" || (ev.type === "economy" && sub !== "sanction")) {
        spawnMoneyFountain(pt.x, pt.y);
      } else {
        const iconText = svgEl("text", { x: pt.x, y: pt.y - 16, class: "moving-badge" });
        iconText.textContent = sMeta.icon;
        els.animLayer.appendChild(iconText);
      }
    }

    // Next event triggers when the marquee item scrolls to the viewport center
  }

  function renderTickerQueue() {
    els.tickerQueue.innerHTML = "";
    const frag = document.createDocumentFragment();
    state.filteredEvents.forEach((ev, idx) => {
      const btn = document.createElement("button");
      btn.className = `q-dot${idx === state.activeEventIdx ? " active" : ""}`;
      btn.title = ev.headline;
      btn.addEventListener("click", () => {
        state.activeEventIdx = idx;
        centerMarqueeOnEvent(idx);
        playActiveEvent();
      });
      frag.appendChild(btn);
    });
    els.tickerQueue.appendChild(frag);
  }

  function renderDossierCard() {
    if (state.selectedCountries.size === 0 || !state.lastFocusedCountry) {
      els.dossierCard.classList.add("hidden");
      return;
    }
    const cKey = state.lastFocusedCountry;
    const meta = DATA.countries[cKey];
    if (!meta) return;

    const statusMap = DATA.statusByDate[state.currentDate] || {};
    const st = statusMap[cKey];
    const score = st ? st.score : 40;

    els.dossierFlag.textContent = meta.flag;
    els.dossierName.textContent = state.selectedCountries.size > 1
      ? `${meta.ko} (외 ${state.selectedCountries.size - 1}개국 선택)`
      : `${meta.ko} (${meta.en})`;
    els.dossierMeta.textContent = `${meta.region} · 수도 ${meta.capital || "-"}`;
    if (st) {
      const daily = st.daily ?? score;
      const dir = getTrendDirection(score, daily);
      const carriedNote = st.asOf && st.asOf !== state.currentDate ? ` <span style="color:#64748b;font-size:10.5px;">(${st.asOf} 유지)</span>` : "";
      els.dossierScore.innerHTML = `${score} / 100 <span class="daily-chip" title="누적 평균 대비 당일 긴장도 (${dir.label})">당일 ${daily} <span class="trend-dir ${dir.cls}">${dir.symbol}</span></span>${carriedNote}`;
    } else {
      els.dossierScore.textContent = "보도 없음";
    }
    els.dossierScoreBar.style.width = `${score}%`;

    renderDossierAxes(st);
    renderDossierTrend(cKey);

    els.dossierCounts.innerHTML = st
      ? `
        <span class="stat-pill">⚔️ 군사 ${st.m}</span>
        <span class="stat-pill">🔥 시위 ${st.u}</span>
        <span class="stat-pill">✈️ 외교 ${st.d}</span>
        <span class="stat-pill">💲 경제 ${st.e}</span>
      `
      : `<span class="stat-pill">추출 이벤트 없음</span>`;

    els.dossierInfo.textContent = `${meta.system || ""} · ${meta.economy || ""}`.replace(/^\s*·\s*|\s*·\s*$/g, "");

    let displayEvents = state.filteredEvents;
    let isCarriedRef = false;
    if (displayEvents.length === 0 && st && st.asOf && st.asOf !== state.currentDate) {
      const refRaw = DATA.eventsByDate[st.asOf] || [];
      displayEvents = refRaw.filter(
        (ev) => ev.from === cKey || ev.to === cKey || (ev.fromList && ev.fromList.includes(cKey))
      );
      isCarriedRef = displayEvents.length > 0;
    }

    els.dossierEventCount.textContent = isCarriedRef
      ? `${displayEvents.length} · ${st.asOf} 유지`
      : displayEvents.length;
    els.dossierEventsList.innerHTML = "";
    const frag = document.createDocumentFragment();
    displayEvents.forEach((ev, idx) => {
      const li = document.createElement("li");
      li.className = "dossier-event-item";
      li.dataset.evId = ev.id;
      const tMeta = TYPE_META[ev.type] || TYPE_META.diplomacy;
      const route = formatEventRoute(ev, true);
      li.innerHTML = `<div style="color:${tMeta.color};font-weight:700;margin-bottom:2px;">${tMeta.icon} ${route}</div><div>${ev.headline}</div>`;
      if (!isCarriedRef) {
        li.addEventListener("click", () => {
          state.activeEventIdx = idx;
          centerMarqueeOnEvent(idx);
          playActiveEvent();
        });
      }
      frag.appendChild(li);
    });
    els.dossierEventsList.appendChild(frag);
    els.dossierCard.classList.remove("hidden");
  }

  function axisBarColor(val) {
    if (val >= 68) return "#ef4444";
    if (val >= 48) return "#f59e0b";
    return "#10b981";
  }

  function renderDossierAxes(st) {
    if (!els.dossierAxes) return;
    if (!st) {
      els.dossierAxes.innerHTML = "";
      return;
    }
    const axes = [
      { label: "외교·안보", val: st.dip ?? st.score },
      { label: "국내·사회", val: st.dom ?? st.score },
      { label: "경제·산업", val: st.eco ?? st.score },
    ];
    els.dossierAxes.innerHTML = axes.map((a) => `
      <div class="axis-row">
        <span class="axis-lbl">${a.label}</span>
        <div class="axis-track"><div class="axis-fill" style="width:${a.val}%;background:${axisBarColor(a.val)}"></div></div>
        <span class="axis-num" style="color:${axisBarColor(a.val)}">${a.val}</span>
      </div>
    `).join("");
  }

  function renderDossierTrend(cKey) {
    if (!els.dossierTrend) return;
    const endIdx = state.dates.indexOf(state.currentDate);
    if (endIdx < 0) {
      els.dossierTrend.innerHTML = "";
      return;
    }

    const [ey, em, ed] = state.currentDate.split("-").map(Number);
    const cutoffDate = new Date(Date.UTC(ey - 1, em - 1, ed)).toISOString().slice(0, 10);

    const rawPts = [];
    for (let i = 0; i <= endIdx; i++) {
      const d = state.dates[i];
      if (d < cutoffDate) continue;
      const st = (DATA.statusByDate[d] || {})[cKey];
      if (st) {
        rawPts.push({
          d,
          score: st.score,
          daily: st.daily ?? st.score,
          dip: st.dip ?? st.score,
          dom: st.dom ?? st.score,
          eco: st.eco ?? st.score,
        });
      }
    }
    if (rawPts.length < 2) {
      els.dossierTrend.innerHTML = `<div class="trend-head"><span>최근 1년 추이</span><span>데이터 축적 중</span></div>`;
      return;
    }

    // Smooth high-density series with a gentle centered moving average, preserving endpoints
    const radius = rawPts.length > 180 ? 3 : rawPts.length > 80 ? 2 : rawPts.length > 35 ? 1 : 0;
    const smoothed = radius === 0 ? rawPts : rawPts.map((p, idx) => {
      if (idx === 0 || idx === rawPts.length - 1) return p;
      const lo = Math.max(0, idx - radius);
      const hi = Math.min(rawPts.length - 1, idx + radius);
      let sScore = 0, sDip = 0, sDom = 0, sEco = 0;
      const cnt = hi - lo + 1;
      for (let j = lo; j <= hi; j++) {
        sScore += rawPts[j].score;
        sDip += rawPts[j].dip;
        sDom += rawPts[j].dom;
        sEco += rawPts[j].eco;
      }
      return {
        d: p.d,
        score: sScore / cnt,
        dip: sDip / cnt,
        dom: sDom / cnt,
        eco: sEco / cnt,
      };
    });

    // Downsample to ~64 evenly-spaced points for clean SVG rendering
    const MAX_PTS = 64;
    let pts = smoothed;
    if (smoothed.length > MAX_PTS) {
      pts = [];
      for (let k = 0; k < MAX_PTS; k++) {
        const idx = Math.round((k / (MAX_PTS - 1)) * (smoothed.length - 1));
        pts.push(smoothed[idx]);
      }
    }

    const W = 260, H = 104, PAD = 6;
    const xAt = (idx) => PAD + (idx / (pts.length - 1)) * (W - PAD * 2);
    const yAt = (val) => H - PAD - ((Math.max(10, Math.min(95, val)) - 10) / 85) * (H - PAD * 2);
    const clampY = (y) => Math.max(PAD, Math.min(H - PAD, y));

    const toSmoothPath = (key) => {
      const coords = pts.map((p, idx) => ({ x: xAt(idx), y: yAt(p[key]) }));
      if (coords.length < 2) return "";
      let dStr = `M ${coords[0].x.toFixed(1)},${coords[0].y.toFixed(1)}`;
      const t = 0.7;
      for (let i = 0; i < coords.length - 1; i++) {
        const p0 = coords[Math.max(0, i - 1)];
        const p1 = coords[i];
        const p2 = coords[i + 1];
        const p3 = coords[Math.min(coords.length - 1, i + 2)];
        const cp1x = p1.x + ((p2.x - p0.x) / 6) * t;
        const cp1y = clampY(p1.y + ((p2.y - p0.y) / 6) * t);
        const cp2x = p2.x - ((p3.x - p1.x) / 6) * t;
        const cp2y = clampY(p2.y - ((p3.y - p1.y) / 6) * t);
        dStr += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
      }
      return dStr;
    };

    const last = rawPts[rawPts.length - 1];
    const lx = xAt(pts.length - 1).toFixed(1);
    const ly = yAt(last.score).toFixed(1);
    const scorePath = toSmoothPath("score");
    const areaPath = `${scorePath} L ${lx},${H - PAD} L ${PAD},${H - PAD} Z`;

    els.dossierTrend.innerHTML = `
      <div class="trend-head">
        <span>최근 1년 추이</span>
        <div class="trend-legend">
          <span><i style="background:#111111"></i>종합</span>
          <span><i style="background:#0284c7"></i>외교</span>
          <span><i style="background:#d97706"></i>국내</span>
          <span><i style="background:#059669"></i>경제</span>
        </div>
      </div>
      <svg class="trend-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
        <line x1="${PAD}" y1="${yAt(68).toFixed(1)}" x2="${W - PAD}" y2="${yAt(68).toFixed(1)}" stroke="rgba(220,38,38,0.28)" stroke-dasharray="3 3" stroke-width="0.8" />
        <line x1="${PAD}" y1="${yAt(48).toFixed(1)}" x2="${W - PAD}" y2="${yAt(48).toFixed(1)}" stroke="rgba(217,119,6,0.25)" stroke-dasharray="3 3" stroke-width="0.8" />
        <path d="${areaPath}" fill="rgba(17,17,17,0.07)" />
        <path d="${toSmoothPath("dip")}" fill="none" stroke="#0284c7" stroke-width="1.15" stroke-opacity="0.78" />
        <path d="${toSmoothPath("dom")}" fill="none" stroke="#d97706" stroke-width="1.15" stroke-opacity="0.78" />
        <path d="${toSmoothPath("eco")}" fill="none" stroke="#059669" stroke-width="1.15" stroke-opacity="0.78" />
        <path d="${scorePath}" fill="none" stroke="#111111" stroke-width="1.9" />
        <circle cx="${lx}" cy="${ly}" r="3" fill="#0284c7" stroke="#ffffff" stroke-width="1.2" />
      </svg>
      <div class="trend-dates">
        <span>${rawPts[0].d.slice(2)}</span>
        <span>${last.d.slice(2)} (평균 ${last.score} · 당일 ${last.daily ?? last.score})</span>
      </div>
    `;
  }

  function highlightDossierEvent(evId) {
    const items = els.dossierEventsList.querySelectorAll(".dossier-event-item");
    items.forEach((item) => {
      item.classList.toggle("active", item.dataset.evId === evId);
    });
  }

  function stepDate(delta) {
    const idx = state.dates.indexOf(state.currentDate);
    if (idx === -1) return;
    const nextIdx = Math.max(0, Math.min(state.dates.length - 1, idx + delta));
    if (nextIdx !== idx) {
      state.currentDate = state.dates[nextIdx];
      state.activeEventIdx = 0;
      renderAll();
    }
  }

  function toggleTimelapse() {
    state.isTimelapse = !state.isTimelapse;
    els.timelapseBtn.classList.toggle("active", state.isTimelapse);
    els.timelapseBtn.textContent = state.isTimelapse ? "⏹ 타임랩스 중지" : "⏱ 타임랩스";

    if (state.timelapseTimerId) {
      clearInterval(state.timelapseTimerId);
      state.timelapseTimerId = null;
    }

    if (state.isTimelapse) {
      // Start from 14 days before end if currently at the very latest date
      const curIdx = state.dates.indexOf(state.currentDate);
      if (curIdx >= state.dates.length - 1) {
        state.currentDate = state.dates[Math.max(0, state.dates.length - 15)];
        renderAll();
      }
      const intervalMs = Math.round(3400 / state.speed);
      state.timelapseTimerId = setInterval(() => {
        const idx = state.dates.indexOf(state.currentDate);
        if (idx >= state.dates.length - 1) {
          toggleTimelapse();
          return;
        }
        stepDate(1);
      }, intervalMs);
    } else {
      playActiveEvent();
    }
  }

  function centerMarqueeOnEvent(idx) {
    const track = els.tickerMarqueeTrack;
    if (!track || !state.marqueePassWidth || !state.marqueeRanges.length) return;
    const range = state.marqueeRanges[idx];
    if (!range) return;
    const vpWidth = track.parentElement ? track.parentElement.clientWidth : 600;
    const rawOffset = range.start - vpWidth * 0.48;
    const pw = state.marqueePassWidth;
    state.marqueeOffset = ((rawOffset % pw) + pw) % pw;
    track.style.transform = `translate3d(${-state.marqueeOffset.toFixed(1)}px, 0, 0)`;
  }

  function startMarqueeLoop() {
    if (state.marqueeRafId) return;
    state.marqueeLastTs = performance.now();
    const tick = (now) => {
      const dt = Math.min(0.1, Math.max(0, (now - state.marqueeLastTs) / 1000));
      state.marqueeLastTs = now;
      const track = els.tickerMarqueeTrack;
      const pw = state.marqueePassWidth;
      if (
        track && pw > 0 && state.marqueeRanges.length > 0 &&
        state.isPlayingEvents && !state.isTimelapse && !state.marqueeHovered
      ) {
        const pxPerSec = 85 * state.speed;
        state.marqueeOffset = (state.marqueeOffset + pxPerSec * dt) % pw;
        track.style.transform = `translate3d(${-state.marqueeOffset.toFixed(1)}px, 0, 0)`;

        const vpWidth = track.parentElement ? track.parentElement.clientWidth : 600;
        const centerPos = (state.marqueeOffset + vpWidth * 0.5) % pw;
        for (const r of state.marqueeRanges) {
          if (centerPos >= r.start && centerPos < r.end) {
            if (r.idx !== state.activeEventIdx) {
              state.activeEventIdx = r.idx;
              playActiveEvent();
            }
            break;
          }
        }
      }
      state.marqueeRafId = requestAnimationFrame(tick);
    };
    state.marqueeRafId = requestAnimationFrame(tick);
  }

  function renderMarquee() {
    const track = els.tickerMarqueeTrack;
    if (!track) return;
    track.innerHTML = "";
    state.marqueePassWidth = 0;
    state.marqueeRanges = [];
    const events = state.filteredEvents;
    if (!events.length) {
      track.style.transform = "translate3d(0, 0, 0)";
      track.textContent = "선택된 조건의 뉴스가 없습니다.";
      return;
    }

    const buildPass = () => {
      const frag = document.createDocumentFragment();
      events.forEach((ev, idx) => {
        const sMeta = SUBTYPE_META[ev.sub] || TYPE_META[ev.type] || TYPE_META.diplomacy;
        const route = formatEventRoute(ev, true);

        const span = document.createElement("span");
        span.className = "marquee-item";
        span.dataset.idx = String(idx);
        span.innerHTML = `<span>${sMeta.icon}</span><strong style="color:#0369a1">[${route}]</strong><span>${ev.headline}</span><span class="marquee-sep">|</span>`;
        span.addEventListener("click", () => {
          state.activeEventIdx = idx;
          centerMarqueeOnEvent(idx);
          playActiveEvent();
        });
        frag.appendChild(span);
      });
      return frag;
    };

    track.appendChild(buildPass());
    track.appendChild(buildPass());

    const allItems = track.querySelectorAll(".marquee-item");
    const pw = allItems.length > events.length
      ? allItems[events.length].offsetLeft
      : track.scrollWidth / 2;
    state.marqueePassWidth = pw;
    state.marqueeRanges = [];
    for (let i = 0; i < events.length; i++) {
      const start = allItems[i].offsetLeft;
      const end = i + 1 < events.length ? allItems[i + 1].offsetLeft : pw;
      state.marqueeRanges.push({ idx: i, start, end });
    }
    centerMarqueeOnEvent(state.activeEventIdx);
    startMarqueeLoop();
  }

  function highlightMarqueeItem(activeIdx) {
    if (!els.tickerMarqueeTrack) return;
    els.tickerMarqueeTrack.querySelectorAll(".marquee-item").forEach((el) => {
      el.classList.toggle("active", Number(el.dataset.idx) === activeIdx);
    });
  }

  function renderAll() {
    state.filteredEvents = getFilteredEvents();
    renderHeader();
    renderSelectionChips();
    renderCountries();
    renderDossierCard();
    syncViewBox(state.lastFocusedCountry, true);
    renderMarquee();
    playActiveEvent();
  }

  // Event Listeners
  els.dateSelect.addEventListener("change", (e) => {
    state.currentDate = e.target.value;
    state.activeEventIdx = 0;
    renderAll();
  });
  els.prevDateBtn.addEventListener("click", () => stepDate(-1));
  els.nextDateBtn.addEventListener("click", () => stepDate(1));
  els.timelapseBtn.addEventListener("click", toggleTimelapse);

  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.activeType = btn.dataset.type;
      state.activeEventIdx = 0;
      renderAll();
    });
  });

  els.mapBg.addEventListener("click", () => {
    if (state.didDrag) {
      state.didDrag = false;
      return;
    }
    clearSelection();
  });

  // 2D Drag panning & mouse-wheel zoom on map
  let dragStart = null;
  els.worldSvg.addEventListener("mousedown", (e) => {
    dragStart = { x: e.clientX, y: e.clientY, vx: state.vx, vy: state.vy };
    state.didDrag = false;
    els.worldSvg.classList.add("dragging");
  });
  window.addEventListener("mousemove", (e) => {
    if (!dragStart) return;
    const dxPx = e.clientX - dragStart.x;
    const dyPx = e.clientY - dragStart.y;
    if (Math.hypot(dxPx, dyPx) > 4) state.didDrag = true;
    const rect = els.worldSvg.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    state.vx = dragStart.vx - (dxPx / rect.width) * state.vw;
    state.vy = dragStart.vy - (dyPx / rect.height) * state.vh;
    clampViewBox();
    applyViewBox();
  });
  window.addEventListener("mouseup", () => {
    if (dragStart) {
      dragStart = null;
      els.worldSvg.classList.remove("dragging");
    }
  });
  els.worldSvg.addEventListener("wheel", (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 0.88 : 1.14;
    zoomMap(factor, e.clientX, e.clientY);
  }, { passive: false });

  if (els.zoomInBtn) els.zoomInBtn.addEventListener("click", () => zoomMap(0.78));
  if (els.zoomOutBtn) els.zoomOutBtn.addEventListener("click", () => zoomMap(1.28));
  if (els.zoomResetBtn) els.zoomResetBtn.addEventListener("click", resetZoom);
  window.addEventListener("resize", () => syncViewBox());
  els.resetSelectionBtn.addEventListener("click", clearSelection);
  els.closeDossierBtn.addEventListener("click", clearSelection);

  els.playEventsBtn.addEventListener("click", () => {
    state.isPlayingEvents = !state.isPlayingEvents;
    els.playEventsBtn.textContent = state.isPlayingEvents ? "⏸" : "▶";
    if (state.isPlayingEvents) {
      playActiveEvent();
    } else {
      stopEventAnimation();
    }
  });

  els.speedBtn.addEventListener("click", () => {
    state.speed = state.speed === 1 ? 2 : 1;
    els.speedBtn.textContent = `${state.speed}x`;
    if (state.isTimelapse) {
      toggleTimelapse();
      toggleTimelapse();
    } else {
      playActiveEvent();
    }
  });

  if (els.tickerMarqueeTrack && els.tickerMarqueeTrack.parentElement && els.tickerMarqueeTrack.parentElement.parentElement) {
    const marqueeWrap = els.tickerMarqueeTrack.parentElement.parentElement;
    marqueeWrap.addEventListener("mouseenter", () => { state.marqueeHovered = true; });
    marqueeWrap.addEventListener("mouseleave", () => { state.marqueeHovered = false; });
  }

  // Boot
  initBaseMap();
  initDateSelect();
  const urlParams = new URLSearchParams(window.location.search);
  const paramDate = urlParams.get("date");
  if (paramDate && state.dates.includes(paramDate)) {
    state.currentDate = paramDate;
  }
  const paramCountry = urlParams.get("country");
  if (paramCountry && DATA.countries && DATA.countries[paramCountry]) {
    state.selectedCountries.add(paramCountry);
    state.lastFocusedCountry = paramCountry;
  }
  renderAll();
})();

