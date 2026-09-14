/* CELLSCAPE brand landing (T-378). Illustrative hotspots only; no model, no claims. */
(function () {
  'use strict';

  const ORGANS = [
    { id: 'nucleus', x: 0.62, y: 0.42, en: 'Nucleus', zh: '細胞核',
      tag: 'The blueprint of life',
      note: '遺傳訊息所在的示意位置。本頁不模擬轉錄或分裂，也不進入供氧世界。' },
    { id: 'mitochondria', x: 0.505, y: 0.36, en: 'Mitochondria', zh: '粒線體',
      tag: 'Fueling possibilities',
      note: '能量代謝的示意。本頁沒有能量帳，與 Living Atlas 的氧負載不是同一層。' },
    { id: 'er', x: 0.73, y: 0.20, en: 'Endoplasmic reticulum', zh: '內質網',
      tag: 'Synthesizing a brighter tomorrow',
      note: '合成與摺疊路徑的示意，不是這次的分子模擬。' },
    { id: 'golgi', x: 0.86, y: 0.45, en: 'Golgi apparatus', zh: '高爾基體',
      tag: 'Packaging potential',
      note: '包裝與運送的示意。本頁沒有分泌通量。' },
    { id: 'vesicles', x: 0.88, y: 0.68, en: 'Vesicles', zh: '囊泡',
      tag: 'Small carriers, big impact',
      note: '小型載體的示意。與循環世界裡的紅血球不是同一種實體。' },
    { id: 'cytoskeleton', x: 0.58, y: 0.78, en: 'Cytoskeleton', zh: '細胞骨架',
      tag: 'Structure in motion',
      note: '結構支架的示意，不是力學模擬。' }
  ];

  const img = document.getElementById('heroImg');
  const layer = document.getElementById('hotspots');
  const card = document.getElementById('card');
  const chips = document.getElementById('chips');

  function contentBox() {
    const r = img.getBoundingClientRect();
    const nw = img.naturalWidth || 1;
    const nh = img.naturalHeight || 1;
    const ir = nw / nh;
    const cr = r.width / r.height;
    let w, h, left, top;
    if (cr > ir) {
      h = r.height;
      w = r.height * ir;
      top = r.top;
      left = r.left + (r.width - w) / 2;
    } else {
      w = r.width;
      h = r.width / ir;
      left = r.left;
      top = r.top + (r.height - h) / 2;
    }
    return { left, top, w, h };
  }

  function place() {
    const box = contentBox();
    const host = layer.getBoundingClientRect();
    ORGANS.forEach((o) => {
      const el = layer.querySelector('[data-organ="' + o.id + '"]');
      if (!el) return;
      el.style.left = (box.left - host.left + o.x * box.w) + 'px';
      el.style.top = (box.top - host.top + o.y * box.h) + 'px';
    });
  }

  function open(id) {
    const o = ORGANS.find((x) => x.id === id);
    if (!o) return;
    layer.querySelectorAll('.spot').forEach((b) => b.classList.toggle('on', b.dataset.organ === id));
    card.innerHTML =
      '<button type="button" class="x" id="cardClose" aria-label="關閉">×</button>' +
      '<div class="k">' + o.en + '</div>' +
      '<h2>' + o.zh + '</h2>' +
      '<div class="tag">' + o.tag + '</div>' +
      '<p class="note">' + o.note + '</p>' +
      '<p class="note">示意 · 非分子模擬 · 不帶入主張登錄。</p>';
    card.classList.remove('hidden');
    const close = document.getElementById('cardClose');
    if (close) close.addEventListener('click', hide);
  }

  function hide() {
    card.classList.add('hidden');
    layer.querySelectorAll('.spot').forEach((b) => b.classList.remove('on'));
  }

  function build() {
    layer.innerHTML = '';
    chips.innerHTML = '';
    ORGANS.forEach((o) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'spot';
      b.dataset.organ = o.id;
      b.setAttribute('aria-label', o.zh + '（示意）');
      b.innerHTML = '<span>' + o.en + '</span>';
      b.addEventListener('click', () => open(o.id));
      layer.appendChild(b);
      const c = document.createElement('button');
      c.type = 'button';
      c.textContent = o.zh;
      c.addEventListener('click', () => open(o.id));
      chips.appendChild(c);
    });
    layer.hidden = false;
    place();
  }

  if (/[?&]seed=/.test(location.search)) {
    location.replace('loop.html' + location.search + location.hash);
    return;
  }

  if (img.complete && img.naturalWidth) build();
  else img.addEventListener('load', build);
  window.addEventListener('resize', place);
})();
