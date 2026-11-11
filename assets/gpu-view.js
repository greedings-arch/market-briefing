// Pure rendering helpers; importing this module never mounts a page or loads data.
(function (root, factory) {
  if (typeof module === 'object' && module.exports)
    module.exports = factory(require('./market-ui'));
  else root.MarketGPU = factory(root.MarketUI);
})(typeof window === 'object' ? window : globalThis, (ui) => {
  'use strict';
  const { badge, chart, empty, esc, fmt, list, url } = ui;
  function create({ anchor, filters, getItemID, gpuBriefing, href, title }) {
    const gpuBilling = {
      on_demand: '온디맨드',
      spot: 'Spot · 중단 가능',
      reserved: '기간 약정',
      capacity_block: '선불 Capacity Blocks',
    };
    const gpuScope = {
      instance: '인스턴스 공시',
      advertised_from: '시작가격 · from',
      gpu_only: 'GPU만 · CPU/RAM 별도',
      marketplace_floor: '마켓플레이스 최저 호가',
    };
    const gpuMarketLabels = {
      on_demand: '일반 임대',
      community: '분산·Community',
      spot: 'Spot',
      serverless: '서버리스',
      shared: '공유 GPU',
      reserved_1y: '1년 약정',
      reserved_3y: '3년 약정',
      reserved: '기간 약정',
    };
    const gpuRead = {
      live: '최근 48시간 내 가격 조회',
      unconfirmed: '재확인 필요',
      stopped: '수집 중단 · 과거 호가',
      thin_market: '표본 부족 · 이전 호가 보존',
    };
    const gpuAccess = {
      public_pricing: '공개 가격표',
      public_api: '공개 API·문서',
      quote_only: '문의 견적',
      login_required: '로그인 필요',
      blocked: '접근 실패',
      discovery_only: '발견 경로',
      directory_only: '집계 경유 · 미검토',
    };
    const gpuChange = (v) => (Number.isFinite(v) ? `${v > 0 ? '+' : ''}${fmt(v, 2)}%` : '—');
    function gpuSelect(key, name, options, value) {
      return `<label>${esc(name)} <select data-filter="${key}" aria-label="${esc(name)}">${options.map(([id, label]) => `<option value="${esc(id)}" ${id === value ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select></label>`;
    }
    const gpuClassOptions = [
      ['all', '모든 업체군'],
      ['bigtech', '빅테크'],
      ['neocloud', '네오클라우드·GPU 특화'],
      ['regional', '종합·지역 클라우드'],
      ['managed', '관리형·서버리스'],
      ['marketplace', '마켓플레이스'],
      ['other', '기타·분류 확인 중'],
    ];
    function gpuSegments(research) {
      const d = research.segments;
      if (!d?.as_of) return '';
      const cell = (x) =>
        x.change === null
          ? `<strong>비교 보류</strong><small>${x.providers}개 업체 · 과거 쌍/표본 부족</small>`
          : `<strong>${gpuChange(x.change)} <span class="note">· 지수 ${fmt(x.index, 2)}</span></strong><small>업체 중앙 변동 ${gpuChange(x.median_change)} · ${x.providers}개 업체/${x.quotes}개 항목</small><small>상승 ${x.rising} · 같은 가격 ${x.flat} · 하락 ${x.falling}</small>`;
      const changed = d.matrix.flatMap((x) =>
        ['bigtech', 'neocloud'].flatMap((group) =>
          x.groups[group].members
            .filter((m) => Math.abs(m.ratio - 1) > 1e-8)
            .map((m) => ({ model: x.label, group: d.groups[group], ...m }))
        )
      );
      return `<section class="panel gpu-segments" id="section-gpu-segments"><p class="eyebrow">BIG TECH / NEOCLOUD</p><h2>빅테크와 네오클라우드의 가격 흐름을 나눠 봅니다</h2><p>같은 공시항목의 7일 가격비를 비교합니다. 신규 저가 업체의 진입으로 평균이 내려가는 효과를 줄이고, 인상이 몇 개 업체에 퍼졌는지도 함께 봅니다.</p><p class="note">비교 자료 ${esc(d.as_of)} · 기준 조회 ${d.baseline_dates.map(esc).join(' ~ ')} · 7일 전 = 100 · 업체 2곳 미만은 보류</p><div class="table-scroll"><table class="gpu-segment-table"><thead><tr><th>GPU · 규격</th><th>빅테크</th><th>네오클라우드·GPU 특화</th></tr></thead><tbody>${d.matrix.map((x) => `<tr><td><b>${esc(x.label)}</b></td><td>${cell(x.groups.bigtech)}</td><td>${cell(x.groups.neocloud)}</td></tr>`).join('')}</tbody></table></div><details class="gpu-price-events"><summary>가격을 바꾼 업체와 7일 변동률 · ${changed.length}개 업체·GPU 조합</summary><p class="note">외부 집계의 과거·현재 공시항목 쌍에서 계산했습니다. 업체의 공식 가격 변경 발표와는 다릅니다.</p><div class="table-scroll"><table><thead><tr><th>GPU</th><th>업체군·공급자</th><th>업체 내 가격비</th><th>근거</th></tr></thead><tbody>${changed.map((x) => `<tr><td>${esc(x.model)}</td><td>${esc(x.group)} · ${esc(x.name)}</td><td>${gpuChange((x.ratio - 1) * 100)}<small>${x.quotes}개 동일 공시항목</small></td><td>${url(x.source_url, '현재 공급자 원문 ↗')}</td></tr>`).join('')}</tbody></table></div></details><details class="gpu-method"><summary>구분 기준·같은 공시항목 비교 방법과 제외 항목</summary><p>빅테크는 이 자료의 AWS·Microsoft Azure·Google Cloud·Oracle Cloud입니다. 네오클라우드는 GPU/AI 인프라 중심 사업자로 별도 분류한 업체입니다. 종합·지역 클라우드, 관리형·서버리스, 마켓플레이스는 별도 업체군입니다. 운영사 국적과 한국 리전은 구분합니다.</p><p>${esc(d.method)} 시작가격·GPU만의 요금·Spot·기간 약정·Community·서버리스·미확인 가격은 이 비교에서 제외합니다. VESSL은 상품 범위가 달라진 페이지를 과거 동일 서비스로 검증하지 못해 이 비교에서 제외했습니다.</p><p>외부 집계가 같은 공시항목으로 연결한 조회 쌍입니다. 업체 내 여러 지역·상품의 가격비를 먼저 기하평균하고 업체를 같은 비중으로 계산합니다. 업체별 중앙 변동률과 인상 확산도는 일부 큰 변화가 전체 흐름처럼 보이지 않도록 함께 표시합니다. 실제 GPU 성능·CPU/RAM·재고·체결 단가를 통제한 실험은 아니며, 양쪽 시점에 남은 항목의 생존편향이 있습니다. ${url(d.source_url, 'GPU Economy 7일 비교 정의 ↗')}</p></details></section>`;
    }
    function gpuPriceReading(research) {
      const r = research.insights;
      if (!r) return '';
      return `<section class="panel gpu-price-reading" id="section-gpu-insights"><div class="gpu-reading-heading"><div><p class="eyebrow">WHAT THE PRICE CHANGES MEAN</p><h2>가격 변화에서 읽을 핵심 판단</h2></div><span class="note">검토 ${esc(r.reviewed_on)}</span></div><div class="gpu-insight-grid">${r.insights.map((x, i) => `<article data-item="${esc(x.id)}" tabindex="-1"><p class="eyebrow">판단 ${String(i + 1).padStart(2, '0')}</p><h3>${esc(x.title)}</h3><p class="gpu-insight-fact">${esc(x.finding)}</p><p><b>사업·투자에 주는 의미</b> ${esc(x.meaning)}</p><details><summary>판단을 바꿀 조건과 다음 확인</summary><p><b>반대 조건·한계</b> ${esc(x.countercondition)}</p><p><b>다음 확인</b> ${esc(x.watch)}</p></details><p class="source">${x.sources.map((s) => `${url(s.url, s.label + ' ↗')}${s.date ? ' · ' + esc(s.date) : ' · 원문일 미기재'}`).join('<br>')}</p></article>`).join('')}</div><details class="gpu-price-events"><summary>날짜별 가격 관측과 변경 공지를 대조합니다 · ${r.events.length}건</summary><div class="table-scroll"><table><thead><tr><th>업체·GPU</th><th>공개된 이전 → 이후</th><th>효력·증거</th><th>비교 범위·한계</th></tr></thead><tbody>${r.events.map((x) => `<tr><td>${esc(x.provider)} · ${esc(x.model)}<small>${esc(x.billing)}</small></td><td>${esc(x.currency)} ${fmt(x.before, 4)} → ${fmt(x.after, 4)} / ${esc(x.unit)}<small>${gpuChange((x.after / x.before - 1) * 100)}</small></td><td>${badge(x.state === 'announced_future' ? '효력 전 예고' : x.state === 'provider_announced' ? '공식 발표·적용일 미확인' : '날짜별 관측값')}<small>${x.effective_on ? (x.state === 'observed_pair' ? '후기 관측 ' : '효력 ') + esc(x.effective_on) : '효력일 미기재'}</small>${url(x.source_url, '원문 ↗')}</td><td>${esc(x.scope)}<small>${esc(x.limitations)}</small></td></tr>`).join('')}</tbody></table></div></details></section>`;
    }
    function gpuDomestic(research, f) {
      const r = research.domestic;
      if (!r) return '';
      const selected = f.domesticProvider || 'all',
        currency = f.domesticCurrency || 'all',
        status = f.domesticStatus || 'all';
      const labels = {
        current_rate: '현재 공개 페이지',
        dated_reference: '과거 공지·참고자료',
        quote_only: '견적·정확 요금 미확인',
        from: '기본료·시작가격',
        component_only: '구성요소 비용',
        conflicting: '원문 간 불일치',
      };
      const items = r.quotes.filter(
          (x) =>
            (selected === 'all' || x.provider_id === selected) &&
            (currency === 'all' || x.currency === currency) &&
            (status === 'all' || x.status === status)
        ),
        byId = Object.fromEntries(r.providers.map((p) => [p.id, p]));
      const unit = (q) =>
        ({
          'GPU-hour': 'GPU·시간',
          'instance-hour': '인스턴스·시간',
          'node-month': '8 GPU 노드·월',
          'instance-month': '인스턴스·월',
          'server-day': '서버·일',
          'server-month': '서버·월',
          'IDC-fee-month': 'IDC 비용·월',
          'GPU-hour equivalent': 'GPU·시간 환산',
          'node-period-quote': '8 GPU 노드·기간 견적',
          'rack-period-quote': '랙·기간 견적',
        })[q.unit] ||
        q.unit ||
        '견적';
      return `<section class="panel gpu-domestic" id="section-gpu-domestic"><p class="eyebrow">KOREA / OPERATOR & BILLING TERMS</p><h2>국내·한국계 업체의 공개 요금과 확인 공백</h2><p>${r.providers.length}개 업체·상품 경로를 검토했습니다. 국내 운영사와 해외 운영 기반의 한국계 사업자를 표시하고, 한국 리전 제공 여부는 각 행의 조건을 따릅니다.</p><div class="filters">${gpuSelect('domesticProvider', '국내 업체', [['all', '모든 국내·한국계 업체'], ...r.providers.map((x) => [x.id, x.name])], selected)}${gpuSelect(
        'domesticCurrency',
        '원 통화',
        [
          ['all', '모든 통화'],
          ['KRW', 'KRW 원화'],
          ['USD', 'USD 달러'],
        ],
        currency
      )}${gpuSelect('domesticStatus', '요금 근거', [['all', '모든 근거'], ...Object.entries(labels)], status)}</div><p class="gpu-index-caution">원 통화와 원 청구 단위를 보존합니다. 월·일 요금을 임의로 시간당으로 바꾸지 않습니다. 과거 행사 가격은 현행가나 가격 하락으로 취급하지 않으며, 서버 구매형 IDC 비용·관리형 추론은 GPU 서버 임대와 다릅니다.</p><div class="table-scroll"><table class="gpu-domestic-table"><thead><tr><th>업체·GPU</th><th>원 요금</th><th>상품·기간·세금</th><th>지역·구성·별도 비용</th><th>원문·확인 범위</th></tr></thead><tbody>${items.map((q) => `<tr><td><b>${esc(byId[q.provider_id].name)}</b><small>${byId[q.provider_id].origin === 'korean_origin' ? '한국계 · 한국 리전 보장 아님' : '국내 운영사'}</small><small>${esc(research.segments?.groups[byId[q.provider_id].group] || '분류 확인 중')}</small>${esc(q.model)}<small>${esc(q.sku)}</small></td><td>${q.price === null ? '문의·미확인' : esc(q.currency) + ' ' + fmt(q.price, 4)}<small>${esc(unit(q))}</small>${badge(labels[q.status])}</td><td>${esc(q.service_type)}<small>${esc(q.billing)}</small><small>VAT ${esc(q.vat)}</small></td><td>${esc(q.region)}<small>${esc(q.configuration)}</small><small>${esc(q.extras)}</small></td><td>${url(q.source_url, '공식 원문 ↗')}<small>원문 ${esc(q.source_date_note)} · 확인 ${esc(q.checked_on)}</small><details><summary>가용성·해석의 한계</summary><p>${esc(q.availability)}</p><p>${esc(q.note)}</p></details></td></tr>`).join('')}${items.length ? '' : '<tr><td colspan="5">선택 조건에서 확인한 공개 요금 숫자가 없습니다. 아래 업체별 확인 범위와 원문을 참고해 주세요.</td></tr>'}</tbody></table></div><div class="gpu-domestic-coverage">${r.providers
        .filter((p) => selected === 'all' || p.id === selected)
        .map(
          (p) =>
            `<details><summary>${esc(p.name)} · ${r.quotes.filter((q) => q.provider_id === p.id && q.price !== null).length}개 숫자 확인</summary><p>${esc(p.classification_basis)}</p><p>${esc(p.limitations)}</p>${url(p.source_url, '업체 원문 ↗')}</details>`
        )
        .join(
          ''
        )}</div><p class="note">NAVER Cloud·NHN Cloud 등 정확한 공개 GPU 요금을 확인하지 못한 곳도 목록에 남겼습니다. 가격 미확인은 서비스 부재나 높은 가격을 뜻하지 않습니다. 국내 전체의 시계열 방향을 판단할 만큼 같은 상품의 과거·현재 관측이 쌓이지 않았습니다. 조사 ${esc(r.reviewed_on)}.</p></section>`;
    }
    function gpuOverview(research, f) {
      const direct = f.indexBasis === 'direct',
        weeks = f.indexWeeks || '13',
        overview = direct ? research.direct : research.indices?.[weeks];
      if (!overview?.end)
        return `<section class="panel gpu-overview"><h2>GPU 임대시장 한눈에</h2><p>추세를 계산할 관측이 아직 없습니다. 가격이 변하지 않았다는 뜻은 아닙니다.</p></section>`;
      const group = f.indexGroup || 'core',
        groups = {
          core: ['nvidia-b300', 'nvidia-b200', 'nvidia-h200', 'nvidia-h100', 'nvidia-rtx-5090'],
          blackwell: ['nvidia-b300', 'nvidia-b200', 'nvidia-gb300', 'nvidia-gb200'],
          hopper: ['nvidia-h200', 'nvidia-h100'],
          rtx: ['nvidia-rtx-5090', 'nvidia-rtx-4090', 'nvidia-rtx-pro-6000'],
          amd: ['amd-mi300x', 'amd-mi325x', 'amd-mi355x'],
        };
      let models = overview.models.filter(
        (x) => direct || group === 'all' || (groups[group] || groups.core).includes(x.id)
      );
      if (f.indexOrder === 'fall')
        models.sort((a, b) => (a.change ?? Infinity) - (b.change ?? Infinity));
      const series = models
        .filter((x) => Number.isFinite(x.index))
        .slice(0, 5)
        .map((x) => ({ label: x.label, points: x.points }));
      if (!direct && group === 'core' && overview.composite)
        series.unshift({ label: '주요 GPU 8종 참고지수', points: overview.composite.points });
      const valid = models.filter((x) => Number.isFinite(x.index)),
        rise = valid.filter((x) => x.change > 0.01).length,
        fall = valid.filter((x) => x.change < -0.01).length,
        flat = valid.length - rise - fall;
      const lead =
        !direct && overview.composite
          ? `${fmt(overview.composite.index, 2)}<small>${gpuChange(overview.composite.change)} · ${overview.composite.models.length}종 동일가중</small>`
          : direct
            ? `${valid.length}<small>비교 가능한 GPU · 최소 3개 업체</small>`
            : '—<small>공통 기준일의 표본 부족</small>';
      return `<section class="gpu-overview" id="${research.insights?.overview ? 'section-gpu-index' : 'section-gpu-overview'}"><div class="gpu-cover"><div><p class="eyebrow">GPU RENTAL MARKET / PRICE MONITOR</p><h2>GPU 임대시장 한눈에</h2><p>어느 GPU의 공시 임대료가 오르고, 내려가고 있나요?</p></div><div class="gpu-index-number"><span>${direct ? '공식 직접 관측' : '주요 GPU 참고지수'}</span><b>${lead}</b></div></div><div class="gpu-overview-body"><div class="filters">${gpuSelect(
        'indexBasis',
        '추세 근거',
        [
          ['market', '공개시장 주간 집계'],
          ['direct', '공식 직접 관측'],
        ],
        direct ? 'direct' : 'market'
      )}${
        !direct
          ? gpuSelect(
              'indexWeeks',
              '비교 기간',
              [
                ['4', '4주'],
                ['13', '13주'],
                ['52', '52주'],
              ],
              weeks
            ) +
            gpuSelect(
              'indexGroup',
              '비교 그룹',
              [
                ['core', '주요 GPU'],
                ['blackwell', 'Blackwell'],
                ['hopper', 'Hopper'],
                ['rtx', 'RTX'],
                ['amd', 'AMD'],
                ['all', '모든 GPU'],
              ],
              group
            ) +
            gpuSelect(
              'indexOrder',
              '정렬',
              [
                ['rise', '임대료 상승순'],
                ['fall', '임대료 하락순'],
              ],
              f.indexOrder || 'rise'
            )
          : ''
      }</div><div class="gpu-reading"><div><b>${esc(overview.base)} = 100</b><span>비교 종료 ${esc(overview.end)}${!direct ? ' · 완결 주 기준' : ''}</span></div><div><b>${rise} 상승 · ${fall} 하락 · ${flat} 보합</b><span>현재 선택 그룹 · 유효 표본만</span></div><div><b>${direct ? '동일 상품 고정 비교' : '업체별 중앙값 기준'}</b><span>${direct ? '지역·SKU·과금 조건 보존' : '업체와 상품 구성은 변할 수 있습니다'}</span></div></div>${chart(series, { unit: '기준일 = 100', height: 270, gapDays: direct ? 3 : 7 })}<p class="gpu-index-caution">${direct ? '직접 관측 지수는 시작일과 종료일에 모두 확인한 동일 상품만 사용하고, 업체별로 같은 가중치를 줍니다. 새 업체의 싼 가격은 과거 지수를 낮추지 않습니다. 양 끝에 관측이 남은 상품만 비교하므로 생존편향과 기간별 표본 교체가 있을 수 있습니다.' : '공개시장 지수는 GetDeploying의 업체별 공시 중앙값을 기준일 100으로 환산했습니다. GPU 규격·지역·공급자 구성이 변할 수 있어, 같은 상품의 가격 변화만을 나타내지는 않습니다. 주요 참고지수는 표본이 있는 8종 이내 GPU의 지수를 같은 비중으로 기하평균합니다.'} 지수 상승은 임대료 상승, 하락은 임차 비용 완화 방향입니다. 재고·가동률·수익성을 측정한 지표는 아닙니다.</p><details class="gpu-method"><summary>계산식·표본과 해석 범위</summary><p>${direct ? '업체별 동일 상품 가격비의 기하평균 → 업체 간 동일가중 기하평균 × 100입니다. 온디맨드만 포함합니다.' : 'GPU별 지수 = 해당 주의 업체별 공시 중앙값 ÷ 기준 주의 업체별 공시 중앙값 × 100입니다. 온디맨드만 사용하며 양 끝 주에 업체가 각각 3곳 이상 있어야 비교합니다. 1개월·3개월·1년 열은 각각 4주·13주·52주를 뜻합니다. 최신 미완결 주는 제외합니다.'} 관측이 없는 날짜는 채우지 않습니다.</p>${!direct ? `<p>참고지수 구성: ${list(overview.composite?.models).map(esc).join(' · ') || '공통 표본 부족'}. 표본 교체와 환율도 집계값을 바꿀 수 있습니다. 공급자 수가 유지되어도 같은 공급자 구성이라는 뜻은 아닙니다. ${url(research.history?.methodology_url, 'GetDeploying 방법론·원문 ↗')} · CC BY 4.0</p>` : ''}</details><div class="table-scroll"><table class="gpu-index-table"><thead><tr><th>GPU</th><th>가격지수</th><th>기간 변화</th>${direct ? '<th>동일 업체</th>' : '<th>1주</th><th>4주</th><th>13주</th><th>52주</th><th>업체 수 · 시작 → 종료</th>'}</tr></thead><tbody>${models.map((x) => `<tr><td>${esc(x.label)}</td><td>${fmt(x.index, 2)}</td><td class="${x.change > 0 ? 'gpu-up' : x.change < 0 ? 'gpu-down' : ''}">${gpuChange(x.change)}</td>${direct ? `<td>${x.providers}곳 · ${x.series.length}개 조건</td>` : `${['w1', 'w4', 'w13', 'w52'].map((k) => `<td>${gpuChange(x.changes?.[k]?.value)}</td>`).join('')}<td>${x.base_providers} → ${x.providers}${!x.eligible ? ' · 기준일/표본 부족' : ''}</td>`}</tr>`).join('')}</tbody></table></div>${!valid.length ? '<p class="note">선택한 기간의 공통 기준일 또는 최소 표본을 충족하지 못했습니다. 기간을 줄여 확인해 주세요.</p>' : ''}</div></section>`;
    }
    function gpuCommunity(research, f) {
      const items = list(research.community),
        reviewed = items
          .map((x) => x.reviewed_on)
          .sort()
          .at(-1),
        days = f.communityDays || '90',
        cutoff =
          reviewed && days !== 'all'
            ? new Date(Date.parse(reviewed) - Number(days) * 86400000).toISOString().slice(0, 10)
            : null,
        filtered = items.filter((x) => !cutoff || x.source_date >= cutoff);
      const topics = {
        availability: '실제 배정·재고',
        rent: '임대료',
        reliability: '운영 안정성',
        performance: '작업 성능',
        reservation: '예약·약정',
        multi_gpu_continuity: '멀티 GPU',
        price_comparison: '비용 비교',
      };
      const themes = [
        [
          '가격이 보여도 배정은 별개입니다',
          '일부 사용자는 GPU를 중지한 뒤 다시 확보하지 못하거나, 특정 지역과 GPU 구성에서 선택지가 줄었다고 보고했습니다. 각 글의 시점과 지역을 함께 보셔야 합니다.',
          [
            'gpu-community-gpucomm-20261001-gpu-recovery',
            'gpu-community-gpucomm-20261001-vultr-gpu-vps',
            'gpu-community-gpucomm-20260911-vast-sold-out',
          ],
        ],
        [
          '시간당 호가와 작업당 비용이 다릅니다',
          '같은 GPU 이름으로도 작업 시간·전송·저장소·복구 경험이 달랐다는 글이 있습니다. 저렴한 호가를 동일한 성능이나 총비용 절감으로 바로 읽기 어렵습니다.',
          [
            'gpu-community-gpucomm-20261024-community5090-perf',
            'gpu-community-gpucomm-20261001-rtx5090-tco',
          ],
        ],
        [
          '예약·Spot·공급자 설명을 구분합니다',
          '용량 확보 경험과 약정 협의, 중단 가능한 Spot의 경험은 서로 다른 조건입니다. 공급자 직원의 공급 설명과 판매자의 임대 제안도 따로 표시합니다.',
          [
            'gpu-community-gpucomm-20260920-b300-rental-reservation',
            'gpu-community-gpucomm-20260822-hn-gpu-capacity',
          ],
        ],
      ]
        .map(([heading, body, ids]) => {
          const matched = items.filter((x) => ids.includes(x.id));
          return matched.length
            ? `<article><h3>${esc(heading)}</h3><p>${esc(body)}</p><p class="source">${matched
                .slice(0, 2)
                .map(
                  (x) =>
                    `<a href="${esc(href('gpu', x.id))}">${esc(x.community)} · ${esc(x.source_date)}</a>`
                )
                .join(' · ')}</p></article>`
            : '';
        })
        .join('');
      return `<section class="panel gpu-community" id="section-gpu-community"><p class="eyebrow">DEVELOPER FIELD NOTES</p><h2>개발자들은 임대료와 재고를 어떻게 말하나요?</h2><p class="subtitle">확인한 게시물의 경험과 논쟁을 기록합니다. 가격표에 없는 배포·복구·성능 비용을 읽는 보조 자료입니다.</p>${themes ? `<div class="gpu-community-themes">${themes}</div>` : ''}<p class="gpu-index-caution">게시물은 자기보고이며 통계 표본이 아닙니다. ${items.length}건의 반응으로 시장 전체의 재고 부족·가격 급등·고장률을 판단하지 않습니다. 검색어와 커뮤니티 편중, 공급자·판매자의 이해관계가 있습니다. 게시물의 가격을 가격 지수에 넣지 않습니다. 조사 ${esc(reviewed || '미등록')} 기준입니다.</p><div class="filters">${gpuSelect(
        'communityDays',
        '반응 기간',
        [
          ['30', '최근 30일'],
          ['90', '최근 90일'],
          ['all', '전체 조사 기간'],
        ],
        days
      )}<span class="note">${filtered.length} / ${items.length}건 · 원문일 최신순</span></div><div class="gpu-community-list">${filtered.map((x) => `<details class="gpu-community-entry" ${getItemID() === x.id ? 'open' : ''}><summary><span class="meta">${esc(x.source_date)} · ${esc(x.community)}</span><strong>${esc(x.title)}</strong></summary><article data-item="${esc(x.id)}" tabindex="-1"><p>${esc(x.body)}</p><div class="meta">${x.topics.map((t) => badge(topics[t] || t)).join('')}</div><p class="note"><b>해석의 한계</b> · ${esc(x.limitation)}</p><p class="note"><b>발언자·이해관계</b> · ${esc(x.disclosure)} · ${esc(x.author)}</p><p class="source">${url(x.source_url, '커뮤니티 원문 ↗')} · ${anchor('gpu', x.id, '이 반응 주소 →')}</p></article></details>`).join('') || '<p class="quiet">선택 기간의 원문이 없습니다.</p>'}</div></section>`;
    }
    function gpuCatalog(research, f) {
      const catalog = research.catalog;
      if (!catalog) return '';
      const model = f.catalogModel || 'b300',
        provider = f.catalogProvider || 'all',
        billing = f.catalogBilling || 'on_demand',
        scope = f.catalogScope || 'all',
        state = f.catalogState || 'live',
        market = f.catalogMarket || 'all',
        vendorClass = f.catalogClass || 'all',
        limit = f.catalogLimit || '50';
      const gpuOptions = [...new Map(catalog.prices.map((q) => [q.gpu_id, q.gpu])).entries()].sort(
        (a, b) => a[1].localeCompare(b[1])
      );
      const filtered = catalog.prices
        .filter(
          (q) =>
            (model === 'all' || q.gpu_id === model) &&
            (provider === 'all' || q.provider_id === provider) &&
            (billing === 'all' || q.price_type === billing) &&
            (scope === 'all' || q.price_scope === scope) &&
            (state === 'all' || q.status === state) &&
            (market === 'all' || q.market === market) &&
            (vendorClass === 'all' ||
              research.segments?.provider_map[q.provider_id]?.group === vendorClass)
        )
        .sort(
          (a, b) => a.usd_per_gpu_hour - b.usd_per_gpu_hour || a.provider.localeCompare(b.provider)
        );
      const visible = limit === 'all' ? filtered : filtered.slice(0, Number(limit));
      return `<section class="panel gpu-catalog" id="section-gpu-catalog"><p class="eyebrow">PUBLIC PRICE CATALOGUE</p><h2>더 넓게 보는 공개 임대가격</h2><p>${catalog.provider_count}개 업체 · ${catalog.model_count}개 GPU · ${fmt(catalog.prices.length, 0)}개 공시·호가를 재수록했습니다. GPU Economy의 수집 결과이며, 모든 원문을 이 프로젝트에서 직접 검증한 자료는 아닙니다.</p><div class="filters">${gpuSelect('catalogModel', '카탈로그 GPU', [['all', '모든 GPU'], ...gpuOptions], model)}${gpuSelect('catalogClass', '카탈로그 업체군', gpuClassOptions, vendorClass)}${gpuSelect('catalogProvider', '카탈로그 업체', [['all', '모든 업체'], ...[...new Map(catalog.prices.map((q) => [q.provider_id, q.provider])).entries()].sort((a, b) => a[1].localeCompare(b[1]))], provider)}${gpuSelect('catalogBilling', '과금 조건', [['all', '모든 과금'], ...Object.entries(gpuBilling).filter(([id]) => id !== 'capacity_block')], billing)}${gpuSelect('catalogMarket', '상품 유형', [['all', '모든 상품'], ...Object.entries(gpuMarketLabels)], market)}${gpuSelect('catalogScope', '가격 범위', [['all', '모든 범위'], ...Object.entries(gpuScope)], scope)}${gpuSelect('catalogState', '가격 조회 상태', [['all', '과거·실패 포함'], ...Object.entries(gpuRead)], state)}${gpuSelect(
        'catalogLimit',
        '표시 행',
        [
          ['50', '50행'],
          ['200', '200행'],
          ['all', '전체'],
        ],
        limit
      )}</div><p class="note">조건에 맞는 ${filtered.length}행 중 ${visible.length}행 표시 · USD/GPU·시간. 재고와 임대 체결 여부는 미검증입니다. 같은 GPU라도 규격·지역·CPU·RAM·망·약정이 다릅니다. 서버리스는 실행시간을 GPU·시간으로 환산한 값이며, GPU 수는 최소 구매 수량을 뜻하지 않습니다.</p><div class="table-scroll"><table class="gpu-price-table"><thead><tr><th>업체·GPU</th><th>USD/GPU·시간</th><th>가격 범위·약정</th><th>지역·구성</th><th>원 요금·단위</th><th>가격 조회·출처</th></tr></thead><tbody>${visible.map((q) => `<tr><td><strong>${esc(q.provider)}</strong><small>${esc(research.segments?.provider_map[q.provider_id]?.label || '분류 확인 중')}</small>${q.provider_id === 'vessl' ? '<small>상품 범위 미확정 · 국내 통합 요금표 우선</small>' : ''}<small>${esc(q.gpu)}</small></td><td class="gpu-price">${fmt(q.usd_per_gpu_hour, 4)}</td><td>${esc(gpuBilling[q.price_type])} · ${esc(gpuMarketLabels[q.market] || q.market)}<small>${esc(gpuScope[q.price_scope])}${q.min_commitment ? ' · ' + esc(q.min_commitment) : ''}</small></td><td>${esc(q.region || '공시 지역 미지정')}<small>${esc(q.instance || 'SKU 미지정')} · ${q.gpu_count} GPU 환산 단위</small></td><td>${esc(q.listed_currency)} ${fmt(q.listed_price_hour, 5)} / ${q.listed_unit === 'per_node' ? '인스턴스' : 'GPU'}·시간${q.fx_date ? `<small>집계 환율 ${fmt(q.fx_rate, 6)} · ${esc(q.fx_date)}</small>` : ''}</td><td>${esc(q.last_confirmed_at?.slice(0, 10))}<small>${esc(gpuRead[q.status])}</small>${url(q.source_url, '공급자 원문 ↗')}</td></tr>`).join('')}</tbody></table></div><p class="gpu-index-caution">시작가격(from), GPU만의 요금, 최저 마켓플레이스 호가, 기간 약정과 Spot을 구분해 읽어 주세요. live는 가격이 최근 조회됐다는 뜻입니다. stopped·thin_market의 값은 과거 호가일 수 있습니다.</p><p class="source">${url(catalog.source_url, 'GPU Economy 원 데이터 ↗')} · ${url('https://gpueconomy.com/data', '방법론·CC BY 4.0')} · 자료 갱신 ${esc(catalog.data_updated_at)} · 수동 반영 ${esc(catalog.reviewed_on)}</p></section>`;
    }
    function gpuCrosschecks(research, f) {
      const priority = (r) =>
          ['public_json', 'discovery_only'].includes(r.access)
            ? 0
            : ['public_html', 'display_only'].includes(r.access)
              ? 1
              : 2,
        feeds = list(research.crosschecks)
          .slice()
          .sort((a, b) => priority(a) - priority(b) || a.title.localeCompare(b.title));
      if (!feeds.length) return '';
      const access = {
          public_json: '공개 JSON 수집',
          public_html: '공개 원문 검토',
          display_only: '제한된 표시·인용',
          discovery_only: '탐색 참고용',
          auth_required: '키·사용권한 필요',
          blocked: '접근 실패',
        },
        quality = {
          reference: '수집원 참고값',
          quarantined: '격리 · 재검증 필요',
          stale: '오래된 관측',
        },
        availability = {
          unknown: '재고 미확인',
          listed_available: '수집원: 가용 표기',
          listed_unavailable: '수집원: 품절 표기',
          provider_claim: '공급자 주장',
        },
        billing = {
          ...gpuBilling,
          marketplace: '마켓플레이스',
          serverless: '서버리스',
          unknown: '과금 미기재',
        };
      const selected =
        feeds.find((r) => r.feed_id === f.crossSource) ||
        feeds.find((r) => r.feed_id === 'gpu-rent-watch') ||
        feeds[0];
      const models = [
          ...new Set(
            [...selected.quotes, ...selected.history, ...selected.changes].map((q) => q.model)
          ),
        ].sort(),
        model =
          f.crossModel === 'all' || models.includes(f.crossModel)
            ? f.crossModel
            : models.includes('GB200')
              ? 'GB200'
              : 'all',
        state = f.crossQuality || 'reference';
      const match = (q) => model === 'all' || q.model === model,
        rows = selected.quotes.filter((q) => match(q) && (state === 'all' || q.quality === state)),
        visible = rows.slice(0, 50),
        histories = selected.history.filter(match),
        history = histories.find((h) => h.series_id === f.crossSeries) || histories[0],
        changes = selected.changes.filter(match);
      const points = (history?.points || []).slice().sort((a, b) => a.date.localeCompare(b.date)),
        valid = points.filter((p) => p.quality === 'reference'),
        first = valid[0],
        last = valid.at(-1),
        delta =
          first && last && first.date !== last.date ? (last.value / first.value - 1) * 100 : null;
      return `<section class="panel gpu-crosschecks" id="section-gpu-crosschecks"><p class="eyebrow">MULTI-SOURCE / CROSS-CHECK</p><h2>수집원을 넓혀 가격과 이력을 교차 확인합니다</h2><p>가격·이력을 실제로 읽은 공개 피드와, 별도 인용·접근 제약이 있는 경로를 함께 보여드립니다. 같은 공급자 요금이 여러 수집원에 나타나도 공급자 수를 늘리거나 지수에 중복 반영하지 않습니다.</p><div class="gpu-feed-grid">${feeds.map((r) => `<article class="gpu-feed-card"><div class="meta">${badge(access[r.access])}</div><h3>${url(r.source_url, r.title + ' ↗')}</h3><p><b>${fmt(r.quotes.length, 0)}개 가격 · ${fmt(r.history.length, 0)}개 이력 계열</b><small>자료 기준 ${esc(r.data_as_of || '개별 자료에서 확인')}<br>수동 조회 ${esc(r.observed_at)}</small></p><details><summary>수집 범위·사용조건·한계</summary><p>${esc(r.collection)}</p><p>${esc(r.upstream)}</p><p>${esc(r.license)}</p>${r.limitations.map((t) => `<p>${esc(t)}</p>`).join('')}<p>${url(r.methodology_url, '방법론·접근 조건 ↗')}</p></details></article>`).join('')}</div><div class="filters">${gpuSelect(
        'crossSource',
        '교차검증 수집원',
        feeds.map((r) => [r.feed_id, r.title]),
        selected.feed_id
      )}${gpuSelect('crossModel', '교차검증 GPU', [['all', '모든 GPU'], ...models.map((m) => [m, m])], model)}${gpuSelect(
        'crossQuality',
        '관측 품질',
        [
          ['reference', '수집원 참고값'],
          ['quarantined', '격리 값'],
          ['stale', '오래된 관측'],
          ['all', '모든 품질'],
        ],
        state
      )}</div><p class="gpu-index-caution">${esc(selected.title)} · ${esc(access[selected.access])}. 이 표는 별도 참고자료이며 위 가격지수에 들어가지 않습니다. 지역·GPU 수·조건이 미기재인 값과 실제 배정 여부는 확인이 더 필요합니다.${selected.access === 'discovery_only' ? ' 이 수집원은 탐색 후보만 제공하므로 정상 범위의 값도 원문 재검증이 필요합니다.' : ''}</p><p class="note">조건에 맞는 ${rows.length}행 중 ${visible.length}행 · USD/GPU·시간 · 조회시각 미기재는 파일 생성시각으로 채우지 않았습니다.</p><div class="table-scroll"><table class="gpu-cross-table"><thead><tr><th>공급자·GPU</th><th>USD/GPU·시간</th><th>원 조건·구성</th><th>자료 기준·품질</th><th>확인 범위·근거</th></tr></thead><tbody>${visible.map((q) => `<tr><td><b>${esc(q.provider)}</b><small>${esc(q.model)}</small></td><td class="gpu-price">${fmt(q.value, 4)}</td><td>${esc(billing[q.billing])}<small>${esc(q.sku)}</small><small>${q.gpu_count === null ? 'GPU 수 미기재' : q.gpu_count + ' GPU · 수집원 표기'} · ${esc(q.region || '지역 미기재')}</small></td><td>${esc(q.as_of || '개별 조회일 미기재')}<small>${esc(quality[q.quality])}</small><small>${esc(availability[q.availability])}</small></td><td>${esc(q.note)}<small>${url(q.source_url, '공급자·관측 근거 ↗')}</small></td></tr>`).join('') || '<tr><td colspan="5">선택 조건의 가격값이 없습니다. 접근 제약과 확인 범위는 위 수집원 카드에 남겼습니다.</td></tr>'}</tbody></table></div>${
        histories.length
          ? `<div class="gpu-cross-history"><h3>같은 수집원의 날짜별 이력</h3><div class="filters">${gpuSelect(
              'crossSeries',
              '가격 이력 계열',
              histories.map((h) => [h.series_id, h.provider + ' · ' + h.model + ' · ' + h.sku]),
              history.series_id
            )}</div><p>${esc(history.provider)} · ${esc(history.model)} · ${esc(billing[history.billing])} · ${first && last ? esc(first.date) + ' $' + fmt(first.value, 4) + ' → ' + esc(last.date) + ' $' + fmt(last.value, 4) : '비교할 유효 관측 부족'}${delta === null ? '' : ' · ' + gpuChange(delta)}</p>${chart([{ label: history.provider + ' · ' + history.model, points: points.map((p) => ({ label: p.date, value: p.quality === 'reference' ? p.value : null })) }], { unit: 'USD/GPU·시간', height: 220, gapDays: 1 })}<p class="note">${esc(history.note)} 가격과 상태가 기록된 점만 표시하고 관측 공백·격리 값을 채우지 않습니다. 양 끝 가격이 같아도 중간 기간 내내 같은 가격이었다는 뜻은 아닙니다. ${url(history.source_url, '이력 근거 ↗')}</p><details><summary>관측점 ${points.length}개와 품질 보기</summary><div class="table-scroll"><table><thead><tr><th>날짜</th><th>USD/GPU·시간</th><th>품질</th></tr></thead><tbody>${points.map((p) => `<tr><td>${esc(p.date)}</td><td>${fmt(p.value, 4)}</td><td>${esc(quality[p.quality])}</td></tr>`).join('')}</tbody></table></div></details></div>`
          : ''
      }${changes.length ? `<details class="gpu-price-events"><summary>이 수집원의 가격 변동 사례 · ${changes.length}건</summary><div class="table-scroll"><table><thead><tr><th>공급자·GPU</th><th>이전 → 이후 · USD/GPU·시간</th><th>관측 시각</th><th>비교 범위·근거</th></tr></thead><tbody>${changes.map((q) => `<tr><td>${esc(q.provider)} · ${esc(q.model)}<small>${esc(billing[q.billing])} · ${q.gpu_count || '미기재'} GPU · ${esc(q.region || '지역 미기재')}</small></td><td>${fmt(q.before, 4)} → ${fmt(q.after, 4)}<small>${gpuChange((q.after / q.before - 1) * 100)}</small></td><td>${esc(q.previous_on || '미기재')} → ${esc(q.current_on || '미기재')}</td><td>${esc({ same_sku: '수집원의 같은 공시항목 연결', market_floor: '지역·GPU 수별 마켓 최저 호가', unknown: '집계값·구성 변화 가능' }[q.comparison])}<small>${esc(q.note)}</small>${url(q.source_url, '변동 근거 ↗')}</td></tr>`).join('')}</tbody></table></div></details>` : ''}</section>`;
    }
    function gpuRegistry(research, f) {
      const registry = research.registry;
      if (!registry) return '';
      const query = (f.search || '').trim().toLowerCase(),
        mode = f.sourceMode || 'all',
        sourceClass = f.sourceClass || 'all',
        states = {
          direct_observed: '공식 직접 관측',
          official_reviewed: '공식 원문 검토',
          external_directory: '집계 경유 · 개별 검토 대기',
        },
        providers = registry.providers.filter(
          (p) =>
            (mode === 'all' || p.review_state === mode) &&
            (sourceClass === 'all' ||
              research.segments?.provider_map[p.id]?.group === sourceClass) &&
            [p.name, p.type, ...p.models].join(' ').toLowerCase().includes(query)
        ),
        reviews = registry.reviews.filter((p) =>
          [p.provider, p.type, ...p.models].join(' ').toLowerCase().includes(query)
        );
      return `<section class="panel gpu-registry" id="section-gpu-sources"><p class="eyebrow">SOURCE COVERAGE & GAPS</p><h2>가격 수집처와 남아 있는 공백</h2><p>공개 디렉터리의 등록 업체 ${registry.providers.length}곳 전체를 수록하고, 추가로 ${registry.reviews.length}개 조사 경로를 기록했습니다. 국내 클라우드·대형 클라우드·전문 GPU 클라우드·분산 마켓플레이스·서버리스를 포함합니다. 이 목록은 전 세계 사업자를 빠짐없이 확인했다는 뜻은 아닙니다.</p><div class="filters"><label>수집처 검색 <input data-search="gpu" aria-label="수집처 검색" value="${esc(f.search || '')}" placeholder="업체 또는 GPU 이름"></label>${gpuSelect('sourceClass', '수집처 업체군', gpuClassOptions, sourceClass)}${gpuSelect('sourceMode', '검토 범위', [['all', '모든 검토 범위'], ...Object.entries(states)], mode)}<span class="note">${providers.length} / ${registry.providers.length}개 등록 업체</span></div><div class="gpu-provider-grid">${providers.map((p) => `<article class="gpu-provider"><div class="meta">${badge(states[p.review_state])}${badge(research.segments?.provider_map[p.id]?.label || '분류 확인 중')}</div><h3>${url(p.pricing_page || p.website, p.name + ' ↗')}</h3><p class="note">집계 경로: ${esc(p.source_kind || '미지정')} · 외부 집계 ${p.current_quotes}행 · ${p.models_tracked}개 GPU</p><p>${esc(p.review_note)}</p><details><summary>상품·과금 해석 · 외부 원문 설명</summary><p>${esc(p.commercial_note)}</p></details><small>${esc(gpuAccess[p.access] || p.access)}${p.checked_on ? ' · 검토 ' + esc(p.checked_on) : ''}</small></article>`).join('')}</div><details class="gpu-source-reviews"><summary>국내·신규 업체와 비교 서비스의 조사 경로 ${reviews.length}건</summary><div class="table-scroll"><table><thead><tr><th>수집 경로</th><th>접근 상태</th><th>GPU·과금·지역</th><th>제한·후속 확인</th></tr></thead><tbody>${reviews.map((p) => `<tr><td>${url(p.url, p.provider)}<small>${esc(p.type)} · 검토 ${esc(p.checked_on)}</small></td><td>${esc(gpuAccess[p.access] || p.access)}<small>${esc(p.read_basis)}</small></td><td>${esc(p.models.join(' · '))}<small>${esc(p.billing)} · ${esc(p.region)}</small></td><td>${esc(p.limitations)}<small>${esc(p.collection_feasibility)}</small></td></tr>`).join('')}</tbody></table></div></details><p class="note">공식 직접 관측은 기존 수집기의 상품 조건에 한정됩니다. 공식 페이지를 검토했다는 표시가 그 업체의 모든 가격이나 API를 수집했다는 뜻은 아닙니다. 차단·로그인·문의 견적·미확인은 빈 가격으로 남깁니다. 자동 예약은 중지 상태입니다.</p><p class="source">${url(registry.source_url, 'GPU Economy 업체 디렉터리 ↗')} · CC BY 4.0 · 검토 ${esc(registry.reviewed_on)}</p></section>`;
    }
    function renderGPU(data, params) {
      const g = data.data,
        research = data.research || {},
        f = (filters.gpu ||= {});
      if (!g && !research.catalog)
        return title('gpu', data) + empty('아직 GPU 가격 관측이 없습니다');
      if (params?.get('id')) {
        f.model = g?.series.find((s) => s.id === params.get('id'))?.model || f.model;
        if (list(research.community).some((x) => x.id === params.get('id')))
          f.communityDays = 'all';
      }
      const gpuMeta = {
        ...data.meta,
        ...(research.catalog
          ? {
              count: research.catalog.prices.length,
              as_of: research.catalog.reviewed_on,
              generated_at:
                new Intl.DateTimeFormat('ko-KR', {
                  timeZone: 'Asia/Seoul',
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false,
                }).format(new Date(research.catalog.data_updated_at)) + ' KST',
            }
          : {}),
      };
      let html =
        title(
          'gpu',
          { ...data, meta: gpuMeta },
          '가격의 흐름, 실제 과금 조건, 개발자의 사용 경험을 함께 읽습니다.'
        ).replace('class="page-title"', 'class="page-title gpu-page-title"') +
        (gpuBriefing(data) || '') +
        `<nav class="gpu-jump" aria-label="GPU 페이지 안에서 이동"><a href="#gpu?section=gpu-overview">총괄 판단</a><a href="#gpu?section=gpu-index">지수 추이</a><a href="#gpu?section=gpu-insights">가격 변화 판독</a><a href="#gpu?section=gpu-segments">빅테크·네오클라우드</a><a href="#gpu?section=gpu-domestic">국내·한국계 가격</a><a href="#gpu?section=gpu-direct">공식 직접 관측</a><a href="#gpu?section=gpu-catalog">전체 가격 카탈로그</a><a href="#gpu?section=gpu-community">개발자 반응</a><a href="#gpu?section=gpu-crosschecks">수집원별 교차검증</a><a href="#gpu?section=gpu-sources">수집처·공백</a></nav>` +
        gpuOverview(research, f) +
        gpuPriceReading(research) +
        gpuSegments(research);
      if (g) {
        const model = f.model || 'b300-sxm',
          billing = f.directBilling || 'on_demand',
          items = g.series.filter(
            (s) => s.model === model && (billing === 'all' || s.billing === billing)
          ),
          latest = (s) =>
            g.observations
              .filter((o) => o.series === s.id)
              .sort((a, b) => b.date.localeCompare(a.date))[0];
        html += `<section class="panel gpu-direct" id="section-gpu-direct"><p class="eyebrow">OFFICIAL DIRECT OBSERVATIONS</p><h2>공식 원문에서 직접 관측한 가격</h2><p>기존 ${new Set(g.series.map((x) => x.provider)).size}개 업체 · ${g.series.length}개 고정 상품 조건을 보존합니다. 신규 집계 카탈로그의 가격은 이 직접 관측 이력에 섞지 않습니다.</p><div class="filters">${gpuSelect(
          'model',
          '직접 관측 GPU',
          g.models.map((x) => [x.id, x.label]),
          model
        )}${gpuSelect(
          'directBilling',
          '직접 관측 과금',
          [
            ['on_demand', '온디맨드'],
            ['capacity_block', '선불 Capacity Blocks'],
            ['all', '모든 과금 · 별개 계열'],
          ],
          billing
        )}</div>${chart(
          items.map((s) => ({
            label: s.provider + ' · ' + (gpuBilling[s.billing] || s.billing),
            points: g.observations
              .filter((o) => o.series === s.id)
              .sort((a, b) => a.date.localeCompare(b.date))
              .map((o) => ({ label: o.date, value: o.status === 'ok' ? o.price : null })),
          })),
          { unit: 'USD/GPU·시간', gapDays: 3 }
        )}<div class="table-scroll"><table><thead><tr><th>공급자</th><th>지역·과금</th><th>최근 시도 가격</th><th>관측일·상태</th><th>구성·근거</th></tr></thead><tbody>${items
          .map((s) => {
            const x = latest(s);
            return `<tr data-item="${esc(s.id)}" tabindex="-1"><td>${esc(s.provider)}</td><td>${esc(s.region)}<small>${esc(gpuBilling[s.billing] || s.billing)}</small></td><td>${x?.status === 'ok' ? fmt(x.price, 4) : '—'}</td><td>${esc(x?.date || '관측 없음')}<small>${x?.status === 'ok' ? '정상 관측' : x ? '수집 실패 · 가격 미확인' : '미관측'}</small></td><td>${esc(s.scope)}<small>${esc(s.note)}</small>${url(s.source)}</td></tr>`;
          })
          .join(
            ''
          )}</tbody></table></div><p class="note">GPU 관측 원문 조회일과 원문 게시일은 다를 수 있습니다. 과거 카탈로그 복원은 직접 관측에 이어 붙이지 않습니다. 공시 가격은 즉시 임대할 수 있는 재고를 증명하지 않습니다.</p><a class="source" href="legacy.html#gpu">과거 카탈로그 복원과 기존 상세 화면 ↗</a></section>`;
      }
      return (
        html +
        gpuCrosschecks(research, f) +
        gpuDomestic(research, f) +
        gpuCatalog(research, f) +
        gpuCommunity(research, f) +
        gpuRegistry(research, f)
      );
    }
    return { render: renderGPU };
  }
  return { create };
});
