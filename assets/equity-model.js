(function(root,factory){
  'use strict'; const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;else root.EquityModel=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const finite=x=>typeof x==='number'&&Number.isFinite(x);
  const number=x=>x===null||x===undefined||String(x).trim()===''?NaN:Number(x);
  const check=(v,message)=>{if(!v)throw Error('EPS 모델: '+message);};
  const shape=(o,keys)=>{check(o&&typeof o==='object'&&!Array.isArray(o),'객체 필요');check(Object.keys(o).every(k=>keys.includes(k)),'허용되지 않은 공개 필드');};
  const text=x=>check(typeof x==='string'&&x.trim().length>0,'설명 누락');
  function date(x){check(typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&new Date(x).toISOString().slice(0,10)===x,'날짜 오류');}
  function inputs(x){
    shape(x,['growth','margin','nonoperating','tax','owner_ratio','dilution','multiple']);
    for(const k of ['growth','margin','nonoperating','tax','owner_ratio','dilution','multiple'])check(finite(x[k]),k+' 숫자 필요');
    check(x.growth>-1&&x.growth<=3,'매출 변화율 범위');check(x.margin>=-1&&x.margin<=1,'마진 범위');
    check(Math.abs(x.nonoperating)<=1000,'영업외손익 범위');check(x.tax>=0&&x.tax<1,'세율 범위');
    check(x.owner_ratio>0&&x.owner_ratio<=1,'지배주주 귀속비율 범위');check(x.dilution>-.9&&x.dilution<=1,'주식수 변화 범위');check(x.multiple>0&&x.multiple<=100,'배수 범위');
    return x;
  }
  function validate(d){
    shape(d,['schema_version','as_of','horizon','unit','methodology','sources','companies']);check(d.schema_version===1,'버전');date(d.as_of);check(d.horizon===1&&d.unit==='KRW trillion','기간·단위');text(d.methodology);
    check(Array.isArray(d.sources)&&d.sources.length>0,'출처 필요');const ids=new Set();
    for(const s of d.sources){shape(s,['id','title','url','date','kind','note']);for(const k of ['id','title','url','note'])text(s[k]);date(s.date);check(s.date<=d.as_of,'미래 출처');check(['primary','market'].includes(s.kind),'출처 종류');check(/^https:\/\//.test(s.url),'출처 URL');check(!ids.has(s.id),'중복 출처');ids.add(s.id);}
    const ref=x=>check(ids.has(x),'출처 연결 누락');const list=x=>{check(Array.isArray(x)&&x.length>0,'설명 목록');x.forEach(text);};
    check(Array.isArray(d.companies)&&d.companies.length===3,'국내 3사 필요');const companyIds=new Set();
    for(const c of d.companies){
      shape(c,['id','name','ticker','quote','reported','eps_basis','defaults','scenarios','assumptions','drivers','limitations','next_check']);
      check(['sem','hynix','samsung'].includes(c.id)&&!companyIds.has(c.id),'기업');companyIds.add(c.id);text(c.name);check(/^\d{6}$/.test(c.ticker),'종목 코드');
      shape(c.quote,['value','date','time','session','source','note']);check(finite(c.quote.value)&&c.quote.value>0,'주가');date(c.quote.date);check(c.quote.date<=d.as_of,'미래 주가');['time','session','note'].forEach(k=>text(c.quote[k]));ref(c.quote.source);
      const r=c.reported;shape(r,['period','end','published','revenue','operating_profit','pretax','net_income','owner_income','source','note']);['period','note'].forEach(k=>text(r[k]));date(r.end);date(r.published);check(r.end<=r.published&&r.published<=d.as_of,'실적 날짜');ref(r.source);for(const k of ['revenue','operating_profit','pretax','net_income','owner_income'])check(finite(r[k]),'실적 '+k);check(r.revenue>0,'기준 실적');
      const b=c.eps_basis;shape(b,['method','eps','owner_income','shares_million','period','date','source','note']);check(['reported_bridge','shares'].includes(b.method),'EPS 방법');['period','note'].forEach(k=>text(b[k]));date(b.date);check(b.date<=d.as_of,'EPS 기준 날짜');ref(b.source);
      if(b.method==='reported_bridge')check(finite(b.eps)&&b.eps>0&&finite(b.owner_income)&&b.owner_income>0&&b.shares_million===null,'보고 EPS 연결');
      else check(finite(b.shares_million)&&b.shares_million>0&&b.eps===null&&b.owner_income===null,'주식수 방식');
      shape(c.defaults,['hurdle','safety']);check(finite(c.defaults.hurdle)&&c.defaults.hurdle>=0&&c.defaults.hurdle<=1&&finite(c.defaults.safety)&&c.defaults.safety>=0&&c.defaults.safety<1,'할인·안전마진');
      check(Array.isArray(c.scenarios)&&c.scenarios.length===3,'세 시나리오');c.scenarios.forEach((s,i)=>{shape(s,['id','label','reason','inputs']);check(s.id===['bear','base','bull'][i],'시나리오 순서');text(s.label);text(s.reason);inputs(s.inputs);});
      shape(c.assumptions,['growth','margin','nonoperating','tax','owner_ratio','dilution','multiple']);Object.values(c.assumptions).forEach(text);check(Object.keys(c.assumptions).length===7,'가정 근거');list(c.drivers);list(c.limitations);text(c.next_check);
      const results=c.scenarios.map(s=>calculate(c,s.inputs,c.quote.value,c.defaults));check(results.every(x=>x),'초기 시나리오');const ordered=results.map(x=>x.present??-Infinity);check(ordered[0]<=ordered[1]&&ordered[1]<=ordered[2],'초기 시나리오 가격 순서');
    }return d;
  }
  function epsPerTrillion(c){return c.eps_basis.method==='reported_bridge'?c.eps_basis.eps/c.eps_basis.owner_income:1e6/c.eps_basis.shares_million;}
  function calculate(c,assumptions,price=c.quote.value,options=c.defaults){
    try{inputs(assumptions);}catch{return null;}
    const a=assumptions,{hurdle,safety}=options;
    if(!finite(price)||price<=0||!finite(hurdle)||hurdle<0||hurdle>1||!finite(safety)||safety<0||safety>=1)return null;
    const revenue=c.reported.revenue*4*(1+a.growth),operating=revenue*a.margin,pretax=operating+a.nonoperating;
    const tax=Math.max(0,pretax)*a.tax,net=pretax-tax,owner=net*a.owner_ratio,conversion=epsPerTrillion(c)/(1+a.dilution),eps=owner*conversion;
    const target=eps>0?eps*a.multiple:null,present=target===null?null:target/(1+hurdle),entry=present===null?null:present*(1-safety);
    const requiredEPS=price*(1+hurdle)/a.multiple,requiredOwner=requiredEPS/conversion;
    const requiredMargin=(requiredOwner/a.owner_ratio/(1-a.tax)-a.nonoperating)/revenue;
    const result={revenue,operating,pretax,tax,net,owner,eps,target,present,entry,requiredEPS,requiredMargin,return:target===null?null:target/price-1,marginOfSafety:present===null?null:1-price/present,pe:eps>0?price/eps:null};
    return Object.values(result).every(x=>x===null||finite(x))?result:null;
  }
  const age=(date,now)=>{const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);return (Date.parse(day)-Date.parse(date))/86400000;};
  function evaluate(c,{price=c.quote.value,inputs:custom=null,hurdle=c.defaults.hurdle,safety=c.defaults.safety,manualPrice=false,now=new Date()}={}){
    const results=c.scenarios.map(s=>({...s,result:calculate(c,s.id==='base'&&custom?custom:s.inputs,price,{hurdle,safety})}));
    const base=results[1].result,bear=results[0].result,bull=results[2].result;
    let state='invalid',label='입력값 확인 필요';
    if(results.every(x=>x.result)){
      if(!manualPrice&&(age(c.quote.date,now)>4||age(c.quote.date,now)<0)){state='stale';label='주가 갱신 후 판단';}
      else if(age(c.reported.end,now)>150||age(c.reported.end,now)<0||age(c.reported.published,now)<0||age(c.eps_basis.date,now)>240||age(c.eps_basis.date,now)<0){state='stale';label='실적·EPS 기준 갱신 필요';}
      else if(base.present===null){state='loss';label='적자 가정 · P/E 평가 불가';}
      else if(price<=base.entry){state='attractive';label='기준 가정에서 안전마진 확보';}
      else if(price<=base.present){state='thin';label='기준 가정 내 · 안전마진 부족';}
      else if(bull.present!==null&&price<=bull.present){state='optimistic';label='낙관 가정이 필요한 가격';}
      else{state='expensive';label='낙관 가정도 웃도는 가격';}
    }
    return {state,label,results,base,bear,bull,price,hurdle,safety,manualPrice,conditional:state!=='invalid'&&state!=='stale'};
  }
  function get(data,id){try{validate(data);return data.companies.find(c=>c.id===id)||null;}catch{return null;}}
  return {validate,inputs,number,calculate,evaluate,get,epsPerTrillion};
});
