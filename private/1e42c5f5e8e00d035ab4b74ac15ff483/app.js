(() => {
  "use strict";

  const data = window.JOB_SEARCH_DATA;
  if (!data) {
    document.body.innerHTML = "<p style='padding:2rem'>Site data is missing. Rebuild the dashboard.</p>";
    return;
  }

  const hosted = data.deploymentMode !== "local";
  const edgeAuthenticated = data.deploymentMode === "online";
  const privateLinkKey = String(window.PRIVATE_LINK_KEY || "");
  const state = {
    streamId: data.streams[0]?.id,
    reportDate: data.streams[0]?.reports[0]?.date,
    opportunityLimit: 36,
    filteredOpportunities: [],
  };
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const pathUrl = path => path ? "/" + path.split("/").map(encodeURIComponent).join("/") : "#";
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const slugify = value => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const humanize = value => String(value || "unknown").replaceAll("_", " ").replace(/\b\w/g, char => char.toUpperCase());
  const list = value => Array.isArray(value) ? value : value == null ? [] : [value];
  const externalUrl = value => {
    try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) ? url.href : null; }
    catch { return null; }
  };
  const routeFromLocation = () => {
    const fragment = location.hash.slice(1);
    if (!privateLinkKey) return fragment;
    if (fragment === privateLinkKey) return "overview";
    return fragment.startsWith(`${privateLinkKey}/`) ? fragment.slice(privateLinkKey.length + 1).split("/", 1)[0] : "overview";
  };
  const navigateTo = route => {
    const fragment = privateLinkKey ? `${privateLinkKey}/${route}` : route;
    if (location.hash.slice(1) === fragment) setRoute(route);
    else location.hash = fragment;
  };

  function inlineMarkdown(text) {
    let output = escapeHtml(text);
    const code = [];
    output = output.replace(/`([^`]+)`/g, (_, content) => {
      const token = `%%CODE${code.length}%%`;
      code.push(`<code>${content}</code>`);
      return token;
    });
    output = output.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|[^)]+)\)/g, (_, label, href) => {
      const target = href.startsWith("http") ? externalUrl(href) : (hosted ? null : pathUrl(href.replace(/^\.\//, "")));
      return target ? `<a href="${escapeHtml(target)}" target="_blank" rel="noopener noreferrer">${label}</a>` : label;
    });
    output = output.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    output = output.replace(/(^|\s)\*([^*]+)\*/g, "$1<em>$2</em>");
    output = output.replace(/(^|[\s>])(https?:\/\/[^\s<]+)/g, (_, prefix, url) => {
      const target = externalUrl(url);
      return target ? `${prefix}<a href="${escapeHtml(target)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>` : `${prefix}${escapeHtml(url)}`;
    });
    code.forEach((snippet, index) => { output = output.replace(`%%CODE${index}%%`, snippet); });
    return output;
  }

  function renderMarkdown(markdown) {
    const lines = String(markdown || "").replace(/\r/g, "").split("\n");
    let html = "", paragraph = [], listType = null, inCode = false, codeLines = [], inQuote = false;
    const flushParagraph = () => { if (paragraph.length) { html += `<p>${inlineMarkdown(paragraph.join(" "))}</p>`; paragraph = []; } };
    const flushList = () => { if (listType) { html += `</${listType}>`; listType = null; } };
    const flushQuote = () => { if (inQuote) { html += "</blockquote>"; inQuote = false; } };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith("```")) {
        flushParagraph(); flushList(); flushQuote();
        if (inCode) { html += `<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`; codeLines = []; inCode = false; }
        else inCode = true;
        continue;
      }
      if (inCode) { codeLines.push(line); continue; }
      const tableNext = i + 1 < lines.length && /^\s*\|?\s*:?-+/.test(lines[i + 1]);
      if (line.includes("|") && tableNext) {
        flushParagraph(); flushList(); flushQuote();
        const headers = line.replace(/^\||\|$/g, "").split("|").map(cell => cell.trim());
        i += 2;
        const rows = [];
        while (i < lines.length && lines[i].includes("|")) { rows.push(lines[i].replace(/^\||\|$/g, "").split("|").map(cell => cell.trim())); i++; }
        i--;
        html += `<div class="table-scroll"><table><thead><tr>${headers.map(cell => `<th>${inlineMarkdown(cell)}</th>`).join("")}</tr></thead><tbody>`;
        html += rows.map(row => `<tr>${row.map(cell => `<td>${inlineMarkdown(cell)}</td>`).join("")}</tr>`).join("") + "</tbody></table></div>";
        continue;
      }
      const heading = line.match(/^(#{1,3})\s+(.+)$/);
      if (heading) {
        flushParagraph(); flushList(); flushQuote();
        const level = heading[1].length, title = heading[2].trim();
        html += `<h${level} id="${slugify(title)}">${inlineMarkdown(title)}</h${level}>`;
        continue;
      }
      const bullet = line.match(/^\s*[-*]\s+(.+)$/), ordered = line.match(/^\s*\d+\.\s+(.+)$/);
      if (bullet || ordered) {
        flushParagraph(); flushQuote();
        const wanted = bullet ? "ul" : "ol";
        if (listType !== wanted) { flushList(); listType = wanted; html += `<${wanted}>`; }
        html += `<li>${inlineMarkdown((bullet || ordered)[1])}</li>`;
        continue;
      }
      if (line.startsWith(">")) {
        flushParagraph(); flushList();
        if (!inQuote) { html += "<blockquote>"; inQuote = true; }
        html += `<p>${inlineMarkdown(line.replace(/^>\s?/, ""))}</p>`;
        continue;
      }
      if (!line.trim()) { flushParagraph(); flushList(); flushQuote(); continue; }
      paragraph.push(line.trim());
    }
    flushParagraph(); flushList(); flushQuote();
    if (inCode) html += `<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`;
    return html;
  }

  function formatDate(value, includeTime = false) {
    if (!value) return "—";
    const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
    if (Number.isNaN(date.valueOf())) return String(value);
    return new Intl.DateTimeFormat("en", includeTime ? {month:"short", day:"numeric", hour:"numeric", minute:"2-digit"} : {month:"short", day:"numeric", year:"numeric"}).format(date);
  }

  function score(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return n <= 5 ? Math.round(n * 20) : Math.round(n);
  }

  function priorityValue(item) {
    const decision = {verified_active: 50, credible_unverified: 20, needs_more_evidence: 5, closed: -100, stale: -90, rejected: -100}[item.reviewDecision] || 0;
    const evidence = {official_employer_verified: 24, team_or_researcher_controlled: 14, credible_secondary_lead: 8, social_lead_unverified: 0, closed_or_stale: -80}[item.evidenceState] || 0;
    return decision + evidence + (score(item.fitScore) || 0) * .22 + (score(item.researchScore) || 0) * .18;
  }

  function statusClass(item) {
    if (["closed", "stale", "rejected"].includes(item.reviewDecision) || item.evidenceState === "closed_or_stale") return "closed";
    if (item.reviewDecision === "verified_active" || item.evidenceState === "official_employer_verified") return "verified";
    return "lead";
  }

  function opportunityCard(item, compact = false) {
    const fit = score(item.fitScore), research = score(item.researchScore);
    const tags = [...list(item.regions), humanize(item.lane)].filter(Boolean).slice(0, 3);
    return `<article class="opportunity-card ${compact ? "compact" : ""}" data-opportunity-id="${escapeHtml(item.id)}" tabindex="0">
      <div class="opportunity-top"><span class="status-pill ${statusClass(item)}">${escapeHtml(humanize(item.reviewDecision || item.evidenceState))}</span><span class="observation-count">${item.observationCount} source${item.observationCount === 1 ? "" : "s"}</span></div>
      <h2>${escapeHtml(item.title)}</h2><p class="employer">${escapeHtml(item.employer)}${item.location ? ` · ${escapeHtml(item.location)}` : ""}</p>
      <div class="tag-row">${tags.map(tag => `<span>${escapeHtml(tag)}</span>`).join("")}</div>
      ${compact ? "" : `<p class="scope-copy">${escapeHtml(item.scopeReason || item.reviewRationale || list(item.claims)[0]?.value || "Open for evidence details.")}</p>`}
      <div class="score-row"><span>Fit <b>${fit ?? "—"}</b></span><span>Research <b>${research ?? "—"}</b></span>${item.deadline ? `<span>Deadline <b>${escapeHtml(item.deadline)}</b></span>` : ""}</div>
    </article>`;
  }

  function attachOpportunityCards(root = document) {
    root.querySelectorAll("[data-opportunity-id]").forEach(card => {
      const open = () => showOpportunity(card.dataset.opportunityId);
      card.addEventListener("click", open);
      card.addEventListener("keydown", event => { if (["Enter", " "].includes(event.key)) { event.preventDefault(); open(); } });
    });
  }

  function renderOverview() {
    const latest = data.streams.map(stream => stream.latestDate).filter(Boolean).sort().at(-1);
    $("#today-date").textContent = formatDate(latest);
    $("#build-time").textContent = `Synced ${formatDate(data.generatedAt, true)}`;
    $("#deployment-label").textContent = hosted ? "Private online desk" : "Local workspace";
    $("#hero-eyebrow").textContent = hosted ? "PRIVATE ONLINE RESEARCH DESK" : "LOCAL RESEARCH CONTROL CENTER";
    const counts = data.evidence.counts || {};
    const totalReports = data.streams.reduce((sum, stream) => sum + stream.reportCount, 0);
    const metrics = [
      [counts.opportunities ?? "—", "Opportunities", "Deduplicated bank"],
      [totalReports, "Indexed reports", `${data.streams.length} collections`],
      [counts.reviews ?? "—", "Reviewer decisions", "Fact-check history"],
      [data.upcomingDeadlines.length, "Near deadlines", "Academic window"],
    ];
    $("#metrics").innerHTML = metrics.map(([value,label,note]) => `<div class="metric"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span><small>${escapeHtml(note)}</small></div>`).join("");
    $("#stream-list").innerHTML = data.streams.map(stream => `<div class="stream-row" data-open-stream="${stream.id}"><span class="stream-color ${stream.accent}"></span><div><strong>${escapeHtml(stream.label)}</strong><small>${escapeHtml(stream.description)}</small></div><div class="stream-meta"><b>${stream.reportCount}</b><small>${escapeHtml(stream.latestDate || "—")}</small></div></div>`).join("");
    $("#deadline-list").innerHTML = data.upcomingDeadlines.length ? data.upcomingDeadlines.map(item => {
      const [, month, day] = item.date.split("-");
      return `<div class="deadline-item"><div class="deadline-date"><strong>${day}</strong><small>${new Date(`${item.date}T00:00:00`).toLocaleString("en", {month:"short"})}</small></div><p>${escapeHtml(item.label)}</p></div>`;
    }).join("") : `<div class="empty">No deadline items found in the latest academic report.</div>`;
    const priorities = [...(data.evidence.opportunities || [])].filter(item => statusClass(item) !== "closed").sort((a,b) => priorityValue(b)-priorityValue(a)).slice(0, 6);
    $("#priority-grid").innerHTML = priorities.map(item => opportunityCard(item, true)).join("") || `<div class="empty">No active opportunities in the current snapshot.</div>`;
    attachOpportunityCards($("#priority-grid"));
    if (hosted) {
      $("#documents-panel").hidden = true;
      $("#repository-nav").hidden = true;
      $("#workspace-link").hidden = true;
      $("#logout-form").hidden = !edgeAuthenticated;
    } else {
      $("#document-grid").innerHTML = data.documents.map(doc => `<a class="document-card" href="${pathUrl(doc.path)}" target="_blank" rel="noopener"><span class="doc-type">${escapeHtml(doc.type)}</span><strong>${escapeHtml(doc.name)}</strong><p>${escapeHtml(doc.description)}</p></a>`).join("");
      $("#workspace-link").href = "/";
    }
    $$('[data-open-stream]').forEach(row => row.addEventListener("click", () => openStream(row.dataset.openStream)));
  }

  function populateFilters() {
    const opportunities = data.evidence.opportunities || [];
    const options = (selector, values) => { $(selector).innerHTML += [...new Set(values.filter(Boolean))].sort().map(value => `<option value="${escapeHtml(value)}">${escapeHtml(humanize(value))}</option>`).join(""); };
    options("#lane-filter", opportunities.map(item => item.lane));
    options("#region-filter", opportunities.flatMap(item => item.regions || []));
    options("#status-filter", opportunities.map(item => item.reviewDecision || item.evidenceState));
  }

  function renderOpportunities(reset = true) {
    if (reset) state.opportunityLimit = 36;
    const query = $("#opportunity-search").value.trim().toLowerCase();
    const lane = $("#lane-filter").value, region = $("#region-filter").value, status = $("#status-filter").value;
    let items = (data.evidence.opportunities || []).filter(item => {
      const haystack = [item.title,item.employer,item.team,item.location,item.scopeReason,item.reviewRationale,...list(item.roleFamilies),...list(item.researchActivities)].join(" ").toLowerCase();
      return (!query || haystack.includes(query)) && (!lane || item.lane === lane) && (!region || list(item.regions).includes(region)) && (!status || (item.reviewDecision || item.evidenceState) === status);
    });
    const sort = $("#sort-filter").value;
    items.sort(sort === "newest" ? (a,b) => String(b.observedAt).localeCompare(String(a.observedAt)) : sort === "fit" ? (a,b) => (score(b.fitScore)||0)-(score(a.fitScore)||0) : sort === "employer" ? (a,b) => a.employer.localeCompare(b.employer) : (a,b) => priorityValue(b)-priorityValue(a));
    state.filteredOpportunities = items;
    $("#opportunity-summary").textContent = `${items.length} opportunities · showing ${Math.min(items.length, state.opportunityLimit)}`;
    $("#opportunity-grid").innerHTML = items.slice(0, state.opportunityLimit).map(item => opportunityCard(item)).join("") || `<div class="empty">No opportunities match these filters.</div>`;
    $("#load-more").hidden = items.length <= state.opportunityLimit;
    attachOpportunityCards($("#opportunity-grid"));
  }

  function detailSection(title, content) {
    if (!content || (Array.isArray(content) && !content.length)) return "";
    const rendered = Array.isArray(content) ? `<ul>${content.map(value => `<li>${escapeHtml(typeof value === "string" ? value : JSON.stringify(value))}</li>`).join("")}</ul>` : `<p>${escapeHtml(content)}</p>`;
    return `<section class="detail-section"><h3>${escapeHtml(title)}</h3>${rendered}</section>`;
  }

  function showOpportunity(id) {
    const item = (data.evidence.opportunities || []).find(candidate => candidate.id === id);
    if (!item) return;
    const url = externalUrl(item.url);
    const sources = list(item.sources).map(source => {
      const sourceUrl = externalUrl(source.url);
      return sourceUrl ? `<a class="source-card" href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer"><strong>${escapeHtml(source.publisher || source.sourceType || "Source")}</strong><span>${source.official ? "Official" : "Lead"} · ${escapeHtml(formatDate(source.retrievedAt))}</span><p>${escapeHtml(source.excerpt || source.url)}</p></a>` : "";
    }).join("");
    const facts = [
      ["Location", item.location], ["Work mode", item.workMode], ["Commitment", item.commitment], ["Compensation", item.compensation], ["Work authorization", item.workAuthorization], ["Deadline", item.deadline],
    ].filter(([,value]) => value);
    $("#dialog-content").innerHTML = `<div class="dialog-head"><span class="status-pill ${statusClass(item)}">${escapeHtml(humanize(item.reviewDecision || item.evidenceState))}</span><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.employer)}${item.team ? ` · ${escapeHtml(item.team)}` : ""}</p>${url ? `<a class="primary-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Open application ↗</a>` : ""}</div>
      <div class="fact-grid">${facts.map(([label,value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("")}</div>
      <div class="score-strip"><span>CV fit <b>${score(item.fitScore) ?? "—"}</b></span><span>Research <b>${score(item.researchScore) ?? "—"}</b></span><span>Evidence <b>${escapeHtml(humanize(item.evidenceState))}</b></span></div>
      ${detailSection("Reviewer assessment", item.reviewRationale)}${detailSection("Recommended action", item.recommendedAction)}${detailSection("Eligibility", item.eligibility)}${detailSection("Research activities", item.researchActivities)}${detailSection("Known gaps", item.gaps)}${detailSection("Hard risks", item.risks)}
      ${sources ? `<section class="detail-section"><h3>Source trail</h3><div class="source-stack">${sources}</div></section>` : ""}`;
    const dialog = $("#opportunity-dialog");
    if (typeof dialog.showModal === "function") dialog.showModal(); else dialog.setAttribute("open", "");
  }

  const currentStream = () => data.streams.find(stream => stream.id === state.streamId) || data.streams[0];
  const currentReport = () => currentStream()?.reports.find(report => report.date === state.reportDate) || currentStream()?.reports[0];

  function renderReportTabs() {
    $("#report-tabs").innerHTML = data.streams.map(stream => `<button class="report-tab ${stream.id === state.streamId ? "active" : ""}" data-stream="${stream.id}">${escapeHtml(stream.shortLabel)} <span>${stream.reportCount}</span></button>`).join("");
    $$('[data-stream]').forEach(button => button.addEventListener("click", () => { state.streamId = button.dataset.stream; state.reportDate = currentStream().reports[0]?.date; renderReports(); }));
  }

  function renderReportList(filter = "") {
    const term = filter.trim().toLowerCase();
    const reports = currentStream().reports.filter(report => !term || report.date.includes(term) || report.title.toLowerCase().includes(term) || report.markdown.toLowerCase().includes(term));
    $("#report-list").innerHTML = reports.map(report => `<button class="report-list-item ${report.date === state.reportDate ? "active" : ""}" data-report-date="${report.date}"><time>${escapeHtml(formatDate(report.date))}</time><strong>${escapeHtml(report.title)}</strong></button>`).join("") || `<div class="empty">No matching reports.</div>`;
    $$('[data-report-date]').forEach(button => button.addEventListener("click", () => { state.reportDate = button.dataset.reportDate; renderReader(); renderReportList($("#report-filter").value); }));
  }

  function renderReader() {
    const stream = currentStream(), report = currentReport();
    if (!report) { $("#reader-content").innerHTML = `<div class="empty">No reports in this collection.</div>`; return; }
    $("#reader-stream").textContent = `${stream.label} · ${formatDate(report.date)}`;
    $("#reader-title").textContent = report.title;
    $("#reader-source").hidden = hosted || !report.path;
    if (report.path) $("#reader-source").href = pathUrl(report.path);
    $("#reader-toc").innerHTML = report.sections.map(section => `<button type="button" data-toc-target="${slugify(section)}">${escapeHtml(section)}</button>`).join("");
    $("#reader-content").innerHTML = renderMarkdown(report.markdown);
    $$('[data-toc-target]').forEach(button => button.addEventListener("click", () => document.getElementById(button.dataset.tocTarget)?.scrollIntoView({behavior:"smooth", block:"start"})));
  }

  function renderReports() { renderReportTabs(); renderReportList($("#report-filter").value); renderReader(); }

  function renderEvidence() {
    const counts = data.evidence.counts || {};
    const stats = [[counts.opportunities ?? 0,"Opportunities","Deduplicated entities"],[counts.observations ?? 0,"Observations","Source-linked records"],[counts.reviews ?? 0,"Reviews","Verifier decisions"],[counts.terms ?? 0,"Terms","Search vocabulary"]];
    $("#evidence-hero").innerHTML = stats.map(([value,label,note]) => `<div class="evidence-stat"><strong>${value}</strong><span>${label}</span><small>${note}</small></div>`).join("");
    const statuses = Object.entries(data.evidence.termStatuses || {}).sort((a,b) => b[1]-a[1]), max = Math.max(...statuses.map(([,value]) => value), 1);
    $("#term-statuses").innerHTML = statuses.map(([label,value]) => `<div class="bar-row"><div class="bar-label"><span>${escapeHtml(humanize(label))}</span><strong>${value}</strong></div><div class="bar-track"><div class="bar-fill" style="width:${value/max*100}%"></div></div></div>`).join("");
    $("#scope-list").innerHTML = list(data.evidence.scopeProposals).map(item => `<article class="scope-card"><span>${escapeHtml(humanize(item.decision))}</span><strong>${escapeHtml(item.label || item.id)}</strong><p>${escapeHtml(item.hypothesis || item.rationale)}</p><small>${escapeHtml(list(item.regions).join(" · "))}${item.trialDays ? ` · ${item.trialDays}-day trial` : ""}</small></article>`).join("") || `<div class="empty">No adjacent-scope proposals yet.</div>`;
    renderTerms();
  }

  function renderTerms() {
    const query = $("#term-filter").value.trim().toLowerCase();
    const terms = list(data.evidence.terms).filter(item => !query || [item.term,item.definition,item.whyUseful,...list(item.variants),...list(item.relatedTerms)].join(" ").toLowerCase().includes(query));
    $("#term-grid").innerHTML = terms.map(item => `<article class="term-card"><div><span class="term-status">${escapeHtml(humanize(item.status))}</span><span class="term-category">${escapeHtml(humanize(item.category))}</span></div><h3>${escapeHtml(item.term)}</h3><p>${escapeHtml(item.definition)}</p>${item.whyUseful ? `<small>${escapeHtml(item.whyUseful)}</small>` : ""}${list(item.searchUses).length ? `<details><summary>Search queries</summary>${item.searchUses.map(use => `<code>${escapeHtml(use.query_template)}</code>`).join("")}</details>` : ""}</article>`).join("") || `<div class="empty">No terminology matches.</div>`;
  }

  function renderRepositories() {
    $("#repo-grid").innerHTML = list(data.repositories).map(repo => `<article class="repo-card"><span class="repo-kind">${escapeHtml(repo.kind)}</span><h2>${escapeHtml(repo.name)}</h2><p>${escapeHtml(repo.description)}</p><div class="repo-path">${escapeHtml(repo.path)}</div><div class="repo-foot"><span class="repo-git">${repo.git?.isGit ? `${escapeHtml(repo.git.branch)} · ${escapeHtml(repo.git.commit)}` : "Local collection"}</span><a class="repo-open" href="${pathUrl(repo.path)}" target="_blank" rel="noopener">Open ↗</a></div></article>`).join("");
  }

  function targetCard(item) {
    const profile = externalUrl(item.profileUrl), photo = externalUrl(item.photo);
    return `<article class="target-card" data-target-priority="${Number(item.priority)}" tabindex="0">
      <div class="target-photo-wrap">${photo ? `<img class="target-photo" src="${escapeHtml(photo)}" alt="Official profile photo of ${escapeHtml(item.name)}" loading="lazy" referrerpolicy="no-referrer">` : `<div class="target-initials">${escapeHtml(item.name.split(/\s+/).map(part => part[0]).join("").slice(0,2))}</div>`}<span class="target-number">${Number(item.priority)}</span></div>
      <div class="target-card-body"><span class="target-confidence">${escapeHtml(item.confidence)}</span><h3>${escapeHtml(item.name)}</h3><p class="target-role">${escapeHtml(item.institution)} · ${escapeHtml(item.title)}</p><strong class="target-job">${escapeHtml(item.job)}</strong><p>${escapeHtml(item.relationship)}</p><div class="target-actions">${profile ? `<a href="${escapeHtml(profile)}" target="_blank" rel="noopener noreferrer">Profile ↗</a>` : ""}<button type="button">Open field card</button></div></div>
    </article>`;
  }

  function showTarget(priority) {
    const item = list(data.networking?.targets).find(candidate => Number(candidate.priority) === Number(priority));
    if (!item) return;
    const photo = externalUrl(item.photo), jobUrl = externalUrl(item.jobUrl), profileUrl = externalUrl(item.profileUrl);
    const sources = list(item.sources).map(source => {
      const url = externalUrl(source.url);
      return url ? `<a class="source-card" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer"><strong>${escapeHtml(source.label)}</strong><span>Open source ↗</span></a>` : "";
    }).join("");
    $("#target-dialog-content").innerHTML = `<div class="target-dialog-head">${photo ? `<img src="${escapeHtml(photo)}" alt="Official profile photo of ${escapeHtml(item.name)}" referrerpolicy="no-referrer">` : ""}<div><span class="target-confidence">${escapeHtml(item.confidence)}</span><h2>${escapeHtml(item.name)}</h2><p>${escapeHtml(item.institution)} · ${escapeHtml(item.title)}</p></div></div>
      <div class="target-dialog-actions">${profileUrl ? `<a href="${escapeHtml(profileUrl)}" target="_blank" rel="noopener noreferrer">Official profile ↗</a>` : ""}${jobUrl ? `<a href="${escapeHtml(jobUrl)}" target="_blank" rel="noopener noreferrer">Job posting ↗</a>` : ""}<a href="mailto:${escapeHtml(item.contactEmail)}">Email ${escapeHtml(item.contactEmail)}</a></div>
      ${detailSection("Why this target", item.fit)}${detailSection("Hiring relationship", item.relationship)}${detailSection("Where to find them", item.where)}${detailSection("Recognition note", item.recognition)}
      <section class="detail-section"><h3>Your tailored opener</h3><div class="script-box"><p>${escapeHtml(item.opening)}</p><button type="button" data-copy-text="${escapeHtml(item.opening)}">Copy</button></div></section>
      ${sources ? `<section class="detail-section"><h3>Evidence</h3><div class="source-stack">${sources}</div></section>` : ""}`;
    $("#target-dialog-content [data-copy-text]")?.addEventListener("click", event => copyText(event.currentTarget.dataset.copyText, event.currentTarget));
    const dialog = $("#target-dialog");
    if (typeof dialog.showModal === "function") dialog.showModal(); else dialog.setAttribute("open", "");
  }

  async function copyText(value, button) {
    try {
      await navigator.clipboard.writeText(value);
      const prior = button.textContent; button.textContent = "Copied";
      setTimeout(() => { button.textContent = prior; }, 1200);
    } catch { button.textContent = "Select and copy"; }
  }

  function renderNetworking() {
    const networking = data.networking || {}, event = networking.event || {}, introductions = networking.introductions || {};
    $("#networking-event-note").textContent = event.note || "";
    $("#networking-event-time").textContent = `${event.date ? formatDate(event.date) : ""} · ${event.time || ""}`;
    $("#networking-event-name").textContent = event.name || "APSA networking";
    $("#networking-event-link").href = externalUrl(event.url) || "#";
    const variants = [["tenSecond","10 seconds"],["twentySecond","20 seconds"],["openHouse","Open House"],["exit","Exit line"]];
    let selected = "tenSecond";
    const selectIntro = key => {
      selected = key; $("#intro-text").textContent = introductions[key] || "";
      $$('[data-intro-key]').forEach(button => button.classList.toggle("active", button.dataset.introKey === key));
    };
    $("#intro-tabs").innerHTML = variants.map(([key,label]) => `<button type="button" data-intro-key="${key}">${label}</button>`).join("");
    $$('[data-intro-key]').forEach(button => button.addEventListener("click", () => selectIntro(button.dataset.introKey)));
    selectIntro(selected);
    $("#copy-intro").onclick = event => copyText(introductions[selected] || "", event.currentTarget);
    $("#intro-guidance").innerHTML = list(introductions.guidance).map(item => `<p>${escapeHtml(item)}</p>`).join("");
    const academic = list(data.evidence?.opportunities).filter(item => ["academic_tenure_track","academic_postdoc"].includes(item.lane));
    const verified = academic.filter(item => item.reviewDecision === "verified_active");
    const tenureCount = verified.filter(item => item.lane === "academic_tenure_track").length;
    const postdocCount = verified.filter(item => item.lane === "academic_postdoc").length;
    $("#academic-market-count").textContent = `${verified.length} verified records`;
    $("#academic-market-explainer").textContent = `The four cards below are people with a useful APSA hiring connection. The evidence bank is much larger: ${tenureCount} verified tenure-line records and ${postdocCount} verified postdoctoral records, with duplicates and uncertain leads retained separately for review.`;
    const spotlightIds = [
      "bu-ai-politics-32578",
      "northwestern-quant-political-methodology-2598",
      "columbia-political-methodology-190515",
      "umn-international-relations-methodology-375762",
      "umass-media-technology-politics-509521",
      "sjsu-political-communication-ai-560558",
      "university-alabama-comparative-politics-530396",
      "upenn-picl-computational-politics-postdoc-2026",
    ];
    const spotlight = spotlightIds.map(id => academic.find(item => item.id === id)).filter(Boolean);
    $("#academic-market-grid").innerHTML = spotlight.map(item => opportunityCard(item, true)).join("") || `<div class="empty">Open the Opportunities view for the full academic inventory.</div>`;
    attachOpportunityCards($("#academic-market-grid"));
    $$('[data-academic-lane]').forEach(button => button.addEventListener("click", () => {
      $("#lane-filter").value = button.dataset.academicLane;
      $("#opportunity-search").value = "";
      renderOpportunities();
      navigateTo("opportunities");
    }));
    $('[data-academic-reports]')?.addEventListener("click", event => { event.preventDefault(); openStream("academic"); });
    $("#target-grid").innerHTML = list(networking.targets).sort((a,b) => Number(a.priority)-Number(b.priority)).map(targetCard).join("");
    $$('[data-target-priority]').forEach(card => {
      const open = event => { if (event.target.closest("a")) return; showTarget(card.dataset.targetPriority); };
      card.addEventListener("click", open); card.addEventListener("keydown", event => { if (["Enter"," "].includes(event.key)) { event.preventDefault(); showTarget(card.dataset.targetPriority); } });
    });
    $("#follow-up-list").innerHTML = list(introductions.followUps).map((question,index) => `<div><span>0${index+1}</span><p>${escapeHtml(question)}</p></div>`).join("");
  }

  function setRoute(route) {
    const allowed = ["overview","networking","opportunities","reports","evidence",...(hosted ? [] : ["repositories"])];
    const valid = allowed.includes(route) ? route : "overview";
    $$(".view").forEach(view => view.classList.toggle("active", view.dataset.view === valid));
    $$('[data-route]').forEach(link => link.classList.toggle("active", link.dataset.route === valid));
    $(".sidebar").classList.remove("open");
    window.scrollTo({top:0, behavior:"instant"});
  }

  function openStream(streamId, reportDate) {
    state.streamId = streamId;
    state.reportDate = reportDate || currentStream().reports[0]?.date;
    navigateTo("reports");
    renderReports();
  }

  function showSearch(query) {
    const term = query.trim().toLowerCase();
    if (!term) { $("#search-overlay").classList.remove("open"); return; }
    const results = [];
    list(data.evidence.opportunities).forEach(item => {
      const text = [item.title,item.employer,item.location,item.scopeReason,...list(item.roleFamilies),...list(item.researchActivities)].join(" ");
      if (text.toLowerCase().includes(term)) results.push({type:"Opportunity",title:`${item.title} — ${item.employer}`,excerpt:item.scopeReason || item.location || "Evidence-bank opportunity",action:() => { navigateTo("opportunities"); showOpportunity(item.id); }});
    });
    data.streams.forEach(stream => stream.reports.forEach(report => {
      const index = report.markdown.toLowerCase().indexOf(term);
      if (index >= 0 || report.title.toLowerCase().includes(term)) results.push({type:`${stream.shortLabel} · ${report.date}`,title:report.title,excerpt:report.markdown.slice(Math.max(0,index-70),Math.max(0,index-70)+240).replace(/[#*`|\n]+/g," "),action:() => openStream(stream.id, report.date)});
    }));
    list(data.evidence.terms).forEach(item => {
      if ([item.term,item.definition,...list(item.variants)].join(" ").toLowerCase().includes(term)) results.push({type:"Search term",title:item.term,excerpt:item.definition,action:() => { navigateTo("evidence"); $("#term-filter").value=item.term; renderTerms(); }});
    });
    $("#search-result-title").textContent = `${results.length} match${results.length === 1 ? "" : "es"} for “${query}”`;
    $("#search-results").innerHTML = results.slice(0,100).map((item,index) => `<button class="search-result" data-search-index="${index}"><span class="search-result-meta">${escapeHtml(item.type)}</span><span><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.excerpt)}</p></span></button>`).join("") || `<div class="empty">No jobs, reports, or terms matched.</div>`;
    $("#search-overlay").classList.add("open");
    $$('[data-search-index]').forEach(element => element.addEventListener("click", () => { $("#search-overlay").classList.remove("open"); results[Number(element.dataset.searchIndex)].action(); }));
  }

  function registerInstall() {
    if (edgeAuthenticated && "serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("/sw.js").catch(() => {});
    let prompt;
    window.addEventListener("beforeinstallprompt", event => { event.preventDefault(); prompt = event; $("#install-app").hidden = false; });
    $("#install-app").addEventListener("click", async () => { if (!prompt) return; prompt.prompt(); await prompt.userChoice; prompt = null; $("#install-app").hidden = true; });
  }

  renderOverview(); renderNetworking(); populateFilters(); renderOpportunities(); renderReports(); renderEvidence(); renderRepositories(); registerInstall();
  ["#opportunity-search","#lane-filter","#region-filter","#status-filter","#sort-filter"].forEach(selector => $(selector).addEventListener(selector.includes("search") ? "input" : "change", () => renderOpportunities()));
  $("#load-more").addEventListener("click", () => { state.opportunityLimit += 36; renderOpportunities(false); });
  $("#report-filter").addEventListener("input", event => renderReportList(event.target.value));
  $("#term-filter").addEventListener("input", renderTerms);
  $("#global-search").addEventListener("input", event => showSearch(event.target.value));
  $("#close-search").addEventListener("click", () => $("#search-overlay").classList.remove("open"));
  $("#mobile-menu").addEventListener("click", () => $(".sidebar").classList.toggle("open"));
  $("#dialog-close").addEventListener("click", () => $("#opportunity-dialog").close());
  $("#opportunity-dialog").addEventListener("click", event => { if (event.target === $("#opportunity-dialog")) $("#opportunity-dialog").close(); });
  $("#target-dialog-close").addEventListener("click", () => $("#target-dialog").close());
  $("#target-dialog").addEventListener("click", event => { if (event.target === $("#target-dialog")) $("#target-dialog").close(); });
  document.addEventListener("click", event => {
    const link = event.target.closest('a[href^="#"]');
    if (!link) return;
    const route = link.getAttribute("href").slice(1);
    if (!["overview","networking","opportunities","reports","evidence","repositories"].includes(route)) return;
    event.preventDefault();
    navigateTo(route);
  });
  window.addEventListener("hashchange", () => setRoute(routeFromLocation()));
  document.addEventListener("keydown", event => {
    if (event.key === "/" && document.activeElement.tagName !== "INPUT") { event.preventDefault(); $("#global-search").focus(); }
    if (event.key === "Escape") $("#search-overlay").classList.remove("open");
  });
  setRoute(routeFromLocation() || "overview");
})();
