(function(root,factory){
  'use strict';const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;else root.ConsensusAudit=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const finite=x=>typeof x==='number'&&Number.isFinite(x),positive=x=>finite(x)&&x>0;
  const check=(x,m)=>{if(!x)throw Error('컨센서스 감사: '+m);};
  const shape=(o,keys)=>{check(o&&typeof o==='object'&&!Array.isArray(o),'객체 필요');check(Object.keys(o).every(k=>keys.includes(k)),'허용되지 않은 공개 필드');};
  const text=x=>check(typeof x==='string'&&x.trim().length>0,'설명 필요');
  const list=x=>{check(Array.isArray(x)&&x.length>0,'설명 목록');x.forEach(text);};
  function date(x){check(typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString().slice(0,10)===x,'날짜 오류');}
  const tickers={sem:'009150',hynix:'000660',samsung:'005930'};
  function validate(d){
    shape(d,['schema_version','reviewed_on','methodology','sources','companies']);check(d.schema_version===1,'버전');date(d.reviewed_on);text(d.methodology);
    check(Array.isArray(d.sources)&&d.sources.length>0,'출처 필요');const ids=new Set();
    for(const s of d.sources){shape(s,['id','title','url','date','kind','note']);['id','title','note'].forEach(k=>text(s[k]));date(s.date);check(s.date<=d.reviewed_on,'미래 출처');check(['provider','broker'].includes(s.kind),'출처 종류');check(typeof s.url==='string'&&/^https:\/\//.test(s.url),'URL');check(!ids.has(s.id),'중복 출처');ids.add(s.id);}
    const ref=x=>check(ids.has(x),'출처 연결 누락');const seen=new Set();check(Array.isArray(d.companies)&&d.companies.length===3,'국내 3사');
    for(const c of d.companies){
      shape(c,['id','ticker','verdict','summary','findings','next_check','consensus','broker_checks']);check(tickers[c.id]===c.ticker&&!seen.has(c.id),'기업·종목코드');seen.add(c.id);check(c.verdict==='needs_underwriting','감사 판정');text(c.summary);list(c.next_check);
      check(Array.isArray(c.findings)&&c.findings.length>0,'감사 항목');for(const f of c.findings){shape(f,['subject','severity','detail']);check(['high','medium'].includes(f.severity),'중요도');text(f.subject);text(f.detail);}
      const q=c.consensus;shape(q,['provider','as_of','retrieved_on','currency','date_note','quote','forward','target','annual','eps_note','gaps']);check(q.provider==='FnGuide'&&q.currency==='KRW','공급자·통화');date(q.as_of);date(q.retrieved_on);check(q.as_of<=q.retrieved_on&&q.retrieved_on<=d.reviewed_on,'조회일');text(q.date_note);text(q.eps_note);list(q.gaps);
      shape(q.quote,['value','date','source']);check(positive(q.quote.value),'기준 주가');date(q.quote.date);check(q.quote.date===q.as_of,'주가·배수 기준일 불일치');ref(q.quote.source);
      shape(q.forward,['per','decimals','period','as_of','source']);check(positive(q.forward.per)&&q.forward.decimals===2&&q.forward.per>.005,'선행 PER');check(q.forward.period==='NTM','선행 기간');date(q.forward.as_of);check(q.forward.as_of===q.as_of,'선행 배수 기준일 불일치');ref(q.forward.source);
      shape(q.target,['mean','count','count_scope','low','high','horizon_note','source']);check(positive(q.target.mean)&&Number.isInteger(q.target.count)&&q.target.count>0,'목표가·기관수');text(q.target.count_scope);text(q.target.horizon_note);ref(q.target.source);
      check(q.target.low===null&&q.target.high===null||positive(q.target.low)&&positive(q.target.high)&&q.target.low<=q.target.mean&&q.target.mean<=q.target.high,'목표가 범위');
      check(Array.isArray(q.annual)&&q.annual.length===2,'연간 EPS 2개년');const years=new Set();for(const a of q.annual){shape(a,['year','period','eps','revenue','operating','owner','source']);check(Number.isInteger(a.year)&&a.year>=2026&&a.year<=2100&&!years.has(a.year)&&a.period==='FY','연간 기간');years.add(a.year);for(const k of ['eps','revenue','operating','owner'])check(finite(a[k]),'연간 추정 숫자');check(a.revenue>0,'연간 매출');ref(a.source);}
      check(Array.isArray(c.broker_checks),'개별 보고서 목록');for(const b of c.broker_checks){shape(b,['broker','date','target','eps_year','eps','method','applied_multiple','horizon_months','basis','verification','source']);text(b.broker);date(b.date);check(b.date<=d.reviewed_on,'미래 보고서');check(positive(b.target),'보고서 목표가');check(b.eps===null&&b.eps_year===null||finite(b.eps)&&Number.isInteger(b.eps_year),'보고서 EPS');check(b.applied_multiple===null||positive(b.applied_multiple),'보고서 적용 배수');check(b.horizon_months===null||positive(b.horizon_months),'보고서 기간');['method','basis','verification'].forEach(k=>text(b[k]));ref(b.source);}
    }return d;
  }
  function get(data,id){try{validate(data);return data.companies.find(c=>c.id===id)||null;}catch{return null;}}
  // Reconstruct from the provider's own dated price; never use a user's editable price.
  function forwardEPS(q){
    if(!q||q.currency!=='KRW'||q.forward?.period!=='NTM'||q.forward?.decimals!==2||q.quote?.date!==q.as_of||q.forward?.as_of!==q.as_of||!positive(q.quote?.value)||!positive(q.forward?.per)||q.forward.per<=.005)return null;
    const eps=q.quote.value/q.forward.per,low=q.quote.value/(q.forward.per+.005),high=q.quote.value/(q.forward.per-.005);
    return [eps,low,high].every(positive)?{eps,low,high}:null;
  }
  // Two-order average: split the EPS x multiple interaction equally. No causal claim.
  function decompose(e0,m0,e1,target){
    if(![e0,m0,e1,target].every(positive))return null;
    const m1=target/e1,start=e0*m0,earnings=(e1-e0)*(m0+m1)/2,residual=(m1-m0)*(e0+e1)/2,total=target-start;
    const out={e0,m0,e1,m1,start,target,total,earnings,residual,epsGap:e0/e1-1,tieError:earnings+residual-total,crossEPS:e1*m0,crossMultiple:e0*m1};
    return Object.values(out).every(finite)?out:null;
  }
  function compare(data,id,{eps,multiple,now=new Date()}={}){
    const c=get(data,id);if(!c)return {state:'missing',label:'컨센서스 자료 확인 필요',company:null};
    const q=c.consensus,f=forwardEPS(q),day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
    const age=(Date.parse(day)-Date.parse(q.as_of))/86400000;
    if(!Number.isFinite(age)||age>7||age<0||data.reviewed_on>day)return {state:'stale',label:'컨센서스 갱신 후 비교',company:c};
    const bridge=f&&decompose(eps,multiple,f.eps,q.target.mean);
    return {state:bridge?'ready':'unavailable',label:bridge?'기간·분모 차이를 포함한 근사 대조':'양수 EPS·배수에서만 가격 차이 분해',company:c,forward:f,bridge};
  }
  return {validate,get,forwardEPS,decompose,compare};
});
