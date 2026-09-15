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
    TISSUE_CAP_2: [52, -10, 18],   /* 次要組織床（0.7.0 拓樸；示意座標） */
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
      this.renderer.setClearColor(0x050814);
      container.appendChild(this.renderer.domElement);
      this.scene = new THREE.Scene();
      /* U4：場景背景對齊品牌深海軍藍（與 U3 CSS 氛圍層同色系） */
      this.scene.background = new THREE.Color(0x050814);
      this.scene.fog = new THREE.Fog(0x050814, 120, 320);
      this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 800);
      this.camera.position.set(0, 62, 98);

      /* U4 光層次：環境調低、補半球光（天冷地暖）＋主光＋青色輪廓光；
         U5：hemi/key 保留參照供心跳同步脈動。 */
      this.scene.add(new THREE.AmbientLight(0x8fa8c0, 0.5));
      this.hemiLight = new THREE.HemisphereLight(0xbfd8ff, 0x181028, 0.55);
      this.scene.add(this.hemiLight);
      const key = new THREE.DirectionalLight(0xdfeaff, 1.0);
      key.position.set(40, 80, 30);
      this.scene.add(key);
      this.keyLight = key;
      const rim = new THREE.DirectionalLight(0x9be7ff, 0.3);
      rim.position.set(-50, 24, -36);
      this.scene.add(rim);

      this._buildLoop();
      this._buildLung();
      this._buildTissue();
      this._buildHearts();
      this._buildRBCs();
      this._buildWBCs();
      this._buildParticles();
      this._buildBackdrop();
      this._buildAmbientCells();
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
        new THREE.MeshStandardMaterial({ color: 0x7e2130, roughness: 0.38, metalness: 0.08,
          emissive: 0x1c060b, emissiveIntensity: 0.6,
          transparent: true, opacity: 0.5, depthWrite: false })
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
      const nodeMat = new THREE.MeshStandardMaterial({ color: 0x24405a, roughness: 0.35,
        emissive: 0x0d2f3f, emissiveIntensity: 0.7 });
      for (const e of CSL.EDGES) {
        const m = new THREE.Mesh(nodeGeo, nodeMat.clone());
        m.position.copy(V3(STATION_POS[e.id]));
        this.scene.add(m);
        this.stations[e.id] = m.position.clone();
      }
    },

    _buildLung() {
      /* U4：雙葉肺——每側三段漸收球體堆疊成肺葉，左右對稱外張；
         呼吸脈動在 sync（視覺節律，不影響模型）。 */
      const g = new THREE.Group();
      const pos = V3(STATION_POS.LUNG_CAP);
      const mat = new THREE.MeshStandardMaterial({ color: 0x8fc8de, roughness: 0.42,
        emissive: 0x0a2a33, emissiveIntensity: 0.45 });
      this.alveoli = [];
      this.lungLobes = [];
      for (const side of [-1, 1]) {
        const lobe = new THREE.Group();
        const segs = [
          { dy: 12, r: 3.0 }, { dy: 7, r: 3.8 }, { dy: 1.5, r: 4.3 }, { dy: -4, r: 4.0 }, { dy: -9, r: 3.1 }
        ];
        for (const seg of segs) {
          const s = new THREE.Mesh(new THREE.SphereGeometry(seg.r, 18, 14), mat);
          s.position.set(pos.x + side * 5.5, pos.y + seg.dy, pos.z + Math.sin(side * 1.3) * 2);
          lobe.add(s);
          this.alveoli.push(s);
        }
        lobe.rotation.z = side * 0.16;   /* 肺尖略向外張 */
        this.scene.add(lobe);
        this.lungLobes.push(lobe);
      }
      g.userData = {}; // (group 保留結構意義)
    },

    _buildTissue() {
      const pos = V3(STATION_POS.TISSUE_CAP);
      const N = 120;
      const geo = new THREE.BoxGeometry(2.0, 2.0, 1.1);
      const mat = new THREE.MeshStandardMaterial({ color: 0x6b5d4e, roughness: 0.55,
        emissive: 0x0c1208, emissiveIntensity: 0.35 });
      this.tissueMesh = new THREE.InstancedMesh(geo, mat, N);
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion(), eu = new THREE.Euler();
      const one = new THREE.Vector3(1, 1, 1);
      let i = 0;
      for (let gx = 0; gx < 12; gx++) for (let gy = 0; gy < 10; gy++) {
        const x = pos.x + 14 + gx * 2.4, y = pos.y - 9 + gy * 2.2, z = pos.z - 12 + this.vrng.next() * 2;
        /* U4：每塊隨機微旋轉＋尺度微差——細胞堆疊的有機感（僅視覺） */
        eu.set((this.vrng.next() - 0.5) * 0.3, (this.vrng.next() - 0.5) * 0.3, (this.vrng.next() - 0.5) * 0.3);
        q.setFromEuler(eu);
        const sc = 0.85 + this.vrng.next() * 0.35;
        m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sc, sc, sc));
        this.tissueMesh.setMatrixAt(i, m);
        this.tissueMesh.setColorAt(i, new THREE.Color(0x6b5d4e));
        i++;
      }
      this.tissueMesh.instanceMatrix.needsUpdate = true;
      this.scene.add(this.tissueMesh);
      this._tissueBase = pos.clone();
    },

    _buildHearts() {
      /* U4：風格化雙室心——上緣兩球＋下緣錐尖，組合出心形剪影；
         心跳脈動在 sync（既有節律改作用於 Group）。 */
      const mk = (pos, color) => {
        const grp = new THREE.Group();
        const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.4,
          emissive: 0x220a0a, emissiveIntensity: 0.5 });
        const l = new THREE.Mesh(new THREE.SphereGeometry(3.0, 20, 16), mat);
        l.position.set(-1.5, 1.1, 0);
        const r = new THREE.Mesh(new THREE.SphereGeometry(3.0, 20, 16), mat);
        r.position.set(1.5, 1.1, 0);
        const tip = new THREE.Mesh(new THREE.ConeGeometry(4.1, 6.4, 20), mat);
        tip.position.set(0, -2.6, 0); tip.rotation.x = Math.PI;
        grp.add(l, r, tip);
        grp.position.copy(V3(pos));
        this.scene.add(grp);
        return grp;
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

    _buildWBCs() {
      /* U4：嗜中性球渲染——T-353 的 wbc 實體此前未具像化（免疫軸不可見）。
         圓球、淡白綠、略大於 RBC 碟，與 RBC 明顯可辨；僅讀世界狀態。 */
      const MAXW = CSL.WBC_MAX || 8;
      const geo = new THREE.SphereGeometry(1.9, 16, 12);
      const mat = new THREE.MeshStandardMaterial({ color: 0xeef7ea, roughness: 0.55,
        emissive: 0x16241a, emissiveIntensity: 0.55 });
      this.wbcMesh = new THREE.InstancedMesh(geo, mat, MAXW);
      this.wbcMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const hide = new THREE.Matrix4().makeScale(0, 0, 0);
      for (let k = 0; k < MAXW; k++) this.wbcMesh.setMatrixAt(k, hide);
      this.scene.add(this.wbcMesh);
      this._wbcHide = hide;
    },

    _buildBackdrop() {
      /* U5：人體內部環境——組織色漸層穹頂（反向球殼、單 draw call）。
         地平深組織紅暈漸入品牌深海軍藍，帶極慢色帶流動；純氛圍示意。 */
      const geo = new THREE.SphereGeometry(420, 24, 16);
      const mat = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: { uTime: { value: 0 } },
        vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: [
          'varying vec3 vP;',
          'uniform float uTime;',
          'void main(){',
          '  vec3 n = normalize(vP);',
          '  float h = clamp((n.y + 0.35) / 0.9, 0.0, 1.0);',
          '  vec3 tissue = vec3(0.135, 0.031, 0.060);',
          '  vec3 navy   = vec3(0.020, 0.031, 0.078);',
          '  vec3 col = mix(tissue, navy, smoothstep(0.0, 1.0, h));',
          '  float band = sin(n.y * 9.0 + uTime * 0.12) * 0.5 + 0.5;',
          '  col += vec3(0.05, 0.012, 0.02) * band * (1.0 - h) * 0.55;',
          '  gl_FragColor = vec4(col, 1.0);',
          '}'
        ].join('\n')
      });
      this.backdropMat = mat;
      this.scene.add(new THREE.Mesh(geo, mat));
    },

    _buildAmbientCells() {
      /* U5：漂浮血漿細胞——迴圈外殼緩漂的半透明橢圓體（單 InstancedMesh），
         鏡頭移動時自然視差；reducedMotion 靜止。僅氛圍，不觸世界。 */
      const N = this.quality === 'low' ? 20 : 48;
      const geo = new THREE.SphereGeometry(1, 10, 8);
      geo.scale(1.5, 0.9, 1.1);
      const mat = new THREE.MeshStandardMaterial({ color: 0x8c3550, roughness: 0.6,
        transparent: true, opacity: 0.16, depthWrite: false,
        emissive: 0x22060f, emissiveIntensity: 0.4 });
      this.ambCells = new THREE.InstancedMesh(geo, mat, N);
      this.ambCells.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.ambSeed = [];
      for (let k = 0; k < N; k++) {
        this.ambSeed.push({
          r: 60 + this.vrng.next() * 110,
          a: this.vrng.next() * Math.PI * 2,
          y: -20 + this.vrng.next() * 55,
          s: 2 + this.vrng.next() * 4.5,
          sp: 0.008 + this.vrng.next() * 0.02,
          ph: this.vrng.next() * Math.PI * 2
        });
      }
      this._ambM = new THREE.Matrix4();
      this._ambQ = new THREE.Quaternion();
      this._ambE = new THREE.Euler();
      this._ambV = new THREE.Vector3();
      this._ambS = new THREE.Vector3();
      this.scene.add(this.ambCells);
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
      /* RBC 實體（U4：WBC 為不同 kind，走下方獨立網格） */
      let i = 0;
      const ids = Object.keys(world.entities).map(Number).sort((a, b) => a - b);
      for (const id of ids) {
        const e = world.entities[id];
        if (e.kind === 'wbc') continue;
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
      /* 收尾：未用實例縮為 0（世界 RBC 退役後不殘影） */
      const hideAll = this._rbcHide || (this._rbcHide = new THREE.Matrix4().makeScale(0, 0, 0));
      for (let k = i; k < this.rbcMesh.count; k++) this.rbcMesh.setMatrixAt(k, hideAll);
      this.rbcMesh.instanceMatrix.needsUpdate = true;
      if (this.rbcMesh.instanceColor) this.rbcMesh.instanceColor.needsUpdate = true;

      /* U4：WBC 獨立網格——沿邊即時定位，招募／外滲直接可見（配合 T-401 免疫晶片） */
      if (this.wbcMesh) {
        let wi = 0;
        for (const id of ids) {
          const e = world.entities[id];
          if (e.kind !== 'wbc') continue;
          const u = this._uFor(world, e);
          const pos = this.curve.getPointAt(u);
          this._tmpQ.setFromUnitVectors(new THREE.Vector3(0, 1, 0), this.curve.getTangentAt(u).normalize());
          this._tmpM.compose(pos, this._tmpQ, this._tmpS);
          this.wbcMesh.setMatrixAt(wi, this._tmpM);
          wi++;
        }
        for (let k = wi; k < this.wbcMesh.count; k++) this.wbcMesh.setMatrixAt(k, this._wbcHide);
        this.wbcMesh.instanceMatrix.needsUpdate = true;
      }

      /* 心跳脈動（視覺節律，不影響模型） */
      const beat = 1 + 0.07 * Math.sin(t * Math.PI * 2 * 1.15);
      this.heartL.scale.setScalar(beat); this.heartL.scale.y = 1.15 * beat;
      this.heartR.scale.setScalar(beat * 0.98); this.heartR.scale.y = 1.15 * beat * 0.98;

      /* U4 呼吸脈動（視覺節律，不影響模型） */
      if (this.lungLobes) {
        const br = 1 + 0.025 * Math.sin(t * Math.PI * 2 * 0.35);
        for (const lobe of this.lungLobes) lobe.scale.setScalar(br);
      }

      /* U5 背景動畫：穹頂色帶時間、漂浮血漿細胞（reducedMotion 靜止） */
      if (this.backdropMat) this.backdropMat.uniforms.uTime.value = t;
      if (this.ambCells) {
        const frozen = this.reducedMotion;
        for (let k = 0; k < this.ambCells.count; k++) {
          const sd = this.ambSeed[k];
          const a = sd.a + (frozen ? 0 : t * sd.sp);
          const y = sd.y + (frozen ? 0 : Math.sin(t * 0.18 + sd.ph) * 3);
          this._ambE.set(0, frozen ? sd.ph : t * sd.sp * 2 + sd.ph, sd.ph);
          this._ambQ.setFromEuler(this._ambE);
          this._ambV.set(Math.cos(a) * sd.r, y, Math.sin(a) * sd.r);
          this._ambS.set(sd.s, sd.s, sd.s);
          this._ambM.compose(this._ambV, this._ambQ, this._ambS);
          this.ambCells.setMatrixAt(k, this._ambM);
        }
        this.ambCells.instanceMatrix.needsUpdate = true;
      }
      /* U5 心跳同步環境脈動（±5%，與心臟同時脈；reducedMotion 恆定） */
      if (this.hemiLight && !this.reducedMotion) {
        const p = 1 + 0.05 * Math.sin(t * Math.PI * 2 * 1.15);
        this.hemiLight.intensity = 0.55 * p;
        this.keyLight.intensity = 1.0 * (2 - p) * 0.5;
      }

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
