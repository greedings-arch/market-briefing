/* global InvestorCore */
(function () {
  'use strict';
  if(document.querySelector('[data-investor-redirect]')){location.replace('./'+(location.hash||'#desk'));return;}
  const C = InvestorCore, R = window.ResearchSignals;
  const $ = s => document.querySelector(s);
  const escape = s => String(s ?? '').replace(/[&<>"']/g, x => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
  const num = (n, digits = 2) => Number.isFinite(n) ? n.toLocaleString('ko-KR',{maximumFractionDigits:digits}) : '—';
  const money = (n,c) => (c.currency === 'KRW' ? '₩' : '$') + num(n,c.currency === 'KRW' ? 0 : 2);
  const pct = n => (n > 0 ? '+' : '') + num(n * 100,1) + '%';
  const states = {supported:'근거 지지',mixed:'상충·점검',unverified:'추가 검증'};
  let data, sources, library = {}, current = {view:"desk",id:"sem"}, activeFilter = 'all';
  const drafts = new Map();
  const badge = s => `<span class="badge ${escape(s)}">${states[s] || escape(s)}</span>`;
  const href = (view,id) => `#${view}${id ? '?id='+encodeURIComponent(id) : ''}`;
  function refs(ids) {
    return `<span class="citations">${[...new Set(ids)].map(id => {const s=sources.get(id);return `<a href="${escape(s.url)}" target="_blank" rel="noopener noreferrer" title="${escape(s.title)}">${escape(s.title.split(' · ')[0])} ↗ <span>${escape(s.date)}</span></a>`;}).join('')}</span>`;
  }
  function route() { return current; }
  function heading(kicker,title,detail='') {return `<div class="page-heading"><p class="eyebrow">${kicker}</p><h1>${title}</h1>${detail ? `<p class="lede">${detail}</p>` : ''}</div>`;}
  function companyPicker(selected,view) {
    return `<div class="company-picker" aria-label="기업 선택">${data.companies.map(c=>`<a href="${href(view,c.id)}" ${c.id===selected?'aria-current="page"':''}>${escape(c.name)}</a>`).join('')}</div>`;
  }
  function tableRows() {
    const cs = data.companies.filter(c=>activeFilter==='all'||c.market===activeFilter||activeFilter==='mixed'&&c.status==='mixed');
    return cs.map(c=>`<tr><th scope="row"><a class="company-link" href="${href('company',c.id)}">${escape(c.name)} <span>↗</span></a><small>${escape(c.ticker)} · ${escape(c.role)}</small></th><td class="numeric">${money(c.quote.value,c)}<small>${escape(c.quote.date)} · ${c.market==='KR'?'KRX':'NASDAQ'}</small></td><td><small>실적 검토 기준</small>${badge(c.status)}<small class="watch-research-status">자료 반영 · ${escape(R?.company(c.id,library)?.label||'자료 대조 전')}</small></td><td><a class="price-review" href="${href('valuation',c.id)}">가격 역산 →</a><small>정상화 이익 검증 전</small></td><td class="table-question">${escape(c.next_check)}</td></tr>`).join('');
  }
  function desk() {
    const coverage = data.companies.filter(c=>c.metrics.length).length;
    return heading('THE TWO QUESTIONS','AI 투자는 이어지는가.<br><span>지금 가격은 매력적인가.</span>') +
      `<section class="desk-lead"><div><div class="section-tag"><span class="live-dot"></span> 이번 검토의 판단 <span>· ${escape(data.as_of)}</span></div><h2>${escape(R?.summary(library).headline||data.summary)}</h2><p>${escape(R?.summary(library).body||data.summary_detail)}</p><details class="prior-thesis"><summary>직전 실적 검토의 기준선</summary><p>${escape(data.summary)}</p><p>${escape(data.summary_detail)}</p></details><p class="desk-research-readout">메모리 계약가 전망·NAND 현물·GPU 임대가격·텔레그램을 아래에서 대조합니다. 지지와 반대 근거가 기업별 판단에 함께 반영됩니다.</p><a class="text-link" href="#company?id=sem">삼성전기부터 검토하기 <span>↗</span></a></div><aside class="lead-aside"><span class="eyebrow">COVERAGE / READINESS</span><div><strong>${data.companies.length}<small>개사</small></strong><span>워치리스트</span></div><div><strong>${coverage}<small>개사</small></strong><span>실적 수치 확인</span></div><p>정상화 이익·컨센서스 미확보<br><b>적정가격 판정은 보류</b></p></aside></section>
      ${R?.overview(library)||''}
      <section class="section"><div class="section-head"><div><p class="eyebrow">02 / WATCHLIST</p><h2>같은 사이클, 다른 이익 구조</h2></div><div class="filters" aria-label="워치리스트 필터">${[['all','전체'],['KR','국내 3개사'],['US','미국 7개사'],['mixed','상충·점검']].map(([id,label])=>`<button type="button" data-investor-filter="${id}" aria-pressed="${activeFilter===id}">${label}</button>`).join('')}</div></div><div class="table-scroll" tabindex="0" aria-label="기업 비교표 가로 스크롤"><table class="watch-table"><thead><tr><th>기업 / 사이클의 연결점</th><th class="numeric">확인한 가격</th><th>사업 가설</th><th>가격 검증</th><th>다음에 확인할 것</th></tr></thead><tbody id="watch-rows">${tableRows()}</tbody></table></div></section>
      <section class="cash-section"><div><p class="eyebrow">03 / FOLLOW THE CASH</p><h2>매출 성장 다음에는<br>투자 회수를 봅니다.</h2><p>회사 공표 FCF입니다. 기간과 리스 처리 기준이 달라 합산하거나 순위를 매기지 않습니다.</p></div><div class="cash-grid">${data.cashflows.map(x=>{const c=data.companies.find(c=>c.id===x.company);return `<article><span>${escape(c.name)}</span><strong class="${x.value>=0?'up':'down'}">${x.value>0?'+':''}${num(x.value,3)}<small>십억 USD</small></strong><p>${escape(x.period)}</p><small>${escape(x.basis)}</small>${refs([x.source])}</article>`;}).join('')}</div></section>`;
  }
  function company(c) {
    return heading('COMPANY UNDERWRITING',escape(c.name),escape(c.role)+' · '+escape(c.ticker)) + companyPicker(c.id,'company')+(R?.companyHTML(c.id,library)||'')+
      `<section class="company-hero"><div>${badge(c.status)}<h2>${escape(c.thesis)}</h2><p>${escape(c.counter)}</p></div><aside><span class="eyebrow">OBSERVED PRICE</span><strong>${money(c.quote.value,c)}</strong><small>${escape(c.quote.date)} · ${escape(c.quote.time)}<br>${escape(c.quote.session)}</small>${refs([c.quote.source])}<a class="button dark" href="${href('valuation',c.id)}">이 가격의 기대를 역산 →</a></aside></section>
      <div class="transmission" aria-label="사업 영향 경로">${c.transmission.map((s,i)=>`<div><span>0${i+1}</span>${escape(s)}</div>`).join('')}</div>
      <div class="metric-grid">${c.metrics.map(m=>`<article><span>${escape(m.label)}</span><strong>${num(m.value,4)}<small>${escape(m.unit)}</small></strong><p>${escape(m.period)}</p>${refs([m.source])}</article>`).join('')||'<div class="empty">최신 실적 수치 대조가 완료되지 않았습니다. 수치는 채워 넣지 않았습니다.</div>'}</div>
      <section class="section two-col"><div><p class="eyebrow">EVIDENCE & COUNTERCASE</p><h2>무엇이 가설을 지지하고,<br>어디에서 깨질 수 있습니까?</h2>${c.evidence.map(e=>`<article class="evidence-card ${e.relation}"><span class="evidence-kind">${{supports:'지지 근거',challenges:'반대 조건·한계',context:'배경'}[e.relation]}</span><p>${escape(e.text)}</p>${refs(e.sources)}</article>`).join('')||'<p class="empty">이번 검토에서 AI 투자 가설을 확정할 원문 근거가 부족합니다.</p>'}</div><div><p class="eyebrow">VALUATION READINESS</p><h2>좋은 사업과 좋은 가격을<br>구분합니다.</h2><div class="readiness"><span class="badge unverified">가격 판단 보류</span><p>${escape(c.price_caveat)}</p><h3>판단에 필요한 자료</h3><ul>${c.gaps.map(g=>`<li>${escape(g)}</li>`).join('')}</ul><a class="text-link" href="${href('valuation',c.id)}">확인한 가격으로 필요 이익 계산 ↗</a></div></div></section>
      <section class="section"><div class="section-head"><div><p class="eyebrow">FALSIFIABLE THESIS</p><h2>다음 검토에서 확인할 조건</h2></div><span class="small-note">초안 점검 기준 · 사용자가 승인한 매매 규칙 아님</span></div><div class="check-grid">${c.checks.map(p=>`<article><h3>${escape(p.metric)}</h3><dl><dt>가설을 지지할 때</dt><dd>${escape(p.confirm)}</dd><dt>가설을 다시 검토할 때</dt><dd>${escape(p.break)}</dd></dl><p class="small-note">${escape(p.next)}</p></article>`).join('')}</div></section>`;
  }
  function draft(c) {
    if (!drafts.has(c.id)) drafts.set(c.id,{price:c.quote.value,multiple:c.multiple,hurdle:10,eps:'',basis:'미입력'});
    return drafts.get(c.id);
  }
  function valuation(c) {
    const d=draft(c);
    return heading('PRICE → EXPECTATIONS','이 주가를 정당화하려면<br><span>얼마를 벌어야 합니까?</span>','가격을 먼저 놓고 필요한 이익을 역산합니다. 분석 가정은 직접 바꿔보실 수 있습니다.')+companyPicker(c.id,'valuation')+(R?.companyHTML(c.id,library,{compact:true})||'')+
      `<section class="valuation-layout"><div class="assumptions"><div class="section-head"><h2>${escape(c.name)}</h2><button class="plain-button" id="reset-scenario" type="button">초기화 ↺</button></div><p class="small-note">${escape(c.quote.date)} · ${escape(c.quote.session)}${refs([c.quote.source])}</p><form id="scenario-form" novalidate><label for="price">비교할 주가 (${escape(c.currency)})</label><input id="price" name="price" type="number" min="0.01" step="any" value="${escape(d.price)}"><label for="multiple">12개월 후 비교 P/E (배)</label><input id="multiple" name="multiple" type="number" min="0.1" max="1000" step="0.1" value="${escape(d.multiple)}"><p class="field-note">기본 ${c.multiple}배는 계산을 위한 비교 가정입니다. 적정 배수·과거 평균·컨센서스가 아닙니다.</p><label for="hurdle">연간 요구수익률 (%)</label><input id="hurdle" name="hurdle" type="number" min="0" max="100" step="0.5" value="${escape(d.hurdle)}"><p class="field-note">12개월 · 배당·환율·세금·거래비용 제외</p><div class="form-divider"></div><label for="eps">검토할 연간 EPS (${escape(c.currency)}/주)</label><input id="eps" name="eps" type="number" min="0.01" step="any" placeholder="지속 가능하다고 보는 연간 이익" value="${escape(d.eps)}"><p class="field-note">EPS는 주당순이익입니다. 공란이면 적정가나 상승 여력을 계산하지 않습니다.</p>${c.eps?`<button id="load-quarter" class="button light" type="button">분기 EPS ×4로 비교해보기</button><p class="field-note">${escape(c.eps.period)} · 분기 ${money(c.eps.value,c)}<br>${escape(c.eps.basis)}${refs([c.eps.source])}</p>`:''}</form><p class="privacy-note">변경한 가정은 이 페이지에서만 유지됩니다. 원본 데이터는 바뀌지 않습니다.</p></div><div id="valuation-results" aria-live="polite"></div></section><section class="section"><h2>이 회사에서 먼저 풀어야 할 문제</h2><p>${escape(c.price_caveat)}</p><div class="gap-list">${c.gaps.map((g,i)=>`<div><span>0${i+1}</span>${escape(g)}</div>`).join('')}</div><a class="text-link" href="${href('company',c.id)}">사업 가설과 반증 조건 다시 보기 ↗</a></section>`;
  }
  function updateValuation(c) {
    const d=draft(c), input={price:C.number(d.price),multiple:C.number(d.multiple),hurdle:C.number(d.hurdle) === null ? NaN : Number(d.hurdle)/100,years:1};
    const r=C.reverse(input), eps=C.number(d.eps), result=C.scenario({...input,eps});
    const invalid=!r || input.hurdle<0 || input.hurdle>1 || input.multiple>1000;
    if(invalid) {$('#valuation-results').innerHTML='<div class="empty error" role="alert">주가와 배수는 양수, 요구수익률은 0~100%로 입력해 주세요. 배수는 1,000배 이하로 비교합니다.</div>';return;}
    const observed = c.eps?.value > 0 ? c.eps.value*4 : null;
    const grid=C.sensitivity({...input,eps});
    $('#valuation-results').innerHTML=`<article class="reverse-result"><p class="eyebrow">REQUIRED ANNUAL EARNINGS</p><span>12개월 후 ${num(input.multiple,1)}배와 요구수익률 ${num(input.hurdle*100,1)}%를 적용하면</span><strong>${money(r.requiredEPS,c)}<small>/ 주 · 연간 EPS 필요</small></strong><p>현재 입력 가격 ${money(input.price,c)} × (1 + ${num(input.hurdle*100,1)}%) ÷ ${num(input.multiple,1)}배</p><div class="result-note">이익에 대한 <b>조건부 역산</b>입니다. 시장 전체가 이 이익을 예상한다는 뜻은 아닙니다.</div>${observed?`<div class="quarter-context">최근 분기 EPS ×4 = ${money(observed,c)}<br>필요 EPS는 이 기계적 연환산보다 <b>${pct(r.requiredEPS/observed-1)}</b><small>계절성·일회성·사이클을 조정하지 않은 비교입니다. 연간 실적 전망이 아닙니다.</small></div>`:''}</article>
      ${result?`<article class="scenario-output"><p class="eyebrow">YOUR ASSUMPTION / ${escape(d.basis)}</p><h2>입력한 이익이 실현된다면</h2><div class="result-grid"><div><span>12개월 후 계산 가격</span><strong>${money(result.terminalValue,c)}</strong></div><div><span>가격 수익률</span><strong class="${result.totalReturn>=0?'up':'down'}">${pct(result.totalReturn)}</strong></div><div><span>요구수익률로 할인한 가격</span><strong>${money(result.presentValue,c)}</strong></div></div><p class="field-note">연간 EPS ${money(eps,c)} × ${num(input.multiple)}배. 목표주가·매매 추천이 아닌 입력 가정의 계산 결과입니다.</p>${d.basis==='분기 EPS 단순 연환산'?'<p class="assumption-alert">분기 EPS ×4를 사용 중입니다. 이익의 지속성을 확인한 추정치가 아닙니다.</p>':''}</article><section class="sensitivity"><h3>이익과 배수가 함께 달라지면</h3><p class="small-note">입력값의 60~140% · 각 칸은 12개월 가격 수익률 · 시나리오 확률 없음</p><div class="table-scroll" tabindex="0"><table><thead><tr><th>연간 EPS ＼ P/E</th>${grid[0].cells.map(x=>`<th>${num(x.multiple,1)}배</th>`).join('')}</tr></thead><tbody>${grid.map(row=>`<tr><th>${money(row.eps,c)}</th>${row.cells.map(x=>`<td class="${x.totalReturn>=0?'heat-up':'heat-down'}">${pct(x.totalReturn)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section>`:`<div class="empty eps-empty"><span class="empty-icon">↳</span><h3>${d.eps!==''?'양수의 연간 EPS가 필요합니다':'연간 EPS를 입력하면 비교가 완성됩니다'}</h3><p>지속 가능한 이익을 정한 뒤 가격과 비교합니다. 현재 확인한 사실만으로 임의의 적정가격을 만들지 않았습니다.</p></div>`}`;
  }
  function evidence() {
    return heading('EVIDENCE & REVIEW','무엇을 확인했고,<br><span>무엇이 아직 비어 있습니까?</span>')+(R?.overview(library)||'')+
      `<section class="section two-col"><div><h2>이번 버전의 판단 범위</h2><ul class="limitations">${data.limitations.map(s=>`<li>${escape(s)}</li>`).join('')}</ul></div><div><h2>검토 이력</h2>${data.review_log.map(x=>`<article class="review-entry"><time>${escape(x.date)}</time><h3>${escape(x.title)}</h3><p>${escape(x.body)}</p></article>`).join('')}</div></section><section class="section"><div class="section-head"><h2>출처 목록</h2><span class="small-note">${data.sources.length}개 · 사실과 편집 판단을 구분</span></div><div class="source-ledger">${data.sources.map(s=>`<article><span class="source-type">${s.kind==='primary'?'회사·공시':'시장가격'}</span><div><a href="${escape(s.url)}" target="_blank" rel="noopener noreferrer">${escape(s.title)} ↗</a><p>${escape(s.note)}</p></div><time>${escape(s.date)}</time></article>`).join('')}</div></section>`;
  }
  function matchesCompany(record,c) {
    const aliases=library.config?.workspace?.companies.find(x=>x.id===c.id)?.aliases||[c.name];
    const value=[record.company,record.title,record.overview,...(Array.isArray(record.summary)?record.summary:[record.summary])].filter(x=>typeof x==='string').join(' ').toLowerCase();
    return aliases.some(alias=>value.includes(alias.toLowerCase()));
  }
  function researchCard(r,companyID) {
    const target='#reports?'+new URLSearchParams({id:r.id,...(companyID?{company:companyID}:{})});
    return `<article class="research-card"><small>실적·심층 리포트 · ${escape(r.source_date)}</small><h3><a href="${escape(target)}">${escape(r.title)}</a></h3><p>${escape(r.overview)}</p><a href="${escape(target)}">근거와 이익 분석 읽기 →</a></article>`;
  }
  function pillarLinks(i) {
    const links=[
      [['reports','실적·수요 대조'],['ai-state','AI 활용의 진전과 한계']],
      [['reports','투자·현금흐름 분석'],['finance','금융권 반론']],
      [['memory','메모리 업황·점유율'],['company?id=hynix','기업 이익으로 연결']],
      [['gpu','GPU 임대시장'],['indicators','산업 지표']]
    ][i]||[];
    return `<nav class="research-links" aria-label="이 질문의 관련 자료">${links.map(([route,label])=>`<a href="#${escape(route)}">${escape(label)} →</a>`).join('')}</nav>`;
  }
  function researchOverview() {
    const reports=library.reports?.items||[];
    const seen=new Set(),latest=[...reports].sort((a,b)=>b.source_date.localeCompare(a.source_date)||Number(b.id.endsWith('-deep'))-Number(a.id.endsWith('-deep'))).filter(r=>{if(seen.has(r.company))return false;seen.add(r.company);return true;}).slice(0,3);
    return `<section class="section related-research"><div class="section-head"><div><p class="eyebrow">RESEARCH → DECISION</p><h2>축적한 리서치로 가설을 대조합니다</h2></div><a class="text-link" href="#reports">전체 실적 리포트 ${reports.length}편 →</a></div><p class="small-note">각 자료의 작성 당시 근거와 해석입니다. 기업 검증에서 연결해 읽고 현재 가설과의 차이를 확인합니다.</p><div class="research-grid">${latest.map(r=>researchCard(r)).join('')||'<p class="empty">실적 리포트를 불러오지 못했습니다. 리서치 메뉴에서 다시 확인하실 수 있습니다.</p>'}</div><nav class="research-links"><a href="#news">누적 뉴스 →</a><a href="#weekly">주간 논점과 점검 이력 →</a><a href="#interviews">경영진·투자자 인터뷰 →</a><a href="#finance">금융권의 찬반 논거 →</a></nav></section>`;
  }
  function relatedResearch(c) {
    const reports=(library.reports?.items||[]).filter(r=>matchesCompany(r,c)).sort((a,b)=>b.source_date.localeCompare(a.source_date)||Number(b.id.endsWith('-deep'))-Number(a.id.endsWith('-deep')));
    const news=(library.news?.items||[]).filter(r=>matchesCompany(r,c)).sort((a,b)=>b.source_date.localeCompare(a.source_date)).slice(0,4);
    return `<section class="section related-research" data-company-research="${escape(c.id)}"><div class="section-head"><div><p class="eyebrow">CONNECTED RESEARCH</p><h2>${escape(c.name)}의 기존 자료로 검증을 이어갑니다</h2></div><a class="text-link" href="#reports">전체 리포트 →</a></div><p class="small-note">기업명으로 연결한 관련 자료입니다. 단순 언급과 직접 실적 분석을 구분해서 읽어야 하며, 연결 자체가 가설을 지지한다는 뜻은 아닙니다.</p><div class="related-grid">${reports.map(r=>researchCard(r,c.id)).join('')||`<div class="empty">${library.reports?'이 기업과 직접 연결한 실적 리포트가 아직 없습니다.':'실적 리포트를 불러오지 못했습니다.'} 이 공백은 기업 검증 과제로 남깁니다.</div>`}</div>${news.length?`<h3 style="margin-top:28px">관련 뉴스와 당시 해석</h3><div class="related-grid">${news.map(r=>`<article class="research-card"><small>${escape(r.source_date)} · ${r.legacy?'기존 사업 브리핑':'뉴스'}</small><h3><a href="#news?id=${encodeURIComponent(r.id)}&company=${encodeURIComponent(c.id)}">${escape(r.title)}</a></h3><p>${escape((r.summary||[])[0]||'')}</p><a href="#news?id=${encodeURIComponent(r.id)}&company=${encodeURIComponent(c.id)}">기사·출처 확인 →</a></article>`).join('')}</div>`:''}${library.news===null?'<p class="small-note">관련 뉴스 연결을 확인하지 못했습니다. 뉴스 메뉴에서 다시 확인하실 수 있습니다.</p>':''}<nav class="research-links"><a href="#telegram">텔레그램·리서치 →</a><a href="#memory">메모리 가격 →</a><a href="#gpu">GPU 가격 →</a><a href="#weekly">주간 검토 →</a><a href="#company?id=${escape(c.id)}">기업 가설 →</a><a href="#valuation?id=${escape(c.id)}">가격 검토 →</a></nav></section>`;
  }
  function render() {
    const r=route(),c=data.companies.find(c=>c.id===r.id),host=$('#content');
    if(['company','valuation'].includes(r.view)&&!c){host.innerHTML='<div class="empty"><h1>등록되지 않은 기업입니다</h1><a href="#desk">워치리스트로 돌아가기 →</a></div>';return;}
    const stamp=`<p class="snapshot-label">검토 ${escape(data.as_of)} · 주가·실적은 각각 표시된 기준일 · 수동 검토 자료</p>`;
    const stale=C.isStale(data.as_of+'T00:00:00+09:00')?`<p class="snapshot-alert">${escape(data.as_of)}에 검토한 자료입니다. 최신 가격과 가설을 다시 확인해야 합니다.</p>`:'';
    host.innerHTML=stamp+stale+(r.view==='desk'?desk()+researchOverview():r.view==='company'?company(c)+relatedResearch(c):r.view==='valuation'?valuation(c)+relatedResearch(c):evidence());
    if(r.view==='valuation')updateValuation(c);
    document.title=`${c&&r.view==='company'?c.name+' · ':''}${r.view==='valuation'?'가격 검토 · ':''}Market Briefing`;
  }
  window.InvestorDesk={
    views:['desk','company','valuation','evidence'],
    mount(snapshot,route,related){data=C.validate(snapshot);sources=new Map(data.sources.map(s=>[s.id,s]));current=route;library=related;render();},
    reset(){data=null;sources=null;library={};drafts.clear();},
    deactivate(){current={view:null,id:null};}
  };
  document.addEventListener('click',event=>{
    if(!data||!current.view)return;
    const filter=event.target.closest('[data-investor-filter]');
    if(filter&&current.view==='desk'){activeFilter=filter.dataset.investorFilter;render();return;}
    if(event.target.closest('#reset-scenario')){drafts.delete(route().id);render();return;}
    if(event.target.closest('#load-quarter')){const c=data.companies.find(c=>c.id===route().id);if(c?.eps){const d=draft(c);d.eps=c.eps.value*4;d.basis='분기 EPS 단순 연환산';$('#eps').value=d.eps;updateValuation(c);}}
  });
  document.addEventListener('input',event=>{
    if(!data||current.view!=='valuation'||!event.target.closest('#scenario-form'))return;
    const c=data.companies.find(c=>c.id===route().id),d=draft(c);d[event.target.name]=event.target.value;
    if(event.target.name==='eps')d.basis='사용자 입력 가정';updateValuation(c);
  });
  document.addEventListener('submit',event=>{if(event.target.id==='scenario-form')event.preventDefault();});
})();
