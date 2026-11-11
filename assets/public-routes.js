'use strict';
(() => {
 const known=new Set(['collector','earnings','desk','company','valuation','dcf','evidence','summary','telegram','gpu','memory','reports','news','finance','indicators','ai-state','interviews','weekly','temperature','events','archive','sources']);
 function target(raw){if(!raw?.startsWith('#'))return raw;const [tab,q='']=raw.slice(1).split('?');if(!known.has(tab))return raw;const params=new URLSearchParams(q),id=params.get('id');let file=tab+'.html';if(['reports','weekly','company','valuation','dcf','collector','earnings'].includes(tab)&&id&&/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,159}$/.test(id)&&!id.startsWith('naver-')){file=tab+'--'+id+'.html';params.delete('id');}return file+(params.size?'?'+params:'');}
 const replace=history.replaceState.bind(history);history.replaceState=(a,b,url)=>replace(a,b,typeof url==='string'?target(url):url);
 function migrate(){const next=target(location.hash);if(next&&next!==location.hash)replace(null,'',next);}
 migrate();
 window.PublicRoutes={route(){const file=decodeURIComponent(location.pathname.split('/').pop()||'index.html'),stem=file.replace(/\.html$/,''),splitAt=stem.indexOf('--'),tab=splitAt<0?stem:stem.slice(0,splitAt),id=splitAt<0?'':stem.slice(splitAt+2),params=new URLSearchParams(location.search);if(id)params.set('id',id);return {name:known.has(tab)?tab:'desk',q:params.toString()};}};
 function links(){for(const a of document.querySelectorAll('a[href^="#"]')){const raw=a.getAttribute('href'),next=target(raw);if(next!==raw)a.setAttribute('href',next);}}
 new MutationObserver(links).observe(document.documentElement,{childList:true,subtree:true});
 window.addEventListener('hashchange',migrate);links();
})();
