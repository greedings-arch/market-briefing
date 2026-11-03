(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ForwardValuation=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const finite=x=>typeof x==='number'&&Number.isFinite(x),positive=x=>finite(x)&&x>0;
 const check=(x,m)=>{if(!x)throw Error('기본 가치평가: '+m);};
 const shape=(x,ks)=>{check(x&&typeof x==='object'&&!Array.isArray(x),'객체');check(Object.keys(x).every(k=>ks.includes(k)),'비공개·미허용 필드');};
 const text=x=>check(typeof x==='string'&&x.trim(),'문장');
 function date(x){check(typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString().slice(0,10)===x,'날짜');}
 function quantile(xs,p){if(!Array.isArray(xs)||!xs.length||!xs.every(finite)||!finite(p)||p<0||p>1)return null;const a=[...xs].sort((x,y)=>x-y),i=(a.length-1)*p,lo=Math.floor(i);return a[lo]+(a[Math.ceil(i)]-a[lo])*(i-lo);}
 function selected(h){const x=h.rule==='lower_quartile'?quantile(h.observations.map(o=>o.per),.25):h.mean-h.sd;return finite(x)?Math.round(x*10)/10:null;}
 function validate(d){
  shape(d,['schema_version','as_of','currency','valuation_basis','policy','sources','companies']);check(d.schema_version===1&&d.currency==='KRW'&&d.valuation_basis==='current_NTM_reference','버전·단위·평가시점');date(d.as_of);text(d.policy);check(Array.isArray(d.sources)&&d.sources.length,'출처');const ids=new Set();
  for(const s of d.sources){shape(s,['id','url','title','date','kind','note']);['id','title','note'].forEach(k=>text(s[k]));check(typeof s.url==='string'&&/^https:\/\//.test(s.url),'출처 URL');check(['provider','broker','secondary','market'].includes(s.kind),'출처 종류');date(s.date);check(s.date<=d.as_of&&!ids.has(s.id),'출처 날짜·중복');ids.add(s.id);}
  const ref=x=>check(ids.has(x),'출처 연결');check(Array.isArray(d.companies)&&d.companies.length===3,'국내 3사');const seen=new Set(),tickers={sem:'009150',hynix:'000660',samsung:'005930'};
  for(const c of d.companies){shape(c,['id','name','ticker','quote','consensus','history','defaults','scenarios','eps_reason','per_reason','next_check','falsifier','limits']);check(typeof c.id==='string'&&typeof c.ticker==='string'&&tickers[c.id]===c.ticker&&!seen.has(c.id),'기업');seen.add(c.id);['name','eps_reason','per_reason','next_check','falsifier'].forEach(k=>text(c[k]));check(Array.isArray(c.limits)&&c.limits.length,'한계');c.limits.forEach(text);
   shape(c.quote,['value','date','source','time','session']);text(c.quote.time);text(c.quote.session);check(positive(c.quote.value),'주가');date(c.quote.date);check(c.quote.date<=d.as_of,'미래 주가');ref(c.quote.source);
   const q=c.consensus;shape(q,['as_of','retrieved_on','period','reference_price','reference_date','forward_per','source','annual_source','fy2026','fy2027','actual2025','target','target_source','count']);date(q.as_of);date(q.retrieved_on);date(q.reference_date);check(q.period==='NTM'&&q.as_of===q.reference_date&&q.as_of<=q.retrieved_on&&q.retrieved_on<=d.as_of,'EPS 기간·가격 기준일');for(const k of ['reference_price','forward_per','fy2026','fy2027','actual2025','target'])check(positive(q[k]),'EPS 원자료');check(q.forward_per>.005&&Number.isInteger(q.count)&&q.count>0,'배수·기관수');['source','annual_source','target_source'].forEach(k=>ref(q[k]));
   const h=c.history;shape(h,['source','metric','period','quality','observations','mean','sd','rule','selected','sample_count','exclusions','rationale']);ref(h.source);['period','quality','exclusions','rationale'].forEach(k=>text(h[k]));check(h.metric==='12MF PER'&&['lower_quartile','mean_minus_sd'].includes(h.rule),'역사 배수 정의');check(Array.isArray(h.observations),'역사 관측');const days=new Set();for(const o of h.observations){shape(o,['date','per']);date(o.date);check(o.date<=q.as_of&&!days.has(o.date)&&positive(o.per),'역사 관측값');days.add(o.date);}
   if(h.rule==='lower_quartile')check(h.observations.length>=8&&h.sample_count===h.observations.length&&h.mean===null&&h.sd===null,'단기 표본');else check(h.observations.length===0&&positive(h.mean)&&positive(h.sd)&&h.mean>h.sd&&h.sample_count===null,'역사 인용 통계');check(positive(h.selected)&&Math.abs(h.selected-selected(h))<1e-9,'선택 배수 재현');
   shape(c.defaults,['safety']);check(finite(c.defaults.safety)&&c.defaults.safety>=0&&c.defaults.safety<1,'여유율');check(Array.isArray(c.scenarios)&&c.scenarios.length===2,'스트레스');c.scenarios.forEach((s,i)=>{shape(s,['id','label','eps','per','reason']);check(s.id===['downside','upside'][i],'스트레스 순서');text(s.label);text(s.reason);check(positive(s.eps)&&positive(s.per)&&s.per<=100,'스트레스 값');});
   check(c.scenarios[0].eps*c.scenarios[0].per<=q.reference_price/q.forward_per*h.selected&&q.reference_price/q.forward_per*h.selected<=c.scenarios[1].eps*c.scenarios[1].per,'시나리오 순서');
  }return d;
 }
 function get(data,id){try{validate(data);return data.companies.find(c=>c.id===id)||null;}catch{return null;}}
 const number=x=>x===null||x===undefined||String(x).trim()===''?NaN:Number(x);
 function inputs(c){return {price:c.quote.value,eps:c.consensus.reference_price/c.consensus.forward_per,per:c.history.selected,safety:c.defaults.safety};}
 function calculate({price,eps,per,safety}){if(!positive(price)||!finite(eps)||Math.abs(eps)>1e9||!positive(per)||per>100||!finite(safety)||safety<0||safety>=1)return null;
  const value=eps>0?eps*per:null,entry=value===null?null:value*(1-safety),requiredEPS=price/per;
  const r={price,eps,per,safety,value,entry,requiredEPS,margin:value===null?null:1-price/value,priceGap:value===null?null:value/price-1};return Object.values(r).every(x=>x===null||finite(x))?r:null;
 }
 function evaluate(data,id,custom={},now=new Date()){
  const c=get(data,id);if(!c)return {state:'missing',label:'기본 평가 자료 확인 필요',company:null,result:null};
  const original=inputs(c),input={...original,...custom},r=calculate(input);if(!r)return {state:'invalid',label:'입력값 확인 필요',company:c,result:null};
  const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(now),age=d=>(Date.parse(day)-Date.parse(d))/86400000;
  const manual=input.price!==c.quote.value,stale=(!manual&&(age(c.quote.date)>4||age(c.quote.date)<0))||age(c.consensus.as_of)>7||age(c.consensus.as_of)<0||data.as_of>day;
  let state,label;if(stale){state='stale';label='자료 갱신 후 가격 판단';}else if(r.value===null){state='loss';label='적자 가정 · PER 평가 불가';}else if(input.price<=r.entry){state='attractive';label='조건부 매력 · 이익 유지 확인';}else if(input.price<=r.value){state='thin';label='가격 여유 부족 · 추가 증거 대기';}else{state='expensive';label='기준 대비 부담 · 이익 상향 필요';}
  return {state,label,company:c,result:r,original,manual,changed:input.eps!==original.eps||input.per!==original.per,consensusEPS:original.eps,epsDifference:input.eps/original.eps-1,marketPE:input.price/original.eps,scenarios:c.scenarios.map(s=>({...s,result:calculate({...input,eps:s.eps,per:s.per})})),reversion:calculate({...input,eps:c.consensus.actual2025,per:c.history.selected})};
 }
 return {validate,get,quantile,selected,number,inputs,calculate,evaluate};
});
