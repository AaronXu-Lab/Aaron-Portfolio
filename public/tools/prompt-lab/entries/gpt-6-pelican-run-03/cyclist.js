import * as T from './vendor/three.module.min.js';
import {group,egg,box,rod,pipe,carve,hoop,printTexture,label,fitRod,bakePaintedParts} from './sculpt.js';

const jade='#14745f', dark='#193c35', chalk='#fff4d7', gold='#f1b840', tomato='#d64a35', ink='#273d39', alloy='#acb8a8', leather='#783e27';
const tau=Math.PI*2;
export function cyclist(parent) {
  const rig=group(parent), bike=group(rig), rider=group(rig);
  const wheels=[];
  for(const x of [-.84,.84]) {
    const w=group(bike);w.position.set(x,.49,0);wheels.push(w);
    hoop(w,ink,0,0,0,.45,.04);hoop(w,'#d7b882',0,0,0,.425,.027);hoop(w,alloy,0,0,0,.404,.015);
    for(let j=0;j<24;j++) {
      const a=tau*j/24,b=a+(j%2?1:-1)*.42;
      rod(w,'#9ba99c',[.04*Math.cos(b),.04*Math.sin(b),j%2?.046:-.046],[.4*Math.cos(a),.4*Math.sin(a),0],.0055);
    }
    rod(w,alloy,[0,0,-.065],[0,0,.065],.045);
    rod(w,ink,[0,.35,0],[0,.4,0],.009);
  }
  const crank=[-.05,.50,0],seat=[-.39,1.24,0],head=[.57,1.26,0],lower=[.64,1.06,0];
  for(const [a,b,r,c] of [[seat,crank,.046,tomato],[seat,head,.036,tomato],[crank,lower,.055,tomato],[head,lower,.053,chalk]]) rod(bike,c,a,b,r);
  for(const s of [-1,1]) {
    rod(bike,tomato,[-.84,.49,s*.075],[-.05,.5,s*.042],.023);
    rod(bike,tomato,[-.84,.49,s*.075],seat,.023);
    pipe(bike,chalk,[[.60,1.12,0],[.68,.92,s*.072],[.76,.60,s*.082],[.84,.49,s*.075]],.031);
  }
  rod(bike,alloy,seat,[-.43,1.39,0],.03);
  carve(bike,leather,[[-.68,1.4,0,.012,.025],[-.57,1.41,0,.065,.15],[-.38,1.41,0,.05,.12],[-.18,1.405,0,.031,.04],[-.14,1.4,0,.004,.003]]);
  rod(bike,alloy,head,[.53,1.43,0],.031);rod(bike,alloy,[.53,1.43,0],[.71,1.46,0],.031);
  for(const s of [-1,1]) {
    pipe(bike,alloy,[[.71,1.46,0],[.71,1.46,s*.18],[.81,1.45,s*.24],[.86,1.4,s*.245]],.025);
    pipe(bike,leather,[[.82,1.45,s*.245],[.9,1.37,s*.245],[.85,1.25,s*.245],[.7,1.24,s*.245]],.033);
  }
  hoop(bike,ink,-.05,.5,.099,.147,.019);hoop(bike,alloy,-.84,.49,.099,.066,.011);
  for(const sign of [-1,1]) rod(bike,ink,[-.84,.49+sign*.064,.101],[-.05,.5+sign*.147,.101],.01);
  const crankset=group(bike);crankset.position.set(...crank);
  for(const s of [-1,1]) rod(crankset,alloy,[0,0,s*.13],[s*.23,0,s*.14],.021);

  // A pear-shaped jersey wraps the body. The tail feathers emerge below its hem.
  for(let i=-2;i<=2;i++) egg(rider,i%2?'#c9c7af':chalk,-.86,1.72+Math.abs(i)*.023,i*.077,.46,.068,.085,-.23);
  carve(rider,jade,[[-.9,1.77,0,.014,.02],[-.74,1.76,0,.215,.23],[-.43,1.81,0,.35,.34],[-.05,1.91,0,.36,.355],[.21,2.00,0,.28,.29],[.32,2.07,0,.10,.14],[.35,2.08,0,.001,.001]]);
  for(const s of [-1,1]) {
    pipe(rider,'#dbb653',[[-.79,1.61,s*.12],[-.68,1.57,s*.18],[-.52,1.51,s*.18],[-.38,1.47,s*.12]],.019);
    for(let i=0;i<3;i++)egg(rider,i%2?'#f3ebd3':'#eee1c5',-.78-i*.055,1.74+i*.042,s*(.15-i*.018),.28,.048,.054,-.14);
  }
  // Curved white neck lifting from the collar into the skull.
  egg(rider,chalk,.21,2.16,0,.232,.445,.224,.17);
  egg(rider,'#e9c351',.183,2.105,0,.243,.083,.239,.24);
  const headRig=group(rider);headRig.position.set(.25,2.39,0);
  // A soft throat ruff bridges the neck and the jersey collar.
  for(let i=-2;i<=2;i++) egg(rider,i%2?'#f7edd4':chalk,.327,2.125-Math.abs(i)*.012,i*.076,.107,.144,.07,-.23);
  egg(headRig,chalk,.025,.14,0,.327,.335,.287,-.09);
  for(let i=-1;i<=1;i++) egg(headRig,chalk,-.228,.245+i*.043,i*.075,.17,.05,.056,.26);
  // The elastic pouch hangs from a narrow upper mandible, with a hooked nail at the tip.
  const bill=[ [.18,.14,0,.04,.12],[.34,.065,0,.157,.231],[.55,-.033,0,.207,.207],[.77,-.059,0,.183,.164],[.99,-.006,0,.102,.109],[1.17,.033,0,.037,.045],[1.23,.045,0,.004,.004] ];
  carve(headRig,'#f39b58',bill);
  carve(headRig,'#f6bd4f',[[.17,.195,0,.034,.106],[.35,.19,0,.087,.224],[.62,.148,0,.061,.20],[.91,.109,0,.046,.129],[1.145,.08,0,.032,.061],[1.23,.063,0,.018,.018],[1.245,.038,0,.003,.003]]);
  for(const s of [-1,1]){
    pipe(headRig,'#ac6332',[[.32,.123,s*.218],[.55,.095,s*.209],[.8,.079,s*.158],[1.06,.059,s*.086],[1.21,.051,s*.018]],.006);
    for(let i=0;i<3;i++) pipe(headRig,'#e68d4f',[[.34,.035-i*.025,s*(.227-i*.011)],[.52,-.05-i*.037,s*(.20-i*.016)],[.70,-.07-i*.036,s*(.182-i*.013)],[.86,-.04-i*.022,s*(.14-i*.008)]],.0045);
    egg(headRig,'#bf783c',.404,.225,s*.191,.037,.012,.014,-.08);
    egg(headRig,'#e9ad57',.142,.224,s*.239,.115,.109,.045);
    egg(headRig,'#fcf8dd',.15,.237,s*.269,.084,.084,.043);
    egg(headRig,ink,.174,.235,s*.301,.046,.053,.018);
    egg(headRig,'#fffdf3',.188,.252,s*.317,.012,.014,.008);
  }
  // Crown, two piping seams and a flipped short visor.
  egg(headRig,tomato,-.04,.397,0,.322,.19,.282,.10);
  egg(headRig,'#b64230',-.033,.368,0,.327,.061,.283,.1);
  egg(headRig,tomato,.226,.421,0,.214,.032,.225,.26);
  egg(headRig,chalk,-.052,.58,0,.038,.018,.028);
  for(const s of [-1,1]) pipe(headRig,'#f2b18a',[[-.31,.447,s*.10],[-.2,.535,s*.13],[-.04,.566,s*.12],[.14,.527,s*.12],[.222,.459,s*.10]],.006);
  const bib=printTexture(256,190,(ctx,w,h)=>{ctx.fillStyle='#f1e8cb';ctx.fillRect(0,0,w,h);ctx.fillStyle='#253d31';ctx.textAlign='center';ctx.font='italic bold 145px Georgia';ctx.fillText('07',w/2,139);ctx.fillRect(20,156,216,5);});
  for(const s of [-1,1]){
    // The wing bends forward to meet the bars. Overlapping primaries taper into the handgrip.
    carve(rider,'#1a6654',[[-.69,1.91,s*.19,.03,.04],[-.42,1.99,s*.261,.205,.108],[-.12,1.99,s*.285,.212,.10],[.16,1.88,s*.285,.134,.08],[.24,1.81,s*.28,.042,.032]]);
    const number=label(rider,bib,-.32,1.99,s*.405,.30,.215); number.rotation.y=s<0?Math.PI:0;number.rotation.z=.07*s;
    carve(rider,gold,[[.08,1.91,s*.29,.09,.081],[.15,1.87,s*.29,.125,.087],[.208,1.83,s*.29,.108,.073],[.22,1.82,s*.29,.028,.02]]);
    carve(rider,chalk,[[.14,1.87,s*.28,.08,.07],[.30,1.77,s*.285,.124,.083],[.56,1.58,s*.28,.093,.075],[.80,1.47,s*.25,.047,.05],[.87,1.43,s*.246,.008,.012]]);
    for(let j=0;j<3;j++)egg(rider,j===0?'#dedcc4':chalk,.56+j*.046,1.568-j*.028,s*(.305-j*.026),.24,.043,.038,-.49);
  }

  const legs=[-1,1].map(s=>{
    const upper=rod(rig,'#df9a4c',[0,0,0],[0,1,0],.048),shin=rod(rig,'#e2a051',[0,0,0],[0,1,0],.034);
    const knee=egg(rig,'#e4a257',0,0,0,.055,.055,.051),foot=group(rig);
    box(foot,ink,.05,-.034,0,.18,.046,.105);
    egg(foot,'#df8c3e',.04,.014,0,.114,.04,.064);
    for(let i=-1;i<=1;i++) egg(foot,'#e39a4c',.115,.014,i*.034,.094,.021,.033);
    return {s,upper,shin,knee,foot};
  });
  [bike,rider,headRig,crankset,...wheels,...legs.map(l=>l.foot)].forEach(bakePaintedParts);
  const hip=new T.Vector3(),joint=new T.Vector3(),ankle=new T.Vector3();
  return function pose(angle,wheelAngle,time,effort,turn) {
    wheels.forEach(w=>w.rotation.z=-wheelAngle);crankset.rotation.z=-angle;
    const bob=.018*Math.cos(2*angle);
    rider.position.y=bob;rider.rotation.z=-.043*effort+.009*Math.sin(angle*2);
    rig.rotation.x=.035*Math.sin(angle)+turn;
    headRig.rotation.z=.023*Math.sin(angle*2-.5)+.029*Math.sin(time*.91);
    for(const {s,upper,shin,knee,foot} of legs) {
      ankle.set(-.05+s*.23*Math.cos(angle),.54-s*.23*Math.sin(angle),s*.184);
      hip.set(-.43,1.56+bob,s*.17);
      const dx=ankle.x-hip.x,dy=ankle.y-hip.y,dist=Math.hypot(dx,dy);
      const thigh=.49,calf=.61,along=(thigh*thigh-calf*calf+dist*dist)/(2*dist);
      const lift=Math.sqrt(Math.max(0,thigh*thigh-along*along));
      joint.set(hip.x+(dx*along-dy*lift)/dist,hip.y+(dy*along+dx*lift)/dist,s*.21);
      fitRod(upper,hip,joint,.047);fitRod(shin,joint,ankle,.034);knee.position.copy(joint);
      foot.position.copy(ankle);foot.rotation.z=.11*s*Math.sin(angle);
    }
  };
}
