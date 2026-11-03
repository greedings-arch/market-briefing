(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;else root.ResearchSignals=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const rows=x=>Array.isArray(x)?x:[],finite=x=>typeof x==='number'&&Number.isFinite(x);
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=(x,n=2)=>finite(x)?x.toLocaleString('ko-KR',{maximumFractionDigits:n}):'—';
  const signed=x=>(x>0?'+':'')+fmt(x)+'%';
  const latest=xs=>rows(xs).slice().sort((a,b)=>String(b.date||b.source_date).localeCompare(String(a.date||a.source_date)))[0];
  const link=(tab,extra={})=>'#'+tab+(Object.keys(extra).length?'?'+new URLSearchParams(extra):'');
  const source=(r,label)=>({label:label||r.source_name||'공개 원문',date:r.source_date||r.date,url:r.source_url});
  const today=(now=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  function freshness(signal,days,now=new Date()){
    if(!signal.asOf)return signal;
    const age=(Date.parse(today(now))-Date.parse(signal.asOf))/86400000;
    if(!Number.isFinite(age)||age<0||age>days)return {...signal,state:'stale',label:'갱신 필요 · 판단 유보',reading:`이 근거는 ${signal.asOf} 기준입니다. ${days}일의 점검 주기를 벗어나 현재 사업 가설의 지지·반대 판정에서 제외합니다. 아래 조건에 맞는 새 관측을 확인해야 합니다.`};
    return signal;
  }
  const missing=(id,title,tab,companies)=>({id,title,tab,companies,state:'gap',label:'근거 미확인',facts:[],refs:[],reading:'해당 자료를 불러오지 못했거나 비교 가능한 관측이 부족합니다. 이전 값을 현재 신호로 대신 쓰지 않습니다.',model:'추정치 변경 보류',next:'자료 탭에서 원문·기간·단위를 확인한 뒤 다시 검토합니다.'});
  function memorySignals(data,now=new Date()){
    const targets=['hynix','samsung'];
    const contract=missing('memory-contract','DRAM 계약가 전망','memory',targets);
    const forecast=rows(data?.quarters).filter(x=>x.kind==='forecast'&&x.product==='일반 DRAM'&&finite(x.low)&&finite(x.high)).sort((a,b)=>b.quarter.localeCompare(a.quarter)||b.source_date.localeCompare(a.source_date))[0];
    if(forecast){
      Object.assign(contract,{state:forecast.low>0?'support':forecast.high<0?'caution':'mixed',label:forecast.low>0?'이익 방향 지지 · 전망':forecast.high<0?'ASP 하방 점검':'방향 상충',asOf:forecast.source_date,
        facts:[`${forecast.quarter} ${forecast.product} 계약가 전망: 전분기 대비 ${fmt(forecast.low)}~${fmt(forecast.high)}%.`],refs:[source(forecast,'TrendForce 전망')],route:{view:'prices',id:forecast.id},
        reading:forecast.low>0?'범용 DRAM의 이익 방향에는 우호적입니다. 전망이 실제 계약 ASP로 실현되는지 확인할 때까지 HBM·NAND를 포함한 메모리 전체 이익의 상향 근거로 쓰지 않습니다.':'계약 ASP 가정을 다시 검토해야 합니다. HBM 가격과 제품 구성까지 같은 방향으로 움직인다고 가정하지 않습니다.',
        model:'범용 DRAM 매출 = 비트 출하 × 비트당 ASP. HBM 믹스·원가·수율은 별도 입력입니다.',
        next:'다음 분기 계약가 실측과 회사 ASP·비트 출하를 대조합니다. 실제 ASP가 기존 전망을 밑돌면 DRAM 매출·마진의 상방 가정을 낮춥니다.'});
      const day=today(now),quarter=day.slice(0,4)+'-Q'+Math.ceil(Number(day.slice(5,7))/3);
      if(forecast.quarter<quarter||forecast.source_date>day)Object.assign(contract,{state:'stale',label:'지난 전망 · 재검토 필요',reading:'해당 전망의 대상 분기가 지났거나 원문 날짜를 확인해야 합니다. 과거 전망을 현재 이익 방향의 근거로 유지하지 않습니다. 이후 실측과 새 전망을 확인합니다.'});
    }
    const spot=missing('memory-nand','NAND 현물의 반대 신호','memory',targets);
    const observations=rows(data?.history).filter(x=>x.series_id==='nand-512gb-tlc-wafer-weekly'&&x.frequency==='weekly'&&x.unit==='USD/512Gb die'&&finite(x.value)&&x.value>0).sort((a,b)=>b.date.localeCompare(a.date));
    const last=observations[0],prior=last&&observations.find(x=>x.date<last.date),change=prior?(last.value/prior.value-1)*100:null;
    if(last){Object.assign(spot,{state:change===null?'gap':change<0?'caution':change>0?'support':'mixed',label:change===null?'비교 관측 부족':change<0?'NAND 하방 점검':change>0?'현물 회복 · 확인 필요':'현물 보합',asOf:last.date,change,
      facts:[`512Gb TLC wafer 현물: ${fmt(last.value,3)} ${last.unit} (${last.date}).`,...(prior?[`${prior.date} ${fmt(prior.value,3)} → ${last.date} ${fmt(last.value,3)}: ${signed(change)}. 같은 시리즈의 두 관측 비교입니다.`]:[])],refs:[source(last,'TrendForce 주간 현물'),...(prior?[source(prior,'직전 관측 원문')]:[])],route:{view:'prices',id:last.id},
      reading:change===null?'가격의 방향을 판단할 비교값이 부족합니다.':change<0?'DRAM 전망이 좋아도 NAND까지 일괄 강세로 볼 수 없습니다. 삼성전자·SK hynix의 NAND 이익에는 하방 점검을 추가합니다.':'현물 방향을 NAND 계약가·재고와 대조합니다. 현물의 움직임만으로 회사의 계약 매출을 바꾸지 않습니다.',
      model:'NAND 계약 ASP·비트 출하·재고평가손익을 분리합니다. 현물 변동률을 회사 매출이나 EPS에 그대로 곱하지 않습니다.',
      next:'다음 주 같은 현물 시리즈와 다음 회사 실적의 NAND ASP·재고를 확인합니다. 약세가 계약가·재고에도 확인되면 NAND 이익 가정을 낮춥니다.'});}
    return [contract,freshness(spot,14,now)];
  }
  function gpuSignal(data,now=new Date()){
    const result=missing('gpu-fixed','GPU 임대가격과 투자 회수','gpu',['nvda','msft','amzn','googl','meta','hynix','samsung','sem']);
    const direct=data?.research?.direct,model=rows(direct?.models).find(x=>x.id==='b300-sxm');
    if(direct?.kind!=='direct_fixed_panel'||!finite(model?.change)||model.providers<3)return result;
    const series=rows(data?.data?.series).filter(x=>rows(model.series).includes(x.id));
    return freshness({...result,state:model.change<0?'caution':'mixed',label:model.change<0?'임대료 하락 · 회수 점검':'가격 급락 근거 없음',asOf:model.end,change:model.change,route:{section:'gpu-direct'},
      facts:[`B300 공식 고정 표본 ${model.providers}개 공급자: ${model.base} → ${model.end} ${signed(model.change)} (기준 100 → ${fmt(model.index)}).`],
      refs:series.map(s=>({label:s.provider+' 공식 요금',date:model.end,url:s.source})),
      reading:model.change<0?'동일 상품 조건의 공개 임대료가 낮아졌습니다. 고객의 가동률·실현 단가까지 악화되는지 확인하면 설비투자 회수 가설을 다시 검토할 근거가 됩니다.':'이 표본에서 임대가격 급락은 확인되지 않습니다. 공시 가격 유지가 가동률이나 신규 주문의 강세를 증명하지는 않으므로, AI 사이클 지속은 실적·현금 회수와 함께 판단합니다.',
      model:'NVIDIA에는 고객의 투자 회수·재주문, 클라우드에는 임대 단가 × 가동률 − 감가상각·전력비가 핵심입니다. 공급사 간 요금 수준은 직접 비교하지 않습니다.',
      next:'다음 동일 SKU·지역·GPU 수·과금 조건의 가격과 실제 임대 가능 수량을 대조합니다. 가격 하락과 가용 물량 증가, 재주문 둔화가 겹치면 투자 회수 가정을 낮춥니다.'},4,now);
  }
  function telegramSignal(data){
    const result=missing('telegram-capex','텔레그램의 투자 확대 논거','telegram',['sem','hynix','samsung','nvda','msft','amzn','googl','meta']);
    const r=rows(data?.items).find(x=>x.id==='research-b1f4094fe6d4f07b'&&x.source_type==='telegram_summary');
    if(!r)return result;
    const financing=rows(data?.items).find(x=>x.id==='research-8b2926eb1f225c3a'&&x.source_type==='telegram_summary');
    return {...result,state:'context',label:'전언 · 공식 확인 대기',asOf:r.source_date,route:{id:r.id},
      facts:[...rows(r.facts).slice(0,1).map(x=>x.text),...(financing?[`${financing.broker} 분석을 전한 ${financing.channel} 정리글은 장기 고객 계약과 자금조달을 함께 다룹니다. 원문 보고서·계약서는 미열람입니다.`]:[])],refs:[source(r,(r.channel||'텔레그램')+' 정리글'),...(financing?[source(financing,(financing.channel||'텔레그램')+' 정리글')]:[])],
      reading:'총투자 전망의 상향에는 리스 집계 범위의 확대가 섞여 있습니다. 이를 신규 수요 증가로 전부 계산하지 않고, 회사별 현금 CapEx·금융리스·확정 발주를 나눠 확인하는 방향으로 판단을 수정합니다.',
      model:'투자액의 범위와 인식 시점을 통일한 뒤 공급망 매출로 연결합니다. 같은 리스·장비 발주를 두 번 합산하지 않습니다.',
      next:'원문 보고서·산출표와 다음 기업 공시에서 집계 범위를 확인합니다. 원문을 읽지 않은 전언이며, 이 정리글만으로 매출·EPS 추정치를 높이지 않습니다.'};
  }
  function analyze(library={},now=new Date()){
    return [...memorySignals(library.memory,now),gpuSignal(library.gpu,now),telegramSignal(library.telegram)];
  }
  function summary(library={}){
    const signals=analyze(library),gaps=signals.filter(s=>['gap','stale'].includes(s.state)).length;
    if(gaps)return {headline:'자료 보완·갱신이 필요한 영역은 판단을 보류합니다.',body:`${signals.length}개 산업 신호 중 ${gaps}개가 미확인 또는 갱신 필요 상태입니다. 확인된 자료의 지지·반대 논거만 반영하며 이전 결론을 자동으로 유지하지 않습니다.`};
    const [dram,nand,gpu]=signals;
    return {headline:dram.state==='support'&&nand.state==='caution'?'DRAM 전망은 지지하지만, NAND 위험을 더해 판단합니다.':gpu.state==='caution'?'임대료 하락을 반영해 투자 회수 가정을 다시 점검합니다.':'자료의 방향과 기업 이익을 대조하며 가설을 검증합니다.',
      body:`DRAM은 ${dram.label}, NAND는 ${nand.label}, GPU는 ${gpu.label} 상태입니다. 텔레그램의 투자 확대 논거는 집계 범위를 확인해야 합니다. 정상화 이익·컨센서스가 없어 현재 가격의 매력도는 보류합니다.`};
  }
  const profiles={
    sem:{name:'삼성전기',readout:'AI 서버 투자 가설은 유지하되, MLCC·기판의 직접 수혜 확인이 우선입니다.',line:'고부가 MLCC·FC-BGA의 출하, ASP, 가동률과 영업이익률',boundary:'GPU 임대료·메모리 가격은 고객 투자 환경입니다. 삼성전기의 수주·이익을 직접 증명하지 않습니다.',next:'다음 실적에서 AI 서버용 MLCC·기판 수요가 실제 매출 구성과 마진 개선으로 이어지는지 확인합니다.'},
    hynix:{name:'SK hynix',readout:'DRAM 이익 방향과 NAND 위험을 분리해 가설을 재검토합니다.',line:'HBM·범용 DRAM·NAND별 ASP, 비트 출하, 제품 구성과 마진',boundary:'범용 DRAM 계약가 전망을 HBM 가격·장기계약 보호 수준으로 옮겨 쓰지 않습니다.',next:'다음 회사 실적에서 HBM 출하·수익성과 NAND ASP·재고를 별도로 확인합니다.'},
    samsung:{name:'삼성전자',readout:'메모리 가격 상승의 수혜와 NAND·세트 원가 부담을 함께 점검합니다.',line:'DRAM·HBM·NAND의 ASP·출하·수율, 세트 사업 원가와 이익',boundary:'DRAM 매출 점유율 상승은 HBM 수율 개선의 단독 증거가 아닙니다. 부품 가격 상승은 세트 사업의 비용이기도 합니다.',next:'다음 실적에서 HBM 고객·수율 진전, NAND 재고, 세트 마진을 나눠 대조합니다.'},
    nvda:{name:'NVIDIA',readout:'고객의 투자 회수와 재주문을 확인해야 수요 가설을 강화할 수 있습니다.',line:'데이터센터 출하·매출, 고객 재주문과 총이익률',boundary:'클라우드의 공개 GPU 임대료는 NVIDIA의 GPU 판매 ASP·수주 잔고가 아닙니다.',next:'다음 실적에서 고객의 장비 인도·재주문과 매출 전환을 확인합니다.'},
    msft:{name:'Microsoft',readout:'클라우드 수요와 투자 회수의 속도를 따로 검증합니다.',line:'Azure 성장, CapEx·금융리스, 감가상각, OCF·FCF',boundary:'시장 임대료 보합만으로 Azure의 실현 단가·가동률을 알 수 없습니다.',next:'다음 실적에서 Azure 성장과 용량 인도, CapEx·리스·감가상각의 증가 속도를 대조합니다.'},
    amzn:{name:'Amazon',readout:'AWS 성장과 전사 현금 회수의 괴리를 검토합니다.',line:'AWS 매출·영업이익, 전사 CapEx와 FCF',boundary:'AWS의 수요 신호를 유통 사업까지 포함한 전사 FCF와 같은 지표로 취급하지 않습니다.',next:'다음 실적에서 AWS 성장·마진과 전사 투자 현금 유출이 함께 개선되는지 확인합니다.'},
    googl:{name:'Alphabet',readout:'Cloud 성장의 구성과 투자 회수를 함께 검증합니다.',line:'Cloud 서비스·하드웨어 매출 구성, CapEx, 감가상각·FCF',boundary:'자체 TPU와 외부 GPU의 경제성이 다르며 공개 GPU 임대료를 Cloud 전체 마진으로 대입하지 않습니다.',next:'다음 실적에서 Cloud 성장의 서비스·하드웨어 구성과 현금 회수 속도를 확인합니다.'},
    meta:{name:'Meta',readout:'광고 수익의 개선이 AI 투자 부담을 감당하는지 검토합니다.',line:'광고 매출·전환 효율, CapEx, 감가상각·FCF',boundary:'Meta는 이 표본의 GPU 임대 판매자가 아닙니다. 임대료와 광고 매출을 직접 연결하지 않습니다.',next:'다음 실적에서 광고 수익의 증분과 AI 투자·감가상각 부담을 대조합니다.'},
    aapl:{name:'Apple',readout:'복구한 가격·텔레그램 자료만으로 AI 투자 수혜를 판단하기 어렵습니다.',line:'제품 교체 수요, 서비스 수익화와 부품 원가',boundary:'메모리 가격 상승은 매출 수혜가 아니라 원가 부담일 수 있습니다. 수익화의 직접 근거가 필요합니다.',next:'다음 실적에서 AI 기능의 유료 수익화·교체 수요와 제품 마진을 확인합니다.'},
    tsla:{name:'Tesla',readout:'복구한 산업 자료만으로 기업 가설·가격 판단을 높이지 않습니다.',line:'자동차 이익, AI 투자 현금 유출과 상용 수익',boundary:'GPU·메모리 수요를 Tesla의 상용 AI 수익으로 환산할 근거가 부족합니다.',next:'회사 실적 원문과 AI 사업의 외부 매출·현금 회수를 먼저 확보합니다.'}
  };
  function company(id,library={},now=new Date()){
    const p=profiles[id];if(!p)return null;
    const signals=analyze(library,now).filter(s=>s.companies.includes(id));
    const caution=signals.some(s=>s.state==='caution'),missingData=signals.some(s=>['gap','stale'].includes(s.state));
    const readout=missingData?`${p.name}: 자료 보완 전에는 가설 유지·강화를 판단할 수 없습니다.`:caution&&!['hynix','samsung'].includes(id)?`${p.name}: 임대시장 하방 신호를 반영해 투자 회수 가정을 다시 점검합니다.`:p.readout;
    return {...p,readout,signals,state:!signals.length||missingData?'gap':caution?'caution':'mixed',label:!signals.length?'직접 근거 부족':missingData?'자료 보완 필요':caution?'하방 조건 추가 점검':'조건부 가설 유지',price:'가격 매력도 판단 보류 · 정상화 EPS·컨센서스 미확보'};
  }
  function refsHTML(refs){return rows(refs).map(r=>{let u;try{u=new URL(r.url);}catch{return '';}
    return /^https?:$/.test(u.protocol)?`<a href="${esc(u.href)}" target="_blank" rel="noopener noreferrer">${esc(r.label)} ↗ <span>${esc(r.date)}</span></a>`:'';}).join('');}
  function card(s,{companyID,compact=false}={}){
    const to=link(s.tab,{...s.route,...(companyID?{company:companyID}:{})});
    return `<article class="signal-card ${esc(s.state)}" data-signal="${esc(s.id)}"><div class="signal-head"><h3>${esc(s.title)}</h3><span class="signal-label">${esc(s.label)}</span></div>${s.asOf?`<p class="signal-date">근거 기준 ${esc(s.asOf)} · 저장 자료의 해석</p>`:''}<ul class="signal-facts">${s.facts.map(x=>`<li>${esc(x)}</li>`).join('')}</ul><p class="signal-reading"><b>판단 반영</b> ${esc(s.reading)}</p><details ${compact?'':'open'}><summary>이익 가정과 판단을 바꿀 조건</summary><dl><dt>이익에 연결할 항목</dt><dd>${esc(s.model)}</dd><dt>다음 확인 · 초안 점검 기준</dt><dd>${esc(s.next)}</dd></dl><div class="signal-sources">${refsHTML(s.refs)}</div></details><a class="signal-return" href="${esc(to)}">${s.tab==='gpu'?'GPU 가격':s.tab==='memory'?'메모리 가격':'텔레그램'} 자료 확인 →</a></article>`;
  }
  function overview(library){
    const signals=analyze(library),gaps=signals.filter(x=>['gap','stale'].includes(x.state)).length;
    return `<section class="research-assessment" data-research-assessment><div class="signal-section-head"><div><p class="eyebrow">자료 → 이익 가정 → 투자 판단</p><h2>기존 자료를 반영하면 판단이 이렇게 달라집니다</h2></div><a href="#evidence">근거·검토 이력 →</a></div><p class="signal-intro">${gaps?`${gaps}개 신호는 자료 보완이 필요합니다. `:''}사업 가설은 지지·반대 근거를 함께 보며 갱신합니다. 가격 매력도는 정상화 이익·컨센서스를 확보하기 전까지 보류합니다. 아래 수치는 각 탭의 자료에서 읽으며 새 관측이 반영되면 비교 결과도 바뀝니다.</p><div class="signal-grid">${signals.map(s=>card(s,{compact:true})).join('')}</div></section>`;
  }
  function companyHTML(id,library,{compact=false}={}){
    const p=company(id,library);if(!p)return '';
    return `<section class="research-assessment company-assessment" data-company-assessment="${esc(id)}"><p class="eyebrow">기존 자료를 반영한 기업 판단 · 편집 해석</p><h2>${esc(p.readout)}</h2><span class="signal-label">${esc(p.label)}</span><p>${esc(p.boundary)}</p><dl><dt>검토할 이익 가정</dt><dd>${esc(p.line)}</dd><dt>다음 확인 시점·내용</dt><dd>${esc(p.next)} 발표일은 공식 일정에서 확인합니다.</dd><dt>현재 주가에 대한 결론</dt><dd>${esc(p.price)}. 가격 검토의 연간 EPS 입력값은 자동으로 상향하지 않습니다.</dd></dl>${compact?'':`<div class="signal-grid">${p.signals.map(s=>card(s,{companyID:id,compact:true})).join('')}</div>`}</section>`;
  }
  function tabHTML(tab,data,companyID){
    const signals=tab==='memory'?memorySignals(data):tab==='gpu'?[gpuSignal(data)]:tab==='telegram'?[telegramSignal(data)]:[];
    if(!signals.length)return '';
    return `<details class="research-assessment tab-assessment"><summary>이 자료가 투자 판단에 주는 변화 <span>${signals.map(s=>esc(s.label)).join(' · ')}</span></summary><div class="signal-grid">${signals.map(s=>card(s,{companyID,compact:true})).join('')}</div><nav class="signal-company-links"><a href="#desk">전체 투자 판단 →</a>${[...new Set(signals.flatMap(s=>s.companies))].map(id=>`<a href="${link('company',{id})}">${esc(profiles[id]?.name||id)} 판단 →</a>`).join('')}</nav></details>`;
  }
  return {analyze,summary,memorySignals,gpuSignal,telegramSignal,company,overview,companyHTML,tabHTML};
});
