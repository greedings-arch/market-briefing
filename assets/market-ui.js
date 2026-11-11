// Pure rendering helpers; importing this module never mounts a page or loads data.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MarketUI = factory();
})(typeof window === 'object' ? window : globalThis, () => {
  'use strict';
  const esc = (x) =>
    String(x ?? '').replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  const list = (x) => (Array.isArray(x) ? x : []);
  const fmt = (x, d = 2) =>
    Number.isFinite(x) ? x.toLocaleString('ko-KR', { maximumFractionDigits: d }) : '—';
  const palette = ['#224d72', '#b38346', '#528874', '#b46e59', '#89749c', '#597f8a'];
  function url(value, label = '원문 ↗') {
    try {
      const u = new URL(value);
      if (!['http:', 'https:'].includes(u.protocol)) return esc(label);
      return `<a href="${esc(u.href)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`;
    } catch {
      return esc(label);
    }
  }
  const badge = (x) =>
    `<span class="tag ${x === '낙관' ? 'positive' : x === '경계' ? 'negative' : x === '확인 필요' ? 'pending' : ''}">${esc(x)}</span>`;
  const source = (x) =>
    `<p class="source">${esc(x.source_name || x.company || x.institution || '원문')} · ${esc(x.source_date || '원문 날짜 미확인')} · ${url(x.source_url)}</p>`;
  const empty = (
    title = '아직 수집된 자료가 없습니다',
    body = '원문을 확인한 자료가 반영되면 이곳에 표시됩니다.'
  ) =>
    `<div class="empty"><div class="empty-mark">—</div><strong>${esc(title)}</strong><p>${esc(body)}</p><a href="#sources">수집 범위와 운영 상태 확인 →</a></div>`;
  function select(key, label, values, value = '전체') {
    return `<label>${esc(label)} <select data-filter="${key}" aria-label="${esc(label)}">${values.map((v) => `<option value="${esc(v)}" ${v === value ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label>`;
  }
  function chart(series, { unit = '', height = 220, gapDays = 4 } = {}) {
    const all = series.flatMap((x) => x.points).filter((x) => Number.isFinite(x.value));
    if (!all.length) return '<p class="note">표시할 수 있는 숫자 데이터가 없습니다.</p>';
    const w = 850,
      h = height,
      left = 62,
      right = 18,
      top = 17,
      bottom = 36,
      numeric = all.every((x) => /^\d{4}-\d{2}-\d{2}$/.test(x.label));
    const labels = [...new Set(all.map((p) => p.label))];
    if (numeric) labels.sort();
    const xvalue = (p) => (numeric ? Date.parse(p.label) : labels.indexOf(p.label)),
      xs = all.map(xvalue),
      minX = Math.min(...xs),
      maxX = Math.max(...xs),
      ys = all.map((x) => x.value),
      minY = Math.min(...ys),
      maxY = Math.max(...ys),
      pad = (maxY - minY) * 0.12 || Math.abs(maxY) * 0.1 || 1;
    const x = (p) => left + ((xvalue(p) - minX) / (maxX - minX || 1)) * (w - left - right),
      y = (v) => h - bottom - ((v - minY + pad) / (maxY - minY + pad * 2)) * (h - top - bottom);
    let svg = `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(unit)} 추이"><title>${esc(series.map((s) => s.label).join(', '))}</title>`;
    for (let i = 0; i < 4; i++) {
      const v = minY - pad + ((maxY - minY + pad * 2) * i) / 3;
      svg += `<line class="gridline" x1="${left}" x2="${w - right}" y1="${y(v)}" y2="${y(v)}"/><text x="${left - 9}" y="${y(v) + 4}" text-anchor="end">${fmt(v)}</text>`;
    }
    for (let i = 0; i < series.length; i++) {
      const s = series[i],
        points = s.points.filter((p) => Number.isFinite(p.value));
      let path = '',
        prev = null;
      for (const p of s.points) {
        if (!Number.isFinite(p.value)) {
          prev = null;
          continue;
        }
        const gap =
          numeric && prev && Date.parse(p.label) - Date.parse(prev.label) > gapDays * 86400000;
        path += (prev && !gap ? 'L' : 'M') + x(p).toFixed(2) + ',' + y(p.value).toFixed(2);
        prev = p;
      }
      svg += `<path class="line" stroke="${palette[i % palette.length]}" d="${path}"/>`;
      for (const p of points)
        svg += `<circle cx="${x(p)}" cy="${y(p.value)}" r="2.5" fill="${palette[i % palette.length]}"><title>${esc(s.label)} ${esc(p.label)}: ${fmt(p.value)} ${esc(unit)}</title></circle>`;
    }
    svg += `<text x="${left}" y="${h - 9}">${esc(labels[0])}</text><text x="${w - right}" y="${h - 9}" text-anchor="end">${esc(labels.at(-1))}</text></svg>`;
    return `<div class="chart-wrap">${svg}<div class="legend">${series.map((s, i) => `<span><i style="background:${palette[i % palette.length]}"></i>${esc(s.label)}</span>`).join('')}<span>${esc(unit)}</span></div></div>`;
  }
  function table(columns, rows) {
    return `<div class="table-scroll"><table><thead><tr>${columns.map((c) => `<th scope="col">${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((v) => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  function priceChange(points, days) {
    if (points.length < 2) return null;
    const latest = points.at(-1),
      cutoff = Date.parse(latest.date) - days * 86400000,
      base = points
        .filter((p) => Date.parse(p.date) <= cutoff && Date.parse(p.date) >= cutoff - 7 * 86400000)
        .at(-1);
    return base ? (latest.value / base.value - 1) * 100 : null;
  }
  function transformPrice(points, mode) {
    if (mode === 'index') {
      const base = points[0]?.value;
      return base ? points.map((p) => ({ label: p.date, value: (p.value / base) * 100 })) : [];
    }
    if (mode === 'yoy')
      return points
        .map((p) => {
          const target = new Date(p.date);
          target.setUTCFullYear(target.getUTCFullYear() - 1);
          const time = +target,
            old = points
              .filter(
                (x) => Date.parse(x.date) <= time && Date.parse(x.date) >= time - 7 * 86400000
              )
              .at(-1);
          return { label: p.date, value: old ? (p.value / old.value - 1) * 100 : null };
        })
        .filter((x) => Number.isFinite(x.value));
    return points.map((p) => ({ label: p.date, value: p.value }));
  }
  return {
    esc,
    list,
    fmt,
    palette,
    url,
    badge,
    source,
    empty,
    select,
    chart,
    table,
    priceChange,
    transformPrice,
  };
});
