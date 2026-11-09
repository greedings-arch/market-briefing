'use strict';
// KRW trillion for money, million shares for the equity bridge. No network or state.
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.DCFModel=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const DAY=86400000;
  const fields={
    salesScale:{label:'2027–28 매출 / 컨센서스',min:.5,max:1.3,step:.01,percent:true},
    marginShift:{label:'2027–28 영업마진 조정',min:-.3,max:.1,step:.005,percent:true,pp:true},
    postGrowth:{label:'2029–36 연간 매출 성장률',min:-.15,max:.15,step:.005,percent:true},
    terminalMargin:{label:'2036년 정상화 영업마진',min:0,max:.8,step:.005,percent:true},
    capex:{label:'2026–28 CAPEX / 매출',min:0,max:.4,step:.005,percent:true},
    wacc:{label:'가중평균자본비용 WACC',min:.05,max:.2,step:.0001,percent:true},
    steadyCapex:{label:'2036년 CAPEX / 매출',min:0,max:.3,step:.005,percent:true},
    da:{label:'감가상각 / 매출',min:0,max:.3,step:.005,percent:true},
    nwc:{label:'영업운전자본 / 매출',min:0,max:.4,step:.01,percent:true},
    tax:{label:'영업이익 현금세율',min:0,max:.4,step:.005,percent:true},
    g:{label:'2037년 이후 영구성장률',min:0,max:.04,step:.0025,percent:true},
    roic:{label:'영구기간 재투자수익률 ROIC',min:.05,max:.4,step:.005,percent:true},
    cashAdjustment:{label:'순현금·비영업가치 추가 조정 (조원)',min:-500,max:500,step:.1,percent:false},
    shareAdjustment:{label:'추가 희석 주식수 (백만 주)',min:0,max:1000,step:1,percent:false}
  };
  function ok(v,m){if(!v)throw Error('DCF: '+m);}
  function object(v,keys,p){ok(v&&typeof v==='object'&&!Array.isArray(v),p);ok(Object.keys(v).every(k=>keys.includes(k)),p+'에 허용하지 않은 필드');ok(keys.every(k=>Object.hasOwn(v,k)),p+' 필드 누락');}
  function str(v,p){ok(typeof v==='string'&&v.trim().length>0&&v.length<4000,p+' 문자열');}
  function num(v,min,max,p){ok(typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max,p+' 숫자 범위');}
  function date(v){return typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;}
  function today(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
  function inputs(a){object(a,Object.keys(fields),'가정');for(const[k,f]of Object.entries(fields))num(a[k],f.min,f.max,k);ok(a.wacc>a.g+.005,'WACC는 영구성장률보다 0.5%p 초과해야 합니다');ok(a.roic>a.g,'ROIC는 영구성장률보다 커야 합니다');return a;}
  function validate(d,now=today()){
    object(d,['schema_version','as_of','valuation_date','currency','unit','status','method','sources','companies'],'자료');
    ok(d.schema_version===1&&d.currency==='KRW'&&d.unit==='KRW_trillion_million_shares'&&d.status==='screen-grade','스키마·단위·검토 수준');
    ok(date(d.as_of)&&date(d.valuation_date)&&d.valuation_date<=d.as_of&&d.as_of<=now&&d.valuation_date.startsWith('2026-'),'기준일');str(d.method,'방법');
    ok(Array.isArray(d.sources)&&d.sources.length>0,'출처');const ids=new Set();
    for(const s of d.sources){object(s,['id','title','url','date','kind','note'],'출처');for(const k of ['id','title','url','note'])str(s[k],k);ok(!ids.has(s.id),'출처 중복');ids.add(s.id);ok(date(s.date)&&s.date<=d.as_of,'출처 날짜');ok(['consensus','reported','broker','market','method'].includes(s.kind),'출처 종류');const u=new URL(s.url);ok(u.protocol==='https:'&&!u.username&&!u.password,'출처 URL');}
    const ref=s=>ok(ids.has(s),'없는 출처 '+s);
    ok(Array.isArray(d.companies)&&d.companies.length===3,'기업수');const cs=new Set();
    for(const c of d.companies){
      object(c,['id','name','ticker','quote','consensus','capital','base','cases','rationale','risks','limits'],'기업');
      ok(['samsung','hynix','sem'].includes(c.id)&&!cs.has(c.id),'기업 식별자');cs.add(c.id);str(c.name,'회사명');ok(/^\d{6}$/.test(c.ticker),'종목코드');
      object(c.quote,['price','date','source'],'주가');num(c.quote.price,1,1e8,'주가');ok(date(c.quote.date)&&c.quote.date<=d.as_of,'주가 날짜');ref(c.quote.source);
      const q=c.consensus;object(q,['as_of','source','rows','target_mean','target_count'],'컨센서스');ok(date(q.as_of)&&q.as_of<=d.as_of,'컨센서스 날짜');ref(q.source);num(q.target_mean,1,1e8,'목표가 평균');num(q.target_count,1,100,'목표가 기관수');ok(Number.isInteger(q.target_count),'기관수 정수');
      ok(Array.isArray(q.rows)&&q.rows.length===4,'연간 기준선');q.rows.forEach((r,i)=>{object(r,['year','revenue','operating_profit','basis'],'연간');ok(r.year===2025+i&&r.basis===(i===0?'reported':'consensus'),'연간 기간/종류');num(r.revenue,.01,1e5,'매출');num(r.operating_profit,-r.revenue,r.revenue,'영업이익');});
      const b=c.capital;object(b,['date','cash','debt','minority','nonoperating','common_shares','preferred_shares','source','notes'],'자본');ok(date(b.date)&&b.date<=d.valuation_date,'재무 기준일');for(const k of ['cash','debt','minority','nonoperating'])num(b[k],0,1e5,k);num(b.common_shares,1,1e5,'보통주');num(b.preferred_shares,0,1e5,'우선주');ok(Array.isArray(b.source)&&b.source.length>0,'자본 출처');b.source.forEach(ref);str(b.notes,'자본 설명');inputs(c.base);
      ok(Array.isArray(c.cases)&&c.cases.length===3,'시나리오');c.cases.forEach((s,i)=>{object(s,['id','label','reason','inputs'],'시나리오');ok(s.id===['bear','base','bull'][i],'시나리오 순서');str(s.label,'시나리오 이름');str(s.reason,'시나리오 근거');inputs(s.inputs);});ok(JSON.stringify(c.cases[1].inputs)===JSON.stringify(c.base),'기준 시나리오 불일치');
      object(c.rationale,['near','normal','investment','discount','terminal'],'가정 근거');Object.values(c.rationale).forEach(v=>str(v,'가정 근거'));
      ok(Array.isArray(c.risks)&&c.risks.length>0,'논쟁');for(const r of c.risks){object(r,['title','fact','model','watch','source'],'논쟁');for(const k of ['title','fact','model','watch'])str(r[k],k);ref(r.source);}
      ok(Array.isArray(c.limits)&&c.limits.length>0,'한계');c.limits.forEach(v=>str(v,'한계'));
    }return d;
  }
  function calculate(c,a=c.base,valuationDate='2026-11-06'){
    inputs(a);ok(date(valuationDate)&&valuationDate.startsWith('2026-'),'평가일');
    const rows=[],q=c.consensus.rows,actual=q[0],anchor=q[1],yearEnd=Date.parse('2026-12-31'),stub=(yearEnd-Date.parse(valuationDate))/DAY/365;
    ok(stub>=0&&stub<=1,'잔여기간');
    function row(year,revenue,margin,capexRatio,previousRevenue,fraction,years,basis){
      const ebit=revenue*margin*fraction,tax=Math.max(0,ebit)*a.tax,nopat=ebit-tax,da=revenue*a.da*fraction,capex=revenue*capexRatio*fraction,deltaNwc=(revenue-previousRevenue)*a.nwc*fraction;
      const fcff=nopat+da-capex-deltaNwc,pv=fcff/(1+a.wacc)**years;
      const r={year,basis,revenue:revenue*fraction,margin,ebit,tax,nopat,da,capex,deltaNwc,fcff,years,pv};rows.push(r);return r;
    }
    // Remaining calendar 2026 only: annual run-rate proration, explicitly a stub proxy.
    row(2026,anchor.revenue,anchor.operating_profit/anchor.revenue,a.capex,actual.revenue,stub,stub,'stub');
    let previous=anchor.revenue,nearMargin=q[3].operating_profit/q[3].revenue+a.marginShift;
    for(let y=2027;y<=2036;y++){
      const t=(y-2028)/8,r=q.find(x=>x.year===y),revenue=r?r.revenue*a.salesScale:previous*(1+a.postGrowth);
      const margin=r?r.operating_profit/r.revenue+a.marginShift:nearMargin+(a.terminalMargin-nearMargin)*t;
      const capexRatio=y<=2028?a.capex:a.capex+(a.steadyCapex-a.capex)*t;
      row(y,revenue,margin,capexRatio,previous,1,stub+y-2026,y<=2028?'consensus_adjusted':'assumption');previous=revenue;
    }
    const last=rows.at(-1),terminalRevenue=last.revenue*(1+a.g),terminalNopat=terminalRevenue*a.terminalMargin*(1-a.tax),reinvestment=terminalNopat*a.g/a.roic,terminalFcf=terminalNopat-reinvestment;
    const terminalValue=terminalFcf/(a.wacc-a.g),terminalPV=terminalValue/(1+a.wacc)**last.years,explicitPV=rows.reduce((s,r)=>s+r.pv,0),enterprise=explicitPV+terminalPV;
    const b=c.capital,bridge=b.cash-b.debt-b.minority+b.nonoperating+a.cashAdjustment,equity=enterprise+bridge,shares=b.common_shares+b.preferred_shares+a.shareAdjustment,value=equity*1e6/shares;
    const result={rows,stub,terminalRevenue,terminalNopat,reinvestment,terminalFcf,terminalValue,terminalPV,explicitPV,enterprise,bridge,equity,shares,value,terminalWeight:enterprise>0?terminalPV/enterprise:null};
    ok(Object.values(result).filter(v=>typeof v==='number').every(Number.isFinite),'계산 결과가 유한하지 않습니다');return result;
  }
  function freshness(d,c,now=today()){
    const age=s=>(Date.parse(now)-Date.parse(s))/DAY;
    const reasons=[];if(age(c.quote.date)>4||age(c.quote.date)<0)reasons.push('관측 주가 4일 기한 경과 또는 미래 날짜');if(age(c.consensus.as_of)>7||age(c.consensus.as_of)<0)reasons.push('컨센서스 7일 기한 경과 또는 미래 날짜');if(age(c.capital.date)>150||age(c.capital.date)<0)reasons.push('재무 기준일 갱신 필요');if(age(d.as_of)<0)reasons.push('미래 검토일');return {fresh:!reasons.length,reasons};
  }
  function reverseMargin(c,a,price,valuationDate){
    num(price,1,1e8,'비교 주가');let lo=0,hi=.8;
    const at=x=>calculate(c,{...a,terminalMargin:x},valuationDate).value;
    if(price<at(lo))return {value:null,reason:'정상화 마진 0%에서도 계산가가 관측 주가보다 높습니다. 단기 이익·설비투자 등 다른 가정의 변화가 필요합니다.'};
    if(price>at(hi))return {value:null,reason:'정상화 마진 80% 안에서 주가를 설명할 수 없습니다. 다른 가정도 달라져야 합니다.'};
    for(let i=0;i<60;i++){const mid=(lo+hi)/2;if(at(mid)<price)lo=mid;else hi=mid;}return {value:(lo+hi)/2,reason:'나머지 가정을 고정한 조건부 역산입니다. 시장 전체의 실제 기대를 관측한 값이 아닙니다.'};
  }
  function sensitivity(c,a,date){const ws=[-.02,-.01,0,.01,.02].map(x=>a.wacc+x),gs=[-.01,-.005,0,.005,.01].map(x=>a.g+x);return {wacc:ws,g:gs,cells:ws.map(wacc=>gs.map(g=>{try{return calculate(c,{...a,wacc,g},date).value;}catch{return null;}}))};}
  return {fields,inputs,validate,calculate,freshness,reverseMargin,sensitivity,today};
});
