import * as T from './vendor/three.module.min.js';
import {cyclist} from './cyclist.js';
import {stadium,course,lapLength} from './velodrome.js';
import {group,label} from './sculpt.js';

const el=id=>document.getElementById(id);
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const canvas=el('track'),stage=canvas.parentElement;
const scene=new T.Scene();
scene.background=new T.Color('#dce8dd');scene.fog=new T.FogExp2('#e4e5cc',.02);
const sky=new T.Mesh(new T.SphereGeometry(130,32,20),new T.ShaderMaterial({
  side:T.BackSide,depthWrite:false,
  uniforms:{horizon:{value:new T.Color('#f5ecd2')},zenith:{value:new T.Color('#8fc5cb')}},
  vertexShader:'varying float altitude; void main(){altitude=normalize(position).y; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
  fragmentShader:`uniform vec3 horizon,zenith; varying float altitude;
    void main(){gl_FragColor=vec4(mix(horizon,zenith,smoothstep(-.02,.46,altitude)),1.);
    #include <colorspace_fragment>
    }`
}));scene.add(sky);
let renderer;
try {renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});}
catch(error){el('notice').textContent='场景需要 WebGL 2，请开启浏览器硬件加速后重试。';throw error;}
renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;
const camera=new T.PerspectiveCamera(34,1,.08,200);
scene.add(new T.HemisphereLight('#fff8e1','#ccb897',1.83));
const sun=new T.DirectionalLight('#fff1d4',2.28);scene.add(sun,sun.target);
sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);
Object.assign(sun.shadow.camera,{left:-3.7,right:3.7,top:3.7,bottom:-3.7,near:.1,far:25});
sun.shadow.intensity=.63;sun.shadow.normalBias=.008;sun.shadow.bias=-.00018;
const shadowMap=stadium(scene);
scene.children.filter(m=>m.isMesh && !m.isInstancedMesh && !m.material.transparent).forEach(m=>m.receiveShadow=true);
const vehicle=group(scene),bank=group(vehicle),bird=group(bank);
const pose=cyclist(bird);
bird.traverse(m=>{if(m.isMesh){m.castShadow=!m.material.transparent;m.receiveShadow=true;}});
const contact=label(bank,shadowMap,0,.013,0,2.5,.86);contact.rotation.x=-Math.PI/2;

const prefix='gpt-6-pelican-run-03:';
let best=Infinity;
try{const saved=Number(localStorage.getItem(prefix+'best'));if(saved>0)best=saved;}catch{}
function clock(seconds){return String(Math.floor(seconds/60)).padStart(2,'0')+':'+(seconds%60).toFixed(1).padStart(4,'0');}
if(Number.isFinite(best))el('best').textContent=clock(best);
let distance=0,elapsed=0,laps=1,speed=28,cadence=78,wheel=0,crank=0,time=0;
let paused=reduced.matches,held=false,view=0,muted=true,ctx=null,noticeUntil=0;
const views=['场边跟拍','领骑镜头','高位看台'];
const angles=[.38,1.04,-.48],elevations=[.165,.12,.55];
let azimuth=angles[0],elevation=elevations[0];
const target=new T.Vector3(),look=new T.Vector3(),offset=new T.Vector3();
let width=1,height=1;
function measure(){width=stage.clientWidth;height=stage.clientHeight;if(!width||!height)return;camera.aspect=width/height;camera.updateProjectionMatrix();renderer.setSize(width,height,false);}
new ResizeObserver(measure).observe(stage);measure();

function notice(text,ms=1700){el('notice').textContent=text;noticeUntil=performance.now()+ms;}
let energy=1,recovering=false;
function setHeld(active){held=active&&!paused&&!recovering;el('sprint').classList.toggle('held',held);}
function syncPause(){
  el('pause').setAttribute('aria-pressed',String(paused));el('pause').setAttribute('aria-label',(paused?'继续':'暂停')+'（P）');
  el('sprint').disabled=paused;
  if(paused)notice('已暂停 · 点按播放继续',Infinity);
  else {el('notice').textContent='';noticeUntil=0;}
}
function togglePause(){paused=!paused;setHeld(false);syncPause();}
function selectView(){view=(view+1)%views.length;notice(views[view]);}
function chime(pitch=.7){
  if(muted||!ctx||ctx.state!=='running')return;
  const now=ctx.currentTime,osc=ctx.createOscillator(),gain=ctx.createGain();
  osc.type='sine';osc.frequency.setValueAtTime(980*pitch,now);gain.gain.setValueAtTime(.035,now);
  gain.gain.exponentialRampToValueAtTime(.0001,now+.17);osc.connect(gain).connect(ctx.destination);osc.start(now);osc.stop(now+.18);
}
async function toggleSound(){
  if(muted){try{ctx??=new AudioContext();await ctx.resume();}catch{notice('当前浏览器无法播放声音');return;}}
  muted=!muted;el('sound').setAttribute('aria-pressed',String(!muted));el('sound').setAttribute('aria-label',(muted?'开启':'关闭')+'场地声音（M）');chime(1.25);
}
el('sprint').addEventListener('pointerdown',e=>{if(e.button!==0)return;e.currentTarget.setPointerCapture(e.pointerId);setHeld(true);});
for(const type of ['pointerup','pointercancel','lostpointercapture'])el('sprint').addEventListener(type,()=>setHeld(false));
el('sprint').addEventListener('contextmenu',e=>e.preventDefault());
el('camera').onclick=selectView;el('pause').onclick=togglePause;el('sound').onclick=toggleSound;
window.addEventListener('keydown',e=>{
  if(e.ctrlKey||e.metaKey||e.altKey)return;
  if(e.code==='Space'&&e.target.closest('button')&&e.target!==el('sprint'))return;
  if(!['Space','KeyC','KeyP','KeyM'].includes(e.code))return;
  e.preventDefault();if(e.repeat)return;
  if(e.code==='Space')setHeld(true);
  if(e.code==='KeyC')selectView();
  if(e.code==='KeyP')togglePause();
  if(e.code==='KeyM')toggleSound();
});
window.addEventListener('keyup',e=>{if(e.code==='Space')setHeld(false);});
window.addEventListener('blur',()=>setHeld(false));
document.addEventListener('visibilitychange',()=>{setHeld(false);previous=0;});
reduced.addEventListener('change',()=>{if(reduced.matches){paused=true;setHeld(false);syncPause();}});
function finishLap(){
  if(elapsed<best){best=elapsed;el('best').textContent=clock(best);try{localStorage.setItem(prefix+'best',String(best));}catch{} notice('最快圈速 · '+clock(best),3000);}
  else notice('完成第 '+laps+' 圈 · '+clock(elapsed),2600);
  chime(1.6);laps++;el('lap').textContent=String(laps).padStart(2,'0');
}
let previous=0,lastTick=0,lastBeat=0;
const progress=stage.querySelector('.progress'),fill=progress.firstElementChild;
function frame(stamp) {
  const dt=previous?Math.min(.08,(stamp-previous)/1000):0;previous=stamp;
  if(!paused){
    time+=dt;
    if(held){
      energy=Math.max(0,energy-dt/7);
      if(energy===0){setHeld(false);recovering=true;notice('体力耗尽 · 巡航恢复');}
    } else {
      energy=Math.min(1,energy+dt/10);
      if(energy>=.25)recovering=false;
    }
    const goal=held?49:28;
    speed+= (goal-speed)*(1-Math.exp(-dt*(held?1.55:1.05)));
    cadence=78+(speed-28)*1.85;
    const travel=speed/3.6*dt;
    wheel+=travel/.49;crank+=cadence*Math.PI/30*dt;
    if(distance+travel>=lapLength){
      const split=(lapLength-distance)/travel;
      elapsed+=dt*split;finishLap();elapsed=dt*(1-split);distance+=travel-lapLength;
    }else{elapsed+=dt;distance+=travel;}
    const beat=Math.floor(crank/Math.PI);
    if(beat!==lastBeat){lastBeat=beat;chime(.14+(.014*(beat%2)));}
  }
  const track=course(distance+11);
  vehicle.position.set(track.x,0,track.z);vehicle.rotation.y=track.yaw;
  bank.rotation.x=track.bank;
  const curvature=Math.abs(Math.sin(track.yaw));
  pose(crank,wheel,time,(speed-28)/21,-curvature*.10);
  const lerp=reduced.matches?1:1-Math.exp(-dt*5);
  azimuth+=(angles[view]-azimuth)*lerp;elevation+=(elevations[view]-elevation)*lerp;
  const span=Math.max(4.45,3.95/camera.aspect);
  const range=span/(2*Math.tan(T.MathUtils.degToRad(camera.fov/2)));
  look.set(.14,1.41,0).applyQuaternion(vehicle.quaternion).add(vehicle.position);
  offset.set(Math.sin(azimuth)*Math.cos(elevation),Math.sin(elevation),Math.cos(azimuth)*Math.cos(elevation)).multiplyScalar(range);
  camera.position.copy(offset.applyQuaternion(vehicle.quaternion)).add(look);camera.lookAt(look);
  sky.position.copy(camera.position);target.copy(vehicle.position);target.y+=.8;sun.target.position.copy(target);sun.position.copy(target).add(new T.Vector3(-4,8,4));
  if(stamp-lastTick>65||!lastTick){
    el('clock').textContent=clock(elapsed);el('speed').textContent=String(Math.round(paused?0:speed));el('rpm').textContent=String(Math.round(paused?0:cadence));
    el('sprint').style.setProperty('--charge',String(energy));
    el('sprint').querySelector('span').textContent=recovering?'恢复体力':held?'冲刺中':'按住冲刺';
    fill.style.transform='scaleX('+distance/lapLength+')';progress.setAttribute('aria-valuenow',String(Math.floor(distance)));lastTick=stamp;
  }
  if(noticeUntil && stamp>noticeUntil){el('notice').textContent=paused?'已暂停 · 点按播放继续':'';noticeUntil=0;}
  renderer.render(scene,camera);
}
syncPause();renderer.setAnimationLoop(frame);
