import { T, TAU, bar, batch, box, group, line, mesh, oval, paint, rng, vec } from './geometry.js';

export const stops = [
  { at: .24, name: '灯塔湾' },
  { at: .55, name: '松风坡' },
  { at: .87, name: '白浪港' },
];

const random = rng(117199);
const SAMPLES = 240;
const route = new T.CatmullRomCurve3([
  vec(-5.15, 0, 7.35), vec(2.5, 0, 8.02), vec(8.48, 0, 5.97), vec(11.45, 0, 1.57),
  vec(9.63, 0, -4.85), vec(3.45, 0, -7.6), vec(-4.95, 0, -7.07), vec(-10.29, 0, -3.83),
  vec(-11.35, 0, 1.18), vec(-9.58, 0, 5.16),
], true);
route.arcLengthDivisions = 1200;
const length = route.getLength();
const nodes = Array.from({ length: SAMPLES }, (_, i) => route.getPointAt(i / SAMPLES));
const normals = Array.from({ length: SAMPLES }, (_, i) => {
  const tangent = route.getTangentAt(i / SAMPLES);
  return vec(-tangent.z, 0, tangent.x).normalize();
});
const roadHalf = 1.30;

const grass = ['#8da15d', '#91a460', '#94a761', '#8ea35e', '#97a764', '#9caa68', '#8ba05a'];
const cliff = ['#c7a67e', '#bc946f', '#a77e60', '#cfac84', '#a2856b', '#bc9c77', '#ae8f6f'];
const capStone = paint('#e1cba7');
const rocks = ['#d9bf9b', '#baa88a', '#c2ad8f', '#c9aa85'].map(color => paint(color, { flatShading: true }));
const brown = paint('#745e44');
const plaster = paint('#fff0ce');
const cream = paint('#e7ce9d');
const red = paint('#cb6046');
const redDark = paint('#a34737');
const dark = paint('#243c34');
const timber = paint('#806853');
const driftwood = paint('#b08f68');
const teal = paint('#36867a');
const glass = paint('#f9d68d', { emissive: '#cc713b', emissiveIntensity: .19, roughness: .34 });
const pebbles = new T.IcosahedronGeometry(1, 0);
const tufts = [paint('#63793f'), paint('#718946'), paint('#829750')];
const blossom = [paint('#f5dd85'), paint('#eee7bc'), paint('#b694af'), paint('#e88a63')];
const pineColors = [paint('#3f7254'), paint('#55845e'), paint('#689467'), paint('#4d7b59')];

function bank(index, width = 2.95) {
  index = (index + SAMPLES) % SAMPLES;
  const u = index / SAMPLES * TAU;
  const ripple = Math.sin(u * 7 + .8) * .26 + Math.cos(u * 11) * .11 + Math.sin(u * 3) * .4;
  return nodes[index].clone().addScaledVector(normals[index], width + ripple);
}

function surface(parent, rings, getTone, double = false) {
  const pos = [];
  const color = [];
  const shade = new T.Color();
  for (let r = 0; r < rings.length - 1; r++) {
    for (let i = 0; i < SAMPLES; i++) {
      const j = (i + 1) % SAMPLES;
      const a = rings[r](i), b = rings[r](j), c = rings[r + 1](i), d = rings[r + 1](j);
      for (const triangle of [[a, c, b], [c, d, b]]) {
        shade.set(getTone(r, i)).multiplyScalar(.975 + random() * .055);
        for (const v of triangle) {
          pos.push(v.x, v.y, v.z);
          color.push(shade.r, shade.g, shade.b);
        }
      }
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  geometry.setAttribute('color', new T.Float32BufferAttribute(color, 3));
  geometry.computeVertexNormals();
  const ground = mesh(parent, geometry, paint('#ffffff', { vertexColors: true, side: double ? T.DoubleSide : T.FrontSide }));
  ground.receiveShadow = true;
  return ground;
}

const terra = (factor, elevation) => i => bank(i).multiplyScalar(factor).setY(elevation);
function makeLand(scene, detail) {
  surface(scene, [
    terra(0, .29), terra(.27, .29), terra(.45, .17), terra(.56, .051),
    terra(.65, -.012), terra(.73, -.057), terra(.9, -.07), terra(1, -.105),
  ], (r, i) => r < 2 ? grass[2] : grass[(Math.floor(i / (5 + r % 3)) + r * 4) % grass.length], true);

  surface(scene, [
    i => bank(i).setY(-.105),
    i => bank(i, 3.12).setY(-.37 + Math.cos(i * .47) * .095),
    i => bank(i, 3.06).setY(-.78 + Math.sin(i * .53) * .125),
    i => bank(i, 3.54).setY(-1.6),
  ], (r, i) => cliff[(Math.floor(i / 4) + r * 2) % cliff.length], true);

  surface(scene, [
    i => nodes[i].clone().addScaledVector(normals[i], -roadHalf - .28).setY(-.030),
    i => nodes[i].clone().addScaledVector(normals[i], -roadHalf).setY(0),
    i => nodes[i].clone().addScaledVector(normals[i], -.75).setY(.012),
    i => nodes[i].clone().addScaledVector(normals[i], .35).setY(.014),
    i => nodes[i].clone().addScaledVector(normals[i], roadHalf).setY(0),
    i => nodes[i].clone().addScaledVector(normals[i], roadHalf + .28).setY(-.035),
  ], (r, i) => {
    const subtle = ['#e2bd85', '#e5be89', '#e6c08b', '#e4bf87'];
    return r === 0 || r === 4 ? '#c6b17c' : subtle[(Math.floor(i / 2) + r * 2) % subtle.length];
  }, true);

  for (let i = 0; i < SAMPLES; i += 2) {
    for (const side of [-1, 1]) {
      if (random() < .12) continue;
      const p = nodes[i].clone().addScaledVector(normals[i], side * (1.28 + random() * .15));
      const stone = mesh(detail, pebbles, rocks[i % rocks.length], p.x, .003, p.z);
      stone.scale.set(.138 + random() * .16, .044 + random() * .044, .105 + random() * .09);
      stone.rotation.y = random() * TAU;
    }
  }

  for (let i = 0; i < 540; i++) {
    const index = Math.floor(random() * SAMPLES);
    const spread = random() * 2.4 - 1.2;
    const p = nodes[index].clone().addScaledVector(normals[index], spread);
    const speck = box(detail, i % 4 ? cream : capStone, p.x, .017, p.z, .025 + random() * .047, .004, .016 + random() * .023);
    speck.rotation.y = random() * TAU;
  }

  for (let i = 0; i < 96; i++) {
    const index = Math.floor(random() * SAMPLES);
    const p = bank(index, 2.84 + random() * 1.2);
    const stone = mesh(detail, pebbles, rocks[i % rocks.length], p.x, -.75 - random() * .35, p.z);
    const size = .15 + random() * .52;
    stone.scale.set(size * 1.2, size, size * .88);
    stone.rotation.set(random(), random() * TAU, random());
  }
}

function ocean(scene) {
  const uniforms = {
    time: { value: 0 },
    deep: { value: new T.Color('#529f9c') },
    blue: { value: new T.Color('#488e98') },
    shore: { value: new T.Color('#76c4aa') },
    horizon: { value: new T.Color('#c7e4c3') },
    cream: { value: new T.Color('#d6eed3') },
  };
  const material = new T.ShaderMaterial({
    uniforms,
    vertexShader: `
      varying vec3 pos;
      void main() { pos=(modelMatrix*vec4(position,1.)).xyz; gl_Position=projectionMatrix*viewMatrix*vec4(pos,1.); }
    `,
    fragmentShader: `
      uniform float time;
      uniform vec3 deep, blue, shore, horizon, cream;
      varying vec3 pos;
      float hash(vec2 p) { return fract(sin(dot(p,vec2(121.31, 43.53)))*43758.54); }
      void main() {
        vec2 p=pos.xz;
        float radius=length(p/vec2(14.,11.));
        float cloud=sin(p.x*.29+p.y*.17)+sin(p.y*.42-p.x*.09)+sin(p.y*.72+p.x*.41)*.26;
        vec3 color=mix(blue,deep,smoothstep(-2.,2.,cloud));
        color=mix(color,deep,smoothstep(.09,.66,sin(p.x*.09+p.y*.13))*.42);
        color=mix(color,shore,1.-smoothstep(.9,1.59,radius+cloud*.035));
        vec2 q=vec2(p.x*.52,p.y*1.85);
        float noise=hash(floor(q));
        q.x+=noise*.83;
        float wave=abs(fract(q.y+sin(q.x*3.+time*.95)*.17+time*.17)-.5);
        float stem=abs(fract(q.x)-.5);
        float strokes=(1.-smoothstep(.018,.067,wave))*(1.-smoothstep(.04,.47,stem))*smoothstep(.36,.88,noise);
        color=mix(color,cream,strokes*.58);
        float distanceToEye=length(cameraPosition-pos);
        float haze=max(0.,distanceToEye-30.);
        color=mix(color,horizon,1.-exp(-.00054*haze*haze));
        gl_FragColor=vec4(color,1.);
        #include <colorspace_fragment>
      }
    `,
  });
  const water = mesh(scene, new T.PlaneGeometry(750, 750), material, 0, -1.29, 0);
  water.rotation.x = -Math.PI / 2;

  const foam = [];
  for (let i = 0; i < 75; i++) {
    const start = Math.floor(i / 75 * SAMPLES + random() * 2);
    const buffer = new Float32Array(8 * 3);
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.BufferAttribute(buffer, 3));
    const material = new T.LineBasicMaterial({ color: '#d7f0da', transparent: true, opacity: 0 });
    const ribbon = new T.Line(geometry, material);
    ribbon.frustumCulled = false;
    const vertices = Array.from({ length: 8 }, (_, v) => bank(start + v, 3.75 + (i % 3) * .3).setY(-1.272));
    scene.add(ribbon);
    foam.push({ ribbon, vertices, phase: random() * TAU });
  }
  return (time, reduced) => {
    uniforms.time.value = reduced ? 0 : time;
    for (const { ribbon, vertices, phase } of foam) {
      const a = reduced ? .3 : Math.sin(time * .9 + phase);
      const attr = ribbon.geometry.attributes.position;
      for (let j = 0; j < vertices.length; j++) {
        const v = vertices[j];
        const stretch = 1.008 + a * .013 + Math.sin(j * .49 + phase) * .003;
        attr.setXYZ(j, v.x * stretch, v.y, v.z * stretch);
      }
      attr.needsUpdate = true;
      ribbon.material.opacity = .32 + a * .22;
    }
  };
}

function cylinder(parent, material, x, y, z, top, bottom, height, sides = 24) {
  return mesh(parent, new T.CylinderGeometry(top, bottom, height, sides), material, x, y, z);
}

function lighthouse(detail) {
  const base = group(detail, -4.00, .21, 1.17);
  base.scale.setScalar(.85);
  cylinder(base, capStone, 0, .09, 0, 1.38, 1.49, .21);
  cylinder(base, plaster, 0, .27, 0, .97, 1.01, .23);
  const stripeY = [.37, .94, 1.50, 2.07, 2.63, 3.19, 3.76, 4.22];
  for (let i = 0; i < stripeY.length - 1; i++) {
    const bottom = stripeY[i];
    const top = stripeY[i + 1];
    cylinder(base, i % 3 === 1 ? red : plaster, 0, (top + bottom) / 2, 0,
      .92 - top * .097, .92 - bottom * .097, top - bottom + .005, 36);
  }
  cylinder(base, redDark, 0, 4.24, 0, .75, .62, .19, 36);
  cylinder(base, plaster, 0, 4.36, 0, .83, .83, .085, 36);
  cylinder(base, dark, 0, 4.43, 0, .535, .54, .11);
  cylinder(base, glass, 0, 4.77, 0, .441, .495, .59, 12);
  for (let i = 0; i < 12; i++) {
    const angle = i / 12 * TAU;
    bar(base, dark, vec(Math.cos(angle) * .50, 4.44, Math.sin(angle) * .50),
      vec(Math.cos(angle) * .46, 5.07, Math.sin(angle) * .46), .023);
    const x = Math.cos(angle) * .78, z = Math.sin(angle) * .78;
    bar(base, dark, vec(x, 4.39, z), vec(x, 4.75, z), .017);
  }
  const rail = mesh(base, new T.TorusGeometry(.78, .02, 7, 48), dark, 0, 4.75);
  rail.rotation.x = Math.PI / 2;
  cylinder(base, redDark, 0, 5.086, 0, .61, .61, .089);
  cylinder(base, red, 0, 5.34, 0, .057, .61, .48, 24);
  oval(base, capStone, 0, 5.61, 0, .095, .085, .095);
  box(base, dark, 0, .71, .882, .36, .57, .062);
  oval(base, dark, 0, .994, .88, .18, .18, .049);
  box(base, teal, 0, .71, .922, .264, .42, .035);
  oval(base, cream, .082, .76, .946, .022, .025, .009);
  for (const [height, angle] of [[1.53, -.41], [2.51, .53], [3.61, -.63]]) {
    const radius = .93 - height * .097;
    const sash = group(base, Math.sin(angle) * radius, height, Math.cos(angle) * radius);
    sash.rotation.y = angle;
    box(sash, capStone, 0, 0, 0, .218, .32, .065);
    box(sash, dark, 0, .014, .041, .145, .228, .016);
    box(sash, glass, .01, .035, .05, .095, .15, .009);
  }
}

function cottage(detail, x, z, angle, roof, size) {
  const house = group(detail, x, .06, z);
  house.scale.setScalar(size);
  house.rotation.y = angle;
  box(house, capStone, 0, .055, 0, 2.38, .14, 1.64);
  box(house, plaster, 0, .72, 0, 2.15, 1.27, 1.39);
  for (const s of [-1, 1]) {
    const slope = box(house, roof, 0, 1.55, s * .44, 2.44, .106, 1.08);
    slope.rotation.x = s * .56;
    for (let i = -7; i <= 7; i++) {
      const seam = box(house, roof, i * .16, 1.588, s * .46, .039, .04, 1.08);
      seam.rotation.x = s * .56;
    }
    const gable = new T.Shape().moveTo(-.69, 0).lineTo(.69, 0).lineTo(0, .44).closePath();
    const gableMesh = mesh(house, new T.ShapeGeometry(gable), paint('#fff0ce', { side: T.DoubleSide }), s * 1.071, 1.35, 0);
    gableMesh.rotation.y = Math.PI / 2;
  }
  box(house, redDark, -.72, 1.86, -.42, .22, .62, .22);
  box(house, capStone, -.72, 2.16, -.42, .29, .10, .27);
  box(house, roof, -.43, .44, .711, .38, .69, .051);
  box(house, timber, -.43, .149, .794, .56, .10, .22);
  box(house, capStone, .51, .81, .711, .58, .5, .067);
  box(house, teal, .51, .81, .753, .46, .385, .029);
  box(house, cream, .51, .81, .77, .045, .39, .03);
  box(house, cream, .51, .81, .77, .45, .041, .03);
  box(house, timber, .51, .516, .784, .58, .13, .20);
  for (let i = 0; i < 5; i++) oval(house, blossom[i % blossom.length], .29 + i * .11, .601, .805, .053, .067, .052);
}

function pine(detail, x, z, size) {
  const plant = group(detail, x, .05, z);
  plant.scale.setScalar(size);
  const bend = random() * .32 - .16;
  bar(plant, brown, vec(0, 0, 0), vec(bend, 1.71, .12), .104);
  for (let n = 0; n < 3; n++) {
    const a = n / 3 * TAU + .55;
    const branch = vec(Math.cos(a) * .46 + bend, 1.55 + n * .15, Math.sin(a) * .46);
    bar(plant, brown, vec(bend * .65, 1.03, 0), branch, .062);
    const leaf = oval(plant, pineColors[n], branch.x, branch.y + .3, branch.z, .68, .46, .65);
    leaf.rotation.y = a;
  }
  oval(plant, pineColors[2], bend, 2.16, 0, .65, .48, .64, -.11);
}

function cypress(detail, x, z, size) {
  bar(detail, brown, vec(x, .02, z), vec(x, size * .87, z), size * .031);
  oval(detail, pineColors[Math.floor(random() * pineColors.length)], x, size * .64, z,
    size * .21, size * .53, size * .236, random() * .12 - .06);
  oval(detail, pineColors[1], x - size * .041, size * .88, z + .07, size * .136, size * .38, size * .156, .06);
}

function planting(detail, trees) {
  for (const [x, z, size] of [
    [-8.93, .8, 1.05], [-5.8, .2, 1.4], [-6.5, -2.2, 1.17], [-6.8, -4.7, .89],
    [-3.3, -4.3, 1.34], [.4, -4.1, 1.16], [2.2, -4.35, 1.4], [4.45, -2.82, 1.27],
    [6.67, -1.7, 1.26], [5.65, 2.88, .82], [8.8, .1, .77], [-1.3, -.15, .84], [-8, .1, .98],
  ]) pine(trees, x, z, size);
  for (const [x, z, s] of [[-7.25, 1.8, 1.4],[-.9, 3.6, 1.95],[3.4, 3.13, 1.56],[-4.7, -2.9, 1.5],[5.25, .3, 1.7],[7.1, 3.2, 1.28],[-5.7, 2.5, 1.2]]) cypress(trees, x, z, s);

  for (let i = 0; i < 260; i++) {
    const index = Math.floor(random() * SAMPLES);
    const sign = i % 3 === 0 ? -1 : 1;
    const p = nodes[index].clone().addScaledVector(normals[index], sign * (1.66 + random() * 1.0));
    const height = .09 + random() * .20;
    const a = random() * TAU;
    const tip = vec(p.x + Math.sin(a) * .046, height, p.z + Math.cos(a) * .046);
    bar(detail, tufts[i % tufts.length], vec(p.x, -.08, p.z), tip, .016);
    oval(detail, tufts[i % tufts.length], p.x + .04, height * .45, p.z, .072, .019, .037, .52);
    if (i % 4 !== 0) {
      const flower = mesh(detail, pebbles, blossom[Math.floor(index / 25) % blossom.length], tip.x, tip.y, tip.z);
      flower.scale.set(.052, .04, .052);
    }
  }
}

function flowerGarden(detail) {
  const center = vec(.7, .27, .25);
  const garden = group(detail, center.x, center.y, center.z);
  garden.rotation.y = -.23;
  const hedge = paint('#69834d');
  const trailMaterial = paint('#d5c19a');
  const path = mesh(garden, new T.CircleGeometry(1.52, 48), trailMaterial, 0, .028, 0);
  path.rotation.x = -Math.PI / 2;
  path.scale.x = 1.54;
  box(garden, hedge, 0, .032, 0, 2.45, .09, 1.4);
  for (let n = 0; n < 138; n++) {
    const x = random() * 2.4 - 1.2;
    const z = random() * 1.34 - .67;
    const diagonal = Math.abs(Math.abs(x) * .57 - .64 - z) < .10;
    const border = Math.abs(x) > 1.07 || Math.abs(z) > .55;
    const material = diagonal || border ? blossom[1] : blossom[2];
    const tip = mesh(garden, pebbles, material, x, .106 + random() * .046, z);
    const size = .049 + random() * .025;
    tip.scale.set(size, size * 1.2, size);
  }
  for (const x of [-1.71, 1.71]) {
    box(garden, timber, x, .28, 0, .30, .099, .81);
    for (const z of [-.28, .28]) box(garden, brown, x, .141, z, .17, .25, .103);
  }
}

function quay(detail) {
  const dock = group(detail, -10.5, -.68, 5.35);
  dock.rotation.y = .65;
  for (let i = 0; i < 22; i++) {
    box(dock, i % 3 ? driftwood : capStone, 0, .29, i * .17, 1.31, .13, .165);
    if (i % 5 === 0) {
      for (const x of [-.55, .55]) {
        box(dock, timber, x, .11, i * .17, .126, 1.18, .13);
        box(dock, cream, x, .72, i * .17, .144, .07, .144);
      }
    }
  }
  const skiff = group(detail, -11.31, -1.19, 8.43);
  skiff.rotation.y = -.19;
  loftSkiff(skiff);
  const buoy = group(detail, -13.5, -.98, 3.25);
  oval(buoy, red, 0, 0, 0, .28, .31, .28);
  cylinder(buoy, cream, 0, .075, 0, .241, .28, .107, 16);
  bar(buoy, brown, vec(0, .18, 0), vec(0, .66, -.045), .034);
  box(buoy, red, .13, .564, -.04, .23, .15, .023);
}

function loftSkiff(skiff) {
  const outline = new T.Shape();
  outline.moveTo(0, 1.15);
  outline.quadraticCurveTo(.62, .57, .49, -.63);
  outline.quadraticCurveTo(.42, -1.13, 0, -1.12);
  outline.quadraticCurveTo(-.42, -1.13, -.49, -.63);
  outline.quadraticCurveTo(-.62, .57, 0, 1.15);
  const hole = new T.Path();
  hole.moveTo(0, .96);
  hole.quadraticCurveTo(-.48, .53, -.4, -.55);
  hole.quadraticCurveTo(-.3, -.96, 0, -.98);
  hole.quadraticCurveTo(.3, -.96, .4, -.55);
  hole.quadraticCurveTo(.48, .53, 0, .96);
  outline.holes.push(hole);
  const hull = mesh(skiff, new T.ExtrudeGeometry(outline, { depth: .31, bevelEnabled: true, bevelSize: .035, bevelThickness: .034, bevelSegments: 1 }), red);
  hull.rotation.x = -Math.PI / 2;
  box(skiff, timber, 0, .04, 0, .69, .04, 1.28);
  box(skiff, capStone, 0, .27, .32, .93, .068, .19);
  box(skiff, capStone, 0, .27, -.45, .92, .068, .19);
  const paddle = box(skiff, driftwood, .14, .31, .08, .047, .047, 1.49);
  paddle.rotation.y = .26;
  box(skiff, driftwood, .32, .31, .73, .13, .053, .27);
}

function mailbox(scene, detail, stop) {
  const point = route.getPointAt(stop.at);
  const tangent = route.getTangentAt(stop.at);
  point.addScaledVector(vec(tangent.z, 0, -tangent.x), 1.88);
  const post = group(detail, point.x, -.04, point.z);
  post.rotation.y = Math.atan2(tangent.x, tangent.z);
  box(post, timber, 0, .34, 0, .128, .72, .13);
  box(post, redDark, 0, .82, 0, .43, .32, .49);
  const top = cylinder(post, red, 0, .97, 0, .217, .217, .50, 20);
  top.rotation.x = Math.PI / 2;
  box(post, dark, 0, .972, .253, .255, .06, .015);
  box(post, plaster, 0, .846, .262, .163, .09, .013);

  const pulse = group(scene, point.x, 1.63, point.z);
  const ring = mesh(pulse, new T.TorusGeometry(.216, .033, 8, 30), paint('#ffb64d', { emissive: '#a24921', emissiveIntensity: .4 }));
  const letter = box(pulse, plaster, 0, 0, 0, .248, .162, .048);
  letter.rotation.z = -.18;
  line(letter, red, [vec(-.46, .36, .54), vec(0, -.15, .54), vec(.46, .36, .54)], .052);
  return { pulse, ring };
}

function makeGulls(scene) {
  const gulls = [];
  for (let i = 0; i < 7; i++) {
    const gull = group(scene);
    oval(gull, plaster, 0, 0, 0, .22, .073, .085);
    oval(gull, cream, .183, -.006, 0, .08, .028, .04);
    const wings = [];
    for (const side of [-1, 1]) {
      const wing = group(gull, -.048, .032, 0);
      const upper = oval(wing, plaster, .024, 0, side * .194, .098, .028, .208);
      upper.rotation.y = side * -.34;
      const tip = oval(wing, dark, -.064, -.017, side * .366, .071, .026, .116);
      tip.rotation.y = side * -.63;
      wings.push({ wing, side });
    }
    gulls.push({ gull, wings });
  }
  return (time, reduced) => {
    gulls.forEach(({ gull, wings }, i) => {
      const a = i * .39 + (reduced ? .5 : time * .23);
      const radius = 10.5 + i * .64;
      gull.position.set(Math.cos(a) * radius, 5.4 + i * .29 + Math.sin(a * 2) * .49, Math.sin(a) * radius - 2.5);
      gull.rotation.y = -a - Math.PI / 2;
      gull.rotation.x = -.1;
      for (const { wing, side } of wings) {
        const power = Math.max(0, Math.sin(time * 1.4 + i * .8));
        wing.rotation.x = side * (reduced ? .21 : .13 + Math.sin(time * 8 + i * .52) * power * .58);
      }
    });
  };
}

export function makeIsland(scene) {
  const detail = new T.Group();
  makeLand(scene, detail);
  const buildings = group(detail);
  lighthouse(buildings);
  cottage(buildings, -2.3, 2.0, -.04, red, 1.04);
  cottage(buildings, 5.1, -4.24, .37, teal, .89);
  cottage(buildings, -8.48, 3.02, -.83, red, .82);
  cottage(buildings, -6.82, 4.38, -.23, teal, .64);
  planting(detail, buildings);
  buildings.traverse(object => {
    if (object.isMesh) object.castShadow = true;
  });
  flowerGarden(detail);
  quay(detail);
  const mailboxes = stops.map(stop => mailbox(scene, detail, stop));
  batch(detail, scene);

  const updateOcean = ocean(scene);
  const updateGulls = makeGulls(scene);
  const sky = mesh(scene, new T.SphereGeometry(245, 28, 12), new T.ShaderMaterial({
    side: T.BackSide, depthWrite: false,
    uniforms: {
      zenith: { value: new T.Color('#76bdb9') },
      horizon: { value: new T.Color('#c7e4c3') },
    },
    vertexShader: 'varying vec3 p; void main(){p=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `
      uniform vec3 zenith, horizon;
      varying vec3 p;
      void main(){
        vec3 direction=normalize(p);
        float f=smoothstep(-.07,.62,direction.y);
        vec3 color=mix(horizon,zenith,f);
        vec3 sun=normalize(vec3(-.65,.24,-.6));
        float dist=distance(sun,direction);
        color=mix(color,vec3(1.,.85,.57),.25*(1.-smoothstep(.01,.35,dist))+.63*(1.-smoothstep(.041,.044,dist)));
        gl_FragColor=vec4(color,1.);
        #include <colorspace_fragment>
      }
    `,
  }));
  sky.renderOrder = -10;

  const cloudMaterial = paint('#f2efcd', { roughness: 1 });
  const clouds = new T.Group();
  for (let c = 0; c < 12; c++) {
    const a = c * TAU / 12 + .21;
    const cloud = group(clouds, Math.sin(a) * 49, 10 + (c % 4) * 2.1, Math.cos(a) * 49);
    cloud.rotation.y = a;
    for (let k = 0; k < 6; k++) {
      const size = 1 - Math.abs(k - 2.6) * .19;
      oval(cloud, cloudMaterial, (k - 2.6) * 1.61, Math.sin(k * .9) * .51, Math.cos(k) * .87,
        2.65 * size, .82 * size, 1.34 * size);
    }
  }
  batch(clouds, scene);

  const boat = group(scene, 10.8, -1.24, 17.2);
  loftSkiff(boat);
  bar(boat, timber, vec(0, .16, .26), vec(0, 2.06, .26), .027);
  const sail = new T.Shape();
  sail.moveTo(0, .36).quadraticCurveTo(.55, 1.23, .11, 1.94).lineTo(.85, .47).closePath();
  const cloth = mesh(boat, new T.ShapeGeometry(sail, 12), paint('#e2b96c', { side: T.DoubleSide }), 0, 0, .24);
  cloth.rotation.y = Math.PI / 2;
  const pennant = new T.Shape().moveTo(0, 1.86).lineTo(-.36, 1.93).lineTo(0, 2.04).closePath();
  mesh(boat, new T.ShapeGeometry(pennant), paint('#d56550', { side: T.DoubleSide }), 0, 0, .26);
  boat.rotation.y = .64;

  function animate(time, reduced, delivered) {
    updateOcean(time, reduced);
    updateGulls(time, reduced);
    boat.rotation.z = reduced ? .075 : Math.sin(time * 1.5) * .075;
    boat.position.y = -1.23 + (reduced ? 0 : Math.sin(time * 1.8) * .043);
    mailboxes.forEach(({ pulse, ring }, i) => {
      pulse.visible = !delivered.has(i);
      pulse.rotation.y = reduced ? .4 : time * 1.1 + i;
      pulse.position.y = 1.59 + (reduced ? 0 : Math.sin(time * 2 + i) * .13);
      ring.rotation.z = -.3;
    });
  }

  return { route, length, animate };
}
