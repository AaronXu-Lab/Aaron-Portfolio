import * as T from './vendor/three.module.min.js';
import {group,solid,paint,printTexture,label} from './sculpt.js';

export const lapLength=250;
const straight=52,radius=(lapLength-straight*2)/(2*Math.PI),bend=Math.PI*radius;
const segments=360,tau=Math.PI*2;
export function course(m) {
  let d=((m%lapLength)+lapLength)%lapLength,x,z,yaw;
  if(d<straight){x=d-straight/2;z=-radius;yaw=0;}
  else if((d-=straight)<bend){yaw=-d/radius;x=straight/2-radius*Math.sin(yaw);z=-radius*Math.cos(yaw);}
  else if((d-=bend)<straight){x=straight/2-d;z=radius;yaw=-Math.PI;}
  else {d-=straight;yaw=-Math.PI-d/radius;x=-straight/2-radius*Math.sin(yaw);z=-radius*Math.cos(yaw);}
  return {x,z,yaw,bank:.13+.145*Math.abs(Math.sin(yaw))};
}
function surface(d,lane,height=0){
  const {x,z,yaw,bank}=course(d);
  return [x-lane*Math.sin(yaw),lane*Math.tan(bank)+height,z-lane*Math.cos(yaw)];
}
function ribbon(parent,inner,outer,h,color,repeat=1) {
  const pos=[],uv=[],idx=[];
  for(let i=0;i<=segments;i++) {
    const d=lapLength*i/segments;
    pos.push(...surface(d,inner,h),...surface(d,outer,h));uv.push(i/segments*repeat,0,i/segments*repeat,1);
    const t=i*2;if(i<segments)idx.push(t,t+2,t+1,t+1,t+2,t+3);
  }
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();return solid(parent,geo,color);
}
function boardArt(bg,fg,words,sub) {
  return printTexture(1024,128,(c,w,h)=>{
    c.fillStyle=bg;c.fillRect(0,0,w,h);c.fillStyle=fg;c.textAlign='center';c.textBaseline='middle';
    c.font='italic bold 70px Georgia';c.fillText(words,w*.48,h*.52,w*.76);
    c.save();c.translate(w*.91,h*.5);c.strokeStyle=fg;c.lineWidth=4;
    for(let i=0;i<2;i++){c.beginPath();c.ellipse(0,0,35-i*9,19-i*7,-.25,0,tau);c.stroke();}c.restore();
    c.fillRect(22,24,4,80);c.font='bold 12px monospace';c.textAlign='left';c.fillText(sub,40,24);
  });
}
export function stadium(scene) {
  let seed=46367;
  function random(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
  const map=printTexture(1024,512,(c,w,h)=>{
    c.fillStyle='#dfa86d';c.fillRect(0,0,w,h);
    for(let i=0;i<40;i++){
      const y=i*h/40,b=h/40;
      c.fillStyle='rgba('+ (random()>.5?'255,239,182':'124,73,41') +','+(.035+random()*.13)+')';c.fillRect(0,y,w,b);
      c.fillStyle='#9d6b484e';c.fillRect(0,y,w,1.25);
      const seam=random()*w;c.fillRect(seam,y,1.7,b);
      for(let j=0;j<12;j++){
        const x=random()*w,yy=y+1+random()*(b-2);
        c.fillStyle=random()>.5?'#fff0bf32':'#955a3624';c.fillRect(x,yy,4+random()*115,.6+random()*.55);
      }
    }
  });
  map.wrapS=T.RepeatWrapping;map.anisotropy=8;
  const timber=new T.MeshStandardMaterial({map,roughness:.87});
  ribbon(scene,-2.6,3.65,0,timber,42);
  ribbon(scene,-3.18,-2.6,-.005,'#71a6a1');ribbon(scene,-9,-3.18,-.01,'#438676');
  for(const [lane,color] of [[-2.43,'#f9dfad'],[-1.53,'#384440'],[-.59,'#ca503d'],[1.53,'#4d808a'],[3.45,'#efe0ba']])ribbon(scene,lane,lane+.05,.009,color);
  const batches=new Map(),dummy=new T.Object3D(),geom={box:new T.BoxGeometry(),stone:new T.DodecahedronGeometry(1,0),cone:new T.ConeGeometry(1,1,10),pole:new T.CylinderGeometry(1,1,1,10),globe:new T.SphereGeometry(1,12,9)};
  function instance(kind,col,x,y,z,sx,sy,sz,ry=0,rz=0){
    const key=kind+col;if(!batches.has(key))batches.set(key,{kind,col,matrices:[]});
    dummy.position.set(x,y,z);dummy.rotation.set(0,ry,rz,'YXZ');dummy.scale.set(sx,sy,sz);dummy.updateMatrix();batches.get(key).matrices.push(dummy.matrix.clone());
  }
  function place(d,lane,height,w,h,deep,color,kind='box'){
    const [x,y,z]=surface(d,lane,height);instance(kind,color,x,y,z,w,h,deep,course(d).yaw);
  }
  // Poured concrete barriers and wooden terrace seating follow the banking.
  const banners=[
    boardArt('#e8e4cb','#234e40','Vélo Club Pélican','VCP'),
    boardArt('#205746','#f3e7ba','PISTE MUNICIPALE','250 M'),
    boardArt('#dc6847','#fff0cf','Cycles Aurore','07'),
  ];
  for(let i=0;i<80;i++) {
    const d=i*lapLength/80,{yaw}=course(d),factor=1+3.8/radius*Math.abs(Math.sin(yaw));
    place(d,3.78,.39,3.22*factor,.8,.23,'#f1e7cf');
    place(d,3.78,.81,3.24*factor,.07,.28,'#648275');
    if(i%2===0) {
      const [x,y,z]=surface(d,3.64,.43);
      const sign=label(scene,banners[(i/2)%3],x,y,z,4.6,.58);
      sign.rotation.y=yaw;
    }
    for(let row=0;row<4;row++){
      const l=4.55+row*.82,hh=.52+row*.24;
      place(d,l,hh-.23,3.32*(1+l/radius*Math.abs(Math.sin(yaw))),.53,.9,'#b4ba9e');
      for(let j=-2;j<=2;j++) {
        if((i*5+j+2)%21<2)continue;
        const dd=d+j*.595;
        const col=(Math.floor(i/4)+row)%6<2?'#e19a64':row%2?'#629989':'#8daf91';
        place(dd,l,hh+.09,.48,.11,.46,col);
        place(dd,l+.20,hh+.26,.48,.34,.09,col);
        // Small groups of club supporters gather near the stands' central aisles.
        if(i%5<2 && random()<.23){
          const shirt=['#e7ba60','#d57553','#e7dbaf','#4f8277'][Math.floor(random()*4)];
          place(dd,l,hh+.38,.147,.22,.12,shirt,'globe');
          place(dd,l-.045,hh+.66,.135,.14,.13,'#fff3d7','globe');
          place(dd,l-.205,hh+.635,.087,.049,.143,'#dca252','globe');
          for(const side of [-1,1])place(dd+side*.111,l-.093,hh+.689,.019,.022,.021,'#354a40','globe');
        }
      }
    }
  }
  // Painted finish grid spans the riding surface.
  for(let j=0;j<22;j++){
    const l=-2.52+j*.275;
    for(let i=0;i<2;i++)place(11+i*.22,l,.014,.22,.015,.277,(j+i)%2?'#3c4b3f':'#f7f1d9');
  }
  const lawn=solid(scene,new T.PlaneGeometry(380,380),'#78a48a',0,-1.95,0);lawn.rotation.x=-Math.PI/2;
  for(let i=0;i<144;i++){
    const d=random()*250,l=10+random()*6,[x,,z]=surface(d,l);
    const h=3+random()*4.2;
    instance('pole','#826f51',x,h*.27,z,.16,h*.85,.16);
    if(i%4===0)instance('stone','#739371',x,h*.82,z,2.5,1.9,2.3,i);
    else {instance('stone',i%3?'#54836c':'#769772',x,h*.72,z,.8,h*.48,.82,i);instance('cone','#699177',x,h*1.04,z,.65,h*.34,.65,i);}
  }
  // Club pavilions with striped canvas awnings and an observation box.
  for(let i=0;i<8;i++){
    const d=13+i*31.25,{yaw}=course(d),[cx,,cz]=surface(d,10);
    const p=(xx,yy,zz,sx,sy,sz,col)=>instance('box',col,cx+Math.cos(yaw)*xx+Math.sin(yaw)*zz,yy,cz-Math.sin(yaw)*xx+Math.cos(yaw)*zz,sx,sy,sz,yaw);
    p(0,2.5,0,9,4.8,2.8,'#e0d8b6');p(0,5.45,0,9.4,.22,3.15,'#235a4d');
    for(let j=-3;j<=3;j++){p(j*1.17,4.46,1.42,.98,1.37,.07,'#56857d');}
    for(let j=0;j<13;j++)p((j-6)*.75,3.74,1.95,.75,.17,1.25,j%2?'#d77354':'#f0e7c4');
  }
  for(let i=0;i<25;i++) {
    const d=i*10,[x,y,z]=surface(d,8.3);
    instance('pole','#758b77',x,y+3.15,z,.055,6.3,.055);
    const yaw=course(d).yaw;
    instance('box',i%3?'#db7858':'#e9c173',x+.5*Math.cos(yaw),y+5.98,z-.5*Math.sin(yaw),1.02,.54,.04,yaw,-.1);
  }
  for(let i=0;i<36;i++){
    const a=i*tau/36,rad=90+random()*12;
    instance('stone',i%2?'#a9b8a0':'#91ac98',Math.cos(a)*rad,-2,Math.sin(a)*rad,14+random()*10,5+random()*8,16,a);
  }
  for(const {kind,col,matrices} of batches.values()){
    const mesh=new T.InstancedMesh(geom[kind],paint(col),matrices.length);
    matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));scene.add(mesh);
  }
  // A softly graduated contact shadow stays locked to the tyres.
  const shadowMap=printTexture(128,64,(c,w,h)=>{
    c.scale(w/2,h/2);const g=c.createRadialGradient(1,1,.05,1,1,1);
    g.addColorStop(0,'rgba(33,39,24,.44)');g.addColorStop(.55,'rgba(49,49,28,.24)');g.addColorStop(1,'rgba(50,40,20,0)');c.fillStyle=g;c.fillRect(0,0,2,2);
  });
  return shadowMap;
}
