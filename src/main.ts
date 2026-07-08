import './styles.css';
import { Simulation } from './engine/simulation';
import { Renderer } from './render/renderer';
import type { ViewMode } from './world/types';

const app=document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML=`
<div class="shell">
  <canvas id="world"></canvas>
  <div class="topbar">
    <section class="brand"><h1>The Living Planet</h1><p>A digital nature documentary in progress.</p></section>
    <section class="metrics" id="metrics"></section>
  </div>
  <div class="viewbar" id="viewbar">
    <button data-view="natural" class="active">Natural</button><button data-view="moisture">Moisture</button><button data-view="soil">Soil</button><button data-view="pressure">Pressure</button>
  </div>
  <section class="naturalist"><h2>Naturalist</h2><div class="note" id="note"></div></section>
  <section class="interventions"><h2>Interventions</h2><div class="buttons">
    <button data-act="rain">Rainstorm</button><button data-act="drought">Drought</button><button data-act="forest">Plant forest</button><button data-act="herd">Release herd</button><button data-act="wolves">Introduce predators</button><button data-act="fungi">Fungal bloom</button>
  </div></section>
  <div class="help">Space pause · O observe/manual camera · mouse wheel zoom</div>
</div>`;

const canvas=document.querySelector<HTMLCanvasElement>('#world')!;
const sim=new Simulation(4319);
const renderer=new Renderer(canvas);
let paused=false, last=0, acc=0;
function drawMetrics(){ const c=sim.counts(); document.querySelector('#metrics')!.innerHTML=`
  <div class="metric"><span>Day</span><strong>${sim.state.day}</strong></div><div class="metric"><span>Plants</span><strong>${c.plant}</strong></div><div class="metric"><span>Grazers</span><strong>${c.grazer}</strong></div>
  <div class="metric"><span>Predators</span><strong>${c.predator}</strong></div><div class="metric"><span>Scavengers</span><strong>${c.scavenger}</strong></div><div class="metric"><span>Fungi</span><strong>${c.fungi}</strong></div>`;
  const n=sim.state.notes[0]; document.querySelector('#note')!.innerHTML = n ? `${n.text}<small>Day ${n.day}</small>` : 'The planet is quiet.';
}
function frame(t:number){ const dt=t-last; last=t; acc+=dt; if(!paused){ while(acc>55){ sim.step(); acc-=55; } } renderer.render(sim.state); drawMetrics(); requestAnimationFrame(frame); }
requestAnimationFrame(frame);

document.querySelectorAll<HTMLButtonElement>('[data-act]').forEach(b=>b.onclick=()=>sim.intervene(b.dataset.act!));
document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(b=>b.onclick=()=>{ document.querySelectorAll('.viewbar button').forEach(x=>x.classList.remove('active')); b.classList.add('active'); renderer.view=b.dataset.view as ViewMode; });
addEventListener('keydown',e=>{ if(e.code==='Space') paused=!paused; if(e.key.toLowerCase()==='o') renderer.auto=!renderer.auto; });
addEventListener('wheel',e=>{ renderer.camera.zoom=Math.max(3,Math.min(18,renderer.camera.zoom + (e.deltaY<0?1:-1))); },{passive:true});
let drag=false, lx=0, ly=0;
canvas.addEventListener('pointerdown',e=>{ drag=true; lx=e.clientX; ly=e.clientY; renderer.auto=false; });
canvas.addEventListener('pointerup',()=>drag=false);
canvas.addEventListener('pointermove',e=>{ if(!drag) return; renderer.camera.x-=(e.clientX-lx)/renderer.camera.zoom; renderer.camera.y-=(e.clientY-ly)/renderer.camera.zoom; lx=e.clientX; ly=e.clientY; });
