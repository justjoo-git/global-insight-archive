/**
 * 글로벌 인사이트 뉴스 아카이브 — Front Page (Today's Edition) & List Search App
 */

(function () {
  "use strict";

  const ARCHIVE = window.GLOBAL_INSIGHT_ARCHIVE;
  if (!ARCHIVE) {
    document.getElementById("mainContent").innerHTML =
      "<p>데이터를 불러오지 못했습니다. build_web_archive.py를 먼저 실행해 주세요.</p>";
    return;
  }

  // Unique sorted dates descending (index 0 = latest / today's edition)
  const ALL_DATES = Array.from(new Set(ARCHIVE.records.map((r) => r.d))).sort().reverse();
  const ALL_DATES_SET = new Set(ALL_DATES);
  const LATEST_DATE = ALL_DATES[0] || "";
  const MIN_DATE = ARCHIVE.stats.min_date || "2025-10-15";
  const ALL_YEARS = Array.from(new Set(ALL_DATES.map((d) => Number(d.slice(0, 4))))).sort((a, b) => b - a);

  const state = {
    mode: "frontpage", // "frontpage" | "search"
    currentDate: LATEST_DATE,
    calYear: Number((LATEST_DATE || "2026-11-07").slice(0, 4)),
    calMonth: Number((LATEST_DATE || "2026-11-07").slice(5, 7)),
    query: "",
    country: "ALL",
    category: "ALL",
    month: "ALL",
    searchLimit: 60,
  };

  // DOM Elements
  const elSinceLabel = document.getElementById("sinceLabel");
  const elFooterSince = document.getElementById("footerSince");
  const elMastheadSub = document.getElementById("mastheadSub");
  const elToggleSearchBtn = document.getElementById("toggleSearchBtn");
  const elSearchDrawer = document.getElementById("searchDrawer");
  const elSearchForm = document.getElementById("searchForm");
  const elSearchInput = document.getElementById("searchInput");
  const elCountrySelect = document.getElementById("countrySelect");
  const elCategorySelect = document.getElementById("categorySelect");
  const elMonthSelect = document.getElementById("monthSelect");
  const elResetSearchBtn = document.getElementById("resetSearchBtn");
  const elHomeTitleBtn = document.getElementById("homeTitleBtn");
  const elEditionBar = document.getElementById("editionBar");
  const elCalendarTriggerWrap = document.getElementById("calendarTriggerWrap");
  const elCurrentEditionLabel = document.getElementById("currentEditionLabel");
  const elCalendarPopover = document.getElementById("calendarPopover");
  const elCalPrevMonthBtn = document.getElementById("calPrevMonthBtn");
  const elCalNextMonthBtn = document.getElementById("calNextMonthBtn");
  const elCalYearSelect = document.getElementById("calYearSelect");
  const elCalMonthSelect = document.getElementById("calMonthSelect");
  const elCalDaysGrid = document.getElementById("calDaysGrid");
  const elCalGoLatestBtn = document.getElementById("calGoLatestBtn");
  const elCalCloseBtn = document.getElementById("calCloseBtn");
  const elPrevDateBtn = document.getElementById("prevDateBtn");
  const elNextDateBtn = document.getElementById("nextDateBtn");
  const elTodayDateBtn = document.getElementById("todayDateBtn");
  const elEditionYoutubeArea = document.getElementById("editionYoutubeArea");
  const elMainContent = document.getElementById("mainContent");

  const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
  const CAT_LABELS = {
    POLITICS: "정치·외교",
    ECONOMY: "경제·기술",
    SOCIETY: "문화·사회",
  };

  function formatDotDate(dateStr) {
    const p = dateStr.split("-");
    if (p.length !== 3) return dateStr;
    return `${p[0]}. ${p[1]}. ${p[2]}.`;
  }

  function formatKoreanDate(dateStr) {
    const parts = dateStr.split("-");
    if (parts.length !== 3) return dateStr;
    const dt = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    const w = WEEKDAYS[dt.getDay()] || "";
    return `${parts[0]}년 ${Number(parts[1])}월 ${Number(parts[2])}일 (${w})`;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function highlightText(text, rawQuery) {
    const safe = escapeHtml(text);
    if (!rawQuery) return safe;
    const terms = rawQuery
      .trim()
      .split(/\s+/)
      .filter((t) => t.length >= 1)
      .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    if (terms.length === 0) return safe;
    const re = new RegExp(`(${terms.join("|")})`, "gi");
    return safe.replace(re, '<mark class="kw-hit">$1</mark>');
  }

  const STOP_WORDS = new Set([
    "가운데", "따르면", "통해", "위해", "대한", "관련해", "관련", "대해",
    "최근", "이번", "오는", "지난", "오늘", "내일", "올해", "현재", "향후",
    "밝혔다", "발표했다", "전했다", "보도했다", "나타났다", "강조했다", "말했다",
    "있다", "했다", "이다", "것으로", "이어", "함께", "대규모", "주요", "본격",
    "추진", "진행", "개최", "예정", "발생", "기록", "수준", "영향", "우려"
  ]);

  function buildGoogleNewsUrl(text, countryKey, dateStr, preQuery) {
    let q = preQuery && String(preQuery).trim();

    if (!q) {
      const cMeta = ARCHIVE.countries[countryKey];
      const countryKo = countryKey === "korea" ? "" : cMeta ? cMeta.ko : countryKey;

      const cleaned = String(text)
        .replace(/\([^)]*\)/g, " ")
        .replace(/['"“”‘’\[\]《》<>]/g, " ")
        .slice(0, 95);

      const rawTokens = cleaned.split(/[\s,.:;·/]+/).filter(Boolean);
      const keywords = [];

      if (countryKo && !cleaned.includes(countryKo)) {
        keywords.push(countryKo);
      }

      for (let i = 0; i < rawTokens.length; i++) {
        let tok = rawTokens[i];
        const stripped = tok.replace(/(은|는|이|가|을|를|의|에|에서|으로|로|과|와|며|고|도|만|부터|까지)$/, "");
        if (stripped.length >= 2) {
          tok = stripped;
        }
        if (tok.length < 2) continue;
        if (/^\d+(년|월|일|명|건|차)$/.test(tok)) continue;
        if (STOP_WORDS.has(tok)) continue;
        if (!keywords.includes(tok)) {
          keywords.push(tok);
        }
        if (keywords.length >= 4) break;
      }

      q = keywords.join(" ") || `${countryKo || "한국"}`;
    }

    const parts = String(dateStr || "").split("-");
    const ymSuffix =
      parts.length >= 2 ? `${parts[0]}년 ${Number(parts[1])}월` : "";
    const fullQuery = [q, ymSuffix, "뉴스"].filter(Boolean).join(" ");
    return `https://www.google.com/search?q=${encodeURIComponent(fullQuery)}`;
  }

  function isMobileDevice() {
    return (
      /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "") ||
      Boolean(window.matchMedia && window.matchMedia("(max-width: 768px)").matches)
    );
  }

  function initMetadataAndFilters() {
    const sinceDot = `Since ${formatDotDate(MIN_DATE)}`;
    elSinceLabel.textContent = sinceDot;
    elFooterSince.textContent = sinceDot;
    elMastheadSub.textContent = `${sinceDot} · 각국 현지 언론 기반 글로벌 일일 팩트 브리핑`;

    // Populate Country Select (Clean names only, no item counts)
    Object.keys(ARCHIVE.countries).forEach((ck) => {
      const cMeta = ARCHIVE.countries[ck];
      const opt = document.createElement("option");
      opt.value = ck;
      opt.textContent = `${cMeta.flag} ${cMeta.ko} (${cMeta.en})`;
      elCountrySelect.appendChild(opt);
    });

    // Populate Month Select
    ARCHIVE.months.forEach((ym) => {
      const opt = document.createElement("option");
      opt.value = ym;
      opt.textContent = `${ym.slice(0, 4)}년 ${Number(ym.slice(5, 7))}월`;
      elMonthSelect.appendChild(opt);
    });

    // Populate Calendar Year & Month Selects
    ALL_YEARS.forEach((yr) => {
      const opt = document.createElement("option");
      opt.value = String(yr);
      opt.textContent = `${yr}년`;
      elCalYearSelect.appendChild(opt);
    });

    for (let m = 1; m <= 12; m++) {
      const opt = document.createElement("option");
      opt.value = String(m);
      opt.textContent = `${m}월`;
      elCalMonthSelect.appendChild(opt);
    }
  }

  function renderCalendarGrid() {
    const yr = state.calYear;
    const mo = state.calMonth;
    elCalYearSelect.value = String(yr);
    elCalMonthSelect.value = String(mo);

    const firstDayOfWeek = new Date(yr, mo - 1, 1).getDay();
    const daysInMonth = new Date(yr, mo, 0).getDate();
    const ymPrefix = `${yr}-${String(mo).padStart(2, "0")}`;

    const cells = [];
    for (let i = 0; i < firstDayOfWeek; i++) {
      cells.push(`<div class="cal-day-cell cal-day-empty"></div>`);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dStr = `${ymPrefix}-${String(d).padStart(2, "0")}`;
      const isAvail = ALL_DATES_SET.has(dStr);
      const isSel = dStr === state.currentDate;
      const hasBroadcast = Boolean(ARCHIVE.broadcasts[dStr]);

      if (isAvail) {
        const dotHtml = hasBroadcast ? `<span class="cal-day-dot" title="유튜브 방송 있음"></span>` : "";
        const selClass = isSel ? " cal-day-selected" : "";
        cells.push(
          `<button type="button" class="cal-day-cell cal-day-available${selClass}" data-date="${dStr}" title="${dStr} 발행 지면 보기">
            <span>${d}</span>
            ${dotHtml}
          </button>`
        );
      } else {
        cells.push(
          `<button type="button" class="cal-day-cell cal-day-disabled" disabled title="수집된 뉴스 없음">
            <span>${d}</span>
          </button>`
        );
      }
    }

    elCalDaysGrid.innerHTML = cells.join("");
  }

  function openCalendarPopover() {
    const parts = (state.currentDate || LATEST_DATE).split("-");
    if (parts.length === 3) {
      state.calYear = Number(parts[0]);
      state.calMonth = Number(parts[1]);
    }
    renderCalendarGrid();
    elCalendarPopover.hidden = false;
    elCurrentEditionLabel.setAttribute("aria-expanded", "true");
  }

  function closeCalendarPopover() {
    elCalendarPopover.hidden = true;
    elCurrentEditionLabel.setAttribute("aria-expanded", "false");
  }

  function renderCountryBriefBox(countryKey, showHistoryBtn) {
    const m = ARCHIVE.countries[countryKey];
    if (!m) return "";

    const historyBtnHtml = showHistoryBtn
      ? `<button type="button" class="wiki-pill js-country-search" data-country="${countryKey}">이 국가 지난 뉴스 목록 보기 →</button>`
      : "";

    return `
      <div class="country-header-line">
        <h2 class="country-title">
          <span>${m.flag} ${escapeHtml(m.ko)}</span>
          <span class="en-label">${escapeHtml(m.en)}</span>
        </h2>
        <div class="country-meta-links">
          <a href="${escapeHtml(m.wiki_ko)}" target="_blank" rel="noopener noreferrer" class="wiki-pill">📖 한국어 위키백과 ↗</a>
          <a href="${escapeHtml(m.wiki_en)}" target="_blank" rel="noopener noreferrer" class="wiki-pill">🌐 English Wiki ↗</a>
          ${historyBtnHtml}
        </div>
      </div>
      <div class="country-brief-box">
        <div class="country-brief-specs">
          <strong>권역:</strong> ${escapeHtml(m.region)} ·
          <strong>수도:</strong> ${escapeHtml(m.capital)} ·
          <strong>체제:</strong> ${escapeHtml(m.system)} ·
          <strong>핵심 경제:</strong> ${escapeHtml(m.economy)}
        </div>
        <p class="country-summary">${escapeHtml(m.summary)}</p>
      </div>
    `;
  }

  function renderFrontPageEdition() {
    elEditionBar.hidden = false;
    const dateStr = state.currentDate;
    const isLatest = dateStr === LATEST_DATE;
    elCurrentEditionLabel.textContent = `📅 ${formatKoreanDate(dateStr)} ${isLatest ? "오늘자 발행 지면" : "발행 지면"} ▾`;

    const idx = ALL_DATES.indexOf(dateStr);
    elPrevDateBtn.disabled = idx < 0 || idx >= ALL_DATES.length - 1;
    elNextDateBtn.disabled = idx <= 0;
    elTodayDateBtn.style.display = isLatest ? "none" : "inline-block";

    // Broadcast link for this edition date
    const b = ARCHIVE.broadcasts[dateStr];
    if (b) {
      elEditionYoutubeArea.innerHTML = `
        <a href="${escapeHtml(b.youtube_url)}" target="_blank" rel="noopener noreferrer" class="action-btn" title="${escapeHtml(b.title)}">
          📺 ${escapeHtml(b.title)} 보러가기 ↗
        </a>
      `;
    } else {
      elEditionYoutubeArea.innerHTML = "";
    }

    // Filter records for currentDate
    const dayRecords = ARCHIVE.records.filter((r) => r.d === dateStr);

    // Sort countries on the front page: Korea first, then broadcast featured countries, then canonical order
    const featuredSet = new Set((b && b.featured) || []);
    const countryOrder = Object.keys(ARCHIVE.countries);
    dayRecords.sort((a, bRec) => {
      if (a.c === "korea") return -1;
      if (bRec.c === "korea") return 1;
      const aFeat = featuredSet.has(a.c) ? 0 : 1;
      const bFeat = featuredSet.has(bRec.c) ? 0 : 1;
      if (aFeat !== bFeat) return aFeat - bFeat;
      return countryOrder.indexOf(a.c) - countryOrder.indexOf(bRec.c);
    });

    if (dayRecords.length === 0) {
      elMainContent.innerHTML = `<p>해당 일자의 뉴스가 없습니다.</p>`;
      return;
    }

    const linkTargetAttr = isMobileDevice() ? "" : ' target="_blank" rel="noopener noreferrer"';

    const blocksHtml = dayRecords
      .map((rec) => {
        const renderCol = (title, items, queries) => {
          const listHtml =
            items.length > 0
              ? `<ol class="news-list">${items
                  .map((t, idx) => {
                    const qStr = queries && queries[idx] ? queries[idx] : "";
                    const gUrl = buildGoogleNewsUrl(t, rec.c, dateStr, qStr);
                    const tip = qStr ? `구글 검색: ${qStr} ↗` : "구글에서 관련 기사 검색 ↗";
                    return `<li class="news-item">
                      <a href="${escapeHtml(gUrl)}"${linkTargetAttr} class="news-item-link" title="${escapeHtml(tip)}">
                        ${escapeHtml(t)} <span class="news-ext-hint" aria-hidden="true">↗</span>
                      </a>
                    </li>`;
                  })
                  .join("")}</ol>`
              : `<p class="news-item" style="color:#777;">주요 뉴스 없음</p>`;
          return `
            <div class="news-col">
              <div class="cat-header">${title}</div>
              ${listHtml}
            </div>
          `;
        };

        return `
          <article class="country-article-block">
            ${renderCountryBriefBox(rec.c, true)}
            <div class="newspaper-columns">
              ${renderCol("정치 · 외교 (POLITICS)", rec.p, rec.pq)}
              ${renderCol("경제 · 기술 (ECONOMY & TECH)", rec.e, rec.eq)}
              ${renderCol("문화 · 사회 (CULTURE & SOCIETY)", rec.s, rec.sq)}
            </div>
          </article>
        `;
      })
      .join("");

    elMainContent.innerHTML = blocksHtml;
  }

  function renderSearchResultsList() {
    elEditionBar.hidden = true;

    const q = state.query.trim().toLowerCase();
    const terms = q ? q.split(/\s+/).filter(Boolean) : [];

    // Flatten matching items into clean list rows: { date, country, catKey, text, queryStr }
    const rows = [];

    for (let i = 0; i < ARCHIVE.records.length; i++) {
      const rec = ARCHIVE.records[i];
      if (state.country !== "ALL" && rec.c !== state.country) continue;
      if (state.month !== "ALL" && !rec.d.startsWith(state.month)) continue;

      const cMeta = ARCHIVE.countries[rec.c];
      const countryNameMatched =
        terms.length > 0 &&
        cMeta &&
        terms.every(
          (t) =>
            cMeta.ko.toLowerCase().includes(t) ||
            cMeta.en.toLowerCase().includes(t) ||
            rec.c.includes(t)
        );

      const pushCatItems = (catKey, list, qList) => {
        if (state.category !== "ALL" && state.category !== catKey) return;
        for (let j = 0; j < list.length; j++) {
          const txt = list[j];
          const queryStr = qList && qList[j] ? qList[j] : "";
          if (terms.length === 0 || countryNameMatched) {
            rows.push({ date: rec.d, country: rec.c, catKey, text: txt, queryStr });
          } else {
            const lower = txt.toLowerCase();
            if (terms.every((t) => lower.includes(t))) {
              rows.push({ date: rec.d, country: rec.c, catKey, text: txt, queryStr });
            }
          }
        }
      };

      pushCatItems("POLITICS", rec.p, rec.pq);
      pushCatItems("ECONOMY", rec.e, rec.eq);
      pushCatItems("SOCIETY", rec.s, rec.sq);
    }

    // If a single country is selected, show its Country Introduction Box at the top of the list
    const topCountryBox =
      state.country !== "ALL"
        ? `<div style="margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 2px solid #111;">
             ${renderCountryBriefBox(state.country, false)}
           </div>`
        : "";

    const filterSummaryParts = [];
    if (state.query.trim()) filterSummaryParts.push(`키워드: "${state.query.trim()}"`);
    if (state.country !== "ALL") {
      filterSummaryParts.push(`국가: ${ARCHIVE.countries[state.country]?.ko || state.country}`);
    }
    if (state.category !== "ALL") filterSummaryParts.push(`분야: ${CAT_LABELS[state.category]}`);
    if (state.month !== "ALL") filterSummaryParts.push(`기간: ${state.month}`);
    const conditionTitle = filterSummaryParts.length > 0 ? filterSummaryParts.join(" · ") : "전체 아카이브 목록";

    if (rows.length === 0) {
      elMainContent.innerHTML = `
        ${topCountryBox}
        <div class="search-mode-header">
          <strong>🔍 검색 조건: ${escapeHtml(conditionTitle)}</strong>
          <button type="button" class="action-btn js-back-frontpage">← 오늘자 첫 화면으로 돌아가기</button>
        </div>
        <div style="padding: 3rem 1rem; text-align: center; border: 1px solid #111;">
          <p style="font-weight: 700;">일치하는 뉴스가 없습니다.</p>
          <p style="font-size: 0.875rem; color: #555;">검색어나 국가·분야·기간 필터를 변경해 보세요.</p>
        </div>
      `;
      return;
    }

    const visibleRows = rows.slice(0, state.searchLimit);
    const linkTargetAttr = isMobileDevice() ? "" : ' target="_blank" rel="noopener noreferrer"';
    const listHtml = visibleRows
      .map((item) => {
        const cMeta = ARCHIVE.countries[item.country] || { ko: item.country, flag: "🌐", wiki_ko: "#" };
        const b = ARCHIVE.broadcasts[item.date];
        const ytLinkHtml = b
          ? `<a href="${escapeHtml(b.youtube_url)}" target="_blank" rel="noopener noreferrer" class="wiki-pill" title="${escapeHtml(b.title)}">📺 방송 ↗</a>`
          : "";

        const gUrl = buildGoogleNewsUrl(item.text, item.country, item.date, item.queryStr);
        const tip = item.queryStr
          ? `구글 검색: ${item.queryStr} ↗`
          : "구글에서 관련 기사 검색 ↗";

        return `
          <li class="search-row">
            <div class="search-row-meta">
              <a href="#date-${item.date}" class="search-row-date js-jump-date" data-date="${item.date}" title="이 날짜 전체 신문 지면 보기">
                ${item.date}
              </a>
              <div class="search-row-badges">
                <button type="button" class="badge-country js-country-search" data-country="${item.country}" title="이 국가 뉴스 및 국가 소개 보기">
                  ${cMeta.flag} ${escapeHtml(cMeta.ko)}
                </button>
                <span class="badge-cat">${CAT_LABELS[item.catKey]}</span>
              </div>
            </div>
            <div class="search-row-text">
              <a href="${escapeHtml(gUrl)}"${linkTargetAttr} class="news-item-link" title="${escapeHtml(tip)}">
                ${highlightText(item.text, state.query)} <span class="news-ext-hint" aria-hidden="true">↗</span>
              </a>
            </div>
            <div class="search-row-links">
              ${ytLinkHtml}
            </div>
          </li>
        `;
      })
      .join("");

    const loadMoreHtml =
      rows.length > state.searchLimit
        ? `<div class="load-more-container">
            <button type="button" id="loadMoreSearchBtn" class="action-btn action-btn-primary" style="padding: 0.55rem 1.5rem;">
              이전 검색 결과 더 보기
            </button>
          </div>`
        : "";

    elMainContent.innerHTML = `
      ${topCountryBox}
      <div class="search-mode-header">
        <strong>🔍 검색 목록 (${escapeHtml(conditionTitle)})</strong>
        <button type="button" class="action-btn js-back-frontpage">← 오늘자 첫 화면으로 돌아가기</button>
      </div>
      <ul class="search-results-list">
        ${listHtml}
      </ul>
      ${loadMoreHtml}
    `;
  }

  function render() {
    if (state.mode === "frontpage") {
      renderFrontPageEdition();
    } else {
      renderSearchResultsList();
    }
  }

  function openSearchDrawer() {
    elSearchDrawer.hidden = false;
    elToggleSearchBtn.setAttribute("aria-expanded", "true");
    elToggleSearchBtn.textContent = "✕ 검색창 닫기";
    elSearchInput.focus();
  }

  function closeSearchAndReturnFrontPage() {
    elSearchDrawer.hidden = true;
    elToggleSearchBtn.setAttribute("aria-expanded", "false");
    elToggleSearchBtn.textContent = "🔍 뉴스 검색";
    state.mode = "frontpage";
    state.currentDate = LATEST_DATE;
    state.query = "";
    state.country = "ALL";
    state.category = "ALL";
    state.month = "ALL";
    elSearchInput.value = "";
    elCountrySelect.value = "ALL";
    elCategorySelect.value = "ALL";
    elMonthSelect.value = "ALL";
    render();
  }

  function triggerSearch() {
    state.query = elSearchInput.value;
    state.country = elCountrySelect.value;
    state.category = elCategorySelect.value;
    state.month = elMonthSelect.value;
    state.searchLimit = 60;
    state.mode = "search";
    render();
  }

  // Event Listeners
  elToggleSearchBtn.addEventListener("click", () => {
    if (elSearchDrawer.hidden) {
      openSearchDrawer();
    } else {
      closeSearchAndReturnFrontPage();
    }
  });

  elSearchForm.addEventListener("submit", (e) => {
    e.preventDefault();
    triggerSearch();
  });

  elCountrySelect.addEventListener("change", triggerSearch);
  elCategorySelect.addEventListener("change", triggerSearch);
  elMonthSelect.addEventListener("change", triggerSearch);

  elResetSearchBtn.addEventListener("click", closeSearchAndReturnFrontPage);
  elHomeTitleBtn.addEventListener("click", closeSearchAndReturnFrontPage);

  elPrevDateBtn.addEventListener("click", () => {
    const idx = ALL_DATES.indexOf(state.currentDate);
    if (idx >= 0 && idx < ALL_DATES.length - 1) {
      state.currentDate = ALL_DATES[idx + 1];
      render();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });

  elNextDateBtn.addEventListener("click", () => {
    const idx = ALL_DATES.indexOf(state.currentDate);
    if (idx > 0) {
      state.currentDate = ALL_DATES[idx - 1];
      render();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });

  elTodayDateBtn.addEventListener("click", () => {
    state.currentDate = LATEST_DATE;
    closeCalendarPopover();
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  // Calendar Popover Events
  elCurrentEditionLabel.addEventListener("click", (e) => {
    e.stopPropagation();
    if (elCalendarPopover.hidden) {
      openCalendarPopover();
    } else {
      closeCalendarPopover();
    }
  });

  elCalYearSelect.addEventListener("change", () => {
    state.calYear = Number(elCalYearSelect.value);
    renderCalendarGrid();
  });

  elCalMonthSelect.addEventListener("change", () => {
    state.calMonth = Number(elCalMonthSelect.value);
    renderCalendarGrid();
  });

  elCalPrevMonthBtn.addEventListener("click", () => {
    state.calMonth -= 1;
    if (state.calMonth < 1) {
      state.calMonth = 12;
      state.calYear -= 1;
    }
    renderCalendarGrid();
  });

  elCalNextMonthBtn.addEventListener("click", () => {
    state.calMonth += 1;
    if (state.calMonth > 12) {
      state.calMonth = 1;
      state.calYear += 1;
    }
    renderCalendarGrid();
  });

  elCalDaysGrid.addEventListener("click", (e) => {
    const dayBtn = e.target.closest(".cal-day-available");
    if (!dayBtn) return;
    const targetDate = dayBtn.getAttribute("data-date");
    if (targetDate) {
      state.currentDate = targetDate;
      closeCalendarPopover();
      render();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });

  elCalGoLatestBtn.addEventListener("click", () => {
    state.currentDate = LATEST_DATE;
    closeCalendarPopover();
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  elCalCloseBtn.addEventListener("click", closeCalendarPopover);

  document.addEventListener("click", (e) => {
    if (!elCalendarPopover.hidden && !elCalendarTriggerWrap.contains(e.target)) {
      closeCalendarPopover();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !elCalendarPopover.hidden) {
      closeCalendarPopover();
    }
  });

  elMainContent.addEventListener("click", (e) => {
    const countryBtn = e.target.closest(".js-country-search");
    if (countryBtn) {
      const ck = countryBtn.getAttribute("data-country");
      elSearchDrawer.hidden = false;
      elToggleSearchBtn.setAttribute("aria-expanded", "true");
      elToggleSearchBtn.textContent = "✕ 검색창 닫기";
      elCountrySelect.value = ck;
      triggerSearch();
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const jumpDateLink = e.target.closest(".js-jump-date");
    if (jumpDateLink) {
      e.preventDefault();
      const targetDate = jumpDateLink.getAttribute("data-date");
      state.mode = "frontpage";
      state.currentDate = targetDate;
      render();
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const backBtn = e.target.closest(".js-back-frontpage");
    if (backBtn) {
      closeSearchAndReturnFrontPage();
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (e.target.id === "loadMoreSearchBtn") {
      state.searchLimit += 60;
      render();
    }
  });

  // Initialize
  initMetadataAndFilters();
  render();
})();
