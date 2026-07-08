import type { PlanetState, ViewMode } from '../world/types';

const biomeColors:Record<string,string>={ ocean:'#163d58', shore:'#887656', grass:'#395d35', forest:'#244b30', rock:'#555a5a', snow:'#c7d3d2' };
const speciesColors:Record<string,string[]>={
  plant:['#66a95e'], fungi:['#a06bd6'], carrion:['#7b5a3d'],
  grazer:['#e0d37b','#d4c46c','#c9b65b','#b9d080','#e8d998','#cddc88'],
  predator:['#df6b55','#c65346','#e38659','#b9483d','#f08b6c','#d0574a'],
  scavenger:['#d7d0c0','#c9bda8','#b9c8d5','#eee4c6','#bcb3a1','#d4cbb8']
};
export class Renderer {
  private ctx:CanvasRenderingContext2D; private dpr=1; camera={x:90,y:55,zoom:7}; auto=true; view:ViewMode='natural';
  constructor(private canvas:HTMLCanvasElement){ const ctx=canvas.getContext('2d'); if(!ctx) throw new Error('Canvas unsupported'); this.ctx=ctx; this.resize(); addEventListener('resize',()=>this.resize()); }
  resize(){ this.dpr=devicePixelRatio||1; this.canvas.width=innerWidth*this.dpr; this.canvas.height=innerHeight*this.dpr; this.ctx.setTransform(this.dpr,0,0,this.dpr,0,0); }
  screen(x:number,y:number){ return {x:(x-this.camera.x)*this.camera.zoom+innerWidth/2,y:(y-this.camera.y)*this.camera.zoom+innerHeight/2}; }
  tickCamera(state:PlanetState){ if(!this.auto) return; const interesting=state.entities.find(e=>e.species==='predator') || state.entities[0]; if(!interesting) return; this.camera.x += (interesting.x-this.camera.x)*.002; this.camera.y += (interesting.y-this.camera.y)*.002; }
  render(state:PlanetState){
    this.tickCamera(state); const ctx=this.ctx; ctx.clearRect(0,0,innerWidth,innerHeight); ctx.fillStyle='#07100f'; ctx.fillRect(0,0,innerWidth,innerHeight);
    const z=this.camera.zoom, size=Math.max(1,z+0.8);
    for(let y=0;y<110;y++) for(let x=0;x<180;x++){
      const t=state.tiles[x+y*180]; const p=this.screen(x,y); if(p.x<-size||p.y<-size||p.x>innerWidth+size||p.y>innerHeight+size) continue;
      let col=biomeColors[t.biome];
      if(this.view==='moisture') col=`rgb(${20+t.moisture*40},${45+t.moisture*70},${65+t.moisture*135})`;
      if(this.view==='soil') col=`rgb(${45+t.fertility*90},${38+t.fertility*95},${25+t.fertility*35})`;
      if(this.view==='pressure') col=`rgb(${40+t.pressure*160},${50-t.pressure*20},${42-t.pressure*10})`;
      ctx.fillStyle=col; ctx.fillRect(p.x,p.y,size,size);
    }
    // soft life density underlay
    ctx.globalAlpha=.25;
    for(const e of state.entities){ if(e.species!=='plant' && e.species!=='fungi') continue; const p=this.screen(e.x,e.y); if(p.x<0||p.y<0||p.x>innerWidth||p.y>innerHeight) continue; ctx.fillStyle=e.species==='plant'?'#75b76c':'#9d69ce'; ctx.beginPath(); ctx.arc(p.x,p.y,Math.max(1.6,z*.45),0,Math.PI*2); ctx.fill(); }
    ctx.globalAlpha=1;
    for(const e of state.entities){ if(e.species==='plant'||e.species==='fungi') continue; const p=this.screen(e.x,e.y); if(p.x<-20||p.y<-20||p.x>innerWidth+20||p.y>innerHeight+20) continue; const color=(speciesColors[e.species]||['white'])[e.breed%6]; ctx.fillStyle=color; ctx.strokeStyle='rgba(0,0,0,.45)'; ctx.lineWidth=1.5;
      ctx.beginPath(); const r=e.species==='predator'?Math.max(3,z*.55):e.species==='grazer'?Math.max(2.5,z*.45):Math.max(2,z*.36);
      if(e.species==='predator'){ ctx.moveTo(p.x,p.y-r); ctx.lineTo(p.x+r*.9,p.y+r*.8); ctx.lineTo(p.x-r*.9,p.y+r*.8); ctx.closePath(); }
      else if(e.species==='scavenger'){ ctx.rect(p.x-r,p.y-r,r*2,r*2); }
      else { ctx.ellipse(p.x,p.y,r*1.35,r,0,0,Math.PI*2); }
      ctx.fill(); ctx.stroke();
    }
    ctx.fillStyle='rgba(255,255,255,.08)'; ctx.fillRect(0,0,innerWidth,innerHeight);
  }
}
