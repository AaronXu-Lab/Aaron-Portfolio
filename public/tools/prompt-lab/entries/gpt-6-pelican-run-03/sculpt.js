import * as T from './vendor/three.module.min.js';

const sphere = new T.SphereGeometry(1, 28, 20);
const cylinder = new T.CylinderGeometry(1,1,1,14);
const cube = new T.BoxGeometry();
const up = new T.Vector3(0,1,0);
const materials = new Map();
export function paint(color) {
  if (!materials.has(color)) materials.set(color,new T.MeshStandardMaterial({color,roughness:.75}));
  return materials.get(color);
}
export function group(parent) { const g=new T.Group(); parent.add(g); return g; }
export function solid(parent,geometry,color,x=0,y=0,z=0) {
  const m=new T.Mesh(geometry,typeof color==='string'?paint(color):color);
  m.position.set(x,y,z); parent.add(m); return m;
}
export function egg(parent,color,x,y,z,a,b,c,roll=0) {
  const m=solid(parent,sphere,color,x,y,z); m.scale.set(a,b,c); m.rotation.z=roll; return m;
}
export function box(parent,color,x,y,z,a,b,c) {
  const m=solid(parent,cube,color,x,y,z); m.scale.set(a,b,c);return m;
}
export function fitRod(m,a,b,r) {
  const v=new T.Vector3().subVectors(b,a);
  m.position.copy(a).addScaledVector(v,.5);m.scale.set(r,v.length(),r);
  m.quaternion.setFromUnitVectors(up,v.normalize());
}
export function rod(parent,color,a,b,r) {
  const m=solid(parent,cylinder,color);fitRod(m,new T.Vector3(...a),new T.Vector3(...b),r);return m;
}
export function pipe(parent,color,points,r) {
  const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));
  return solid(parent,new T.TubeGeometry(curve,24,r,10,false),color);
}
// Cross sections run from tail to tip. Curve the centre line as well as the two radii.
export function carve(parent,color,sections) {
  const sectionsCurve=new T.CatmullRomCurve3(sections.map(([x,y,z])=>new T.Vector3(x,y,z)),false,'catmullrom',.35);
  const radii=new T.CatmullRomCurve3(sections.map(p=>new T.Vector3(p[3],p[4],0)),false,'catmullrom',.35);
  const positions=[],indices=[],n=sections.length*4,k=24;
  for(let i=0;i<=n;i++) {
    const p=sectionsCurve.getPoint(i/n),r=radii.getPoint(i/n);
    for(let j=0;j<k;j++) {
      const a=j/k*Math.PI*2;
      positions.push(p.x,p.y+Math.cos(a)*Math.max(.001,r.x),p.z+Math.sin(a)*Math.max(.001,r.y));
      if(i<n){const a=i*k+j,b=i*k+(j+1)%k;indices.push(a,b,a+k,b,b+k,a+k);}
    }
  }
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();return solid(parent,geo,color);
}
export function hoop(parent,color,x,y,z,r,thick) {
  return solid(parent,new T.TorusGeometry(r,thick,10,64),color,x,y,z);
}
export function printTexture(width,height,draw) {
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  draw(canvas.getContext('2d'),width,height);const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.anisotropy=4;return map;
}
export function label(parent,map,x,y,z,w,h) {
  const mat=new T.MeshBasicMaterial({map,transparent:true,depthWrite:false,side:T.DoubleSide});
  return solid(parent,new T.PlaneGeometry(w,h),mat,x,y,z);
}

// Fixed pieces of a moving assembly share one draw call and keep their individual paint.
export function bakePaintedParts(parent) {
  const parts=parent.children.filter(m=>m.isMesh && m.material.isMeshStandardMaterial && !m.material.map);
  if(parts.length<2)return;
  const positions=[],normals=[],colors=[],indices=[];
  const v=new T.Vector3(),normalMatrix=new T.Matrix3();
  for(const part of parts){
    part.updateMatrix();normalMatrix.getNormalMatrix(part.matrix);
    const {position,normal}=part.geometry.attributes,index=part.geometry.index,base=positions.length/3;
    for(let i=0;i<position.count;i++){
      v.fromBufferAttribute(position,i).applyMatrix4(part.matrix);positions.push(v.x,v.y,v.z);
      v.fromBufferAttribute(normal,i).applyMatrix3(normalMatrix).normalize();normals.push(v.x,v.y,v.z);
      const c=part.material.color;colors.push(c.r,c.g,c.b);
    }
    const count=index?index.count:position.count;
    for(let i=0;i<count;i++)indices.push(base+(index?index.getX(i):i));
    parent.remove(part);
  }
  const g=new T.BufferGeometry();
  for(const [key,values] of [['position',positions],['normal',normals],['color',colors]])g.setAttribute(key,new T.Float32BufferAttribute(values,3));
  g.setIndex(indices);solid(parent,g,new T.MeshStandardMaterial({vertexColors:true,roughness:.74}));
}
