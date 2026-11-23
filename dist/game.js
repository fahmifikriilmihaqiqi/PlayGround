(()=>{
'use strict';
const canvas=document.getElementById('c'),ctx=canvas.getContext('2d');
let W,H,DPR=1;
function resize(){DPR=Math.min(devicePixelRatio||1,2);W=innerWidth;H=innerHeight;canvas.width=W*DPR;canvas.height=H*DPR;canvas.style.width=W+'px';canvas.style.height=H+'px';ctx.setTransform(DPR,0,0,DPR,0,0)}addEventListener('resize',resize);resize();
const world={w:1500,h:900};
let running=false,paused=false,won=false,last=0,time=0;
let player={x:130,y:650,r:12,a:0,concealed:false,dead:false};
let camera={x:0,y:0};
const input={x:0,y:0};
let suspicion=0,shurikens=6;
const guards=[
 {x:470,y:600,a:0,r:13,pat:[{x:470,y:600},{x:610,y:600}],pi:0,range:180,state:'patrol',alive:true},
 {x:800,y:400,a:2,r:13,pat:[{x:800,y:400},{x:800,y:270}],pi:0,range:170,state:'patrol',alive:true},
 {x:1120,y:620,a:3,r:15,pat:[{x:1120,y:620},{x:1270,y:620}],pi:0,range:190,state:'patrol',captain:true,alive:true}
];
const bushes=[{x:330,y:540,w:180,h:100},{x:690,y:230,w:170,h:90},{x:980,y:690,w:210,h:90},{x:1280,y:330,w:160,h:100},{x:900,y:500,w:130,h:70}];
const rocks=[{x:240,y:350,r:38},{x:640,y:730,r:42},{x:1380,y:720,r:55},{x:1080,y:190,r:32}];
let projectiles=[];
function inBush(p){return bushes.some(b=>p.x>b.x&&p.x<b.x+b.w&&p.y>b.y&&p.y<b.y+b.h)}
function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function lineBlocked(a,b){for(const r of rocks)if(pointSeg(r,b,a)<=r.r)return true;return false}
function pointSeg(r,a,b){const px=r.x-p1(a,b).x,py=r.y-p1(a,b).y;return px*px+py*py}
function p1(a,b){return a}
function segDistance(p,a,b){const l2=(b.x-a.x)**2+(b.y-a.y)**2;if(!l2)return dist(p,a);let t=clamp(((p.x-a.x)*(b.x-a.x)+(p.y-a.y)*(b.y-a.y))/l2,0,1);return dist(p,{x:a.x+t*(b.x-a.x),y:a.y+t*(b.y-a.y)})}
lineBlocked=(a,b)=>rocks.some(r=>segDistance(r,a,b)<r.r+4);
function hasLOS(a,b){return !lineBlocked(a,b)}
function update(dt){
 if(!running||paused)return; time+=dt;
 player.concealed=inBush(player)||player.y<230;
 let sp=(player.concealed?88:145);
 if(input.x||input.y){let m=Math.hypot(input.x,input.y)||1;player.x+=input.x/m*sp*dt;player.y+=input.y/m*sp*dt;player.a=Math.atan2(input.y,input.x)}
 player.x=clamp(player.x,35,world.w-35);player.y=clamp(player.y,210,world.h-35);
 let detected=false;
 for(const g of guards){if(!g.alive)continue;
  if(g.state==='patrol'){
   let target=g.pat[g.pi],d=dist(g,target);if(d<5)g.pi=(g.pi+1)%g.pat.length;else{let ang=Math.atan2(target.y-g.y,target.x-g.x);g.x+=Math.cos(ang)*38*dt;g.y+=Math.sin(ang)*38*dt;g.a=ang}
  }
  let d=dist(g,player),look=Math.cos(g.a),toAng=Math.atan2(player.y-g.y,player.x-g.x),vd=Math.cos(g.a-toAng);
  if(d<g.range&&vd>.25&&hasLOS(g,player)&&(!player.concealed||d<75)){detected=true;g.state='alert';suspicion=clamp(suspicion+dt*.55,0,1);g.a=toAng}else if(g.state==='alert'){
   let ang=Math.atan2(player.y-g.y,player.x-g.x);g.a=ang;g.x+=Math.cos(ang)*55*dt;g.y+=Math.sin(ang)*55*dt;
   if(d>g.range*.75) suspicion=clamp(suspicion-dt*.12,0,1);
  }
 }
 if(suspicion>=1){end(false)}
 for(let i=projectiles.length-1;i>=0;i--){let p=projectiles[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;if(p.life<0||rocks.some(r=>dist(p,r)<r.r))projectiles.splice(i,1);else for(const g of guards)if(g.alive&&dist(p,g)<g.r+8){g.alive=false;projectiles.splice(i,1);if(g.captain)document.getElementById('o2').classList.add('done');break}}
 if(player.x>1400&&player.y<500)document.getElementById('o1').classList.add('done');
 if(player.x>1430&&suspicion<.45){let captainDead=!guards[2].alive;if(captainDead)end(true)}
 // camera spring
 camera.x=clamp(player.x-W*.45,0,Math.max(0,world.w-W));camera.y=clamp(player.y-H*.5,0,Math.max(0,world.h-H));
 updateUI(detected);
}
function updateUI(detected){const al=document.getElementById('alert'),at=document.getElementById('alertText');at.textContent=detected?'Enemy spotted':(suspicion>.15?'Suspicious':(player.concealed?'Hidden':'Quiet'));al.style.opacity=.55+suspicion*.45;document.getElementById('prompt').className=player.concealed?'show':'';document.getElementById('ammo').style.filter=suspicion>.5?'saturate(1.5)':'none'}
function end(win){if(won)return;won=true;running=false;document.getElementById('end').classList.remove('hidden');document.getElementById('endType').textContent=win?'MISSION COMPLETE':'MISSION FAILED';document.getElementById('endTitle').textContent=win?'The target is fallen':'You were seen';document.getElementById('endKanji').textContent=win?'終':'敗'}
function draw(){ctx.clearRect(0,0,W,H);ctx.save();ctx.translate(-camera.x,-camera.y);
 // ground
 let grad=ctx.createLinearGradient(0,180,0,900);grad.addColorStop(0,'#5c6957');grad.addColorStop(.5,'#75806b');grad.addColorStop(1,'#4d5d50');ctx.fillStyle=grad;ctx.fillRect(0,180,world.w,720);
 // subtle tile / water
 ctx.globalAlpha=.16;ctx.strokeStyle='#bec1a6';ctx.lineWidth=1;for(let x=0;x<1500;x+=80){ctx.beginPath();ctx.moveTo(x,180);ctx.lineTo(x,900);ctx.stroke()}for(let y=200;y<900;y+=80){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(1500,y);ctx.stroke()}ctx.globalAlpha=1;
 // background palace
 ctx.fillStyle='#242e28';ctx.fillRect(0,0,1500,220);ctx.fillStyle='#35382d';ctx.fillRect(0,170,1500,52);ctx.fillStyle='#151d19';ctx.fillRect(80,115,1340,55);
 ctx.fillStyle='#7e8067';for(let x=120;x<1420;x+=95){ctx.fillRect(x,0,18,170)}ctx.fillStyle='#171f1b';for(let x=110;x<1430;x+=95){ctx.beginPath();ctx.moveTo(x-18,115);ctx.lineTo(x+9,70);ctx.lineTo(x+36,115);ctx.fill()}
 // moonlit roof
 ctx.fillStyle='#27342e';ctx.fillRect(0,0,1500,64);ctx.fillStyle='#65705e';ctx.fillRect(0,64,1500,6);
 // path
 ctx.fillStyle='#9a987d';ctx.beginPath();ctx.moveTo(0,620);ctx.quadraticCurveTo(500,520,820,590);ctx.quadraticCurveTo(1130,650,1500,520);ctx.lineTo(1500,780);ctx.quadraticCurveTo(1150,700,820,650);ctx.quadraticCurveTo(430,580,0,700);ctx.closePath();ctx.fill();ctx.globalAlpha=.12;ctx.strokeStyle='#313a32';for(let i=0;i<18;i++){ctx.beginPath();ctx.moveTo(i*95,560);ctx.lineTo(i*95+180,780);ctx.stroke()}ctx.globalAlpha=1;
 // inner gate
 ctx.fillStyle='#191f1c';ctx.fillRect(1380,330,120,190);ctx.fillStyle='#7a2d25';ctx.fillRect(1395,350,90,150);ctx.fillStyle='#b08a55';ctx.fillRect(1395,350,10,150);ctx.fillRect(1475,350,10,150);
 // rocks
 for(const r of rocks){ctx.fillStyle='#384238';ctx.beginPath();ctx.ellipse(r.x,r.y,r.r,r.r*.7,0,0,7);ctx.fill();ctx.fillStyle='rgba(170,176,145,.12)';ctx.beginPath();ctx.ellipse(r.x-r.r*.2,r.y-r.r*.2,r.r*.65,r.r*.25,-.4,0,7);ctx.fill()}
 // bushes
 for(const b of bushes){ctx.fillStyle='#203a29';ctx.fillRect(b.x,b.y,b.w,b.h);for(let x=b.x;x<b.x+b.w;x+=28)for(let y=b.y;y<b.y+b.h;y+=25){ctx.fillStyle=(x+y)%3?'#2e5035':'#365840';ctx.beginPath();ctx.arc(x,y,22,0,7);ctx.fill()}}
 // projectiles
 for(const p of projectiles){ctx.fillStyle='#ddd8ac';ctx.beginPath();ctx.moveTo(p.x,p.y-6);ctx.lineTo(p.x+6,p.y);ctx.lineTo(p.x,p.y+6);ctx.lineTo(p.x-6,p.y);ctx.fill()}
 // guards
 for(const g of guards)if(g.alive)drawPerson(g,true);
 drawPerson(player,false);
 // shadows
 ctx.restore();
 if(running)requestAnimationFrame(loop);
}
function drawPerson(p,isGuard){ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.a);ctx.fillStyle='rgba(0,0,0,.35)';ctx.beginPath();ctx.ellipse(-3,11,18,8,0,0,7);ctx.fill();ctx.fillStyle=isGuard?(p.captain?'#5b2d29':'#343a31'):'#1b2421';ctx.beginPath();ctx.arc(0,0,p.r,0,7);ctx.fill();ctx.fillStyle=isGuard?'#9d8f69':'#737d69';ctx.beginPath();ctx.ellipse(-2,-3,p.r*.75,p.r*.55,-.2,0,7);ctx.fill();ctx.strokeStyle=isGuard?'#b7ad86':'#c3b88e';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(4,2);ctx.lineTo(p.r+10,2);ctx.stroke();ctx.restore();if(isGuard){ctx.save();ctx.fillStyle='rgba(210,196,125,.12)';ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+Math.cos(p.a-.28)*p.range,p.y+Math.sin(p.a-.28)*p.range);ctx.arc(p.x,p.y,p.range,p.a-.28,p.a+.28);ctx.closePath();ctx.fill();ctx.restore()}}
function loop(t){let dt=Math.min(.033,(t-last)/1000||0);last=t;update(dt);draw()}

// controls
const joy=document.getElementById('joystick'),stick=document.getElementById('stick');let joyId=null;
function joyMove(e){let touch=[...e.changedTouches].find(t=>t.identifier===joyId)||e.changedTouches[0];if(!touch)return;let b=joy.getBoundingClientRect();let cx=b.left+b.width/2,cy=b.top+b.height/2;let dx=touch.clientX-cx,dy=touch.clientY-cy,l=Math.hypot(dx,dy),m=Math.min(34,l||1);input.x=dx/l*m/34||0;input.y=dy/l*m/34||0;stick.style.transform=`translate(${input.x*34}px,${input.y*34}px)`}
joy.addEventListener('touchstart',e=>{e.preventDefault();joyId=e.changedTouches[0].identifier;joyMove(e)},{passive:false});joy.addEventListener('touchmove',e=>{e.preventDefault();joyMove(e)},{passive:false});joy.addEventListener('touchend',()=>{joyId=null;input.x=input.y=0;stick.style.transform=''});
addEventListener('keydown',e=>{if(e.key==='w'||e.key==='ArrowUp')input.y=-1;if(e.key==='s'||e.key==='ArrowDown')input.y=1;if(e.key==='a'||e.key==='ArrowLeft')input.x=-1;if(e.key==='d'||e.key==='ArrowRight')input.x=1;if(e.key===' ')conceal()});addEventListener('keyup',e=>{if(['w','s','ArrowUp','ArrowDown'].includes(e.key))input.y=0;if(['a','d','ArrowLeft','ArrowRight'].includes(e.key))input.x=0});
function conceal(){player.concealed=inBush(player)||player.y<230;document.getElementById('prompt').className=player.concealed?'show':''}
document.getElementById('actionBtn').addEventListener('pointerdown',conceal);document.getElementById('throwBtn').addEventListener('pointerdown',throwKnife);
function throwKnife(){if(!running||shurikens<=0)return;shurikens--;document.getElementById('shurikenCount').textContent=shurikens;let ang=player.a||0;projectiles.push({x:player.x+Math.cos(ang)*20,y:player.y+Math.sin(ang)*20,vx:Math.cos(ang)*420,vy:Math.sin(ang)*420,life:1.2})}
function reset(){player={x:130,y:650,r:12,a:0,concealed:false,dead:false};guards.forEach((g,i)=>{g.alive=true;g.state='patrol';g.x=g.pat[0].x;g.y=g.pat[0].y});shurikens=6;document.getElementById('shurikenCount').textContent='6';suspicion=0;projectiles=[];won=false;paused=false;document.querySelectorAll('.objective div').forEach(x=>x.classList.remove('done'));camera={x:0,y:0}}
function start(){reset();document.getElementById('start').classList.add('hidden');document.getElementById('pause').classList.add('hidden');document.getElementById('end').classList.add('hidden');running=true;last=performance.now();requestAnimationFrame(loop)}
document.getElementById('startBtn').onclick=start;document.getElementById('againBtn').onclick=start;document.getElementById('restartBtn').onclick=start;
document.getElementById('pauseBtn').onclick=()=>{if(!running)return;paused=!paused;document.getElementById('pause').classList.toggle('hidden',!paused)};document.getElementById('resumeBtn').onclick=()=>{paused=false;document.getElementById('pause').classList.add('hidden');last=performance.now()};
draw();
})();
