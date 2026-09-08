/* ============================================================
   CELLSCAPE v0.2 · Living Loop — render.js
   Three.js 主渲染視窗：循環管路、肺/心/組織站點、RBC instancing、
   交換粒子（模型通量驅動的視覺流）、命名視角、低負載與 reduced-motion。
   邊界：只讀模型狀態（CSL.readout / entities）；視覺 RNG 獨立於模型 RNG；
   視覺效果不寫回模型。
   ============================================================ */
(function (global) {
  'use strict';
  const CSL = global.CSL || (global.CSL = {});
  const THREE = global.THREE;
  if (!THREE) throw new Error('three.min.js must be loaded before render.js');

  /* 站點座標（場景單位；示意配置，尺度經壓縮——介面常駐標示） */
  const STATION_POS = {
    PULM_ARTERY: [8, -4, 42],
    LUNG_CAP: [-54, 16, -6],
    PULM_VEIN: [-30, 9, -30],
    HEART_L: [-10, 3, -38],
    ARTERY_SYS: [32, 0, -26],
    TISSUE_CAP: [64, -6, 6],
    VEIN_SYS: [30, -2, 30],
    HEART_R: [-2, 0, 44],
  };
  const V3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);

  const R = (CSL.Render = {
    quality: 'high',
    reducedMotion: false,
    view: 'OVERVIEW',
    followedId: null,
    selectedId: null,

    init(container) {
      this.container = container;
      this.vrng = new CSL.Rng(0x51EED);            // 視覺 RNG（獨立於模型）
      this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
      this.renderer.setClearColor(0x05080f);
      container.appendChild(this.renderer.domElement);
      this.scene = new THREE.Scene();
      this.scene.fog = new THREE.Fog(0x05080f, 120, 320);
      this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 800);
      this.camera.position.set(0, 62, 98);

      this.scene.add(new THREE.AmbientLight(0x8fa8c0, 0.75));
      const key = new THREE.DirectionalLight(0xdfeaff, 0.9);
      key.position.set(40, 80, 30);
      this.scene.add(key);

      this._buildLoop();
      this._buildLung();
      this._buildTissue();
      this._buildHearts();
      this._buildRBCs();
      this._buildParticles();
      this._buildLabels();

      this._orbit = { az: 0, pol: 0.42, dist: 120, target: new THREE.Vector3(0, 0, 0) };
      this._bindPointer();
      this.resize();
      global.addEventListener('resize', () => this.resize());
    },

    resize() {
      const w = this.container.clientWidth, h = this.container.clientHeight;
      this.renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, this.quality === 'low' ? 1 : 2));
      this.renderer.setSize(w, h);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    },
    setQuality(q) { this.quality = q; this.resize(); },
    setReducedMotion(b) { this.reducedMotion = b; },

    /* ---------- 場景建構 ---------- */
    _buildLoop() {
      const pts = CSL.EDGES.map((e) => V3(STATION_POS[e.id]));
      this.curve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.35);
      const tube = new THREE.Mesh(
        new THREE.TubeGeometry(this.curve, 240, 1.9, 10, true),
        new THREE.MeshStandardMaterial({ color: 0x6e1a28, roughness: 0.5, metalness: 0.1,
          transparent: true, opacity: 0.42, depthWrite: false })
      );
      tube.renderOrder = 2;
      this.scene.add(tube);
      /* 站點弧長契約：曲線取樣找出每個站點的弧長參數 u。
         實體在邊 i 的位置 = u 內插（uStations[i] → uStations[i+1], 依 s），
         s=0 恰落在站點上——幾何對齊有明確契約。 */
      const SAMPLES = 512;
      this.uStations = CSL.EDGES.map((e) => {
        const t = V3(STATION_POS[e.id]);
        let best = 0, bd = Infinity;
        for (let k = 0; k < SAMPLES; k++) {
          const u = k / SAMPLES;
          const d = this.curve.getPointAt(u).distanceToSquared(t);
          if (d < bd) { bd = d; best = u; }
        }
        return best;
      });
      /* 站點節點 */
      this.stations = {};
      const nodeGeo = new THREE.SphereGeometry(2.6, 16, 12);
      const nodeMat = new THREE.MeshStandardMaterial({ color: 0x2b4155, roughness: 0.4 });
      for (const e of CSL.EDGES) {
        const m = new THREE.Mesh(nodeGeo, nodeMat.clone());
        m.position.copy(V3(STATION_POS[e.id]));
        this.scene.add(m);
        this.stations[e.id] = m.position.clone();
      }
    },

    _buildLung() {
      const g = new THREE.Group();
      const pos = V3(STATION_POS.LUNG_CAP);
      const mat = new THREE.MeshStandardMaterial({ color: 0x9fd8e8, roughness: 0.35, emissive: 0x0a2a33, emissiveIntensity: 0.4 });
      this.alveoli = [];
      for (let i = 0; i < 9; i++) {
        const r = 3 + this.vrng.next() * 2.6;
        const s = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), mat);
        const a = this.vrng.next() * Math.PI * 2, rr = 7 + this.vrng.next() * 6;
        s.position.set(pos.x + Math.cos(a) * rr, pos.y + 8 + this.vrng.next() * 8, pos.z + Math.sin(a) * rr);
        this.scene.add(s);
        this.alveoli.push(s);
      }
      g.userData = {}; // (group 保留結構意義)
    },

    _buildTissue() {
      const pos = V3(STATION_POS.TISSUE_CAP);
      const N = 120;
      const geo = new THREE.BoxGeometry(2.0, 2.0, 1.1);
      const mat = new THREE.MeshStandardMaterial({ color: 0x6b5d4e, roughness: 0.7 });
      this.tissueMesh = new THREE.InstancedMesh(geo, mat, N);
      const m = new THREE.Matrix4();
      let i = 0;
      for (let gx = 0; gx < 12; gx++) for (let gy = 0; gy < 10; gy++) {
        const x = pos.x + 14 + gx * 2.4, y = pos.y - 9 + gy * 2.2, z = pos.z - 12 + this.vrng.next() * 2;
        m.setPosition(x, y, z);
        this.tissueMesh.setMatrixAt(i, m);
        this.tissueMesh.setColorAt(i, new THREE.Color(0x6b5d4e));
        i++;
      }
      this.tissueMesh.instanceMatrix.needsUpdate = true;
      this.scene.add(this.tissueMesh);
      this._tissueBase = pos.clone();
    },

    _buildHearts() {
      const mk = (pos, color) => {
        const m = new THREE.Mesh(
          new THREE.SphereGeometry(4.4, 20, 16),
          new THREE.MeshStandardMaterial({ color, roughness: 0.45, emissive: 0x220a0a, emissiveIntensity: 0.5 })
        );
        m.position.copy(V3(pos)); m.scale.set(1, 1.15, 0.85);
        this.scene.add(m);
        return m;
      };
      this.heartL = mk(STATION_POS.HEART_L, 0x8c2f36);
      this.heartR = mk(STATION_POS.HEART_R, 0x6e2440);
    },

    _buildRBCs() {
      const N = CSL.ENTITY_COUNT;
      const geo = new THREE.SphereGeometry(1.35, 12, 8);
      geo.scale(1, 0.42, 1);
      const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
      this.rbcMesh = new THREE.InstancedMesh(geo, mat, N);
      this.rbcMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.scene.add(this.rbcMesh);
      this._rbcOffsets = [];
      for (let i = 0; i < N; i++) {
        this._rbcOffsets.push(new THREE.Vector3(
          (this.vrng.next() - 0.5) * 1.4,
          (this.vrng.next() - 0.5) * 1.2,
          (this.vrng.next() - 0.5) * 1.4
        ));
      }
      this._colLow = new THREE.Color(0x7c2733);
      this._colHigh = new THREE.Color(0xff5648);
      this._tmpC = new THREE.Color();
      this._tmpM = new THREE.Matrix4();
      this._tmpQ = new THREE.Quaternion();
      this._tmpV = new THREE.Vector3();
      this._tmpS = new THREE.Vector3(1, 1, 1);
    },

    _buildParticles() {
      const mk = (n, color) => {
        const geo = new THREE.BufferGeometry();
        const arr = new Float32Array(n * 3).fill(9999);
        geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
        const mat = new THREE.PointsMaterial({ color, size: 0.9, transparent: true, opacity: 0.85, depthWrite: false });
        const pts = new THREE.Points(geo, mat);
        this.scene.add(pts);
        return { pts, n, arr, free: [], live: [] };
      };
      const cap = this.quality === 'low' ? 48 : 140;
      this.particles = { lung: mk(cap, 0x9ff2ff), tissue: mk(cap, 0xffd08a) };
      this._fluxLungEMA = 0; this._fluxTissueEMA = 0;
    },

    _buildLabels() {
      this.labels = [];
      const box = this.container.getBoundingClientRect();
      for (const e of CSL.EDGES) {
        const el = document.createElement('div');
        el.className = 'stn-lbl';
        el.textContent = e.label;
        this.container.appendChild(el);
        this.labels.push({ el, pos: V3(STATION_POS[e.id]) });
      }
      this.followLbl = document.createElement('div');
      this.followLbl.className = 'stn-lbl follow';
      this.followLbl.style.display = 'none';
      this.container.appendChild(this.followLbl);
    },

    /* ---------- 指標互動（環繞 + 縮放） ---------- */
    _bindPointer() {
      const el = this.renderer.domElement;
      let dragging = false, px = 0, py = 0;
      el.addEventListener('pointerdown', (e) => { dragging = true; px = e.clientX; py = e.clientY; });
      global.addEventListener('pointerup', () => { dragging = false; });
      global.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        this._orbit.az -= (e.clientX - px) * 0.005;
        this._orbit.pol = Math.max(0.08, Math.min(1.45, this._orbit.pol + (e.clientY - py) * 0.004));
        px = e.clientX; py = e.clientY;
        this.view = 'FREE';
      });
      el.addEventListener('wheel', (e) => {
        e.preventDefault();
        this._orbit.dist = Math.max(18, Math.min(260, this._orbit.dist * (e.deltaY > 0 ? 1.1 : 0.9)));
        this.view = 'FREE';
      }, { passive: false });
    },

    setView(name, world, followed) {
      this.view = name;
      const o = this._orbit;
      if (name === 'OVERVIEW') { o.target.set(0, 0, 0); o.dist = 130; o.pol = 0.5; }
      if (name === 'LUNG') { o.target.copy(this.stations.LUNG_CAP).add(new THREE.Vector3(0, 8, 0)); o.dist = 46; o.pol = 0.6; }
      if (name === 'TISSUE') { o.target.copy(this._tissueBase).add(new THREE.Vector3(10, -2, 0)); o.dist = 46; o.pol = 0.55; }
      if (name === 'FOLLOW' && followed && world.entities[followed]) {
        o.target.copy(this._rbcWorldPos(world, world.entities[followed]));
      }
      if (this.reducedMotion) this._snapCamera();
    },

    _snapCamera() {
      const o = this._orbit;
      this.camera.position.set(
        o.target.x + o.dist * Math.sin(o.az) * Math.cos(o.pol),
        o.target.y + o.dist * Math.sin(o.pol),
        o.target.z + o.dist * Math.cos(o.az) * Math.cos(o.pol)
      );
      this.camera.lookAt(o.target);
    },

    _uFor(world, e) {
      /* 幾何對齊契約：邊 i 內以 s 內插站點弧長參數 */
      const i = e.edge;
      const u0 = this.uStations[i];
      let u1 = this.uStations[(i + 1) % this.uStations.length];
      if (u1 <= u0) u1 += 1;
      const u = u0 + (u1 - u0) * Math.min(1, Math.max(0, e.s));
      return u % 1;
    },

    _rbcWorldPos(world, e) {
      const p = this.curve.getPointAt(this._uFor(world, e));
      return p.add(this._rbcOffsets[(e.id - 1) % this._rbcOffsets.length]);
    },

    /* ---------- 每幀同步（只讀模型） ---------- */
    sync(world, dtReal) {
      const t = performance.now() / 1000;
      /* RBC 實例 */
      let i = 0;
      const ids = Object.keys(world.entities).map(Number).sort((a, b) => a - b);
      for (const id of ids) {
        const e = world.entities[id];
        const u = this._uFor(world, e);
        const pos = this.curve.getPointAt(u).add(this._rbcOffsets[(id - 1) % this._rbcOffsets.length]);
        const tan = this.curve.getTangentAt(u);
        this._tmpQ.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tan.clone().normalize());
        this._tmpM.compose(pos, this._tmpQ, this._tmpS);
        this.rbcMesh.setMatrixAt(i, this._tmpM);
        this._tmpC.copy(this._colLow).lerp(this._colHigh, Math.max(0, Math.min(1, e.load)));
        this.rbcMesh.setColorAt(i, this._tmpC);
        if (this.followedId === id) this._followPos = pos.clone();
        i++;
      }
      this.rbcMesh.instanceMatrix.needsUpdate = true;
      if (this.rbcMesh.instanceColor) this.rbcMesh.instanceColor.needsUpdate = true;

      /* 心跳脈動（視覺節律，不影響模型） */
      const beat = 1 + 0.07 * Math.sin(t * Math.PI * 2 * 1.15);
      this.heartL.scale.setScalar(beat); this.heartL.scale.y = 1.15 * beat;
      this.heartR.scale.setScalar(beat * 0.98); this.heartR.scale.y = 1.15 * beat * 0.98;

      /* 組織色階 = 組織氧庫存水位（模型欄位，介面有標示） */
      const ro = CSL.readout(world);
      const tCol = this._tmpC.set(0x574b3f).lerp(new THREE.Color(0x7fd0a8), Math.max(0, Math.min(1, ro.tissueLevel)));
      if (this.tissueMesh.instanceColor) {
        for (let k = 0; k < this.tissueMesh.count; k++) this.tissueMesh.setColorAt(k, tCol);
        this.tissueMesh.instanceColor.needsUpdate = true;
      }

      /* 交換粒子：存活率由最近通量（EMA）驅動——僅代表流向與相對速率 */
      this._updateParticles(world, dtReal);

      /* 相機 */
      if (this.view === 'FOLLOW' && this.followedId && world.entities[this.followedId]) {
        const e = world.entities[this.followedId];
        const p = this._rbcWorldPos(world, e);
        const tan = this.curve.getTangentAt(this._uFor(world, e));
        const desired = p.clone().add(tan.clone().multiplyScalar(-9)).add(new THREE.Vector3(0, 4.5, 0));
        if (this.reducedMotion) { this.camera.position.copy(desired); this.camera.lookAt(p); }
        else {
          this.camera.position.lerp(desired, Math.min(1, dtReal * 2.2));
          this._followLook = this._followLook ? this._followLook.lerp(p, Math.min(1, dtReal * 3)) : p.clone();
          this.camera.lookAt(this._followLook);
        }
      } else {
        const o = this._orbit;
        const px = o.target.x + o.dist * Math.sin(o.az) * Math.cos(o.pol);
        const py = o.target.y + o.dist * Math.sin(o.pol);
        const pz = o.target.z + o.dist * Math.cos(o.az) * Math.cos(o.pol);
        if (this.reducedMotion) this._snapCamera();
        else {
          this.camera.position.lerp(new THREE.Vector3(px, py, pz), Math.min(1, dtReal * 3));
          this.camera.lookAt(o.target);
        }
      }

      /* 標籤投影 */
      this._projectLabels();
      this.renderer.render(this.scene, this.camera);
    },

    _updateParticles(world, dtReal) {
      /* 交換粒子密度由「實測模型通量」驅動（無下限）：零通量 ⇒ 零粒子。
         通量為模型每 tick 交換量的唯讀投影。 */
      this._fluxLungEMA = this._fluxLungEMA * 0.9 + (world._fluxLung || 0) * 0.1;
      this._fluxTissueEMA = this._fluxTissueEMA * 0.9 + (world._fluxTissue || 0) * 0.1;

      const spawn = (pool, origin, spread, aliveTarget, drift) => {
        const alive = Math.round(aliveTarget * pool.n);
        while (pool.live.length < alive) {
          const p = { x: origin.x + (this.vrng.next() - 0.5) * spread, y: origin.y + (this.vrng.next() - 0.5) * spread * 0.6, z: origin.z + (this.vrng.next() - 0.5) * spread, vy: drift, life: 1.4 + this.vrng.next() };
          pool.live.push(p);
        }
        while (pool.live.length > alive) pool.live.shift();   // 精確排空：零通量 ⇒ 零粒子殘留
        let i = 0;
        for (const p of pool.live) {
          p.y += p.vy * dtReal; p.life -= dtReal;
          if (p.life <= 0) { p.y = origin.y + (this.vrng.next() - 0.5) * spread * 0.6; p.life = 1.4 + this.vrng.next(); }
          pool.arr[i * 3] = p.x; pool.arr[i * 3 + 1] = p.y; pool.arr[i * 3 + 2] = p.z;
          i++;
        }
        for (; i < pool.n; i++) { pool.arr[i * 3] = 9999; pool.arr[i * 3 + 1] = 9999; pool.arr[i * 3 + 2] = 9999; }
        pool.pts.geometry.attributes.position.needsUpdate = true;
      };
      const lp = this.stations.LUNG_CAP, tp = this._tissueBase;
      const lungAlive = Math.min(1, this._fluxLungEMA * 9);
      const tisAlive = Math.min(1, this._fluxTissueEMA * 9);
      spawn(this.particles.lung, lp.clone().add(new THREE.Vector3(0, 10, 0)), 22, lungAlive, 1.6);
      spawn(this.particles.tissue, tp.clone().add(new THREE.Vector3(20, 2, 0)), 20, tisAlive, 1.2);
    },

    _projectLabels() {
      const w = this.container.clientWidth, h = this.container.clientHeight;
      const throttle = this.quality === 'low' ? 3 : 1;
      this._lblFrame = (this._lblFrame || 0) + 1;
      if (this._lblFrame % throttle !== 0) return;
      const v = new THREE.Vector3();
      for (const L of this.labels) {
        v.copy(L.pos).project(this.camera);
        const vis = v.z < 1;
        L.el.style.display = vis ? 'block' : 'none';
        L.el.style.left = ((v.x * 0.5 + 0.5) * w) + 'px';
        L.el.style.top = ((-v.y * 0.5 + 0.5) * h - 18) + 'px';
      }
      if (this.followedId && this._followPos && this.view === 'FOLLOW') {
        v.copy(this._followPos).project(this.camera);
        this.followLbl.style.display = v.z < 1 ? 'block' : 'none';
        this.followLbl.style.left = ((v.x * 0.5 + 0.5) * w) + 'px';
        this.followLbl.style.top = ((-v.y * 0.5 + 0.5) * h - 30) + 'px';
      } else this.followLbl.style.display = 'none';
    },

    /* 點選 RBC（射線檢測 → instanceId → 實體 id） */
    pickAt(clientX, clientY, world) {
      const rect = this.renderer.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1
      );
      const ray = new THREE.Raycaster();
      ray.setFromCamera(ndc, this.camera);
      const hits = ray.intersectObject(this.rbcMesh);
      if (!hits.length) return null;
      const ids = Object.keys(world.entities).map(Number).sort((a, b) => a - b);
      const inst = hits[0].instanceId;
      return inst != null && inst < ids.length ? ids[inst] : null;
    },
  });
})(typeof window !== 'undefined' ? window : globalThis);
