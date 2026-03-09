(function(){
  'use strict';

  function $(sel, root=document){ return root.querySelector(sel); }
  function $all(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }

  function parseJSONScript(id){
    const el = document.getElementById(id);
    if(!el) return null;
    try{
      return JSON.parse(el.textContent.trim());
    }catch(e){
      console.error('JSON parse error for', id, e);
      return null;
    }
  }

  async function loadJSON(url, fallbackScriptId){
    // Try external JSON first (CMS/PIM export or build output). If fetch fails (e.g., file://),
    // fallback to embedded <script type="application/json">.
    try{
      const res = await fetch(url, { cache: 'no-store' });
      if(res && res.ok){
        return await res.json();
      }
    }catch(e){
      // ignore
    }
    return parseJSONScript(fallbackScriptId);
  }

  function getQuery(){
    const p = new URLSearchParams(window.location.search);
    const o = {};
    for(const [k,v] of p.entries()) o[k] = v;
    return o;
  }

  function setQuery(next){
    const p = new URLSearchParams();
    Object.entries(next).forEach(([k,v])=>{
      if(v === undefined || v === null || v === '') return;
      p.set(k, v);
    });
    const url = window.location.pathname + (p.toString() ? ('?'+p.toString()) : '');
    window.history.replaceState({}, '', url);
  }

  function initHomeSearch(){
    const input = document.getElementById('home-search');
    if(!input) return;
    input.addEventListener('keydown', (e)=>{
      if(e.key === 'Enter'){
        const q = (input.value || '').trim();
        window.location.href = 'products/index.html' + (q ? ('?q='+encodeURIComponent(q)) : '');
      }
    });
  }

  function initChipGroup(containerId){
    const box = document.getElementById(containerId);
    if(!box) return { selected: new Set(), onChange: ()=>{} };

    const selected = new Set();
    const buttons = $all('button.chip', box);

    function syncUI(){
      buttons.forEach(b=>{
        const key = b.getAttribute('data-key');
        b.classList.toggle('is-active', selected.has(key));
      });
    }

    buttons.forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const key = btn.getAttribute('data-key');
        if(selected.has(key)) selected.delete(key);
        else selected.add(key);
        syncUI();
        box.dispatchEvent(new CustomEvent('chips:change', {detail: Array.from(selected)}));
      });
    });

    box.addEventListener('chips:set', (e)=>{
      selected.clear();
      (e.detail || []).forEach(k=>selected.add(k));
      syncUI();
    });

    return { selected, onChange: (fn)=> box.addEventListener('chips:change', fn), set: (arr)=> box.dispatchEvent(new CustomEvent('chips:set',{detail: arr})) };
  }

  function renderProductCard(p){
    const chips = (p.chips || []).slice(0,5)
      .map(c=>`<span class="chip chip-accent" style="cursor:default;">${escapeHtml(c)}</span>`)
      .join('');

    const title = (p.name_ko || p.name_en || 'Untitled');
    const thumb = p.image_thumb
      ? `<div class="card-thumb"><img src="${escapeAttr(p.image_thumb)}" alt="${escapeAttr(title)} 이미지"/></div>`
      : '';

    const model = p.model ? `<div class="badge">모델: ${escapeHtml(p.model)}</div>` : '';
    const featured = p.is_featured ? `<div class="badge">대표 제품</div>` : '';
    const mfg = p.manufacturer ? `<small class="muted">${escapeHtml(p.manufacturer)}</small>` : '';

    return `
      <a class="card" href="${escapeAttr(p.url || '#')}" style="grid-column: span 6;">
        ${thumb}
        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap;">
          <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
            <div class="badge">${escapeHtml(p.category_label || '제품')}</div>
            ${featured}
          </div>
          ${model}
        </div>
        <h3 style="margin-top:12px;">${escapeHtml(title)}</h3>
        <p>${escapeHtml(p.hero_tagline || p.short_description || '')}</p>
        <div class="meta">
          <div class="chips">${chips}</div>
          ${mfg}
        </div>
      </a>
    `;
  }


  function escapeHtml(str){
    return String(str)
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'","&#039;");
  }
  function escapeAttr(str){
    return escapeHtml(str).replaceAll('"','&quot;');
  }

  async function initProductFinder(){
    const data = await loadJSON('../data/products.json', 'products-data');
    const resultsEl = document.getElementById('results');
    const countEl = document.getElementById('result-count');
    if(!data || !resultsEl) return;

    const qEl = document.getElementById('q');
    const catEl = document.getElementById('category');
    const minZoomEl = document.getElementById('min_zoom');
    const deployEl = document.getElementById('deployment');
    const locEl = document.getElementById('localization');
    const resetEl = document.getElementById('reset');

    const envChips = initChipGroup('env-chips');
    const protoChips = initChipGroup('proto-chips');
    const installChips = initChipGroup('install-chips');

    const qp = getQuery();

    // hydrate from query params
    if(qEl && qp.q) qEl.value = qp.q;
    if(catEl && qp.cat) catEl.value = qp.cat;
    if(minZoomEl && qp.min_zoom) minZoomEl.value = qp.min_zoom;
    if(deployEl && qp.deployment) deployEl.value = qp.deployment;
    if(locEl && qp.localization === '1') locEl.checked = true;
    if(qp.env) envChips.set(qp.env.split(',').filter(Boolean));
    if(qp.proto) protoChips.set(qp.proto.split(',').filter(Boolean));
    if(qp.install) installChips.set(qp.install.split(',').filter(Boolean));

    function currentState(){
      return {
        q: qEl ? (qEl.value||'').trim() : '',
        cat: catEl ? catEl.value : '',
        env: Array.from(envChips.selected),
        proto: Array.from(protoChips.selected),
        install: Array.from(installChips.selected),
        min_zoom: minZoomEl ? (minZoomEl.value||'').trim() : '',
        deployment: deployEl ? deployEl.value : '',
        localization: locEl ? (locEl.checked ? '1' : '') : ''
      };
    }

    function match(p, st){
      // q search across name, model, chips, short_description
      if(st.q){
        const hay = [
          p.name_ko, p.name_en, p.model, p.hero_tagline, p.short_description,
          (p.chips||[]).join(' '),
          (p.protocols||[]).join(' '),
          (p.installation||[]).join(' ')
        ].join(' ').toLowerCase();
        if(!hay.includes(st.q.toLowerCase())) return false;
      }

      if(st.cat && p.category !== st.cat) return false;

      if(st.env.length){
        const set = new Set(p.environments || []);
        for(const k of st.env){ if(!set.has(k)) return false; }
      }

      if(st.proto.length){
        const set = new Set(p.protocols || []);
        for(const k of st.proto){ if(!set.has(k)) return false; }
      }

      if(st.install.length){
        const set = new Set(p.installation || []);
        for(const k of st.install){ if(!set.has(k)) return false; }
      }

      if(st.min_zoom){
        const z = Number(st.min_zoom);
        const pz = Number((p.specs||{}).optical_zoom_x || 0);
        if(!Number.isFinite(z)){} else{
          if(pz < z) return false;
        }
      }

      if(st.deployment){
        const d = (p.specs||{}).deployment || '';
        if(d !== st.deployment) return false;
      }

      if(st.localization){
        const loc = (p.specs||{}).localization;
        if(!loc) return false;
      }

      return true;
    }

    function render(){
      const st = currentState();

      // keep URL in sync
      setQuery({
        q: st.q,
        cat: st.cat,
        env: st.env.length ? st.env.join(',') : '',
        proto: st.proto.length ? st.proto.join(',') : '',
        install: st.install.length ? st.install.join(',') : '',
        min_zoom: st.min_zoom,
        deployment: st.deployment,
        localization: st.localization
      });

      const list = data.filter(p=>match(p, st));
      resultsEl.innerHTML = list.map(renderProductCard).join('') || `<div class="card" style="grid-column: span 12;"><div class="badge">No results</div><h3 style="margin-top:12px;">조건에 맞는 제품이 없습니다</h3><p>필터를 줄이거나 검색어를 변경해 보세요.</p></div>`;
      if(countEl) countEl.textContent = `${list.length}개 결과`;
    }

    const rerender = ()=> render();

    [qEl, catEl, minZoomEl, deployEl, locEl].forEach(el=>{
      if(!el) return;
      el.addEventListener('input', rerender);
      el.addEventListener('change', rerender);
    });

    envChips.onChange(rerender);
    protoChips.onChange(rerender);
    installChips.onChange(rerender);

    if(resetEl){
      resetEl.addEventListener('click', ()=>{
        if(qEl) qEl.value = '';
        if(catEl) catEl.value = '';
        if(minZoomEl) minZoomEl.value = '';
        if(deployEl) deployEl.value = '';
        if(locEl) locEl.checked = false;
        envChips.set([]);
        protoChips.set([]);
        installChips.set([]);
        render();
      });
    }

    render();
  }

  async function initDownloads(){
    const data = await loadJSON('../data/downloads.json', 'downloads-data');
    const tbody = document.getElementById('download-results');
    const countEl = document.getElementById('download-count');
    if(!data || !tbody) return;

    const qEl = document.getElementById('dq');
    const productEl = document.getElementById('dproduct');
    const typeEl = document.getElementById('dtype');
    const langEl = document.getElementById('dlang');
    const resetEl = document.getElementById('dreset');

    const qp = getQuery();
    if(qEl && qp.q) qEl.value = qp.q;
    if(productEl && qp.product_id) productEl.value = qp.product_id;
    if(typeEl && qp.dtype) typeEl.value = qp.dtype;
    if(langEl && qp.lang) langEl.value = qp.lang;

    function currentState(){
      return {
        q: qEl ? (qEl.value||'').trim() : '',
        product_id: productEl ? productEl.value : '',
        dtype: typeEl ? typeEl.value : '',
        lang: langEl ? langEl.value : ''
      };
    }

    function match(row, st){
      if(st.q){
        const hay = [row.title_ko, row.product_name, row.doc_type_label, row.version_label].join(' ').toLowerCase();
        if(!hay.includes(st.q.toLowerCase())) return false;
      }
      if(st.product_id && row.product_id !== st.product_id) return false;
      if(st.dtype && row.doc_type !== st.dtype) return false;
      if(st.lang && row.lang !== st.lang) return false;
      return true;
    }

    function renderRow(r){
      const has = !!r.file_url;
      const link = has ? `<a class="btn btn-primary" href="${escapeAttr(r.file_url)}" target="_blank" rel="noopener">다운로드</a>` : `<span class="pill no">준비중</span>`;
      const pill = has ? `<span class="pill ok">파일</span>` : `<span class="pill no">없음</span>`;
      return `
        <tr>
          <td>
            <div style="font-weight:900; letter-spacing:-0.01em;">${escapeHtml(r.title_ko)}</div>
            <small class="muted">${escapeHtml(r.product_name || '')}</small>
          </td>
          <td>${escapeHtml(r.doc_type_label || '')}</td>
          <td>${escapeHtml(r.version_label || '')}</td>
          <td style="text-transform:uppercase;">${escapeHtml(r.lang || '')} ${pill}</td>
          <td style="text-align:right;">${link}</td>
        </tr>
      `;
    }

    function render(){
      const st = currentState();
      setQuery({
        q: st.q,
        product_id: st.product_id,
        dtype: st.dtype,
        lang: st.lang
      });

      const list = data.filter(r=>match(r, st));
      tbody.innerHTML = list.map(renderRow).join('') || `<tr><td colspan="5"><div class="notice">조건에 맞는 문서가 없습니다. 필터를 변경해 주세요.</div></td></tr>`;
      if(countEl) countEl.textContent = `${list.length}개 문서`;
    }

    [qEl, productEl, typeEl, langEl].forEach(el=>{
      if(!el) return;
      el.addEventListener('input', render);
      el.addEventListener('change', render);
    });

    if(resetEl){
      resetEl.addEventListener('click', ()=>{
        if(qEl) qEl.value = '';
        if(productEl) productEl.value = '';
        if(typeEl) typeEl.value = '';
        if(langEl) langEl.value = '';
        render();
      });
    }

    render();
  }

  // boot
  document.addEventListener('DOMContentLoaded', ()=>{
    initHomeSearch();
    initProductFinder();
    initDownloads();
  });
})();
