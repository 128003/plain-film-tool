'use strict';
/* Plain Film 判讀量測工具
 * 資料來源:data.js(由 plain_film_data.json 產生)。所有臨床內容皆由資料驅動,程式不重複謄寫。
 */
const DATA = window.PLAIN_FILM_DATA;
const $ = s => document.querySelector(s);

/* 每種 calcType 所需點數 */
const POINT_COUNT = { distance_mm:2, ratio:4, angle:4, angle3:3, angle_horizontal:2, angle_vertical:2, percent_slip:3, qualitative:0, qualitative_grade:0 };
const TYPE_LABEL = {
  distance_mm:'距離 mm', ratio:'比值', angle:'兩線夾角', angle3:'三點夾角',
  angle_horizontal:'與水平夾角', angle_vertical:'與垂直夾角', percent_slip:'滑脫百分比',
  qualitative:'目視判讀', qualitative_grade:'分級判讀'
};

/* ────────────────── 幾何計算 ────────────────── */
const dist = (a,b) => Math.hypot(b.x-a.x, b.y-a.y);
const deg = r => r*180/Math.PI;
function angleBetween(v1, v2){
  const d = (v1.x*v2.x + v1.y*v2.y) / (Math.hypot(v1.x,v1.y)*Math.hypot(v2.x,v2.y));
  return deg(Math.acos(Math.max(-1, Math.min(1, d))));
}
/* 依 calcType 計算,回傳 {value, unit, text, calibrated} */
function compute(m, pts, mmPerPixel){
  switch(m.calcType){
    case 'distance_mm': {
      const px = dist(pts[0], pts[1]);
      if(mmPerPixel){
        const mm = px*mmPerPixel;
        return {value:mm, unit:'mm', text:`${mm.toFixed(1)} mm`, calibrated:true};
      }
      return {value:px, unit:'px', text:`${px.toFixed(1)} px(未校正)`, calibrated:false};
    }
    case 'ratio': {
      const r = dist(pts[0],pts[1]) / dist(pts[2],pts[3]);
      return {value:r, unit:'', text:r.toFixed(2), calibrated:true};
    }
    case 'angle': {
      const t = angleBetween({x:pts[1].x-pts[0].x,y:pts[1].y-pts[0].y},{x:pts[3].x-pts[2].x,y:pts[3].y-pts[2].y});
      const a = Math.min(t, 180-t);
      return {value:a, unit:'°', text:`${a.toFixed(1)}°`, calibrated:true};
    }
    case 'angle3': {
      const vi = m.vertexIndex ?? 1;
      const others = [0,1,2].filter(i=>i!==vi);
      const V = pts[vi], A = pts[others[0]], C = pts[others[1]];
      const t = angleBetween({x:A.x-V.x,y:A.y-V.y},{x:C.x-V.x,y:C.y-V.y});
      return {value:t, unit:'°', text:`${t.toFixed(1)}°`, calibrated:true};
    }
    case 'angle_horizontal': {
      const v = {x:pts[1].x-pts[0].x, y:pts[1].y-pts[0].y};
      const a = deg(Math.atan2(Math.abs(v.y), Math.abs(v.x)));
      return {value:a, unit:'°', text:`${a.toFixed(1)}°`, calibrated:true};
    }
    case 'angle_vertical': {
      const v = {x:pts[1].x-pts[0].x, y:pts[1].y-pts[0].y};
      const a = deg(Math.atan2(Math.abs(v.x), Math.abs(v.y)));
      return {value:a, unit:'°', text:`${a.toFixed(1)}°`, calibrated:true};
    }
    case 'percent_slip': {
      const A=pts[0], B=pts[1], C=pts[2];
      const AB = {x:B.x-A.x, y:B.y-A.y};
      const t = ((C.x-A.x)*AB.x + (C.y-A.y)*AB.y) / (AB.x*AB.x + AB.y*AB.y);
      const pct = t*100;
      return {value:pct, unit:'%', text:`${pct.toFixed(1)} %(${meyerdingGrade(Math.abs(pct))})`, calibrated:true};
    }
  }
}
function meyerdingGrade(p){
  if(p < 3) return '無明顯滑脫';
  if(p <= 25) return 'Grade I';
  if(p <= 50) return 'Grade II';
  if(p <= 75) return 'Grade III';
  if(p <= 100) return 'Grade IV';
  return 'Grade V(spondyloptosis)';
}

/* ────────────────── 判讀邏輯(數字切點取自 checklist 文獻值) ────────────────── */
const G=t=>({s:'normal',   label:'正常',   t});
const B=t=>({s:'abnormal', label:'異常',   t});
const Y=t=>({s:'borderline',label:'邊緣性', t});
const I=t=>({s:'info',     label:'參考',   t});

const JUDGES = {
  /* 頸椎 */
  adi: v => v<3 ? G('< 3 mm,成人正常(兒童切點 < 4-5 mm)') : B('≥ 3 mm(成人),提示寰樞椎不穩定;兒童切點為 ≥ 5 mm'),
  pvst: v => v<7 ? G('於 C2-C4(<7mm)及 C5-C7(<21mm)正常範圍')
        : v<21 ? Y('若量於 C2-C4 已超過 7mm 為異常;若量於 C5-C7 則仍在正常範圍(<21-22mm)')
        : B('超過 C5-C7 切點 21-22 mm,提示血腫或水腫(骨折/韌帶損傷間接徵象)'),
  powers_ratio: v => v>1.0 ? B('> 1.0 提示前方寰枕脫位') : v>=0.7 ? G('0.7-1.0,正常範圍(X光)') : Y('< 0.7 偏低,注意後方脫位可能'),
  cobb_c2c7: v => (v>=20&&v<=40) ? G('20-40°,正常前凸範圍') : v>=10 ? Y('10-20°,前凸減少(個體差異大,需臨床對照)') : B('< 10°,曲度變直或後凸,提示排列異常'),
  torg_ratio: v => v>=0.8 ? G('≥ 0.8,正常(正常約 1.0)') : B('< 0.8,提示椎管相對狹窄(此比值現多作歷史參考)'),
  /* 腰椎 */
  lumbar_lordosis: v => (v>=21&&v<=45) ? G('於平均 33°±12° 範圍內;仍建議與骨盆入射角 PI 合併判讀(LL 與 PI 差距宜在 ±9-10° 內)')
        : Y('超出平均 33°±12° 範圍,需與 PI 合併判讀是否脊椎骨盆失衡'),
  meyerding: v => Math.abs(v)<3 ? G('無明顯滑脫') : Math.abs(v)<=50 ? B(`${meyerdingGrade(Math.abs(v))},低度滑脫(I-II)`) : B(`${meyerdingGrade(Math.abs(v))},高度滑脫(III-V)`),
  disc_height_index: () => I('無單一絕對切點:請與相鄰節段比較,比值明顯下降提示椎間盤退化性塌陷'),
  ferguson_angle: v => v>47 ? B('> 47°,腰薦關節剪力增加,與下背痛機轉相關') : v>=30 ? G('30-50°,正常範圍(平均約 41°)') : Y('低於常見範圍 30-50°'),
  scoliosis_cobb: v => v<10 ? G('< 10°,未達側彎診斷標準') : v<25 ? B('≥ 10°,符合脊椎側彎診斷,建議追蹤') : B('≥ 25°,依年齡/骨骼成熟度評估積極治療(≥25-40° 可能需手術評估)'),
  /* 薦椎/骨盆 */
  pubic_symphysis: v => v<5 ? G('< 5 mm,正常(約 4.8±2.5 mm)') : v<=25 ? B('> 5 mm,恥骨聯合分離') : B('> 25 mm,嚴重分離,提示骨盆環不穩定(開書型損傷)'),
  si_joint_width: v => (v>=2&&v<=4) ? G('2-4 mm,正常(需雙側對稱)') : v>4 ? B('> 4 mm 增寬,注意骨盆環後環損傷') : Y('偏窄,注意退化/融合,並與對側比較'),
  sacral_slope: () => I('SS 因人而異,需與骨盆入射角 PI、骨盆傾斜角 PT 合併判讀:PI = PT + SS'),
  /* 肩關節 */
  ahd: v => (v>=7&&v<=14) ? G('7-14 mm,正常') : v<7 ? B('< 7 mm,提示旋轉肌袖大範圍撕裂或病變') : Y('> 14 mm 偏寬,注意下方半脫位或攝影因素'),
  cc_distance: v => v<=13 ? G('於正常範圍(11-13 mm),建議與對側比較') : v<=25 ? Y('增寬:若較對側增加 >5mm 或 <25mm,考慮 Rockwood III') : B('> 25 mm(超過正常 2 倍),Rockwood V'),
  ac_joint_space: v => (v>=1&&v<=3) ? G('1-3 mm,正常(年長者可略寬,需雙側比較)') : v>3 ? Y('增寬,考慮肩鎖關節脫位,需雙側比較') : Y('狹窄或消失,考慮退化性關節炎'),
  csa: v => (v>=30&&v<=35) ? G('30-35°,正常(平均約 33°)') : v<30 ? B('< 30°,增加盂肱關節退化性關節炎風險') : B('> 35°,增加旋轉肌袖退化性撕裂風險'),
  gh_joint_space: v => (v>=4&&v<=6) ? G('4-6 mm,正常(雙側對稱)') : v<4 ? B('狹窄,提示退化性關節炎') : Y('偏寬,注意攝影角度或關節不穩'),
  /* 髖關節 */
  lcea: v => v>25 ? G('> 25°,正常覆蓋') : v>=20 ? Y('20-25°,邊緣性(borderline dysplasia)') : B('< 20°,髖臼發育不良,股骨頭覆蓋不足'),
  acetabular_index: v => v<25 ? G('< 25°,2 歲以上正常(新生兒切點 < 30°)') : v<30 ? Y('25-30°:新生兒尚可接受,2 歲以上為異常') : B('≥ 30°,超過各年齡切點,提示 DDH'),
  tonnis_angle: v => v<=10 ? G('0-10°,正常(若接近 0° 且 LCEA 過大,注意 pincer 型過度覆蓋)') : B('> 10°,提示髖臼發育不良'),
  neck_shaft_angle: v => (v>=120&&v<=135) ? G('120-135°,正常(平均約 127°)') : v>135 ? B('> 135°,髖外翻(coxa valga)') : B('< 120°,髖內翻(coxa vara)'),
  /* 膝關節 */
  insall_salvati: v => (v>=0.8&&v<=1.2) ? G('0.8-1.2,正常') : v>1.2 ? B('> 1.2,高位髕骨(patella alta)') : B('< 0.8,低位髕骨(patella baja)'),
  tibial_slope: v => (v>=7&&v<=10) ? G('7-10°,正常範圍') : Y('超出常見 7-10° 範圍,供 ACL 重建/TKA 手術規劃參考'),
  tibiofemoral_angle: v => (v>=5&&v<=7) ? G('5-7° 外翻,正常解剖軸排列') : Y('偏離正常 5-7° 外翻;內翻或外翻方向請目視影像判斷,與退化性關節炎分佈相關'),
  knee_joint_space: v => v>=4 ? G('≥ 4-5 mm,正常(雙側對稱)') : B('狹窄,提示軟骨磨損/退化性關節炎,建議與對側比較'),
  /* 踝關節 */
  mcs: v => v<=4 ? G('≤ 4 mm,正常(應與上方脛距關節間隙相近)') : B('> 4 mm,提示三角韌帶斷裂/踝關節不穩定(或較對側增加 2-3mm)'),
  tfcs: v => v<6 ? G('< 6 mm,正常') : B('≥ 6 mm,提示脛腓聯合韌帶(syndesmosis)損傷'),
  talocrural_angle: v => (v>=75&&v<=87) ? G('75-87°(約 83°),正常;建議與健側比較') : Y('超出 75-87° 範圍,注意腓骨短縮或旋轉異常,需與健側比較'),
  talar_tilt: v => v<5 ? G('傾斜 < 5°,正常(雙側對稱)') : B('≥ 5°,提示三角韌帶或外側韌帶複合體斷裂'),
  /* 足部 */
  bohler_angle: v => (v>=25&&v<=40) ? G('25-40°,正常') : (v>=20&&v<25) ? Y('20-25°,邊緣性降低,注意跟骨骨折') : v<20 ? B('< 20°,提示跟骨骨折伴後關節面塌陷') : Y('> 40° 偏高,請確認標記點位置'),
  gissane_angle: v => (v>=120&&v<=145) ? G('120-145°,正常') : v>145 ? B('角度增大,提示距骨向跟骨後關節面塌陷(跟骨骨折)') : Y('< 120° 偏低,請確認標記點位置'),
  calcaneal_pitch: v => (v>=10&&v<=23) ? G('10-23°(約 17°±6°),正常') : v<10 ? B('降低,提示扁平足(pes planus)') : B('增高,提示高弓足(pes cavus)'),
  meary_angle: v => v<=4 ? G('0°±4°,兩軸線接近共線,正常') : B('> 4°:凸向蹠側為扁平足、凸向背側為高弓足(方向請目視影像判斷)'),
  hva: v => v<20 ? G('< 20°,正常') : v<30 ? B('20-30°,輕度拇趾外翻') : v<40 ? B('30-40°,中度拇趾外翻') : B('> 40°,重度拇趾外翻'),
  ima: v => v<9 ? G('< 9°,正常') : B('≥ 9°,第一二蹠骨間角增大,常合併 HVA 評估手術方式'),
};
function judge(m, res){
  if(m.calcType==='distance_mm' && !res.calibrated){
    return I('未設定比例尺,僅顯示像素距離;如需 mm 判讀請先點「設定比例尺」校正');
  }
  const f = JUDGES[m.id];
  return f ? f(res.value) : I('請對照文獻正常值自行判讀');
}

/* ────────────────── 全域狀態 ────────────────── */
const S = {
  regionId: null,
  img: null,               // HTMLImageElement
  mmPerPixel: null,
  mode: 'idle',            // idle | calibrate | measure
  calibPts: [],
  pts: [],
  active: null,            // 進行中的量測物件
  results: [],             // {rid, mid, name, valueText, status, statusLabel, judgeText, time}
};
const regionById = id => DATA.regions.find(r=>r.id===id);

/* ────────────────── 首頁 ────────────────── */
function renderHome(){
  $('#regionGrid').innerHTML = DATA.regions.map(r=>`
    <button class="region-card" data-rid="${r.id}">
      <div class="rc-name">${r.name_zh}</div>
      <div class="rc-views">常用攝影角度:${r.views}</div>
      <span class="rc-count">${r.measurements.length} 項量測</span>
    </button>`).join('');
  $('#regionGrid').querySelectorAll('.region-card').forEach(b=>{
    b.addEventListener('click', ()=>openRegion(b.dataset.rid));
  });
  /* 參考文獻:彙整每個部位所有 source */
  $('#refsBody').innerHTML = DATA.regions.map(r=>{
    const srcs = [...new Set(r.measurements.flatMap(m=>m.source.split(';').map(s=>s.trim())))];
    return `<div class="ref-group"><div class="rg-name">${r.name_zh}</div><ul>${srcs.map(s=>`<li>${s}</li>`).join('')}</ul></div>`;
  }).join('');
}

/* ────────────────── 部位頁 ────────────────── */
function openRegion(rid){
  S.regionId = rid; S.active = null; S.pts = []; S.mode = 'idle';
  const r = regionById(rid);
  $('#homeView').hidden = true; $('#regionView').hidden = false;
  $('#regionTitle').textContent = r.name_zh;
  $('#regionViews').innerHTML = `<b>常用攝影角度:</b>${r.views}`;
  $('#measureCount').textContent = `共 ${r.measurements.length} 項`;
  $('#resultBox').hidden = true;
  $('#markBar').hidden = true;
  renderMeasureList();
  renderResults();
  updateNoImgNote();
  window.scrollTo(0,0);
}
function goHome(){
  $('#regionView').hidden = true; $('#homeView').hidden = false;
  S.regionId = null; cancelMark();
}

function measureDone(mid){ return S.results.some(x=>x.rid===S.regionId && x.mid===mid); }

function renderMeasureList(){
  const r = regionById(S.regionId);
  $('#measureList').innerHTML = r.measurements.map(m=>{
    const n = POINT_COUNT[m.calcType];
    const isQ = m.calcType==='qualitative' || m.calcType==='qualitative_grade';
    const done = measureDone(m.id) ? ' <span class="m-done-tick">✓</span>' : '';
    let action;
    if(m.calcType==='qualitative'){
      action = `
        <div class="q-choices" data-mid="${m.id}">
          <button class="q-btn" data-choice="normal">✓ 正常</button>
          <button class="q-btn" data-choice="abnormal">✗ 異常</button>
          <button class="q-btn" data-choice="unknown">? 無法判定</button>
        </div>
        <textarea class="q-note" data-mid="${m.id}" placeholder="備註(選填),按下選項即記錄"></textarea>`;
    } else if(m.calcType==='qualitative_grade'){
      const grades = [`<b>Grade 0</b>:${m.normal.replace(/^Grade ?0[::]?/,'')}`]
        .concat(m.abnormal.split(/[;;]/).map(s=>{
          const t = s.trim();
          const mm2 = t.match(/^(Grade ?\d)[::]?\s*(.*)$/);
          return mm2 ? `<b>${mm2[1]}</b>:${mm2[2]}` : t;
        }));
      action = `<div class="grade-list" data-mid="${m.id}">${grades.map((g,i)=>`<div class="grade-item" data-grade="${i}">${g}</div>`).join('')}</div>`;
    } else {
      action = `<div class="m-actions"><button class="btn btn-primary btn-sm start-mark" data-mid="${m.id}">🎯 開始標記(${n} 點)</button></div>`;
    }
    return `
    <div class="m-card" id="mcard-${m.id}">
      <div class="m-head" data-mid="${m.id}">
        <div class="m-name">${m.name_zh}${done}</div>
        <span class="m-tag${isQ?' q':''}">${TYPE_LABEL[m.calcType]}</span>
      </div>
      <div class="m-normal">正常:${m.normal}</div>
      <div class="m-body">
        <div class="m-row"><b>測量方法:</b>${m.howto}</div>
        ${m.points ? `<div class="m-row"><b>標記點順序:</b><ol class="m-pts">${m.points.map(p=>`<li>${p}</li>`).join('')}</ol></div>`:''}
        <div class="m-row"><b>異常標準:</b>${m.abnormal}</div>
        <div class="m-row"><b>臨床意義:</b>${m.significance}</div>
        <div class="m-src">📖 文獻來源:${m.source}</div>
        ${action}
      </div>
    </div>`;
  }).join('');

  /* 事件 */
  $('#measureList').querySelectorAll('.m-head').forEach(h=>{
    h.addEventListener('click', ()=> h.parentElement.classList.toggle('open'));
  });
  $('#measureList').querySelectorAll('.start-mark').forEach(b=>{
    b.addEventListener('click', e=>{ e.stopPropagation(); startMeasure(b.dataset.mid); });
  });
  $('#measureList').querySelectorAll('.q-choices .q-btn').forEach(b=>{
    b.addEventListener('click', ()=>{
      const mid = b.parentElement.dataset.mid;
      b.parentElement.querySelectorAll('.q-btn').forEach(x=>x.className='q-btn');
      b.classList.add('sel-'+b.dataset.choice);
      recordQualitative(mid, b.dataset.choice);
    });
  });
  $('#measureList').querySelectorAll('.grade-list .grade-item').forEach(g=>{
    g.addEventListener('click', ()=>{
      const list = g.parentElement;
      list.querySelectorAll('.grade-item').forEach(x=>x.classList.remove('sel'));
      g.classList.add('sel');
      recordGrade(list.dataset.mid, +g.dataset.grade, g.textContent.trim());
    });
  });
}

/* qualitative 記錄 */
function recordQualitative(mid, choice){
  const r = regionById(S.regionId);
  const m = r.measurements.find(x=>x.id===mid);
  const note = $(`.q-note[data-mid="${mid}"]`)?.value.trim();
  const map = {
    normal:   G(`目視判讀為正常 — ${m.normal}`),
    abnormal: B(`目視判讀為異常 — ${m.abnormal}`),
    unknown:  I('無法判定,建議進一步影像或臨床評估'),
  };
  const jd = map[choice];
  addResult(m, {choiceText: choice==='normal'?'正常':choice==='abnormal'?'異常':'無法判定', note}, jd);
}
function recordGrade(mid, grade, desc){
  const r = regionById(S.regionId);
  const m = r.measurements.find(x=>x.id===mid);
  const jd = grade===0 ? G(desc) : grade<=1 ? Y(desc) : B(desc);
  addResult(m, {choiceText:`Grade ${grade}`}, jd);
}

/* ────────────────── 影像與 Canvas ────────────────── */
const cv = ()=>$('#cv');
function loadImageFile(file){
  if(!file || !file.type.startsWith('image/')){ alert('請選擇 JPG/PNG 影像檔'); return; }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = ()=>{
    URL.revokeObjectURL(url);
    S.img = img; S.mmPerPixel = null; S.calibPts = []; S.pts = []; S.mode='idle'; S.active=null;
    const c = cv();
    const MAX = 2200;
    const scale = Math.min(1, MAX/Math.max(img.naturalWidth, img.naturalHeight));
    c.width = Math.round(img.naturalWidth*scale);
    c.height = Math.round(img.naturalHeight*scale);
    $('#uploadZone').hidden = true;
    $('#canvasArea').hidden = false;
    updateCalibStatus();
    $('#markBar').hidden = true; $('#resultBox').hidden = true;
    updateNoImgNote();
    redraw();
  };
  img.src = url;
}
function updateNoImgNote(){
  const has = !!S.img;
  $('#noImgNote').hidden = has;
  $('#noImgNote').textContent = '尚未上傳影像 — 「目視判讀」與「分級判讀」項目仍可直接在右側勾選練習;需標記點的量測請先上傳影像。';
  $('#uploadZone').hidden = has;
  $('#canvasArea').hidden = !has;
}

function canvasPoint(e){
  const c = cv(), r = c.getBoundingClientRect();
  return { x:(e.clientX-r.left)*c.width/r.width, y:(e.clientY-r.top)*c.height/r.height };
}

/* 繪圖 */
const COL = { p1:'#4da3ff', p2:'#ffb454', calib:'#37c978', text:'#ffffff' };
function drawPoint(ctx, p, i, color){
  ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI*2);
  ctx.fillStyle = color; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
  ctx.font = 'bold 15px "Noto Sans TC",sans-serif';
  ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.lineWidth = 3;
  ctx.strokeText(String(i+1), p.x+8, p.y-8); ctx.fillText(String(i+1), p.x+8, p.y-8);
}
function drawLine(ctx, a, b, color, dash){
  ctx.beginPath(); ctx.setLineDash(dash||[]);
  ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y);
  ctx.lineWidth = 2; ctx.strokeStyle = color; ctx.stroke(); ctx.setLineDash([]);
}
function redraw(){
  if(!S.img) return;
  const c = cv(), ctx = c.getContext('2d');
  ctx.clearRect(0,0,c.width,c.height);
  ctx.drawImage(S.img, 0, 0, c.width, c.height);

  /* 校正點 */
  if(S.mode==='calibrate' || S.calibPts.length){
    S.calibPts.forEach((p,i)=>drawPoint(ctx,p,i,COL.calib));
    if(S.calibPts.length===2) drawLine(ctx, S.calibPts[0], S.calibPts[1], COL.calib);
  }
  /* 量測點與輔助線 */
  if(S.active && S.pts.length){
    const t = S.active.calcType, P = S.pts;
    const c1 = COL.p1, c2 = COL.p2;
    if(t==='distance_mm' && P.length>=2) drawLine(ctx,P[0],P[1],c1);
    if((t==='ratio'||t==='angle')){
      if(P.length>=2) drawLine(ctx,P[0],P[1],c1);
      if(P.length>=4) drawLine(ctx,P[2],P[3],c2);
    }
    if(t==='angle3'){
      const vi = S.active.vertexIndex ?? 1;
      if(P.length===3){
        const others=[0,1,2].filter(i=>i!==vi);
        drawLine(ctx,P[vi],P[others[0]],c1);
        drawLine(ctx,P[vi],P[others[1]],c2);
      } else if(P.length===2){ drawLine(ctx,P[0],P[1],c1); }
    }
    if(t==='angle_horizontal' && P.length>=2){
      drawLine(ctx,P[0],P[1],c1);
      const ext = Math.max(120, Math.abs(P[1].x-P[0].x));
      drawLine(ctx,{x:P[0].x-ext*0.2,y:P[0].y},{x:P[0].x+ext,y:P[0].y},c2,[6,5]);
    }
    if(t==='angle_vertical' && P.length>=2){
      drawLine(ctx,P[0],P[1],c1);
      const ext = Math.max(120, Math.abs(P[1].y-P[0].y));
      drawLine(ctx,{x:P[0].x,y:P[0].y-ext*0.2},{x:P[0].x,y:P[0].y+ext},c2,[6,5]);
    }
    if(t==='percent_slip'){
      if(P.length>=2) drawLine(ctx,P[0],P[1],c1);
      if(P.length===3){
        const A=P[0],Bp=P[1],C=P[2];
        const AB={x:Bp.x-A.x,y:Bp.y-A.y};
        const tt=((C.x-A.x)*AB.x+(C.y-A.y)*AB.y)/(AB.x*AB.x+AB.y*AB.y);
        const F={x:A.x+AB.x*tt, y:A.y+AB.y*tt};
        drawLine(ctx,C,F,c2,[5,4]);
        ctx.beginPath(); ctx.arc(F.x,F.y,4,0,Math.PI*2); ctx.fillStyle=c2; ctx.fill();
      }
    }
    P.forEach((p,i)=>drawPoint(ctx,p,i, i<2 && t!=='angle3' ? c1 : (t==='angle3'? (i===(S.active.vertexIndex??1)?c2:c1) : c2)));
  }
}

/* ────────────────── 比例尺 ────────────────── */
function startCalibrate(){
  if(!S.img){ alert('請先上傳影像'); return; }
  cancelMark();
  S.mode='calibrate'; S.calibPts=[];
  $('#calibHint').hidden = false; $('#calibForm').hidden = true;
  redraw();
}
function updateCalibStatus(){
  const el = $('#calibStatus');
  if(S.mmPerPixel){
    el.textContent = `已校正:1 px = ${S.mmPerPixel.toFixed(4)} mm`;
    el.classList.add('ok');
  } else {
    el.textContent = '未校正(距離將以像素顯示)';
    el.classList.remove('ok');
  }
}
function finishCalibInput(){
  const mm = parseFloat($('#calibMM').value);
  if(!(mm>0)){ alert('請輸入大於 0 的實際距離(mm)'); return; }
  const px = dist(S.calibPts[0], S.calibPts[1]);
  S.mmPerPixel = mm/px;
  S.mode='idle'; S.calibPts=[];
  $('#calibForm').hidden = true; $('#calibHint').hidden = true;
  updateCalibStatus(); redraw();
}

/* ────────────────── 量測流程 ────────────────── */
function startMeasure(mid){
  const r = regionById(S.regionId);
  const m = r.measurements.find(x=>x.id===mid);
  if(!S.img){ alert('此項目需要在影像上標記點,請先上傳 X 光影像'); return; }
  S.mode='measure'; S.active=m; S.pts=[];
  $('#calibHint').hidden = true; $('#calibForm').hidden = true;
  $('#resultBox').hidden = true;
  document.querySelectorAll('.m-card').forEach(c=>c.classList.remove('active'));
  $(`#mcard-${mid}`)?.classList.add('active');
  $('#markBar').hidden = false;
  updatePrompt();
  redraw();
  $('#canvasArea').scrollIntoView({behavior:'smooth', block:'nearest'});
}
function updatePrompt(){
  const m = S.active; if(!m) return;
  const n = POINT_COUNT[m.calcType];
  if(S.pts.length < n){
    $('#markPrompt').innerHTML = `<b>${m.name_zh}</b> — 請點選第 ${S.pts.length+1}/${n} 點:<b>${m.points[S.pts.length]}</b>`;
  } else {
    $('#markPrompt').innerHTML = `<b>${m.name_zh}</b> — ✓ 已完成 ${n} 點,結果如下`;
  }
}
function onCanvasClick(e){
  if(S.mode==='calibrate'){
    if(S.calibPts.length>=2) return;
    S.calibPts.push(canvasPoint(e)); redraw();
    if(S.calibPts.length===2){
      $('#calibHint').hidden = true; $('#calibForm').hidden = false;
      $('#calibMM').value=''; $('#calibMM').focus();
    }
    return;
  }
  if(S.mode==='measure' && S.active){
    const n = POINT_COUNT[S.active.calcType];
    if(S.pts.length>=n) return;
    S.pts.push(canvasPoint(e)); redraw(); updatePrompt();
    if(S.pts.length===n) finishMeasure();
  }
}
function finishMeasure(){
  const m = S.active;
  const res = compute(m, S.pts, S.mmPerPixel);
  const jd = judge(m, res);
  showResultBox(m, res, jd);
  addResult(m, {valueText:res.text}, jd);
}
function showResultBox(m, res, jd){
  const box = $('#resultBox');
  box.className = `result-box ${jd.s}`;
  box.innerHTML = `
    <div class="rb-name">${m.name_zh}</div>
    <div class="rb-value">${res.text}</div>
    <div class="rb-judge">【${jd.label}】${jd.t}</div>
    <div class="rb-extra"><b>臨床意義:</b>${m.significance}<br><span>📖 ${m.source}</span></div>`;
  box.hidden = false;
}
function undoPoint(){
  if(S.mode!=='measure') return;
  S.pts.pop(); $('#resultBox').hidden = true;
  redraw(); updatePrompt();
}
function clearPoints(){
  if(S.mode!=='measure') return;
  S.pts = []; $('#resultBox').hidden = true;
  redraw(); updatePrompt();
}
function cancelMark(){
  S.mode='idle'; S.active=null; S.pts=[];
  const mb=$('#markBar'); if(mb) mb.hidden = true;
  document.querySelectorAll('.m-card').forEach(c=>c.classList.remove('active'));
  if(S.img) redraw();
}

/* ────────────────── 結果彙整 ────────────────── */
function addResult(m, val, jd){
  /* 同一項目重測 → 以最新結果覆蓋 */
  S.results = S.results.filter(x=>!(x.rid===S.regionId && x.mid===m.id));
  S.results.push({
    rid:S.regionId, mid:m.id, name:m.name_zh,
    valueText: val.valueText || val.choiceText || '-',
    note: val.note || '',
    status: jd.s, statusLabel: jd.label, judgeText: jd.t,
    time: new Date().toLocaleTimeString('zh-TW',{hour12:false}),
  });
  renderResults();
  /* 更新清單完成勾勾(不整個重畫以保留展開/選取狀態) */
  const card = $(`#mcard-${m.id}`);
  if(card && !card.querySelector('.m-done-tick')){
    card.querySelector('.m-name').insertAdjacentHTML('beforeend',' <span class="m-done-tick">✓</span>');
  }
}
function renderResults(){
  const rows = S.results.filter(x=>x.rid===S.regionId);
  $('#resultsEmpty').style.display = rows.length? 'none':'block';
  $('#resultRows').innerHTML = rows.map((x,i)=>`
    <tr>
      <td>${x.name}</td>
      <td><span class="val">${x.valueText}</span>${x.note?`<div class="judge-note">備註:${x.note}</div>`:''}</td>
      <td><span class="tag ${x.status}">${x.statusLabel}</span><div class="judge-note">${x.judgeText}</div></td>
      <td>${x.time}</td>
      <td><button class="del-btn" data-mid="${x.mid}" title="刪除">✕</button></td>
    </tr>`).join('');
  $('#resultRows').querySelectorAll('.del-btn').forEach(b=>{
    b.addEventListener('click', ()=>{
      S.results = S.results.filter(x=>!(x.rid===S.regionId && x.mid===b.dataset.mid));
      renderResults(); renderMeasureList();
    });
  });
}

/* ────────────────── 事件綁定 ────────────────── */
function bind(){
  $('#homeLink').addEventListener('click', e=>{e.preventDefault(); goHome();});
  $('#backHome').addEventListener('click', e=>{e.preventDefault(); goHome();});

  const uz = $('#uploadZone'), fi = $('#fileInput');
  uz.addEventListener('click', ()=>fi.click());
  fi.addEventListener('change', ()=>{ loadImageFile(fi.files[0]); fi.value=''; });
  ['dragover','dragenter'].forEach(ev=>uz.addEventListener(ev, e=>{e.preventDefault(); uz.classList.add('dragover');}));
  ['dragleave','drop'].forEach(ev=>uz.addEventListener(ev, e=>{e.preventDefault(); uz.classList.remove('dragover');}));
  uz.addEventListener('drop', e=>loadImageFile(e.dataTransfer.files[0]));

  $('#btnChangeImg').addEventListener('click', ()=>fi.click());
  $('#btnCalib').addEventListener('click', startCalibrate);
  $('#btnCalibCancel').addEventListener('click', ()=>{ S.mode='idle'; S.calibPts=[]; $('#calibHint').hidden=true; redraw(); });
  $('#btnCalibOK').addEventListener('click', finishCalibInput);
  $('#calibMM').addEventListener('keydown', e=>{ if(e.key==='Enter') finishCalibInput(); });
  $('#btnCalibRedo').addEventListener('click', ()=>{ S.calibPts=[]; $('#calibForm').hidden=true; $('#calibHint').hidden=false; redraw(); });

  $('#cv').addEventListener('click', onCanvasClick);
  $('#btnUndo').addEventListener('click', undoPoint);
  $('#btnClearPts').addEventListener('click', clearPoints);
  $('#btnCancelMark').addEventListener('click', cancelMark);

  $('#btnClearResults').addEventListener('click', ()=>{
    if(!confirm('確定清空本部位所有量測結果?')) return;
    S.results = S.results.filter(x=>x.rid!==S.regionId);
    renderResults(); renderMeasureList();
  });
}

renderHome();
bind();

/* 供自動化測試使用 */
window.__pf = { compute, judge, meyerdingGrade, S, openRegion };
