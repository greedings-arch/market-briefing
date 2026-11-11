// Pure rendering helpers; importing this module never mounts a page or loads data.
(function (root, factory) {
  if (typeof module === 'object' && module.exports)
    module.exports = factory(require('./market-ui'));
  else root.MarketTelegram = factory(root.MarketUI);
})(typeof window === 'object' ? window : globalThis, (ui) => {
  'use strict';
  const { empty, esc, list, select, url } = ui;
  function create({ filters, href, title }) {
    function telegramOriginalText(text) {
      // Preserve the original text while giving explicit breaks their own spacing.
      return esc(text).replace(
        /(?:\r\n|\r|\n)(?:[ \t]*(?:\r\n|\r|\n))*/g,
        (breaks) => `<span class="telegram-paragraph-break">${breaks}</span>`
      );
    }
    function renderTelegram(data, params) {
      const f = (filters.telegram ||= {}),
        target = list(data.items).find((x) => x.id === params.get('id'));
      if (target) {
        f.channel = '전체';
        f.kind = '전체';
        f.date = '전체';
        f.search = '';
        f.page = 1;
      }
      const channels = ['전체', ...new Set(list(data.items).map((x) => x.channel))];
      const key = (r) => (r.collected_at ? `${r.collection_basis}|${r.collected_at}` : 'unknown');
      const kinds = {
        '외사 리포트': 'broker_report',
        어닝콜: 'earnings_call',
        '반도체 수급': 'semiconductor_supply',
        '시황 판단': 'market_comment',
        시장전략: 'strategy_comment',
      };
      const dates = [
        '전체',
        ...new Set(
          list(data.items)
            .map((x) => x.source_date)
            .sort()
            .reverse()
        ),
      ];
      const terms = (f.search || '')
        .normalize('NFKC')
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);
      const sorted = list(data.items)
        .filter((x) => {
          const haystack = [
            x.title,
            x.channel,
            ...list(x.duplicate_channels),
            x.original_text,
            x.source_date,
            x.source_url,
            ...Object.entries(kinds)
              .filter(([, id]) => list(x.signal_types).includes(id))
              .map(([label]) => label),
          ]
            .filter(Boolean)
            .join(' ')
            .normalize('NFKC')
            .toLowerCase();
          return (
            (!f.channel || f.channel === '전체' || x.channel === f.channel) &&
            (!f.kind || f.kind === '전체' || list(x.signal_types).includes(kinds[f.kind])) &&
            (!f.date || f.date === '전체' || x.source_date === f.date) &&
            terms.every((term) => haystack.includes(term))
          );
        })
        .sort(
          (a, b) =>
            (b.collected_at || '').localeCompare(a.collected_at || '') ||
            (b.collection_basis || '').localeCompare(a.collection_basis || '') ||
            (b.rule_score || 0) - (a.rule_score || 0) ||
            b.published_at.localeCompare(a.published_at) ||
            a.id.localeCompare(b.id)
        );
      const groups = [];
      for (const r of sorted) {
        let group = groups.at(-1);
        if (!group || group.key !== key(r)) {
          group = { key: key(r), at: r.collected_at, basis: r.collection_basis, items: [] };
          groups.push(group);
        }
        group.items.push(r);
      }
      // Keep collection sections whole; a large historic batch can exceed 25 items.
      const pages = [[]];
      let pageSize = 0;
      for (const group of groups) {
        if (pageSize && pageSize + group.items.length > 25) {
          pages.push([]);
          pageSize = 0;
        }
        pages.at(-1).push(group);
        pageSize += group.items.length;
      }
      const page = Math.min(pages.length, Math.max(1, Number(f.page) || 1));
      const visible = target
        ? [
            {
              key: key(target),
              at: target.collected_at,
              basis: target.collection_basis,
              items: [target],
            },
          ]
        : pages[page - 1];
      let day = '';
      const sections = visible
        .map((group) => {
          const date = group.at
            ? new Date(Date.parse(group.at) + 9 * 3600000).toISOString().slice(0, 10)
            : '수집 날짜 미확인';
          const dateHeader =
            date !== day
              ? `<h2 class="telegram-day">${esc(date)} <small>수집일 · 한국시간</small></h2>`
              : '';
          day = date;
          const time = group.at
            ? new Date(group.at).toLocaleTimeString('ko-KR', {
                timeZone: 'Asia/Seoul',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
              })
            : '';
          const label =
            group.basis === 'run_start'
              ? `${time} 수집 회차`
              : group.basis === 'first_seen'
                ? `${time} 최초 저장 · 회차 기록 없음`
                : '수집 회차 미확인';
          return (
            dateHeader +
            `<section class="telegram-batch" data-collection="${esc(group.key)}"><header class="telegram-batch-heading"><h3>${esc(label)}</h3><span>${group.items.length}건 · 규칙 점수순</span></header>` +
            group.items
              .map(
                (r) =>
                  `<article class="story telegram-note telegram-original" data-item="${esc(r.id)}" data-rule-score="${Number(r.rule_score) || 0}" tabindex="-1"><div class="meta"><span>${esc(r.channel)}</span>${list(r.duplicate_channels).length ? `<span>같은 글 채널: ${list(r.duplicate_channels).map(esc).join(' · ')}</span>` : ''}<time datetime="${esc(r.published_at)}">게시 ${esc(new Date(r.published_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }))}</time>${Number.isInteger(r.rule_score) ? `<span>규칙 ${r.rule_score}점</span>` : ''}</div><h2>${url(r.source_url, r.title)}</h2><details class="telegram-post" data-post="${esc(new URL(r.source_url).pathname.slice(1))}" ${target ? 'open' : ''}><summary>원문 보기</summary>${r.original_text ? `<div class="telegram-original-text">${telegramOriginalText(r.original_text)}</div><p class="note">이미지·영상·첨부자료는 원문 링크에서 확인하실 수 있습니다.</p>` : '<div class="telegram-widget"></div>'}<p>${url(r.source_url, '텔레그램에서 원문 열기 ↗')}</p></details><a class="source" href="${esc(href('telegram', r.id))}">이 게시물 주소 →</a></article>`
              )
              .join('') +
            '</section>'
          );
        })
        .join('');
      return (
        title(
          'telegram',
          data,
          'AI·반도체·전력에 가산점을 주고, 시황 판단·글로벌 증권사 의견·시장전략을 우선 선별합니다. 수집 날짜·회차 최신순, 같은 회차 안에서는 규칙 점수순입니다.'
        ) +
        `<div class="filters telegram-filters">${select('channel', '채널', channels, f.channel)}${select('kind', '유형', ['전체', ...Object.keys(kinds)], f.kind)}${select('date', '게시일', dates, f.date)}<label class="telegram-search">원문 검색 <input type="search" data-search="telegram" aria-label="텔레그램 원문 검색" value="${esc(f.search || '')}" placeholder="제목·본문·채널 검색 (예: DRAM 공급)"></label><button type="button" data-telegram-reset>조건 초기화</button></div><p class="note">공백으로 나눈 단어가 모두 포함된 원문을 찾습니다.</p><p class="note">검색 결과 ${sorted.length} / ${list(data.items).length}건 · 최근 ${data.window_days || 14}일 게시물 · 회차는 최초 수집 기준</p>` +
        (sections ||
          empty('규칙을 통과한 게시물이 없습니다', '채널과 검색 조건을 확인해 주세요.')) +
        (!target && pages.length > 1
          ? `<nav class="telegram-pages"><button data-telegram-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>이전</button><span>${page} / ${pages.length}</span><button data-telegram-page="${page + 1}" ${page >= pages.length ? 'disabled' : ''}>다음</button></nav>`
          : '')
      );
    }
    return { render: renderTelegram };
  }
  return { create };
});
