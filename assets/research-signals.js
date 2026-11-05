(function(root,factory){
  'use strict';
  const api=factory(typeof module==='object'&&module.exports?require('node:crypto').webcrypto:root.crypto,typeof module==='object'&&module.exports?require('./equity-model'):root.EquityModel,typeof module==='object'&&module.exports?require('./forward-valuation'):root.ForwardValuation);
  if(typeof module==='object'&&module.exports)module.exports=api;else root.ResearchSignals=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(cryptoAPI,M,F){
  'use strict';
  const B=typeof module==='object'&&module.exports?require('./broker-valuation'):globalThis.BrokerValuation;
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
    const targets=['sem','hynix','samsung'];
    const contract=missing('memory-contract','DRAM 계약가 전망','memory',targets);
    const forecast=rows(data?.quarters).filter(x=>['forecast','actual'].includes(x.kind)&&x.product==='일반 DRAM'&&finite(x.low)&&finite(x.high)).sort((a,b)=>b.quarter.localeCompare(a.quarter)||Number(b.kind==='actual')-Number(a.kind==='actual')||b.source_date.localeCompare(a.source_date))[0];
    if(forecast){
      const actual=forecast.kind==='actual',basis=actual?'실측':'전망';contract.title='DRAM 계약가 '+basis;
      Object.assign(contract,{state:forecast.low>0?'support':forecast.high<0?'caution':'mixed',label:forecast.low>0?'이익 방향 지지 · '+basis:forecast.high<0?'ASP 하방 점검':'방향 상충',asOf:forecast.source_date,
        facts:[`${forecast.quarter} ${forecast.product} 계약가 ${basis}: 전분기 대비 ${fmt(forecast.low)}~${fmt(forecast.high)}%.`],refs:[source(forecast,'TrendForce '+basis)],route:{view:'prices',id:forecast.id},
        reading:forecast.low>0?'범용 DRAM의 이익 방향에는 우호적입니다. 시장 가격과 회사의 실제 계약 ASP를 대조하며 HBM·NAND를 포함한 메모리 전체 이익의 상향 근거로 쓰지 않습니다.':'계약 ASP 가정을 다시 검토해야 합니다. HBM 가격과 제품 구성까지 같은 방향으로 움직인다고 가정하지 않습니다.',
        model:'범용 DRAM 매출 = 비트 출하 × 비트당 ASP. HBM 믹스·원가·수율은 별도 입력입니다.',
        next:'다음 분기 계약가 실측과 회사 ASP·비트 출하를 대조합니다. 실제 ASP가 기존 전망을 밑돌면 DRAM 매출·마진의 상방 가정을 낮춥니다.'});
      const day=today(now),quarter=day.slice(0,4)+'-Q'+Math.ceil(Number(day.slice(5,7))/3);
      if((!actual&&forecast.quarter<quarter)||forecast.source_date>day||(actual&&new Date(Date.UTC(Number(forecast.quarter.slice(0,4)),Number(forecast.quarter.at(-1))*3,0)).toISOString().slice(0,10)>day))Object.assign(contract,{state:'stale',label:'지난 전망 · 재검토 필요',reading:'해당 전망의 대상 분기가 지났거나 원문 날짜를 확인해야 합니다. 과거 전망을 현재 이익 방향의 근거로 유지하지 않습니다. 이후 실측과 새 전망을 확인합니다.'});
      if(actual)Object.assign(contract,freshness(contract,90,now));
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
  const affected=['sem','hynix','samsung','nvda','msft','amzn','googl','meta'];
  const gpuModels=['b300-sxm','b200-sxm','h200-sxm','h100-sxm'];
  function gpuSignal(data,now=new Date()){
    const result=missing('gpu-fixed','공식 4종 GPU 임대가격과 투자 회수','gpu',affected);
    const direct=data?.research?.direct;
    if(direct?.kind!=='direct_fixed_panel')return result;
    const models=gpuModels.map(id=>{
      const m=rows(direct.models).find(x=>x.id===id);
      const valid=m&&finite(m.change)&&m.providers>=3&&m.base<m.end;
      return freshness({id,label:m?.label||id,state:valid?(m.change<0?'caution':'mixed'):'gap',asOf:m?.end,model:m},4,now);
    });
    const gaps=models.filter(m=>['gap','stale'].includes(m.state)),falling=models.filter(m=>m.state==='caution');
    const valid=models.filter(m=>['caution','mixed'].includes(m.state));
    const seriesIDs=new Set(valid.flatMap(m=>rows(m.model.series))),series=rows(data?.data?.series).filter(x=>seriesIDs.has(x.id));
    return {...result,state:gaps.length?'gap':falling.length?'caution':'mixed',label:gaps.length?'일부 SKU 근거 미확인':falling.length?'임대료 하락 · 회수 점검':'공식 4종 고정표본 내 급락 미확인',models,asOf:direct.end,change:models[0]?.model?.change,route:{section:'gpu-direct'},
      facts:models.map(x=>x.state==='gap'||x.state==='stale'?`${x.label}: 비교 표본 부족 또는 갱신 필요. 해당 SKU 판단을 보류합니다.`:`${x.label} 공식 고정 표본 ${x.model.providers}개 공급자: ${x.model.base} → ${x.model.end} ${signed(x.model.change)} (기준 100 → ${fmt(x.model.index)}).`).concat('SKU별로 같은 공급자·상품 시리즈의 시작일/종료일을 비교합니다. GPU 수·지역·과금 조건을 섞지 않으며 SKU 간 평균도 만들지 않습니다. GB200·GB300은 이 고정표본 판단에 포함하지 않습니다.'),
      refs:series.map(s=>({label:s.provider+' '+s.model+' 공식 요금',date:direct.end,url:s.source})),
      reading:falling.length?`${falling.map(m=>m.model.label).join(', ')}의 동일 조건 공개 임대료가 낮아졌습니다. 해당 SKU의 고객 가동률·실현 단가·재주문을 먼저 점검합니다. 가격만으로 AI 투자 사이클의 종료를 단정하지 않습니다.`:valid.length?'B300·B200·H200·H100의 공식 고정 표본에서 임대가격 급락은 확인되지 않습니다. Vast GB200 등 마켓별 가격 변화는 GPU 가격 탭의 날짜별 해석과 별도로 대조해야 합니다. 공시 가격 유지가 가동률이나 신규 주문의 강세를 증명하지는 않습니다.':'현재 비교 가능한 고정 표본이 없습니다. 이전 가격을 채워 넣어 수요 가설을 유지하지 않습니다.',
      model:'공개 임대료는 클라우드 고객의 회수 여건입니다. GPU 판매 ASP·HBM 가격·부품 수주로 환산하지 않습니다.',
      next:falling.length?'하락 SKU의 동일 상품 가용 수량·가동률·재주문을 다음 관측과 실적에서 대조합니다. 세 지표가 함께 악화되면 고객 투자 회수와 공급망 주문 가정을 낮출 근거가 됩니다.':'다음 동일 SKU·지역·GPU 수·과금 조건의 가격과 실제 임대 가능 물량을 확인합니다. 관측이 빠지면 해당 SKU 판단을 보류합니다.'};
  }
  // Content identity only, not a signature or a guarantee of source accuracy.
  // URL/date/access and every public analytical field are hashed; record IDs are routing only.
  const fingerprints=new WeakMap();
  function fingerprintText(note){
    const fields=['source_url','source_date','source_type','original_date','original_access','channel','broker','title','headline','question','thesis','limitations','reconsider','dateNote','facts','sections','connections','actions'];
    function canonical(x){if(Array.isArray(x))return x.map(canonical);if(x&&typeof x==='object')return Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])]));return typeof x==='string'?x.normalize('NFC'):x;}
    return JSON.stringify(canonical(Object.fromEntries(fields.map(k=>[k,note[k]??null]))));
  }
  async function prepareTelegram(data){
    if(!data)return data;
    await Promise.all(rows(data.items).filter(x=>x.source_type==='telegram_summary').map(async note=>{
      try{const text=fingerprintText(note),bytes=await cryptoAPI.subtle.digest('SHA-256',new TextEncoder().encode(text));fingerprints.set(note,{text,hash:Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('')});}catch{fingerprints.delete(note);}
    }));return data;
  }
  function telegramSignals(data,now=new Date()){
    const notes=rows(data?.items).filter(x=>x.source_type==='telegram_summary');
    if(!notes.length)return [missing('telegram-review','텔레그램 검토','telegram',affected)];
    return notes.map((note,i)=>{
      const review=rows(data.reviews).find(r=>r.source_url===note.source_url),fingerprint=fingerprints.get(note);
      const valid=review&&fingerprint?.text===fingerprintText(note)&&fingerprint.hash===review.source_hash&&['support','caution','context'].includes(review.state)&&rows(review.companies).length&&review.reviewed_on>=note.source_date&&review.reviewed_on<=today(now);
      const result={...missing('telegram-review-'+i,'텔레그램 · '+(note.broker||note.title),'telegram',valid?review.companies:affected),asOf:note.source_date,route:{id:note.id},refs:[source(note,(note.channel||'텔레그램')+' 정리글')],facts:rows(note.facts).map(x=>x.text),reviewedOn:valid?review.reviewed_on:null};
      if(!valid)return {...result,label:'내용 변경·신규 · 검토 필요',reading:'이 정리글의 현재 내용과 일치하는 투자 검토가 없습니다. 기존 해석을 적용하지 않으며 기업 판단의 확인 공백으로 반영합니다.',next:'원문 URL·게시일·본문·근거와 반대 조건을 검토한 뒤 기업별 해석을 갱신합니다.'};
      return freshness({...result,state:review.state,label:review.state==='caution'?'전언 · 하방 점검':review.state==='support'?'전언 · 지지 논거 검토':'전언 · 공식 확인 대기',reading:review.reading,model:review.model,next:review.next+' 원문을 읽지 않은 정리글의 해석이며, 이 자료만으로 EPS를 변경하지 않습니다.'},30,now);
    });
  }
  function analyze(library={},now=new Date()){
    return [...memorySignals(library.memory,now),gpuSignal(library.gpu,now),...telegramSignals(library.telegram,now)];
  }
  function summary(library={}){
    const signals=analyze(library),gaps=signals.filter(s=>['gap','stale'].includes(s.state)).length;
    if(gaps)return {headline:'자료 보완·갱신이 필요한 영역은 판단을 보류합니다.',body:`${signals.length}개 산업 신호 중 ${gaps}개가 미확인 또는 갱신 필요 상태입니다. 확인된 자료의 지지·반대 논거만 반영하며 이전 결론을 자동으로 유지하지 않습니다.`};
    const [dram,nand,gpu]=signals;
    return {headline:dram.state==='support'&&nand.state==='caution'?'DRAM 전망은 지지하지만, NAND 위험을 더해 판단합니다.':gpu.state==='caution'?'임대료 하락을 반영해 투자 회수 가정을 다시 점검합니다.':'자료의 방향과 기업 이익을 대조하며 가설을 검증합니다.',
      body:`DRAM은 ${dram.label}, NAND는 ${nand.label}, GPU는 ${gpu.label} 상태입니다. 텔레그램은 게시물별 검토와 기업별 영향으로 반영하며 공식 확인이 필요합니다. ${F?.get(library['valuation-defaults'],'sem')?'국내 3사는 컨센서스 EPS·역사 배수의 새 기본값으로 가격을 비교합니다. 산업 자료의 반대 신호는 이익 유지 가정을 다시 검토할 조건입니다.':'정상화 이익·컨센서스가 없어 현재 가격의 매력도는 보류합니다.'}`};
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
  function exposure(id,s){
    const pending=['gap','stale'].includes(s.state),fall=s.state==='caution',up=s.state==='support';
    let impact=s.reading,action=pending?'근거 재확인':fall?'하방 가정 검토':up?'상방 가정 검증':'추정치 유지 · 조건 확인',channel='간접';
    if(s.tab==='memory'){
      const dram=s.id==='memory-contract',product=dram?'범용 DRAM':'NAND';
      if(id==='sem'){
        impact=pending?'고객 메모리 원가·예산의 방향을 확인할 수 없습니다. 삼성전기의 직접 이익 가정은 변경하지 않습니다.':`${product} ${up?'가격 상승은 서버·세트 고객의 부품 원가 부담입니다.':fall?'약세는 고객 원가를 낮출 수 있지만 수요 둔화 신호일 수도 있습니다.':'가격 방향이 엇갈려 고객 예산에 미치는 영향이 불확실합니다.'} MLCC·FC-BGA 발주·ASP·가동률을 확인하며, 메모리 가격을 삼성전기 매출에 곱하지 않습니다.`;
        action=pending?'고객 원가 근거 재확인':'고객 원가·부품 발주 대조';
      }else{
        channel='직접 이익 동인 · 가격 대용치';
        impact=pending?`${product} ASP 가정의 확인 근거가 부족합니다. 이익 상향을 보류합니다.`:dram?`${product} ${up?'상승 자료는 ASP 상방을 검증할 근거입니다.':fall?'하락 자료는 ASP 하방을 검토할 근거입니다.':'가격 범위가 상충하므로 ASP 가정을 유지하고 실측을 확인합니다.'} HBM 가격·출하·수율은 별도로 확인합니다.`:`NAND 현물 ${up?'회복은 계약 ASP와 재고 개선이 동반되는지 확인할 신호입니다.':fall?'약세는 계약 ASP·재고평가손익의 하방 위험을 점검할 신호입니다.':'보합만으로 계약 ASP 가정을 바꾸지 않습니다.'}`;
        if(id==='samsung'&&!pending)impact+=` 삼성전자 세트 사업에는 ${up?'메모리 원가 부담':fall?'메모리 원가 완화 가능성':'원가 방향 불확실성'}이 있어 DS와 DX 이익을 따로 검토합니다.`;
      }
    }else if(s.tab==='gpu'){
      impact+=id==='sem'?' 삼성전기는 고객의 설비 발주가 MLCC·기판 주문과 가동률로 이어지는지 대조합니다.':['hynix','samsung'].includes(id)?' 메모리 업체에는 고객의 서버 증설·HBM 재주문을 통한 간접 신호이며, HBM 판매가격의 실측이 아닙니다.':'';
    }else if(s.tab==='telegram'){
      channel='2차 자료 · 편집 검토';
      impact+=id==='sem'?' 삼성전기에는 MLCC·기판 확정 발주로 이어지는지 확인할 조건입니다.':['hynix','samsung'].includes(id)?' 메모리 업체에는 서버 발주·HBM/DRAM 구매 약정으로 연결되는지 확인할 조건입니다.':'';
    }
    if(s.tab==='reports'){action=s.action;channel='이익·평가 조건 검토';}
    return {...s,sourceState:s.state,state:id==='sem'&&s.tab==='memory'&&!pending?'context':s.state,impact,action,channel,reading:impact};
  }
  const financeFingerprints=new WeakMap();
  function financeFingerprintText(item){
    function canonical(x){if(Array.isArray(x))return x.map(canonical);if(x&&typeof x==='object')return Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])]));return typeof x==='string'?x.normalize('NFC'):x;}
    return JSON.stringify(canonical(item));
  }
  async function prepareFinance(data){
    if(!data)return data;
    await Promise.all(rows(data.items).map(async item=>{
      try{const text=financeFingerprintText(item),bytes=await cryptoAPI.subtle.digest('SHA-256',new TextEncoder().encode(text));financeFingerprints.set(item,{text,hash:Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('')});}catch{financeFingerprints.delete(item);}
    }));return data;
  }
  const financeLabels={strengthened:'강화 · 사업 근거',weakened:'약화 · 가설 재검토',mixed:'혼재 · 긍정·반대 공존',unchanged:'유지 · 추가 입증 대기',unproven:'추가 입증 필요',gap:'자료 확인 필요',stale:'검토 기한 경과',uncovered:'직접 근거 부족'};
  function financeAssessment(id,snapshot,library={},now=new Date()){
    const day=today(now),review=rows(snapshot?.finance_reviews).filter(r=>r.company_id===id).sort((a,b)=>b.reviewed_on.localeCompare(a.reviewed_on))[0];
    const output=(state,reading,evidence=[])=>({state,label:financeLabels[state],reading,review,evidence});
    if(!review)return output('uncovered','이번 금융 사례에는 이 기업의 가설을 바꿀 직접 근거가 없습니다.');
    if(review.reviewed_on>day||review.next_review_on<day)return output('stale','종합 검토 기한이 지났거나 검토일이 미래입니다. 이전 강화·약화 판단은 현재 결론에서 제외합니다.');
    const evidence=review.evidence.map(ref=>rows(library.finance?.items).find(item=>item.id===ref.record_id));
    const valid=evidence.every((item,i)=>{
      const f=item&&financeFingerprints.get(item);
      return item?.verified===true&&item.source_date<=review.reviewed_on&&(!item.case_study||item.case_study.reviewed_on<=review.reviewed_on)&&(!item.insight||item.insight.reviewed_on<=review.reviewed_on)&&f?.text===financeFingerprintText(item)&&f.hash===review.evidence[i].source_hash;
    });
    if(!valid)return output('gap','금융 자료가 누락되거나 검토 후 바뀌었습니다. 근거를 다시 대조하기 전에는 종합 판단을 적용하지 않습니다.');
    return output(review.state,review.reading,evidence);
  }
  function financePrice(company,snapshot,library={},now=new Date()){
    const v=B.fromLibrary(library,company.id,{},now),quote=v?.company?.quote||company.quote;
    const age=(Date.parse(today(now))-Date.parse(quote.date))/86400000;
    const quoteFresh=finite(age)&&age>=0&&age<=4;
    if(company.market==='KR'){
      if(!v?.result||['stale','invalid','missing'].includes(v.state))return {quote,state:v?.state||'missing',label:v?.label||'기본 평가 자료 확인 필요',detail:'가격·컨센서스 갱신 후 판단합니다.',result:null};
      const r=v.result;
      return {quote,state:v.decisionState||v.state,priceState:v.state,label:v.decisionLabel||v.label,result:r,detail:`평가 참조 ₩${fmt(r.value,0)} · 가격 여유 ${fmt(r.margin*100,1)}% · 선택 PER ${fmt(r.per,1)}배. 컨센서스 EPS와 편집 배수의 조건부 계산입니다. ${v.reviewStatus==='ready'?v.next:'목표가 근거 연결을 재검토해야 합니다.'}`};
    }
    if(!quoteFresh)return {quote,state:'stale',label:'가격 갱신 후 판단',detail:'확인한 종가가 점검 기한 4일을 벗어났습니다.',result:null};
    const requiredEPS=quote.value*1.1/company.multiple;
    return {quote,state:'unpriced',label:'매력 판단 보류 · 이익 검증',result:null,requiredEPS,detail:`12개월 후 ${fmt(company.multiple,1)}배·요구수익률 10% 가정이면 연간 EPS $${fmt(requiredEPS,2)} 필요. 컨센서스·적정 배수는 미확보입니다.`};
  }
  function company(id,library={},now=new Date()){
    const p=profiles[id];if(!p)return null;
    const broker=('valuation-defaults' in library||'valuation-broker' in library)?B.signal(library,id,now):null;
    const signals=[...analyze(library,now),...(broker?[broker]:[])].filter(s=>s.companies.includes(id)).map(s=>exposure(id,s));
    const caution=signals.some(s=>s.state==='caution'),missingData=signals.some(s=>['gap','stale'].includes(s.state));
    const changes=signals.map(s=>({id:s.id,title:s.title,state:s.state,channel:s.channel,action:s.action,impact:s.impact,needsReview:!!s.needsReview}));
    const dram=signals.find(s=>s.id==='memory-contract'),nand=signals.find(s=>s.id==='memory-nand');
    let readout=p.readout;
    if(id==='sem')readout='삼성전기: 고객의 메모리 원가와 GPU 투자 회수 여건을 MLCC·기판 발주와 대조합니다.';
    if(['hynix','samsung'].includes(id))readout=`${p.name}: ${dram?.label||'DRAM 미확인'} · ${nand?.label||'NAND 미확인'}을 분리해 이익 가정을 검토합니다.`;
    if(caution)readout+=' 하방 신호가 있어 이익 상향보다 반대 근거 확인을 우선합니다.';
    if(missingData)readout=`${p.name}: 자료 보완 전에는 가설 유지·강화를 판단할 수 없습니다. 확인된 신호와 미확인 영역을 아래에 구분했습니다.`;
    return {...p,readout,signals,changes,state:!signals.length||missingData?'gap':caution?'caution':'mixed',label:!signals.length?'직접 근거 부족':missingData?'자료 보완 필요':caution?'하방 조건 추가 점검':'조건부 가설 유지',price:(()=>{const v=B.fromLibrary(library,id,{},now);return v?.result?'컨센서스·역사 배수 기본값: '+(v.decisionLabel||v.label)+' · 산업 자료의 '+(missingData?'미확인 영역 보완 필요':caution?'하방 조건 검토 필요':'검증 조건 유지'):'가격 매력도 판단 보류 · 기본 평가 자료 미확보';})()};
  }
  function gpuBriefing(data,{compact=false,now=new Date()}={}){
    const r=data?.research?.insights,o=r?.overview;if(!o)return '';
    const d=data.research.segments,catalog=data.research.catalog,age=(Date.parse(today(now))-Date.parse(r.reviewed_on))/86400000;
    const id=compact?'section-home-gpu':'section-gpu-overview';
    if(!finite(age)||age<0||age>7||(catalog&&Date.parse(catalog.data_updated_at)>Date.parse(r.observed_at)))return `<section class="gpu-brief gpu-brief-stale" id="${id}" data-gpu-briefing><p class="eyebrow">GPU 시장 요약 · 갱신 필요</p><h2>새 가격 자료와 분석을 다시 대조해야 합니다.</h2><p>직전 편집 검토는 ${esc(r.reviewed_on)}입니다. 지난 결론을 현재 판단으로 유지하지 않습니다.</p><a href="#gpu?section=gpu-insights">당시 분석과 근거 보기 →</a></section>`;
    const event=rows(r.events).find(e=>e.provider==='Vast.ai'&&e.model==='GB200'&&e.state==='observed_pair'&&e.unit==='GPU-hour'),delta=event?(event.after/event.before-1)*100:null;
    const peers=rows(catalog?.prices).filter(q=>{const days=(Date.parse(catalog.data_updated_at)-Date.parse(q.read_7d_ago_at))/86400000;return q.gpu_id==='gb200'&&q.provider_id!=='vast-ai'&&q.status==='live'&&finite(q.change_7d_pct)&&finite(q.listed_7d_ago)&&q.listed_7d_ago>0&&days>=6&&days<=9;});
    const providerCount=new Set(peers.map(q=>q.provider_id)).size,allFlat=peers.length&&peers.every(q=>Math.abs(q.change_7d_pct)<1e-8),matrix=rows(d?.matrix).filter(x=>['b300','b200','h200','gb200'].includes(x.id));
    const cell=x=>x&&finite(x.change)?`<b class="${x.change>0?'gpu-brief-rise':x.change<0?'gpu-brief-fall':''}">${signed(x.change)}</b><small>${x.providers}개 업체 · 인하 ${x.falling}곳</small>`:`<span>비교 보류</span><small>${x?.providers||0}개 업체 · 표본 부족</small>`;
    const evidence=[...(event?[{url:event.source_url,label:'Vast 일별 중앙값',date:event.effective_on}]:[]),...(catalog?[{url:catalog.source_url,label:'GPU Economy 7일 관측',date:catalog.data_updated_at.slice(0,10)}]:[])];
    return `<section class="gpu-brief ${compact?'gpu-brief-compact':''}" id="${id}" data-gpu-briefing><div class="gpu-brief-head"><p class="eyebrow">GPU MARKET BRIEF / 조사 결과 요약</p><span>검토 ${esc(r.reviewed_on)}</span></div><h2>${esc(o.headline)}</h2><p class="gpu-brief-deck">${esc(o.summary)}</p><div class="gpu-brief-metrics"><article><span>Vast GB200 · 일별 중앙값</span><strong class="gpu-brief-fall">${delta===null?'미확인':signed(delta)}</strong><small>${event?`$${fmt(event.before,2)} → $${fmt(event.after,2)} / GPU·시간<br>${esc(event.reference_on)} → ${esc(event.effective_on)}`:'비교할 날짜별 관측 부족'}</small></article><article><span>다른 GB200 · 7일 공시항목</span><strong>${allFlat?providerCount+'개 업체 보합':peers.length?'방향 재확인':'비교 자료 부족'}</strong><small>${peers.length}개 조건을 각각 비교<br>Spot·약정·시작가 포함 · 원 통화 기준</small></article><article><span>가용성·공급과잉</span><strong>추가 확인 필요</strong><small>공개 호가와 실제 배정은 별개<br>물량·대기시간 추가 확인 필요</small></article></div>${!compact&&matrix.length?`<div class="gpu-brief-directions"><div><h3>GPU별 임대료는 서로 다른 방향입니다</h3><p>같은 공시항목의 7일 변화 · ${esc(d.as_of?.slice(0,10))} 기준</p></div><div class="table-scroll"><table><thead><tr><th>GPU</th><th>빅테크</th><th>네오클라우드</th></tr></thead><tbody>${matrix.map(x=>`<tr><th scope="row">${esc(x.label.replace(/^NVIDIA /,''))}</th><td>${cell(x.groups.bigtech)}</td><td>${cell(x.groups.neocloud)}</td></tr>`).join('')}</tbody></table></div><p class="gpu-brief-table-note">USD·인스턴스·일반 온디맨드의 업체별 동일가중 비교입니다. 위 GB200 보합 카드보다 엄격한 표본입니다. 상승은 임대료 상승, 하락은 임차 비용 완화입니다.</p></div>`:''}<div class="gpu-brief-reading"><p><b>이 결과의 의미</b>${esc(o.meaning)}</p><p><b>다음 확인</b>${esc(o.watch)}</p></div><p class="gpu-brief-scope">${esc(o.scope)}</p><div class="gpu-brief-foot"><div>${refsHTML(evidence)}</div><a class="gpu-brief-link" href="#gpu?section=${compact?'gpu-overview':'gpu-insights'}">${compact?'GPU별 방향·시장 해석 보기':'상세 분석·원문 근거 보기'} →</a></div></section>`;
  }
  function refsHTML(refs){return rows(refs).map(r=>{let u;try{u=new URL(r.url);}catch{return '';}
    return /^https?:$/.test(u.protocol)?`<a href="${esc(u.href)}" target="_blank" rel="noopener noreferrer">${esc(r.label)} ↗ <span>${esc(r.date)}</span></a>`:'';}).join('');}
  function card(s,{companyID,compact=false}={}){
    const to=link(s.tab,{...s.route,...(companyID?{company:companyID}:{})});
    return `<article class="signal-card ${esc(s.state)}" data-signal="${esc(s.id)}"><div class="signal-head"><h3>${esc(s.title)}</h3><span class="signal-label">${esc(s.label)}</span></div>${s.asOf?`<p class="signal-date">근거 기준 ${esc(s.asOf)}${s.reviewedOn?' · 내용 검토 '+esc(s.reviewedOn):''} · 저장 자료의 해석</p>`:''}<ul class="signal-facts">${s.facts.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>${s.action?`<p class="signal-date">${esc(s.channel)} · 이번 검토: ${esc(s.action)}</p>`:''}<p class="signal-reading"><b>판단 반영</b> ${esc(s.reading)}</p><details ${compact?'':'open'}><summary>이익 가정과 판단을 바꿀 조건</summary><dl><dt>이익에 연결할 항목</dt><dd>${esc(s.model)}</dd><dt>다음 확인 · 초안 점검 기준</dt><dd>${esc(s.next)}</dd></dl><div class="signal-sources">${refsHTML(s.refs)}</div></details><a class="signal-return" href="${esc(to)}">${s.tab==='gpu'?'GPU 가격':s.tab==='memory'?'메모리 가격':s.tab==='reports'?'증권사 원문':'텔레그램'} 자료 확인 →</a></article>`;
  }
  function overview(library){
    const signals=analyze(library),gaps=signals.filter(x=>['gap','stale'].includes(x.state)).length;
    return `<section class="research-assessment" data-research-assessment><div class="signal-section-head"><div><p class="eyebrow">자료 → 이익 가정 → 투자 판단</p><h2>기존 자료를 반영하면 판단이 이렇게 달라집니다</h2></div><a href="#evidence">근거·검토 이력 →</a></div><p class="signal-intro">${gaps?`${gaps}개 신호는 자료 보완이 필요합니다. `:''}사업 가설은 지지·반대 근거를 함께 보며 갱신합니다. 국내 3사의 가격은 별도 EPS 시나리오에서 공개 가정과 함께 검토합니다. 가격은 비교 가능한 관측으로 계산하고, 텔레그램은 현재 내용과 일치하는 편집 검토만 적용합니다. 이 해석은 사업 가설의 검토 우선순위에 반영됩니다. 관측 변동률을 EPS에 자동으로 곱하지 않습니다. 매출·마진·배수를 사용자가 확인해 계산합니다. 메모리 자동 판정 범위는 일반 DRAM 계약가 전망·분기 실측과 NAND 주간 현물이며, 회사별 실제 계약 ASP·점유율은 별도 검토 대상입니다.</p><div class="signal-grid">${signals.map(s=>card(s,{compact:true})).join('')}</div></section>`;
  }
  function companyHTML(id,library,{compact=false}={}){
    const p=company(id,library);if(!p)return '';
    return `<section class="research-assessment company-assessment" data-company-assessment="${esc(id)}"><p class="eyebrow">기존 자료를 반영한 기업 판단 · 편집 해석</p><h2>${esc(p.readout)}</h2><span class="signal-label">${esc(p.label)}</span><p>${esc(p.boundary)}</p><dl><dt>검토할 이익 가정</dt><dd>${esc(p.line)}</dd><dt>다음 확인 시점·내용</dt><dd>${esc(p.next)} 발표일은 공식 일정에서 확인합니다.</dd><dt>현재 주가에 대한 결론</dt><dd>${esc(p.price)}. 공개 기본 가정의 가격 판단이며, 가격 검토 화면에서 바꾼 사용자 가정은 그 화면에서 확인합니다.</dd></dl><ul class="signal-decisions">${p.changes.map(x=>`<li><b>${esc(x.title)} · ${esc(x.action)}</b>${compact?`<p>${esc(x.impact)}</p>`:''}</li>`).join('')}</ul>${compact?'':`<div class="signal-grid">${p.signals.map(s=>card(s,{companyID:id,compact:true})).join('')}</div>`}</section>`;
  }
  function tabHTML(tab,data,companyID){
    const signals=tab==='memory'?memorySignals(data):tab==='gpu'?[gpuSignal(data)]:tab==='telegram'?telegramSignals(data):[];
    if(!signals.length)return '';
    return `<details class="research-assessment tab-assessment"><summary>이 자료가 투자 판단에 주는 변화 <span>${signals.map(s=>esc(s.label)).join(' · ')}</span></summary><div class="signal-grid">${signals.map(s=>card(s,{companyID,compact:true})).join('')}</div><nav class="signal-company-links"><a href="#desk">전체 투자 판단 →</a>${[...new Set(signals.flatMap(s=>s.companies))].map(id=>`<a href="${link('company',{id})}">${esc(profiles[id]?.name||id)} 판단 →</a>`).join('')}</nav></details>`;
  }
  return {analyze,summary,memorySignals,gpuSignal,gpuBriefing,telegramSignals,prepareTelegram,fingerprintText,prepareFinance,financeFingerprintText,financeAssessment,financePrice,company,overview,companyHTML,tabHTML};
});
