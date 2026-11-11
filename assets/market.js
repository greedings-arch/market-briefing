'use strict';
(() => {
  const { esc, list, fmt, url, empty } = window.MarketUI;
  let views;
  const $ = (s) => document.querySelector(s);

  const cache = new Map(),
    filters = {};
  let config,
    status,
    active = 'summary',
    generation = 0,
    selectedCompany = 'sem';

  function beginRender() {
    const token = ++generation;
    $('#content').setAttribute?.('aria-busy', 'true');
    return token;
  }
  function finishRender(token) {
    if (token === generation) $('#content').setAttribute?.('aria-busy', 'false');
  }

  const earningsIds = new Set(),
    reportTab = (r) => (window.Collector?.isEarnings(r) ? 'earnings' : 'reports');
  const href = (tab, id, extra = {}) =>
    '#' +
    (tab === 'reports' && id && earningsIds.has(id) ? 'earnings' : tab) +
    (id || Object.keys(extra).length
      ? '?' + new URLSearchParams({ ...extra, ...(id ? { id } : {}) }).toString()
      : '');
  const anchor = (tab, id, label) => `<a href="${esc(href(tab, id))}">${esc(label)}</a>`;

  function route() {
    const raw = location.hash.slice(1),
      fallback = raw.split('?'),
      { name, q = '' } = window.PublicRoutes?.route() || { name: fallback[0], q: fallback[1] },
      investor = window.InvestorDesk;
    return {
      tab:
        config?.tabs.some((t) => t.id === name) ||
        investor?.views.includes(name) ||
        (name === 'dcf' && window.DCFApp)
          ? name
          : investor
            ? config?.workspace?.home || 'desk'
            : 'summary',
      params: new URLSearchParams(q),
    };
  }
  function clearItemRoute(tab) {
    const { params } = route();
    if (params.has('id')) {
      params.delete('id');
      params.delete('section');
      history.replaceState(null, '', '#' + tab + (params.size ? '?' + params.toString() : ''));
    }
  }
  async function json(name) {
    if (!cache.has(name)) {
      const request = fetch('data/' + name + '.json', { cache: 'no-store' })
        .then((r) => {
          if (!r.ok) throw Error('자료 응답 오류');
          return r.json();
        })
        .then((data) => {
          if (name === 'reports')
            for (const r of data.items || [])
              if (window.Collector?.isEarnings(r)) earningsIds.add(r.id);
          return data;
        })
        .then((data) =>
          name === 'telegram' && window.ResearchSignals
            ? window.ResearchSignals.prepareTelegram(data)
            : name === 'finance' && window.ResearchSignals
              ? window.ResearchSignals.prepareFinance(data)
              : data
        )
        .catch((e) => {
          if (cache.get(name) === request) cache.delete(name);
          throw e;
        });
      cache.set(name, request);
    }
    return cache.get(name);
  }
  function title(tab, data, description = '') {
    const t = config.tabs.find((x) => x.id === tab),
      meta = data.meta || status.tabs[tab];
    return `<header class="page-title"><div><p class="eyebrow">AI & CLOUD / ${esc(tab.replace(/-/g, ' '))}</p><h1>${esc(t.label)}</h1>${description ? `<p class="subtitle">${esc(description)}</p>` : ''}</div><div class="stamp"><span>기준일 ${esc(meta?.as_of || '수집 전')}</span><span>${fmt(meta?.count || 0, 0)}건</span><span>생성 ${esc(meta?.generated_at || '아직 없음')}</span></div></header>`;
  }
  function globalWarning() {
    const messages = [];
    if (
      status.automation_enabled &&
      (!status.latest_daily || status.latest_daily < status.expected_daily)
    )
      messages.push(
        `최신 일간 회차 ${status.latest_daily || '없음'} · 예정 기준 ${status.expected_daily}. 갱신이 늦었습니다.`
      );
    if (status.last_run && status.last_run.status !== 'success')
      messages.push(
        `마지막 실행에 문제가 있습니다 (${status.last_run.status === 'failed' ? '실패' : status.last_run.status === 'partial' ? '일부 미완료' : '보류'}).`
      );
    if (!status.automation_enabled)
      messages.push(
        `편집 브리핑 자동 갱신 중지 · 마지막 편집 회차 ${status.latest_daily || '없음'}. 자료마다 표시된 기준일을 확인해 주세요.`
      );
    $('#global-warning').hidden = !messages.length;
    $('#global-warning').innerHTML =
      messages.map(esc).join(' ') + ' <a href="#sources">실행 기록 보기 →</a>';
  }
  function navigation() {
    if (!window.InvestorDesk || !config.workspace) {
      $('#tabs').innerHTML = config.tabs
        .map(
          (t) =>
            `<a href="#${esc(t.id)}" ${t.id === active ? 'class="active" aria-current="page"' : ''}>${esc(t.label)}</a>`
        )
        .join('');
      return;
    }
    const ws = config.workspace,
      label = (id) =>
        ws.labels.find((x) => x.id === id)?.label ||
        config.tabs.find((t) => t.id === id)?.label ||
        id;
    const merged = ['company', 'valuation', 'evidence', 'dcf'].includes(active) ? 'desk' : active;
    const menu = [...new Set(['desk', ...ws.resources])];
    $('#tabs').innerHTML =
      menu
        .map(
          (id) =>
            `<a ${ws.resources.includes(id) ? 'data-library-tab' : 'data-nav'}="${esc(id)}" href="${id === 'dcf' ? href('dcf', ['samsung', 'hynix', 'sem'].includes(selectedCompany) ? selectedCompany : 'samsung') : '#' + esc(id)}" ${id === merged ? 'class="active" aria-current="page"' : ''}>${esc(label(id))}</a>`
        )
        .join('') + '<a href="#archive?section=legacy-tools">이전 브리핑</a>';
    $('#subtabs').innerHTML = merged === 'desk' ? [['desk', '투자 검토'], ['dcf', 'DCF 시나리오']].map(([id, text]) => `<a href="${href(id, id === 'dcf' ? selectedCompany : null)}" ${id === active || (id === 'desk' && active !== 'dcf') ? 'aria-current="page"' : ''}>${text}</a>`).join('') : '';
    $('#subtabs').hidden = merged !== 'desk';
  }
  function contextStrip(tab, params) {
    if (!window.InvestorDesk) return '';
    const companies = config.workspace.companies,
      c = companies.find((c) => c.id === params.get('company'));
    if (c)
      return `<aside class="context-strip"><div><small>기업 검증</small><p>${esc(c.name)}의 가설과 연결해 읽는 자료입니다. 자료의 기준일과 현재 검토일을 구분해 주세요.</p></div><nav>${anchor('company', c.id, '기업 가설로 돌아가기 →')}${anchor('valuation', c.id, '가격 검토 →')}</nav></aside>`;
    const contexts = {
      memory: [
        '메모리 가격·제품 구성·점유율이 이익에 어떻게 전달되는지 검증합니다.',
        ['hynix', 'samsung'],
      ],
      gpu: [
        '임대 요금의 변화와 AI 인프라 투자 회수를 연결해 검토합니다.',
        ['nvda', 'msft', 'amzn'],
      ],
      reports: ['실적과 현금흐름을 기업 가설·가격 가정과 대조합니다.', []],
      finance: ['낙관과 경계의 논거를 함께 읽고 가설을 바꿀 조건을 찾습니다.', []],
      'ai-state': ['기술의 진전과 제약이 실제 수요·수익화로 이어지는지 검토합니다.', []],
    };
    const item = contexts[tab];
    if (!item) return '';
    return `<aside class="context-strip"><div><small>투자 판단을 위한 근거</small><p>${esc(item[0])}</p></div><nav>${item[1].map((id) => anchor('company', id, companies.find((c) => c.id === id).name + ' →')).join('')}${anchor('desk', null, '투자 판단 →')}</nav></aside>`;
  }
  function researchContext(tab, data, params, html) {
    if (tab === 'telegram') return html;
    const signal = window.ResearchSignals?.tabHTML(tab, data, params.get('company')) || '';
    if (tab === 'gpu' && html.includes('data-gpu-briefing'))
      return html.replace(
        '<nav class="gpu-jump"',
        contextStrip(tab, params) + signal + '<nav class="gpu-jump"'
      );
    return (
      contextStrip(tab, params) +
      (signal
        ? html.replace(/(<header class="page-title[^]*?<\/header>)/, (match) => match + signal)
        : html)
    );
  }

  function mountTelegramPost(details) {
    if (!details.open || details.dataset.loaded || !details.querySelector('.telegram-widget'))
      return;
    const post = details.dataset.post;
    if (!/^[A-Za-z][A-Za-z0-9_]{3,31}\/[1-9]\d*$/.test(post || '')) return;
    details.dataset.loaded = 'true';
    const iframe = document.createElement('iframe');
    iframe.src = 'https://t.me/' + post + '?embed=1';
    iframe.title = '텔레그램 원문';
    iframe.loading = 'lazy';
    iframe.style.cssText = 'width:100%;height:480px;border:0';
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups');
    details.querySelector('.telegram-widget').appendChild(iframe);
  }
  document.addEventListener(
    'toggle',
    (event) => {
      if (event.target.matches?.('.telegram-post')) mountTelegramPost(event.target);
    },
    true
  );
  window.addEventListener('message', (event) => {
    if (event.origin !== 'https://t.me') return;
    const iframe = [...document.querySelectorAll('.telegram-widget iframe')].find(
      (f) => f.contentWindow === event.source
    );
    if (!iframe) return;
    let message;
    try {
      message = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
    } catch {
      return;
    }
    if (
      message?.event === 'resize' &&
      Number.isFinite(Number(message.height)) &&
      Number(message.height) >= 80 &&
      Number(message.height) <= 30000
    )
      iframe.style.height = Number(message.height) + 'px';
    if (message?.event === 'ready')
      iframe.contentWindow.postMessage(
        JSON.stringify({ event: 'visible', frame: iframe.id }),
        'https://t.me'
      );
  });
  document.addEventListener('click', (event) => {
    if (event.target.closest?.('[data-telegram-reset]')) {
      clearTimeout(searchTimer);
      filters.telegram = {};
      clearItemRoute('telegram');
      redraw();
      return;
    }
    const button = event.target.closest?.('[data-telegram-page]');
    if (button && !button.disabled) {
      filters.telegram ||= {};
      filters.telegram.page = Number(button.dataset.telegramPage);
      redraw();
    }
  });

  const renderers = {};
  function initializeViews() {
    const common = { config, filters, title, href, anchor };
    views = {
      library: window.MarketLibrary.create({ ...common, getStatus: () => status }),
      reports: window.MarketReports.create({
        ...common,
        reportTab,
        emphasize: (value, marks) =>
          window.Collector?.emphasize ? window.Collector.emphasize(value, marks) : esc(value),
        earningsSector: (...args) => window.Collector?.earningsSector(...args),
        isEarnings: (r) => !!window.Collector?.isEarnings(r),
        reportTabs: (kind) => window.BrokerResearch?.tabs(kind) || '',
      }),
      memory: window.MarketMemory.create({
        ...common,
        viewportWidth: () => document.documentElement?.clientWidth,
      }),
      gpu: window.MarketGPU.create({
        ...common,
        getItemID: () => route().params.get('id'),
        gpuBriefing: (data) => window.ResearchSignals?.gpuBriefing?.(data) || '',
      }),
      telegram: window.MarketTelegram.create(common),
    };
    Object.assign(renderers, views.library.renderers, {
      reports: views.reports.render,
      memory: views.memory.render,
      gpu: views.gpu.render,
      telegram: views.telegram.render,
    });
  }
  function renderTab(tab, data, params) {
    return renderers[tab] ? renderers[tab](data, params) : views.library.generic(tab, data);
  }
  function highlight(params) {
    const section = params.get('section'),
      id = params.get('id');
    const target = section
      ? document.getElementById('section-' + section)
      : id
        ? [...document.querySelectorAll('[data-item]')].find((x) => x.dataset.item === id)
        : null;
    if (target) {
      target.classList.add('item-highlight');
      target.tabIndex = -1;
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: 'start', behavior: 'instant' });
    }
  }
  function viewTop() {
    $('#content').focus?.({ preventScroll: true });
    window.scrollTo?.(0, 0);
  }
  async function collectorRelated(tab, token) {
    if (!window.Collector) return;
    const html = await window.Collector.related(tab);
    if (token !== generation || !html) return;
    const marked =
      '<!--collector-related:start:' + tab + '-->' + html + '<!--collector-related:end-->';
    const content = $('#content'),
      head = content.querySelector('.page-title,.desk-header,.investor-heading');
    if (head) head.insertAdjacentHTML('afterend', marked);
    else content.insertAdjacentHTML('afterbegin', marked);
    const current=content.querySelector('[data-current-tab]');
    if(current){window.Collector.mount(current,new URLSearchParams());const stamp=content.querySelector('.page-title .stamp');if(stamp&&!stamp.textContent.includes('기존 편집'))stamp.insertAdjacentHTML('afterbegin','<span>기존 편집 자료 기준</span>');}
  }
  async function collectedBriefing(tab, params, token) {
    if (!window.Collector || params.get('id')) return;
    try {
      const result = await window.Collector.page(new URLSearchParams(tab === 'weekly' ? { view: 'weekly' } : { view: 'daily' }));
      if (token !== generation) return;
      const content = $('#content');
      content.innerHTML = '<!--collector-briefing:start:' + tab + '--><section class="collector-host" data-briefing="' + tab + '">' + result.html + '</section><!--collector-briefing:end--><details class="section"><summary>기존 편집 브리핑·보관 회차</summary>' + content.innerHTML + '</details>';
      const heading = content.querySelector('[data-briefing] h1');
      if (heading) heading.textContent = tab === 'weekly' ? '주간 브리핑' : '일간 브리핑';
      window.Collector.mount(content.querySelector('[data-briefing]'), params);
    } catch (error) {
      if (token === generation) $('#content').insertAdjacentHTML('afterbegin', '<p class="note" role="status">최신 수집 브리핑을 불러오지 못했습니다. 기존 편집 자료를 표시합니다.</p>');
    }
  }
  async function show() {
    if (!config || !status) return;
    const token = beginRender(),
      { tab: requestedTab, params } = route();
    const tab = requestedTab === 'deep-reports' ? 'reports' : requestedTab;
    if (requestedTab === 'deep-reports') params.set('section', 'deep');
    active = tab === 'collector' && params.get('id')?.startsWith('daily-') ? 'summary' : tab === 'collector' && params.get('id')?.startsWith('weekly-') ? 'weekly' : tab === 'reports' && (params.get('section') === 'deep' || (params.get('id') && !params.get('id').startsWith('naver-'))) ? 'deep-reports' : tab;
    let openedReport = null;
    const investor = window.InvestorDesk,
      isInvestor = investor?.views.includes(tab),
      companyID = isInvestor || tab === 'dcf' ? params.get('id') : params.get('company');
    if (config.workspace?.companies.some((c) => c.id === companyID)) selectedCompany = companyID;
    investor?.deactivate();
    navigation();
    $('#content').className = isInvestor ? 'investor-view' : '';
    $('#content').innerHTML = '<div class="loading">자료를 불러오고 있습니다.</div>';
    try {
      if (tab === 'dcf') {
        const dcf = await json('dcf-models');
        if (token !== generation) return;
        window.DCFApp.mount(
          dcf,
          params.get('id') ||
            (['samsung', 'hynix', 'sem'].includes(selectedCompany) ? selectedCompany : 'samsung')
        );
        viewTop();
        return;
      }
      if (isInvestor) {
        const names = [
          'investor-desk',
          'broker-research',
          'gpu',
          'memory',
          'telegram',
          'finance',
          'valuation-models',
          'valuation-audit',
          'valuation-defaults',
          'valuation-broker',
          ...(tab === 'desk' || tab === 'company' || tab === 'valuation' ? ['reports'] : []),
          ...(tab === 'company' || tab === 'valuation' ? ['news'] : []),
        ];
        const results = await Promise.allSettled(names.map(json));
        if (token !== generation) return;
        if (results[0].status !== 'fulfilled') throw results[0].reason;
        const related = { config, status };
        names.slice(1).forEach((name, i) => {
          related[name] = results[i + 1].status === 'fulfilled' ? results[i + 1].value : null;
        });
        investor.mount(
          results[0].value,
          { view: tab, id: params.get('id') || selectedCompany },
          related
        );
        await collectorRelated(tab, token);
        if (token !== generation) return;
        if (params.get('section')) highlight(params);
        else viewTop();
        return;
      }
      if (tab === 'collector' && window.Collector) {
        const collectorParams = new URLSearchParams(params);
        if (!collectorParams.has('id')) collectorParams.set('id', 'packs');
        const result = await window.Collector.page(collectorParams);
        if (token !== generation) return;
        if (result.canonical) {
          history.replaceState(null, '', result.canonical + location.search + location.hash);
          return show();
        }
        $('#content').className = 'collector-host';
        $('#content').innerHTML = result.html;
        document.title = result.title + ' · Market Briefing';
        viewTop();
        window.Collector.mount($('#content'), params);
        return;
      }
      if (tab === 'earnings' && window.Collector) {
        const reports = await json('reports');
        if (token !== generation) return;
        const id = params.get('id');
        if (!id || id.startsWith('iv-')) {
          const result = await window.Collector.earnings(params, reports.items, config.reports, {loadReport: id => json('reports/' + encodeURIComponent(id)), renderReport: r => views.reports.detail(r)});
          if (token !== generation) return;
          $('#content').className = 'collector-host';
          $('#content').innerHTML = result.html;
          document.title = result.title + ' · Market Briefing';
          viewTop();
          window.Collector.mount($('#content'), params);
          return;
        }
        if (!reports.items.some((r) => r.id === id && window.Collector.isEarnings(r)))
          throw Error('목록에 없는 실적 콜');
        const report = await json('reports/' + encodeURIComponent(id));
        if (token !== generation) return;
        $('#content').className = report.editorial?.layout === 'essay' ? 'report-reading-view' : '';
        $('#content').innerHTML = views.reports.detail(report, params);
        document.title = report.title + ' · 실적 콜 · Market Briefing';
        if (params.get('section')) highlight(params);
        else viewTop();
        return;
      }
      const data = await json(tab);
      if (token !== generation) return;
      if (
        tab === 'reports' &&
        params.get('id') &&
        data.items.some((r) => r.id === params.get('id') && window.Collector?.isEarnings(r))
      ) {
        const extra = Object.fromEntries(params);
        delete extra.id;
        history.replaceState(null, '', href('earnings', params.get('id'), extra));
        return show();
      }
      if (
        tab === 'reports' &&
        window.BrokerResearch &&
        params.get('section') !== 'deep' &&
        (!params.get('id') || params.get('id').startsWith('naver-'))
      ) {
        const index = await json('broker-research');
        if (token !== generation) return;
        const html = await window.BrokerResearch.page(index, params, json);
        if (token !== generation) return;
        $('#content').innerHTML = html;
        document.title = '증권사 리포트 · Market Briefing';
        await collectorRelated(tab, token);
        if (token !== generation) return;
        viewTop();
        window.BrokerResearch.mount();
        return;
      } else if (tab === 'reports' && params.get('id')) {
        if (!data.items.some((r) => r.id === params.get('id'))) throw Error('목록에 없는 리포트');
        const report = await json('reports/' + encodeURIComponent(params.get('id')));
        if (token !== generation) return;
        openedReport = report;
        $('#content').className = report.editorial?.layout === 'essay' ? 'report-reading-view' : '';
        $('#content').innerHTML =
          (report.editorial?.layout === 'essay' ? '' : title('deep-reports', data)) +
          views.reports.detail(report, params);
      } else if (tab === 'weekly') {
        const selected =
          params.get('id') || data.items.slice().sort((a, b) => b.id.localeCompare(a.id))[0]?.id;
        let week = null;
        if (selected && data.items.some((w) => w.id === selected)) {
          week = await json('weekly/' + encodeURIComponent(selected));
          if (token !== generation) return;
          // Keep the latest briefing URL stable; archived editions retain their own URLs.
        }
        $('#content').innerHTML =
          contextStrip(tab, params) + views.library.weekly(data, params, week);
        await collectedBriefing(tab, params, token);
        if (token !== generation) return;
        document.title = (week ? week.id + ' · ' : '') + '주간 시사점 · Market Briefing';
        await collectorRelated(tab, token);
        if (token !== generation) return;
        if (params.get('section')) highlight(params);
        else viewTop();
        return;
      } else $('#content').innerHTML = renderTab(tab, data, params);
      if (tab === 'summary') {
        await collectedBriefing(tab, params, token);
        if (token !== generation) return;
      }
      $('#content').innerHTML = researchContext(tab, data, params, $('#content').innerHTML);
      if (!openedReport) {
        await collectorRelated(tab, token);
        if (token !== generation) return;
      }
      if (tab === 'summary' && window.Collector && $('#content').querySelector('[data-briefing]')) window.Collector?.mount($('#content').querySelector('[data-briefing]'), params);
      document.title =
        (openedReport?.title ||
          config.workspace?.labels.find((x) => x.id === tab)?.label ||
          config.tabs.find((x) => x.id === active).label) + ' · Market Briefing';
      if (params.get('section') || (params.get('id') && tab !== 'reports')) highlight(params);
      else if (openedReport?.editorial?.layout === 'essay') {
        $('.report-essay')?.focus?.({ preventScroll: true });
        $('.report-reader-tools')?.scrollIntoView?.({ block: 'start', behavior: 'instant' });
      } else viewTop();
    } catch (e) {
      if (token === generation) {
        if (isInvestor) investor.reset();
        $('#content').innerHTML =
          `<div class="empty error" role="alert"><h1>${isInvestor ? '검증 자료를 불러오지 못했습니다' : '자료를 불러오지 못했습니다'}</h1><p>자료 다시 읽기로 재시도해 주세요. 다른 자료 화면은 계속 이용하실 수 있습니다.</p></div><button data-retry type="button">다시 불러오기</button>`;
      }
    } finally {
      finishRender(token);
    }
  }
  function redraw() {
    const { params } = route(),
      currentTab = active,
      tab = currentTab === 'deep-reports' ? 'reports' : currentTab;
    return cache.get(tab)?.then((data) => {
      if (active !== currentTab) return;
      $('#content').innerHTML = researchContext(tab, data, params, renderTab(tab, data, params));
    });
  }
  document.addEventListener('change', (e) => {
    if (e.target.dataset.weeklyEdition !== undefined && e.target.value) {
      location.hash = href('weekly', e.target.value);
      return;
    }
    if (e.target.dataset.filter) {
      const filterTab = active === 'deep-reports' ? 'reports' : active;
      filters[filterTab] ||= {};
      filters[filterTab][e.target.dataset.filter] = e.target.value;
      filters[filterTab].page = 1;
      clearItemRoute(active);
      redraw();
    }
    if (e.target.dataset.memorySeries) {
      filters.memory ||= {};
      filters.memory.selected = [...document.querySelectorAll('[data-memory-series]:checked')].map(
        (x) => x.dataset.memorySeries
      );
      redraw();
    }
  });
  let searchTimer;
  document.addEventListener('input', (e) => {
    if (e.target.dataset.search) {
      const tab = e.target.dataset.search,
        value = e.target.value,
        searchGeneration = generation;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        if (active !== tab || generation !== searchGeneration) return;
        const keepFocus = document.activeElement === e.target,
          start = e.target.selectionStart,
          end = e.target.selectionEnd;
        filters[tab] ||= {};
        filters[tab].search = value;
        filters[tab].page = 1;
        clearItemRoute(tab);
        redraw()?.then(() => {
          if (keepFocus && active === tab) {
            const input = $('[data-search="' + tab + '"]');
            input?.focus();
            input?.setSelectionRange(start, end);
          }
        });
      }, 150);
    }
  });
  let reportPrintDetails = [];
  window.addEventListener('beforeprint', () => {
    if (reportPrintDetails.length) return;
    reportPrintDetails = [...document.querySelectorAll('.report-essay details')].map((node) => ({
      node,
      open: node.open,
    }));
    reportPrintDetails.forEach(({ node }) => {
      node.open = true;
    });
  });
  window.addEventListener('afterprint', () => {
    reportPrintDetails.forEach(({ node, open }) => {
      node.open = open;
    });
    reportPrintDetails = [];
  });
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-report-print]')) window.print?.();
    if (e.target.closest('[data-retry]')) show();
    const link = e.target.closest('a[href]');
    if (
      ['interviews', 'finance'].includes(active) &&
      route().params.get('id') &&
      link?.getAttribute('href') === location.hash
    ) {
      e.preventDefault();
      show();
    }
  });
  window.addEventListener('hashchange', () => {
    if (['collector', 'earnings'].includes(active) && /^#(?:cl-|call-)/.test(location.hash)) return;
    show();
  });
  window.addEventListener('popstate', show);
  $('#refresh').addEventListener('click', async () => {
    if (!config || !status) return;
    const token = beginRender();
    window.InvestorDesk?.reset();
    window.DCFApp?.reset();
    window.Collector?.reset();
    cache.clear();
    try {
      const nextStatus = await json('status');
      if (token !== generation) return;
      status = nextStatus;
      globalWarning();
      await show();
    } catch {
      if (token !== generation) return;
      $('#global-warning').hidden = false;
      $('#global-warning').textContent =
        '갱신 상태를 확인하지 못했습니다. 자료 다시 읽기로 재시도해 주세요.';
      $('#content').innerHTML = empty(
        '자료를 불러오지 못했습니다',
        '이전 값을 현재 자료로 표시하지 않습니다.'
      );
    } finally {
      finishRender(token);
    }
  });
  (async () => {
    const token = beginRender();
    try {
      const [nextConfig, nextStatus] = await Promise.all([json('config'), json('status')]);
      if (token !== generation) return;
      [config, status] = [nextConfig, nextStatus];
      initializeViews();
      $('#today').textContent =
        new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium' }).format(
          new Date()
        ) + ' KST';
      globalWarning();
      await show();
    } catch {
      if (token !== generation) return;
      $('#content').innerHTML = empty(
        '브리핑을 불러오지 못했습니다',
        '설정과 데이터가 함께 게시됐는지 확인해 주세요.'
      );
    } finally {
      finishRender(token);
    }
  })();
})();
