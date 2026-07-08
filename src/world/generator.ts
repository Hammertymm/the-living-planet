import { RNG } from './random';
import type { Biome, Tile } from './types';

function smoothNoise(x:number,y:number,rng:RNG){
  const n = Math.sin(x*12.9898 + y*78.233 + rng.next()*1000) * 43758.5453;
  return n - Math.floor(n);
}
function layered(x:number,y:number,rng:RNG){
  let v=0, amp=1, scale=1;
  for(let i=0;i<5;i++){ v += smoothNoise(x*scale,y*scale,rng)*amp; amp*=.5; scale*=2.1; }
  return v/1.9375;
}
export function generateTiles(w:number,h:number,seed:number): Tile[] {
  const rng = new RNG(seed);
  const tiles:Tile[]=[];
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){
    const nx=x/w-.5, ny=y/h-.5;
    const dist=Math.sqrt(nx*nx+ny*ny);
    const continental=1-dist*1.55;
    const noise=layered(x/w*3.2,y/h*3.2,rng);
    const elevation=Math.max(0, Math.min(1, continental*.72 + noise*.56));
    const moisture=Math.max(0, Math.min(1, layered(x/w*5.1+10,y/h*5.1+5,rng)*.72 + (1-elevation)*.25));
    const heat=Math.max(0, Math.min(1, 1 - y/h + rng.range(-.04,.04)));
    const fertility=Math.max(0, Math.min(1, moisture*.55 + (1-Math.abs(elevation-.48))*0.45));
    let biome:Biome='grass';
    if(elevation<.31) biome='ocean';
    else if(elevation<.36) biome='shore';
    else if(elevation>.78 && heat<.45) biome='snow';
    else if(elevation>.70) biome='rock';
    else if(moisture>.58 && fertility>.52) biome='forest';
    tiles.push({elevation,moisture,fertility,heat,biome,pressure:0,trail:0,burn:0});
  }
  return tiles;
}
