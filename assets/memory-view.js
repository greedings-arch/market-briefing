// Pure rendering helpers; importing this module never mounts a page or loads data.
(function (root, factory) {
  if (typeof module === 'object' && module.exports)
    module.exports = factory(require('./market-ui'));
  else root.MarketMemory = factory(root.MarketUI);
})(typeof window === 'object' ? window : globalThis, (ui) => {
  'use strict';
  const { badge, empty, esc, fmt, list, palette, select, source, url } = ui;
  function create({ config, filters, title, viewportWidth }) {
    const memoryNames = {
      samsung: 'Samsung',
      'sk-hynix': 'SK hynix',
      'sk-hynix-group': 'SK hynix + Solidigm',
      micron: 'Micron',
      kioxia: 'Kioxia',
      sandisk: 'SanDisk / WDC',
      cxmt: 'CXMT',
      nanya: 'Nanya',
      winbond: 'Winbond',
      psmc: 'PSMC',
      others: 'Others',
    };
    const memoryColors = {
      samsung: '#244f79',
      'sk-hynix': '#bb813b',
      'sk-hynix-group': '#bb813b',
      micron: '#378379',
      kioxia: '#7f9c52',
      sandisk: '#8874a3',
      cxmt: '#b56758',
      nanya: '#7398af',
      winbond: '#b5aa7e',
      psmc: '#9ba6b0',
      others: '#c8d0d7',
    };
    const memorySigned = (n, suffix = '%') =>
      Number.isFinite(n) ? `${n > 0 ? '+' : ''}${fmt(n)}${suffix}` : '—';
    const memoryQuarter = (q, n = 1) => {
      const v = Number(q.slice(0, 4)) * 4 + Number(q.at(-1)) - 1 - n;
      return Math.floor(v / 4) + '-Q' + ((v % 4) + 1);
    };
    const memoryCompanyBasis = (r, id) =>
      r.comparison_regime +
      (r.market === 'dram' && id === 'others'
        ? r.quarter >= '2026-Q1'
          ? ':cxmt-separated'
          : ':cxmt-not-separated'
        : '');
    function memoryDelta(records, current, company, n = 1) {
      const old = records.find(
        (x) => x.market === current.market && x.quarter === memoryQuarter(current.quarter, n)
      );
      if (!old || memoryCompanyBasis(old, company) !== memoryCompanyBasis(current, company))
        return null;
      const a = current.companies.find((x) => x.company_id === company)?.share_pct,
        b = old.companies.find((x) => x.company_id === company)?.share_pct;
      return Number.isFinite(a) && Number.isFinite(b) ? a - b : null;
    }
    function memoryChange(points, days) {
      const last = points.at(-1);
      if (!last) return null;
      if (last.date_basis === 'reported_month') {
        const n = { 30: 1, 90: 3, 365: 12 }[days],
          v = Number(last.period.slice(0, 4)) * 12 + Number(last.period.slice(5)) - 1 - n,
          target = Math.floor(v / 12) + '-' + String((v % 12) + 1).padStart(2, '0'),
          old = points.find((p) => p.period === target);
        return old && old.source_name === last.source_name
          ? (last.value / old.value - 1) * 100
          : null;
      }
      const target = Date.parse(last.date) - days * 86400000,
        old = points
          .filter(
            (p) => Date.parse(p.date) <= target && Date.parse(p.date) >= target - 14 * 86400000
          )
          .at(-1);
      return old && old.source_name === last.source_name
        ? (last.value / old.value - 1) * 100
        : null;
    }
    function memoryCSV(label, columns, rows, filename) {
      const csv =
        '\ufeff' +
        [columns, ...rows]
          .map((row) => row.map((v) => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(','))
          .join('\r\n');
      return `<a class="memory-download" download="${esc(filename)}" href="data:text/csv;charset=utf-8,${encodeURIComponent(csv)}">${esc(label)} ↓</a>`;
    }
    function memoryChart(
      series,
      { unit = '', quarter = false, fixedMax = null, height = 260 } = {}
    ) {
      const points = series.flatMap((s) => s.points).filter((p) => Number.isFinite(p.value));
      if (!points.length)
        return '<p class="quiet">이 조건에 맞는 가격·점유율 자료가 없습니다. 다른 기간이나 시리즈를 선택해 주세요.</p>';
      const w = Math.min(920, Math.max(320, (viewportWidth() || 1016) - 96)),
        h = height,
        l = 66,
        r = 22,
        t = 22,
        b = 39,
        when = (p) =>
          quarter ? Number(p.date.slice(0, 4)) * 4 + Number(p.date.at(-1)) : Date.parse(p.date),
        xs = points.map(when),
        a = Math.min(...xs),
        z = Math.max(...xs),
        values = points.map((p) => p.value),
        lo = fixedMax ? 0 : Math.min(...values),
        hi = fixedMax || Math.max(...values),
        pad = fixedMax ? 0 : (hi - lo) * 0.12 || Math.abs(hi) * 0.1 || 1;
      const bottom = lo >= 0 ? Math.max(0, lo - pad) : lo - pad,
        top = hi + pad;
      const x = (p) => l + ((when(p) - a) / (z - a || 1)) * (w - l - r),
        y = (v) => h - b - ((v - bottom) / (top - bottom || 1)) * (h - t - b);
      let svg = `<svg class="chart memory-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(unit)} 추이"><title>${esc(series.map((s) => s.label).join(', '))}</title>`;
      for (let i = 0; i < 5; i++) {
        const v = bottom + ((top - bottom) * i) / 4;
        svg += `<line class="gridline" x1="${l}" x2="${w - r}" y1="${y(v)}" y2="${y(v)}"/><text x="${l - 10}" y="${y(v) + 4}" text-anchor="end">${fmt(v)}</text>`;
      }
      series.forEach((s, i) => {
        let d = '',
          prev = null;
        const color = s.color || palette[i % palette.length];
        for (const p of s.points.filter((p) => Number.isFinite(p.value))) {
          const gap =
            prev &&
            (when(p) - when(prev) >
              (quarter
                ? 1
                : (s.frequency === 'monthly' ? 35 : s.frequency === 'weekly' ? 10 : 4) *
                  86400000) ||
              p.regime !== prev.regime);
          d += (prev && !gap ? 'L' : 'M') + x(p).toFixed(2) + ',' + y(p.value).toFixed(2);
          prev = p;
        }
        svg += `<path class="line" stroke="${color}" d="${d}"/>`;
        for (const p of s.points.filter((p) => Number.isFinite(p.value)))
          svg += `<circle cx="${x(p)}" cy="${y(p.value)}" r="3" fill="${color}"><title>${esc(s.label)} · ${esc(p.date_basis === 'reported_month' ? p.period : p.date)} · ${fmt(p.value, 3)} ${esc(unit)}${p.source_date ? ' · 원문 ' + esc(p.source_published_date || p.source_date) : ''}</title></circle>`;
      });
      const dates = [
        ...new Set(points.map((p) => (p.date_basis === 'reported_month' ? p.period : p.date))),
      ].sort();
      svg += `<text x="${l}" y="${h - 10}">${esc(dates[0])}</text><text x="${w - r}" y="${h - 10}" text-anchor="end">${esc(dates.at(-1))}</text></svg>`;
      return `<div class="chart-wrap">${svg}<div class="legend">${series.map((s, i) => `<span><i style="background:${s.color || palette[i % palette.length]}"></i>${esc(s.label)}</span>`).join('')}<span>${esc(unit)}</span></div></div>`;
    }
    function memoryShareBars(rows) {
      return `<div class="memory-bars" aria-label="공표 매출 점유율 구성">${rows
        .slice(-8)
        .map((q) => {
          let used = 0;
          return `<div class="memory-bar-row"><span>${esc(q.quarter)}</span><div class="memory-bar">${q.companies
            .filter((v) => Number.isFinite(v.share_pct))
            .map((v) => {
              const width = Math.max(0, Math.min(v.share_pct, 100 - used));
              used += width;
              return `<i style="width:${width}%;background:${memoryColors[v.company_id]}" title="${esc(memoryNames[v.company_id])} ${fmt(v.share_pct)}%"><span>${v.share_pct >= 12 ? fmt(v.share_pct, 1) + '%' : ''}</span></i>`;
            })
            .join(
              ''
            )}${used < 99.5 ? `<i class="memory-uncovered" style="width:${100 - used}%" title="공표 업체 외 잔여 ${fmt(100 - used)}% · 계산값"></i>` : ''}</div></div>`;
        })
        .join(
          ''
        )}</div><p class="note">최근 8개 확보 분기 · 점유율을 100%로 재정규화하지 않았습니다. 사선은 100%에서 공표 업체 합계를 뺀 잔여분입니다.</p>`;
    }
    function memoryShares(data, market = 'dram') {
      const f = filters.memory || {},
        all = list(data.market_shares)
          .filter((x) => x.market === market)
          .sort((a, b) => a.quarter.localeCompare(b.quarter));
      if (!all.length)
        return (
          '<section class="panel">' +
          empty(
            '아직 확인한 업체별 점유율이 없습니다',
            'TrendForce 공개 업체표에서 매출과 점유율을 확인한 뒤 반영합니다.'
          ) +
          '</section>'
        );
      const current = all.find((x) => x.quarter === f.shareQuarter) || all.at(-1),
        main =
          market === 'dram'
            ? ['samsung', 'sk-hynix', 'micron']
            : ['samsung', 'sk-hynix-group', 'kioxia', 'micron', 'sandisk'],
        scope = f.shareScope || '주요 업체',
        metric = f.shareMetric || 'share',
        companies =
          scope === '공표 업체 전체'
            ? [...new Set(all.flatMap((q) => q.companies.map((v) => v.company_id)))]
            : main,
        rows = f.sharePeriod === '최근 8분기' ? all.slice(-8) : all;
      let html = `<section class="panel memory-share-panel"><div class="panel-head"><div><p class="eyebrow">REVENUE SHARE / ${market.toUpperCase()}</p><h2>${market === 'dram' ? 'DRAM 3사와 추격 업체' : 'NAND 5개 그룹'}의 매출 점유율</h2></div>${badge('매출 기준')}</div><p class="memory-explainer">${market === 'dram' ? 'DRAM 전체 매출 기준이며 HBM이 포함됩니다. 범용 DRAM 경쟁력과 HBM 제품 구성이 함께 반영됩니다.' : 'SK hynix와 Solidigm은 하나의 그룹입니다. WDC의 NAND 사업은 2025년 표부터 SanDisk로 표시합니다. 공표 5개 그룹 외의 시장도 남겨 둡니다.'}</p>`;
      html += `<div class="filters">${select('shareMetric', '비교 지표', ['share', 'revenue'], metric).replace('>share<', '>매출 점유율<').replace('>revenue<', '>업체 매출<')}${select('sharePeriod', '추적 기간', ['전체', '최근 8분기'], f.sharePeriod || '전체')}${market === 'dram' ? select('shareScope', '업체 범위', ['주요 업체', '공표 업체 전체'], scope) : ''}</div>`;
      html += memoryChart(
        companies.map((id) => ({
          label: memoryNames[id],
          color: memoryColors[id],
          points: rows.flatMap((q) => {
            const v = q.companies.find((v) => v.company_id === id),
              value = metric === 'share' ? v?.share_pct : v?.revenue_usd_million;
            return Number.isFinite(value)
              ? [
                  {
                    date: q.quarter,
                    value,
                    regime: memoryCompanyBasis(q, id),
                    source_date: q.source_date,
                  },
                ]
              : [];
          }),
        })),
        { quarter: true, unit: metric === 'share' ? '매출 점유율 %' : 'USD million' }
      );
      html +=
        '<p class="note">2023-Q1 달력분기 통일, 2025-Q1 공급업체·사업 범위 변경 경계에서는 선을 끊고 증감 계산을 보류합니다. 2026-Q1 CXMT 분리 전후의 Others도 비교하지 않습니다. 빈 분기도 연결하지 않습니다.</p>' +
        memoryShareBars(rows);
      html += `<div class="panel-head memory-table-head"><h3>선택 분기 상세</h3>${select('shareQuarter', '상세 분기', all.map((x) => x.quarter).reverse(), current.quarter)}</div><div class="table-scroll"><table class="memory-numeric"><thead><tr><th>업체</th><th>매출 · USD million</th><th>매출 점유율</th><th>전분기 대비</th><th>전년 대비</th></tr></thead><tbody>${current.companies
        .slice()
        .sort((a, b) => (b.share_pct ?? -1) - (a.share_pct ?? -1))
        .map(
          (v) =>
            `<tr><th scope="row"><span class="memory-company-dot" style="background:${memoryColors[v.company_id]}"></span>${esc(v.reported_name || memoryNames[v.company_id])}</th><td>${fmt(v.revenue_usd_million, 1)}</td><td><b>${Number.isFinite(v.share_pct) ? fmt(v.share_pct) + '%' : '—'}</b></td><td>${memorySigned(memoryDelta(all, current, v.company_id), '%p')}</td><td>${memorySigned(memoryDelta(all, current, v.company_id, 4), '%p')}</td></tr>`
        )
        .join('')}</tbody></table></div>`;
      html += `<div class="memory-totals"><span>${current.total_scope === 'market' ? '전체시장 매출' : '상위 5개 그룹 매출'} <b>${fmt(current.total_revenue_usd_million, 1)}</b> USD million</span><span>${market === 'dram' ? '주요 3사' : '상위 5개 그룹'} 공표 점유율 <b>${fmt(current.top_vendor_share_pct)}%</b></span></div><p class="note">—는 비교 가능한 수치가 없거나 집계 기준이 바뀐 경우입니다. 반올림 때문에 합계에 0.1~0.3%p 차이가 있을 수 있습니다.</p><p class="memory-method-note">${esc(current.coverage_note)}</p>${source(current)}${list(
        current.references
      )
        .map((r) => `<p class="source">${esc(r.label)} · ${esc(r.date)} · ${url(r.url)}</p>`)
        .join(
          ''
        )}<p class="source">${url(current.table_url, 'TrendForce 원문 업체표 ↗')} · 조회 ${esc(current.observed_at?.slice(0, 10))}</p></section>`;
      return html;
    }
    const memoryPriceDate = (r) =>
      r?.date_basis === 'reported_month'
        ? r.period
        : r?.date_basis === 'publication_snapshot'
          ? r.date + ' (발간일; 가격일 미명시)'
          : r?.date || '공백';
    function memoryPriceSource(r) {
      return (
        '<p class="source">' +
        esc(
          r.source_name || (r.source_basis === 'public_report' ? '공개 보고서' : '공식 공개 가격표')
        ) +
        ' · ' +
        (r.source_published_date
          ? '발간 ' +
            esc(r.source_published_date) +
            (r.source_page ? ' · p.' + esc(r.source_page) : '')
          : '가격 기준 ' + esc(r.date)) +
        ' · ' +
        url(r.source_url) +
        '</p>' +
        (r.source_note ? '<p class="note">' + esc(r.source_note) + '</p>' : '')
      );
    }
    function memoryCorePrices(data) {
      const keys = ['ddr5-16gb-spot', 'server-rdimm32-spot', 'server-rdimm64-asp'];
      return (
        '<section class="panel memory-core"><p class="eyebrow">DDR5 / SERVER MEMORY</p><h2>DDR5 칩과 서버 RDIMM 가격</h2><p>현물은 유통시장의 수급을, 월별 계약가는 공급자 매출에 연결되는 가격을 확인하는 자료입니다. 칩과 완제품 모듈의 단위를 구분해 읽습니다.</p><div class="memory-core-grid">' +
        keys
          .map((id) => {
            const spec = config.memory.series.find((s) => s.id === id),
              rows = list(data.items)
                .filter((r) => r.series_id === id)
                .sort((a, b) => a.date.localeCompare(b.date)),
              last = rows.at(-1);
            return (
              '<article class="memory-core-card" data-item="' +
              esc(last?.id || id) +
              '"><span>' +
              esc(spec.label) +
              '</span><strong>' +
              fmt(last?.value, 3) +
              '</strong><small>' +
              esc(spec.unit) +
              ' · ' +
              esc(memoryPriceDate(last)) +
              '</small>' +
              (last
                ? '<p class="note">' +
                  (last.price_low !== undefined
                    ? '공표 범위 ' +
                      fmt(last.price_low, 2) +
                      '–' +
                      fmt(last.price_high, 2) +
                      ' ' +
                      esc(last.unit) +
                      '<br>'
                    : '') +
                  esc(spec.scope_note || spec.spec) +
                  '</p><details><summary>출처·집계 조건</summary>' +
                  memoryPriceSource(last) +
                  '</details>'
                : '<p class="quiet">정확한 모듈 계약가 원문을 아직 확보하지 못했습니다.</p>') +
              '</article>'
            );
          })
          .join('') +
        '</div><p class="memory-method-note">32GB RDIMM 현물과 64GB RDIMM ASP 전언은 용량·거래시장·확인 수준이 다릅니다. 두 값을 두 배로 환산해 비교하지 않습니다. 64GB ASP는 증권사 공개 정리값이며 원천 계약가 표는 미열람입니다. 각 가격의 기준일을 함께 표시합니다.</p></section>'
      );
    }
    function memoryDdr5Trend(data) {
      const f = filters.memory || {},
        ids = [
          'ddr5-16gb-contract-monthly',
          'ddr5-16gb-broker-spot',
          'ddr5-16gb-media-spot',
          'ddr5-16gb-spot',
        ],
        labels = [
          '월별 계약가 · 공표 품목',
          '증권사 기준일 현물 · 4800/5600',
          '언론 재공표 현물 · 4800/5600',
          '직접 관측 현물 · 4800/5600',
        ],
        all = list(data.items).filter((r) => ids.includes(r.series_id)),
        latest = all
          .map((r) => r.date)
          .sort()
          .at(-1),
        cut = f.ddr5Period === 'all' ? 0 : Date.parse(latest) - 365 * 86400000,
        series = ids.map((id, i) => {
          const spec = config.memory.series.find((s) => s.id === id);
          return {
            label: labels[i],
            frequency: spec.frequency,
            points: all
              .filter((r) => r.series_id === id && Date.parse(r.date) >= cut)
              .sort((a, b) => a.date.localeCompare(b.date))
              .map((r) => ({ ...r, regime: r.source_name })),
          };
        });
      return (
        '<section class="panel memory-ddr5-trend"><div class="panel-head"><div><p class="eyebrow">DDR5 16Gb / PRICE TREND</p><h2>DDR5 가격은 최근까지 어떻게 움직였나요?</h2></div>' +
        select('ddr5Period', 'DDR5 추적 기간', ['365', 'all'], f.ddr5Period || '365')
          .replace('>365<', '>최근 1년<')
          .replace('>all<', '>전체<') +
        '</div>' +
        memoryChart(series, { unit: 'USD/chip' }) +
        '<p class="memory-method-note">계약가는 공표 대상 월, 증권사 현물은 보고서에 명시된 가격 기준일, 언론 재공표 현물은 기사에 인용된 호가 기준일, 직접 현물은 가격표 기준일입니다. 서로 다른 주기의 방향을 함께 보되 월별 프리미엄으로 계산하지 않습니다. 월별 계약가는 속도·제조사·월 집계방법이 미명시되어 있습니다.</p><div class="stats">' +
        series
          .map((s) => {
            const last = s.points.at(-1);
            return (
              '<article class="stat-card"><span>' +
              esc(s.label) +
              '</span><b>' +
              fmt(last?.value, 3) +
              '</b><small>USD/chip · ' +
              esc(memoryPriceDate(last)) +
              '</small>' +
              (last
                ? '<details><summary>출처와 집계 조건</summary>' +
                  memoryPriceSource(last) +
                  '</details>'
                : '') +
              '</article>'
            );
          })
          .join('') +
        '</div><p class="note">누락 구간과 발간 출처 전환은 선으로 잇지 않습니다. 월별 현물과 계약가가 모두 확보된 기간은 <a href="#memory?view=compare">현물·계약가 비교</a>에서 확인하실 수 있습니다.</p></section>'
      );
    }
    function memoryMonthlyCoverage(data) {
      const rows = list(data.monthly_coverage).filter((x) => x.count),
        spec = (id) => config.memory.series.find((s) => s.id === id);
      return (
        '<section class="panel memory-continuity"><div class="panel-head"><div><p class="eyebrow">MONTHLY COVERAGE</p><h2>최근까지 얼마나 이어졌나요?</h2></div>' +
        badge('미확보 월을 채워 넣지 않음') +
        '</div><p class="note">진행 중인 달은 완결 월에서 제외합니다. 초록은 확인된 월, 빈 칸은 미확보 월이며, 회색 대시는 해당 계열의 추적 범위 밖입니다. 최신 일간 현물 한 건을 월별 과거값으로 바꾸지 않습니다.</p><div class="table-scroll"><table><thead><tr><th>가격 계열</th><th>확보 월</th><th>최신 대상 월</th><th>최근 12개월</th><th>남은 공백</th></tr></thead><tbody>' +
        rows
          .map(
            (r) =>
              '<tr><th scope="row">' +
              esc(spec(r.series_id)?.label) +
              '</th><td>' +
              r.count +
              '개월</td><td>' +
              esc(r.last) +
              '</td><td><div class="memory-month-grid" aria-label="' +
              esc(spec(r.series_id)?.label) +
              ' 월별 확보 현황">' +
              Array(Math.max(0, 12 - r.months.length))
                .fill('<span class="outside" title="추적 범위 밖">—</span>')
                .join('') +
              r.months
                .slice(-12)
                .map(
                  (x) =>
                    '<span class="' +
                    (x.present ? 'present' : 'missing') +
                    '" title="' +
                    esc(x.period) +
                    ' ' +
                    (x.present ? '확인' : '미확보') +
                    '">' +
                    esc(x.period.slice(5)) +
                    '</span>'
                )
                .join('') +
              '</div></td><td>' +
              (r.missing.length
                ? '<details><summary>' +
                  r.missing.length +
                  '개월 · ' +
                  esc(r.through) +
                  '까지</summary><p>' +
                  esc(r.missing.join(', ')) +
                  '</p></details>'
                : '공백 없음 · ' + esc(r.through) + '까지') +
              '</td></tr>'
          )
          .join('') +
        '</tbody></table></div></section>'
      );
    }
    function memoryMatchedPrices(data) {
      const pairs = list(data.price_comparisons),
        f = filters.memory || {},
        pair = pairs.find((x) => x.id === f.pricePair) || pairs[0];
      if (!pair) return '';
      const rows = pair.matched,
        last = rows.at(-1),
        selected = rows.find((x) => x.period === f.compareMonth) || last;
      let html =
        '<section class="panel memory-comparison"><div class="panel-head"><div><p class="eyebrow">SPOT / CONTRACT</p><h2>현물·계약가를 같은 조건에서 비교합니다</h2></div>' +
        badge(
          pair.status === 'exact'
            ? '동일 규격'
            : pair.status === 'reported_product'
              ? '공표 품목 참고 비교'
              : '비교 보류'
        ) +
        '</div><div class="filters">' +
        select(
          'pricePair',
          '비교 품목',
          pairs.map((x) => x.id),
          pair.id
        ).replace(
          />(ddr5-16gb-monthly|rdimm32|rdimm64)</g,
          (_, id) => '>' + esc(pairs.find((x) => x.id === id).label) + '<'
        ) +
        '</div><p class="memory-method-note">' +
        esc(pair.reason) +
        '</p>';
      html +=
        '<p class="note">각 계열의 최신 대상: 현물 ' +
        esc(memoryPriceDate(pair.latest_spot)) +
        ' · 계약가 ' +
        esc(memoryPriceDate(pair.latest_contract)) +
        '. 공통 기간이 없는 최신값은 괴리 계산에서 제외합니다.</p>';
      if (pair.status === 'blocked') {
        html +=
          '<div class="two-cols">' +
          [
            ['마지막 현물', pair.latest_spot],
            ['마지막 계약가', pair.latest_contract],
          ]
            .map(
              ([label, p]) =>
                '<article class="stat-card"><span>' +
                label +
                '</span><b>' +
                fmt(p?.value, 3) +
                '</b><small>' +
                esc(p?.unit || pair.unit) +
                ' · ' +
                esc(memoryPriceDate(p)) +
                '</small>' +
                (p ? memoryPriceSource(p) : '<p class="note">공개 원문 미확보</p>') +
                '</article>'
            )
            .join('') +
          '</div><p class="note">표시된 두 최신값의 차이나 비율은 계산하지 않습니다. 용량 배수로 환산하거나 ASP 전언을 계약가로 대체하지 않습니다.</p>';
      } else if (!rows.length) {
        html += '<p class="quiet">두 계열에 같은 대상 기간의 실제 가격이 아직 없습니다.</p>';
      } else {
        if (selected.source_changed)
          html +=
            '<p class="unit-warning">선택 월의 현물과 계약가는 발간 출처가 다릅니다. 아래 차이는 공표 품목의 참고값이며 동일한 집계방법의 가격차로 확정할 수 없습니다.</p>';
        html +=
          '<div class="filters">' +
          select(
            'compareMonth',
            '비교 대상 월',
            rows.map((r) => r.period).reverse(),
            selected.period
          ) +
          '</div><div class="stats memory-compare-stats">' +
          [
            ['현물', selected.spot.value, pair.unit],
            ['계약가', selected.contract.value, pair.unit],
            ['현물 − 계약가', selected.spread, pair.unit],
            ['현물 프리미엄', selected.premium_pct, '%'],
          ]
            .map(
              ([label, value, unit]) =>
                '<div class="stat-card"><span>' +
                label +
                '</span><b>' +
                fmt(value, 2) +
                '</b><small>' +
                esc(unit) +
                ' · ' +
                esc(selected.period) +
                '</small></div>'
            )
            .join('') +
          '</div>';
        html += memoryChart(
          ['spot', 'contract'].map((kind, i) => ({
            label: kind === 'spot' ? '현물' : '계약가',
            frequency: pair.frequency,
            color: palette[i],
            points: rows.map((r) => ({ ...r[kind], regime: r[kind].source_name })),
          })),
          { unit: pair.unit }
        );
        html += memoryChart(
          [
            {
              label: '(현물 ÷ 계약가 − 1) × 100',
              frequency: pair.frequency,
              points: rows.map((r) => ({
                date: r.date,
                period: r.period,
                date_basis: r.date_basis,
                value: r.premium_pct,
                regime: r.spot.source_name + ' / ' + r.contract.source_name,
              })),
            },
          ],
          { unit: '현물 프리미엄 %', height: 190 }
        );
        html +=
          '<p class="note">공통 대상 기간 ' +
          rows.length +
          '개 · 최신 공통 월 ' +
          esc(last.period) +
          '. 프리미엄은 계약가를 분모로 계산합니다. 출처가 바뀌거나 월 자료가 빠지면 선을 끊습니다. 서로 다른 발간 시점의 자료를 현재 재구성한 비교로, 당시 매매 가능 신호나 순수 수급 효과를 뜻하지 않습니다.</p><div class="two-cols">' +
          memoryPriceSource(selected.spot) +
          memoryPriceSource(selected.contract) +
          '</div>';
        html += memoryCSV(
          '현물·계약가 비교 CSV',
          [
            'product',
            'comparison_status',
            'period',
            'spot',
            'contract',
            'spread',
            'premium_pct',
            'unit',
            'spot_source',
            'spot_publication',
            'contract_source',
            'contract_publication',
            'scope',
            'spot_note',
            'contract_note',
            'different_publishers',
          ],
          rows.map((r) => [
            pair.label,
            pair.status,
            r.period,
            r.spot.value,
            r.contract.value,
            r.spread,
            r.premium_pct,
            pair.unit,
            r.spot.source_url,
            r.spot.source_published_date || r.spot.source_date,
            r.contract.source_url,
            r.contract.source_published_date || r.contract.source_date,
            pair.reason,
            r.spot.source_note,
            r.contract.source_note,
            r.source_changed,
          ]),
          'memory-spot-contract-comparison.csv'
        );
        html +=
          '<details class="memory-revisions"><summary>공통 기간의 가격·괴리 전체 표</summary><div class="table-scroll"><table><thead><tr><th>대상 월</th><th>현물</th><th>계약가</th><th>차액</th><th>프리미엄</th><th>출처</th></tr></thead><tbody>' +
          rows
            .slice()
            .reverse()
            .map(
              (r) =>
                '<tr><th scope="row">' +
                esc(r.period) +
                '</th><td>' +
                fmt(r.spot.value, 3) +
                '</td><td>' +
                fmt(r.contract.value, 3) +
                '</td><td>' +
                fmt(r.spread, 3) +
                '</td><td>' +
                memorySigned(r.premium_pct) +
                '</td><td>' +
                url(r.spot.source_url, '현물') +
                ' · ' +
                url(r.contract.source_url, '계약가') +
                '</td></tr>'
            )
            .join('') +
          '</tbody></table></div></details>';
      }
      return html + '</section>';
    }
    function memoryRdimmTrend(data) {
      const f = filters.memory || {},
        basis = f.rdimmBasis === 'contract' ? 'contract' : 'reported_asp',
        series = config.memory.series.filter(
          (s) => s.id.startsWith('server-rdimm') && s.market === basis && s.frequency === 'monthly'
        ),
        rows = list(data.items),
        selected = series.map((s) => ({
          label: s.label,
          frequency: 'monthly',
          points: rows
            .filter((r) => r.series_id === s.id)
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((r) => ({ ...r, regime: r.source_name })),
        }));
      return (
        '<section class="panel memory-rdimm-trend"><div class="panel-head"><div><p class="eyebrow">SERVER RDIMM / CAPACITY</p><h2>RDIMM 용량별 월별 추이</h2></div>' +
        select('rdimmBasis', 'RDIMM 자료 기준', ['contract', 'reported_asp'], basis)
          .replace('>contract<', '>공개 보고서 계약가<')
          .replace('>reported_asp<', '>증권사 공개 ASP 전언<') +
        '</div><p class="note">16GB·32GB·64GB 모듈 각각의 가격입니다. ' +
        (basis === 'reported_asp'
          ? 'SK증권 공개 게시물의 ASP 전언이며 원천 계약가표는 미열람입니다.'
          : '증권사 공개 보고서에 실린 월별 고정가격입니다.') +
        ' 속도와 제조사 범위가 미명시된 값은 32GB 4800/5600 현물과 동일 규격으로 비교하지 않습니다.</p>' +
        memoryChart(selected, { unit: 'USD/module' }) +
        '<p class="note">월별 35일 초과 공백과 발간 출처 전환에서는 선을 끊습니다. 계약가와 ASP 전언은 선택한 자료 기준 안에서만 연결합니다.</p><div class="stats">' +
        selected
          .map((s) => {
            const last = s.points.at(-1);
            return (
              '<article class="stat-card"><span>' +
              esc(s.label) +
              '</span><b>' +
              fmt(last?.value) +
              '</b><small>USD/module · ' +
              esc(memoryPriceDate(last)) +
              ' · ' +
              s.points.length +
              '개 월별 표본</small><p class="note">1개월 ' +
              memorySigned(memoryChange(s.points, 30)) +
              ' · 3개월 ' +
              memorySigned(memoryChange(s.points, 90)) +
              '</p>' +
              (last ? memoryPriceSource(last) : '') +
              '</article>'
            );
          })
          .join('') +
        '</div></section>'
      );
    }
    function memoryPriceHistory(data) {
      const f = filters.memory || {},
        series = [...config.memory.history_series, ...config.memory.series],
        selected = f.selected || [
          'ddr5-16gb-spot-monthly',
          'ddr5-16gb-contract-monthly',
          'server-rdimm64-contract',
        ],
        mode = f.mode || 'actual',
        period = f.period || 'all',
        points = [...list(data.history), ...list(data.items)],
        grouped = Object.fromEntries(
          series.map((s) => [
            s.id,
            points.filter((x) => x.series_id === s.id).sort((a, b) => a.date.localeCompare(b.date)),
          ])
        );
      let html =
        '<section class="panel memory-prices"><div class="panel-head"><div><p class="eyebrow">PUBLIC HISTORY</p><h2>공개 가격으로 보는 사이클</h2></div>' +
        badge('월별 계약가 / 주간·일간 현물') +
        '</div><p class="memory-explainer">월별 값은 보고서의 대상 월이며 월말 일자는 정렬용입니다. 일간 현물과 별도 시리즈로 표시합니다. 주간 이력의 날짜는 코멘터리 발간일입니다. “이번 주”로 명시된 가격 한 개만 복원했습니다. DDR4 2666과 3200은 다른 시리즈이며, NAND TLC 512Gb 웨이퍼 상태 다이는 MLC 64Gb 칩과 다릅니다.</p><div class="series-select">';
      html +=
        series
          .map(
            (s) =>
              `<label><input type="checkbox" data-memory-series="${esc(s.id)}" ${selected.includes(s.id) ? 'checked' : ''}>${esc(s.label)}${s.frequency === 'weekly' ? ' · 주간' : s.frequency === 'monthly' ? ' · 월별' : ''}</label>`
          )
          .join('') + '</div>';
      html += `<div class="filters">${select('mode', '가격 보기', ['actual', 'index', 'yoy'], mode).replace('>actual<', '>실제가<').replace('>index<', '>지수 (공통 기준일=100)<').replace('>yoy<', '>전년 대비<')}${select('period', '가격 기간', ['90', '365', 'all'], period).replace('>90<', '>3개월<').replace('>365<', '>1년<').replace('>all<', '>전체<')}</div>`;
      const newest = points
          .map((x) => x.date)
          .sort()
          .at(-1),
        cut = period === 'all' ? 0 : Date.parse(newest) - Number(period) * 86400000,
        chosen = series.filter((s) => selected.includes(s.id)),
        units = [...new Set(chosen.map((s) => s.unit))];
      if (units.length > 1)
        html +=
          '<div class="unit-warning" role="status">단위가 다른 시리즈를 선택했습니다. 실제가는 단위별로 표시합니다. USD/chip, USD/512Gb die, USD/module은 서로 바꿔 계산할 수 없습니다.</div>';
      const nonempty = chosen.filter((s) => grouped[s.id].some((p) => Date.parse(p.date) >= cut)),
        common = nonempty[0]
          ? grouped[nonempty[0].id].find(
              (p) =>
                Date.parse(p.date) >= cut &&
                nonempty.every((s) => grouped[s.id].some((q) => q.date === p.date))
            )?.date
          : null;
      if (mode === 'index' && nonempty.length > 1 && !common)
        html +=
          '<div class="unit-warning">선택한 시리즈에 공통 기준일이 없습니다. 규격·기간을 바꿔 주세요. 서로 다른 시작일을 같은 100으로 표시하지 않습니다.</div>';
      else
        for (const unit of mode === 'actual' ? units : ['normalized']) {
          const ss = chosen
            .filter((s) => mode !== 'actual' || s.unit === unit)
            .map((s, i) => {
              let rows = grouped[s.id].filter((p) => Date.parse(p.date) >= cut),
                base =
                  mode === 'index'
                    ? grouped[s.id].find((p) => p.date === (common || rows[0]?.date))
                    : null;
              const transformed =
                mode === 'index'
                  ? rows
                      .filter((p) => p.date >= base?.date && p.source_name === base?.source_name)
                      .map((p) => ({ ...p, value: (p.value / base.value) * 100 }))
                  : mode === 'yoy'
                    ? rows.flatMap((p) => {
                        const dt = new Date(p.date);
                        dt.setUTCFullYear(dt.getUTCFullYear() - 1);
                        const time = +dt,
                          old =
                            p.date_basis === 'reported_month'
                              ? grouped[s.id].find(
                                  (q) =>
                                    q.period ===
                                    Number(p.period.slice(0, 4)) - 1 + p.period.slice(4)
                                )
                              : grouped[s.id]
                                  .filter(
                                    (q) =>
                                      Date.parse(q.date) <= time &&
                                      Date.parse(q.date) >= time - 14 * 86400000
                                  )
                                  .at(-1);
                        return old && old.source_name === p.source_name
                          ? [{ ...p, value: (p.value / old.value - 1) * 100 }]
                          : [];
                      })
                    : rows;
              return {
                label: s.label,
                frequency: s.frequency || 'daily',
                color: palette[i % palette.length],
                points: transformed.map((r) => ({ ...r, regime: r.source_name })),
              };
            });
          html += memoryChart(ss, {
            unit:
              mode === 'actual'
                ? unit
                : mode === 'index'
                  ? `지수 · ${common || (nonempty[0] && grouped[nonempty[0].id].find((p) => Date.parse(p.date) >= cut)?.date) || '자료 없음'} = 100`
                  : '전년 대비 %',
          });
        }
      html +=
        '<p class="note">월별 표본은 35일, 주간 표본은 10일, 일간 관측은 4일을 넘는 공백에서 선을 끊습니다. 출처 전환 전후의 변동률·전년 대비·기준지수는 계산하지 않습니다. 가격 변동률은 확보 표본 기준이며, 월말 종가 수익률이 아닙니다. NAND의 USD/512Gb die는 웨이퍼 한 장의 가격을 뜻하지 않습니다.</p></section>';
      const historySeries = [
        ...config.memory.series.filter((s) => s.frequency === 'monthly'),
        ...config.memory.history_series,
      ];
      html +=
        '<div class="stats memory-price-stats">' +
        historySeries
          .map((s) => {
            const p = grouped[s.id],
              last = p.at(-1);
            return `<article class="stat-card" data-item="${esc(last?.id || s.id)}" tabindex="-1"><span>${esc(s.label)}</span><b>${fmt(last?.value, 3)}</b><small>${esc(s.unit)} · ${s.frequency === 'monthly' ? '대상 월' : '가격/발간일'} ${esc(memoryPriceDate(last))}</small><p class="note">${[30, 90, 365].map((n, i) => `${['1개월', '3개월', '1년'][i]} ${memorySigned(memoryChange(p, n))}`).join(' · ')}<br>표본 ${p.length}개 · ${esc(p[0]?.date || '—')}부터</p>${last ? memoryPriceSource(last) : ''}</article>`;
          })
          .join('') +
        '</div>';
      return html;
    }
    function memoryContracts(data) {
      const all = list(data.quarters),
        quarters = [...new Set(all.map((x) => x.quarter))].sort(),
        products = [...new Set(all.map((x) => x.product))];
      let html =
        '<section class="panel"><div class="panel-head"><div><p class="eyebrow">CONTRACT PRICE / QoQ</p><h2>분기 계약가의 방향과 전망 수정</h2></div>' +
        badge('실측·전망 구분') +
        '</div><p class="memory-explainer">전분기 대비 계약가 변화율입니다. 과거 전망은 대상 분기가 지났어도 전망으로 남깁니다. 같은 품목·분기는 가장 늦게 발간된 수치를 보여 드리고 이전 전망은 수정 이력에 보존합니다. “DRAM 전체”와 “일반 DRAM”도 합치지 않습니다.</p>';
      if (!all.length) return html + '<p class="quiet">확인된 분기 수치가 없습니다.</p></section>';
      html +=
        '<div class="table-scroll"><table class="memory-heatmap"><thead><tr><th>품목 · 구분</th>' +
        quarters.map((q) => `<th>${esc(q)}</th>`).join('') +
        '</tr></thead><tbody>';
      for (const p of products)
        for (const kind of ['actual', 'forecast']) {
          if (!all.some((x) => x.product === p && x.kind === kind)) continue;
          html +=
            `<tr><th scope="row">${esc(p)} · ${kind === 'actual' ? '실측' : '전망'}</th>` +
            quarters
              .map((q) => {
                const records = all
                    .filter((x) => x.product === p && x.kind === kind && x.quarter === q)
                    .sort((a, b) => a.source_date.localeCompare(b.source_date)),
                  x = records.at(-1);
                if (!x) return '<td class="memory-gap">—</td>';
                return `<td class="${x.low >= 0 ? 'memory-heat-up' : x.high <= 0 ? 'memory-heat-down' : 'memory-heat-mixed'} ${kind === 'forecast' ? 'memory-forecast' : ''}"><b>${fmt(x.low)}${x.low === x.high ? '' : '~' + fmt(x.high)}%</b><span>${url(x.source_url, x.source_date)}</span>${records.length > 1 ? `<small>이전 전망 ${records.length - 1}개</small>` : ''}</td>`;
              })
              .join('') +
            '</tr>';
        }
      html +=
        '</tbody></table></div><details class="memory-revisions"><summary>발간 시점별 전체 수치와 수정 이력 ' +
        all.length +
        '건</summary><div class="table-scroll"><table><thead><tr><th>대상 분기</th><th>품목</th><th>구분</th><th>QoQ</th><th>원문 발간일</th><th>범위·한계</th></tr></thead><tbody>' +
        all
          .slice()
          .sort((a, b) => b.source_date.localeCompare(a.source_date))
          .map(
            (x) =>
              `<tr data-item="${esc(x.id)}"><td>${esc(x.quarter)}</td><td>${esc(x.product)}</td><td>${x.kind === 'actual' ? '실측' : '전망'}</td><td>${fmt(x.low)}~${fmt(x.high)}%</td><td>${url(x.source_url, x.source_date)}</td><td>${esc(x.note || '원문 공개 범위')}</td></tr>`
          )
          .join('') +
        '</tbody></table></div></details></section>';
      return html;
    }
    function memoryCost(data) {
      const series = config.memory.series,
        grouped = Object.fromEntries(
          series.map((s) => [
            s.id,
            list(data.items)
              .filter((x) => x.series_id === s.id)
              .sort((a, b) => a.date.localeCompare(b.date)),
          ])
        ),
        server = grouped['server-rdimm64-contract']?.at(-1);
      let html = '<div class="two-cols"><section class="panel"><h2>서버 1대 메모리 원가</h2>';
      html += server
        ? `<p class="memory-cost">$${fmt(server.value * 16)}</p><p class="note">64GB RDIMM × 16 = 1,024GB<br>${fmt(server.value)} USD/module × 16 · 대상 ${esc(memoryPriceDate(server))}</p><p class="note">해당 기간 계약가로 계산한 메모리 부품값입니다. 실제 서버 구매견적은 아닙니다.</p>${memoryPriceSource(server)}`
        : '<p class="quiet">64GB RDIMM 모듈 단가를 직접 확인한 후 계산합니다. 칩 가격으로 대체하지 않습니다.</p>';
      html +=
        '</section><section class="panel"><h2>현물·계약가 비교</h2><p>같은 제품·기간의 가격과 프리미엄 추이를 확인합니다. 속도·제조사·집계방법이 미명시된 비교는 참고 비교로 구분합니다.</p><a href="#memory?view=compare">가격·괴리 추이와 비교 조건 확인 →</a></section></div>';
      return html;
    }
    function memoryEvidence(data) {
      const history = list(data.history),
        priceRows = [...list(data.items), ...history],
        priceSeries = [...config.memory.series, ...config.memory.history_series],
        shares = list(data.market_shares),
        f = filters.memory || {},
        sid = f.evidenceSeries || 'ddr5-16gb-spot',
        selected = priceRows
          .filter((x) => x.series_id === sid)
          .sort((a, b) => b.date.localeCompare(a.date));
      let html =
        '<section class="panel"><p class="eyebrow">COVERAGE & PROVENANCE</p><h2>백필 범위와 남은 공백</h2><div class="memory-coverage-grid">';
      html += list(data.coverage?.shares)
        .map(
          (x) =>
            `<div><b>${x.market.toUpperCase()} ${x.count}개 분기</b><p>${esc(x.first || '—')} ~ ${esc(x.last || '—')}</p><p class="note">${x.gaps.length ? '공백: ' + esc(x.gaps.join(', ')) : '확보한 최신 분기까지 분기 공백 없음'}</p></div>`
        )
        .join('');
      html +=
        priceSeries
          .map((s) => {
            const a = priceRows
              .filter((x) => x.series_id === s.id)
              .sort((a, b) => a.date.localeCompare(b.date));
            return `<div><b>${esc(s.label)}</b><p>${a.length}개 ${s.frequency === 'monthly' ? '월별' : s.frequency === 'weekly' ? '주간' : s.frequency === 'irregular' ? '보고서 시점' : '일간'} 표본</p><p class="note">${esc(a[0]?.date || '—')} ~ ${esc(a.at(-1)?.date || '—')}</p></div>`;
          })
          .join('') +
        '</div><p class="memory-method-note">2022년 일간 현물 가격은 미확보입니다. 회원 전용 차트·유료 과거 이력을 우회하지 않았습니다. 공개 주간 코멘터리가 없는 주, 가격이나 규격이 명시되지 않은 글은 빈 구간입니다. 매출이 공개되지 않은 업체 값도 점유율에서 역산하지 않았습니다.</p>';
      html +=
        '<div class="memory-downloads">' +
        memoryCSV(
          '주간 가격 CSV',
          [
            'series_id',
            'publication_date',
            'value',
            'unit',
            'frequency',
            'date_basis',
            'source_url',
            'retrieved_at',
          ],
          history.map((r) => [
            r.series_id,
            r.date,
            r.value,
            r.unit,
            r.frequency,
            r.date_basis,
            r.source_url,
            r.observed_at,
          ]),
          'memory-weekly-prices.csv'
        ) +
        memoryCSV(
          'DDR5·RDIMM 및 직접 가격 CSV',
          [
            'series_id',
            'sort_date',
            'period',
            'date_basis',
            'value',
            'unit',
            'frequency',
            'source_publication_date',
            'source_page',
            'source_url',
            'source_note',
          ],
          list(data.items).map((r) => [
            r.series_id,
            r.date,
            r.period,
            r.date_basis || 'source_date',
            r.value,
            r.unit,
            r.frequency || 'daily',
            r.source_published_date || r.source_date,
            r.source_page,
            r.source_url,
            r.source_note,
          ]),
          'memory-ddr5-rdimm-prices.csv'
        ) +
        memoryCSV(
          '업체별 점유율 CSV',
          [
            'quarter',
            'market',
            'company',
            'revenue_usd_million',
            'share_pct',
            'comparison_regime',
            'publication_date',
            'source_url',
            'table_url',
            'additional_revenue_sources',
          ],
          shares.flatMap((r) =>
            r.companies.map((v) => [
              r.quarter,
              r.market,
              v.reported_name || memoryNames[v.company_id],
              v.revenue_usd_million,
              v.share_pct,
              r.comparison_regime,
              r.source_date,
              r.source_url,
              r.table_url,
              list(r.references)
                .map((x) => x.date + ' ' + x.url)
                .join(' | '),
            ])
          ),
          'memory-revenue-shares.csv'
        ) +
        '</div></section>';
      html += `<section class="panel"><div class="panel-head"><h2>가격 원자료 · 월별·주간·일간</h2>${select(
        'evidenceSeries',
        '원자료 시리즈',
        priceSeries.map((s) => s.id),
        sid
      )}</div><p class="note">시리즈 식별자는 각 규격의 이력을 구분합니다. 주간 이력은 원문 발간일, 직접 관측과 증권사 기준일 가격은 해당 가격일, 기준일 미명시 스냅샷은 보고서 발간일, 월별 보고서 값은 대상 월을 표시합니다.</p><div class="table-scroll"><table><thead><tr><th>가격 기준</th><th>가격</th><th>단위</th><th>원문·발간일</th><th>조회일</th></tr></thead><tbody>${selected.map((r) => `<tr data-item="${esc(r.id)}"><td>${esc(memoryPriceDate(r))}</td><td>${fmt(r.value, 3)}</td><td>${esc(r.unit)}</td><td>${url(r.source_url, r.source_name || '공식 원문 ↗')}<small>${esc(r.source_published_date || r.source_date)}${r.source_page ? ' · p.' + esc(r.source_page) : ''}</small></td><td>${esc(r.observed_at?.slice(0, 10))}</td></tr>`).join('')}</tbody></table></div></section>`;
      html +=
        '<section class="panel"><h2>분기별 원문 업체표</h2><div class="table-scroll"><table><thead><tr><th>시장</th><th>대상 분기</th><th>원문 발간일</th><th>확인 업체</th><th>원문 표</th><th>남은 공백</th></tr></thead><tbody>' +
        shares
          .slice()
          .sort((a, b) => b.quarter.localeCompare(a.quarter) || a.market.localeCompare(b.market))
          .map(
            (r) =>
              `<tr data-item="${esc(r.id)}"><td>${r.market.toUpperCase()}</td><td>${esc(r.quarter)}</td><td>${url(r.source_url, r.source_date)}</td><td>${r.companies.length}</td><td>${url(r.table_url, '공개 표 ↗')}</td><td>${
                r.companies
                  .filter((v) => v.revenue_usd_million === null)
                  .map((v) => esc(memoryNames[v.company_id]) + ' 매출')
                  .join(', ') || '—'
              }</td></tr>`
          )
          .join('') +
        '</tbody></table></div></section>';
      return html;
    }
    function renderMemory(data, params = new URLSearchParams()) {
      const view = ['overview', 'dram', 'nand', 'prices', 'compare', 'evidence'].includes(
          params.get('view')
        )
          ? params.get('view')
          : 'overview',
        shares = list(data.market_shares),
        dram = shares
          .filter((x) => x.market === 'dram')
          .sort((a, b) => a.quarter.localeCompare(b.quarter))
          .at(-1),
        nand = shares
          .filter((x) => x.market === 'nand')
          .sort((a, b) => a.quarter.localeCompare(b.quarter))
          .at(-1),
        history = list(data.history),
        last = history
          .filter((x) => x.series_id === 'ddr4-8gb-3200-weekly')
          .sort((a, b) => a.date.localeCompare(b.date))
          .at(-1);
      let html =
        title(
          'memory',
          data,
          '현물 가격, 분기 계약가, 업체별 매출 점유율을 연결해 이익의 방향과 경쟁 구도를 읽습니다.'
        ) +
        '<nav class="memory-nav" aria-label="메모리 분석 보기">' +
        [
          ['overview', '한눈에 보기'],
          ['dram', 'DRAM 점유율'],
          ['nand', 'NAND 점유율'],
          ['prices', '가격·계약가 추이'],
          ['compare', '현물·계약가 비교'],
          ['evidence', '원자료·백필 검증'],
        ]
          .map(
            ([id, label]) =>
              `<a href="#memory?view=${id}" ${view === id ? 'aria-current="page" class="active"' : ''}>${label}</a>`
          )
          .join('') +
        '</nav>';
      if (view === 'dram' || view === 'nand') return html + memoryShares(data, view);
      if (view === 'compare')
        return (
          html + memoryMatchedPrices(data) + memoryRdimmTrend(data) + memoryMonthlyCoverage(data)
        );
      if (view === 'prices')
        return (
          html +
          memoryCorePrices(data) +
          memoryDdr5Trend(data) +
          memoryRdimmTrend(data) +
          memoryPriceHistory(data) +
          memoryContracts(data) +
          memoryCost(data)
        );
      if (view === 'evidence') return html + memoryMonthlyCoverage(data) + memoryEvidence(data);
      html += memoryCorePrices(data) + memoryDdr5Trend(data) + memoryRdimmTrend(data);
      html +=
        '<section class="memory-cover"><div><p class="eyebrow">MEMORY CYCLE / COMPETITIVE POSITION</p><h2>가격이 오를 때,<br>누가 매출을 가져가는지 봅니다.</h2><p>가격 상승률과 업체별 점유율을 함께 보셔야 시장 회복과 경쟁력 변화를 구분할 수 있습니다.</p></div><div class="memory-cover-data"><span>현물·계약가 가격 관측</span><b>' +
        (history.length + list(data.items).length) +
        '<small>개 표본</small></b><span>업체별 분기 자료</span><b>' +
        shares.length +
        '<small>개 시장·분기</small></b><a href="#memory?view=evidence">백필 범위와 출처 확인 →</a></div></section>';
      html +=
        '<div class="stats memory-headline-stats">' +
        (last
          ? `<a class="stat-card" href="#memory?view=prices"><span>DDR4 8Gb 3200 · 주간 현물</span><b>${fmt(last.value, 3)}</b><small>USD/chip · 원문 발간 ${esc(last.date)}</small></a>`
          : '') +
        (dram
          ? `<a class="stat-card" href="#memory?view=dram"><span>Samsung · DRAM 매출 점유율</span><b>${fmt(dram.companies.find((v) => v.company_id === 'samsung')?.share_pct)}<small>%</small></b><small>${esc(dram.quarter)} · 전분기 ${memorySigned(memoryDelta(shares, dram, 'samsung'), '%p')}</small></a>`
          : '') +
        (nand
          ? `<a class="stat-card" href="#memory?view=nand"><span>NAND 주요 5개 그룹 · 공표 점유율</span><b>${fmt(nand.top_vendor_share_pct)}<small>%</small></b><small>${esc(nand.quarter)} · 전체시장의 100%가 아닙니다</small></a>`
          : '') +
        '</div>';
      html +=
        '<section class="panel"><p class="eyebrow">HOW TO READ THE EVIDENCE</p><h2>투자 판단에서 확인할 세 가지</h2><div class="memory-reading-grid"><article><span>01 / 가격</span><h3>현물의 방향을 계약가로 확인합니다</h3><p>현물은 유통 재고와 단종 품목의 수급에도 흔들립니다. 다음 분기 계약가가 같은 방향으로 움직이는지, 전망이 상향·하향 수정되는지 확인하십시오.</p><a href="#memory?view=prices">가격과 전망 수정 이력 →</a></article><article><span>02 / 경쟁</span><h3>시장 성장과 점유율 상승을 나눕니다</h3><p>시장 매출이 늘어도 업체 점유율은 낮아질 수 있습니다. DRAM은 HBM을 포함하므로 비트 출하량·제품 구성·ASP를 회사 실적에서 추가로 확인해야 합니다.</p><a href="#memory?view=dram">3사와 추격 업체 비교 →</a></article><article><span>03 / 반증</span><h3>상승률 둔화와 점유율 하락을 점검합니다</h3><p>다음 발표에서 계약가 상승률이 낮아지고 업체 점유율도 하락한다면, 매출 증가만으로 경쟁력이 강화됐다고 판단하기 어렵습니다. 주가·밸류에이션은 별도 확인이 필요합니다.</p><a href="#memory?view=nand">NAND 경쟁 구도 확인 →</a></article></div></section>';
      html += memoryShares(data, 'dram');
      if (nand)
        html +=
          '<section class="panel memory-nand-callout"><div><p class="eyebrow">NAND / TOP FIVE</p><h2>5개 그룹의 점유율 밖에도 시장이 있습니다</h2><p>' +
          esc(nand.quarter) +
          ' 공표 점유율 합계는 ' +
          fmt(nand.top_vendor_share_pct) +
          '%입니다. 나머지를 5개 그룹에 나눠 넣으면 실제 경쟁 구도를 과장하게 됩니다.</p>' +
          source(nand) +
          '</div><a href="#memory?view=nand">NAND 점유율 전체 보기 →</a></section>';
      html +=
        '<details class="memory-direct panel"><summary>전체 현물·계약가 마지막 관측값</summary><div class="table-scroll"><table><thead><tr><th>품목</th><th>마지막 가격</th><th>단위</th><th>원천 기준일</th><th>원문</th></tr></thead><tbody>' +
        config.memory.series
          .map((s) => {
            const r = list(data.items)
              .filter((x) => x.series_id === s.id)
              .sort((a, b) => a.date.localeCompare(b.date))
              .at(-1);
            return `<tr><th scope="row">${esc(s.label)}</th><td>${fmt(r?.value, 3)}</td><td>${esc(s.unit)}</td><td>${esc(memoryPriceDate(r))}</td><td>${r ? url(r.source_url) : '자료 미확보'}</td></tr>`;
          })
          .join('') +
        '</tbody></table></div></details>';
      html += memoryContracts(data) + memoryCost(data);
      if (list(data.statements).length || list(data.events).length)
        html +=
          '<section class="panel"><h2>가격 사건과 기업 발언</h2>' +
          [...list(data.events), ...list(data.statements)]
            .map(
              (r) =>
                `<article class="memory-context"><h3>${esc(r.title)}</h3>${r.body ? `<p>${esc(r.body)}</p>` : ''}${r.investment_impact ? `<p>${esc(r.investment_impact)}</p>` : ''}${source(r)}</article>`
            )
            .join('') +
          '</section>';
      if (list(data.gaps).length)
        html +=
          '<details class="queue"><summary>일간 현물 관측 누락 ' +
          data.gaps.length +
          '건</summary><ul>' +
          data.gaps
            .map(
              (g) =>
                `<li>${esc(g.date)} · ${esc(config.memory.series.find((s) => s.id === g.series_id)?.label)} · ${esc(g.reason)}</li>`
            )
            .join('') +
          '</ul></details>';
      return (
        html +
        '<p class="note">2022년 이후 점유율과 공개 주간 가격을 별도 백필했습니다. 일간 미수집 구간, 모듈 계약가, 미공개 업체 매출은 원자료·백필 검증에서 확인하실 수 있습니다.</p>'
      );
    }
    return { render: renderMemory };
  }
  return { create };
});
