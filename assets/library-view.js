// Pure rendering helpers; importing this module never mounts a page or loads data.
(function (root, factory) {
  if (typeof module === 'object' && module.exports)
    module.exports = factory(require('./market-ui'));
  else root.MarketLibrary = factory(root.MarketUI);
})(typeof window === 'object' ? window : globalThis, (ui) => {
  'use strict';
  const { badge, empty, esc, fmt, list, select, source, url } = ui;
  function create({ anchor, config, filters, getStatus, href, title }) {
    function article(r) {
      return `<article class="story" tabindex="-1" data-item="${esc(r.id)}"><div class="meta">${badge(r.category)}<span>중요도 ${esc(r.importance)}/5</span><span>원문 ${esc(r.source_date)}</span>${r.date && r.date !== r.source_date ? `<span>회차 ${esc(r.date)}</span>` : ''}${r.followup ? badge('후속') : ''}${r.paywall ? badge('유료') : ''}${!r.verified ? badge('확인 필요') : ''}${r.legacy ? badge('기존 회차') : ''}</div><h2>${url(r.source_url, r.title)}</h2>${list(
        r.summary
      )
        .map((x) => `<p>${esc(x)}</p>`)
        .join(
          ''
        )}<div class="impact"><strong>${r.legacy ? '당시 사업 시사점' : '업계 의미'}</strong>${esc(r.impact)}</div>${r.investment_impact ? `<div class="impact investment"><strong>투자에 주는 의미 · 편집 해석</strong>${esc(r.investment_impact)}</div>` : r.legacy ? '<p class="note">기존 사업 브리핑입니다. 투자 관점으로 재검토한 원고는 아닙니다.</p>' : ''}${source(r)}${r.verification_basis ? `<p class="note">${esc(r.verification_basis)}</p>` : ''}<a class="source" href="${esc(href('news', r.id))}">이 기사 주소</a></article>`;
    }
    function renderNews(data, params) {
      const f = (filters.news ||= {}),
        target = data.items.find((x) => x.id === params.get('id'));
      if (target) {
        f.category = '전체';
        f.date = target.date || '전체';
      }
      const categories = ['전체', ...new Set(data.items.map((x) => x.category))],
        dates = [
          '전체',
          ...new Set(
            data.items
              .map((x) => x.date || x.source_date)
              .sort()
              .reverse()
          ),
        ];
      const items = data.items
        .filter(
          (x) =>
            (!f.category || f.category === '전체' || x.category === f.category) &&
            (!f.date || f.date === '전체' || (x.date || x.source_date) === f.date)
        )
        .sort(
          (a, b) =>
            (b.date || b.source_date).localeCompare(a.date || a.source_date) ||
            (b.importance || 0) - (a.importance || 0)
        );
      return (
        title('news', data, '결론과 사실, 업계 의미와 투자 해석을 나누어 읽습니다.') +
        `<div class="filters">${select('category', '분류', categories, f.category)}${select('date', '회차', dates, f.date)}</div>` +
        (items.length ? items.map(article).join('') : empty('선택한 조건의 기사가 없습니다'))
      );
    }
    function renderSummary(data) {
      let main = title('summary', data, '오늘 바뀐 것부터, 영향이 큰 순서로 읽습니다.');
      if (data.cards.length)
        main += `<div class="stats">${data.cards.map((x) => `<a class="stat-card" href="${esc(href(x.tab, x.id))}"><span>${esc(x.label)}</span><b>${fmt(x.value)}</b><small>${esc(x.unit)} · ${esc(x.date)}${Number.isFinite(x.change) ? ` · 직전 관측 대비 ${fmt(x.change)}%` : ''}</small></a>`).join('')}</div>`;
      main += '<div class="grid"><div>';
      main += data.oneliner
        ? `<section class="lead"><p class="eyebrow">TODAY'S TAKEAWAY</p><h2>${esc(data.oneliner)}</h2>${list(data.messages).length ? `<ol>${data.messages.map((x, i) => `<li>${data.message_sources?.[i] ? anchor('news', data.message_sources[i], x) : esc(x)}</li>`).join('')}</ol>` : ''}${data.coverage_note ? `<p class="note">${esc(data.coverage_note)}</p>` : ''}</section>`
        : empty(
            '오늘 회차를 기다리고 있습니다',
            `예정 기준일 ${getStatus().expected_daily}. 마지막으로 발행한 일간 회차는 ${getStatus().latest_daily || '아직 없습니다'}. 새로운 자료를 확인하기 전에는 오늘 소식으로 표시하지 않습니다.`
          );
      main += `<section class="panel" style="margin-top:18px"><div class="panel-head"><h2>이번 수집의 주요 소식</h2><span class="note">최대 8건</span></div>${data.highlights.length ? `<ol class="ranked">${data.highlights.map((x, i) => `<li><span class="rank">${String(i + 1).padStart(2, '0')}</span><div><div class="meta">${esc(config.tabs.find((t) => t.id === x.tab)?.label)} · 새 반영 ${esc(x.date)}${x.source_date && x.source_date !== x.date ? ` · 원문 ${esc(x.source_date)}` : ''}</div>${anchor(x.tab, x.id, x.title)}</div></li>`).join('')}</ol>` : '<p class="note">아직 오늘 확인한 주요 소식이 없습니다.</p>'}</section></div><aside>`;
      if (data.week)
        main += `<section class="panel"><p class="eyebrow">WEEKLY VIEW</p><h3>최신 주간 한 줄</h3><p>${anchor('weekly', data.week.id, data.week.title)}</p><span class="note">${esc(data.week.date)}</span></section>`;
      if (data.latest_report)
        main += `<section class="panel"><p class="eyebrow">DEEP READ</p><h3>${anchor('reports', data.latest_report.id, data.latest_report.title)}</h3></section>`;
      if (data.finance.length)
        main += `<section class="panel"><h3>이번 주 금융권</h3>${data.finance
          .slice(0, 2)
          .map((x) => `<p>${badge(x.stance)} ${anchor('finance', x.id, x.title)}</p>`)
          .join('')}</section>`;
      if (data.interview)
        main += `<section class="panel"><p class="eyebrow">LEADERS</p><h3>${anchor('interviews', data.interview.id, data.interview.headline || data.interview.title)}</h3><p class="note">${esc(data.interview.source_date)}</p></section>`;
      for (const [key, tab, label] of [
        ['temperature', 'temperature', '시장 온도'],
        ['ai_state', 'ai-state', 'AI 현주소'],
      ])
        if (data[key])
          main += `<section class="panel"><h3>${esc(label)}</h3>${anchor(tab, data[key].id, data[key].title)}</section>`;
      if (data.watch.length)
        main += `<section class="panel"><h3>최근 주간 관전 포인트</h3>${data.watch.map((x) => `<p class="note">${esc(x.date)} · ${esc(x.text)}</p>`).join('')}</section>`;
      return main + '</aside></div>';
    }
    function weekID(date) {
      const d = new Date(date + 'T12:00:00Z');
      d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
      const y = d.getUTCFullYear();
      return (
        y +
        '-W' +
        String(Math.ceil(((d - new Date(Date.UTC(y, 0, 1))) / 86400000 + 1) / 7)).padStart(2, '0')
      );
    }
    const investorGroupLabel = (id) =>
      config.finance.coverage_groups.find((g) => g.id === id)?.label || '명단 밖·기타';
    const financeStageLabels = {
      claim: '발언·연구 주장',
      position: '공개 포지션·투자 행동',
      flow: '시장 수급',
      earnings: '기업 실적',
      price: '가격·기대',
    };
    const financeStatusLabels = { verified: '확인', partial: '부분 확인', missing: '미확인' };
    const financeFormatLabels = {
      memo: '투자 메모',
      report: '리서치 보고서',
      chartbook: '차트북·시장지도',
      essay: '분석 글',
      interview: '대담·팟캐스트',
      fund_letter: '펀드·주주서한',
    };
    function financeReferences(study, ids) {
      return `<div class="finance-ref-links">${list(ids)
        .map((id) => study.references.find((r) => r.id === id))
        .filter(Boolean)
        .map((r) => url(r.url, r.title + ' · ' + r.published_on))
        .join('')}</div>`;
    }
    function financeInsight(x) {
      const i = x.insight;
      if (!i) return '';
      return `<div class="finance-insight"><div class="meta">${badge(financeFormatLabels[i.format] || i.format)}<span>발행 ${esc(i.publisher)} · 검토 ${esc(i.reviewed_on)}</span></div><p><b>이 자료가 답하려는 질문</b> · ${esc(i.question)}</p><ul>${list(
        i.findings
      )
        .map((f) => `<li>${esc(f)}</li>`)
        .join(
          ''
        )}</ul><p class="note"><b>자료의 방법·범위</b> · ${esc(i.method)}</p><p class="research-limit"><b>한계</b> · ${esc(i.limitations)}</p></div>`;
    }
    function financeCompanySnapshot(company) {
      if (!company)
        return '<p class="note">기업 가격·실적 스냅샷 미확인 · 기업 검증 화면에서 확인해 주세요.</p>';
      const findSource = (id) => list(company.sources).find((s) => s.id === id),
        q = company.quote,
        qs = findSource(q?.source);
      const priceOK = q && Number.isFinite(q.value) && qs,
        age = priceOK ? (Date.now() - Date.parse(q.date + 'T00:00:00Z')) / 86400000 : Infinity;
      let html = `<div class="finance-company-snapshot"><p class="note">기존 가격·실적 스냅샷 · ${esc(company.snapshot_as_of)} · 사례 검토 이후의 갱신이 결론에 자동 반영되지는 않습니다.</p>`;
      html += priceOK
        ? `<p><b>${fmt(q.value, company.currency === 'KRW' ? 0 : 2)} ${esc(company.currency)}</b> <span class="note">${esc(q.date)} ${esc(q.time)} · ${esc(q.session)}</span>${age > 7 ? badge('가격 갱신 필요') : ''}</p><p class="note">${url(qs.url, '가격 원문 ↗')} · 보존된 관측값이며 실시간 가격이 아닙니다.</p>`
        : '<p class="note">가격·가격 출처 미확인</p>';
      html += `<ul class="finance-metrics">${
        list(company.metrics)
          .map((m) => {
            const s = findSource(m.source);
            return `<li><span>${esc(m.label)} <b>${fmt(m.value, 4)} ${esc(m.unit)}</b></span><small>${esc(m.period)} · ${s ? url(s.url, '실적 원문 ↗') : '출처 미확인'}</small></li>`;
          })
          .join('') || '<li>실적 스냅샷 미확인</li>'
      }</ul></div>`;
      return html;
    }
    function financeCaseCard(x, data, target) {
      const s = x.case_study,
        stages = Object.keys(financeStageLabels)
          .map((k) => s.stages.find((t) => t.kind === k))
          .filter(Boolean),
        name = (id) => config.workspace.companies.find((c) => c.id === id)?.name || id;
      return `<article class="finance-case view-card" tabindex="-1" data-item="${esc(x.id)}"><div class="meta"><strong>${esc(x.institution)}</strong>${badge('투자 연결 사례')}${!x.verified ? badge('확인 필요') : ''}<span>원문 ${esc(x.source_date)} · 사례 검토 ${esc(s.reviewed_on)}</span></div><h3>${esc(x.title)}</h3><p class="note finance-speaker">${esc(x.speaker)} · ${esc(x.affiliation)}</p><p class="finance-case-question">${esc(s.question)}</p><p class="finance-case-verdict">${esc(s.verdict)}</p><div class="finance-thesis-status"><p><b>사업 가설</b> ${esc(s.thesis_status)}</p><p><b>주식·가격 판단</b> ${esc(s.security_status)}</p></div><p class="note">${esc(s.period_label)}</p><ol class="finance-stage-strip">${stages.map((t) => `<li class="${esc(t.status)}"><b>${esc(financeStageLabels[t.kind])}</b><span>${esc(financeStatusLabels[t.status])}</span><small>${esc(t.as_of)}</small></li>`).join('')}</ol><details class="finance-case-detail" ${target === x.id ? 'open' : ''}><summary>5단계 증거와 기업별 영향 펼치기</summary>${financeInsight(x)}<div class="finance-stages">${stages.map((t, n) => `<section class="finance-stage"><div class="meta"><span class="finance-step">${String(n + 1).padStart(2, '0')}</span><h4>${esc(financeStageLabels[t.kind])}</h4>${badge(financeStatusLabels[t.status])}</div><p class="note">관측 기준 ${esc(t.as_of)} · ${esc(t.period_label)}</p>${t.facts.length ? `<ul>${t.facts.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>` : '<p class="note">이 단계의 사실 자료는 아직 확보하지 못했습니다.</p>'}<p><b>투자 해석</b> · ${esc(t.interpretation)}</p><p class="research-limit"><b>확인 범위·공백</b> · ${esc(t.limitations)}</p>${financeReferences(s, t.reference_ids)}</section>`).join('')}</div><h4 class="finance-impact-title">관심 기업에 어떻게 연결되는가</h4><div class="finance-company-grid">${list(
        s.company_impacts
      )
        .map(
          (t) =>
            `<section class="finance-company-impact"><h4>${esc(name(t.company_id))}</h4><p><b>이익 연결</b> · ${esc(t.mechanism)}</p><p><b>확보한 근거</b> · ${esc(t.support)}</p><p><b>다음 확인</b> · ${esc(t.next_check)}</p><p><b>가격 질문</b> · ${esc(t.price_question)}</p>${financeReferences(s, t.reference_ids)}${financeCompanySnapshot(list(data.company_contexts).find((c) => c.id === t.company_id))}<nav>${anchor('company', t.company_id, '기업 가설 →')}${anchor('valuation', t.company_id, '가격 검토 →')}</nav></section>`
        )
        .join(
          ''
        )}</div><section class="finance-next"><h4>다음 점검 · ${esc(s.next_check.date)}</h4><p class="note">${s.next_check.date_basis === 'scheduled' ? '공식 일정 기준' : '편집 검토 예정일 · 회사 발표일이 아닙니다'}</p><p>${esc(s.next_check.trigger)}</p><p><b>확인 후 조치</b> · ${esc(s.next_check.action)}</p><p><b>판단을 바꿀 조건</b> · ${esc(s.counterpoint)}</p></section><details class="finance-bibliography"><summary>전체 근거와 자료 범위 (${s.references.length})</summary><ol>${s.references.map((r) => `<li>${url(r.url, r.title)}<small>${esc(r.published_on)} · ${esc(r.kind === 'primary' ? '1차 자료' : r.kind === 'market' ? '시장 자료' : '방법·제도')} · ${esc(r.note)}</small></li>`).join('')}</ol></details></details><p class="self-interest">이해관계: ${esc(x.self_interest)}</p>${source(x)}<a class="source" href="${esc(href('finance', x.id))}">이 사례 주소 →</a></article>`;
    }
    function viewCard(x) {
      return `<article class="view-card" tabindex="-1" data-item="${esc(x.id)}"><div class="meta"><strong>${esc(x.institution)}</strong><span>${esc(investorGroupLabel(x.investor_group))}</span><span>${esc(x.source_date)}</span>${badge(x.stance)}${x.insight ? badge('기관 리서치·인사이트') : ''}${!x.verified ? badge('확인 필요') : ''}</div><h3>${url(x.source_url, x.title)}</h3><p>${esc(x.claim)}</p><p class="note">${esc(x.speaker)} · ${esc(x.affiliation)}</p>${financeInsight(x)}${x.analysis ? `<p><b>핵심 논리</b> · ${esc(x.analysis.rationale)}</p>` : ''}${x.investment_impact ? `<p><b>투자에 주는 의미</b> · ${esc(x.investment_impact)}</p>` : ''}${x.analysis ? `<p><b>다음 확인 변수</b> · ${esc(x.analysis.watch)}</p><p><b>반대 조건</b> · ${esc(x.analysis.counterpoint)}</p><p class="note">메시지 검토 ${esc(x.analysis.reviewed_on)}</p>` : ''}<p class="self-interest">이해관계: ${esc(x.self_interest)}</p>${source(x)}${x.legacy ? '<span class="note">기존 회차 · 추가 확인 항목은 미확인으로 남겼습니다.</span>' : ''}<a class="source" href="${esc(href('finance', x.id))}">이 자료 주소 →</a></article>`;
    }
    function renderFinance(data, params) {
      const f = (filters.finance ||= {});
      if (params.get('id')) {
        f.stance = '전체';
        f.topic = '전체';
        f.institution = '전체';
        f.week = '전체';
        f.group = '전체';
        f.kind = '전체';
      }
      const kind = (x) =>
        x.case_study ? '투자 연결 사례' : x.insight ? '기관 리서치' : '발언·메시지';
      const weeks = [...new Set(data.items.map((x) => weekID(x.source_date)))].sort().reverse();
      const items = data.items
        .filter(
          (x) =>
            (!f.stance || f.stance === '전체' || x.stance === f.stance) &&
            (!f.topic || f.topic === '전체' || x.topic === f.topic) &&
            (!f.institution || f.institution === '전체' || x.institution === f.institution) &&
            (!f.week || f.week === '전체' || weekID(x.source_date) === f.week) &&
            (!f.group || f.group === '전체' || investorGroupLabel(x.investor_group) === f.group) &&
            (!f.kind || f.kind === '전체' || kind(x) === f.kind)
        )
        .sort((a, b) => b.source_date.localeCompare(a.source_date) || a.id.localeCompare(b.id));
      const weeklies = data.weeklies
        .filter((w) => w.threads.length)
        .sort((a, b) => b.id.localeCompare(a.id))
        .slice(0, 1);
      let html = title(
        'finance',
        data,
        '기관의 발언·리서치를 공개 투자 행동과 수급, 기업 실적·가격에 연결해 검토합니다.'
      );
      html += `<div class="filters">${select('kind', '자료 종류', ['전체', '투자 연결 사례', '기관 리서치', '발언·메시지'], f.kind)}${select('group', '투자자 유형', ['전체', ...config.finance.coverage_groups.map((g) => g.label), '명단 밖·기타'], f.group)}${select('stance', '입장', ['전체', '낙관', '경계', '중립'], f.stance)}${select('topic', '쟁점', ['전체', ...config.finance.topics], f.topic)}${select('institution', '기관', ['전체', ...new Set(data.items.map((x) => x.institution))], f.institution)}${select('week', '주차', ['전체', ...weeks], f.week)}</div><div class="grid"><div>`;
      html += `<section class="finance-timeline"><h2>금융권 시각 · 최신순</h2><p class="note">원문 날짜가 최근인 자료부터 표시합니다. 사례 검토일은 정렬에 사용하지 않습니다.${items.length ? ` 현재 목록의 최신 원문: ${esc(items[0].source_date)}.` : ''}</p>${items.map((x) => x.case_study ? financeCaseCard(x, data, params.get('id')) : viewCard(x)).join('')}</section>`;
      if (!items.length) html += empty('선택한 조건의 의견이 없습니다');
      if (weeklies.length)
        html += `<section class="panel"><p class="eyebrow">LATEST WEEKLY</p><h3>${anchor('weekly', weeklies[0].id, '최신 주간 금융권 흐름')}</h3>${weeklies[0].threads.map((x) => `<p>${esc(x.summary)}</p>`).join('')}</section>`;
      html +=
        '</div><aside><section class="panel"><h3>주요 취재 대상</h3><p class="note">아래는 취재 범위입니다. 확인한 메시지만 본문에 실으며, 자료가 없는 투자자의 발언을 채워 넣지 않습니다.</p>' +
        config.finance.coverage_groups
          .map(
            (g) =>
              `<details><summary>${esc(g.label)} · 반영 ${data.items.filter((x) => x.investor_group === g.id).length}건</summary><p class="note">${esc(g.focus)}</p><p class="note">${esc(g.institutions.join(' · '))}</p><p class="note">${esc(g.people.join(' · '))}</p></details>`
          )
          .join('') +
        '</section><section class="panel"><h3>주별 낙관·경계 비율</h3>';
      for (const week of weeks) {
        const xs = items.filter((x) => weekID(x.source_date) === week),
          a = xs.filter((x) => x.stance === '낙관').length,
          b = xs.filter((x) => x.stance === '경계').length;
        if (!xs.length) continue;
        html += `<p class="ratio-label">${esc(week)}</p><div class="ratio" aria-label="낙관 ${a}건, 경계 ${b}건"><i class="optimistic" style="width:${a + b ? (a / (a + b)) * 100 : 0}%"></i><i class="cautious" style="width:${a + b ? (b / (a + b)) * 100 : 0}%"></i></div><p class="ratio-label">낙관 ${a} · 경계 ${b} · 중립 ${xs.length - a - b}</p>`;
      }
      const institutions = {};
      items.forEach((x) => (institutions[x.institution] = (institutions[x.institution] || 0) + 1));
      return (
        html +
        '</section><section class="panel"><h3>자주 나온 기관</h3>' +
        Object.entries(institutions)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([name, n]) => `<p class="note">${esc(name)} <strong>${n}건</strong></p>`)
          .join('') +
        '</section></aside></div>'
      );
    }
    function renderSources(data) {
      const scheduleState = (x) =>
        ({ ACTIVE: '과거 활성 관측', PAUSED: '중지', UNVERIFIED: '설정 미확인' })[x] || '확인 필요';
      let html = title(
        'sources',
        data,
        '무엇을 보고, 어떻게 만들며, 지금 어디까지 갱신됐는지 공개합니다.'
      );
      html += `<section class="panel"><h2>운영 방식</h2><div class="two-cols"><div><p>일간: 평일 09:00 KST<br>주간: 월요일 09:40 KST<br>월간: 1일 10:00 KST</p><p class="note">${esc(config.existing_schedules?.policy || '자동 갱신은 중지 상태입니다.')} 마지막 기록(${esc(config.existing_schedules?.checked_on || '기준일 미확인')}): 일간 ${scheduleState(config.existing_schedules?.daily?.status)} · 주간 ${scheduleState(config.existing_schedules?.weekly?.status)}. ${esc(config.existing_schedules?.weekly?.note || '')} 위 시간은 과거 운영 계획이며 현재 실행 예약이 아닙니다.</p></div><div><p>수집 → 편집·작성 → 독립 검증 → 형식 검사 → 게시</p><p class="note">수치·날짜·발언자·고유명사를 원문과 대조합니다. 추정·전망·전언은 구분하고 미확인은 확인 필요로 표시합니다. 정정은 원래 항목 ID와 사유를 보존합니다.</p></div></div></section>`;
      html += '<section class="panel"><h2>최근 실행 10건</h2>';
      html += data.runs.length
        ? `<div class="table-scroll"><table><thead><tr><th>시각</th><th>유형</th><th>상태</th><th>건수</th><th>0건 영역</th><th>메모</th></tr></thead><tbody>${data.runs
            .map(
              (r) =>
                `<tr class="${r.status === 'success' ? '' : 'problem'}"><td>${esc(r.at)}</td><td>${esc(r.type)}</td><td>${r.status === 'success' ? '정상' : r.status === 'failed' ? '실패' : r.status === 'partial' ? '일부 미완료' : '보류'}</td><td>${
                  Object.entries(r.counts)
                    .map(([k, n]) => `${esc(k)} ${n}`)
                    .join('<br>') || '0'
                }</td><td>${
                  list(r.zero_areas)
                    .map(
                      (z) =>
                        `${esc(z.area)}<br><small>${esc(z.reason)} · 검색 ${esc(z.queries.join(' / '))}</small>`
                    )
                    .join('<br>') || '—'
                }</td><td>${list(r.notes).map(esc).join('<br>')}</td></tr>`
            )
            .join('')}</tbody></table></div>`
        : '<p class="quiet">새 파이프라인의 실행 기록이 없습니다. 기존 회차의 생성 시각은 아래 갱신 현황에 표시합니다.</p>';
      html +=
        '</section><section class="panel"><h2>탭별 마지막 갱신</h2><div class="table-scroll"><table><thead><tr><th>탭</th><th>주기</th><th>기준일</th><th>상태</th><th>건수</th></tr></thead><tbody>' +
        config.tabs
          .map((t) => {
            const x = data.tabs[t.id];
            return `<tr class="${x.stale ? 'problem' : ''}"><td>${anchor(t.id, null, t.label)}</td><td>${esc({ daily: '일간', weekly: '주간', monthly: '월간' }[t.period])}</td><td>${esc(x.as_of || '수집 전')}</td><td>${x.stale ? '⚠ 갱신 지연' : x.status === 'empty' ? '초기 수집 대기' : '정상'}</td><td>${fmt(x.count, 0)}</td></tr>`;
          })
          .join('') +
        '</tbody></table></div></section>';
      html +=
        '<section class="panel"><h2>모니터링 소스</h2><p class="note">공통 소스 설정을 수집 계획과 이 목록이 함께 읽습니다. 목록에 등록된 사실은 이번 실행에서 접근·본문을 확인했다는 뜻이 아닙니다.</p>';
      for (const area of new Set(data.sources.map((x) => x.area))) {
        html += `<h3 style="margin-top:22px">${esc(area)}</h3><div class="source-list">${data.sources
          .filter((x) => x.area === area)
          .map(
            (x) =>
              `<div class="source-item">${url(x.url, x.name)}<small>${x.access === 'mixed' ? '일부 유료' : '공개 원천'} · ${x.health?.consecutive_failures >= 3 ? '접근 실패 누적 · 수집 제외' : x.health?.status === 'ok' ? '최근 접근 성공' : '접근 상태 미확인'}</small></div>`
          )
          .join('')}</div>`;
      }
      html +=
        '</section><section class="panel"><h2>탭별 방법론</h2>' +
        config.tabs
          .map(
            (t) =>
              `<div class="method"><strong>${esc(t.label)}</strong><p>${esc(t.method)}<br><span class="note">초기 수집: ${esc(t.initial)}</span></p></div>`
          )
          .join('') +
        '</section>';
      return html;
    }
    const weeklyVerdicts = {
      green: '그린라이트',
      conflict: '추적 관찰',
      insufficient: '근거 부족',
    };
    const watchStates = { monitor: '관찰 중', idea: '아이디어 후보', retired: '폐기' };
    const watchOutcomes = {
      opened: '신규 등록',
      strengthened: '가설 강화',
      weakened: '가설 약화',
      unchanged: '변화 없음',
      unresolved: '판단 보류',
      invalidated: '반증 확인',
      not_checked: '미점검',
    };
    function weeklyNavigation(data, selected) {
      const items = data.items.slice().sort((a, b) => b.id.localeCompare(a.id));
      return `<nav class="weekly-navigation" aria-label="주간 회차 이동"><label for="weekly-edition">지난 회차 <select id="weekly-edition" data-weekly-edition aria-label="주간 회차 선택">${!selected ? '<option value="">회차 선택</option>' : ''}${items.map((w) => `<option value="${esc(w.id)}" ${w.id === selected ? 'selected' : ''}>${esc(w.id)} · ${esc(w.source_date)}</option>`).join('')}</select></label>${selected ? `<a class="weekly-permalink" href="${esc(href('weekly', selected))}">이 주차 고유 주소 ↗</a>` : ''}<span class="note">${items.length}개 회차 · 한 주씩 읽기</span></nav>`;
    }
    function renderWeekly(data, params, w) {
      const header = title(
        'weekly',
        w ? { meta: { as_of: w.source_date, count: 1, generated_at: w.generated_at } } : data,
        '여러 근거를 연결하고, 지난주의 가설을 다시 확인합니다.'
      );
      if (!data.items.length) return header + empty('아직 주간 시사점이 없습니다');
      if (!w)
        return (
          header +
          weeklyNavigation(data, null) +
          empty(
            '해당 주간 회차를 찾을 수 없습니다',
            '주소를 확인하거나 회차 선택에서 보관된 주간 시사점을 열어 주세요.'
          )
        );
      const s = w.synthesis,
        signals = list(s?.signals),
        watchlist = list(s?.watchlist);
      const green = signals.filter((x) => x.verdict === 'green').length,
        conflicts = signals.filter((x) => x.verdict === 'conflict').length;
      const signalHTML = signals
        .map(
          (x) =>
            `<section class="weekly-signal ${esc(x.verdict)}" id="section-signal-${esc(x.id)}"><div class="meta"><span class="signal-light ${esc(x.verdict)}">${esc(weeklyVerdicts[x.verdict])}</span><span>${x.sources.length}개 근거</span></div><h3>${esc(x.title)}</h3><p class="weekly-hypothesis">${esc(x.hypothesis)}</p><p>${esc(x.reasoning)}</p><div class="weekly-evidence">${x.sources.map((r) => `<div class="weekly-evidence-row"><div class="meta"><span class="tag">${esc(config.tabs.find((t) => t.id === r.tab)?.label || r.tab)}</span><span>${esc({ supports: '뒷받침', contradicts: '충돌', context: '참고' }[r.relation])}</span></div><p>${esc(r.claim)}</p><p class="source">${esc(r.source_name)} · ${esc(r.source_date)} · ${url(r.source_url)} · ${anchor(r.tab, ['gpu', 'memory'].includes(r.tab) ? null : r.record_id, ['gpu', 'memory'].includes(r.tab) ? '탭 전체 보기' : '탭에서 확인')}</p></div>`).join('')}</div><div class="impact investment"><strong>아이디어에 주는 의미</strong><p>${esc(x.investment_implication)}</p></div><p class="note">해석의 한계 · ${esc(x.limitations)}</p>${x.independence_note ? `<p class="note">근거 독립성 · ${esc(x.independence_note)}</p>` : ''}</section>`
        )
        .join('');
      const watchHTML = watchlist
        .map(
          (x) =>
            `<article class="weekly-watch" id="section-watch-${esc(x.id)}"><div class="meta"><span class="tag ${x.status === 'retired' ? 'negative' : x.status === 'idea' ? 'positive' : 'pending'}">${esc(watchStates[x.status])}</span><span>${esc(watchOutcomes[x.outcome])}</span><span>${x.next_review_week ? '다음 점검 ' + esc(x.next_review_week) : '추적 종료'}</span></div><h3>${esc(x.title)}</h3><p>${esc(x.hypothesis)}</p><p class="watch-result">${esc(x.rationale)}</p><dl class="watch-conditions"><div><dt>가설을 지지할 조건</dt><dd>${esc(x.confirm_if)}</dd></div><div><dt>가설을 폐기할 조건</dt><dd>${esc(x.invalidate_if)}</dd></div></dl><p class="source">${x.signal_ids.length ? x.signal_ids.map((id) => `<a href="${esc(href('weekly', w.id, { section: 'signal-' + id }))}">${esc(signals.find((s) => s.id === id)?.title || id)}</a>`).join(' · ') : '새 근거 미확보 · 판단 변경 없음'}</p><details class="watch-history"><summary>주차별 점검 이력 (${list(w.watch_history?.[x.id]).length})</summary><ol>${list(
              w.watch_history?.[x.id]
            )
              .map(
                (h) =>
                  `<li><a href="${esc(href('weekly', h.week, { section: 'watch-' + x.id }))}">${esc(h.week)}</a> · ${esc(watchOutcomes[h.outcome])}<p>${esc(h.rationale)}</p></li>`
              )
              .join('')}</ol></details></article>`
        )
        .join('');
      return (
        header +
        weeklyNavigation(data, w.id) +
        `<article class="weekly-edition" data-item="${esc(w.id)}" tabindex="-1"><header class="weekly-cover"><p class="eyebrow">WEEKLY RESEARCH LETTER / ${esc(w.id)}</p><h2>${esc(w.title)}</h2><p class="weekly-deck">${esc(w.body)}</p><p class="note">${s ? `관측 기간 ${esc(s.period.start)} ~ ${esc(s.period.end)}` : '기존 사업 브리핑 · 당시 작성 내용 보존'} · 발행 기준 ${esc(w.source_date)}</p>${w.correction_note ? `<p class="note">정정 · ${esc(w.correction_note)}</p>` : ''}</header><div class="weekly-scoreboard"><div><b>${s ? green : '—'}</b><span>그린라이트</span></div><div><b>${s ? conflicts : '—'}</b><span>추적 관찰</span></div><div><b>${s ? watchlist.filter((x) => x.status !== 'retired').length : '—'}</b><span>다음 주 워치</span></div></div><p class="note weekly-disclaimer">그린라이트는 근거가 서로 뒷받침한다는 뜻입니다. 매수 신호나 수익 보장은 아닙니다.</p><section class="weekly-section"><p class="eyebrow">01 / CROSS-SOURCE CHECK</p><h2>근거가 만나는 곳, 엇갈리는 곳</h2>${s ? `<p class="note">${esc(s.coverage_note)}</p>` : ''}${signalHTML || `<p class="quiet">${s ? '이번 주에는 판정할 만큼의 근거가 없습니다.' : '이 회차에는 소스 간 교차 검토가 기록되지 않았습니다. 기존 글에 그린라이트를 소급해 붙이지 않습니다.'}</p>`}</section>${list(w.threads).length ? `<section class="weekly-section"><h2>${w.legacy ? '당시 주간 흐름' : '이번 주의 흐름'}</h2>${w.threads.map((t) => `<section class="weekly-thread"><h3>${esc(t.title)}</h3><p>${esc(t.summary)}</p><p class="note">${esc(t.so_what)}</p></section>`).join('')}</section>` : ''}<section class="weekly-section"><p class="eyebrow">02 / WATCHLIST</p><h2>다음 주에 다시 확인할 가설</h2><p class="subtitle">같은 항목을 이어서 확인하고, 강화·약화·보류·폐기의 근거를 남깁니다.</p>${watchHTML || '<p class="quiet">주차별로 점검된 투자 가설은 아직 없습니다.</p>'}${list(w.watch).length ? `<details class="legacy-watch" ${s ? '' : 'open'}><summary>당시 관전 포인트 (${w.watch.length}) · 점검 이력 미등록</summary>${w.watch.map((x) => `<p><span class="note">${esc(x.date)}</span><br>${esc(x.text)}</p>`).join('')}</details>` : ''}</section>${list(w.closed_watchlist).length ? `<details class="legacy-watch"><summary>이전에 폐기한 가설 (${w.closed_watchlist.length})</summary>${w.closed_watchlist.map((x) => `<p>${anchor('weekly', x.last_review_week, x.title)} · ${esc(x.rationale)}</p>`).join('')}</details>` : ''}</article>`
      );
    }
    const guestLabel = (x) => (Array.isArray(x.guests) ? x.guests.join(' · ') : x.guests || '');
    function interviewFeature(x, index) {
      const f = x.feature;
      return `<article class="interview-feature ${index === 0 ? 'feature-lead' : ''}" data-featured-id="${esc(x.id)}" aria-labelledby="feature-${esc(x.id)}"><div class="feature-kicker"><span>FEATURED ${String(index + 1).padStart(2, '0')}</span>${badge(f.person_type)}<span>원문 ${esc(x.source_date)}</span></div><p class="feature-person">${esc(guestLabel(x) || f.person_context)}</p><h2 id="feature-${esc(x.id)}">${esc(f.headline)}</h2><p class="feature-context">${esc(f.person_context)}</p><p class="feature-why"><b>주목한 이유</b> ${esc(f.why_featured)}</p><div class="feature-takeaways">${f.takeaways.map((p, i) => `<section class="feature-takeaway"><p class="eyebrow">핵심 ${String(i + 1).padStart(2, '0')} · 발언 요지</p><h3>${esc(p.claim)}</h3><dl><dt>투자에 주는 의미 · 편집 해석</dt><dd>${esc(p.investment_meaning)}</dd><dt>확인할 변수</dt><dd>${esc(p.watch)}</dd></dl></section>`).join('')}</div><div class="feature-caveat"><strong>반대 조건·이해관계</strong><p>${esc(f.caveat)}</p></div><p class="feature-basis">선정 검토 ${esc(f.reviewed_on)} · ${esc(f.basis)}</p><div class="feature-links">${anchor('interviews', x.id, '전체 해설 읽기 →')}${url(x.source_url, '인터뷰 원문 ↗')}</div></article>`;
    }
    function interviewEntry(x, selected) {
      return `<details class="interview-entry" ${selected ? 'open' : ''}><summary><span class="meta">${esc(x.podcast)} · 원문 ${esc(x.source_date)}${x.feature ? ' · FEATURED' : ''}</span><span class="interview-entry-title">${esc(x.headline || x.title)}</span><span class="note">${esc(guestLabel(x))}</span></summary><article class="story" data-item="${esc(x.id)}" tabindex="-1"><h3>${esc(x.headline || x.title)}</h3><p>${esc(x.overview || x.summary)}</p>${x.basis ? `<p class="note">근거 범위: ${esc(x.basis)}</p>` : ''}${list(
        x.points
      )
        .map(
          (p) =>
            `<details class="details-text"><summary>${esc(p.heading)}</summary><p>${esc(p.body)}</p>${p.analysis ? `<p><b>(해석)</b> ${esc(p.analysis)}</p>` : ''}${p.counterpoint ? `<p class="note">반대 조건: ${esc(p.counterpoint)}</p>` : ''}</details>`
        )
        .join(
          ''
        )}${source(x)}<p class="note">${esc(Array.isArray(x.caveats) ? x.caveats.join(' ') : x.caveats)}</p>${anchor('interviews', x.id, '이 인터뷰 주소 →')}</article></details>`;
    }
    function renderInterviews(data, params) {
      let html = title(
        'interviews',
        data,
        '경영진부터 투자 구루·테크 전문 투자자까지, 투자 가정을 바꿀 대담을 읽습니다.'
      );
      if (!data.items.length) return html + empty('아직 리더 인터뷰가 없습니다');
      const featured = data.items
        .filter((x) => x.feature)
        .sort((a, b) => a.feature.rank - b.feature.rank)
        .slice(0, config.interviews.featured_limit);
      if (featured.length)
        html += `<section class="interview-spotlight" aria-labelledby="featured-interviews-title"><header class="interview-section-head"><p class="eyebrow">THE CONVERSATIONS THAT MATTER</p><h2 id="featured-interviews-title">이번에 주목할 대담</h2><p>인물의 주목도와 발언이 바꿀 투자 변수를 함께 봅니다. 원문 발행일과 선정 검토일을 구분합니다.</p></header><div class="interview-feature-grid">${featured.map(interviewFeature).join('')}</div></section>`;
      else
        html +=
          '<p class="notice">현재 featured로 선정한 대담은 없습니다. 원문 근거와 투자에 주는 의미를 확인한 인터뷰부터 선정합니다.</p>';
      const search = filters.interviews?.search || '',
        target = params.get('id');
      const items = data.items
        .filter(
          (x) =>
            target ||
            !search ||
            [x.title, x.headline, guestLabel(x), x.podcast, x.summary, x.overview]
              .filter(Boolean)
              .join(' ')
              .toLowerCase()
              .includes(search.toLowerCase())
        )
        .sort((a, b) => b.source_date.localeCompare(a.source_date) || a.id.localeCompare(b.id));
      html += `<section class="interview-library" aria-labelledby="interview-library-title"><header class="interview-section-head"><h2 id="interview-library-title">전체 인터뷰</h2><p>선정에서 빠져도 기존 본문과 원문 날짜를 보존합니다. 제목을 눌러 전체 해설을 읽으실 수 있습니다.</p><label class="interview-search">인터뷰 검색 <input type="search" data-search="interviews" value="${esc(search)}" placeholder="인물·방송·주제 검색" aria-label="인터뷰 검색"></label><p class="note">${items.length} / ${data.items.length}편 · 원문 최신순</p></header>${items.length ? items.map((x) => interviewEntry(x, x.id === target)).join('') : empty('검색 조건에 맞는 인터뷰가 없습니다')}</section>`;
      return html;
    }
    function legacyTools() {
      return `<section class="panel" id="section-legacy-tools"><p class="eyebrow">이전 브리핑</p><h2>보존된 상세 화면</h2><p>기존 시사점과 GPU 카탈로그, 편집 비교 기록을 열 수 있습니다.</p><nav class="signal-company-links"><a href="legacy.html#insights">전략 시사점 →</a><a href="legacy.html#gpu">GPU 과거 카탈로그 →</a><a href="legacy.html#compare-edit">편집 비교 기록 →</a></nav></section>`;
    }
    function renderArchive(data) {
      const f = (filters.archive ||= {}),
        q = f.search?.toLowerCase() || '',
        items = data.items.filter(
          (x) =>
            (!f.kind || f.kind === '전체' || x.collection === f.kind) &&
            (!q || (x.title || x.oneliner || '').toLowerCase().includes(q))
        );
      return (
        title('archive', data, '기존 회차와 새로운 누적 자료, 정정 이력을 함께 찾습니다.') +
        `<div class="filters">${select('kind', '종류', ['전체', ...new Set(data.items.map((x) => x.collection))], f.kind)}<input type="search" data-search="archive" aria-label="아카이브 검색" placeholder="제목 검색" value="${esc(f.search || '')}"></div><section class="panel"><div class="table-scroll"><table><thead><tr><th>날짜</th><th>종류</th><th>제목</th></tr></thead><tbody>${items.map((x) => `<tr data-item="${esc(x.id)}" tabindex="-1"><td>${esc(x.source_date || x.date)}</td><td>${esc(x.collection)}</td><td>${anchor({ articles: 'news', editions: 'news', weeklies: 'weekly', reports: 'reports', corrections: 'archive' }[x.collection] || 'archive', x.collection === 'editions' ? x.article_ids?.[0] : x.id, x.title || x.oneliner || x.id)}</td></tr>`).join('')}</tbody></table></div>${items.length ? '' : '<p class="quiet">조건에 맞는 기록이 없습니다.</p>'}</section>` +
        legacyTools()
      );
    }
    function renderAIState(data, params) {
      const f = filters['ai-state'] || {},
        target = data.items.find((x) => x.id === params.get('id'));
      if (target) {
        f.signal = '전체';
        f.domain = '전체';
      }
      const items = data.items
        .filter(
          (x) =>
            target ||
            ((!f.signal || f.signal === '전체' || x.signal === f.signal) &&
              (!f.domain || f.domain === '전체' || x.domain === f.domain))
        )
        .sort((a, b) => b.event_date.localeCompare(a.event_date));
      const reviewed = data.items
        .map((x) => x.reviewed_on)
        .sort()
        .at(-1);
      let html = title(
        'ai-state',
        data,
        'AI가 새로 해낸 일과 아직 넘지 못한 한계를, 같은 질문으로 추적합니다.'
      );
      html += `<section class="panel ai-intro"><p class="eyebrow">CAPABILITIES & LIMITS</p><h2>무엇을 해냈고, 어디까지 믿을 수 있나요?</h2><p>수학·과학·게임·실제 업무의 진전, 실패와 반론을 함께 기록합니다. 각 사례에서 성과와 조건을 확인하고, 의미는 편집 해석으로 구분합니다.</p><p class="note">대표 이정표를 골라 구성한 초기 검토입니다. 최신 소식의 전수 목록이 아닙니다. 사건일은 당시 날짜로 보존하며, 원문을 다시 검토한 날짜는 ${esc(reviewed || '아직 없음')}입니다. 예약 수집은 중지 상태입니다.</p></section>`;
      const featured = data.items
        .filter((x) => x.featured_rank)
        .sort((a, b) => a.featured_rank - b.featured_rank);
      if (featured.length)
        html += `<section class="panel ai-reading"><p class="eyebrow">EDITOR'S READING</p><h2>이번 검토에서 읽을 세 가지 변화</h2><div class="ai-reading-grid">${featured.map((x) => `<div><h3>${anchor('ai-state', x.id, x.title)}</h3><p>${esc(x.significance)}</p></div>`).join('')}</div><p class="note">대표 사례를 연결한 편집 해석입니다. AI 전체의 능력을 점수화한 결과는 아닙니다.</p></section>`;
      html += `<div class="filters">${select('signal', '신호', ['전체', '진전', '한계·위험', '재검토'], target ? '전체' : f.signal)}${select('domain', '분야', ['전체', ...new Set(data.items.map((x) => x.domain))], target ? '전체' : f.domain)}<span class="note">${items.length} / ${data.items.length}건 · 사건일 최신순</span></div>`;
      html += items.length
        ? '<div class="ai-cases">' +
          items
            .map(
              (x) =>
                `<article class="story ai-case" tabindex="-1" data-item="${esc(x.id)}"><div class="meta">${badge(x.signal)}${badge(x.domain)}${badge(x.evidence_level)}<span>사건 ${esc(x.event_date)}</span></div><h2>${esc(x.title)}</h2><p>${esc(x.summary)}</p><div class="ai-finding"><strong>확인된 성과·관측</strong><p>${esc(x.achievement)}</p></div><div class="impact"><strong>왜 중요한가 · 편집 해석</strong>${esc(x.significance)}</div><details class="ai-detail"><summary>조건·한계와 다음 확인</summary><dl><dt>실험 조건과 비교 기준</dt><dd>${esc(x.conditions)}</dd><dt>사람의 역할</dt><dd>${esc(x.human_role)}</dd><dt>한계·반론</dt><dd>${esc(x.limitation)}</dd><dt>다음에 확인할 것</dt><dd>${esc(x.next_check)}</dd></dl></details><div class="ai-references">${x.references.map((r) => `<p>${badge(r.role)} ${url(r.url, r.label)} <span class="note">${esc(r.date)}</span></p>`).join('')}</div><p class="note">원문 ${esc(x.source_date)} · 검토 ${esc(x.reviewed_on)}</p>${anchor('ai-state', x.id, '이 사례 주소 →')}</article>`
            )
            .join('') +
          '</div>'
        : empty('조건에 맞는 사례가 없습니다');
      html += `<details class="panel ai-source-guide"><summary>추적 소스 ${list(data.sources).length}곳 · 선정 이유와 주의점</summary><p>발견 경로 → 연구 원문 → 외부 평가·후속 반론 순서로 확인합니다. 커뮤니티 추천 수와 연구소의 자체 점수를 검증 완료로 취급하지 않습니다.</p><div class="source-list">${list(
        data.sources
      )
        .map(
          (x) =>
            `<div class="source-item">${badge(x.source_role)} ${url(x.url, x.name)}<p>${esc(x.rationale)}</p><small>${esc(x.caution)}</small></div>`
        )
        .join('')}</div></details>`;
      return html;
    }
    function renderGeneric(tab, data) {
      const t = config.tabs.find((x) => x.id === tab);
      return (
        title(tab, data, t.method) +
        (data.items.length
          ? data.items
              .map(
                (x) =>
                  `<article class="story" tabindex="-1" data-item="${esc(x.id)}">${tab === 'events' && x.date ? `<p class="meta">예정 ${esc(x.date)}</p>` : ''}<h2>${esc(x.title)}</h2><p>${esc(x.body || x.summary)}</p>${source(x)}</article>`
              )
              .join('')
          : empty('아직 수집된 자료가 없습니다', t.initial))
      );
    }
    return {
      renderers: {
        'ai-state': renderAIState,
        summary: renderSummary,
        news: renderNews,
        finance: renderFinance,
        sources: renderSources,
        weekly: renderWeekly,
        interviews: renderInterviews,
        archive: renderArchive,
      },
      generic: renderGeneric,
      weekly: renderWeekly,
    };
  }
  return { create };
});
