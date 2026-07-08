import { RNG } from '../world/random';
import { generateTiles } from '../world/generator';
import type { Entity, Note, PlanetState, Species, Tile } from '../world/types';

const W=180, H=110;
let nextId=1;
const names = ['northern valley','western basin','central grasslands','eastern wetlands','southern ridge','coastal flats'];

function idx(x:number,y:number){ return Math.max(0,Math.min(W-1,Math.floor(x))) + Math.max(0,Math.min(H-1,Math.floor(y))) * W; }
function dist(a:Entity,b:Entity){ const dx=a.x-b.x, dy=a.y-b.y; return Math.sqrt(dx*dx+dy*dy); }
function entity(species:Species,x:number,y:number,rng:RNG):Entity{
  return { id: nextId++, species, x, y, vx:rng.range(-.25,.25), vy:rng.range(-.25,.25), energy: species==='predator'?90: species==='grazer'?70:40, age:0, breed:rng.int(0,5), cooldown:0 };
}
function isLand(t:Tile){ return t.biome!=='ocean' && t.biome!=='rock' && t.biome!=='snow'; }

export class Simulation {
  readonly width=W; readonly height=H; state:PlanetState; rng:RNG;
  constructor(seed=Date.now()%999999){ this.rng=new RNG(seed); this.state={day:0,tiles:generateTiles(W,H,seed),entities:[],notes:[],season:0,seed}; this.seedLife(); this.note('A young planet settles into motion. Wind, water, plants and hunger begin their quiet negotiations.'); }
  private landPoint(){ for(let i=0;i<500;i++){ const x=this.rng.int(5,W-6), y=this.rng.int(5,H-6); if(isLand(this.state.tiles[idx(x,y)])) return {x,y}; } return {x:W/2,y:H/2}; }
  seedLife(){
    for(let i=0;i<900;i++){ const p=this.landPoint(); this.state.entities.push(entity('plant',p.x,p.y,this.rng)); }
    for(let i=0;i<75;i++){ const p=this.landPoint(); this.state.entities.push(entity('grazer',p.x,p.y,this.rng)); }
    for(let i=0;i<14;i++){ const p=this.landPoint(); this.state.entities.push(entity('predator',p.x,p.y,this.rng)); }
    for(let i=0;i<20;i++){ const p=this.landPoint(); this.state.entities.push(entity('scavenger',p.x,p.y,this.rng)); }
    for(let i=0;i<90;i++){ const p=this.landPoint(); this.state.entities.push(entity('fungi',p.x,p.y,this.rng)); }
  }
  counts(){ const c:Record<Species,number>={plant:0,grazer:0,predator:0,scavenger:0,fungi:0,carrion:0}; for(const e of this.state.entities)c[e.species]++; return c; }
  note(text:string){ this.state.notes.unshift({day:this.state.day,text}); this.state.notes=this.state.notes.slice(0,8); }
  intervene(kind:string){
    if(kind==='rain'){ for(const t of this.state.tiles){t.moisture=Math.min(1,t.moisture+.18);t.fertility=Math.min(1,t.fertility+.04);} this.note('Rain crosses the planet. Rivers swell and young vegetation brightens along the lowlands.'); }
    if(kind==='drought'){ for(const t of this.state.tiles){t.moisture=Math.max(0,t.moisture-.22);} this.note('A dry season hardens the grasslands. Herds begin to gather near reliable water.'); }
    if(kind==='forest'){ for(let i=0;i<260;i++){ const p=this.landPoint(); this.state.entities.push(entity('plant',p.x,p.y,this.rng)); } this.note('New growth spreads across disturbed ground, creating cover for smaller creatures.'); }
    if(kind==='herd'){ for(let i=0;i<35;i++){ const p=this.landPoint(); this.state.entities.push(entity('grazer',p.x,p.y,this.rng)); } this.note('A migrating herd enters the visible world, testing the balance of the grasslands.'); }
    if(kind==='wolves'){ for(let i=0;i<6;i++){ const p=this.landPoint(); this.state.entities.push(entity('predator',p.x,p.y,this.rng)); } this.note('A small predator lineage appears near the forest edge. Its success is not guaranteed.'); }
    if(kind==='fungi'){ for(let i=0;i<120;i++){ const p=this.landPoint(); this.state.entities.push(entity('fungi',p.x,p.y,this.rng)); } this.note('Fungal threads bloom beneath the surface, preparing dead matter for return to the soil.'); }
  }
  step(){
    this.state.day++; this.state.season=(this.state.day%360)/360;
    for(const t of this.state.tiles){ t.pressure*=.96; const seasonal=Math.sin(this.state.season*Math.PI*2); t.moisture=Math.max(0,Math.min(1,t.moisture + seasonal*.0008 - .0003)); t.fertility=Math.max(0,Math.min(1,t.fertility + .0002)); }
    const ents=this.state.entities;
    for(const e of ents){
      e.age++; e.cooldown=Math.max(0,e.cooldown-1);
      const t=this.state.tiles[idx(e.x,e.y)];
      if(e.species==='plant'){
        e.energy += t.moisture*.035 + t.fertility*.025 - .018;
        if(e.energy>75 && ents.length<2200 && this.rng.next()<.015){ const nx=e.x+this.rng.range(-3,3), ny=e.y+this.rng.range(-3,3); if(isLand(this.state.tiles[idx(nx,ny)])){ ents.push(entity('plant',nx,ny,this.rng)); e.energy*=.64; t.fertility*=.996; } }
      } else if(e.species==='fungi'){
        e.energy-=.015; const carr=ents.find(o=>o.species==='carrion' && dist(e,o)<3); if(carr){ e.energy+=.7; carr.energy-=.9; t.fertility=Math.min(1,t.fertility+.006); }
        if(e.energy>60 && ents.length<2200 && this.rng.next()<.006){ const nx=e.x+this.rng.range(-2,2), ny=e.y+this.rng.range(-2,2); ents.push(entity('fungi',nx,ny,this.rng)); e.energy*=.72; }
      } else if(e.species==='carrion'){
        e.energy-=.22; t.fertility=Math.min(1,t.fertility+.0015);
      } else {
        const speed=e.species==='predator'?.34:e.species==='scavenger'?.28:.25;
        let target:Entity|undefined;
        if(e.species==='grazer') target=ents.find(o=>o.species==='plant' && dist(e,o)<6);
        if(e.species==='predator') target=ents.find(o=>o.species==='grazer' && dist(e,o)<9);
        if(e.species==='scavenger') target=ents.find(o=>o.species==='carrion' && dist(e,o)<10);
        if(target){ const dx=target.x-e.x, dy=target.y-e.y, d=Math.max(.01,Math.sqrt(dx*dx+dy*dy)); e.vx+=dx/d*.05; e.vy+=dy/d*.05; if(d<1.2 && e.cooldown===0){ if(e.species==='predator') t.pressure=Math.min(1,t.pressure+.25); e.energy+= target.species==='grazer'?28:12; target.energy-=999; e.cooldown=e.species==='predator'?46:18; } }
        else { e.vx+=this.rng.range(-.035,.035); e.vy+=this.rng.range(-.035,.035); }
        e.energy-= e.species==='predator'?.12:e.species==='grazer'?.075:.06;
        const v=Math.sqrt(e.vx*e.vx+e.vy*e.vy); if(v>speed){e.vx=e.vx/v*speed;e.vy=e.vy/v*speed;}
        e.x+=e.vx; e.y+=e.vy;
        if(!isLand(this.state.tiles[idx(e.x,e.y)])){ e.vx*=-1.2; e.vy*=-1.2; e.x+=e.vx*2; e.y+=e.vy*2; e.energy-=.35; }
        e.x=Math.max(1,Math.min(W-2,e.x)); e.y=Math.max(1,Math.min(H-2,e.y));
        const repro = e.species==='predator'?180:e.species==='scavenger'?120:95;
        if(e.energy>repro && e.cooldown===0 && ents.length<2200){ ents.push(entity(e.species,e.x+this.rng.range(-1,1),e.y+this.rng.range(-1,1),this.rng)); e.energy*=.52; e.cooldown=120; }
      }
    }
    const survivors:Entity[]=[];
    for(const e of ents){ if(e.energy>0 && e.age<2800) survivors.push(e); else if(e.species!=='plant' && e.species!=='carrion') survivors.push(entity('carrion',e.x,e.y,this.rng)); }
    this.state.entities=survivors.slice(0,2400);
    if(this.state.day%90===0){ const c=this.counts(); if(c.grazer<18 && c.plant>250){ for(let i=0;i<18;i++){ const p=this.landPoint(); this.state.entities.push(entity('grazer',p.x,p.y,this.rng)); } this.note('A small grazing population recovers in the sheltered grasslands.'); }
      if(c.plant<180){ for(let i=0;i<300;i++){ const p=this.landPoint(); this.state.entities.push(entity('plant',p.x,p.y,this.rng)); } this.note('After a sparse season, plant life returns in scattered green islands.'); }
      if(c.predator<3 && c.grazer>60){ for(let i=0;i<4;i++){ const p=this.landPoint(); this.state.entities.push(entity('predator',p.x,p.y,this.rng)); } this.note('Predators reappear at low numbers, following the scent of recovering herds.'); }
    }
    if(this.state.day%160===0){ const c=this.counts(); const place=this.rng.pick(names); if(c.predator>25) this.note(`Hunting pressure rises across the ${place}. Grazers are beginning to favour thicker cover.`); else if(c.grazer>120) this.note(`The ${place} supports a broad grazing population. Their movement is carving temporary paths through young growth.`); else if(c.fungi>180) this.note(`A fungal network is quietly repairing the ${place}, returning old bodies and fallen plants to the soil.`); else this.note(`The planet remains balanced for now: not still, but not yet in crisis.`); }
  }
}
