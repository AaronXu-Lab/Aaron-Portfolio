import * as THREE from './vendor/three.module.min.js';

const $ = id => document.getElementById(id);
const canvas = $('world');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const TAU = Math.PI * 2, ROAD = 6.15;
const state = { speed: 8, boost: false, paused: reduced.matches, night: false, overview: false, distance: 0, fish: 0, jump: 0, bell: 0, orbit: 0, elevation: 0, zoom: 1, time: 0 };
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
} catch (error) {
  $('loading').hidden = true; $('error').hidden = false; throw error;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#d2e9e3');
scene.fog = new THREE.Fog('#d2e9e3', 28, 72);
const camera = new THREE.PerspectiveCamera(39, 1, .1, 120);
const hemi = new THREE.HemisphereLight('#fff4dd', '#598d83', 2.8); scene.add(hemi);
const sunlight = new THREE.DirectionalLight('#fff0d3', 3.7); sunlight.position.set(-9, 15, 7); sunlight.castShadow = true;
sunlight.shadow.mapSize.set(1024, 1024); sunlight.shadow.camera.left = -14; sunlight.shadow.camera.right = 14;
sunlight.shadow.camera.top = 14; sunlight.shadow.camera.bottom = -14; sunlight.shadow.normalBias = .025; sunlight.shadow.bias = -.00015;
scene.add(sunlight);
const fill = new THREE.DirectionalLight('#c2e7ef', 1.3); fill.position.set(8, 5, -9); scene.add(fill);
const mats = {};
function material(name, color, roughness = .7, metalness = 0) {
  return mats[name] ||= new THREE.MeshStandardMaterial({ color, roughness, metalness });
}
const M = {
  cream: material('cream', '#fff6df'), feather: material('feather', '#e8e9d4'), white: material('white', '#fff9e9'),
  orange: material('orange', '#efac52'), pouch: material('pouch', '#df925b'), beak: material('beak', '#ffd37e'),
  dark: material('dark', '#29444a'), tire: material('tire', '#34464a'), silver: material('silver', '#aabdb6', .32, .6),
  teal: material('teal', '#58ae9a', .35, .25), coral: material('coral', '#e97b54'), leather: material('leather', '#935d47'),
  sand: material('sand', '#e9d2a4'), grass: material('grass', '#96b99b'), rock: material('rock', '#739587'),
  road: material('road', '#b6c3b4'), line: material('line', '#faf1d4'), tree: material('tree', '#447c67'),
  trunk: material('trunk', '#9d8060'), red: material('red', '#d56f56'), gold: material('gold', '#ffc865', .35, .35)
};
const sphereGeo = new THREE.SphereGeometry(1, 24, 16);
const smallSphereGeo = new THREE.SphereGeometry(1, 12, 8);
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const v = (x,y,z) => new THREE.Vector3(x,y,z);
function mesh(geo, mat, parent = scene, position = [0,0,0], scale = [1,1,1]) {
  const o = new THREE.Mesh(geo, mat); o.position.set(...position); o.scale.set(...scale); o.castShadow = true; o.receiveShadow = true; parent.add(o); return o;
}
function ball(parent, mat, pos, scale, low = false) { return mesh(low ? smallSphereGeo : sphereGeo, mat, parent, pos, scale); }
function box(parent, mat, pos, scale) { return mesh(boxGeo, mat, parent, pos, scale); }
function cylinder(parent, mat, pos, top, bottom, height, segments = 24) { return mesh(new THREE.CylinderGeometry(top, bottom, height, segments), mat, parent, pos); }
const axisY = v(0,1,0);
function rod(parent, mat, from, to, radius = .04, segments = 12) {
  const a = v(...from), b = v(...to), delta = b.clone().sub(a);
  const o = cylinder(parent, mat, a.clone().add(b).multiplyScalar(.5).toArray(), radius, radius, delta.length(), segments);
  o.quaternion.setFromUnitVectors(axisY, delta.normalize()); return o;
}
function moveRod(o, a, b) {
  o.position.copy(a).add(b).multiplyScalar(.5);
  o.scale.y = a.distanceTo(b) / o.geometry.parameters.height;
  o.quaternion.setFromUnitVectors(axisY, b.clone().sub(a).normalize());
}
function tube(parent, mat, points, radius, tubular = 36) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => v(...p)));
  return mesh(new THREE.TubeGeometry(curve, tubular, radius, 8, false), mat, parent);
}
function torus(parent, mat, radius, thickness, pos, segments = 64) {
  return mesh(new THREE.TorusGeometry(radius, thickness, 8, segments), mat, parent, pos);
}

// A complete miniature island. The road, land and sea are actual geometry.
const island = new THREE.Group(); scene.add(island);
cylinder(island, M.rock, [0,-.52,0], 7.8, 7.3, 1.0, 80);
cylinder(island, M.sand, [0,.01,0], 7.85, 7.8, .18, 80);
cylinder(island, M.road, [0,.12,0], 7.0, 7.0, .07, 96);
cylinder(island, M.sand, [0,.19,0], 5.30, 5.35, .08, 80);
cylinder(island, M.grass, [-.5,.23,-.25], 4.55, 4.7, .12, 64);
for (let i=0; i<52; i++) {
  const a=i/52*TAU, d=box(island,M.line,[ROAD*Math.cos(a),.162,ROAD*Math.sin(a)],[.42,.008,.065]); d.rotation.y=-a-Math.PI/2;
}
for (let i=0; i<34; i++) {
  const a=i/34*TAU, r=7.84 + .2*Math.sin(i*5.2);
  const o=ball(island, M.rock, [r*Math.cos(a),-.15,r*Math.sin(a)],[.42+.12*Math.sin(i),.32,.45],true); o.rotation.set(i*.3,i,0);
}
// Dynamic water surface with a low-amplitude vertex wave.
const waterMat = material('water', '#70bbb5', .28, .12);
const waterGeo = new THREE.PlaneGeometry(140,140,64,64); waterGeo.rotateX(-Math.PI/2);
const water = mesh(waterGeo,waterMat,scene,[0,-.65,0]); water.castShadow=false;
const waterPosition=waterGeo.attributes.position, waterBase=new Float32Array(waterPosition.array);
const foamMat=new THREE.MeshBasicMaterial({color:'#d9ece0',transparent:true,opacity:.4,side:THREE.DoubleSide});
const foam=[];
for(let i=0;i<18;i++) {
  const angle=i*2.4, radius=9+(i%5)*2.9;
  const arc=mesh(new THREE.TorusGeometry(.9+(i%3)*.4,.018,4,28,1.5),foamMat,scene,[Math.cos(angle)*radius,-.57,Math.sin(angle)*radius]);
  arc.rotation.set(-Math.PI/2,0,angle); arc.castShadow=false; foam.push(arc);
}
const ripples=[];
for(let i=0;i<3;i++) {
 const r=mesh(new THREE.RingGeometry(8+i*.35,8.025+i*.35,100),foamMat,scene,[0,-.56,0]);r.rotation.x=-Math.PI/2;r.castShadow=false;ripples.push(r);
}

const lighthouse = new THREE.Group(); lighthouse.position.set(-1.8,.29,-1.4); island.add(lighthouse);
cylinder(lighthouse,M.sand,[0,.08,0],1.05,1.1,.16,32);
cylinder(lighthouse,M.white,[0,1.52,0],.53,.72,2.9,32);
cylinder(lighthouse,M.red,[0,1.5,0],.62,.65,.48,32);
cylinder(lighthouse,M.red,[0,2.8,0],.64,.64,.13,32);
cylinder(lighthouse,M.dark,[0,3.0,0],.68,.68,.1,32);
const lanternMat = new THREE.MeshStandardMaterial({color:'#ffd487',emissive:'#ffa941',emissiveIntensity:.25,roughness:.2});
cylinder(lighthouse,lanternMat,[0,3.38,0],.46,.46,.65,16);
for(let i=0;i<8;i++){const a=i/8*TAU;rod(lighthouse,M.dark,[.5*Math.cos(a),3.04,.5*Math.sin(a)],[.5*Math.cos(a),3.73,.5*Math.sin(a)],.025);}
cylinder(lighthouse,M.red,[0,3.82,0],0,.72,.42,24);
ball(lighthouse,M.gold,[0,4.1,0],[.08,.13,.08]);
const door=box(lighthouse,M.dark,[.02,.52,.68],[.33,.7,.055]);
for(const y of [1.2,2.35]) box(lighthouse,M.dark,[0,y,.62-y*.035],[.17,.25,.04]);
const lamp=new THREE.PointLight('#ffb951',0,12,2);lamp.position.set(-1.8,3.6,-1.4);scene.add(lamp);
const beamMat=new THREE.MeshBasicMaterial({color:'#ffdc92',transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending});
const beam=mesh(new THREE.ConeGeometry(1.65,12,24,1,true),beamMat,lighthouse,[0,3.4,0]);beam.rotation.z=Math.PI/2;beam.position.x=6;beam.castShadow=false;
const beamPivot=new THREE.Group();beamPivot.position.y=3.4;lighthouse.add(beamPivot);beamPivot.add(beam);beam.position.y=0;

const palms=[];
const leafMaterial=M.tree.clone();leafMaterial.side=THREE.DoubleSide;
function palm(x,z,height,tilt) {
 const p=new THREE.Group();p.position.set(x,.3,z);island.add(p);p.rotation.z=tilt;
 tube(p,M.trunk,[[0,0,0],[.15,height*.5,0],[.35,height,0]],.12,16);
 const crown=new THREE.Group();crown.position.set(.35,height,0);p.add(crown);
 for(let i=0;i<7;i++){
  const a=i/7*TAU,leaf=new THREE.Group();crown.add(leaf);leaf.rotation.y=a;
  const points=[[0,0,0],[.55,.22,0],[1.15,.05,0],[1.6,-.45,0]];
  const path=new THREE.CatmullRomCurve3(points.map(p=>v(...p)));
  const g=new THREE.BufferGeometry(),verts=[],inds=[];
  for(let j=0;j<=12;j++){const t=j/12,c=path.getPoint(t),width=.22*Math.sin(t*Math.PI);verts.push(c.x,c.y,c.z-width,c.x,c.y+.035,c.z+width);if(j<12){const k=j*2;inds.push(k,k+1,k+2,k+1,k+3,k+2);}}
  g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));g.setIndex(inds);g.computeVertexNormals();mesh(g,leafMaterial,leaf);
 }
 for(let i=0;i<3;i++)ball(crown,M.leather,[Math.cos(i*2)*.15,-.12,Math.sin(i*2)*.15],[.14,.19,.14],true);
 palms.push(crown);
}
palm(2.0,-2.2,2.5,-.12);palm(3.2,-.6,2.1,.15);palm(-3.2,1.9,2.4,.12);
// Small striped beach cabin, boardwalk, parasol and coastal planting.
const cabin=new THREE.Group();cabin.position.set(1.1,.31,1.9);cabin.rotation.y=-.35;island.add(cabin);
box(cabin,M.cream,[0,.53,0],[1.1,1.05,.9]);
for(let i=0;i<7;i++)box(cabin,M.teal,[-.48+i*.16,.53,.458],[.08,1.0,.018]);
box(cabin,M.dark,[.1,.4,.48],[.37,.7,.028]);box(cabin,M.cream,[.1,.4,.5],[.29,.62,.025]);
const roof=new THREE.CylinderGeometry(.87,.87,1.35,3);roof.rotateZ(Math.PI/2);const roofObj=mesh(roof,M.coral,cabin,[0,1.14,0]);roofObj.rotation.x=Math.PI/2;
for(let j=0;j<5;j++)box(cabin,M.trunk,[.1,.02,.65+j*.17],[.6,.04,.12]);
const umbrella=new THREE.Group();umbrella.position.set(2.8,.3,2.1);island.add(umbrella);rod(umbrella,M.leather,[0,0,0],[0,1.5,0],.035);
const canopy=new THREE.ConeGeometry(.85,.35,12,1,true);const umbrellaTop=mesh(canopy,M.cream,umbrella,[0,1.5,0]);umbrellaTop.material.side=THREE.DoubleSide;
for(let i=0;i<6;i++){
 const stripe=mesh(new THREE.ConeGeometry(.855,.35,12,1,true,i*TAU/6,TAU/12),M.coral,umbrella,[0,1.502,0]);stripe.material.side=THREE.DoubleSide;
}
box(island,M.cream,[2.75,.36,2.75],[.65,.06,1.2]).rotation.y=.2;
for(let i=0;i<22;i++){
 const a=i*2.399,r=2+((i*17)%27)/12;
 if(Math.abs(Math.cos(a)*r+1.8)<1.2 && Math.abs(Math.sin(a)*r+1.4)<1.2)continue;
 const bush=ball(island,i%3?M.grass:M.tree,[Math.cos(a)*r,.36,Math.sin(a)*r],[.30,.20,.30],true);
 if(i%4===0)ball(bush,M.line,[0,.8,0],[.22,.25,.22],true);
}
const sign=new THREE.Group();sign.position.set(4.5,.25,2.5);island.add(sign);rod(sign,M.trunk,[0,0,0],[0,1.3,0],.045);box(sign,M.cream,[0,1.17,0],[.65,.3,.06]);box(sign,M.teal,[.1,1.17,.035],[.30,.035,.012]);
// Buoys, a bobbing sailboat and airborne gulls provide depth without image assets.
const boat=new THREE.Group();scene.add(boat);boat.position.set(-10,-.4,5);
ball(boat,M.coral,[0,.04,0],[.85,.25,.32]);box(boat,M.cream,[0,.17,0],[1.3,.04,.4]);rod(boat,M.trunk,[0,.2,0],[0,1.9,0],.027);
const sailG=new THREE.BufferGeometry();sailG.setAttribute('position',new THREE.Float32BufferAttribute([.04,.5,0,.04,1.9,0,.78,.5,0],3));sailG.computeVertexNormals();const sailM=M.cream.clone();sailM.side=THREE.DoubleSide;mesh(sailG,sailM,boat);
const gulls=[];
for(let i=0;i<4;i++){
 const g=new THREE.Group();scene.add(g);ball(g,M.cream,[0,0,0],[.12,.085,.21],true);
 const wings=[];for(const side of [-1,1]){const w=new THREE.Group();g.add(w);ball(w,M.cream,[side*.28,.025,0],[.32,.035,.12],true);wings.push(w);}gulls.push({group:g,wings,phase:i*1.8});
}
const clouds=[];const cloudMat=material('cloud','#eef3df');
for(let i=0;i<6;i++){const c=new THREE.Group();scene.add(c);c.position.set(Math.cos(i*1.6)*25,8+i%3,Math.sin(i*1.6)*25);for(let j=0;j<4;j++)ball(c,cloudMat,[(j-1.5)*.9,Math.sin(j)*.25,0],[1.2,.47,.65],true);clouds.push(c);}

// Bicycle in local coordinates: +X points forward; its wheels share crank speed.
const rider=new THREE.Group();scene.add(rider);
const bike=new THREE.Group();rider.add(bike);
const wheels=[];
for(const x of [-.94,.94]) {
 const w=new THREE.Group();w.position.set(x,.62,0);bike.add(w);wheels.push(w);
 torus(w,M.tire,.56,.065,[0,0,0]);torus(w,M.cream,.525,.014,[0,0,.055]);torus(w,M.cream,.525,.014,[0,0,-.055]);
 torus(w,M.silver,.50,.017,[0,0,0]);
 for(let j=0;j<20;j++){const a=j/20*TAU;rod(w,M.silver,[0,0,j%2?.035:-.035],[.5*Math.cos(a),.5*Math.sin(a),0],.007,5);}
 const hub=cylinder(w,M.silver,[0,0,0],.065,.065,.18,12);hub.rotation.x=Math.PI/2;
}
const A=[-.94,.62,0],B=[-.36,1.52,0],C=[-.12,.72,0],D=[.70,1.48,0],E=[.94,.62,0];
for(const [a,b] of [[A,B],[B,C],[C,A],[B,D],[C,D],[D,E]])rod(bike,M.teal,a,b,.048);
for(const z of [-.09,.09]){rod(bike,M.teal,[-.94,.62,z],[-.36,1.52,z],.025);rod(bike,M.teal,[.94,.62,z],[.74,1.38,z],.027);}
rod(bike,M.silver,[-.36,1.48,0],[-.41,1.68,0],.03);
ball(bike,M.leather,[-.46,1.70,0],[.26,.065,.15]);
rod(bike,M.silver,[.7,1.45,0],[.70,1.77,0],.028);
tube(bike,M.silver,[[.7,1.77,-.37],[.91,1.78,-.34],[.88,1.79,0],[.91,1.78,.34],[.7,1.77,.37]],.026);
for(const z of [-.35,.35])rod(bike,M.leather,[.60,1.77,z],[.8,1.77,z],.04);
ball(bike,M.gold,[.75,1.82,-.22],[.06,.04,.06]);
const headlightMat=new THREE.MeshStandardMaterial({color:'#fff5bf',emissive:'#ffd679',emissiveIntensity:.35});
ball(bike,M.dark,[.85,1.5,0],[.12,.10,.10]);ball(bike,headlightMat,[.95,1.5,0],[.035,.08,.08]);
const headlight=new THREE.PointLight('#ffe4a9',0,5,2);headlight.position.set(1.1,1.5,0);bike.add(headlight);
const gear=torus(bike,M.silver,.19,.025,[-.12,.72,.105],36);
const rearGear=torus(bike,M.silver,.09,.015,[-.94,.62,.12],24);
tube(bike,M.dark,[[-.94,.71,.13],[-.12,.91,.13],[.065,.73,.13],[-.12,.53,.13],[-.94,.53,.13],[-1.03,.62,.13],[-.94,.71,.13]],.009,48);
const crank=new THREE.Group();crank.position.set(-.12,.72,0);bike.add(crank);
for(const s of [-1,1])rod(crank,M.silver,[0,0,s*.14],[s*.26,0,s*.14],.026);
const pedals=[-1,1].map(s=>box(bike,M.dark,[0,0,s*.23],[.20,.045,.14]));
// Rear rack and two tiny parcels.
for(const z of [-.17,.17]){rod(bike,M.silver,[-.95,.62,z],[-.88,1.25,z],.018);rod(bike,M.silver,[-1.15,1.25,z],[-.56,1.25,z],.018);}
box(bike,M.coral,[-.89,1.40,0],[.43,.28,.31]);box(bike,M.cream,[-.89,1.4,.165],[.06,.28,.01]);

const bird=new THREE.Group();rider.add(bird);
const body=ball(bird,M.cream,[-.43,2.28,0],[.59,.68,.43]);body.rotation.z=-.23;
ball(bird,M.white,[-.10,2.39,0],[.35,.5,.37]);
for(let i=0;i<5;i++){const tail=ball(bird,i%2?M.feather:M.white,[-.91-i*.038,2.13+i*.025,(i-2)*.095],[.38,.09,.085]);tail.rotation.z=.35+i*.07;}
const neckPivot=new THREE.Group();neckPivot.position.set(-.04,2.55,0);bird.add(neckPivot);
tube(neckPivot,M.cream,[[0,0,0],[-.13,.35,0],[-.11,.68,0],[.16,.98,0],[.46,1.02,0]],.165,36);
ball(neckPivot,M.white,[.47,1.05,0],[.36,.30,.255]);
// Long upper bill with a hooked tip and soft hanging gular pouch.
const bill=ball(neckPivot,M.beak,[1.06,.98,0],[.63,.075,.15]);bill.rotation.z=-.025;
ball(neckPivot,M.orange,[1.64,.96,0],[.085,.09,.065]).rotation.z=-.35;
const pouch=ball(neckPivot,M.pouch,[.93,.79,0],[.47,.20,.145]);pouch.rotation.z=.14;
rod(neckPivot,M.leather,[.61,.945,-.146],[1.6,.938,-.025],.009,6);
rod(neckPivot,M.leather,[.61,.945,.146],[1.6,.938,.025],.009,6);
for(const s of [-1,1]) {
 ball(neckPivot,M.orange,[.48,1.115,s*.23],[.105,.107,.035]);
 ball(neckPivot,M.dark,[.495,1.13,s*.26],[.062,.068,.022]);
 ball(neckPivot,M.white,[.511,1.154,s*.279],[.018,.02,.006],true);
 const brow=ball(neckPivot,M.cream,[.49,1.21,s*.24],[.11,.037,.03]);brow.rotation.z=-.14;
}
// A vintage cycling cap, its visor and chin straps.
const cap=ball(neckPivot,M.dark,[.44,1.31,0],[.335,.16,.275]);
ball(neckPivot,M.teal,[.68,1.29,0],[.25,.035,.27]);
tube(neckPivot,M.coral,[[.17,1.35,0],[.35,1.465,0],[.55,1.46,0],[.69,1.36,0]],.018,16);
for(const s of [-1,1])tube(neckPivot,M.dark,[[.2,1.23,s*.24],[.38,.86,s*.23],[.64,1.19,s*.22]],.013,16);
// Scarf is a deforming ribbon, rather than a rigid prop.
const scarfRing=torus(bird,M.coral,.175,.055,[-.10,2.97,0],32);scarfRing.rotation.x=Math.PI/2;
const scarfGeo=new THREE.PlaneGeometry(.92,.20,16,1);const scarfMat=M.coral.clone();scarfMat.side=THREE.DoubleSide;
const scarf=mesh(scarfGeo,scarfMat,bird,[-.55,3.02,.07]);scarf.rotation.z=.16;
const scarfPos=scarfGeo.attributes.position,scarfBase=new Float32Array(scarfPos.array);
const wings=[];
for(const s of [-1,1]){
 const wing=new THREE.Group();wing.position.set(-.30,2.55,s*.35);bird.add(wing);wing.rotation.z=-.72;
 const upper=ball(wing,M.feather,[.26,-.10,s*.01],[.40,.18,.12]);upper.rotation.z=-.28;
 for(let i=0;i<5;i++){const f=ball(wing,i%2?M.white:M.feather,[.39+i*.048,-.18-i*.028,s*(.02+i*.016)],[.28,.065,.045]);f.rotation.z=-.4;}
 tube(bird,M.cream,[[.13,2.24,s*.36],[.42,1.94,s*.36],[.69,1.81,s*.35]],.064,16);
 ball(bird,M.feather,[.71,1.79,s*.35],[.11,.07,.075]);wings.push(wing);
}
// Analytic two-bone leg IK keeps each webbed foot physically on its pedal.
const legs=[];
for(const s of [-1,1]){
 const upper=rod(rider,M.orange,[0,0,0],[0,1,0],.061);
 const lower=rod(rider,M.orange,[0,0,0],[0,1,0],.043);
 const knee=ball(rider,M.orange,[0,0,0],[.073,.078,.065]);
 const foot=new THREE.Group();rider.add(foot);
 ball(foot,M.orange,[.04,.015,0],[.17,.05,.105]);
 for(let j=0;j<3;j++)ball(foot,M.beak,[.16,.008,(j-1)*.065],[.07,.027,.035],true);
 legs.push({s,upper,lower,knee,foot});
}
function updateLegs(phase,bob) {
 crank.rotation.z=phase;gear.rotation.z=phase;
 for(let i=0;i<2;i++){
  const l=legs[i],a=phase+(l.s===-1?Math.PI:0);
  const foot=v(-.12+.26*Math.cos(a),.72+.26*Math.sin(a),l.s*.23);
  const hip=v(-.45,1.94+bob,l.s*.23),diff=foot.clone().sub(hip),d=diff.length(),L1=.70,L2=.73;
  const along=(L1*L1-L2*L2+d*d)/(2*d),height=Math.sqrt(Math.max(0,L1*L1-along*along));
  const dir=diff.normalize(),perp=v(-dir.y,dir.x,0);
  const knee=hip.clone().addScaledVector(dir,along).addScaledVector(perp,height);
  moveRod(l.upper,hip,knee);moveRod(l.lower,knee,foot);l.knee.position.copy(knee);l.foot.position.copy(foot).add(v(.025,.04,0));
  pedals[i].position.copy(foot);
 }
}

const fishTokens=[];
for(let i=0;i<8;i++){
 const a=(i+.5)/8*TAU,f=new THREE.Group();scene.add(f);
 ball(f,M.gold,[0,0,0],[.20,.09,.075],true);
 const tail=mesh(new THREE.ConeGeometry(.10,.16,3),M.gold,f,[-.23,0,0]);tail.rotation.z=-Math.PI/2;
 ball(f,M.dark,[.12,.025,.068],[.015,.015,.008],true);
 const halo=torus(f,M.gold,.32,.012,[0,0,0],32);halo.material=M.gold;
 fishTokens.push({group:f,a,collectedLap:-1});
}
// Batch untextured static parts by material, retaining independent animated pivots.
// This reduces hundreds of spoke/feather/land draw calls on mobile GPUs.
function batchStatic(root, excluded = new Set()) {
 scene.updateMatrixWorld(true);
 const inverse = root.matrixWorld.clone().invert(), buckets = new Map();
 function visit(object) {
  if(excluded.has(object))return;
  if(object.isMesh && !Array.isArray(object.material)){
   const geo=object.geometry.clone();geo.applyMatrix4(inverse.clone().multiply(object.matrixWorld));
   let bucket=buckets.get(object.material);if(!bucket){bucket=[];buckets.set(object.material,bucket);}bucket.push({object,geo});
  }
  for(const child of [...object.children])visit(child);
 }
 for(const child of [...root.children])visit(child);
 for(const [mat,parts] of buckets){
  if(parts.length<2){parts[0].geo.dispose();continue;}
  const positions=[],normals=[],indices=[];let offset=0;
  for(const {object,geo} of parts){
   const p=geo.attributes.position,n=geo.attributes.normal;
   for(let i=0;i<p.count;i++){positions.push(p.getX(i),p.getY(i),p.getZ(i));normals.push(n.getX(i),n.getY(i),n.getZ(i));}
   if(geo.index){for(let i=0;i<geo.index.count;i++)indices.push(geo.index.getX(i)+offset);}else{for(let i=0;i<p.count;i++)indices.push(i+offset);}
   offset+=p.count;object.removeFromParent();geo.dispose();
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));g.setIndex(indices);mesh(g,mat,root);
 }
}
batchStatic(island,new Set([...palms,beamPivot]));
for(const palm of palms)batchStatic(palm);
for(const wheel of wheels)batchStatic(wheel);
batchStatic(bike,new Set([...wheels,crank,gear,...pedals]));
batchStatic(bird,new Set([neckPivot,scarf,...wings]));batchStatic(neckPivot);
for(const wing of wings)batchStatic(wing);
batchStatic(boat);for(const cloud of clouds)batchStatic(cloud);
for(const token of fishTokens)batchStatic(token.group);

const particles=[];
function burst(position, color, count=12) {
 const mat=new THREE.MeshBasicMaterial({color});
 for(let i=0;i<count;i++){
  const o=mesh(smallSphereGeo,mat,scene,position.toArray(),[.035,.035,.035]);o.castShadow=false;
  particles.push({object:o,velocity:v((Math.random()-.5)*2,1+Math.random()*2,(Math.random()-.5)*2),life:1,material:mat});
 }
}
const bellRings=[];
function ringBell(){state.bell=1;notify('叮铃！海风让路');if(!reduced.matches){const r=torus(rider,M.gold,.24,.014,[.8,1.9,0],40);r.material=new THREE.MeshBasicMaterial({color:'#ffe2a1',transparent:true});bellRings.push({mesh:r,life:1});}playBell();}
let audio;
function playBell(){try{audio ||= new (window.AudioContext||window.webkitAudioContext)();audio.resume().catch(()=>{});for(const [i,hz] of [1568,2093].entries()){const osc=audio.createOscillator(),gain=audio.createGain();osc.type='sine';osc.frequency.value=hz;gain.gain.setValueAtTime(0,audio.currentTime);gain.gain.linearRampToValueAtTime(.085,audio.currentTime+.008+i*.05);gain.gain.exponentialRampToValueAtTime(.0001,audio.currentTime+.7);osc.connect(gain);gain.connect(audio.destination);osc.start();osc.stop(audio.currentTime+.75);}}catch{}}
let toastTimer;
function notify(text){$('toast').textContent=text;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').textContent='',2200);}
function pause(){state.paused=!state.paused;if(state.paused)stopBoost();syncPause();}
function syncPause(){const b=$('pause');b.setAttribute('aria-pressed',String(state.paused));b.setAttribute('aria-label',state.paused?'继续骑行':'暂停骑行');b.querySelector('img').src=`./icons/${state.paused?'play':'pause'}.svg`;}
syncPause();
$('pause').addEventListener('click',pause);
$('bell').addEventListener('click',ringBell);
$('jump').addEventListener('click',()=>{if(state.paused){notify('先继续骑行，再跃起');return;}if(!state.jump){state.jump=.001;notify('轻盈一跃！');}});
$('night').addEventListener('click',()=>{
 state.night=!state.night;document.body.classList.toggle('night',state.night);
 $('night').setAttribute('aria-pressed',String(state.night));$('night').setAttribute('aria-label',state.night?'切换到白天':'切换到夜晚');$('night').querySelector('img').src=`./icons/${state.night?'sun':'moon'}.svg`;
});
$('view').addEventListener('click',()=>{state.overview=!state.overview;state.orbit=0;state.elevation=0;state.zoom=1;$('view').setAttribute('aria-pressed',String(state.overview));$('view').setAttribute('aria-label',state.overview?'切换到跟随视角':'切换到环岛视角');notify(state.overview?'环岛视角':'跟随视角');});
$('reset').addEventListener('click',()=>{state.orbit=0;state.elevation=0;state.zoom=1;notify('视角已归位');});
function boost(on){state.boost=on;$('boost').classList.toggle('active',on);if(on&&state.paused){state.paused=false;syncPause();}}
// Track input sources so releasing one accelerator does not cancel another.
const boostInputs=new Set();
function setBoost(source,on){if(on)boostInputs.add(source);else boostInputs.delete(source);boost(boostInputs.size>0);}
function stopBoost(){boostInputs.clear();boost(false);}
$('boost').addEventListener('pointerdown',e=>{e.preventDefault();$('boost').setPointerCapture(e.pointerId);setBoost(`pointer:${e.pointerId}`,true);});
for(const event of ['pointerup','pointercancel','lostpointercapture'])$('boost').addEventListener(event,e=>setBoost(`pointer:${e.pointerId}`,false));
$('boost').addEventListener('keydown',e=>{if(e.code==='Space'||e.code==='Enter'){e.preventDefault();e.stopPropagation();if(!e.repeat)setBoost(`key:${e.code}`,true);}});
$('boost').addEventListener('keyup',e=>{if(e.code==='Space'||e.code==='Enter'){e.preventDefault();e.stopPropagation();setBoost(`key:${e.code}`,false);}});
$('boost').addEventListener('blur',stopBoost);
window.addEventListener('blur',stopBoost);
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopBoost();});
const shortcutsDialog=$('shortcut-dialog');
function openShortcuts(){stopBoost();if(!shortcutsDialog.open)shortcutsDialog.showModal();}
$('keyboard-help').addEventListener('click',openShortcuts);
$('shortcut-close').addEventListener('click',()=>shortcutsDialog.close());
const desktopPointer=matchMedia('(hover: hover) and (pointer: fine)');
function syncGesture(){ $('gesture-text').textContent=desktopPointer.matches?'拖动旋转 · 滚轮缩放':'拖动看四周 · 双指缩放'; }
syncGesture();desktopPointer.addEventListener('change',syncGesture);
const shortcutButtons={KeyP:'pause',KeyJ:'jump',KeyB:'bell',KeyV:'view',KeyN:'night',KeyR:'reset'};
window.addEventListener('keydown',e=>{
 if(e.defaultPrevented||e.isComposing||e.ctrlKey||e.metaKey||e.altKey)return;
 if(e.target.closest('input,textarea,select,[contenteditable="true"]')||shortcutsDialog.open)return;
 // Preserve normal Space/Enter activation for a focused native button.
 if((e.code==='Space'||e.code==='Enter')&&e.target.closest('button'))return;
 if(e.code==='ArrowUp'||e.code==='KeyW'){
  e.preventDefault();if(!e.repeat)setBoost(`key:${e.code}`,true);return;
 }
 if(e.code==='ArrowLeft'||e.code==='ArrowRight'){
  e.preventDefault();state.orbit+=e.code==='ArrowLeft'?.12:-.12;return;
 }
 if(e.code==='Equal'||e.code==='NumpadAdd'||e.code==='Minus'||e.code==='NumpadSubtract'){
  e.preventDefault();const zoomIn=e.code==='Equal'||e.code==='NumpadAdd';state.zoom=THREE.MathUtils.clamp(state.zoom+(zoomIn?-.08:.08),.65,1.65);return;
 }
 const action=e.code==='Space'?'pause':shortcutButtons[e.code];
 if(action){e.preventDefault();if(!e.repeat)$(action).click();return;}
 if(e.code==='KeyH'||e.key==='?'){e.preventDefault();if(!e.repeat)openShortcuts();}
});
window.addEventListener('keyup',e=>{
 // Release even when focus/modifier state changed while the key was held.
 const source=`key:${e.code}`;
 if(boostInputs.has(source)){e.preventDefault();setBoost(source,false);}
});
reduced.addEventListener('change',()=>{if(reduced.matches){state.paused=true;syncPause();}});
// Pointer capture supports both one-finger orbit and two-finger pinch.
const pointers=new Map();let pinchDistance=0;
canvas.addEventListener('pointerdown',e=>{canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){const p=[...pointers.values()];pinchDistance=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);}});
canvas.addEventListener('pointermove',e=>{
 const old=pointers.get(e.pointerId);if(!old)return;
 if(pointers.size===1){state.orbit-=(e.clientX-old.x)*.009;state.elevation=THREE.MathUtils.clamp(state.elevation+(e.clientY-old.y)*.008,-.45,.7);}
 pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(pointers.size===2){const p=[...pointers.values()],d=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);if(pinchDistance>0&&d>0)state.zoom=THREE.MathUtils.clamp(state.zoom*pinchDistance/d,.65,1.65);pinchDistance=d;}
});
for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,e=>{pointers.delete(e.pointerId);pinchDistance=0;});
canvas.addEventListener('wheel',e=>{e.preventDefault();state.zoom=THREE.MathUtils.clamp(state.zoom+e.deltaY*.001,.65,1.65);},{passive:false});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();$('error').hidden=false;$('error').querySelector('p').textContent='3D 绘制暂时中断，请重新加载场景。';});
function resize(){const w=canvas.clientWidth,h=canvas.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
const observer=new ResizeObserver(resize);observer.observe(canvas);resize();

let last=performance.now(),phase=0,displayTick=0,lightBlend=0,initialized=false;
const target=new THREE.Vector3(),desiredCamera=new THREE.Vector3(),smoothTarget=new THREE.Vector3();
const dayColor=new THREE.Color('#d2e9e3'),nightColor=new THREE.Color('#173e52');
const warmLight=new THREE.Color('#fff0d3'),moonLight=new THREE.Color('#b5d5ef');
function animate(now){
 requestAnimationFrame(animate);
 const dt=Math.min((now-last)/1000,.045);last=now;
 if(document.hidden)return;
 const moving=!state.paused;
 const envDt=reduced.matches||state.paused?0:dt;
 state.time+=envDt;
 state.speed=THREE.MathUtils.damp(state.speed,state.paused?0:state.boost?23:8,4,dt);
 const travel=moving?state.speed/3.6*dt:0;
 state.distance+=travel;
 // Cadence eases like a rider changing gears; wheels stay tied to ground travel.
 if(moving)phase-=(3.4+state.speed*.35)*Math.min(state.speed/4,1)*dt;
 const angle=state.distance/ROAD,lap=Math.floor(angle/TAU),localAngle=angle%TAU;
 let hop=0;
 if(state.jump){if(moving)state.jump+=dt*1.4;hop=Math.sin(Math.min(state.jump,1)*Math.PI)*.72;if(state.jump>=1)state.jump=0;}
 rider.position.set(ROAD*Math.cos(angle),.16+hop,ROAD*Math.sin(angle));rider.rotation.y=-angle-Math.PI/2;
 const bob=moving&&!reduced.matches?Math.sin(phase*2)*.018:0;
 bike.rotation.x=moving?-.045:0;bird.position.y=bob;
 neckPivot.rotation.z=Math.sin(state.time*2)*.02+state.bell*.035;
 for(const wing of wings)wing.rotation.x=Math.sin(state.time*4)*.015;
 for(const wheel of wheels)wheel.rotation.z=-state.distance/.56;
 updateLegs(phase,bob);
 for(let i=0;i<scarfPos.count;i++){
  const x=scarfBase[i*3];scarfPos.setZ(i,scarfBase[i*3+2]+Math.sin(x*10+state.time*(4+state.speed*.15))*.06*(.5-x));
 }scarfPos.needsUpdate=true;
 state.bell=Math.max(0,state.bell-dt*2.5);
 for(const f of fishTokens){
  const collected=f.collectedLap===lap;
  f.group.visible=!collected;
  f.group.position.set(ROAD*Math.cos(f.a),1.04+Math.sin(state.time*3+f.a)*.11,ROAD*Math.sin(f.a));f.group.rotation.y=-f.a-Math.PI/2;f.group.rotation.z=Math.sin(state.time*2+f.a)*.12;
  // Crossing detection remains stable at any frame rate, including low FPS.
  const previousAngle=(state.distance-travel)/ROAD;
  const previousLap=Math.floor(previousAngle/TAU);
  const crossed=moving&&travel>0&&((localAngle>=f.a&&(previousLap<lap||previousAngle%TAU<f.a)));
  if(crossed&&!collected){f.collectedLap=lap;f.group.visible=false;state.fish++;if(!reduced.matches)burst(f.group.position,'#ffca65',9);if(state.fish%8===0)notify('一圈满载，继续追风！');}
 }
 for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt*1.5;p.velocity.y-=dt*3;p.object.position.addScaledVector(p.velocity,dt);p.object.scale.setScalar(Math.max(0,p.life)*.05);if(p.life<=0){scene.remove(p.object);particles.splice(i,1);if(!particles.some(q=>q.material===p.material))p.material.dispose();}}
 for(let i=bellRings.length-1;i>=0;i--){const r=bellRings[i];r.life-=dt*1.5;r.mesh.scale.setScalar(1+(1-r.life)*4);r.mesh.material.opacity=Math.max(0,r.life);if(r.life<=0){rider.remove(r.mesh);r.mesh.geometry.dispose();r.mesh.material.dispose();bellRings.splice(i,1);}}
 if(envDt){
  for(let i=0;i<waterPosition.count;i++){const x=waterBase[i*3],z=waterBase[i*3+2];waterPosition.setY(i,Math.sin(x*.35+state.time*.8)*.035+Math.cos(z*.3+state.time*.7)*.03);}waterPosition.needsUpdate=true;
  boat.position.y=-.39+Math.sin(state.time*1.4)*.065;boat.rotation.z=Math.sin(state.time*1.3)*.06;
  palms.forEach((p,i)=>{p.rotation.z=Math.sin(state.time*1.6+i)*.055;p.rotation.x=Math.sin(state.time*1.3+i)*.035;});
  gulls.forEach((g,i)=>{const a=state.time*.1+g.phase;g.group.position.set(Math.cos(a)*(11+i),5.5+i*.65,Math.sin(a)*(11+i));g.group.rotation.y=-a;g.wings[0].rotation.z=Math.sin(state.time*4+i)*.25;g.wings[1].rotation.z=-Math.sin(state.time*4+i)*.25;});
  foam.forEach((f,i)=>f.position.y=-.56+Math.sin(state.time+i)*.025);ripples.forEach((r,i)=>r.scale.setScalar(1+Math.sin(state.time*.7+i)*.025));
  beamPivot.rotation.y=state.time*.28;
 }
 lightBlend=THREE.MathUtils.damp(lightBlend,state.night?1:0,2.5,dt);
 scene.background.copy(dayColor).lerp(nightColor,lightBlend);scene.fog.color.copy(scene.background);
 hemi.intensity=2.8-lightBlend*1.65;sunlight.intensity=3.7-lightBlend*2.4;sunlight.color.copy(warmLight).lerp(moonLight,lightBlend);
 fill.intensity=1.3-lightBlend*.55;lamp.intensity=lightBlend*11;lanternMat.emissiveIntensity=.25+lightBlend*2;beamMat.opacity=lightBlend*.055;
 headlight.intensity=lightBlend*2;headlightMat.emissiveIntensity=.35+lightBlend*2;
 // Follow mode presents the character at portrait scale, while overview shows the island.
 const portrait=camera.aspect<.85;
 if(state.overview){
  const a=.7+state.orbit, radius=(portrait?38:22)*state.zoom;
  desiredCamera.set(Math.sin(a)*radius, ((portrait?27:17)+state.elevation*12)*state.zoom,Math.cos(a)*radius);target.set(0,.5,0);
 }else{
  const a=-.38+state.orbit, radius=(portrait?9.2:8.3)*state.zoom;
  const offset=v(Math.sin(a)*radius,(3.0+state.elevation*5)*state.zoom,-Math.cos(a)*radius).applyQuaternion(rider.quaternion);
  desiredCamera.copy(rider.position).add(offset);target.copy(rider.position).add(v(.15,2.08,0).applyQuaternion(rider.quaternion));
 }
 if(!initialized||reduced.matches){camera.position.copy(desiredCamera);smoothTarget.copy(target);initialized=true;}else{camera.position.lerp(desiredCamera,1-Math.exp(-dt*5));smoothTarget.lerp(target,1-Math.exp(-dt*6));}
 camera.lookAt(smoothTarget);
 renderer.render(scene,camera);
 displayTick+=dt;if(displayTick>.1){$('speed').textContent=Math.round(state.speed);$('fish-count').textContent=state.fish;$('lap-count').textContent=lap;displayTick=0;}
}
// Read-only diagnostics for reproducible animation verification.
window.__pelican={state,renderer,scene,camera,rider,legs,wheels,get phase(){return phase;},get ready(){return initialized;}};
updateLegs(0,0);requestAnimationFrame(animate);$('loading').hidden=true;
if(reduced.matches)notify('已暂停自动骑行，点击播放出发');
window.addEventListener('pagehide',()=>{stopBoost();audio?.suspend().catch(()=>{});});
