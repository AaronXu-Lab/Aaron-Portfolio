import { T, TAU, alignRod, bar, box, group, line, loft, mesh, oval, paint, vec } from './geometry.js';

export const wheelRadius = .56;
const tire = paint('#20322d');
const sidewall = paint('#d9bb87');
const steel = paint('#bccbc3', { metalness: .5, roughness: .47 });
const chrome = paint('#f2e8c9', { metalness: .3 });
const turquoise = paint('#13796f', { metalness: .12, roughness: .32 });
const ivory = paint('#fff4d7');
const plumage = paint('#f0debd');
const ash = paint('#a99c83');
const soot = paint('#6a6758');
const eye = paint('#181f1b', { roughness: .3 });
const bill = paint('#f4b44f', { roughness: .58 });
const pouch = paint('#ed8f5c');
const feet = paint('#d68949');
const coral = paint('#c34a35');
const scarlet = paint('#eb634a');
const leather = paint('#604139');
const canvas = paint('#cf9f5d');
const strap = paint('#a77342');
const saddle = vec(-.49, 1.36, 0);
const bracket = vec(-.17, .62, 0);
const tip = vec(.62, 1.43, 0);
const rear = vec(-1.05, wheelRadius, 0);
const front = vec(1.03, wheelRadius, 0);
const crankRadius = .22;

function ring(parent, material, x, y, z, radius, thick, segments = 64) {
  return mesh(parent, new T.TorusGeometry(radius, thick, 9, segments), material, x, y, z);
}

function makeWheel(parent, x) {
  const pivot = group(parent, x, wheelRadius, 0);
  ring(pivot, tire, 0, 0, 0, wheelRadius - .048, .048);
  for (const side of [-1, 1]) {
    ring(pivot, sidewall, 0, 0, side * .032, .508, .013);
    ring(pivot, chrome, 0, 0, side * .021, .473, .017);
  }
  bar(pivot, steel, vec(0, 0, -.17), vec(0, 0, .17), .047);
  for (let i = 0; i < 20; i++) {
    const angle = i / 20 * TAU;
    const anchor = vec(Math.cos(angle + .21 * (i % 2 ? -1 : 1)) * .037, Math.sin(angle + .21) * .037, i % 2 ? .093 : -.093);
    bar(pivot, steel, anchor, vec(Math.cos(angle) * .472, Math.sin(angle) * .472, 0), .006);
  }
  return pivot;
}

function makeBike(root) {
  const steering = group(root, tip.x, tip.y, 0);
  const wheel = makeWheel(steering, front.x - tip.x);
  wheel.position.y -= tip.y;
  const backWheel = makeWheel(root, rear.x);
  const headBottom = vec(.73, 1.16, 0);
  for (const [a, b, radius] of [
    [saddle, bracket, .043], [saddle, tip, .049], [bracket, headBottom, .057], [tip, headBottom, .063],
  ]) bar(root, turquoise, a, b, radius);
  for (const side of [-1, 1]) {
    const dropout = vec(rear.x, rear.y, side * .105);
    bar(root, turquoise, vec(saddle.x, saddle.y - .06, side * .045), dropout, .025);
    bar(root, turquoise, vec(bracket.x, bracket.y, side * .08), dropout, .032);
    line(steering, turquoise, [vec(.07, -.13, side * .07), vec(.2, -.56, side * .112), vec(front.x - tip.x, front.y - tip.y, side * .12)], .031, true);
  }
  bar(root, steel, saddle, vec(saddle.x - .045, 1.53, 0), .029);
  oval(root, leather, -.53, 1.53, 0, .24, .05, .135);
  bar(steering, steel, vec(0, -.035, 0), vec(-.056, .22, 0), .038);
  line(steering, chrome, [vec(-.22, .245, -.37), vec(-.035, .235, -.25), vec(-.056, .22, 0), vec(-.035, .235, .25), vec(-.22, .245, .37)], .033, true);
  for (const side of [-1, 1]) {
    bar(steering, leather, vec(-.12, .243, side * .328), vec(-.255, .25, side * .397), .047);
  }

  for (const [parent, cx, cy, angle] of [[root, rear.x, rear.y, 1.8], [steering, front.x - tip.x, front.y - tip.y, 1.5]]) {
    const points = [];
    for (let i = 0; i <= 24; i++) {
      const a = angle - .92 + i / 24 * 1.84;
      points.push(vec(cx + Math.cos(a) * .608, cy + Math.sin(a) * .608, 0));
    }
    line(parent, turquoise, points, .053, true);
    line(parent, ivory, points.map(point => point.clone().add(vec(0, .014, .039))), .009, true);
  }
  line(root, steel, [vec(-1.475, 1.06, 0), vec(-1.42, 1.18, 0), vec(-.65, 1.18, 0)], .023);
  for (const side of [-1, 1]) {
    bar(root, steel, vec(-1.35, 1.16, .16 * side), vec(rear.x, rear.y, .13 * side), .023);
    bar(root, steel, vec(-1.4, 1.17, .16 * side), vec(-.68, 1.17, .16 * side), .022);
  }
  oval(root, coral, -1.464, 1.15, 0, .034, .055, .085);
  const lamp = group(steering, .19, -.095, 0);
  oval(lamp, chrome, 0, 0, 0, .097, .073, .073);
  oval(lamp, paint('#ffdf83', { emissive: '#8f6112', emissiveIntensity: .23 }), .078, .004, 0, .025, .057, .057);
  const bell = group(steering, -.037, .264, .22);
  oval(bell, bill, 0, .033, 0, .069, .047, .069);
  oval(bell, chrome, 0, .07, 0, .013, .01, .013);

  const chainring = group(root, bracket.x, bracket.y, .105);
  ring(chainring, chrome, 0, 0, 0, .154, .021, 36);
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * TAU;
    bar(chainring, steel, vec(0, 0, 0), vec(Math.cos(a) * .15, Math.sin(a) * .15, 0), .017);
  }
  ring(root, steel, rear.x, rear.y, .112, .087, .011, 24);
  bar(root, tire, vec(bracket.x, bracket.y + .155, .117), vec(rear.x, rear.y + .088, .117), .009);
  bar(root, tire, vec(bracket.x, bracket.y - .155, .117), vec(rear.x, rear.y - .088, .117), .009);

  const bag = group(root, -1.17, 1.19, .10);
  oval(bag, canvas, 0, .04, 0, .32, .155, .205);
  oval(bag, strap, -.07, .034, .174, .026, .12, .045, -.07);
  const parcel = box(bag, ivory, -.03, .158, .004, .31, .045, .22);
  parcel.rotation.y = -.16;
  box(bag, coral, -.036, .183, .053, .049, .006, .043);
  return { steering, wheels: [wheel, backWheel], chainring, bell, bag };
}

function makeBird(root) {
  const body = group(root, -.55, 1.7, 0);
  oval(body, plumage, -.07, .025, 0, .59, .432, .378, .24);
  oval(body, ivory, .045, .15, 0, .48, .355, .352, .34);
  for (const side of [-1, 0, 1]) {
    oval(body, side ? ash : ivory, -.58, .1, side * .106, .36, .077, .09, -.29 - side * .055);
  }
  const neck = group(body, .195, .195, 0);
  oval(neck, ivory, .056, .22, 0, .23, .43, .236, -.38);
  oval(neck, plumage, .145, .315, 0, .192, .361, .205, -.16);
  const head = group(neck, .23, .565, 0);
  oval(head, ivory, 0, .03, 0, .347, .31, .279);
  oval(head, plumage, -.063, -.06, 0, .269, .24, .264);
  loft(head, bill, [
    [.13, -.021, .002, .012], [.18, .005, .085, .129], [.27, .015, .089, .148],
    [.42, .012, .062, .129], [.61, -.016, .045, .103], [.79, -.054, .035, .071],
    [.91, -.079, .022, .034], [.953, -.109, .002, .007],
  ]);
  loft(head, pouch, [
    [.03, -.099, .009, .009], [.13, -.112, .071, .114], [.24, -.155, .118, .151],
    [.35, -.181, .129, .137], [.50, -.172, .102, .11], [.68, -.133, .055, .077],
    [.84, -.111, .023, .049], [.951, -.109, .001, .006],
  ]);
  const eyes = [];
  for (const side of [-1, 1]) {
    const z = side * .225;
    oval(head, bill, .102, .065, z, .109, .11, .063, -.08);
    const eyelid = group(head, .127, .071, z + side * .032);
    oval(eyelid, eye, 0, 0, 0, .061, .071, .041);
    oval(eyelid, ivory, .022, .027, side * .033, .017, .017, .008);
    oval(eyelid, ivory, -.016, -.025, side * .032, .008, .008, .006);
    eyes.push(eyelid);
    line(head, strap, [vec(.236, -.062, .143 * side), vec(.43, -.053, .126 * side), vec(.67, -.072, .09 * side), vec(.92, -.102, .027 * side)], .008, true);
  }

  const cap = group(head, -.055, .247, 0);
  cap.rotation.z = .12;
  oval(cap, turquoise, 0, .065, 0, .287, .141, .239, -.06);
  oval(cap, turquoise, .175, .004, 0, .207, .027, .178, -.11);
  oval(cap, chrome, .004, .205, 0, .031, .017, .024);
  const patch = oval(cap, ivory, .056, .08, .205, .076, .045, .022, -.09);
  patch.rotation.y = .14;
  oval(cap, coral, .064, .08, .226, .033, .009, .005, -.30);
  const collar = ring(neck, coral, .024, .15, 0, .227, .049, 40);
  collar.rotation.x = Math.PI / 2;
  collar.rotation.y = -.15;
  oval(neck, scarlet, -.177, .13, .15, .112, .084, .076);
  const scarf = group(neck, -.23, .14, .15);
  const scarfMaterial = paint('#df513a', { side: T.DoubleSide });
  const ribbon = new T.PlaneGeometry(1, 1, 16, 2);
  const position = ribbon.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const u = position.getX(i) + .5;
    const v = position.getY(i);
    position.setXYZ(i, -u * .87, -.04 - .125 * u + v * (.145 - u * .038), v * .047);
  }
  ribbon.computeVertexNormals();
  const tail = mesh(scarf, ribbon, scarfMaterial);
  const second = mesh(scarf, ribbon, coral.clone(), .02, -.019, -.043);
  second.material.side = T.DoubleSide;
  second.scale.set(.74, .85, 1);
  second.rotation.z = .20;

  const wings = [];
  for (const side of [-1, 1]) {
    const wing = group(root, -.68, 1.92, side * .288);
    oval(wing, plumage, .10, -.115, side * .042, .377, .193, .112, -.30);
    for (let i = 0; i < 5; i++) {
      oval(wing, i > 2 ? soot : ash, -.14 + .105 * i, -.178 - .017 * i, side * .067,
        .218 - .017 * i, .045, .062, .53 - .12 * i);
    }
    oval(wing, ivory, .13, -.073, side * .047, .243, .124, .105, -.21);
    const shoulder = vec(-.41, 1.82, side * .37);
    const elbow = vec(-.09, 1.52, side * .42);
    const hand = vec(.436, 1.674, side * .36);
    line(root, plumage, [shoulder, elbow, hand], .077, true);
    const grip = oval(root, ivory, hand.x, hand.y, hand.z, .083, .069, .093, .27);
    wings.push({ wing, grip, hand });
  }

  const legs = [-1, 1].map(side => {
    const dummy = vec(0, 1, 0);
    const thigh = bar(root, plumage, dummy, vec(0, 0, 0), .078);
    const shank = bar(root, feet, dummy, vec(0, 0, 0), .047);
    const knee = oval(root, feet, 0, 0, 0, .059, .061, .056);
    const shoe = group(root);
    oval(shoe, bill, .038, .015, 0, .145, .047, .093);
    for (let i = -1; i <= 1; i++) oval(shoe, pouch, .141, .012, i * .046, .055, .026, .032);
    const pedal = box(root, tire, 0, 0, 0, .209, .042, .228);
    const crank = bar(root, chrome, dummy, vec(0, 0, 0), .031);
    return { side, thigh, shank, knee, shoe, pedal, crank };
  });

  return { body, neck, head, eyes, tail, second, ribbon, wings, legs };
}

export function makeRider(scene) {
  const root = group(scene);
  const rig = group(root);
  const bike = makeBike(rig);
  const bird = makeBird(rig);
  const scarfRest = bird.ribbon.attributes.position.array.slice();
  const shadowPlane = new T.PlaneGeometry(4.7, 2.2);
  const shadowMat = new T.ShaderMaterial({
    transparent: true, depthWrite: false,
    vertexShader: 'varying vec2 st; void main(){ st=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: 'varying vec2 st; void main(){vec2 q=(st-.5)*2.;float a=pow(max(0.,1.-dot(q,q)),2.6); gl_FragColor=vec4(.16,.15,.09,a*.29);}',
  });
  const shadow = mesh(root, shadowPlane, shadowMat, -.18, .022, -.18);
  shadow.rotation.x = -Math.PI / 2;

  function update({ distance, speed, lean, time, reduced, ringTime }) {
    const crankAngle = .7 - distance / 1.19;
    const effort = Math.min(speed / 4, 1);
    const bob = Math.cos(crankAngle * 2) * .033 * effort;
    rig.rotation.x = lean;
    bike.steering.rotation.y = lean * -.43;
    for (const wheel of bike.wheels) wheel.rotation.z = -distance / wheelRadius;
    bike.chainring.rotation.z = crankAngle;
    const ringAge = time - ringTime;
    const ringBounce = ringAge < .72 ? Math.sin(ringAge * 42) * Math.exp(-ringAge * 5) : 0;
    bike.bell.rotation.x = ringBounce * .35;
    bike.bag.rotation.x = Math.sin(crankAngle * 2 + 1) * effort * .036;
    bird.body.position.y = 1.7 + bob;
    bird.neck.rotation.z = .055 * Math.sin(crankAngle) * effort + effort * -.12;
    bird.head.rotation.y = .09 * Math.cos(crankAngle * .4) * effort + ringBounce * .35;
    bird.head.rotation.z = -.065 + Math.cos(crankAngle * 2 + .8) * .034 * effort;
    const blink = reduced ? 1 : Math.max(.08, Math.min(1, Math.abs((time + 2) % 5.7 - .17) * 7));
    for (const lid of bird.eyes) lid.scale.y = blink;
    const positions = bird.ribbon.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const offset = i * 3;
      const x = scarfRest[offset];
      const wave = reduced ? 0 : Math.sin(time * (4 + speed) + x * 10) * x * (.047 + effort * .12);
      positions.setY(i, scarfRest[offset + 1] + wave + effort * -x * .18);
      positions.setZ(i, scarfRest[offset + 2] + wave * .75);
    }
    positions.needsUpdate = true;

    for (const { wing, grip, hand } of bird.wings) {
      wing.rotation.z = bob * 1.3;
      grip.position.copy(hand);
      grip.position.x += .29 * lean * Math.sign(hand.z);
    }
    for (const { side, thigh, shank, knee, shoe, pedal, crank } of bird.legs) {
      const angle = crankAngle + (side < 0 ? Math.PI : 0);
      const foot = vec(bracket.x + Math.cos(angle) * crankRadius, bracket.y + Math.sin(angle) * crankRadius, side * .255);
      const hip = vec(-.57, 1.49 + bob, side * .237);
      const delta = foot.clone().sub(hip);
      const distanceToFoot = delta.length();
      const forward = vec(-delta.y, delta.x, 0).normalize();
      const joint = hip.clone().addScaledVector(delta, .5)
        .addScaledVector(forward, Math.sqrt(Math.max(.01, .566 ** 2 - (distanceToFoot / 2) ** 2)));
      alignRod(thigh, hip, joint, .082);
      alignRod(shank, joint, foot, .051);
      knee.position.copy(joint);
      shoe.position.copy(foot);
      shoe.position.y += .022;
      shoe.rotation.z = Math.cos(angle) * .13;
      pedal.position.copy(foot);
      pedal.position.y -= .042;
      pedal.rotation.z = shoe.rotation.z;
      alignRod(crank, vec(bracket.x, bracket.y, side * .147), foot.clone().setZ(side * .157), .032);
    }
  }

  return { root, update };
}
