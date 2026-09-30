import * as THREE from './vendor/three.module.min.js';

const $ = (id) => document.getElementById(id);
const reducedQuery = matchMedia('(prefers-reduced-motion: reduce)');
let reduced = reducedQuery.matches;
const state = { speed: 0, distance: 0, phase: 0, time: 0, jump: 0, velocity: 0, letters: 0, route: 1, paused: reduced, night: false, sound: false, angle: .28, elevation: .23, view: 0, bell: 0, ready: false };
const held = new Set();
const dots = Array.from({length:8}, () => { const el = document.createElement('i'); $('letter-dots').append(el); return el; });
let toastUntil = 7;
function toast(message, duration = 3) { $('toast').textContent = message; $('toast').classList.add('visible'); toastUntil = performance.now()/1000 + duration; }
function icon(id, name) { $(id).querySelector('img').src = `./icons/${name}.svg`; }
let audio;
function tone(freq, duration = .3, volume = .09, delay = 0) {
  if (!state.sound) return;
  try { audio ||= new (window.AudioContext || window.webkitAudioContext)(); if(audio.state === 'suspended') audio.resume(); const osc = audio.createOscillator(), gain = audio.createGain(), at = audio.currentTime + delay; osc.type = 'sine'; osc.frequency.setValueAtTime(freq, at); gain.gain.setValueAtTime(0,at); gain.gain.linearRampToValueAtTime(volume,at+.012); gain.gain.exponentialRampToValueAtTime(.0001,at+duration); osc.connect(gain).connect(audio.destination); osc.start(at); osc.stop(at+duration); } catch { state.sound = false; updateSound(); }
}
function bell() { if (!state.ready) return; state.bell = 1; tone(1568,.6); tone(2093,.5,.055,.095); toast('叮铃！借过一只快乐的鹈鹕。',2); }
function jump() { if(!state.ready || state.paused || $('instructions').open) return; if (state.jump < .025) { state.velocity = 5.8; tone(392,.2,.05); } }
function updatePause() { icon('pause',state.paused?'play':'pause'); $('pause').setAttribute('aria-label',state.paused?'继续骑行':'暂停'); $('pause').setAttribute('aria-pressed',String(state.paused)); }
function pause() { state.paused = !state.paused; held.clear(); updatePause(); toast(state.paused?'停下来，听听海。':'继续沿着海岸骑行',2); }
function updateSound(){ icon('sound',state.sound?'speaker-high':'speaker-slash'); $('sound').setAttribute('aria-label',state.sound?'关闭声音':'开启声音'); $('sound').setAttribute('aria-pressed',String(state.sound)); }
function toggleSound(){state.sound=!state.sound;updateSound();tone(784,.22);toast(state.sound?'声音已开启':'声音已关闭',1.5);}

try { init(); } catch(error) { console.error('Pelican Post could not start:',error); $('loading').hidden=true; $('error').hidden=false; }

function init() {
const scene = new THREE.Scene();
scene.background = new THREE.Color('#efb899');
scene.fog = new THREE.Fog('#efb899',27,75);
const renderer = new THREE.WebGLRenderer({canvas:$('scene'),antialias:true,alpha:false,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.23;
const camera = new THREE.PerspectiveCamera(37,1,.1,130);
const hemi = new THREE.HemisphereLight('#fff3df','#618a7a',2.65);scene.add(hemi);
const sunLight = new THREE.DirectionalLight('#ffe4bb',3.4);sunLight.position.set(-3,8,5);scene.add(sunLight);
sunLight.castShadow=true;sunLight.shadow.mapSize.set(1024,1024);Object.assign(sunLight.shadow.camera,{left:-9,right:9,top:7,bottom:-7,near:.1,far:24});sunLight.shadow.bias=-.00035;sunLight.shadow.normalBias=.035;
const rim = new THREE.DirectionalLight('#ffc29c',1.3);rim.position.set(2,4,-6);scene.add(rim);
const mats = {};
function mat(color,roughness=.7,metalness=0) { const key=`${color}/${roughness}/${metalness}`; return mats[key] ||= new THREE.MeshStandardMaterial({color,roughness,metalness}); }
const cream=mat('#fff8df'), feather=mat('#e7e9d6'), dark=mat('#273a37'), orange=mat('#efa139'), pouch=mat('#e9b85d'), mint=mat('#4da997',.33,.25), silver=mat('#d9e1d1',.3,.7), rust=mat('#cf664a'), leather=mat('#814d39'), gold=mat('#e8bd63',.28,.5);
const sphereGeo=new THREE.SphereGeometry(1,24,16), boxGeo=new THREE.BoxGeometry(1,1,1), cylinderGeo=new THREE.CylinderGeometry(1,1,1,10);
function mesh(geo,material,parent,pos=[0,0,0],scale=[1,1,1],shadow=true){const m=new THREE.Mesh(geo,material);m.position.set(...pos);m.scale.set(...scale);m.castShadow=shadow;m.receiveShadow=shadow;parent.add(m);return m;}
function egg(parent,pos,scale,material=cream){return mesh(sphereGeo,material,parent,pos,scale);}
function box(parent,pos,scale,material){return mesh(boxGeo,material,parent,pos,scale);}
const up=new THREE.Vector3(0,1,0), va=new THREE.Vector3(),vb=new THREE.Vector3();
function link(parent,a,b,radius,material){const m=mesh(cylinderGeo,material,parent);poseLink(m,a,b,radius);return m;}
function poseLink(m,a,b,radius){va.set(...a);vb.set(...b).sub(va);m.position.copy(va).addScaledVector(vb,.5);m.scale.set(radius,vb.length(),radius);m.quaternion.setFromUnitVectors(up,vb.normalize());}
function tube(parent,points,radius,material,segments=28){const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));return mesh(new THREE.TubeGeometry(curve,segments,radius,8,false),material,parent);}
function torus(parent,pos,radius,width,material){return mesh(new THREE.TorusGeometry(radius,width,8,48),material,parent,pos);}
const rider = new THREE.Group();scene.add(rider);
const bike = new THREE.Group();rider.add(bike);
const wheels=[];
for(const x of [-1.02,1.02]){
  const w=new THREE.Group();w.position.set(x,.63,0);bike.add(w);wheels.push(w);
  torus(w,[0,0,0],.555,.065,dark);torus(w,[0,0,.048],.49,.028,cream);torus(w,[0,0,-.048],.49,.028,cream);
  torus(w,[0,0,.055],.46,.012,silver);
  for(let i=0;i<16;i++){const a=i*Math.PI/8;link(w,[0,0,0],[Math.cos(a)*.46,Math.sin(a)*.46,0],.008,silver);}
  link(w,[0,0,-.14],[0,0,.14],.062,silver);
  const reflector=box(w,[0,.35,.035],[.065,.11,.022],gold);reflector.rotation.z=.1;
  const fender=mesh(new THREE.TorusGeometry(.647,.034,8,40,Math.PI*.86),mint,bike,[x,.63,0]);fender.rotation.z=.07*Math.PI;
}
const rear=[-1.02,.63,0], crank=[-.13,.72,0], seat=[-.44,1.55,0], head=[.68,1.5,0],front=[1.02,.63,0];
[[rear,seat],[seat,crank],[crank,rear],[seat,head],[head,crank],[head,front]].forEach(([a,b])=>link(bike,a,b,.037,mint));
link(bike,[-.44,1.52,0],[-.48,1.76,0],.032,silver);
egg(bike,[-.51,1.78,0],[.24,.058,.16],leather);
link(bike,[.68,1.5,0],[.63,1.83,0],.032,silver);
tube(bike,[[.63,1.8,0],[.69,1.91,0],[.76,1.96,.35],[.62,1.94,.43]],.025,silver);
tube(bike,[[.63,1.8,0],[.69,1.91,0],[.76,1.96,-.35],[.62,1.94,-.43]],.025,silver);
for(const z of [-.43,.43]) link(bike,[.58,1.94,z],[.77,1.94,z],.04,leather);
egg(bike,[.76,2.01,.25],[.075,.05,.075],gold);
// Headlight, rear reflector, pannier rack and a tiny stack of letters.
link(bike,[.8,1.45,0],[1.03,1.49,0],.08,silver);
egg(bike,[1.055,1.49,0],[.04,.068,.068],mat('#ffe9a9',.3));
box(bike,[-1.39,.91,.02],[.05,.1,.1],rust);
for(const z of [-.17,.17]){link(bike,[-1.03,.68,z],[-1.26,1.32,z],.019,silver);link(bike,[-1.38,1.32,z],[-.65,1.32,z],.02,silver);}
for(const x of [-1.34,-1.1,-.87])link(bike,[x,1.32,-.17],[x,1.32,.17],.017,silver);
const bag=box(bike,[-1.08,1.05,.32],[.48,.49,.22],rust);bag.rotation.z=-.06;
box(bike,[-1.08,1.29,.34],[.5,.065,.25],leather);box(bike,[-1.08,1.07,.448],[.068,.29,.015],leather);box(bike,[-1.08,1.07,.46],[.093,.083,.015],gold);
for(let i=0;i<3;i++){const letter=box(bike,[-1.08+i*.015,1.37+i*.045,0],[.4,.035,.26],cream);letter.rotation.y=i*.15-.15;}
const chainMat=mat('#596a60',.4,.4);
tube(bike,[[-1.02,.75,.1],[-.15,.94,.1],[.08,.78,.1],[-.12,.52,.1],[-1.02,.51,.1],[-1.14,.63,.1],[-1.02,.75,.1]],.015,chainMat,32);
torus(bike,[-.13,.72,.14],.19,.017,silver);
const crankArms=[],pedals=[];
for(const side of [-1,1]) {crankArms.push(link(bike,[-.13,.72,side*.19],[.08,.72,side*.19],.02,silver));pedals.push(box(bike,[0,0,0],[.21,.045,.17],dark));}
// Sculpted pelican: a broad body, S-shaped neck and a distinct hanging gular pouch.
const bird = new THREE.Group();rider.add(bird);
const body=egg(bird,[-.48,2.04,0],[.58,.63,.43]);body.rotation.z=-.36;
egg(bird,[-.18,2.25,.02],[.4,.46,.37]);
tube(bird,[[-.17,2.18,0],[.13,2.51,0],[.02,2.86,0],[.25,3.12,0]],.21,cream);
egg(bird,[.34,3.16,0],[.35,.29,.275]);
const face = new THREE.Group();face.position.set(.34,3.16,0);bird.add(face);
egg(face,[.62,-.03,0],[.74,.105,.175],orange);
egg(face,[.45,-.17,0],[.48,.25,.155],pouch).rotation.z=.16;
tube(face,[[.11,-.08,.157],[.55,-.09,.151],[1.27,-.07,.035]],.012,mat('#b96935'));
egg(face,[1.27,-.08,0],[.06,.055,.065],rust);
const eyes=[];
for(const s of [-1,1]){
 egg(face,[.095,.025,s*.244],[.108,.117,.027],mat('#f8e8c4'));
 eyes.push(egg(face,[.12,.035,s*.271],[.049,.065,.02],dark));
 egg(face,[.134,.059,s*.285],[.014,.018,.008],cream);
 tube(face,[[-.025,.14,s*.23],[.07,.165,s*.25],[.15,.145,s*.235]],.018,feather);
}
// Soft postal cap and windswept feathers.
egg(bird,[.27,3.4,0],[.32,.14,.27],mint);
egg(bird,[.5,3.365,0],[.3,.038,.23],mint);
egg(bird,[.27,3.54,0],[.047,.025,.047],gold);
for(let i=0;i<3;i++){const tail=egg(bird,[-.99-i*.065,1.99+i*.07,(i-1)*.09],[.33,.072,.09],feather);tail.rotation.z=-.3-i*.08;}
// Wings are rooted at the shoulders and extend toward the grips; jump opens them.
const wings=[];
for(const s of [-1,1]){
 const wing=new THREE.Group();wing.position.set(-.32,2.39,s*.31);bird.add(wing);wings.push(wing);
 const upper=egg(wing,[.04,-.22,s*.015],[.22,.37,.105],feather);upper.rotation.z=.38;
 const fore=egg(wing,[.33,-.37,s*.015],[.37,.135,.09]);fore.rotation.z=.19;
 for(let i=0;i<4;i++){const f=egg(wing,[.46+i*.057,-.37+i*.025,s*(.017+i*.018)],[.22,.055,.045],i%2?cream:feather);f.rotation.z=.22+i*.09;}
}
// Long orange legs solve a two-link IK chain on each moving pedal.
const legs=[];
for(const s of [-1,1]){
 const thigh=link(rider,[0,0,0],[0,1,0],.052,orange),shin=link(rider,[0,0,0],[0,1,0],.043,orange);
 const knee=egg(rider,[0,0,0],[.063,.067,.062],pouch);
 const foot=egg(rider,[0,0,0],[.19,.05,.115],orange);
 legs.push({side:s,thigh,shin,knee,foot});
}
// A red scarf is a deforming mesh, rather than a rigid triangle.
torus(bird,[.07,2.68,0],.214,.049,rust).rotation.x=Math.PI/2;
const scarfGeo=new THREE.PlaneGeometry(.9,.15,16,1);
const scarfMat=new THREE.MeshStandardMaterial({color:'#d7654a',roughness:.8,side:THREE.DoubleSide});
const scarf=mesh(scarfGeo,scarfMat,bird,[-.43,2.68,-.05]);
const scarfBase=Float32Array.from(scarfGeo.attributes.position.array);

// Coast: continuous road with a pebbled sand bank, tidal foam and distant islands.
const world=new THREE.Group();scene.add(world);
const seaMat=mat('#599e9a',.38,.1),sandMat=mat('#ebc990'),roadMat=mat('#b1b1a0');
const sea=mesh(new THREE.PlaneGeometry(220,160),seaMat,world,[0,-.28,-35],[1,1,1],false);sea.rotation.x=-Math.PI/2;sea.receiveShadow=true;
box(world,[0,-.25,1.2],[180,.48,7],sandMat).receiveShadow=true;
const road=box(world,[0,.015,.1],[180,.11,2.95],roadMat);road.receiveShadow=true;road.castShadow=false;
for(const z of [-1.3,1.5])box(world,[0,.078,z],[180,.014,.045],cream).castShadow=false;
const moving=[];
for(let i=0;i<22;i++){const dash=box(world,[i*2.8-29,.08,.1],[.8,.012,.045],cream);dash.castShadow=false;moving.push({obj:dash,speed:1,span:61.6});}
const waveMat=mat('#bce0c5');
const waves=new THREE.InstancedMesh(new THREE.BoxGeometry(1,.013,.04),waveMat,100);world.add(waves);
const dummy=new THREE.Object3D(),waveData=[];
let seed=714;
function rand(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
for(let i=0;i<100;i++)waveData.push({x:(rand()-.5)*75,z:-2.9-rand()*37,len:.25+rand()*2.3,phase:rand()*6.28});
for(let k=0;k<5;k++){
 const points=[];for(let j=0;j<50;j++)points.push([-50+j*2,-.17+k*.026,-2.6-k*.32+Math.sin(j*.75+k)*.13]);
 const foam=tube(world,points,.035-k*.004,waveMat,100);foam.castShadow=false;
}
// Repeating roadside tufts, beach stones and striped bollards.
const props=new THREE.Group();world.add(props);
for(let i=0;i<18;i++){
 const g=new THREE.Group();g.position.set(i*3.5-31,0,2.05+rand()*.8);props.add(g);moving.push({obj:g,speed:1,span:63});
 const stone=mesh(new THREE.IcosahedronGeometry(1,0),mat(i%2?'#c9b987':'#d4c099'),g,[0,.06,0],[.12+rand()*.16,.1,.16]);stone.rotation.set(rand(),rand(),rand());
 if(i%2===0)for(let n=0;n<4;n++) { const stalk=mesh(new THREE.ConeGeometry(.033,.35+rand()*.22,4),mat('#818f62'),g,[.25+n*.065,.16,rand()*.2]);stalk.rotation.z=(rand()-.5)*.6; }
 if(i%3===0){link(g,[0,0,-3.55],[0,.45,-3.55],.047,cream);link(g,[0,.3,-3.55],[0,.4,-3.55],.05,rust);}
}
// Distant lighthouse and its island, entirely modeled in geometry.
const island=new THREE.Group();island.position.set(-7,-.25,-15);world.add(island);
egg(island,[0,-.1,0],[4,.62,2.3],mat('#8d9e86'));
egg(island,[-1,.06,.55],[2.8,.38,1.6],sandMat);
const tower=new THREE.Group();tower.position.set(.6,.35,0);island.add(tower);
mesh(new THREE.CylinderGeometry(.38,.6,3.1,20),cream,tower,[0,1.55,0]);
for(const y of [.7,1.7,2.7])mesh(new THREE.CylinderGeometry(.6-y*.07,.6-(y-.27)*.07,.28,20),rust,tower,[0,y,0]);
mesh(new THREE.CylinderGeometry(.63,.63,.12,20),cream,tower,[0,3.12,0]);
mesh(new THREE.CylinderGeometry(.38,.38,.61,12),mat('#546f69',.3,.4),tower,[0,3.45,0]);
for(let i=0;i<8;i++){const a=i*Math.PI/4;link(tower,[Math.cos(a)*.52,3.2,Math.sin(a)*.52],[Math.cos(a)*.52,3.57,Math.sin(a)*.52],.017,cream);}
const rail=torus(tower,[0,3.57,0],.54,.022,cream);rail.rotation.x=Math.PI/2;
mesh(new THREE.ConeGeometry(.66,.45,20),rust,tower,[0,3.99,0]);
egg(tower,[0,3.48,0],[.29,.18,.29],new THREE.MeshBasicMaterial({color:'#ffe4a1'}));
box(tower,[0,.39,.535],[.23,.65,.07],leather);
for(const y of [1.2,2.3])box(tower,[0,y,.5-y*.04],[.13,.25,.06],dark);
const lighthouseGlow=new THREE.PointLight('#ffc873',0,14);lighthouseGlow.position.set(-6.4,3.6,-15);scene.add(lighthouseGlow);
for(let i=0;i<6;i++){const rock=mesh(new THREE.IcosahedronGeometry(1,1),mat('#73958a'),world,[i*9-25,-.3,-28-rand()*8],[3+rand()*4,.9+rand(),1.5+rand()]);rock.rotation.y=rand()*3;}
// Small sailboat, hand assembled in 3D.
const boat=new THREE.Group();boat.position.set(8,-.1,-12);scene.add(boat);
egg(boat,[0,0,0],[.95,.15,.29],rust);link(boat,[0,0,0],[0,1.7,0],.025,leather);
function triangle(parent,vertices,material){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices.flat(),3));g.computeVertexNormals();return mesh(g,material,parent);}
triangle(boat,[[0,1.6,0],[0,.3,0],[-.78,.3,0]],new THREE.MeshStandardMaterial({color:'#fff3d3',side:THREE.DoubleSide}));
triangle(boat,[[.08,1.3,0],[.08,.3,0],[.62,.3,0]],new THREE.MeshStandardMaterial({color:'#e9b273',side:THREE.DoubleSide}));
const sun=egg(scene,[-1,2.8,-19],[1.6,1.6,1.6],new THREE.MeshBasicMaterial({color:'#ffe5b0'}));
const clouds=[];
for(let i=0;i<7;i++){const c=new THREE.Group();c.position.set(i*10-35,7+rand()*4,-22-rand()*18);scene.add(c);for(let j=0;j<3;j++)egg(c,[j*.85,.15*Math.sin(j*2),0],[1.3,.34,.4],mat('#f7d6b7'));clouds.push(c);}
const gulls=[];
for(let i=0;i<5;i++){const g=new THREE.Group();scene.add(g);const ws=[];for(const s of [-1,1]){const w=egg(g,[s*.19,0,0],[.25,.035,.1],cream);ws.push(w);}gulls.push({g,ws,phase:i*1.3});}
const starPositions=[];for(let i=0;i<90;i++)starPositions.push((rand()-.5)*32,2+rand()*9,-18-rand()*14);
const starGeo=new THREE.BufferGeometry();starGeo.setAttribute('position',new THREE.Float32BufferAttribute(starPositions,3));
const stars=new THREE.Points(starGeo,new THREE.PointsMaterial({color:'#fff8d1',size:.09,sizeAttenuation:true}));stars.visible=false;scene.add(stars);

// Reusable envelopes have real folded seams, stamps and a soft golden orbit.
const mailItems=[];
function envelope(x,index){const g=new THREE.Group();g.position.set(x,index%3===2?2.95:1.55,0);scene.add(g);
 box(g,[0,0,0],[.43,.3,.055],cream);
 tube(g,[[-.2,.13,.034],[0,-.015,.04],[.2,.13,.034]],.009,mat('#c28f60'),8);
 box(g,[.13,.065,.034],[.068,.078,.008],rust);
 const halo=torus(g,[0,0,-.03],.32,.012,gold);halo.scale.y=.85;
 mailItems.push({g,baseY:g.position.y,index,collected:false});}
for(let i=0;i<6;i++)envelope(5+i*6,i);
const particles=[];
for(let i=0;i<28;i++){const m=mesh(new THREE.OctahedronGeometry(.05,0),i%2?gold:cream,scene);m.visible=false;particles.push({m,life:0,v:new THREE.Vector3()});}
function burst(pos){particles.forEach(p=>{p.m.position.copy(pos);p.m.visible=true;p.life=.65+rand()*.4;p.v.set((rand()-.5)*3,rand()*2+.4,(rand()-.5)*2);});}
function collect(item){item.collected=true;item.g.visible=false;state.letters++;dots.forEach((d,i)=>d.classList.toggle('filled',i<state.letters));$('letters').textContent=state.letters;burst(item.g.position);tone(659,.25,.07);tone(988,.4,.055,.1);
 if(state.letters===8){toast(`八封信收齐了！第 ${state.route} 趟投递完成。`,5);state.route++;state.letters=0;setTimeout(()=>{if(state.letters===0){dots.forEach(d=>d.classList.remove('filled'));$('letters').textContent='0';}},1700);$('route-label').textContent=`海风来信 · 第 ${state.route} 趟`;tone(1319,.5,.06,.24);}else toast(`接住一封信 · ${state.letters} / 8`,1.7);
}
function reset(){Object.assign(state,{distance:0,phase:0,jump:0,velocity:0,letters:0,route:1,speed:0});held.clear();mailItems.forEach((item,i)=>{item.g.position.x=5+i*6;item.collected=false;item.g.visible=true;});dots.forEach(d=>d.classList.remove('filled'));$('letters').textContent='0';$('route-label').textContent='给海风的八封信';toast('新的海风，新的出发。');}
function daylight(){state.night=!state.night;document.body.classList.toggle('night',state.night);icon('daylight',state.night?'sun':'moon');$('daylight').setAttribute('aria-label',state.night?'切换落日':'切换月夜');$('daylight').setAttribute('aria-pressed',String(state.night));stars.visible=state.night;toast(state.night?'月亮值班，邮差继续。':'沿着落日，再骑一会儿。',2.5);}
function changeView(){state.view=(state.view+1)%3;const views=[[.28,.23],[-.35,.16],[.78,.43]];[state.angle,state.elevation]=views[state.view];toast(['海岸视角','侧面跟拍','俯瞰海岸'][state.view],1.5);}
let width=0,height=0,camAngle=state.angle,camElevation=state.elevation;
function resize(){width=innerWidth;height=innerHeight;renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();}
addEventListener('resize',resize);resize();
const canvas=$('scene');let drag=null;
canvas.addEventListener('pointerdown',e=>{if(!e.isPrimary)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);canvas.focus({preventScroll:true});});
canvas.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;state.angle=THREE.MathUtils.clamp(state.angle+(e.clientX-drag.x)*.008,-1.15,1.15);state.elevation=THREE.MathUtils.clamp(state.elevation+(e.clientY-drag.y)*.003,.06,.6);drag.x=e.clientX;drag.y=e.clientY;});
const endDrag=()=>{drag=null;};canvas.addEventListener('pointerup',endDrag);canvas.addEventListener('pointercancel',endDrag);canvas.addEventListener('lostpointercapture',endDrag);
$('pedal').addEventListener('pointerdown',e=>{if(!state.ready)return;e.preventDefault();held.add(`pointer-${e.pointerId}`);$('pedal').setPointerCapture(e.pointerId);if(state.paused){state.paused=false;updatePause();}});
for(const event of ['pointerup','pointercancel','lostpointercapture'])$('pedal').addEventListener(event,e=>held.delete(`pointer-${e.pointerId}`));
// Assistive-technology activation can also request a short acceleration burst.
$('pedal').addEventListener('click',e=>{if(e.detail===0){held.add('assistive');state.paused=false;updatePause();setTimeout(()=>held.delete('assistive'),1500);}});
$('jump').onclick=jump;$('bell').onclick=bell;$('pause').onclick=pause;$('daylight').onclick=daylight;$('sound').onclick=toggleSound;$('view').onclick=changeView;$('reset').onclick=reset;
$('help').onclick=()=>{held.clear();$('instructions').showModal();};
const actions={Space:jump,KeyB:bell,KeyP:pause,KeyN:daylight,KeyC:changeView,KeyM:toggleSound,KeyR:reset,KeyH:()=>{$('instructions').open?$('instructions').close():$('help').click();}};
addEventListener('keydown',e=>{
 if($('instructions').open){if(e.code==='KeyH')$('instructions').close();return;}
 if(e.altKey||e.ctrlKey||e.metaKey)return;
 if(e.code==='Space'&&e.target instanceof HTMLButtonElement)return;
 if(['KeyW','ArrowUp','ArrowLeft','ArrowRight',...Object.keys(actions)].includes(e.code))e.preventDefault();
 if(e.code==='KeyW'||e.code==='ArrowUp'){held.add(e.code);if(state.paused){state.paused=false;updatePause();}}
 else if(e.code==='ArrowLeft')state.angle=Math.max(-1.15,state.angle-.08);
 else if(e.code==='ArrowRight')state.angle=Math.min(1.15,state.angle+.08);
 else if(!e.repeat)actions[e.code]?.();
});
addEventListener('keyup',e=>held.delete(e.code));addEventListener('blur',()=>held.clear());
document.addEventListener('visibilitychange',()=>{held.clear();last=performance.now();});
reducedQuery.addEventListener('change',e=>{reduced=e.matches;if(reduced){state.paused=true;updatePause();}});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();state.ready=false;$('error').hidden=false;$('error').querySelector('p').textContent='图形上下文已中断，请重新加载继续骑行。';});
const daySky=new THREE.Color('#efb899'),nightSky=new THREE.Color('#254858'),daySea=new THREE.Color('#599e9a'),nightSea=new THREE.Color('#255869');
let nightMix=0,last=performance.now(),uiClock=0;
updatePause();state.ready=true;$('loading').hidden=true;toast(reduced?'已按减少动态偏好暂停，按住骑行即可出发。':'按住骑行，遇到高处的信就跳起来',7);
function frame(now){requestAnimationFrame(frame);const dt=Math.min((now-last)/1000,.04);last=now;if(document.hidden||!state.ready)return;
 const running=!state.paused&&!$('instructions').open;
 const step=running?dt:0;state.time+=step;
 const t=state.time, accelerating=held.size>0 && running;
 state.speed=THREE.MathUtils.damp(state.speed,running?(accelerating?5.8:1.15):0,accelerating?2.4:1.6,dt);
 const travel=running?state.speed*dt:0;state.distance+=travel;state.phase+=travel/.555;
 if(running){state.velocity-=13*dt;state.jump=Math.max(0,state.jump+state.velocity*dt);if(state.jump===0)state.velocity=0;}
 const bounce=reduced?0:Math.sin(state.phase*2)*.018*Math.min(state.speed,2);
 rider.position.y=state.jump+bounce;rider.rotation.z=reduced?0:Math.sin(state.phase)*.013+state.velocity*.013;
 bird.position.y=reduced?0:Math.sin(state.phase*2+.6)*.025;
 bird.rotation.z=reduced?0:-Math.min(state.speed*.008,.045);
 state.bell=Math.max(0,state.bell-dt*1.7);face.rotation.y=Math.sin(state.bell*Math.PI)*.17;face.rotation.z=state.bell*.06;
 wheels.forEach(w=>w.rotation.z=-state.phase);
 const pedalAngle=-state.phase*.53;
 legs.forEach((leg,i)=>{
   const a=pedalAngle+i*Math.PI,px=-.13+Math.cos(a)*.225,py=.72+Math.sin(a)*.225,s=leg.side;
   const foot=[px+.025,py+.07,s*.245],hip=[-.4,1.85+bird.position.y,s*.245];
   const dx=foot[0]-hip[0],dy=foot[1]-hip[1],dist=Math.hypot(dx,dy),len=.72;
   const bend=Math.sqrt(Math.max(.003,len*len-dist*dist/4));
   const knee=[(hip[0]+foot[0])/2-dy/dist*bend,(hip[1]+foot[1])/2+dx/dist*bend,s*.245];
   poseLink(leg.thigh,hip,knee,.048);poseLink(leg.shin,knee,foot,.04);leg.knee.position.set(...knee);leg.foot.position.set(...foot);
   poseLink(crankArms[i],[-.13,.72,s*.19],[px,py,s*.19],.02);pedals[i].position.set(px,py,s*.245);
 });
 wings.forEach((w,i)=>{const s=i?1:-1;w.rotation.x=-s*(state.jump*.8);w.rotation.z=-state.jump*.23+(reduced?0:Math.sin(t*2)*.02);});
 const blink=Math.sin(t*1.25)> .994?.15:1;eyes.forEach(e=>e.scale.y=.065*blink);
 const pos=scarfGeo.attributes.position;
 for(let i=0;i<pos.count;i++){const x=scarfBase[i*3],weight=(.45-x)/.9;pos.setXYZ(i,x,scarfBase[i*3+1]+(reduced?0:Math.sin(x*8+t*9)*weight*.07),scarfBase[i*3+2]+(reduced?0:Math.cos(x*6+t*8)*weight*.1));}pos.needsUpdate=true;scarfGeo.computeVertexNormals();
 moving.forEach(({obj,speed,span})=>{obj.position.x-=travel*speed;if(obj.position.x< -span/2)obj.position.x+=span;});
 waveData.forEach((w,i)=>{dummy.position.set(w.x,-.21+(reduced?0:Math.sin(t*.9+w.phase)*.025),w.z);dummy.scale.set(w.len*(1+(reduced?0:Math.sin(t+w.phase)*.14)),1,1);dummy.updateMatrix();waves.setMatrixAt(i,dummy.matrix);});waves.instanceMatrix.needsUpdate=true;
 boat.rotation.z=reduced?0:Math.sin(t*1.3)*.065;boat.position.y=-.08+(reduced?0:Math.sin(t*1.5)*.07);
 gulls.forEach(({g,ws,phase},i)=>{g.position.set(Math.sin(t*.09+phase)*14,5+i*.36+Math.sin(t*.3+phase)*.25,-9-i*2);ws.forEach((w,n)=>w.rotation.z=(n?1:-1)*(reduced?.1:Math.sin(t*3+phase)*.4));});
 mailItems.forEach(item=>{item.g.position.x-=travel;item.g.position.y=item.baseY+(reduced?0:Math.sin(t*2+item.index)*.09);item.g.rotation.y=reduced?.15:Math.sin(t*1.8+item.index)*.3;item.g.rotation.z=reduced?0:Math.sin(t*2+item.index)*.08;
 if(running&&!item.collected&&Math.abs(item.g.position.x-.1)<.55&&Math.abs(item.g.position.y-(1.6+state.jump))<.6)collect(item);
 if(item.g.position.x< -4){item.g.position.x+=36;item.collected=false;item.g.visible=true;}
 });
 particles.forEach(p=>{if(p.life<=0)return;p.life-=step;p.m.visible=p.life>0;p.m.position.addScaledVector(p.v,step);p.v.y-=step*2;p.m.rotation.x+=step*3;p.m.scale.setScalar(Math.max(0,p.life));});
 nightMix=THREE.MathUtils.damp(nightMix,state.night?1:0,2,dt);scene.background.copy(daySky).lerp(nightSky,nightMix);scene.fog.color.copy(scene.background);seaMat.color.copy(daySea).lerp(nightSea,nightMix);
 hemi.intensity=2.65-nightMix*1.55;sunLight.intensity=3.4-nightMix*2.7;rim.intensity=1.3-nightMix*.6;lighthouseGlow.intensity=nightMix*12;sun.material.color.set(state.night?'#fff3cc':'#ffe5b0');renderer.toneMappingExposure=1.23-nightMix*.12;
 camAngle=THREE.MathUtils.damp(camAngle,state.angle,6,dt);camElevation=THREE.MathUtils.damp(camElevation,state.elevation,6,dt);
 // Maintain the character's screen width across 320–430 px portrait viewports.
 const aspect=width/height;const distance=aspect<1?10.3/Math.max(aspect,.44):10.6;
 const tilt=.18+camElevation;
 camera.position.set(Math.sin(camAngle)*distance,1.4+Math.sin(tilt)*distance,Math.cos(camAngle)*Math.cos(tilt)*distance);
 camera.lookAt(.25,1.45+state.jump*(reduced?0:.14),0);
 if(uiClock> .12){$('speed').textContent=Math.round((running?state.speed:0)*3.6);$('distance').textContent=Math.floor(state.distance);$('ride-state').textContent=state.paused?'暂停片刻':accelerating?'乘风骑行':'海风巡航';$('pedal').classList.toggle('held',accelerating);uiClock=0;}uiClock+=dt;
 if(now/1000>toastUntil)$('toast').classList.remove('visible');
 renderer.render(scene,camera);
}
requestAnimationFrame(frame);
}
