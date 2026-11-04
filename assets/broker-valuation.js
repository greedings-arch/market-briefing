(function(root,factory){
  'use strict';const api=factory(typeof module==='object'&&module.exports?require('./forward-valuation'):root.ForwardValuation);
  if(typeof module==='object'&&module.exports)module.exports=api;else root.BrokerValuation=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(F){
  'use strict';
  const ids=['sem','hynix','samsung'],finite=x=>typeof x==='number'&&Number.isFinite(x);
  const check=(ok,msg)=>{if(!ok)throw Error('리포트 평가 연결: '+msg);};
  const shape=(o,keys)=>{check(o&&typeof o==='object'&&!Array.isArray(o),'객체');check(Object.keys(o).every(k=>keys.includes(k))&&keys.every(k=>Object.hasOwn(o,k)),'필드');};
  const str=x=>check(typeof x==='string'&&x.trim(),'문장');
  const day=x=>check(typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString().slice(0,10)===x,'날짜');
  const unique=a=>new Set(a).size===a.length;
  const evidenceKeys=['report_id','company_id','broker','report_date','change_date','change_timing','current_target','previous_target','valuation_method','drivers'];
  function evidence(x){return Object.fromEntries(evidenceKeys.map(k=>[k,x[k]]));}
  function modelBasis(c){const q=c.consensus;return {consensus_as_of:q.as_of,reference_price:q.reference_price,forward_per:q.forward_per,fy2026:q.fy2026,fy2027:q.fy2027,history_per:c.history.selected,history_period:c.history.period,downside_eps:c.scenarios[0].eps,downside_per:c.scenarios[0].per,upside_eps:c.scenarios[1].eps,upside_per:c.scenarios[1].per};}
  function validate(p){
    shape(p,['schema_version','as_of','policy','window','companies','source_state']);check(p.schema_version===1,'버전');day(p.as_of);str(p.policy);shape(p.window,['from','through']);day(p.window.from);day(p.window.through);check(p.window.from<=p.window.through&&p.window.through<=p.as_of,'검토 기간');
    shape(p.source_state,['as_of','generated_at','review_versions']);day(p.source_state.as_of);str(p.source_state.generated_at);check(Number.isFinite(Date.parse(p.source_state.generated_at)),'자료 시각');check(Array.isArray(p.source_state.review_versions),'검토 버전');for(const r of p.source_state.review_versions){shape(r,['report_id','status','reviewed_on','note','pages']);str(r.report_id);str(r.note);check(Array.isArray(r.pages)&&r.pages.every(x=>Number.isInteger(x)&&x>0),'검토 쪽수');check(['changed','comparison','unchanged','unresolved'].includes(r.status),'검토 상태');day(r.reviewed_on);check(r.reviewed_on<=p.as_of,'미래 원문 검토');}
    const collectedDay=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(p.source_state.generated_at));check(p.source_state.as_of===p.window.through&&collectedDay<=p.as_of,'모델 검토 후 수집된 자료');
    check(Array.isArray(p.companies)&&p.companies.length===3&&unique(p.companies.map(x=>x.id)),'기업');
    const changes=[];
    for(const c of p.companies){
      shape(c,['id','eps_reason','per_reason','next_check','reviewed_reports','reviews','catalog','model_basis']);check(ids.includes(c.id),'기업 ID');['eps_reason','per_reason','next_check'].forEach(k=>str(c[k]));shape(c.catalog,['count','latest']);check(Number.isInteger(c.catalog.count)&&c.catalog.count>0,'보존 원문 수');day(c.catalog.latest);
      shape(c.model_basis,['consensus_as_of','reference_price','forward_per','fy2026','fy2027','history_per','history_period','downside_eps','downside_per','upside_eps','upside_per']);day(c.model_basis.consensus_as_of);str(c.model_basis.history_period);for(const [k,x]of Object.entries(c.model_basis))if(!['consensus_as_of','history_period'].includes(k))check(finite(x)&&x>0,'검토 모델 기준값');
      check(Array.isArray(c.reviewed_reports)&&c.reviewed_reports.length>0&&unique(c.reviewed_reports),'검토 범위');c.reviewed_reports.forEach(x=>check(typeof x==='string'&&/^naver-[a-f0-9]{20}$/.test(x),'원문 ID'));
      check(Array.isArray(c.reviews)&&c.reviews.length>0,'연결 검토');
      for(const r of c.reviews){
        shape(r,['change_id','pdf_url','source_basis','treatment','direction','flags','reason','metrics','posted_date']);day(r.posted_date);check(typeof r.change_id==='string'&&/^target-naver-[a-f0-9]{20}$/.test(r.change_id),'변경 ID');changes.push(r.change_id);
        check(typeof r.pdf_url==='string'&&/^https:\/\/stock\.pstatic\.net\/stock-research\/[\w/-]+\.pdf$/.test(r.pdf_url),'공개 PDF');
        shape(r.source_basis,evidenceKeys);const e=r.source_basis;check(r.change_id==='target-'+e.report_id&&c.reviewed_reports.includes(e.report_id)&&e.company_id===c.id,'근거 연결');str(e.broker);str(e.valuation_method);day(e.report_date);day(e.change_date);check(e.change_date<=e.report_date&&e.report_date<=p.as_of,'원문 날짜');
        check(['current_report','historical_change'].includes(e.change_timing),'과거 이력 구분');check(e.change_timing==='current_report'?e.change_date===e.report_date:e.change_date<e.report_date,'변경일');for(const k of ['current_target','previous_target'])check(finite(e[k])&&e[k]>0,'목표가');
        check(Array.isArray(e.drivers)&&e.drivers.length>0,'변경 근거');e.drivers.forEach(d=>{shape(d,['kind','detail','page']);check(['earnings','book_value','multiple','roll_forward','other','not_disclosed'].includes(d.kind),'변경 요인');str(d.detail);check(Number.isInteger(d.page)&&d.page>0,'쪽수');});
        check(['stress','stress_and_cap','reference','crosscheck','excluded'].includes(r.treatment),'반영 방법');check(['support','mixed','gap'].includes(r.direction),'판단 방향');check(Array.isArray(r.flags)&&unique(r.flags)&&r.flags.every(f=>['multiple_compression','capital_return_concern'].includes(f)),'판단 조건');str(r.reason);
        check(Array.isArray(r.metrics),'수치');const metricIDs=[];
        for(const m of r.metrics){shape(m,['metric','period','value','previous_value','previous_period','unit','page']);check(['EPS','PER','BPS','PBR'].includes(m.metric)&&['FY2026E','FY2027E','FY2028E','NTM'].includes(m.period),'지표·기간');check(finite(m.value)&&m.value>0&&(m.previous_value===null||finite(m.previous_value)&&m.previous_value>0),'수치');check(m.previous_value===null?m.previous_period===null:['FY2026E','FY2027E','FY2028E','NTM'].includes(m.previous_period),'이전 기간');check(m.unit===(['EPS','BPS'].includes(m.metric)?'KRW/share':'times'),'단위');check(Number.isInteger(m.page)&&m.page>0,'쪽수');metricIDs.push(m.metric+':'+m.period);}
        check(unique(metricIDs),'중복 지표');
        if(['stress','stress_and_cap'].includes(r.treatment))check(e.change_timing==='current_report'&&r.metrics.some(m=>m.metric==='EPS'&&m.period==='FY2026E'),'하방은 당해 연도 EPS만');
        if(r.treatment==='stress_and_cap')check(r.metrics.some(m=>m.metric==='PER'&&m.period==='FY2027E'&&m.previous_value>m.value),'낙관 배수 제한은 같은 시나리오 연도 PER만');
        if(e.change_timing==='historical_change')check(r.treatment==='excluded'&&r.metrics.length===0&&r.flags.length===0,'과거 이유 미확인 이력 제외');
      }
    }check(unique(changes),'중복 연결');return p;
  }
  function validateCompany(p,b,c){
    check(b&&Array.isArray(b.changes)&&Array.isArray(b.reviews),'원문 자료 누락');day(b.as_of);check(b.as_of===p.source_state.as_of&&b.generated_at===p.source_state.generated_at,'수집 갱신 후 모델 검토 필요');
    const versions=b.reviews.map(r=>({report_id:r.report_id,status:r.status,reviewed_on:r.reviewed_on,note:r.note,pages:r.pages}));check(JSON.stringify(versions)===JSON.stringify(p.source_state.review_versions.map(r=>({report_id:r.report_id,status:r.status,reviewed_on:r.reviewed_on,note:r.note,pages:r.pages}))),'새 유지·변경 보고서 검토 반영 필요');
    const items=b.items?.filter(x=>x.company_id===c.id),catalog=items?{count:items.length,latest:items.map(x=>x.date).sort().at(-1)}:b.watchlist?.find(x=>x.id===c.id);check(catalog&&catalog.count===c.catalog.count&&catalog.latest===c.catalog.latest,'새 기업 보고서의 모델 검토 필요');
    for(const rid of c.reviewed_reports)check(b.reviews.some(r=>r.report_id===rid),'검토 원문 누락');
    const map=new Map(b.changes.map(x=>[x.id,x]));
    for(const r of c.reviews){const x=map.get(r.change_id);check(x&&JSON.stringify(evidence(x))===JSON.stringify(r.source_basis)&&x.date===r.posted_date,'변경 근거 재검토 필요');const url=x.pdf_url||b.items?.find(i=>i.id===x.report_id)?.pdf_url;check(url===r.pdf_url,'원문 주소 변경');check(r.metrics.every(m=>x.pages.includes(m.page)),'미검토 원문 쪽수');}
    const relevant=b.changes.filter(x=>x.company_id===c.id&&x.report_date>=p.window.from);
    check(relevant.every(x=>c.reviews.some(r=>r.change_id===x.id)),'새 목표가 변경의 모델 검토 대기');return c;
  }
  function validateLinks(p,b,d){validate(p);for(const c of p.companies){validateCompany(p,b,c);if(d){const model=F.get(d,c.id);check(model&&JSON.stringify(modelBasis(model))===JSON.stringify(c.model_basis),'컨센서스·역사 배수 갱신 후 재검토 필요');}}return p;}
  function bridge(e0,m0,e1,m1){const earnings=(e1-e0)*(m0+m1)/2,multiple=(m1-m0)*(e0+e1)/2;return {before:e0*m0,after:e1*m1,earnings,multiple,total:e1*m1-e0*m0,tieError:earnings+multiple-(e1*m1-e0*m0)};}
  function evaluate(defaults,brokers,policy,id,custom={},now=new Date()){
    const v=F.evaluate(defaults,id,custom,now);if(!v.result)return v;
    const result={...v,priceState:v.state,priceLabel:v.label,decisionState:'review',decisionLabel:'목표가 근거 재검토 · 행동 판단 보류',reviewStatus:'missing',review:null,reviewedScenarios:v.scenarios,assumptionChanges:[],brokerChecks:[]};
    try{
      validate(policy);const c=policy.companies.find(x=>x.id===id);check(c,'기업 검토 누락');validateCompany(policy,brokers,c);check(JSON.stringify(modelBasis(v.company))===JSON.stringify(c.model_basis),'컨센서스·역사 배수 갱신 후 재검토 필요');
      const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(now),age=(Date.parse(today)-Date.parse(policy.as_of))/86400000;
      check(age>=0&&age<=30,'목표가 모델 검토 30일 경과 또는 미래 날짜');
      // Older broker estimate revisions are never multiplied into newer consensus NTM EPS.
      const q=v.company.consensus,eligible=c.reviews.filter(r=>['stress','stress_and_cap'].includes(r.treatment));
      const epsCandidates=[{value:q.fy2026,label:'기존 FY2026 컨센서스',id:null},...eligible.map(r=>({value:r.metrics.find(m=>m.metric==='EPS'&&m.period==='FY2026E').value,label:r.source_basis.broker,id:r.change_id}))];
      const floor=epsCandidates.reduce((a,b)=>b.value<a.value?b:a),down={...v.scenarios[0],eps:floor.value,label:'보고서 대조 · 증익 정체',reason:'같은 FY2026 컨센서스와 검토한 변경 보고서 EPS 중 낮은 값('+floor.label+') 수준에 NTM 이익이 머무는 스트레스. 연간 EPS는 NTM 관측·시장 하한·확률 구간이 아닙니다.'};
      const capReviews=c.reviews.filter(r=>r.treatment==='stress_and_cap');const cap=capReviews.map(r=>({value:r.metrics.find(m=>m.metric==='PER'&&m.period==='FY2027E').value,id:r.change_id})).sort((a,b)=>a.value-b.value)[0];
      const up={...v.scenarios[1],per:cap?Math.min(v.scenarios[1].per,cap.value):v.scenarios[1].per,reason:cap?'기존 FY2027 컨센서스 수준의 EPS에 최근 보고서의 FY2027 PER를 상한으로 차용한 편집 시나리오. 증권사 목표가 재현이나 현재 NTM 적정배수 검증이 아닙니다.':v.scenarios[1].reason};
      for(const s of [down,up])s.result=F.calculate({...v.result,eps:s.eps,per:s.per});
      const changes=[{id:'base',label:'기본 NTM EPS·PER',before:v.original,after:v.original,bridge:bridge(v.original.eps,v.original.per,v.original.eps,v.original.per),reason:c.eps_reason+' '+c.per_reason},...[[v.scenarios[0],down],[v.scenarios[1],up]].map(([old,s])=>({id:s.id,label:s.id==='downside'?'증익 정체 시나리오':'낙관 시나리오',before:{eps:old.eps,per:old.per},after:{eps:s.eps,per:s.per},bridge:bridge(old.eps,old.per,s.eps,s.per),reason:s.reason}))];
      const active=c.reviews.filter(r=>r.source_basis.change_timing==='current_report'),flags=new Set(active.flatMap(r=>r.flags)),floorPassed=v.result.price<=down.result.entry;
      let state,label;
      if(['stale','loss'].includes(v.state)){state=v.state;label=v.label;}
      else if(v.changed){state='custom';label='사용자 가정 · 보고서 판단 별도 확인';}
      else if(v.state==='expensive'){state='caution';label='가격 부담 · 이익·배수 근거 재검토';}
      else if(v.state==='thin'){state='wait';label=flags.has('multiple_compression')?'가격 여유 부족 · 배수 하락 점검':'가격 여유 부족 · 확인 대기';}
      else if(flags.has('capital_return_concern')){state='wait';label='계산상 여유 · 주주환원 검증 대기';}
      else if(!floorPassed){state='wait';label='계산상 여유 · 증익 지속 확인 필요';}
      else {state='conditional';label='조건부 매력 · 하방·근거 확인 지속';}
      const next=c.next_check+' 하방 스트레스에서도 설정 여유율을 충족하는 가격은 '+Math.round(down.result.entry).toLocaleString('ko-KR')+'원입니다.';
      return {...result,decisionState:state,decisionLabel:label,reviewStatus:'ready',review:c,reviewedScenarios:[down,up],assumptionChanges:changes,brokerChecks:c.reviews.flatMap(r=>r.metrics.filter(m=>m.metric==='EPS'&&['FY2026E','FY2027E'].includes(m.period)).map(m=>({...m,broker:r.source_basis.broker,pdf_url:r.pdf_url,change_id:r.change_id,consensus:m.period==='FY2026E'?q.fy2026:q.fy2027,gap:m.value/(m.period==='FY2026E'?q.fy2026:q.fy2027)-1}))),floorPassed,floorSource:floor,cap,flags:[...flags],next,reviewedCount:c.reviewed_reports.length,mappedCount:c.reviews.length};
    }catch(error){return {...result,reviewError:error.message,next:'목표가 변경 원문과 모델 연결을 다시 검토한 뒤 판단합니다. 기본 산식 수치는 참고 계산으로만 남습니다.'};}
  }
  function fromLibrary(lib,id,custom={},now=new Date()){return evaluate(lib?.['valuation-defaults'],lib?.['broker-research'],lib?.['valuation-broker'],id,custom,now);}
  function signal(lib,id,now=new Date()){
    const v=fromLibrary(lib,id,{},now);if(!ids.includes(id))return null;
    const ready=v.reviewStatus==='ready'&&v.state!=='stale',refs=ready?v.review.reviews.map(r=>({label:r.source_basis.broker+' 원문',date:r.source_basis.report_date,url:r.pdf_url})):[];
    return {id:'broker-model-'+id,title:'증권사 목표가 · 이익과 배수',tab:'reports',companies:[id],state:!ready?'gap':v.flags.length?'mixed':'support',needsReview:!ready||['wait','review','caution'].includes(v.decisionState),action:v.decisionLabel||'목표가 연결 검토 필요',label:ready?'이익·평가 근거 대조':'목표가 연결 재검토',asOf:lib?.['valuation-broker']?.as_of,facts:ready?v.review.reviews.map(r=>r.source_basis.broker+': '+r.reason):[],refs,reading:ready?v.review.eps_reason+' '+v.review.per_reason:'새 변경·원문 누락·기간을 확인할 때까지 행동 판단을 보류합니다.',model:ready?'기본 EPS 중복 조정 0%; 하방 EPS '+v.reviewedScenarios[0].eps+'원, 낙관 PER '+v.reviewedScenarios[1].per+'배.':'기본 계산은 참고값이며 보고서 검토 미완료',next:v.next||'자료 다시 읽기 후 확인합니다.'};
  }
  return {validate,validateLinks,evidence,bridge,evaluate,fromLibrary,signal};
});
