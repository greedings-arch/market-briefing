// Pure rendering helpers; importing this module never mounts a page or loads data.
(function (root, factory) {
  if (typeof module === 'object' && module.exports)
    module.exports = factory(require('./market-ui'));
  else root.MarketReports = factory(root.MarketUI);
})(typeof window === 'object' ? window : globalThis, (ui) => {
  'use strict';
  const { badge, chart, empty, esc, fmt, list, select, source, table, url } = ui;
  function create({
    anchor,
    config,
    earningsSector,
    emphasize,
    filters,
    href,
    isEarnings,
    reportTab,
    reportTabs,
    title,
  }) {
    const reportCoverage = (r) =>
      r.format === '리서치 해설'
        ? esc(r.basis)
        : r.format === '실적 종합'
          ? '자료별 근거 범위 · ' + esc(r.basis)
          : '원문 근거 ' + fmt(r.coverage * 100, 0) + '% · ' + esc(r.basis);
    function renderReports(data) {
      const allItems = data.items.filter((x) => !isEarnings(x)),
        f = (filters.reports ||= {}),
        items = allItems
          .filter(
            (x) =>
              (!f.sector || f.sector === '전체' || x.sector === f.sector) &&
              (!f.company || f.company === '전체' || x.company === f.company) &&
              (!f.format || f.format === '전체' || x.format === f.format)
          )
          .sort((a, b) => b.source_date.localeCompare(a.source_date));
      let html =
        (reportTabs('deep') || '') +
        title(
          'reports',
          {
            ...data,
            meta: {
              ...data.meta,
              count: allItems.length,
              as_of:
                allItems
                  .map((x) => x.source_date)
                  .filter(Boolean)
                  .sort()
                  .at(-1) || null,
            },
          },
          '증권사·구독 리서치와 산업 심층 해설의 근거와 가정을 검토합니다. 실적 콜은 별도 메뉴에서 읽습니다.'
        );
      html += '<p class="note"><a href="earnings.html">기업별 실적 콜·질의응답 읽기 →</a></p>';
      html += `<div class="filters">${select('sector', '섹터', ['전체', ...config.reports.sectors], f.sector)}${select('company', '기업', ['전체', ...new Set(allItems.map((x) => x.company))], f.company)}${select('format', '형식', ['전체', ...config.reports.formats.filter((format) => !isEarnings({ format }))], f.format)}</div><div class="grid"><div>`;
      if (!items.length)
        html += empty(
          '아직 작성된 심층 리포트가 없습니다',
          '검증된 산업·기업 리서치가 반영되면 표시합니다. 실적 콜은 별도 메뉴에서 확인할 수 있습니다.'
        );
      let month = '';
      for (const r of items) {
        if (month !== r.source_date.slice(0, 7)) {
          month = r.source_date.slice(0, 7);
          html += `<h2 class="month-title">${esc(month.replace('-', '년 '))}월</h2>`;
        }
        html += `<article class="report-card" data-item="${esc(r.id)}"><div class="meta">${badge(r.format)}<span>${esc(r.company)} · ${esc(r.sector)}</span><span>${esc(r.source_date)}</span></div><h2>${anchor('reports', r.id, r.title)}</h2><p>${esc(r.overview)}</p><p class="note">${reportCoverage(r)}</p>${source(r)}<a class="source" href="${esc(href(reportTab(r), r.id))}">본문 열기 →</a></article>`;
      }
      const counts = {};
      for (const r of allItems) counts[r.company] = (counts[r.company] || 0) + 1;
      return (
        html +
        '</div><aside><section class="panel"><h3>기업별 리포트</h3>' +
        Object.entries(counts)
          .map(([key, n]) => `<p class="note">${esc(key)} <b>${n}편</b></p>`)
          .join('') +
        (data.items.length ? '' : '<p class="note">첫 리포트 작성 후 표시됩니다.</p>') +
        '</section><section class="panel"><h3>리포트 구성</h3><p class="note"><b>리서치 해설</b> · 핵심 설명과 분석 → 비판적 재독과 판단 → 원문 독서 우선순위</p><p class="note"><b>인터뷰형</b> · 배경·용어 → 주제별 질문·답변 요지 → 계산·해석 → 한계 → 투자의 생각</p><p class="note">(계산)은 숫자의 검산, (해석)은 편집자의 판단입니다. 전망과 회사 가이던스를 구분합니다. 기존 리포트는 작성 당시 구성을 유지합니다.</p></section></aside></div>'
      );
    }
    function reportComment(x, presentation) {
      return `<aside class="comment ${esc(x.kind)}"><b>${presentation === 'commentary' ? '*코멘트 →' : x.kind === 'calculation' ? '(계산)' : '(해석)'}</b><p>${esc(x.text)}</p>${x.kind === 'calculation' && presentation !== 'commentary' ? `<p class="note">입력 ${x.inputs.map((v, i) => `${x.input_labels?.[i] ? esc(x.input_labels[i]) + ': ' : ''}${fmt(v, 6)}`).join(' · ')} → 계산값 ${fmt(x.result, 4)} ${esc(x.unit || (['percentage', 'growth'].includes(x.operation) ? '%' : ''))}</p>` : ''}${x.assumptions ? `<p class="note">가정·한계: ${esc(x.assumptions)}</p>` : ''}</aside>`;
    }
    function reportNumberTag(label) {
      return String(label).match(/\[(?:원문 사실|원문 추정|공개 자료|내 계산)\]/)?.[0] || '';
    }
    function reportBars(b, presentation) {
      let running = 0;
      const bridge = b.kind === 'bridge',
        bars = b.points.map((p, i) => {
          const total = !bridge || i === 0 || i === b.points.length - 1;
          const start = total ? 0 : running,
            end = total ? p.value : running + p.value;
          running = end;
          return { ...p, start, end, total };
        });
      const low = Math.min(0, ...bars.flatMap((p) => [p.start, p.end])),
        high = Math.max(0, ...bars.flatMap((p) => [p.start, p.end])),
        span = high - low || 1;
      const position = (v) => ((v - low) / span) * 100,
        zero = position(0);
      return `<div class="report-bars" role="img" aria-label="${esc(b.title)}. ${bars.map((p) => esc(p.label) + ': ' + fmt(p.value) + ' ' + esc(b.unit)).join('; ')}"><p class="report-chart-unit">${esc(b.unit)}${bridge ? ' · 시작값에서 항목별 증감을 거쳐 끝값으로 연결' : ''}</p>${bars.map((p) => `<div class="report-bar-row"><span class="report-bar-label">${esc(p.label)}</span><div class="report-bar-track"><i class="report-bar-zero" style="left:${zero}%"></i><span class="report-bar ${p.total ? 'total' : p.value < 0 ? 'negative' : 'positive'}" style="left:${Math.min(position(p.start), position(p.end))}%;width:${(Math.abs(p.end - p.start) / span) * 100}%"></span></div><b>${bridge && !p.total && p.value > 0 ? '+' : ''}${fmt(p.value, 3)}${presentation === 'commentary' && reportNumberTag(p.label) ? `<small class="report-value-tag">${esc(reportNumberTag(p.label))}</small>` : ''}</b></div>`).join('')}</div>`;
    }
    function reportDate(date) {
      const parts = String(date).match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
      return parts
        ? `${parts[1]}년 ${Number(parts[2])}월${parts[3] ? ' ' + Number(parts[3]) + '일' : ''}`
        : String(date);
    }
    function reportSourceDate(date, sourceURL, originalSourceURL) {
      const normalized = (value) =>
        String(value || '')
          .split(/[?#]/)[0]
          .replace(/\/$/, '');
      const tag =
        normalized(sourceURL) === normalized(originalSourceURL) ? '[원문 사실]' : '[공개 자료]';
      return reportDate(date) + ' ' + tag;
    }
    function reportCitation(b, presentation, originalSourceURL) {
      if (!b.source_url) return '';
      let name = '출처';
      try {
        name = new URL(b.source_url).hostname.replace(/^www\./, '');
      } catch {}
      return `<p class="source report-citation">${url(b.source_url, name + ' ↗')}<span> · ${esc(presentation === 'commentary' ? reportSourceDate(b.source_date, b.source_url, originalSourceURL) : b.source_date)}${b.locator ? ' · ' + esc(b.locator) : ''}</span></p>`;
    }
    function reportBlock(b, presentation, originalSourceURL) {
      const citation = reportCitation(b, presentation, originalSourceURL);
      const marked = (value) => emphasize(value, b.highlights);
      let html = '';
      if (b.type === 'paragraph') html = `<p>${marked(b.text)}</p>`;
      if (b.type === 'subheading') html = `<h3>${esc(b.text)}</h3>`;
      if (b.type === 'bullets')
        html = `<ul class="report-bullets">${b.items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
      if (b.type === 'dialogue')
        html = `<div class="report-dialogue ${esc(b.role)}"><p class="dialogue-speaker"><b>${esc(b.speaker)}</b><span>${b.role === 'question' ? '질문 요지' : '답변 요지'}</span></p>${b.paragraphs.map((p) => `<p>${marked(p)}</p>`).join('')}</div>`;
      if (b.type === 'comment') html = reportComment(b, presentation);
      if (b.type === 'table')
        html = `<figure class="report-figure"><figcaption>${esc(b.title)}</figcaption>${table(b.columns, b.rows)}</figure>`;
      if (b.type === 'chart')
        html = `<figure class="report-figure report-chart"><figcaption>${esc(b.title)}</figcaption>${b.kind ? reportBars(b, presentation) : chart([{ label: b.title, points: b.points }], { unit: b.unit })}${b.caption ? `<p class="report-figure-caption">${esc(b.caption)}</p>` : ''}<details class="report-chart-data"><summary>숫자 표 보기</summary>${table(
          ['기간·구분', b.unit],
          b.points.map((p) => [
            p.label,
            presentation === 'commentary'
              ? fmt(p.value, 3) + (reportNumberTag(p.label) ? ' ' + reportNumberTag(p.label) : '')
              : p.value,
          ])
        )}</details></figure>`;
      if (b.type === 'diagram')
        html = `<figure class="report-figure report-diagram ${b.layout === 'parallel' ? 'report-parallel' : 'report-sequence'}"><figcaption>${esc(b.title)}</figcaption><${b.layout === 'parallel' ? 'ul' : 'ol'}>${b.steps.map((step, i) => `<li>${b.layout === 'parallel' ? '' : `<span class="report-step-number">${String(i + 1).padStart(2, '0')}</span>`}<div><strong>${esc(step.title)}</strong><p>${esc(step.text)}</p></div></li>`).join('')}</${b.layout === 'parallel' ? 'ul' : 'ol'}><p class="report-figure-caption">${esc(b.caption)}</p></figure>`;
      return `<div class="report-block">${html}${citation}</div>`;
    }
    function reportCommentary(r, context) {
      const e = r.editorial,
        link = (s) => href(reportTab(r), r.id, { ...context, section: s.id });
      const sourceNotice = () =>
        `<aside class="report-original-source" aria-label="원문 안내"><p class="report-original-label">이 글이 읽은 원문 · ${e.source_access === 'paid' ? '유료 자료' : ''}</p><p class="report-original-title">${url(r.source_url, e.source_title + ' ↗')}</p><p>발행 ${esc(reportDate(r.source_date))} [원문 사실] · ${esc(r.source_name || 'SemiAnalysis')}</p></aside>`;
      const toc = `<nav class="toc report-essay-toc report-commentary-toc" aria-label="리포트 목차"><p class="eyebrow">목차</p><div>${r.sections.map((s) => `<a href="${esc(link(s))}">${esc(s.title)} : ${esc(s.subtitle)}</a>`).join('')}</div></nav>`;
      const related = list(e.related_reports)
        .map(
          (x) =>
            `<a href="${esc(href('reports', x.id, context))}">${esc(x.title)} <span aria-hidden="true">↗</span></a>`
        )
        .join('');
      return `<div class="report-reader-tools"><a href="${esc(href(reportTab(r), null, reportTab(r) === 'earnings' ? context : { ...context, section: 'deep' }))}">← ${reportTab(r) === 'earnings' ? '실적 콜' : '심층 리포트'}</a><button type="button" data-report-print>인쇄 / PDF 저장</button></div><article class="report-body report-essay report-commentary" tabindex="-1" data-item="${esc(r.id)}"><header class="report-opening"><p class="eyebrow">MARKET BRIEFING · 심층 해설</p><h1>${esc(r.title)}</h1><p class="report-deck">${esc(r.overview)}</p><div class="report-dateline"><span>첨부 원문과 공개 자료를 대조해 전면 개정</span></div></header>${sourceNotice()}<div class="report-intro">${e.introduction.map((p) => `<p>${esc(p)}</p>`).join('')}</div>${toc}${r.sections.map((s) => `<section id="section-${esc(s.id)}" class="report-section report-${esc(s.role)}"><div class="report-chapter"><h2>${esc(s.title)}</h2><p class="report-chapter-subtitle">${esc(s.subtitle)}</p></div>${s.blocks.map((b) => reportBlock(b, 'commentary', r.source_url)).join('')}</section>`).join('')}<section class="report-methodology"><h2>근거 자료</h2><p>${reportCoverage(r)}</p><details class="report-source-ledger"><summary>자료별 링크와 발행일</summary><div class="report-references">${list(
        r.references
      )
        .map(
          (ref) =>
            `<p>${url(ref.url, ref.label)} <span>· ${esc(reportSourceDate(ref.date, ref.url, r.source_url))}</span></p>`
        )
        .join(
          ''
        )}</div></details></section>${related ? `<section class="report-related report-essay-related"><h2>함께 읽을 분석</h2>${related}</section>` : ''}${sourceNotice()}</article>`;
    }
    function reportEssay(r, context) {
      const e = r.editorial,
        link = (s) => href(reportTab(r), r.id, { ...context, section: s.id });
      const toc = `<nav class="toc report-essay-toc" aria-label="리포트 목차"><p class="eyebrow">CONTENTS</p><ol>${r.sections.map((s, i) => `${s.part_title ? `<li class="report-toc-part">${esc(s.part_title)}</li>` : ''}<li><a href="${esc(link(s))}"><span>${String(i + 1).padStart(2, '0')}</span>${esc(s.title)}</a></li>`).join('')}</ol></nav>`;
      const related = list(e.related_reports)
        .map(
          (x) =>
            `<a href="${esc(href('reports', x.id, context))}">${esc(x.title)} <span aria-hidden="true">↗</span></a>`
        )
        .join('');
      return `<div class="report-reader-tools"><a href="${esc(href(reportTab(r), null, reportTab(r) === 'earnings' ? context : { ...context, section: 'deep' }))}">← ${reportTab(r) === 'earnings' ? '실적 콜' : '심층 리포트'}</a><button type="button" data-report-print>인쇄 / PDF 저장</button></div><article class="report-body report-essay" tabindex="-1" data-item="${esc(r.id)}"><header class="report-opening"><p class="eyebrow">MARKET BRIEFING · ${r.format === '리서치 해설' ? 'RESEARCH REVIEW' : r.format === '실적 종합' ? 'AI INFRASTRUCTURE' : e.template === 'interview' ? 'LONGFORM INTERVIEW' : 'EARNINGS REVIEW'}</p><h1>${esc(r.title)}</h1><p class="report-deck">${esc(r.overview)}</p><div class="report-dateline"><span>${esc(r.period)}</span><span>${r.call_date ? '콜 ' + esc(r.call_date) + ' · ' : ''}원문 ${esc(r.source_date)}</span><span>개정 ${esc(r.updated_on || r.written_on || r.source_date)}</span></div></header><div class="report-intro">${e.introduction.map((p) => `<p>${esc(p)}</p>`).join('')}</div><aside class="report-reading-thesis"><strong>이 글에서 짚을 변화</strong><ul>${e.key_takeaways.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></aside>${toc}${r.sections.map((s, i) => `<section id="section-${esc(s.id)}" class="report-section report-${esc(s.role)}">${s.part_title ? `<p class="report-part-title">${esc(s.part_title)}</p>` : ''}<div class="report-chapter"><span>${String(i + 1).padStart(2, '0')}</span><h2>${esc(s.title)}</h2></div>${s.blocks.map(reportBlock).join('')}</section>`).join('')}<section class="report-watch"><p class="eyebrow">NEXT CHECK</p><h2>${r.format === '리서치 해설' ? '다음에 확인할 질문' : '다음 실적에서 이어서 볼 질문'}</h2>${e.watchpoints.map((x, i) => `<div class="report-watchpoint"><span>${String(i + 1).padStart(2, '0')}</span><div><h3>${esc(x.metric)}</h3><p>${esc(x.condition)}</p><small>${esc(x.timing)}</small></div></div>`).join('')}</section><section class="report-methodology"><h2>자료와 읽은 범위</h2><p>${reportCoverage(r)}</p>${r.comparison ? `<p><b>직전 자료와의 연결</b> ${esc(r.comparison.guidance_change)}</p>${r.comparison.previous_report_id ? `<p><a href="${esc(href('reports', r.comparison.previous_report_id, context))}">이전 리포트 →</a></p>` : ''}` : ''}${list(e.glossary).length ? `<details class="report-glossary"><summary>용어 풀이</summary><dl>${e.glossary.map((x) => `<dt>${esc(x.term)}</dt><dd>${esc(x.definition)}</dd>`).join('')}</dl></details>` : ''}<details class="report-source-ledger"><summary>근거 자료 ${list(r.references).length}건</summary><ol class="report-references">${list(
        r.references
      )
        .map((ref) => `<li>${url(ref.url, ref.label)} <span>· ${esc(ref.date)}</span></li>`)
        .join(
          ''
        )}</ol></details></section>${related ? `<section class="report-related report-essay-related"><h2>함께 읽을 분석</h2>${related}</section>` : ''}</article>`;
    }
    function reportCall(r, context) {
      const e = r.editorial,
        sector = earningsSector(r, config.reports?.coverage_groups),
        back = 'earnings.html' + (sector ? '?sector=' + sector : '');
      return `<div class="report-reader-tools"><a href="${esc(back)}">← 업종별 실적 콜</a><button type="button" data-report-print>인쇄</button></div><article class="report-body report-essay report-call" tabindex="-1" data-item="${esc(r.id)}"><header class="report-opening"><p class="eyebrow">실적 콜 · 발언과 질의응답</p><h1>${esc(r.title)}</h1><p class="report-deck">${esc(r.overview)}</p><div class="report-dateline"><span>${esc(r.period)}</span><span>${r.call_date ? '콜 ' + esc(r.call_date) + ' · ' : ''}원문 ${esc(r.source_date)}</span><span>개정 ${esc(r.updated_on || r.source_date)}</span></div></header><aside class="report-reading-thesis"><strong>핵심 메시지</strong><ul>${e.key_takeaways.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></aside><p class="report-call-scope">${esc(r.basis)} · 아래 발언은 한국어 요지입니다. 주요 구간을 원문 순서로 읽으며, 생략한 구간은 원문에서 확인하실 수 있습니다.</p><nav class="toc report-essay-toc" aria-label="실적 콜 목차"><ol>${r.sections.map((s) => `<li><a href="${esc(href('earnings', r.id, { ...context, section: s.id }))}">${esc(s.title)}</a></li>`).join('')}</ol></nav>${r.sections.map((s) => `<section id="section-${esc(s.id)}" class="report-section"><h2>${esc(s.title)}</h2>${s.blocks.map((b) => reportBlock(b)).join('')}</section>`).join('')}<section class="report-methodology"><h2>원문과 확인 범위</h2><p>${esc(r.basis)}</p><ul class="report-references">${list(
        r.references
      )
        .map((ref) => `<li>${url(ref.url, ref.label)} · ${esc(ref.date)}</li>`)
        .join('')}</ul></section></article>`;
    }
    function reportBody(r, params = new URLSearchParams()) {
      const company = config.workspace?.companies.find((c) => c.id === params.get('company')),
        context = company ? { company: company.id } : {};
      const e = r.editorial;
      if (e?.presentation === 'call') return reportCall(r, context);
      if (e?.presentation === 'commentary') return reportCommentary(r, context);
      if (e?.layout === 'essay') return reportEssay(r, context);
      const intro = e
        ? `<div class="report-takeaways"><p class="eyebrow">한눈에 보기</p><ul>${e.key_takeaways.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></div><div class="report-intro">${e.introduction.map((p) => `<p>${esc(p)}</p>`).join('')}</div>${list(e.related_reports).length ? `<div class="report-related"><b>함께 읽기</b>${e.related_reports.map((x) => anchor('reports', x.id, x.title)).join('')}</div>` : ''}`
        : '';
      const references = list(r.references)
        .map((ref) => `<li>${url(ref.url, ref.label)} · ${esc(ref.date)}</li>`)
        .join('');
      return `<a class="back" href="${esc(href(reportTab(r), null, reportTab(r) === 'earnings' ? context : { ...context, section: 'deep' }))}">← ${reportTab(r) === 'earnings' ? '실적 콜' : '리포트'} 목록</a><article class="report-body" tabindex="-1" data-item="${esc(r.id)}"><div class="meta">${badge(r.format)}${e ? badge(r.format === '리서치 해설' ? '리서치 해설' : r.format === '실적 종합' ? '실적 연결' : e.template === 'earnings' ? '실적 심층' : '인터뷰 심층') : ''}<span>${esc(r.company)} · ${esc(r.sector)} · ${esc(r.period)}</span></div><h1>${esc(r.title)}</h1><p class="report-deck">${esc(r.overview)}</p>${source(r)}<p class="note">${reportCoverage(r)}${r.written_on ? ` · 작성 ${esc(r.written_on)}` : ''}</p>${intro}<nav class="toc" aria-label="리포트 목차"><strong>목차</strong><ol>${r.sections.map((s) => `<li><a href="${esc(href(reportTab(r), r.id, { ...context, section: s.id }))}">${esc(s.title)}</a></li>`).join('')}</ol></nav>${list(e?.glossary).length ? `<details class="report-glossary"><summary>먼저 알아둘 용어</summary><dl>${e.glossary.map((x) => `<dt>${esc(x.term)}</dt><dd>${esc(x.definition)}</dd>`).join('')}</dl></details>` : ''}${r.sections
        .map(
          (s, i) =>
            `<section id="section-${esc(s.id)}" class="report-section ${s.role ? 'report-' + esc(s.role) : ''}">${e ? `<p class="eyebrow">${String(i + 1).padStart(2, '0')}</p>` : ''}<h2>${esc(s.title)}</h2>${
              s.blocks
                ? s.blocks.map(reportBlock).join('')
                : list(s.paragraphs)
                    .map((p) => `<p>${esc(p)}</p>`)
                    .join('') + list(s.comments).map(reportComment).join('')
            }</section>`
        )
        .join('')}${list(r.charts)
        .map(
          (x) =>
            `<section><h2>${esc(x.title)}</h2>${chart([{ label: x.title, points: x.points }], { unit: x.unit })}${source(x)}</section>`
        )
        .join('')}${list(r.tables)
        .map(
          (x) =>
            `<section><h2>${esc(x.title)}</h2>${table(x.columns, x.rows)}${source(x)}</section>`
        )
        .join(
          ''
        )}${r.comparison ? `<section><h2>이전 자료와 달라진 점</h2><p>${esc(r.comparison.guidance_change)}</p>${r.comparison.previous_report_id ? anchor('reports', r.comparison.previous_report_id, '이전 리포트 →') : ''}</section>` : ''}${r.investment_impact ? `<div class="impact investment"><b>투자에 주는 의미 · 편집 해석</b><p>${esc(r.investment_impact)}</p></div>` : ''}${
        e
          ? `<section><h2>다음에 확인할 것</h2>${table(
              ['관측 지표', '판단이 달라지는 조건', '확인 시점'],
              e.watchpoints.map((x) => [x.metric, x.condition, x.timing])
            )}</section>`
          : ''
      }${references ? `<section><h2>근거 자료</h2><ul class="report-references">${references}</ul></section>` : ''}</article>`;
    }
    return { render: renderReports, detail: reportBody };
  }
  return { create };
});
