(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.InvestorCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const positive = n => typeof n === 'number' && Number.isFinite(n) && n > 0;
  function number(value) {
    if (value === null || value === undefined || String(value).trim() === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  function reverse({price, multiple, hurdle = 0.1, years = 1}) {
    if (!positive(price) || !positive(multiple) || !Number.isFinite(hurdle) || hurdle <= -1 || !positive(years)) return null;
    const terminalPrice = price * Math.pow(1 + hurdle, years);
    const requiredEPS = terminalPrice / multiple;
    return Number.isFinite(requiredEPS) ? {terminalPrice, requiredEPS} : null;
  }
  function scenario({price, eps, multiple, hurdle = 0.1, years = 1}) {
    const r = reverse({price, multiple, hurdle, years});
    if (!r || !positive(eps)) return null;
    const terminalValue = eps * multiple;
    const presentValue = terminalValue / Math.pow(1 + hurdle, years);
    const result = {...r, terminalValue, presentValue, totalReturn:terminalValue / price - 1, annualizedReturn:Math.pow(terminalValue / price, 1 / years) - 1, earningsGap:eps / r.requiredEPS - 1};
    return Object.values(result).every(Number.isFinite) ? result : null;
  }
  function sensitivity(input) {
    if (!scenario(input)) return [];
    return [0.6, 0.8, 1, 1.2, 1.4].map(e => ({eps:input.eps * e, cells:[0.6, 0.8, 1, 1.2, 1.4].map(m => ({multiple:input.multiple * m, ...scenario({...input, eps:input.eps * e, multiple:input.multiple * m})}))}));
  }
  function isStale(asOf, now = new Date(), days = 4) {
    const t = Date.parse(asOf);
    return !Number.isFinite(t) || now.getTime() - t > days * 86400000;
  }
  function validate(data) {
    const require = (ok, msg) => { if (!ok) throw new Error(msg); };
    const keys = (obj, allowed) => require(obj && typeof obj === 'object' && Object.keys(obj).every(k=>allowed.split(' ').includes(k)), '공개 데이터에 허용되지 않은 필드');
    const strings = xs => require(Array.isArray(xs) && xs.every(x=>typeof x==='string'), '공개 문장 배열 필요');
    const textFields = (obj,names) => require(names.split(' ').every(k=>typeof obj[k]==='string'), '공개 문장 필드 필요');
    const date = x => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x) && !Number.isNaN(Date.parse(x)) && new Date(x).toISOString().slice(0,10) === x;
    keys(data, 'schema_version as_of title summary summary_detail sources companies pillars cashflows review_log limitations');
    textFields(data,'title summary summary_detail');strings(data.limitations);
    require(data.schema_version === 1 && date(data.as_of), '투자 데스크 형식/기준일 오류');
    require(Array.isArray(data.sources) && Array.isArray(data.companies) && data.companies.length > 0, '소스/기업 배열 필요');
    const sourceIds = new Set();
    for (const s of data.sources) {
      keys(s, 'id title url date kind note');
      textFields(s,'id title url date kind note');
      require(s.id && !sourceIds.has(s.id), '소스 ID 중복'); sourceIds.add(s.id);
      require(typeof s.title === 'string' && s.title.length && /^https:\/\//.test(s.url), '소스 제목/HTTPS URL 필요');
      require(date(s.date) && s.date <= data.as_of, '미래 또는 잘못된 소스 날짜');
      require(['primary', 'market'].includes(s.kind), '소스 종류 오류');
    }
    const refs = xs => require(Array.isArray(xs) && xs.length > 0 && xs.every(x => sourceIds.has(x)), '확인되지 않은 소스 참조');
    const ids = new Set();
    for (const c of data.companies) {
      keys(c, 'id name ticker market currency role focus status thesis counter transmission evidence metrics checks gaps price_caveat eps multiple quote next_check assessment');
      textFields(c,'id name ticker market currency role focus status thesis counter price_caveat next_check assessment');strings(c.transmission);strings(c.gaps);
      require(c.id && !ids.has(c.id), '기업 ID 중복'); ids.add(c.id);
      require(c.name && c.ticker && ['KR', 'US'].includes(c.market) && ['KRW', 'USD'].includes(c.currency), '기업 식별 오류');
      require((c.market === 'KR') === (c.currency === 'KRW'), '시장과 통화 불일치');
      keys(c.quote, 'value date source session time');
      textFields(c.quote,'date source session time');
      require(c.quote && positive(c.quote.value) && date(c.quote.date) && c.quote.date <= data.as_of, '가격/시점 오류'); refs([c.quote.source]);
      require(data.sources.find(s=>s.id===c.quote.source).kind === 'market', '가격 소스 종류 오류');
      require(positive(c.multiple) && c.thesis && c.counter && c.next_check && c.price_caveat, '기업 검증 질문/가정 필요');
      require(['supported','mixed','unverified'].includes(c.status), '기업 가설 상태 오류');
      require(Array.isArray(c.metrics) && Array.isArray(c.evidence) && Array.isArray(c.gaps), '기업 근거 배열 필요');
      for (const m of c.metrics) { keys(m,'label value unit source period');textFields(m,'label unit source period'); require(Number.isFinite(m.value) && m.unit && m.period && m.label, '지표 단위/기간/수치 오류'); refs([m.source]); }
      for (const e of c.evidence) {keys(e,'relation text sources');textFields(e,'relation text');require(['supports','challenges','context'].includes(e.relation) && e.text, '근거 방향 오류'); refs(e.sources);}
      if (c.eps) {keys(c.eps,'value frequency period basis source');textFields(c.eps,'frequency period basis source');require(Number.isFinite(c.eps.value) && c.eps.period && c.eps.basis && c.eps.frequency === 'quarter', '분기 EPS 기준 오류');refs([c.eps.source]);}
      for (const p of c.checks) {keys(p,'metric confirm break next');textFields(p,'metric confirm break next');require(p.metric && p.confirm && p.break && p.next, '가설 점검 항목 부족');}
    }
    for (const p of data.pillars) {
      keys(p,'id title status readout sources companies break next');
      textFields(p,'id title status readout break next');
      require(p.title && p.readout && p.break && p.next && ['supported','mixed','unverified'].includes(p.status), '사이클 검증 항목 부족');
      refs(p.sources); require(p.companies.every(x => ids.has(x)), '사이클 기업 참조 오류');
    }
    for (const x of data.cashflows) {keys(x,'company value unit period basis source');textFields(x,'company unit period basis source');require(ids.has(x.company) && Number.isFinite(x.value) && x.period && x.basis && x.unit === 'USD bn', '현금흐름 기준 오류'); refs([x.source]);}
    for (const x of data.review_log) {keys(x,'date title body');textFields(x,'date title body');require(date(x.date) && x.date<=data.as_of && x.title && x.body, '검토 이력 오류');}
    return data;
  }
  return {number, reverse, scenario, sensitivity, isStale, validate};
});
