(() => {
  "use strict";

  const mode = document.body.dataset.mode === "private" ? "private" : "public";
  const pageSize = 12;
  const elements = {
    grid: document.querySelector("#sample-grid"),
    pagination: document.querySelector("#pagination"),
    search: document.querySelector("#search-input"),
    language: document.querySelector("#language-filter"),
    domain: document.querySelector("#domain-filter"),
    sort: document.querySelector("#sort-select"),
    reset: document.querySelector("#reset-filters"),
    resultCount: document.querySelector("#result-count"),
    dialog: document.querySelector("#sample-dialog"),
    dialogContent: document.querySelector("#dialog-content"),
    dialogClose: document.querySelector("#dialog-close"),
  };
  const state = { catalog: [], dataset: {}, page: 1, filtered: [] };

  const text = (value, fallback = "—") => {
    if (value === null || value === undefined || value === "") return fallback;
    return String(value);
  };
  const escapeHtml = (value) => text(value, "").replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[char]);
  const compact = (value) => text(value, "").replace(/\s+/g, " ").trim();
  const number = (value) => new Intl.NumberFormat("en-US").format(Number(value || 0));
  const percent = (value, max) => max ? Math.round((value / max) * 100) : 0;
  const asJson = (value) => JSON.stringify(value, null, 2);
  const samplePath = (id) => `data/samples/${encodeURIComponent(id)}.json`;
  const uniq = (items) => [...new Set(items.filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const median = (values) => {
    const ordered = [...values].sort((a, b) => a - b);
    const middle = Math.floor(ordered.length / 2);
    return ordered.length % 2 ? ordered[middle] : Math.round((ordered[middle - 1] + ordered[middle]) / 2);
  };

  function setText(selector, value) {
    const node = document.querySelector(selector);
    if (node) node.textContent = value;
  }

  function sampleTitle(sample) {
    const scenario = sample.scenario || {};
    const domain = compact(scenario.domain || "Long-context archive");
    return domain.charAt(0).toUpperCase() + domain.slice(1);
  }

  function selectedSampleSummary(sample) {
    const quality = sample.quality || {};
    return {
      id: sample.id,
      scenario: sample.scenario || {},
      contextCharacters: sample.context_characters || 0,
      documentCount: sample.document_count || 0,
      logicalSourceCount: sample.logical_source_count || 0,
      rubricCount: quality.rubric_count || 0,
      auditCount: quality.audit_count || 0,
    };
  }

  function populateSelect(select, values, label) {
    select.innerHTML = `<option value="">All ${escapeHtml(label.toLowerCase())}</option>${values.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join("")}`;
  }

  function updateMetrics() {
    const samples = state.catalog;
    const contexts = samples.map((sample) => sample.context_characters || 0);
    const rubrics = samples.reduce((sum, sample) => sum + Number(sample.quality?.rubric_count || 0), 0);
    const languages = uniq(samples.map((sample) => sample.scenario?.language));
    setText("#hero-sample-count", number(samples.length));
    setText("#metric-samples", number(samples.length));
    setText("#metric-context", `${number(median(contexts) || 0)}`);
    setText("#metric-languages", number(languages.length));
    setText("#metric-rubrics", number(rubrics));
    setText("#footer-count", `${number(samples.length)} RECORDS`);
  }

  function applyFilters() {
    const query = compact(elements.search.value).toLocaleLowerCase();
    const language = elements.language.value;
    const domain = elements.domain.value;
    const sort = elements.sort.value;
    const filtered = state.catalog.filter((sample) => {
      const scenario = sample.scenario || {};
      const haystack = [sample.id, sample.task_preview, scenario.language, scenario.locale, scenario.domain, scenario.context_archetype, scenario.task_archetype]
        .map((value) => compact(value).toLocaleLowerCase()).join(" ");
      return (!query || haystack.includes(query))
        && (!language || scenario.language === language)
        && (!domain || scenario.domain === domain);
    });
    filtered.sort((left, right) => {
      if (sort === "context") return (right.context_characters || 0) - (left.context_characters || 0);
      if (sort === "rubrics") return (right.quality?.rubric_count || 0) - (left.quality?.rubric_count || 0);
      return left.id.localeCompare(right.id);
    });
    state.filtered = filtered;
    const maxPage = Math.max(1, Math.ceil(filtered.length / pageSize));
    state.page = Math.min(state.page, maxPage);
    renderGrid();
  }

  function renderGrid() {
    const start = (state.page - 1) * pageSize;
    const visible = state.filtered.slice(start, start + pageSize);
    const total = state.filtered.length;
    elements.resultCount.textContent = `${number(total)} ${total === 1 ? "record" : "records"} shown${total !== state.catalog.length ? ` · filtered from ${number(state.catalog.length)}` : ""}`;
    if (!visible.length) {
      elements.grid.innerHTML = `<div class="empty-state"><strong>No matching archives.</strong><br />Try a wider search or reset the filters.</div>`;
    } else {
      elements.grid.innerHTML = visible.map((sample) => {
        const scenario = sample.scenario || {};
        const quality = sample.quality || {};
        return `<button class="sample-card" type="button" data-id="${escapeHtml(sample.id)}" aria-label="Open ${escapeHtml(sample.id)}">
          <div class="card-top"><span class="sample-id">${escapeHtml(sample.id.slice(-10))}</span><span class="pass-pill">ACCEPTED</span></div>
          <h3>${escapeHtml(sampleTitle(sample))}<span>${escapeHtml(text(scenario.language))} · ${escapeHtml(text(scenario.locale))}</span></h3>
          <p class="task-preview">${escapeHtml(sample.task_preview)}</p>
          <div class="card-bottom"><div class="card-meta"><span><b>${number(sample.context_characters)}</b> chars</span><span><b>${number(sample.document_count)}</b> docs</span><span><b>${number(quality.rubric_count)}</b> rules</span></div><span class="card-open">Inspect <span>↗</span></span></div>
        </button>`;
      }).join("");
      elements.grid.querySelectorAll("[data-id]").forEach((button) => button.addEventListener("click", () => openSample(button.dataset.id)));
    }
    renderPagination();
  }

  function renderPagination() {
    const pages = Math.max(1, Math.ceil(state.filtered.length / pageSize));
    if (pages <= 1) { elements.pagination.innerHTML = ""; return; }
    const windowStart = Math.max(1, Math.min(state.page - 2, pages - 4));
    const windowEnd = Math.min(pages, windowStart + 4);
    let markup = `<button type="button" data-page="${state.page - 1}" ${state.page === 1 ? "disabled" : ""}>←</button>`;
    for (let page = windowStart; page <= windowEnd; page += 1) markup += `<button type="button" data-page="${page}" class="${page === state.page ? "active" : ""}">${page}</button>`;
    markup += `<button type="button" data-page="${state.page + 1}" ${state.page === pages ? "disabled" : ""}>→</button>`;
    elements.pagination.innerHTML = markup;
    elements.pagination.querySelectorAll("[data-page]").forEach((button) => button.addEventListener("click", () => { state.page = Number(button.dataset.page); renderGrid(); document.querySelector("#explorer").scrollIntoView({ behavior: "smooth", block: "start" }); }));
  }

  function publicView(sample) {
    return {
      id: sample.id,
      schema_version: sample.schema_version,
      scenario: sample.scenario || {},
      task: sample.task || "",
      response_format: sample.response_format || "",
      context: sample.context || "",
      documents: Array.isArray(sample.documents) ? sample.documents : [],
      quality: sample.quality_summary || {},
      disclosure: sample.disclosure || {},
      isPrivate: false,
      raw: sample,
    };
  }

  function privateView(sample) {
    const blueprint = sample.blueprint || {};
    return {
      id: sample.id,
      schema_version: sample.schema_version,
      scenario: sample.scenario || {},
      task: blueprint.task || "",
      response_format: blueprint.response_format || "",
      context: sample.context || "",
      documents: Array.isArray(sample.documents) ? sample.documents : [],
      quality: {
        evidence_count: Array.isArray(blueprint.evidence) ? blueprint.evidence.length : 0,
        rubric_count: Array.isArray(blueprint.rubrics) ? blueprint.rubrics.length : 0,
        audit_count: Array.isArray(sample.audits) ? sample.audits.length : 0,
        passed_audits: Array.isArray(sample.audits) ? sample.audits.filter((audit) => audit.overall_pass).length : 0,
        blind_recovered_facts: Array.isArray(sample.blind_recovery?.facts) ? sample.blind_recovery.facts.length : 0,
        accepted: true,
      },
      disclosure: {},
      isPrivate: true,
      raw: sample,
    };
  }

  async function openSample(id) {
    elements.dialogContent.innerHTML = `<div class="loading-detail">Loading archive record…</div>`;
    if (!elements.dialog.open) elements.dialog.showModal();
    try {
      const response = await fetch(samplePath(id), { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const raw = await response.json();
      const view = mode === "private" ? privateView(raw) : publicView(raw);
      renderDetail(view);
    } catch (error) {
      elements.dialogContent.innerHTML = `<div class="loading-detail">This record could not be loaded. ${escapeHtml(error.message)}</div>`;
    }
  }

  function detailTabs(view) {
    const base = [
      ["overview", "Overview"], ["task", "Task & format"], ["documents", `Archive · ${view.documents.length} docs`], ["context", "Rendered context"], ["quality", "Quality summary"],
    ];
    if (!view.isPrivate) return [...base, ["raw", "Raw public JSON"]];
    return [...base, ["evidence", "Evidence ledger"], ["rubrics", "Rubric contracts"], ["answer", "Canonical answer"], ["recovery", "Blind recovery"], ["audits", "Audit passes"], ["provenance", "Provenance"], ["raw", "Raw combined JSON"]];
  }

  function renderDetail(view) {
    const scenario = view.scenario;
    const quality = view.quality;
    elements.dialogContent.innerHTML = `<section class="detail-head"><div class="detail-kicker">${view.isPrivate ? "LOCAL PRIVATE REVIEW" : "PUBLIC POLICY VIEW"} <span>•</span> ${escapeHtml(view.id)}</div><h2 id="dialog-title">${escapeHtml(sampleTitle({ scenario }))}</h2><p class="detail-subtitle">${escapeHtml(compact(view.task).slice(0, 390))}${compact(view.task).length > 390 ? "…" : ""}</p><div class="detail-quickstats"><span>${number(view.context.length)} characters</span><span>${number(view.documents.length)} documents</span><span>${number(quality.rubric_count)} rubric contracts</span><span>${number(quality.passed_audits)}/${number(quality.audit_count)} audit passes</span></div></section><section class="detail-body"><aside class="detail-tabs">${detailTabs(view).map(([id, label], index) => `<button type="button" class="detail-tab ${index === 0 ? "active" : ""}" data-detail-tab="${id}">${escapeHtml(label)}</button>`).join("")}</aside><article class="detail-panel" id="detail-panel"></article></section>`;
    elements.dialogContent.querySelectorAll("[data-detail-tab]").forEach((button) => button.addEventListener("click", () => {
      elements.dialogContent.querySelectorAll("[data-detail-tab]").forEach((tab) => tab.classList.toggle("active", tab === button));
      renderDetailPanel(view, button.dataset.detailTab);
    }));
    renderDetailPanel(view, "overview");
  }

  function renderDetailPanel(view, tab) {
    const panel = document.querySelector("#detail-panel");
    const scenario = view.scenario;
    const quality = view.quality;
    if (tab === "overview") {
      const cells = [
        ["Sample ID", view.id], ["Language / locale", `${text(scenario.language)} / ${text(scenario.locale)}`], ["Domain", scenario.domain], ["Context archetype", scenario.context_archetype], ["Task archetype", scenario.task_archetype], ["Difficulty", scenario.difficulty], ["Target archive", `${number(scenario.target_chars)} characters · ${number(scenario.target_documents)} docs`], ["Target rubrics", scenario.target_rubrics],
      ];
      panel.innerHTML = `<h3>Record overview</h3><p>The scenario is selected before writing begins. It constrains the archive’s language, domain, task type, target size and realism requirements.</p><div class="detail-grid">${cells.map(([label, value]) => `<div class="detail-data"><span>${escapeHtml(label)}</span><strong>${escapeHtml(text(value))}</strong></div>`).join("")}</div><h4>Realism constraints</h4><pre class="code-block">${escapeHtml(asJson(scenario.realism_constraints || []))}</pre>`;
      return;
    }
    if (tab === "task") {
      panel.innerHTML = `<h3>Final task & output contract</h3><p>The policy receives these two fields alongside the archive. The task says what to determine; the format contract says exactly how to return it.</p><h4>Task</h4><pre class="context-view">${escapeHtml(view.task)}</pre><h4>Response format</h4><pre class="code-block">${escapeHtml(view.response_format)}</pre>`;
      return;
    }
    if (tab === "documents") {
      renderDocuments(view, panel);
      return;
    }
    if (tab === "context") {
      panel.innerHTML = `<h3>Rendered archive context</h3><p>This is the exact long-context artifact for the task. It is rendered from the document sequence and is hash-bound by the dataset pipeline.</p><button class="document-copy" type="button" data-copy-context>Copy context</button><pre class="context-view">${escapeHtml(view.context)}</pre>`;
      panel.querySelector("[data-copy-context]").addEventListener("click", () => copyText(view.context, "Context copied"));
      return;
    }
    if (tab === "quality") {
      const items = [["Accepted", quality.accepted ? "Yes" : "No"], ["Evidence facts", quality.evidence_count], ["Rubric contracts", quality.rubric_count], ["Audit passes", `${quality.passed_audits} / ${quality.audit_count}`], ["Blind-recovered facts", quality.blind_recovered_facts], ["Privacy", view.isPrivate ? "Local full review" : "Public policy view"]];
      panel.innerHTML = `<h3>Quality summary</h3><p>Acceptance requires a valid source plan, grounded documents, archive-only blind recovery, a checked canonical answer and all independent audits to pass.</p><div class="detail-grid">${items.map(([label, value]) => `<div class="detail-data"><span>${escapeHtml(label)}</span><strong>${escapeHtml(text(value))}</strong></div>`).join("")}</div>${view.isPrivate ? "" : `<div class="detail-note">Private evaluator content is deliberately absent from this deployable view. It is not a visual toggle: the browser never downloads canonical answers, evidence anchors, rubrics, recovery traces, audits or provenance.</div>`}`;
      return;
    }
    const raw = view.raw;
    const privatePanels = {
      evidence: ["Private evidence ledger", raw.blueprint?.evidence || []],
      rubrics: ["Private rubric contracts", raw.blueprint?.rubrics || []],
      recovery: ["Archive-only blind recovery", raw.blind_recovery || {}],
      audits: ["Independent audit passes", raw.audits || []],
      provenance: ["Generation provenance", raw.provenance || {}],
      raw: [view.isPrivate ? "Raw combined JSON" : "Raw public JSON", raw],
    };
    if (tab === "answer") {
      panel.innerHTML = `<h3>Canonical answer</h3><p class="private-warning">Private evaluator field. Do not expose this text to rollout policy or deploy it with public data.</p><pre class="code-block">${escapeHtml(raw.canonical_answer || "")}</pre>`;
      return;
    }
    const [heading, payload] = privatePanels[tab] || ["Record", raw];
    const warning = view.isPrivate && tab !== "raw" ? `<p class="private-warning">Local reviewer only. This field is excluded from the public website to preserve reward integrity.</p>` : "";
    panel.innerHTML = `<h3>${escapeHtml(heading)}</h3>${warning}<pre class="code-block">${escapeHtml(asJson(payload))}</pre>`;
  }

  function renderDocuments(view, panel) {
    if (!view.documents.length) { panel.innerHTML = `<h3>Archive documents</h3><p>No document records are available.</p>`; return; }
    const renderDocument = (index) => {
      const document = view.documents[index];
      const viewer = panel.querySelector(".document-view");
      panel.querySelectorAll("[data-document-index]").forEach((button) => button.classList.toggle("active", Number(button.dataset.documentIndex) === index));
      viewer.innerHTML = `<header><h4>${escapeHtml(document.title)}</h4><span>${escapeHtml(document.id)} · ${escapeHtml(document.genre)} · source ${escapeHtml(document.logical_source_id)} · chunk ${escapeHtml(document.chunk_index)}/${escapeHtml(document.chunk_count)} · ${number(document.character_count || document.content?.length)} chars</span></header><button class="document-copy" type="button">Copy document text</button><pre class="context-view">${escapeHtml(document.content)}</pre>`;
      viewer.querySelector("button").addEventListener("click", () => copyText(document.content, "Document copied"));
    };
    panel.innerHTML = `<h3>Archive documents</h3><p>Each record has a source identity, genre and position inside a logical source. Long sources can span multiple chunks without losing provenance.</p><div class="document-layout"><nav class="document-list">${view.documents.map((document, index) => `<button type="button" data-document-index="${index}"><b>${escapeHtml(document.id)} · ${escapeHtml(document.genre)}</b><small>${escapeHtml(document.title)}<br />${escapeHtml(document.logical_source_id)} · ${number(document.character_count || document.content?.length)} chars</small></button>`).join("")}</nav><section class="document-view"></section></div>`;
    panel.querySelectorAll("[data-document-index]").forEach((button) => button.addEventListener("click", () => renderDocument(Number(button.dataset.documentIndex))));
    renderDocument(0);
  }

  async function copyText(value, successMessage) {
    try {
      await navigator.clipboard.writeText(value);
      window.setTimeout(() => { elements.dialogClose.focus(); }, 30);
      alert(successMessage);
    } catch (_) {
      alert("Copy is unavailable in this browser. Select the text manually.");
    }
  }

  function wireControls() {
    const resetAndFilter = () => { state.page = 1; applyFilters(); };
    elements.search.addEventListener("input", resetAndFilter);
    elements.language.addEventListener("change", resetAndFilter);
    elements.domain.addEventListener("change", resetAndFilter);
    elements.sort.addEventListener("change", resetAndFilter);
    elements.reset.addEventListener("click", () => { elements.search.value = ""; elements.language.value = ""; elements.domain.value = ""; elements.sort.value = "id"; resetAndFilter(); });
    elements.dialogClose.addEventListener("click", () => elements.dialog.close());
    elements.dialog.addEventListener("click", (event) => { if (event.target === elements.dialog) elements.dialog.close(); });
  }

  async function initialise() {
    wireControls();
    if (mode === "private") {
      document.title = "Long Context Atlas · Local Private Review";
      document.querySelector(".header-status").innerHTML = "<i></i> LOCAL PRIVATE REVIEW";
      document.querySelector(".about-copy").innerHTML = "<p>This local-only reviewer includes the complete accepted sample, including evaluator-side fields.</p><p>It must not be deployed while the dataset is used for RL training.</p><span class=\"privacy-chip\">LOCAL ONLY · PRIVATE DATA</span>";
    }
    try {
      const response = await fetch("data/catalog.json", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      state.catalog = Array.isArray(payload.samples) ? payload.samples : [];
      state.dataset = payload.dataset || {};
      populateSelect(elements.language, uniq(state.catalog.map((sample) => sample.scenario?.language)), "languages");
      populateSelect(elements.domain, uniq(state.catalog.map((sample) => sample.scenario?.domain)), "domains");
      updateMetrics();
      applyFilters();
    } catch (error) {
      elements.grid.innerHTML = `<div class="empty-state"><strong>Dataset not built yet.</strong><br />Run <code>scripts\\Build-WebData.ps1</code>, then serve the <code>public</code> directory.<br /><small>${escapeHtml(error.message)}</small></div>`;
      elements.resultCount.textContent = "No catalog loaded";
    }
  }

  initialise();
})();
