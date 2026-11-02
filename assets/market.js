'use strict';
(() => {
  const $=s=>document.querySelector(s),esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const list=x=>Array.isArray(x)?x:[],fmt=(x,d=2)=>Number.isFinite(x)?x.toLocaleString('ko-KR',{maximumFractionDigits:d}):'—';
  const cache=new Map(),filters={},palette=['#224d72','#b38346','#528874','#b46e59','#89749c','#597f8a'];
  let config,status,active='summary',generation=0;
  function url(value,label='원문 ↗') {try{const u=new URL(value);if(!['http:','https:'].includes(u.protocol))return esc(label);return `<a href="${esc(u.href)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`;}catch{return esc(label);}}
  const href=(tab,id,extra={})=>'#'+tab+(id||Object.keys(extra).length?'?'+new URLSearchParams({...extra,...(id?{id}:{})}).toString():'');
  const anchor=(tab,id,label)=>`<a href="${esc(href(tab,id))}">${esc(label)}</a>`;
  const badge=x=>`<span class="tag ${x==='낙관'?'positive':x==='경계'?'negative':x==='확인 필요'?'pending':''}">${esc(x)}</span>`;
  const source=x=>`<p class="source">${esc(x.source_name||x.company||x.institution||'원문')} · ${esc(x.source_date||'원문 날짜 미확인')} · ${url(x.source_url)}</p>`;
  const empty=(title='아직 수집된 자료가 없습니다',body='원문을 확인한 자료가 반영되면 이곳에 표시됩니다.')=>`<div class="empty"><div class="empty-mark">—</div><strong>${esc(title)}</strong><p>${esc(body)}</p><a href="#sources">수집 범위와 운영 상태 확인 →</a></div>`;
  function select(key,label,values,value='전체') {return `<label>${esc(label)} <select data-filter="${key}" aria-label="${esc(label)}">${values.map(v=>`<option value="${esc(v)}" ${v===value?'selected':''}>${esc(v)}</option>`).join('')}</select></label>`;}
  function route() {const raw=location.hash.slice(1),[name,q='']=raw.split('?');return {tab:config?.tabs.some(t=>t.id===name)?name:'summary',params:new URLSearchParams(q)};}
  async function json(name) {if(!cache.has(name))cache.set(name,fetch('data/'+name+'.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('자료 응답 오류');return r.json();}).catch(e=>{cache.delete(name);throw e;}));return cache.get(name);}
  function title(tab,data,description='') {const t=config.tabs.find(x=>x.id===tab),meta=data.meta||status.tabs[tab];return `<header class="page-title"><div><p class="eyebrow">AI & CLOUD / ${esc(tab.replace(/-/g,' '))}</p><h1>${esc(t.label)}${t.prompt!==null?`<span class="prompt">프롬프트 ${t.prompt}</span>`:''}</h1>${description?`<p class="subtitle">${esc(description)}</p>`:''}</div><div class="stamp"><span>기준일 ${esc(meta?.as_of||'수집 전')}</span><span>${fmt(meta?.count||0,0)}건</span><span>생성 ${esc(meta?.generated_at||'아직 없음')}</span></div></header>`;}
  function globalWarning() {
    const messages=[];
    if(!status.latest_daily||status.latest_daily<status.expected_daily)messages.push(`최신 일간 회차 ${status.latest_daily||'없음'} · 예정 기준 ${status.expected_daily}. 갱신이 늦었습니다.`);
    if(status.last_run&&status.last_run.status!=='success')messages.push(`마지막 실행에 문제가 있습니다 (${status.last_run.status==='failed'?'실패':status.last_run.status==='partial'?'일부 미완료':'보류'}).`);
    if(!status.automation_enabled)messages.push('새 탭의 예약 수집은 연결 전입니다. 기존 일정은 소스·방법론에서 확인하실 수 있습니다.');
    $('#global-warning').hidden=!messages.length;$('#global-warning').innerHTML=messages.map(esc).join(' ')+' <a href="#sources">실행 기록 보기 →</a>';
  }
  function navigation() {$('#tabs').innerHTML=config.tabs.map(t=>`<a href="#${esc(t.id)}" ${t.id===active?'class="active" aria-current="page"':''}>${esc(t.label)}</a>`).join('');}
  function article(r) {return `<article class="story" tabindex="-1" data-item="${esc(r.id)}"><div class="meta">${badge(r.category)}<span>중요도 ${esc(r.importance)}/5</span><span>원문 ${esc(r.source_date)}</span>${r.date&&r.date!==r.source_date?`<span>회차 ${esc(r.date)}</span>`:""}${r.followup?badge('후속'):''}${r.paywall?badge('유료'):''}${!r.verified?badge('확인 필요'):''}${r.legacy?badge('기존 회차'):''}</div><h2>${url(r.source_url,r.title)}</h2>${list(r.summary).map(x=>`<p>${esc(x)}</p>`).join('')}<div class="impact"><strong>${r.legacy?'당시 사업 시사점':'업계 의미'}</strong>${esc(r.impact)}</div>${r.investment_impact?`<div class="impact investment"><strong>투자에 주는 의미 · 편집 해석</strong>${esc(r.investment_impact)}</div>`:r.legacy?'<p class="note">기존 사업 브리핑입니다. 투자 관점으로 재검토한 원고는 아닙니다.</p>':''}${source(r)}${r.verification_basis?`<p class="note">${esc(r.verification_basis)}</p>`:''}<a class="source" href="${esc(href('news',r.id))}">이 기사 주소</a></article>`;}
  function renderNews(data,params) {
    const f=filters.news||={},target=data.items.find(x=>x.id===params.get('id'));
    if(target){f.category='전체';f.date=target.date||'전체';}
    const categories=['전체',...new Set(data.items.map(x=>x.category))],dates=['전체',...new Set(data.items.map(x=>x.date||x.source_date).sort().reverse())];
    const items=data.items.filter(x=>(!f.category||f.category==='전체'||x.category===f.category)&&(!f.date||f.date==='전체'||(x.date||x.source_date)===f.date)).sort((a,b)=>(b.date||b.source_date).localeCompare(a.date||a.source_date)||(b.importance||0)-(a.importance||0));
    return title('news',data,'결론과 사실, 업계 의미와 투자 해석을 나누어 읽습니다.')+`<div class="filters">${select('category','분류',categories,f.category)}${select('date','회차',dates,f.date)}</div>`+(items.length?items.map(article).join(''):empty('선택한 조건의 기사가 없습니다'));
  }
  function renderSummary(data) {
    let main=title('summary',data,'오늘 바뀐 것부터, 영향이 큰 순서로 읽습니다.');
    if(data.cards.length)main+=`<div class="stats">${data.cards.map(x=>`<a class="stat-card" href="${esc(href(x.tab,x.id))}"><span>${esc(x.label)}</span><b>${fmt(x.value)}</b><small>${esc(x.unit)} · ${esc(x.date)}${Number.isFinite(x.change)?` · 직전 관측 대비 ${fmt(x.change)}%`:''}</small></a>`).join('')}</div>`;
    main+='<div class="grid"><div>';
    main+=data.oneliner?`<section class="lead"><p class="eyebrow">TODAY'S TAKEAWAY</p><h2>${esc(data.oneliner)}</h2>${list(data.messages).length?`<ol>${data.messages.map((x,i)=>`<li>${data.message_sources?.[i]?anchor("news",data.message_sources[i],x):esc(x)}</li>`).join("")}</ol>`:""}${data.coverage_note?`<p class="note">${esc(data.coverage_note)}</p>`:""}</section>`:empty('오늘 회차를 기다리고 있습니다',`예정 기준일 ${status.expected_daily}. 마지막으로 발행한 일간 회차는 ${status.latest_daily||'아직 없습니다'}. 새로운 자료를 확인하기 전에는 오늘 소식으로 표시하지 않습니다.`);
    main+=`<section class="panel" style="margin-top:18px"><div class="panel-head"><h2>이번 수집의 주요 소식</h2><span class="note">최대 8건</span></div>${data.highlights.length?`<ol class="ranked">${data.highlights.map((x,i)=>`<li><span class="rank">${String(i+1).padStart(2,'0')}</span><div><div class="meta">${esc(config.tabs.find(t=>t.id===x.tab)?.label)} · 새 반영 ${esc(x.date)}${x.source_date&&x.source_date!==x.date?` · 원문 ${esc(x.source_date)}`:""}</div>${anchor(x.tab,x.id,x.title)}</div></li>`).join('')}</ol>`:'<p class="note">아직 오늘 확인한 주요 소식이 없습니다.</p>'}</section></div><aside>`;
    if(data.week)main+=`<section class="panel"><p class="eyebrow">WEEKLY VIEW</p><h3>최신 주간 한 줄</h3><p>${anchor('weekly',data.week.id,data.week.title)}</p><span class="note">${esc(data.week.date)}</span></section>`;
    if(data.latest_report)main+=`<section class="panel"><p class="eyebrow">DEEP READ</p><h3>${anchor('reports',data.latest_report.id,data.latest_report.title)}</h3></section>`;
    if(data.finance.length)main+=`<section class="panel"><h3>이번 주 금융권</h3>${data.finance.slice(0,2).map(x=>`<p>${badge(x.stance)} ${anchor('finance',x.id,x.title)}</p>`).join('')}</section>`;
    if(data.interview)main+=`<section class="panel"><p class="eyebrow">LEADERS</p><h3>${anchor('interviews',data.interview.id,data.interview.headline||data.interview.title)}</h3><p class="note">${esc(data.interview.source_date)}</p></section>`;
    for(const [key,tab,label]of [['temperature','temperature','시장 온도'],['ai_state','ai-state','AI 현주소']])if(data[key])main+=`<section class="panel"><h3>${esc(label)}</h3>${anchor(tab,data[key].id,data[key].title)}</section>`;
    if(data.watch.length)main+=`<section class="panel"><h3>최근 주간 관전 포인트</h3>${data.watch.map(x=>`<p class="note">${esc(x.date)} · ${esc(x.text)}</p>`).join('')}</section>`;
    return main+'</aside></div>';
  }
  function weekID(date) {const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+4-(d.getUTCDay()||7));const y=d.getUTCFullYear();return y+'-W'+String(Math.ceil((((d-new Date(Date.UTC(y,0,1)))/86400000)+1)/7)).padStart(2,'0');}
  function viewCard(x) {return `<article class="view-card" tabindex="-1" data-item="${esc(x.id)}"><div class="meta"><strong>${esc(x.institution)}</strong><span>${esc(x.source_date)}</span>${badge(x.stance)}${!x.verified?badge('확인 필요'):''}</div><h3>${url(x.source_url,x.title)}</h3><p>${esc(x.claim)}</p><p class="note">${esc(x.speaker)} · ${esc(x.affiliation)}</p><p class="self-interest">이해관계: ${esc(x.self_interest)}</p>${x.investment_impact?`<p><b>투자에 주는 의미</b> · ${esc(x.investment_impact)}</p>`:''}${source(x)}${x.legacy?'<span class="note">기존 회차 · 추가 확인 항목은 미확인으로 남겼습니다.</span>':''}</article>`;}
  function renderFinance(data,params) {
    const f=filters.finance||={};if(params.get('id')){f.stance='전체';f.topic='전체';f.institution='전체';f.week='전체';}
    const weeks=[...new Set(data.items.map(x=>weekID(x.source_date)))].sort().reverse();
    const items=data.items.filter(x=>(!f.stance||f.stance==='전체'||x.stance===f.stance)&&(!f.topic||f.topic==='전체'||x.topic===f.topic)&&(!f.institution||f.institution==='전체'||x.institution===f.institution)&&(!f.week||f.week==='전체'||weekID(x.source_date)===f.week));
    const weeklies=data.weeklies.filter(w=>w.threads.length).slice(-1);
    let html=title('finance',data,'조달·신용·수익성·수요에 대한 기관의 입장과 이해관계를 함께 읽습니다.');
    if(weeklies.length)html+=`<section class="panel"><p class="eyebrow">LATEST WEEKLY</p><h3>${anchor('weekly',weeklies[0].id,'최신 주간 금융권 흐름')}</h3>${weeklies[0].threads.map(x=>`<p>${esc(x.summary)}</p>`).join('')}</section>`;
    html+=`<div class="filters">${select('stance','입장',['전체','낙관','경계','중립'],f.stance)}${select('topic','쟁점',['전체',...config.finance.topics],f.topic)}${select('institution','기관',['전체',...new Set(data.items.map(x=>x.institution))],f.institution)}${select('week','주차',['전체',...weeks],f.week)}</div><div class="grid"><div>`;
    if(!items.length)html+=empty('선택한 조건의 의견이 없습니다');
    for(const topic of config.finance.topics){const opinions=items.filter(x=>x.topic===topic);if(!opinions.length)continue;html+=`<section class="finance-topic"><h2>${esc(topic)}</h2><div class="two-cols">${['낙관','경계'].map(stance=>`<div><p class="stance-title ${stance==='경계'?'negative':''}"><span class="dot"></span>${stance} 쪽</p>${opinions.filter(x=>x.stance===stance).map(viewCard).join('')||'<p class="quiet">확인된 의견이 없습니다.</p>'}</div>`).join('')}</div>${opinions.filter(x=>x.stance==='중립').map(viewCard).join('')}</section>`;}
    html+='</div><aside><section class="panel"><h3>주별 낙관·경계 비율</h3>';
    for(const week of weeks){const xs=items.filter(x=>weekID(x.source_date)===week),a=xs.filter(x=>x.stance==='낙관').length,b=xs.filter(x=>x.stance==='경계').length;if(!xs.length)continue;html+=`<p class="ratio-label">${esc(week)}</p><div class="ratio" aria-label="낙관 ${a}건, 경계 ${b}건"><i class="optimistic" style="width:${a+b?a/(a+b)*100:0}%"></i><i class="cautious" style="width:${a+b?b/(a+b)*100:0}%"></i></div><p class="ratio-label">낙관 ${a} · 경계 ${b} · 중립 ${xs.length-a-b}</p>`;}
    const institutions={};items.forEach(x=>institutions[x.institution]=(institutions[x.institution]||0)+1);
    return html+'</section><section class="panel"><h3>자주 나온 기관</h3>'+Object.entries(institutions).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([name,n])=>`<p class="note">${esc(name)} <strong>${n}건</strong></p>`).join('')+'</section></aside></div>';
  }
  function renderReports(data) {
    const f=filters.reports||={},items=data.items.filter(x=>(!f.sector||f.sector==='전체'||x.sector===f.sector)&&(!f.company||f.company==='전체'||x.company===f.company)&&(!f.format||f.format==='전체'||x.format===f.format)).sort((a,b)=>b.source_date.localeCompare(a.source_date));
    let html=title('reports',data,'실적과 인터뷰를 긴 호흡으로 읽고, 배경·핵심 근거·투자 판단을 연결합니다.');
    if(data.queue.length)html+=`<details class="queue" open><summary>전사본·작성 재시도 대기 ${data.queue.length}건</summary><ul>${data.queue.map(x=>`<li><b>${esc(x.company)}</b> · ${esc(x.reason)} · 다음 확인 ${esc(x.next_attempt)}${x.status==='expired'?' · 기한 경과':''}</li>`).join('')}</ul></details>`;
    html+=`<div class="filters">${select('sector','섹터',['전체',...config.reports.sectors],f.sector)}${select('company','기업',['전체',...new Set(data.items.map(x=>x.company))],f.company)}${select('format','형식',['전체',...config.reports.formats],f.format)}</div><div class="grid"><div>`;
    if(!items.length)html+=empty('아직 작성된 심층 리포트가 없습니다','직전 분기 빅테크 어닝콜을 우선 확인합니다. 전사본 근거가 절반 미만인 자료는 발행하지 않습니다.');
    let month='';for(const r of items){if(month!==r.source_date.slice(0,7)){month=r.source_date.slice(0,7);html+=`<h2 class="month-title">${esc(month.replace('-','년 '))}월</h2>`;}html+=`<article class="report-card" data-item="${esc(r.id)}"><div class="meta">${badge(r.format)}<span>${esc(r.company)} · ${esc(r.sector)}</span><span>${esc(r.source_date)}</span></div><h2>${anchor('reports',r.id,r.title)}</h2><p>${esc(r.overview)}</p><p class="note">원문 근거 ${fmt(r.coverage*100,0)}% · ${esc(r.basis)}</p>${source(r)}<a class="source" href="${esc(href('reports',r.id))}">본문 열기 →</a></article>`;}
    const counts={};for(const r of data.items)counts[r.company]=(counts[r.company]||0)+1;
    return html+'</div><aside><section class="panel"><h3>기업별 리포트</h3>'+Object.entries(counts).map(([key,n])=>`<p class="note">${esc(key)} <b>${n}편</b></p>`).join('')+(data.items.length?'':'<p class="note">첫 리포트 작성 후 표시됩니다.</p>')+'</section><section class="panel"><h3>리포트 구성</h3><p class="note"><b>실적형</b> · 실적·가이던스 → 사업 이해 → 콜의 핵심 → 긍정·부정 요인 → 투자의 생각</p><p class="note"><b>인터뷰형</b> · 배경·용어 → 주제별 질문·답변 요지 → 계산·해석 → 한계 → 투자의 생각</p><p class="note">(계산)은 숫자의 검산, (해석)은 편집자의 판단입니다. 전망과 회사 가이던스를 구분합니다. 기존 리포트는 작성 당시 구성을 유지합니다.</p></section></aside></div>';
  }
  function chart(series,{unit='',height=220}={}) {
    const all=series.flatMap(x=>x.points).filter(x=>Number.isFinite(x.value));if(!all.length)return '<p class="note">표시할 수 있는 숫자 데이터가 없습니다.</p>';
    const w=850,h=height,left=62,right=18,top=17,bottom=36,numeric=all.every(x=>/^\d{4}-\d{2}-\d{2}$/.test(x.label));
    const labels=[...new Set(all.map(p=>p.label))];if(numeric)labels.sort();
    const xvalue=p=>numeric?Date.parse(p.label):labels.indexOf(p.label),xs=all.map(xvalue),minX=Math.min(...xs),maxX=Math.max(...xs),ys=all.map(x=>x.value),minY=Math.min(...ys),maxY=Math.max(...ys),pad=(maxY-minY)*.12||Math.abs(maxY)*.1||1;
    const x=p=>left+(xvalue(p)-minX)/(maxX-minX||1)*(w-left-right),y=v=>h-bottom-(v-minY+pad)/(maxY-minY+pad*2)*(h-top-bottom);
    let svg=`<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(unit)} 추이"><title>${esc(series.map(s=>s.label).join(', '))}</title>`;
    for(let i=0;i<4;i++){const v=minY-pad+(maxY-minY+pad*2)*i/3;svg+=`<line class="gridline" x1="${left}" x2="${w-right}" y1="${y(v)}" y2="${y(v)}"/><text x="${left-9}" y="${y(v)+4}" text-anchor="end">${fmt(v)}</text>`;}
    for(let i=0;i<series.length;i++){const s=series[i],points=s.points.filter(p=>Number.isFinite(p.value));let path='',prev=null;for(const p of points){const gap=numeric&&prev&&Date.parse(p.label)-Date.parse(prev.label)>4*86400000;path+=(prev&&!gap?'L':'M')+x(p).toFixed(2)+','+y(p.value).toFixed(2);prev=p;}svg+=`<path class="line" stroke="${palette[i%palette.length]}" d="${path}"/>`;for(const p of points)svg+=`<circle cx="${x(p)}" cy="${y(p.value)}" r="2.5" fill="${palette[i%palette.length]}"><title>${esc(s.label)} ${esc(p.label)}: ${fmt(p.value)} ${esc(unit)}</title></circle>`;}
    svg+=`<text x="${left}" y="${h-9}">${esc(labels[0])}</text><text x="${w-right}" y="${h-9}" text-anchor="end">${esc(labels.at(-1))}</text></svg>`;
    return `<div class="chart-wrap">${svg}<div class="legend">${series.map((s,i)=>`<span><i style="background:${palette[i%palette.length]}"></i>${esc(s.label)}</span>`).join('')}<span>${esc(unit)}</span></div></div>`;
  }
  function reportComment(x) {
    return `<aside class="comment ${esc(x.kind)}"><b>${x.kind==='calculation'?'(계산)':'(해석)'}</b><p>${esc(x.text)}</p>${x.kind==='calculation'?`<p class="note">입력 ${x.inputs.map((v,i)=>`${x.input_labels?.[i]?esc(x.input_labels[i])+': ':''}${fmt(v,6)}`).join(' · ')} → 계산값 ${fmt(x.result,4)} ${esc(x.unit||(['percentage','growth'].includes(x.operation)?'%':''))}</p>`:''}${x.assumptions?`<p class="note">가정·한계: ${esc(x.assumptions)}</p>`:''}</aside>`;
  }
  function reportBlock(b) {
    const citation=b.source_url?source(b)+(b.locator?`<p class="source">위치 ${esc(b.locator)}</p>`:''):'';
    let html='';
    if(b.type==='paragraph')html=`<p>${esc(b.text)}</p>`;
    if(b.type==='subheading')html=`<h3>${esc(b.text)}</h3>`;
    if(b.type==='bullets')html=`<ul class="report-bullets">${b.items.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`;
    if(b.type==='dialogue')html=`<div class="report-dialogue ${esc(b.role)}"><p class="dialogue-speaker"><b>${esc(b.speaker)}</b><span>${b.role==='question'?'질문 요지':'답변 요지'}</span></p>${b.paragraphs.map(p=>`<p>${esc(p)}</p>`).join('')}</div>`;
    if(b.type==='comment')html=reportComment(b);
    if(b.type==='table')html=`<figure class="report-figure"><figcaption>${esc(b.title)}</figcaption>${table(b.columns,b.rows)}</figure>`;
    if(b.type==='chart')html=`<figure class="report-figure"><figcaption>${esc(b.title)}</figcaption>${chart([{label:b.title,points:b.points}],{unit:b.unit})}${table(['기간·구분',b.unit],b.points.map(p=>[p.label,p.value]))}</figure>`;
    return `<div class="report-block">${html}${citation}</div>`;
  }
  function reportBody(r) {
    const e=r.editorial;
    const intro=e?`<div class="report-takeaways"><p class="eyebrow">한눈에 보기</p><ul>${e.key_takeaways.map(p=>`<li>${esc(p)}</li>`).join('')}</ul></div><div class="report-intro">${e.introduction.map(p=>`<p>${esc(p)}</p>`).join('')}</div>${list(e.related_reports).length?`<div class="report-related"><b>함께 읽기</b>${e.related_reports.map(x=>anchor('reports',x.id,x.title)).join('')}</div>`:''}`:'';
    const references=list(r.references).map(ref=>`<li>${url(ref.url,ref.label)} · ${esc(ref.date)}</li>`).join('');
    return `<a class="back" href="#reports">← 리포트 목록</a><article class="report-body" tabindex="-1" data-item="${esc(r.id)}"><div class="meta">${badge(r.format)}${e?badge(e.template==='earnings'?'실적 심층':'인터뷰 심층'):''}<span>${esc(r.company)} · ${esc(r.sector)} · ${esc(r.period)}</span></div><h1>${esc(r.title)}</h1><p class="report-deck">${esc(r.overview)}</p>${source(r)}<p class="note">원문 근거 ${fmt(r.coverage*100,0)}% · ${esc(r.basis)}${r.written_on?` · 작성 ${esc(r.written_on)}`:''}</p>${intro}<nav class="toc" aria-label="리포트 목차"><strong>목차</strong><ol>${r.sections.map(s=>`<li><a href="${esc(href('reports',r.id,{section:s.id}))}">${esc(s.title)}</a></li>`).join('')}</ol></nav>${list(e?.glossary).length?`<details class="report-glossary"><summary>먼저 알아둘 용어</summary><dl>${e.glossary.map(x=>`<dt>${esc(x.term)}</dt><dd>${esc(x.definition)}</dd>`).join('')}</dl></details>`:''}${r.sections.map((s,i)=>`<section id="section-${esc(s.id)}" class="report-section ${s.role?'report-'+esc(s.role):''}">${e?`<p class="eyebrow">${String(i+1).padStart(2,'0')}</p>`:''}<h2>${esc(s.title)}</h2>${s.blocks?s.blocks.map(reportBlock).join(''):list(s.paragraphs).map(p=>`<p>${esc(p)}</p>`).join('')+list(s.comments).map(reportComment).join('')}</section>`).join('')}${list(r.charts).map(x=>`<section><h2>${esc(x.title)}</h2>${chart([{label:x.title,points:x.points}],{unit:x.unit})}${source(x)}</section>`).join('')}${list(r.tables).map(x=>`<section><h2>${esc(x.title)}</h2>${table(x.columns,x.rows)}${source(x)}</section>`).join('')}${r.comparison?`<section><h2>이전 자료와 달라진 점</h2><p>${esc(r.comparison.guidance_change)}</p>${r.comparison.previous_report_id?anchor('reports',r.comparison.previous_report_id,'이전 리포트 →'):''}</section>`:''}${r.investment_impact?`<div class="impact investment"><b>투자에 주는 의미 · 편집 해석</b><p>${esc(r.investment_impact)}</p></div>`:''}${e?`<section><h2>다음에 확인할 것</h2>${table(['관측 지표','판단이 달라지는 조건','확인 시점'],e.watchpoints.map(x=>[x.metric,x.condition,x.timing]))}</section>`:''}${references?`<section><h2>근거 자료</h2><ul class="report-references">${references}</ul></section>`:''}</article>`;
  }
  function table(columns,rows) {return `<div class="table-scroll"><table><thead><tr>${columns.map(c=>`<th scope="col">${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(v=>`<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;}
  function priceChange(points,days) {if(points.length<2)return null;const latest=points.at(-1),cutoff=Date.parse(latest.date)-days*86400000,base=points.filter(p=>Date.parse(p.date)<=cutoff&&Date.parse(p.date)>=cutoff-7*86400000).at(-1);return base?(latest.value/base.value-1)*100:null;}
  function transformPrice(points,mode) {
    if(mode==='index'){const base=points[0]?.value;return base?points.map(p=>({label:p.date,value:p.value/base*100})):[];}
    if(mode==='yoy')return points.map(p=>{const target=new Date(p.date);target.setUTCFullYear(target.getUTCFullYear()-1);const time=+target,old=points.filter(x=>Date.parse(x.date)<=time&&Date.parse(x.date)>=time-7*86400000).at(-1);return {label:p.date,value:old?(p.value/old.value-1)*100:null};}).filter(x=>Number.isFinite(x.value));
    return points.map(p=>({label:p.date,value:p.value}));
  }
  function renderMemory(data) {
    const f=filters.memory||={},series=config.memory.series,selected=f.selected||series.filter(x=>x.market==='spot').map(x=>x.id),mode=f.mode||'actual',period=f.period||'365';
    const grouped=Object.fromEntries(series.map(s=>[s.id,data.items.filter(x=>x.series_id===s.id).sort((a,b)=>a.date.localeCompare(b.date))]));
    let html=title('memory',data,'직접 확인한 현물·고정가를 구분해 계약가 방향과 서버 원가를 살펴봅니다.')+'<div class="stats">';
    for(const s of series){const points=grouped[s.id],last=points.at(-1);html+=`<div class="stat-card" data-item="${esc(last?.id||s.id)}" tabindex="-1"><span>${esc(s.label)} · ${s.market==='spot'?'현물':'고정가'}</span><b>${last?fmt(last.value,3):'—'}</b><small>${esc(s.unit)} · ${esc(last?.date||'자료 공백')}</small><div class="note">${[30,90,365].map((days,i)=>{const pct=priceChange(points,days);return `${['1개월','3개월','1년'][i]} ${pct===null?'—':fmt(pct)+'%'}`;}).join(' · ')}</div>${points.length>1?`<svg class="spark" viewBox="0 0 160 35" aria-label="${esc(s.label)} 추이"><polyline fill="none" stroke="#69839a" stroke-width="1.5" points="${points.slice(-30).map((p,i,a)=>`${i/(a.length-1)*160},${31-(p.value-Math.min(...a.map(x=>x.value)))/(Math.max(...a.map(x=>x.value))-Math.min(...a.map(x=>x.value))||1)*27}`).join(' ')}"/></svg>`:''}</div>`;}
    html+='</div><section class="panel"><div class="panel-head"><h2>가격 추이</h2><span class="note">관측 공백은 연결하지 않습니다.</span></div><div class="series-select">'+series.map(s=>`<label><input type="checkbox" data-memory-series="${esc(s.id)}" ${selected.includes(s.id)?'checked':''}>${esc(s.label)}</label>`).join('')+'</div>';
    html+=`<div class="filters">${select('mode','보기',['actual','index','yoy'],mode).replace('>actual<','>실제가<').replace('>index<','>지수 (첫 관측=100)<').replace('>yoy<','>전년 대비<')}${select('period','기간',['30','90','365','all'],period).replace('>30<','>1개월<').replace('>90<','>3개월<').replace('>365<','>1년<').replace('>all<','>전체<')}</div>`;
    const units=[...new Set(series.filter(s=>selected.includes(s.id)).map(x=>x.unit))];
    if(units.length>1)html+='<div class="unit-warning" role="status">단위가 다른 시리즈를 선택했습니다. 칩 가격과 모듈 가격은 같은 원가가 아닙니다. 실제가는 단위별로 나누어 표시합니다.</div>';
    const cut=period==='all'?0:Date.now()-Number(period)*86400000;
    for(const unit of mode==='actual'?units:['normalized']){
      const ss=series.filter(s=>selected.includes(s.id)&&(mode!=='actual'||s.unit===unit)).map(s=>({label:s.label,points:transformPrice(grouped[s.id],mode).filter(p=>Date.parse(p.label)>=cut)}));html+=chart(ss,{unit:mode==='actual'?unit:mode==='index'?'지수 (첫 관측=100)':'전년 대비 %'});
    }
    html+=`<p class="note">가격 사건 ${data.events.length}건</p>`+data.events.map(e=>`<p class="note">${esc(e.source_date)} · ${esc(e.title)} · ${url(e.source_url)}</p>`).join('')+'</section><div class="two-cols"><section class="panel"><h2>서버 1대 메모리 원가</h2>';
    const server=grouped['server-rdimm64-contract'].at(-1);
    html+=server?`<p style="font-family:Georgia,serif;font-size:32px">$${fmt(server.value*16)}</p><p class="note">64GB RDIMM × 16 = 1,024GB · ${fmt(server.value)} USD/module × 16<br>원천 기준일 ${esc(server.date)}</p>${source(server)}`:'<p class="quiet">64GB RDIMM 모듈 단가를 직접 확인한 후 계산합니다. 칩 가격으로 대체하지 않습니다.</p>';
    html+='</section><section class="panel"><h2>동일 규격 현물–고정가 괴리</h2>';
    for(const s of series.filter(x=>x.pair)){const a=grouped[s.pair].at(-1),b=grouped[s.id].at(-1);html+=`<p class="note"><b>${esc(s.label)}</b><br>${a&&b&&a.date===b.date?`${fmt((a.value/b.value-1)*100)}% · ${esc(a.date)}`:'같은 기준일의 현물·고정가 자료가 필요합니다.'}</p>`;}
    html+='</section></div><section class="panel"><h2>분기 고정거래가 변동률</h2><p class="note">전분기 대비 계약가 변화율입니다. 실측과 전망을 별도 행으로 표시합니다. 범위는 원문 그대로입니다.</p>';
    if(data.quarters.length){const quarters=[...new Set(data.quarters.map(q=>q.quarter))].sort(),products=[...new Set(data.quarters.map(q=>q.product))];html+=`<div class="table-scroll"><table><thead><tr><th>품목 · 구분</th>${quarters.map(q=>`<th>${esc(q)}</th>`).join('')}</tr></thead><tbody>${products.flatMap(product=>['actual','forecast'].map(kind=>`<tr><th scope="row">${esc(product)} · ${kind==='actual'?'실측':'전망'}</th>${quarters.map(quarter=>{const q=data.quarters.find(x=>x.product===product&&x.kind===kind&&x.quarter===quarter);if(!q)return '<td class="note">자료 공백</td>';const intensity=Math.min(.45,.06+Math.max(Math.abs(q.low),Math.abs(q.high))/200),color=q.low>=0?'162,70,56':'36,116,92';return `<td class="heat-${kind}" style="background-color:rgba(${color},${intensity})"><b>${fmt(q.low)}~${fmt(q.high)}%</b><br><span class="note">${url(q.source_url)} · ${esc(q.source_date)}</span></td>`;}).join('')}</tr>`)).join('')}</tbody></table></div>`;}else html+='<p class="quiet">확인된 분기 수치가 없습니다.</p>';
    html+='</section><section class="panel"><h2>실적 콜의 메모리 발언</h2>'+ (data.statements.length?data.statements.map(x=>`<p>${esc(x.title)}</p>${source(x)}`).join(''):'<p class="note">확인된 발언이 없습니다.</p>')+'</section>';
    if(data.gaps.length)html+=`<details class="queue"><summary>현물 관측 누락 ${data.gaps.length}건</summary><ul>${data.gaps.map(g=>`<li>${esc(g.date)} · ${esc(series.find(x=>x.id===g.series_id)?.label)} · ${esc(g.reason)}</li>`).join('')}</ul></details>`;
    return html+'<p class="note">2022년 이후 공개 과거 자료를 찾는 초기 수집은 별도 절차입니다. 확보하지 못한 구간을 소급 추정하지 않습니다.</p>';
  }
  function renderSources(data) {
    const scheduleState=x=>({ACTIVE:'활성',PAUSED:'중지'}[x]||'확인 필요');
    let html=title('sources',data,'무엇을 보고, 어떻게 만들며, 지금 어디까지 갱신됐는지 공개합니다.');
    html+=`<section class="panel"><h2>운영 방식</h2><div class="two-cols"><div><p>일간: 평일 09:00 KST<br>주간: 월요일 09:40 KST<br>월간: 1일 10:00 KST</p><p class="note">새 탭의 예약 수집은 아직 연결하지 않았습니다. ${esc(config.existing_schedules?.checked_on||'기준일 미확인')} 확인 기준으로 기존 일간 작업은 ${scheduleState(config.existing_schedules?.daily?.status)}, 주간 작업은 ${scheduleState(config.existing_schedules?.weekly?.status)} 상태입니다. 기존 일정은 변경하지 않았습니다. 표시한 시간은 운영 계획이며 실행 완료를 뜻하지 않습니다.</p></div><div><p>수집 → 편집·작성 → 독립 검증 → 형식 검사 → 게시</p><p class="note">수치·날짜·발언자·고유명사를 원문과 대조합니다. 추정·전망·전언은 구분하고 미확인은 확인 필요로 표시합니다. 정정은 원래 항목 ID와 사유를 보존합니다.</p></div></div></section>`;
    html+='<section class="panel"><h2>최근 실행 10건</h2>';
    html+=data.runs.length?`<div class="table-scroll"><table><thead><tr><th>시각</th><th>유형</th><th>상태</th><th>건수</th><th>0건 영역</th><th>메모</th></tr></thead><tbody>${data.runs.map(r=>`<tr class="${r.status==='success'?'':'problem'}"><td>${esc(r.at)}</td><td>${esc(r.type)}</td><td>${r.status==='success'?'정상':r.status==='failed'?'실패':r.status==='partial'?'일부 미완료':'보류'}</td><td>${Object.entries(r.counts).map(([k,n])=>`${esc(k)} ${n}`).join('<br>')||'0'}</td><td>${list(r.zero_areas).map(z=>`${esc(z.area)}<br><small>${esc(z.reason)} · 검색 ${esc(z.queries.join(' / '))}</small>`).join('<br>')||'—'}</td><td>${list(r.notes).map(esc).join('<br>')}</td></tr>`).join('')}</tbody></table></div>`:'<p class="quiet">새 파이프라인의 실행 기록이 없습니다. 기존 회차의 생성 시각은 아래 갱신 현황에 표시합니다.</p>';
    html+='</section><section class="panel"><h2>탭별 마지막 갱신</h2><div class="table-scroll"><table><thead><tr><th>탭</th><th>주기</th><th>기준일</th><th>상태</th><th>건수</th></tr></thead><tbody>'+config.tabs.map(t=>{const x=data.tabs[t.id];return `<tr class="${x.stale?'problem':''}"><td>${anchor(t.id,null,t.label)}</td><td>${esc({daily:'일간',weekly:'주간',monthly:'월간'}[t.period])}</td><td>${esc(x.as_of||'수집 전')}</td><td>${x.stale?'⚠ 갱신 지연':x.status==='empty'?'초기 수집 대기':'정상'}</td><td>${fmt(x.count,0)}</td></tr>`;}).join('')+'</tbody></table></div></section>';
    html+='<section class="panel"><h2>모니터링 소스</h2><p class="note">공통 소스 설정을 수집 계획과 이 목록이 함께 읽습니다. 목록에 등록된 사실은 이번 실행에서 접근·본문을 확인했다는 뜻이 아닙니다.</p>';
    for(const area of new Set(data.sources.map(x=>x.area))){html+=`<h3 style="margin-top:22px">${esc(area)}</h3><div class="source-list">${data.sources.filter(x=>x.area===area).map(x=>`<div class="source-item">${url(x.url,x.name)}<small>${x.access==='mixed'?'일부 유료':'공개 원천'} · ${x.health?.consecutive_failures>=3?'접근 실패 누적 · 수집 제외':x.health?.status==='ok'?'최근 접근 성공':'접근 상태 미확인'}</small></div>`).join('')}</div>`;}
    html+='</section><section class="panel"><h2>탭별 방법론</h2>'+config.tabs.map(t=>`<div class="method"><strong>${esc(t.label)}${t.prompt!==null?` · ${t.prompt}`:''}</strong><p>${esc(t.method)}<br><span class="note">초기 수집: ${esc(t.initial)}</span></p></div>`).join('')+'</section>';
    return html;
  }
  function renderGPU(data,params) {
    const g=data.data;if(!g)return title('gpu',data)+empty('아직 GPU 가격 관측이 없습니다');
    const f=filters.gpu||={};if(params?.get('id'))f.model=g.series.find(s=>s.id===params.get('id'))?.model||f.model;
    const model=f.model||'b300-sxm',items=g.series.filter(s=>s.model===model),latest=s=>g.observations.filter(o=>o.series===s.id&&o.status==='ok').sort((a,b)=>b.date.localeCompare(a.date))[0];
    return title('gpu',data,'같은 GPU·지역·과금 조건의 공개 임대가격만 비교합니다.')+`<div class="filters">${select('model','GPU',g.models.map(x=>x.id),model)}</div><section class="panel">${chart(items.slice(0,6).map(s=>({label:s.provider+' · '+s.billing,points:g.observations.filter(o=>o.series===s.id&&o.status==='ok').sort((a,b)=>a.date.localeCompare(b.date)).map(o=>({label:o.date,value:o.price}))})),{unit:'USD/GPU·시간'})}<div class="table-scroll"><table><thead><tr><th>공급자</th><th>지역·과금</th><th>최근 가격</th><th>관측일</th><th>구성·근거</th></tr></thead><tbody>${items.map(s=>{const x=latest(s);return `<tr data-item="${esc(s.id)}" tabindex="-1"><td>${esc(s.provider)}</td><td>${esc(s.region)} · ${esc(s.billing)}</td><td>${x?fmt(x.price,4):'관측 없음'}</td><td>${esc(x?.date||'—')}</td><td>${esc(s.scope)} · ${url(s.source)}</td></tr>`;}).join('')}</tbody></table></div><p class="note">GPU 관측 원문 조회일과 원문 게시일은 다를 수 있습니다. 과거 카탈로그 복원은 직접 관측에 이어 붙이지 않습니다.</p><a class="source" href="legacy.html#gpu">GPU 과거 카탈로그와 기존 상세 화면 ↗</a></section>`;
  }
  function renderWeekly(data) {return title('weekly',data,'사건을 연결하고 다음 확인할 조건을 정리합니다.')+(data.items.length?data.items.slice().sort((a,b)=>b.source_date.localeCompare(a.source_date)).map(w=>`<article class="story" tabindex="-1" data-item="${esc(w.id)}"><p class="eyebrow">${esc(w.id)}</p><h2>${esc(w.title)}</h2><p>${esc(w.body)}</p>${list(w.threads).map(t=>`<h3>${esc(t.title)}</h3><p>${esc(t.summary)}</p><p class="note">${esc(t.so_what)}</p>`).join('')}<p class="note">생성 ${esc(w.generated_at)} · ${w.legacy?'기존 사업 브리핑':''}</p></article>`).join(''):empty('아직 주간 시사점이 없습니다'));}
  function renderInterviews(data) {return title('interviews',data,'대담의 주장과 편집자의 해석, 반대 조건을 구분합니다.')+(data.items.length?data.items.map(x=>`<article class="story" data-item="${esc(x.id)}" tabindex="-1"><div class="meta">${esc(x.podcast)} · ${esc(x.source_date)}</div><h2>${esc(x.headline||x.title)}</h2><p>${esc(x.guests)}</p><p>${esc(x.overview||x.summary)}</p><p class="note">근거 범위: ${esc(x.basis)}</p>${list(x.points).map(p=>`<details class="details-text"><summary>${esc(p.heading)}</summary><p>${esc(p.body)}</p>${p.analysis?`<p><b>(해석)</b> ${esc(p.analysis)}</p>`:''}${p.counterpoint?`<p class="note">반대 조건: ${esc(p.counterpoint)}</p>`:''}</details>`).join('')}${source(x)}<p class="note">${esc(Array.isArray(x.caveats)?x.caveats.join(' '):x.caveats)}</p></article>`).join(''):empty('아직 리더 인터뷰가 없습니다'));}
  function renderArchive(data) {
    const f=filters.archive||={},q=f.search?.toLowerCase()||'',items=data.items.filter(x=>(!f.kind||f.kind==='전체'||x.collection===f.kind)&&(!q||(x.title||x.oneliner||'').toLowerCase().includes(q)));
    return title('archive',data,'기존 회차와 새로운 누적 자료, 정정 이력을 함께 찾습니다.')+`<div class="filters">${select('kind','종류',['전체',...new Set(data.items.map(x=>x.collection))],f.kind)}<input type="search" data-search="archive" aria-label="아카이브 검색" placeholder="제목 검색" value="${esc(f.search||'')}"></div><section class="panel"><div class="table-scroll"><table><thead><tr><th>날짜</th><th>종류</th><th>제목</th></tr></thead><tbody>${items.map(x=>`<tr data-item="${esc(x.id)}" tabindex="-1"><td>${esc(x.source_date||x.date)}</td><td>${esc(x.collection)}</td><td>${anchor(({articles:'news',editions:'news',weeklies:'weekly',reports:'reports',corrections:'archive'})[x.collection]||'archive',x.collection==='editions'?x.article_ids?.[0]:x.id,x.title||x.oneliner||x.id)}</td></tr>`).join('')}</tbody></table></div>${items.length?'':'<p class="quiet">조건에 맞는 기록이 없습니다.</p>'}</section>`;
  }
  function renderGeneric(tab,data) {const t=config.tabs.find(x=>x.id===tab);return title(tab,data,t.method)+(data.items.length?data.items.map(x=>`<article class="story" tabindex="-1" data-item="${esc(x.id)}">${tab==='events'&&x.date?`<p class="meta">예정 ${esc(x.date)}</p>`:''}<h2>${esc(x.title)}</h2><p>${esc(x.body||x.summary)}</p>${source(x)}</article>`).join(''):empty('아직 수집된 자료가 없습니다',t.initial));}
  const renderers={summary:renderSummary,news:renderNews,finance:renderFinance,reports:renderReports,memory:renderMemory,sources:renderSources,gpu:renderGPU,weekly:renderWeekly,interviews:renderInterviews,archive:renderArchive};
  function highlight(params) {
    const section=params.get('section'),id=params.get('id');
    const target=section?document.getElementById('section-'+section):id?[...document.querySelectorAll('[data-item]')].find(x=>x.dataset.item===id):null;
    if(target){target.classList.add('item-highlight');target.tabIndex=-1;target.focus({preventScroll:true});target.scrollIntoView({block:'start',behavior:'instant'});}
  }
  async function show() {
    const token=++generation,{tab,params}=route();active=tab;navigation();$('#content').innerHTML='<div class="loading">자료를 불러오고 있습니다.</div>';
    try{const data=await json(tab);if(token!==generation)return;
      if(tab==='reports'&&params.get('id')){if(!data.items.some(r=>r.id===params.get('id')))throw Error('목록에 없는 리포트');const report=await json('reports/'+encodeURIComponent(params.get('id')));if(token!==generation)return;$('#content').innerHTML=title('reports',data)+reportBody(report);}
      else $('#content').innerHTML=renderers[tab]?renderers[tab](data,params):renderGeneric(tab,data);
      document.title=config.tabs.find(x=>x.id===tab).label+' · AI·클라우드 브리핑';highlight(params);
    }catch(e){if(token===generation)$('#content').innerHTML=empty('자료를 불러오지 못했습니다','잠시 후 새로고침해 주세요. 다른 탭은 계속 이용하실 수 있습니다.')+'<button data-retry type="button">다시 불러오기</button>';}
  }
  function redraw(){const {params}=route();cache.get(active)?.then(data=>{$('#content').innerHTML=renderers[active]?renderers[active](data,params):renderGeneric(active,data);});}
  document.addEventListener('change',e=>{
    if(e.target.dataset.filter){filters[active]||={};filters[active][e.target.dataset.filter]=e.target.value;if(route().params.get('id'))history.replaceState(null,'','#'+active);redraw();}
    if(e.target.dataset.memorySeries){filters.memory||={};filters.memory.selected=[...document.querySelectorAll('[data-memory-series]:checked')].map(x=>x.dataset.memorySeries);redraw();}
  });
  let searchTimer;document.addEventListener('input',e=>{if(e.target.dataset.search){const tab=e.target.dataset.search,value=e.target.value;clearTimeout(searchTimer);searchTimer=setTimeout(()=>{filters[tab]||={};filters[tab].search=value;redraw();},150);}});
  document.addEventListener('click',e=>{if(e.target.closest('[data-retry]'))show();});
  window.addEventListener('hashchange',show);
  $('#refresh').addEventListener('click',async()=>{cache.clear();try{status=await json('status');globalWarning();await show();}catch{$('#global-warning').hidden=false;$('#global-warning').textContent='갱신 상태를 확인하지 못했습니다. 마지막으로 읽은 자료를 표시합니다.';}});
  (async()=>{try{[config,status]=await Promise.all([json('config'),json('status')]);$('#today').textContent=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',dateStyle:'medium'}).format(new Date())+' KST';globalWarning();await show();}catch{$('#content').innerHTML=empty('브리핑을 불러오지 못했습니다','설정과 데이터가 함께 게시됐는지 확인해 주세요.');}})();
})();
