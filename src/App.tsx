import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, PointerEvent } from 'react';
import './App.css';

type P = { x: number; y: number };
type View = P & { zoom: number };
type Size = 'Island' | 'Small' | 'Medium' | 'Large';
type Tool = 'explore' | 'land' | 'drawland' | 'district' | 'biome' | 'feature' | 'river' | 'pond' | 'label' | 'depth';
type Land = { id: string; name: string; x: number; y: number; size?: Size; latitude: number; biome: string; biomeBase?: string; magical: boolean; description: string; outline?: P[]; elevation?: number };
type District = { id: string; landId: string; name: string; x: number; y: number; radius?: number; biomeId?:string; description?:string; image?:string };
type Plant = { id: string; landId: string; name: string; habitat: string; description: string; termId?: string; image?: string; biomeId?:string };
type Biome = { id: string; landId: string; x: number; y: number; radius: number; kind: string; name: string; magical: boolean; realm?: 'terrestrial' | 'aquatic'; districtId?: string; salinity?: string; depth?: string; depthMeters?:number; landKind?:string; aquaticKind?:string; waterId?:string };
type Feature = { id: string; landId: string; x: number; y: number; kind: string; depthMeters?:number };
type Water = { id: string; landId: string; kind: 'river' | 'pond'; name: string; points: P[]; width?: number; depthMeters?:number };
type MapLabel = { id: string; landId: string; x: number; y: number; name: string };
type Creature = { id:string; landId:string; districtId?:string; biomeId?:string; name:string; group:string; description:string; habitat:string; image?:string };
type Relation = { id:string; landId:string; sourceId:string; targetId:string; kind:string; description:string };
type DepthPatch = { id:string; x:number; y:number; radius:number; depthMeters:number; name:string; seed?:string }; // signed meters: positive = terrain raised, negative = terrain lowered
type Climate = { rainfall:number; elevation:number; temperature:number; salinity:string; depth:string; currents:string };
type Atlas = { lands: Land[]; districts: District[]; plants: Plant[]; biomes: Biome[]; features: Feature[]; waters: Water[]; labels: MapLabel[]; occurrences: { districtId: string; plantId: string }[]; creatures:Creature[]; relations:Relation[]; climates:Record<string,Climate>; depthPatches?:DepthPatch[] }; 
type Term = { id: string; name: string; description: string; builtin?: boolean; kind?: 'real' | 'magical'; sourceUrl?: string };
type JournalNote = { id: string; title: string; text: string; image?: string; created: string };
type BookPage = 'dictionary' | 'research' | 'notes' | 'lands' | 'plants' | 'creatures' | 'districts' | 'landscapes' | 'waters' | 'labels';
// Curated real-world vocabulary; an educational starter reference, not a complete taxonomy.
const STANDARD_TERMS: Term[] = [
  ['Plantae','Plants: multicellular photosynthetic eukaryotes, including land plants and many green algae.'],
  ['Angiosperm','Flowering plants whose seeds develop within fruits.'],
  ['Gymnosperm','Seed plants with unenclosed seeds, including conifers, cycads and ginkgo.'],
  ['Fern','Vascular plants reproducing by spores rather than seeds.'],
  ['Lycophyte','An ancient vascular plant lineage including clubmosses and spikemosses.'],
  ['Bryophyte','Non-vascular land plants: mosses, liverworts and hornworts.'],
  ['Moss','Small non-vascular land plants of the bryophyte lineage.'],
  ['Liverwort','Non-vascular plants, often leafy or flattened in form.'],
  ['Hornwort','Non-vascular plants with elongated hornlike sporophytes.'],
  ['Monocot','Flowering-plant lineage including grasses, orchids and palms.'],
  ['Eudicot','Large flowering-plant lineage commonly with two seed leaves and netted veins.'],
  ['Tree','A woody growth form; not a single botanical taxonomic group.'],
  ['Shrub','A usually multi-stemmed woody growth form; not a taxonomic group.'],
  ['Herbaceous plant','A plant without persistent woody aboveground stems.'],
  ['Vine','A climbing or trailing growth form found in many plant groups.'],
  ['Succulent','A water-storing plant adaptation, shared across many families.'],
  ['Cactus','A member of the flowering-plant family Cactaceae.'],
  ['Epiphyte','An organism growing on another plant without parasitizing it.'],
  ['Carnivorous plant','A plant that captures animal prey to obtain additional nutrients.'],
  ['Aquatic plant','A plant adapted to growing submerged or floating in water.'],
  ['Fungi','A kingdom of absorptive heterotrophs including mushrooms, molds and yeasts.'],
  ['Basidiomycete','Fungal lineage including many mushrooms, puffballs and rusts.'],
  ['Ascomycete','Fungal lineage including morels, truffles, many molds and yeasts.'],
  ['Mushroom','The conspicuous fruiting body of some fungi, not a taxonomic group.'],
  ['Mold','Filamentous fungal growth form; not a formal taxon.'],
  ['Yeast','Typically single-celled fungal growth form; not a single taxon.'],
  ['Lichen','A symbiotic association, usually between a fungus and photosynthetic partners.'],
  ['Algae','Informal group of photosynthetic organisms across several evolutionary lineages.'],
  ['Green algae','Photosynthetic eukaryotes in green plant lineages, including ancestors of land plants.'],
  ['Red algae','Mostly aquatic photosynthetic eukaryotes in Rhodophyta.'],
  ['Brown algae','Marine stramenopiles including kelps; not true plants.'],
  ['Oomycete','Fungus-like stramenopiles including water molds, distinct from true fungi.'],
  ['Cyanobacteria','Photosynthetic bacteria, sometimes informally called blue-green algae.'],
  ['Bacteria','Diverse prokaryotic microorganisms; a major domain of life.'],
  ['Archaea','A domain of prokaryotes distinct from bacteria.'],
  ['Animalia','Multicellular animals, including insects, fish, birds and mammals.'],
  ['Taxonomy','The study and classification of organisms.'],['Species','A fundamental taxonomic rank; species concepts vary among organism groups.'],['Genus','Taxonomic rank above species and below family.'],['Family','Taxonomic rank above genus and below order.'],['Order','Taxonomic rank above family and below class.'],['Class','Taxonomic rank above order and below phylum or division.'],['Phylum','Major taxonomic rank below kingdom.'],['Kingdom','Broad taxonomic rank grouping related organisms.'],['Hybrid','Offspring or lineage resulting from crosses between genetically distinct parents.'],['Cultivar','A cultivated plant variety selected and maintained for particular traits.'],['Rhizome','Horizontal or modified underground stem capable of growth and storage.'],['Stolon','A horizontal stem forming new plants at nodes.'],['Tuber','Swollen storage organ, often a stem or root.'],['Bulb','Short underground stem surrounded by fleshy storage leaves.'],['Inflorescence','The arrangement of flowers on a flowering axis.'],['Spore','Reproductive unit that can develop without fusion with another cell in many organisms.'],['Sporangium','Structure producing and containing spores.'],['Mycelium','Network of fungal hyphae.'],['Hypha','Filament forming the body of many fungi.'],['Saprotroph','Organism obtaining nutrients from dead organic matter.'],['Mycorrhiza','Symbiotic association between certain fungi and plant roots.'],['Mutualism','Ecological interaction benefiting both participating organisms.'],['Commensalism','Interaction benefiting one participant without substantial effect on the other.'],['Parasitism','Relationship in which one organism benefits at the expense of its host.'],['Predation','Consumption of another organism by a predator.'],['Herbivory','Consumption of plants or algae by animals.'],['Pollination','Transfer of pollen to enable fertilization in seed plants.'],['Seed dispersal','Movement of seeds away from parent plants.'],['Competition','Interaction among organisms using limiting shared resources.'],['Decomposer','Organism helping break down dead matter.'],['Detritivore','Animal feeding on dead organic particles.'],['Food web','Network of feeding relationships in an ecosystem.'],['Habitat','Environment where an organism lives.'],['Niche','Ecological role and resource use of a species.'],['Biome','Broad ecosystem type distinguished by climate and characteristic communities.'],['Ecoregion','Geographical area of relatively distinct assemblages and conditions.'],['Riparian zone','Habitat along rivers and streams.'],['Estuary','Coastal area where river water mixes with seawater.'],['Intertidal zone','Shoreline band alternately exposed and submerged by tides.'],['Neritic zone','Shallow ocean over continental shelves.'],['Pelagic zone','Open water away from the bottom.'],['Benthic zone','Ecological zone at the bottom of a waterbody.'],['Abyssal zone','Very deep ocean environment, generally around 4,000–6,000 meters.'],['Coral reef','Marine habitat built by corals and other calcifying organisms.'],['Kelp forest','Coastal underwater ecosystem dominated by large brown algae.'],['Seagrass meadow','Shallow marine habitat dominated by flowering seagrasses.'],['Salt marsh','Coastal wetland dominated by salt-tolerant herbaceous plants.'],['Freshwater marsh','Wetland with predominantly herbaceous vegetation in fresh water.'],['Bog','Acidic nutrient-poor wetland receiving most of its water from precipitation.'],['Fen','Mineral-rich wetland fed by groundwater or surface water.'],['Halophyte','Plant adapted to saline environments.'],['Xerophyte','Plant adapted to dry environments.'],['Hydrophyte','Plant adapted to living in water or saturated soil.'],['Lithophyte','Organism that grows on rock surfaces.'],['Bivalve','Mollusk group with paired shells, including clams and mussels.'],['Crustacean','Arthropod group including crabs, shrimp and copepods.'],['Insect','Six-legged arthropod within the class Insecta.'],['Arachnid','Arthropod group including spiders and scorpions.'],['Cnidarian','Animal phylum containing corals, jellyfish and sea anemones.'],['Cephalopod','Mollusk group including octopuses, squid and nautiluses.'],['Zooplankton','Drifting aquatic animals and animal-like organisms.'],['Phytoplankton','Drifting photosynthetic aquatic organisms.'],['Brackish water','Water with salinity between typical freshwater and seawater.'],['Thermocline','Layer where water temperature changes sharply with depth.'],['Upwelling','Movement of deeper nutrient-rich water toward the surface.'],['Ocean current','Persistent movement of ocean water influenced by wind, density and rotation.'],
].map(([name,description]) => ({id:`real-${name.toLowerCase().replace(/[^a-z]+/g,'-')}`,name,description,builtin:true}));
const BOOK_PAGES: {key:BookPage;title:string}[] = [
  {key:'dictionary',title:'Dictionary'}, {key:'research',title:'Botanical Research'}, {key:'notes',title:'Personal Notes'},
  {key:'lands',title:'Saved Lands'}, {key:'plants',title:'Saved Flora & Fungi'}, {key:'creatures',title:'Saved Wildlife'},
  {key:'districts',title:'Saved Districts'}, {key:'landscapes',title:'Saved Landscapes'},
  {key:'waters',title:'Saved Waters'}, {key:'labels',title:'Saved Labels'}
];
const BOOK_KEY='botany-world-atlas-book-v1';
function readBook():{terms:Term[]; notes:JournalNote[]} {
  try { const parsed=JSON.parse(localStorage.getItem(BOOK_KEY)||'null');
    return {terms:Array.isArray(parsed?.terms) ? parsed.terms.filter((t:Term)=>!t.builtin && t.name && t.id) : [],notes:Array.isArray(parsed?.notes)?parsed.notes:[]};
  } catch {return {terms:[],notes:[]};}
}
// Resize uploads so a few images can fit in browser storage. Does not upload online.
async function imageData(file:File):Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file.');
  if (file.size>12*1024*1024) throw new Error('The image must be smaller than 12 MB.');
  const bitmap=await createImageBitmap(file);
  const ratio=Math.min(1,900/Math.max(bitmap.width,bitmap.height));
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(bitmap.width*ratio));canvas.height=Math.max(1,Math.round(bitmap.height*ratio));
  const ctx=canvas.getContext('2d');if(!ctx) throw new Error('Image processing unavailable.');
  ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
  return canvas.toDataURL('image/jpeg',0.65);
}
const SIZES: Record<Size, number> = { Island: 26, Small: 50, Medium: 80, Large: 130 };
const W = 1000, H = 550;
const empty = (): Atlas => ({ lands: [], districts: [], plants: [], biomes: [], features: [], waters: [], labels: [], occurrences: [], creatures: [], relations: [], climates: {} });
const id = () => crypto.randomUUID();
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const latitude = (y: number) => clamp(-y / 10, -90, 90);
const latitudeLabel = (y: number) => `${Math.abs(latitude(y)).toFixed(1)}°${latitude(y) >= 0 ? 'N' : 'S'}`;
const naturalBiomes = (y: number): string[] => {
  const a = Math.abs(latitude(y));
  if (a >= 70) return ['Polar ice', 'Polar desert', 'Tundra'];
  if (a >= 55) return ['Tundra', 'Boreal forest', 'Alpine', 'Wetland'];
  if (a >= 35) return ['Temperate forest', 'Temperate rainforest', 'Grassland', 'Wetland', 'Alpine', 'Desert', 'Scrubland'];
  if (a >= 20) return ['Desert', 'Scrubland', 'Grassland', 'Subtropical forest', 'Wetland'];
  return ['Tropical rainforest', 'Tropical seasonal forest', 'Savanna', 'Mangrove', 'Wetland', 'Desert', 'Scrubland', 'Grassland'];
};
const AQUATIC_BIOMES = ['Freshwater lake','Freshwater river','Freshwater wetland','Temperate kelp forest','Seagrass meadow','Coral reef','Mangrove lagoon','Estuary','Salt marsh','Coastal shelf','Open ocean','Polar sea','Sea ice','Deep sea','Hydrothermal vent','Abyssal plain'];
const depthColor=(meters:number)=>{const t=clamp(meters/6000,0,1); const start=[168,208,210], end=[20,45,80];return `rgb(${start.map((n,i)=>Math.round(n+(end[i]-n)*t)).join(',')})`;};
const terrestrialFeatures=['Mountain','Mountain range','Hill','Valley','Ravine','Canyon','Cliff','Cave','Gorge','Plateau','Mesa','Escarpment','Ridge','Peak','Volcano','Caldera','Crater','Glacier','Ice sheet','Dune','Desert basin','Floodplain','Delta','Beach','Coastal bluff','Fjord','Peninsula','Islet','Sinkhole','Spring','Waterfall','Forest'];
const aquaticFeatures=['Coral reef','Seamount','Ocean trench','Underwater canyon','Atoll','Fjord','Delta','Volcano','Caldera','Crater','Cave','Ridge','Plateau','Spring'];
const DEFAULT_CLIMATE:Climate = {rainfall:700,elevation:200,temperature:18,salinity:'Fresh',depth:'Shallow',currents:'Moderate'};
function aquaticSuggestions(y:number, climate:Climate):string[]{
 const a=Math.abs(latitude(y));
 if(climate.depth==='Deep') return a>=65?['Polar sea','Deep sea','Abyssal plain']:['Deep sea','Abyssal plain','Hydrothermal vent','Open ocean'];
 if(climate.salinity==='Fresh') return ['Freshwater lake','Freshwater river','Freshwater wetland'];
 if(climate.salinity==='Brackish') return a<35?['Mangrove lagoon','Estuary','Salt marsh']:['Estuary','Salt marsh'];
 if(a>=65) return ['Polar sea','Sea ice','Coastal shelf'];
 if(a<30) return ['Coral reef','Seagrass meadow','Coastal shelf','Open ocean'];
 return ['Temperate kelp forest','Seagrass meadow','Coastal shelf','Open ocean'];
}
// Elevation applies additively wherever organic terrain patches overlap.
const MIN_HEIGHT=-11000, MAX_HEIGHT=8800;
function terrainAt(p:P, patches:DepthPatch[]){
 return clamp(patches.reduce((total,patch)=>{
   const polygon=terrainOutline(patch);
   return inPolygon(p,polygon)?total+patch.depthMeters:total;
 },0),MIN_HEIGHT,MAX_HEIGHT);
}
function terrainOutline(p:DepthPatch):P[]{
 const hash=[...(p.seed||p.id)].reduce((n,c)=>n+c.charCodeAt(0),0);
 return Array.from({length:48},(_,i)=>{
   const a=i*Math.PI*2/48;
   const r=p.radius*(1+.12*Math.sin(5*a+hash)+.09*Math.cos(8*a+hash*.23)+.035*Math.sin(11*a+hash*.7));
   return {x:p.x+Math.cos(a)*r,y:p.y+Math.sin(a)*r*.83};
 });
}
function terrainTint(meters:number, onLand:boolean){
 if(onLand){if(meters>=3300)return '#efefea';if(meters>=2100)return '#bfc5af';if(meters>700)return '#cad1ad';if(meters< -300)return '#847765';return '#a9b78f';}
 return depthColor(clamp(-meters,0,11000));
}
// Elevation-aware climate: latitude controls the starting temperature;
// higher elevation lowers temperature by approximately 6.5 C per kilometer.
// This is a useful guide, not a full atmospheric simulation.
function climateSuggestions(y:number, climate:Climate, elevationMeters=0):string[]{
 const lat=Math.abs(latitude(y));
 const estimatedTemperature=29-0.52*lat-0.0065*Math.max(-500,elevationMeters);
 const rain=climate.rainfall;
 if(estimatedTemperature<=-12) return ['Polar ice','Polar desert','Tundra'];
 if(estimatedTemperature<=0) return ['Tundra','Alpine','Boreal forest','Polar desert'];
 if(estimatedTemperature<=7) return rain<300?['Alpine','Tundra','Grassland','Cold desert']:['Boreal forest','Alpine','Tundra','Wetland','Cold desert'];
 // Latitude and elevation determine broad thermal suitability, while rainfall
 // influences which option is recommended first. Dry environments remain selectable
 // even when the current land-wide rainfall is higher (e.g., rain-shadow microclimates).
 if(estimatedTemperature>=23) {
   const dry=['Desert','Scrubland','Savanna','Grassland'];
   const wet=['Tropical rainforest','Tropical seasonal forest','Mangrove','Wetland'];
   return rain<250?[...dry,...wet]:rain<700?['Savanna','Scrubland','Grassland','Desert',...wet]:[...wet,'Savanna','Grassland','Desert','Scrubland'];
 }
 if(estimatedTemperature>=16) {
   const dry=['Desert','Scrubland','Grassland','Savanna'];
   const wet=['Subtropical forest','Temperate rainforest','Temperate forest','Wetland'];
   return rain<250?[...dry,...wet]:rain<700?['Grassland','Scrubland','Desert',...wet,'Savanna']:[...wet,'Grassland','Scrubland','Desert','Savanna'];
 }
 const dry=['Desert','Scrubland','Grassland'];
 const wet=['Temperate forest','Temperate rainforest','Wetland'];
 return rain<250?[...dry,...wet]:[...wet,...dry];
}

function isColdHighland(y: number, _climate: Climate, elevation: number) {

 return 29-0.52*Math.abs(latitude(y))-0.0065*Math.max(-500,elevation)<=0;
}
function longitudeAt(x:number){return ((x/10+180)%360+360)%360-180;}
const ALL_BIOMES = [...new Set(['Polar ice', 'Polar desert', 'Tundra', 'Boreal forest', 'Alpine', 'Wetland', 'Temperate forest', 'Temperate rainforest', 'Grassland', 'Desert', 'Cold desert', 'Scrubland', 'Subtropical forest', 'Tropical rainforest', 'Tropical seasonal forest', 'Savanna', 'Mangrove'])];
// Each recognized ecological type has its own cartographic pigment.
// Invented biome types receive a stable hue derived from their name.
const biomeColor = (name: string) => {
  const colors: Record<string,string> = {
    'Freshwater lake':'#73abc0','Freshwater river':'#4e94a4','Freshwater wetland':'#79a8a0',
    'Temperate kelp forest':'#427d6c','Seagrass meadow':'#64b09b','Coral reef':'#d49388',
    'Mangrove lagoon':'#507d76','Estuary':'#86a4b1','Salt marsh':'#99aa89',
    'Coastal shelf':'#8bbdc2','Open ocean':'#517eae','Polar sea':'#92b9d1',
    'Sea ice':'#dde5e4','Deep sea':'#354a7b','Hydrothermal vent':'#967d89',
    'Abyssal plain':'#293b60','Polar ice':'#edf0e5','Polar desert':'#c9c1b8',
    Tundra:'#aca8a0','Boreal forest':'#5d8272',Alpine:'#aaa3a0',Wetland:'#729a88',
    'Temperate forest':'#829958','Temperate rainforest':'#427d69',
    Grassland:'#c3bb69',Desert:'#ddbd7b','Cold desert':'#c8b69a',Scrubland:'#b49e78',
    'Subtropical forest':'#7a9660','Tropical rainforest':'#367753',
    'Tropical seasonal forest':'#86a15d',Savanna:'#cfae62',Mangrove:'#4c866f'
  };
  if(colors[name]) return colors[name];
  let hash=2166136261;
  for(const char of name) hash=Math.imul(hash ^ char.charCodeAt(0),16777619);
  const hue=(hash>>>0)%360;
  return `hsl(${hue} 32% 57%)`;
};
function load(): Atlas {
  try {
    const v = JSON.parse(localStorage.getItem('botany-world-atlas-v2') || localStorage.getItem('botany-world-atlas-v1') || 'null');
    if (v && Array.isArray(v.lands)) return { ...empty(), ...v, lands: v.lands, districts: v.districts || [], plants: v.plants || [], biomes: v.biomes || [], features: v.features || [], waters: v.waters || [], labels: v.labels || [], occurrences: v.occurrences || [], creatures:v.creatures||[], relations:v.relations||[],climates:v.climates||{} };
  } catch { /* ignore corrupted saved data */ }
  return empty();
}
function generatedPoints(x: number, y: number, r: number, seed: string): P[] {
  const s = [...seed].reduce((n, c) => n + c.charCodeAt(0), 0);
  return Array.from({ length: 48 }, (_, i) => {
    const a = i / 48 * 2 * Math.PI;
    const n = 1 + 0.11 * Math.sin(a * 5 + s) + 0.08 * Math.cos(a * 9 + s / 3) + 0.035 * Math.sin(a * 17 + s);
    return { x: x + Math.cos(a) * r * n, y: y + Math.sin(a) * r * n * 0.79 };
  });
}
const landOutlineCache = new WeakMap<Land, P[]>();
function outline(l: Land): P[] {
  const cached = landOutlineCache.get(l);
  if (cached) return cached;
  const points = l.outline?.length ? l.outline : generatedPoints(l.x, l.y, SIZES[l.size || 'Medium'], l.id);
  landOutlineCache.set(l, points);
  return points;
}
// Organic, repeatable biome boundaries. Each biome uses its saved ID as a seed,
// so its outline stays unchanged between refreshes and zoom levels.
const biomeOutlineCache = new WeakMap<Biome, P[]>();
function biomeOutline(b: Biome): P[] {
  const cached = biomeOutlineCache.get(b);
  if (cached) return cached;
  const seed = [...b.id].reduce((sum, ch) => sum * 31 + ch.charCodeAt(0), 7) >>> 0;
  const phase = (seed % 6283) / 1000;
  const points = Array.from({ length: 72 }, (_, i) => {
    const a = (i / 72) * Math.PI * 2;
    const variation = 1
      + 0.18 * Math.sin(a * 3 + phase)
      + 0.13 * Math.cos(a * 5 - phase * 0.8)
      + 0.055 * Math.sin(a * 9 + phase * 1.7);
    return {
      x: b.x + Math.cos(a) * b.radius * variation,
      y: b.y + Math.sin(a) * b.radius * variation * 0.85,
    };
  });
  biomeOutlineCache.set(b, points);
  return points;
}
function biomeLabelVisible(b: Biome, all: Biome[], index: number): boolean {
  // If a later biome covers the earlier biome's title position,
  // hide that title rather than printing it over the new biome.
  return !all.slice(index + 1).some(next =>
    next.landId === b.landId && inPolygon({ x: b.x, y: b.y }, biomeOutline(next))
  );
}
void biomeLabelVisible;

// Quadratic curve through the midpoint of each pair: closed paths without angular corners.
function closedPath(points: P[]): string {
  if (points.length < 3) return '';
  const n = points.length;
  const mid = (a:P,b:P) => ({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
  const first = mid(points[n-1],points[0]);
  return `M ${first.x} ${first.y} ` + points.map((p,i) => {
    const next = mid(p,points[(i+1)%n]);
    return `Q ${p.x} ${p.y} ${next.x} ${next.y}`;
  }).join(' ') + ' Z';
}
function openPath(points:P[]): string {
  if (!points.length) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i=1;i<points.length-1;i++) {
    d += ` Q ${points[i].x} ${points[i].y} ${(points[i].x+points[i+1].x)/2} ${(points[i].y+points[i+1].y)/2}`;
  }
  const last = points[points.length-1];
  return d+` L ${last.x} ${last.y}`;
}
function inPolygon(p:P, polygon:P[]):boolean {
  let inside=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
    const a=polygon[i],b=polygon[j];
    if(((a.y>p.y)!==(b.y>p.y)) && p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x) inside=!inside;
  }
  return inside;
}
function insideLand(p: P, land: Land) { return inPolygon(p,outline(land)); }
function nearSegment(p:P,a:P,b:P,r:number){const dx=b.x-a.x,dy=b.y-a.y;const t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1),0,1);return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy)<=r;}
function insideWater(p:P,w:Water){return w.kind==='pond' ? inPolygon(p,w.points) : w.points.some((q,i)=>i>0&&nearSegment(p,w.points[i-1],q,(w.width||7)/2+3));}
const LAND_ICON_PATHS:Record<string,string>={
'Mountain':'M-19 13L-5-19L6-3L13-15L26 13Z','Mountain range':'M-28 13L-17-8L-9 2L0-20L13 0L19-10L30 13Z','Hill':'M-27 13Q-14-11 0 11Q16-20 28 13Z','Valley':'M-27-10L-10 13L0-2L10 13L27-10','Ravine':'M-22-15L-7-3L-13 7L2 0L0 16L20-1L14-12','Canyon':'M-25-15L-17 7L-5 7L0-4L10 7L21 7L27-15','Cliff':'M-19-15L12-15L12 13L-19 13Z','Cave':'M-21 13Q-22-18 0-20Q23-17 21 13ZM-8 13L-8 2Q0-9 8 2L8 13','Gorge':'M-24-13L-13-4L-20 15M25-13L10-2L20 15M-4-17L2 18','Plateau':'M-25 12L-16-8L18-8L27 12Z','Mesa':'M-25 13L-11-13L14-13L27 13Z','Escarpment':'M-25-12L10-12L10 12L27 12','Ridge':'M-27 10Q-8-18 4-6T27 7','Peak':'M-19 14L0-22L19 14Z','Volcano':'M-23 14L-8-12L-3-12L0-7L5-12L11-12L24 14Z','Caldera':'M-24 9Q-20-13 0-13Q20-13 24 9Q0 21-24 9Z','Crater':'M-22 2Q-22-12 0-12Q22-12 22 2Q0 20-22 2Z','Glacier':'M-20-18L-11 4L-6-3L0 17L9-5L18 12','Ice sheet':'M-25 9L-18-8L-8-3L3-17L12-3L21-8L28 9Z','Dune':'M-27 12Q-15-17-2 4Q13-11 27 12','Desert basin':'M-25-2Q-12 17 0 9Q12 17 25-2','Floodplain':'M-27 8Q-12-9 0 8Q13 19 27 0','Delta':'M0-20L0-2M0-2L-24 15M0-2L0 18M0-2L24 15','Beach':'M-25 12Q-8-10 5 2T28-7','Coastal bluff':'M-24-14L2-14L2 11M2 11Q15 1 28 11','Fjord':'M-26-18L-9-2L-21 14M26-18L9-2L21 14M0-19Q-8 0 0 18','Peninsula':'M-20-16L-4-16L-4-4L17-4L23 3L14 15L-4 15L-4 4L-20 4','Islet':'M-24 6Q-10-18 0-8Q11-17 24 6Q6 20-24 6Z','Coral reef':'M-22 15L-12 0L-18-10M-12 0L-3-12M0 15L7-7L2-17M7-7L17-15M7-7L24 5','Seamount':'M-25 13Q-12-1 0-17Q13-1 25 13','Ocean trench':'M-27-8L-13-8L-5 14L5 14L13-8L27-8','Underwater canyon':'M-26-14L-8-1L-12 14M26-14L8-1L12 14','Atoll':'M-22 2Q-19-20 0-14Q22-18 22 3Q18 20 0 15Q-18 20-22 2Z','Sinkhole':'M-23-8Q0-22 23-8L8 14L-8 14Z','Spring':'M-21 11Q-12-1-3 11T15 11M-5-8Q5-20 16-8','Waterfall':'M-21-15H20M-15-14V14M-4-14V17M8-14V14M19-14V17','Forest':'M0-24L-12-4H-7L-18 13H18L7-4H12Z'
};

// Only the portions of former coastlines covered by another land become pale seam lines.
function seams(land:Land, others:Land[]):string[] {
  const pts=outline(land);
  const result:string[]=[];
  const slices=8;
  for(let i=0;i<pts.length;i++) {
    const a=pts[i],b=pts[(i+1)%pts.length];
    for(let k=0;k<slices;k++) {
      const t=(k+.5)/slices;
      const m={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
      if(others.some(o=>o.id!==land.id && insideLand(m,o))) {
        const q=k/slices,r=(k+1)/slices;
        result.push(`M ${a.x+(b.x-a.x)*q} ${a.y+(b.y-a.y)*q} L ${a.x+(b.x-a.x)*r} ${a.y+(b.y-a.y)*r}`);
      }
    }
  }
  return result;
}
type AtlasName = {key:string;name:string;x:number;y:number;priority:number;size:number};
// Screen-aware collision detection. Keeps labels legible at all zoom levels.
function arrangeNames(names:AtlasName[],view:View,canvasWidth:number,canvasHeight:number){
  const output:(AtlasName & {drawX:number;drawY:number;fontSize:number})[]=[];
  const occupied:{left:number;top:number;right:number;bottom:number}[]=[];
  const visibleW=W/view.zoom, visibleH=H/view.zoom;
  const x0=view.x-visibleW/2,y0=view.y-visibleH/2;
  // A fixed visual font size translates to fewer map units as the map zooms in.
  const screenSize=Math.max(11,Math.min(21,17 + Math.log2(Math.max(view.zoom,.15))*1.3));
  const scaleX=canvasWidth/visibleW, scaleY=canvasHeight/visibleH;
  for(const item of [...names].sort((a,b)=>b.priority-a.priority)){
    if(!item.name.trim())continue;
    const px=(item.x-x0)*scaleX,py=(item.y-y0)*scaleY;
    if(px< -70 || py< -30 || px>canvasWidth+70 || py>canvasHeight+30)continue;
    const f=screenSize*(item.size/17);
    const tw=Math.max(26,item.name.length*f*.51+14),th=f+8;
    // Prefer the label's own coordinate; shift only if necessary.
    const options=[[0,0],[0,-f*1.5],[0,f*1.5],[0,-f*3],[0,f*3],[tw*.38,0],[-tw*.38,0]];
    for(const [ox,oy] of options){
      const cx=px+ox,cy=py+oy;
      const box={left:cx-tw/2,top:cy-th/2,right:cx+tw/2,bottom:cy+th/2};
      if(box.left<4||box.right>canvasWidth-4||box.top<4||box.bottom>canvasHeight-4)continue;
      if(occupied.some(b=>box.left<b.right+3 && box.right>b.left-3 && box.top<b.bottom+3 && box.bottom>b.top-3))continue;
      occupied.push(box);
      output.push({...item,drawX:x0+cx/scaleX,drawY:y0+cy/scaleY,fontSize:f/scaleY});
      break;
    }
  }
  return output;
}
export default function App() {
  const [data, setData] = useState<Atlas>(load);
  const [view, setView] = useState<View>({ x: 0, y: 0, zoom: 1 });
  const [tool, setTool] = useState<Tool>('explore');
  const [showEquator, setShowEquator] = useState(true);
  const [showNames, setShowNames] = useState(true);
  const [selectedLandId, setSelectedLandId] = useState<string | null>(null);
  const [selectedDistrictId, setSelectedDistrictId] = useState<string | null>(null);
  const [selectedOceanBiomeId, setSelectedOceanBiomeId] = useState<string | null>(null);
  const [selectedWaterId, setSelectedWaterId] = useState<string | null>(null);
  const [point, setPoint] = useState<P | null>(null);
  const [drawing, setDrawing] = useState<P[]>([]);
  const [waterWidth, setWaterWidth] = useState(7);
  const [depthMeters,setDepthMeters]=useState(1200);
  const [depthRadius,setDepthRadius]=useState(48);
  const [,setElevationDraft]=useState(200);
  const [editName,setEditName]=useState('');
  const [editDescription,setEditDescription]=useState('');
  const [editDistrictImage,setEditDistrictImage]=useState('');
  const [editDepth,setEditDepth]=useState(150);
  const [editRadius,setEditRadius]=useState(30);
  const [editX,setEditX]=useState(0);
  const [editY,setEditY]=useState(0);
  const [editTarget,setEditTarget]=useState<{kind:string;id:string}|null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [size, setSize] = useState<Size>('Medium');
  const [magical, setMagical] = useState(false);
  const [biomeType, setBiomeType] = useState('');
  const [biomeName, setBiomeName] = useState('');
  const [biomeRadius, setBiomeRadius] = useState(35);
  const [districtRadius, setDistrictRadius] = useState(24);
  const [districtImage,setDistrictImage]=useState('');
  const [realm,setRealm]=useState<'terrestrial'|'aquatic'>('terrestrial');
  const [climateDraft,setClimateDraft]=useState<Climate>(DEFAULT_CLIMATE);
  const [creatureName,setCreatureName]=useState('');
  const [creatureGroup,setCreatureGroup]=useState('Insect');
  const [creatureNotes,setCreatureNotes]=useState('');
  const [creatureHabitat,setCreatureHabitat]=useState('');
  const [creatureImage,setCreatureImage]=useState('');
  const [creatureBiome,setCreatureBiome]=useState('');
  const [relationSource,setRelationSource]=useState('');
  const [relationTarget,setRelationTarget]=useState('');
  const [relationKind,setRelationKind]=useState('Mutualism');
  const [relationNotes,setRelationNotes]=useState('');
  const [featureKind, setFeatureKind] = useState('Mountain');
  const [plantName, setPlantName] = useState('');
  const [habitat, setHabitat] = useState('');
  const [plantNotes, setPlantNotes] = useState('');
  const [plantTermId,setPlantTermId]=useState('');
  const [plantBiome,setPlantBiome]=useState('');
  const [plantImage,setPlantImage]=useState('');
  const [organismTab,setOrganismTab]=useState<'plants'|'wildlife'|'relationships'>('plants');
  const [bookOpen,setBookOpen]=useState(false);
  const [bookPage,setBookPage]=useState<BookPage>('dictionary');
  const [book,setBook]=useState(readBook);
  const [termName,setTermName]=useState('');
  const [termDescription,setTermDescription]=useState('');
  const [termKind,setTermKind]=useState<'real'|'magical'>('magical');
  const [termSource,setTermSource]=useState('');
  const [noteTitle,setNoteTitle]=useState('');
  const [noteText,setNoteText]=useState('');
  const [noteImage,setNoteImage]=useState('');
  const [bookSearch,setBookSearch]=useState('');
  const [magnifierOpen,setMagnifierOpen]=useState(false);
  const [storageWarning,setStorageWarning]=useState('');
  const [existingPlant, setExistingPlant] = useState('');
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; y: number; view: View; moved: boolean } | null>(null);
  // Undo/redo are in-memory session history; saved content continues to use
  // the same localStorage keys as previous atlas versions.
  type Snapshot = { atlas: Atlas; journal: ReturnType<typeof readBook> };
  const history = useRef<{ past: Snapshot[]; present: Snapshot; future: Snapshot[] }>({
    past: [], present: { atlas: data, journal: book }, future: [],
  });
  const restoringHistory = useRef(false);
  const mapHovered = useRef(false);
  const selectedForKeys = useRef({
    waterId: selectedWaterId, districtId: selectedDistrictId,
    oceanBiomeId: selectedOceanBiomeId, landId: selectedLandId,
  });
  selectedForKeys.current = {
    waterId: selectedWaterId, districtId: selectedDistrictId,
    oceanBiomeId: selectedOceanBiomeId, landId: selectedLandId,
  };
  useEffect(() => {
    const state = history.current;
    if (restoringHistory.current) {
      restoringHistory.current = false;
      state.present = { atlas: data, journal: book };
      return;
    }
    if (state.present.atlas === data && state.present.journal === book) return;
    state.past.push(state.present);
    // Bound memory use: large illustration attachments can make snapshots costly.
    if (state.past.length > 30) state.past.shift();
    state.present = { atlas: data, journal: book };
    state.future = [];
  }, [data, book]);

  function undoChange() {
    const h = history.current;
    if (!h.past.length) return;
    const previous = h.past.pop()!;
    h.future.push(h.present);
    h.present = previous;
    restoringHistory.current = true;
    setData(previous.atlas);
    setBook(previous.journal);
    setSelectedLandId(null);
    setSelectedDistrictId(null);
    setSelectedOceanBiomeId(null);
    setSelectedWaterId(null);
    setEditTarget(null);
  }
  function redoChange() {
    const h = history.current;
    if (!h.future.length) return;
    const next = h.future.pop()!;
    h.past.push(h.present);
    h.present = next;
    restoringHistory.current = true;
    setData(next.atlas);
    setBook(next.journal);
    setSelectedLandId(null);
    setSelectedDistrictId(null);
    setSelectedOceanBiomeId(null);
    setSelectedWaterId(null);
    setEditTarget(null);
  }

  // Keyboard handler uses the current selected IDs and atlas snapshot via refs
  // so it is installed only once and does not lag behind map selections.
  const currentAtlas = useRef(data);
  currentAtlas.current = data;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = !!target?.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]');
      if (typing || event.altKey) return;
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && key === 'z') {
        event.preventDefault();
        if (event.shiftKey) redoChange(); else undoChange();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && key === 'y') {
        event.preventDefault();
        redoChange();
        return;
      }
      if (event.ctrlKey || event.metaKey || !mapHovered.current) return;
      const steps: Record<string, [number, number]> = {
        w: [0, -1], a: [-1, 0], s: [0, 1], d: [1, 0],
      };
      if (steps[key]) {
        event.preventDefault();
        const [dx, dy] = steps[key];
        setView(v => ({ ...v, x: v.x + dx * 55 / v.zoom,
          y: v.y + dy * 55 / v.zoom }));
        return;
      }
      if (event.key !== 'Delete' || event.repeat) return;
      const ids = selectedForKeys.current;
      const atlas = currentAtlas.current;
      // Priority: waterbody, district, offshore aquatic biome, land.
      if (ids.waterId) {
        const water = atlas.waters.find(w => w.id === ids.waterId);
        if (water && window.confirm(`Delete waterbody "${water.name}"? This cannot be undone except with Ctrl+Z.`)) {
          setData(v => ({ ...v, waters: v.waters.filter(w => w.id !== water.id) }));
          setSelectedWaterId(null);
        }
      } else if (ids.districtId) {
        const district = atlas.districts.find(d => d.id === ids.districtId);
        if (district && window.confirm(`Delete district "${district.name}" and remove its local species associations?`)) {
          setData(v => ({ ...v,
            districts: v.districts.filter(d => d.id !== district.id),
            occurrences: v.occurrences.filter(o => o.districtId !== district.id),
            creatures: v.creatures.map(c => c.districtId === district.id ? { ...c, districtId: undefined } : c),
          }));
          setSelectedDistrictId(null);
        }
      } else if (ids.oceanBiomeId) {
        const biome = atlas.biomes.find(b => b.id === ids.oceanBiomeId);
        if (biome && window.confirm(`Delete aquatic biome "${biome.name}"?`)) {
          setData(v => ({ ...v,
            biomes: v.biomes.filter(b => b.id !== biome.id),
            creatures: v.creatures.map(c => c.biomeId === biome.id ? { ...c, biomeId: undefined } : c),
            plants: v.plants.map(p => p.biomeId === biome.id ? { ...p, biomeId: undefined } : p),
            districts: v.districts.map(d => d.biomeId === biome.id ? { ...d, biomeId: undefined } : d),
          }));
          setSelectedOceanBiomeId(null);
        }
      } else if (ids.landId) {
        const land = atlas.lands.find(l => l.id === ids.landId);
        if (land && window.confirm(`Delete land "${land.name}" and its associated records?`)) {
          const districts = new Set(atlas.districts.filter(d => d.landId === land.id).map(d => d.id));
          const plants = new Set(atlas.plants.filter(p => p.landId === land.id).map(p => p.id));
          setData(v => ({...v,
            lands: v.lands.filter(l => l.id !== land.id),
            districts: v.districts.filter(d => d.landId !== land.id),
            plants: v.plants.filter(p => p.landId !== land.id),
            biomes: v.biomes.filter(b => b.landId !== land.id),
            features: v.features.filter(f => f.landId !== land.id),
            waters: v.waters.filter(w => w.landId !== land.id),
            labels: v.labels.filter(l => l.landId !== land.id),
            occurrences: v.occurrences.filter(o => !districts.has(o.districtId) && !plants.has(o.plantId)),
            creatures: v.creatures.filter(c => c.landId !== land.id),
            relations: v.relations.filter(r => r.landId !== land.id),
            climates: Object.fromEntries(Object.entries(v.climates).filter(([key]) => key !== land.id)),
          }));
          setSelectedLandId(null);
        }
      } else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => { try { localStorage.setItem('botany-world-atlas-v2', JSON.stringify(data));setStorageWarning(''); } catch { setStorageWarning('Atlas storage is full. New changes may not survive refresh.'); } }, [data]);
  useEffect(() => { try {localStorage.setItem(BOOK_KEY,JSON.stringify(book));setStorageWarning('');}catch{setStorageWarning('Book storage is full. Try fewer or smaller images.');}},[book]);
  const terms=[...STANDARD_TERMS,...book.terms];
  async function pickImage(event:React.ChangeEvent<HTMLInputElement>, apply:(value:string)=>void){
    const file=event.target.files?.[0]; if(!file) return;
    try {apply(await imageData(file));}catch(error){alert(error instanceof Error?error.message:'Could not open image.');}
    event.target.value='';
  }
  function addTerm(event:FormEvent<HTMLFormElement>){
    event.preventDefault(); const name=termName.trim(); const description=termDescription.trim();
    if(!name||!description)return;
    if(terms.some(t=>t.name.toLowerCase()===name.toLowerCase()))return alert('This name is already in the dictionary.');
    const sourceUrl=termKind==='real'?termSource.trim():'';
    if(sourceUrl && !/^https?:\/\//i.test(sourceUrl))return alert('Please provide a link beginning with https:// or http://.');
    const newTerm:Term={id:id(),name,description,kind:termKind,sourceUrl:sourceUrl||undefined};
    setBook(b=>({...b,terms:[...b.terms,newTerm]}));
    setPlantTermId(newTerm.id);setTermName('');setTermDescription('');setTermSource('');
  }
  function deleteTerm(term:Term){
    if(term.builtin)return;
    if(!window.confirm(`Delete custom dictionary term ${term.name}? Species already using it will show it as an unclassified term.`))return;
    setBook(b=>({...b,terms:b.terms.filter(t=>t.id!==term.id)}));
  }
  function addNote(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(!noteTitle.trim()&&!noteText.trim()&&!noteImage)return;
    setBook(b=>({...b,notes:[{id:id(),title:noteTitle.trim()||'Untitled observation',text:noteText,image:noteImage,created:new Date().toLocaleDateString()},...b.notes]}));
    setNoteTitle('');setNoteText('');setNoteImage('');
  }
  function deleteNote(note:JournalNote){if(!window.confirm(`Delete note “${note.title}”?`))return;setBook(b=>({...b,notes:b.notes.filter(n=>n.id!==note.id)}));}
  function showBook(page:BookPage){setBookPage(page);setBookOpen(true);setBookSearch('');}
  function findTerm(termId?:string){return terms.find(t=>t.id===termId)?.name||'Unclassified';}
  function viewRecord(kind:BookPage,record:{id:string;landId?:string;x?:number;y?:number}) {
    const owner=kind==='lands'?record.id:record.landId || data.districts.find(d=>d.id===record.id)?.landId;
    if(owner){setSelectedLandId(owner);setSelectedDistrictId(kind==='districts'?record.id:null);setSelectedOceanBiomeId(null);changeTool('explore');}
    else if(kind==='districts' && data.districts.some(d=>d.id===record.id)) {const d=data.districts.find(x=>x.id===record.id)!;setSelectedLandId(null);setSelectedDistrictId(d.id);setSelectedOceanBiomeId(d.biomeId||null);changeTool('explore');}
    else if(kind==='waters' && data.biomes.some(b=>b.id===record.id && b.realm==='aquatic')) {setSelectedLandId(null);setSelectedDistrictId(null);setSelectedOceanBiomeId(record.id);changeTool('explore');}
    if(record.x!==undefined&&record.y!==undefined)setView(v=>({...v,x:record.x!,y:record.y!,zoom:Math.max(v.zoom,1.4)}));
    setBookOpen(false);
  }
  const land = data.lands.find(l => l.id === selectedLandId) || null;
  useEffect(()=>{if(!selectedLandId)return;const c=data.climates[selectedLandId]||DEFAULT_CLIMATE;setClimateDraft({...c});setElevationDraft(c.elevation);},[selectedLandId]);
  const district = data.districts.find(d => d.id === selectedDistrictId) || null;
  // Only aquatic biome regions can provide a land-independent organism register.
  const activeAquaticBiome = (district?.biomeId
    ? data.biomes.find(b => b.id === district.biomeId && b.realm === 'aquatic')
    : data.biomes.find(b => b.id === selectedOceanBiomeId && b.realm === 'aquatic')) || null;
  const organismScope = activeAquaticBiome || land;
  const scopeLandId = land?.id || '';
  const scopeBiomeId = activeAquaticBiome?.id || '';
  const localBiomeOptions = activeAquaticBiome ? [activeAquaticBiome]
    : land ? data.biomes.filter(b => b.landId === land.id) : [];

  const width = W / view.zoom, height = H / view.zoom;
  const left = view.x - width / 2, top = view.y - height / 2;
  const climate=land?(data.climates[land.id] || DEFAULT_CLIMATE):DEFAULT_CLIMATE;
  const localClimate=point ? data.lands.find(l=>insideLand(point,l)) : undefined;
  const localWater=point ? [...data.waters].reverse().find(w=>insideWater(point,w)) : undefined;
  const featureIsAquatic=!!(point && (!localClimate || localWater));
  const featureChoices=featureIsAquatic?aquaticFeatures:terrestrialFeatures;
  const chosenFeature=featureChoices.includes(featureKind)?featureKind:featureChoices[0];
  const siteAquatic = !!(point && (!data.lands.some(l=>insideLand(point,l)) || data.waters.some(w=>insideWater(point,w))));
  const localGround = (point ? terrainAt(point,data.depthPatches||[]) : 0) + (climate.elevation||0);
  const options = realm==='aquatic'||siteAquatic ? aquaticSuggestions(point?.y ?? land?.y ?? 0, {...climate,salinity:siteAquatic && !data.waters.some(w=>insideWater(point,w))?'Marine':'Fresh',depth:Math.abs(terrainAt(point||{x:0,y:0},data.depthPatches||[]))>=1500?'Deep':'Shallow'}) : climateSuggestions(point?.y ?? land?.y ?? 0,climate,localGround);
  const biomesToChoose = magical ? [...ALL_BIOMES,...AQUATIC_BIOMES] : options;
  const selectedBiome = biomesToChoose.includes(biomeType) ? biomeType : biomesToChoose[0];
  const clickedWater = point ? [...data.waters].reverse().find(w=>insideWater(point,w)) : undefined;
  const inLandHere = !!(point && data.lands.some(l=>insideLand(point,l)));
  const naturalLandHere = climateSuggestions(point?.y??land?.y??0,climate,localGround)[0];
  const waterClimate:Climate = {...climate,salinity:clickedWater?'Fresh':'Marine',depth:Math.abs(terrainAt(point||{x:0,y:0},data.depthPatches||[]))>=1500?'Deep':'Shallow'};
  const naturalWaterHere = aquaticSuggestions(point?.y??land?.y??0,waterClimate)[0];
  const biomeScope = clickedWater ? `Water body: ${clickedWater.name}` : inLandHere ? 'Land' : 'Open ocean';

  function screenPoint(cx: number, cy: number): P {
    const r = svg.current!.getBoundingClientRect();
    return { x: left + (cx - r.left) / r.width * width, y: top + (cy - r.top) / r.height * height };
  }
  function zoom(f: number, cx?: number, cy?: number) {
    setView(v => {
      const z = clamp(v.zoom * f, 0.15, 30);
      if (cx == null || cy == null || !svg.current) return { ...v, zoom: z };
      const r = svg.current.getBoundingClientRect(), fx = (cx - r.left) / r.width - 0.5, fy = (cy - r.top) / r.height - 0.5;
      return { zoom: z, x: v.x + fx * (W / v.zoom - W / z), y: v.y + fy * (H / v.zoom - H / z) };
    });
  }
  void zoom;
  
  // A non-passive wheel handler prevents the surrounding page from scrolling
  // while the pointer is over the interactive map. The book can still scroll.
  useEffect(() => {
    const element = svg.current;
    if (!element) return;
    const handleMapWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const fx = (event.clientX - rect.left) / rect.width - 0.5;
      const fy = (event.clientY - rect.top) / rect.height - 0.5;
      const factor = Math.exp(-event.deltaY * (event.deltaMode === 1 ? 0.018 : event.deltaMode === 2 ? 0.5 : 0.001));
      setView(previous => {
        const nextZoom = clamp(previous.zoom * factor, 0.15, 30);
        return {
          zoom: nextZoom,
          x: previous.x + fx * (W / previous.zoom - W / nextZoom),
          y: previous.y + fy * (H / previous.zoom - H / nextZoom),
        };
      });
    };
    element.addEventListener('wheel', handleMapWheel, { passive: false });
    return () => element.removeEventListener('wheel', handleMapWheel);
  }, []);
  function down(e: PointerEvent<SVGSVGElement>) {
    if (e.button !== 0) return;
    drag.current = { x: e.clientX, y: e.clientY, view: { ...view }, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function move(e: PointerEvent<SVGSVGElement>) {
    if (!drag.current || !svg.current) return;
    const d = drag.current, dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (Math.hypot(dx, dy) > 5) d.moved = true;
    if (!d.moved) return;
    const r = svg.current.getBoundingClientRect();
    setView({ ...d.view, x: d.view.x - dx / r.width * (W / d.view.zoom), y: d.view.y - dy / r.height * (H / d.view.zoom) });
  }
  function up(e: PointerEvent<SVGSVGElement>) {
    const wasDrag = drag.current?.moved;
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (wasDrag) return;
    const p = screenPoint(e.clientX, e.clientY);
    const hit = [...data.lands].reverse().find(l => insideLand(p, l));
    if (tool === 'explore') {
      // Select the water itself first, even when it lies on top of land.
      // The land remains selected so the other land controls still work.
      const waterHit = [...data.waters].reverse().find(w => insideWater(p, w));
      setSelectedWaterId(waterHit?.id ?? null);
      if (waterHit) {
        setSelectedDistrictId(null);
        setSelectedLandId(hit?.id || waterHit.landId || null);
        setSelectedOceanBiomeId(null);
        return;
      }
      const dist = [...data.districts].reverse().find(d => Math.hypot(p.x - d.x, p.y - d.y) <= (d.radius || 24));
      const waterBiome = [...data.biomes].reverse().find(b =>
        b.realm === 'aquatic' && inPolygon(p, biomeOutline(b))
      );
      if (dist) {
        setSelectedDistrictId(dist.id);
        setSelectedLandId(dist.landId || null);
        setSelectedOceanBiomeId(dist.biomeId || waterBiome?.id || null);
      } else {
        setSelectedDistrictId(null);
        setSelectedLandId(hit?.id || null);
        setSelectedOceanBiomeId(waterBiome?.id || null);
      }
      return;
    }
    if (tool === 'drawland') { if (Math.abs(p.y)>900) return alert('Place coastlines between 90°N and 90°S.'); setDrawing(v=>[...v,p]); return; }
    if (tool === 'land') { if (Math.abs(p.y) > 900) return alert('Choose a location between 90°N and 90°S.'); setPoint(p); return; }
    if (tool === 'river' || tool === 'pond') { if (!land) return alert('Select a land first.'); setDrawing(v => [...v, p]); return; }
    if (tool === 'depth') {
      if (!hit) return alert('Terrain elevation and depressions can only be placed on land. Click inside a land boundary.');
      setPoint(p); setSelectedLandId(hit.id); return;
    }
    if (tool === 'biome') { setPoint(p); return; }
    if(tool === 'district'){setPoint(p);return;}
    if(tool === 'feature'){setPoint(p);return;}
    if (!land) return alert('Select a land for this feature.');
    setPoint(p);
  }
  function changeTool(next: Tool) { setSelectedWaterId(null); setTool(next); setPoint(null); setDrawing([]); setName(''); setDescription(''); }
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim() && tool !== 'biome' && tool !== 'depth') return;
    if (!point) return;
    if (tool === 'land') {
      const newLand: Land = { id: id(), name: name.trim(), x: point.x, y: point.y, latitude: latitude(point.y), size, biome: magical ? (biomeName.trim() || selectedBiome) : naturalBiomes(point.y)[0], biomeBase: magical ? selectedBiome : naturalBiomes(point.y)[0], magical, description };
      setData(d => ({ ...d, lands: [...d.lands, newLand] }));
      setSelectedLandId(newLand.id); setSelectedDistrictId(null);
    } else if (tool === 'district') {
      setData(d => ({ ...d, districts: [...d.districts, { id: id(), landId: data.lands.find(l=>insideLand(point,l))?.id || land?.id || '', name: name.trim(), description:description.trim(), image:districtImage||undefined, x: point.x, y: point.y, radius: districtRadius, biomeId:[...d.biomes].reverse().find(b=>inPolygon(point,biomeOutline(b)))?.id }] }));
    } else if (tool === 'biome') {
      setData(d => ({ ...d, biomes: [...d.biomes, { id: id(), landId: data.lands.find(l=>insideLand(point,l) || inPolygon(l.id?{x:point.x+biomeRadius*.7,y:point.y}:point,outline(l)) || inPolygon({x:point.x-biomeRadius*.7,y:point.y},outline(l)))?.id || '', x: point.x, y: point.y, radius: biomeRadius, kind: selectedBiome, name: biomeName.trim() || selectedBiome, magical, realm:clickedWater||!inLandHere?'aquatic':realm, landKind:magical || (inLandHere && !clickedWater) ? selectedBiome : naturalLandHere, aquaticKind:magical || (clickedWater || !inLandHere) ? selectedBiome : naturalWaterHere, waterId:clickedWater?.id, salinity:waterClimate.salinity,depth:climate.depth,depthMeters }] }));
    } else if (tool === 'depth') {
      if (!data.lands.some(l => insideLand(point, l))) { alert('Choose a location on land to adjust its terrain.'); return; }
      const patch:DepthPatch={id:id(),x:point.x,y:point.y,radius:depthRadius,depthMeters,name:name.trim()||`${depthMeters>=0?'Elevation':'Depression'} ${Math.abs(depthMeters)}m`};
      setData(d=>{
        const patches=[...(d.depthPatches||[]),patch];
        // Do not create permanent alpine biome objects: snow and cold-climate
        // suggestions are derived from the terrain, so editing/removing patches
        // immediately updates the effective conditions.
        return {...d,depthPatches:patches};
      });
    } else if (land && tool === 'label') {
      setData(d => ({ ...d, labels: [...d.labels, { id: id(), landId: land.id, x: point.x, y: point.y, name: name.trim() }] }));
    }
    changeTool('explore'); setMagical(false); setBiomeName(''); setDistrictImage('');
  }
  function finishCustomLand() {
    if (drawing.length<3 || !name.trim()) return;
    const cx=drawing.reduce((n,p)=>n+p.x,0)/drawing.length;
    const cy=drawing.reduce((n,p)=>n+p.y,0)/drawing.length;
    const region=naturalBiomes(cy);
    const base=magical ? (ALL_BIOMES.includes(biomeType) ? biomeType : ALL_BIOMES[0]) : region[0];
    const newLand:Land={id:id(),name:name.trim(),x:cx,y:cy,size,latitude:latitude(cy),
      biome:magical ? biomeName.trim()||base:base,biomeBase:base,magical,description,
      outline:drawing.map(p=>({...p}))};
    setData(d=>({...d,lands:[...d.lands,newLand]}));
    setSelectedLandId(newLand.id);setSelectedDistrictId(null);
    changeTool('explore');setMagical(false);setBiomeName('');
  }
  function placeFeature() {
    if (!point) return;
    setData(d => ({ ...d, features: [...d.features, { id: id(), landId: data.lands.find(l=>insideLand(point,l))?.id||land?.id||'', x: point.x, y: point.y, kind: chosenFeature, depthMeters:featureIsAquatic?depthMeters:undefined }] }));
    setPoint(null);
  }
  function finishWater() {
    if (!land || drawing.length < (tool === 'pond' ? 3 : 2)) return;
    setData(d => ({ ...d, waters: [...d.waters, { id: id(), landId: land.id, kind: tool as 'river' | 'pond', name: name.trim() || (tool === 'river' ? 'Unnamed river' : 'Unnamed lake'), points: drawing, width: waterWidth, depthMeters }] }));
    setDrawing([]); setName(''); changeTool('explore');
  }
  function addPlant(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!organismScope || !plantName.trim()) return;
    const newPlant: Plant = { id: id(), landId: scopeLandId, name: plantName.trim(), habitat, description: plantNotes, termId:plantTermId||undefined, image:plantImage||undefined, biomeId:plantBiome || scopeBiomeId || undefined };
    setData(d => ({ ...d, plants: [...d.plants, newPlant], occurrences: district ? [...d.occurrences, { districtId: district.id, plantId: newPlant.id }] : d.occurrences }));
    setPlantName(''); setHabitat(''); setPlantNotes(''); setPlantTermId(''); setPlantImage('');setPlantBiome('');
  }
  function attachPlant() {
    if (!district || !existingPlant || data.occurrences.some(o => o.districtId === district.id && o.plantId === existingPlant)) return;
    setData(d => ({ ...d, occurrences: [...d.occurrences, { districtId: district.id, plantId: existingPlant }] })); setExistingPlant('');
  }
  function saveEditedRecord(){
    if(!editTarget)return;
    const target=editTarget; const label=editName.trim();
    setData(d=>{
      const update=(rows:any[],field:string)=>rows.map(r=>r.id===target.id?{...r,[field]:label,...(['land','district'].includes(target.kind)?{description:editDescription}:{}),...(target.kind==='district'?{image:editDistrictImage||undefined}:{}),...(target.kind==='feature'?{kind:label}:{}),...(['biome','district','depth'].includes(target.kind)?{radius:editRadius}:{}),...(['biome','depth','water','feature'].includes(target.kind)?{depthMeters:editDepth}:{}),...(target.kind!=='water'?{x:editX,y:editY}:{} )}:r);
      if(target.kind==='land')return {...d,lands:update(d.lands,'name')};
      if(target.kind==='district')return {...d,districts:update(d.districts,'name')};
      if(target.kind==='biome')return {...d,biomes:update(d.biomes,'name')};
      if(target.kind==='plant')return {...d,plants:update(d.plants,'name')};
      if(target.kind==='creature')return {...d,creatures:update(d.creatures,'name')};
      if(target.kind==='water')return {...d,waters:update(d.waters,'name')};
      if(target.kind==='label')return {...d,labels:update(d.labels,'name')};
      if(target.kind==='feature')return {...d,features:update(d.features,'kind')};
      if(target.kind==='depth')return {...d,depthPatches:update(d.depthPatches||[],'name').map(p=>({...p,depthMeters:clamp(p.depthMeters,MIN_HEIGHT,MAX_HEIGHT)}))};
      return d;
    });setEditTarget(null);
  }
  function startEdit(kind:string,id:string,currentName:string,desc=''){setEditTarget({kind,id});setEditName(currentName);setEditDescription(kind==='district'?data.districts.find(d=>d.id===id)?.description||'':desc);setEditDistrictImage(kind==='district'?data.districts.find(d=>d.id===id)?.image||'':'');const groups=[...data.lands,...data.districts,...data.biomes,...data.features,...data.waters,...data.labels,...data.plants,...data.creatures,...(data.depthPatches||[])];const found=groups.find(x=>x.id===id);if(found){setEditDepth('depthMeters' in found?Number(found.depthMeters??150):150);setEditRadius('radius' in found?Number(found.radius??35):35);setEditX('x' in found?Number(found.x):0);setEditY('y' in found?Number(found.y):0)}}
  function saveClimate(){
    if(!land)return;
    setData(d=>({...d,climates:{...d.climates,[land.id]:climateDraft}}));
  }
  function createCreature(e:FormEvent<HTMLFormElement>){
    e.preventDefault();if(!organismScope||!creatureName.trim())return;
    const record:Creature={id:id(),landId:scopeLandId,districtId:district?.id,biomeId:creatureBiome||scopeBiomeId||undefined,name:creatureName.trim(),group:creatureGroup,description:creatureNotes,habitat:creatureHabitat,image:creatureImage||undefined};
    setData(d=>({...d,creatures:[...d.creatures,record]}));setCreatureName('');setCreatureNotes('');setCreatureHabitat('');setCreatureImage('');setCreatureBiome('');
  }
  function createRelation(e:FormEvent<HTMLFormElement>){
    e.preventDefault();if(!organismScope||!relationSource||!relationTarget||relationSource===relationTarget)return;
    setData(d=>({...d,relations:[...d.relations,{id:id(),landId:scopeLandId,sourceId:relationSource,targetId:relationTarget,kind:relationKind,description:relationNotes}]}));
    setRelationSource('');setRelationTarget('');setRelationNotes('');
  }
  function deleteLand() {
    if (!land || !window.confirm(`Delete ${land.name}, including its districts and records?`)) return;
    const districtIds = data.districts.filter(d => d.landId === land.id).map(d => d.id);
    const plantIds = data.plants.filter(p => p.landId === land.id).map(p => p.id);
    setData(d => ({ lands: d.lands.filter(x => x.id !== land.id), districts: d.districts.filter(x => x.landId !== land.id), plants: d.plants.filter(x => x.landId !== land.id), biomes: d.biomes.filter(x => x.landId !== land.id), features: d.features.filter(x => x.landId !== land.id), waters: d.waters.filter(x => x.landId !== land.id), labels: d.labels.filter(x => x.landId !== land.id), occurrences: d.occurrences.filter(x => !districtIds.includes(x.districtId) && !plantIds.includes(x.plantId)), creatures:d.creatures.filter(x=>x.landId!==land.id),relations:d.relations.filter(x=>x.landId!==land.id),climates:Object.fromEntries(Object.entries(d.climates).filter(([key])=>key!==land.id)) }));
    setSelectedLandId(null); setSelectedDistrictId(null);
  }
  // Every editable record can be removed independently. District removal only clears
  // its local plant associations; deleting a species removes all its associations.
  function removeItem(kind: 'district' | 'plant' | 'biome' | 'feature' | 'water' | 'label' | 'creature' | 'relation', itemId: string, itemName: string) {
    if (!window.confirm(`Delete ${itemName}? This cannot be undone.`)) return;
    setData(previous => {
      switch (kind) {
        case 'district':
          return {
            ...previous,
            districts: previous.districts.filter(x => x.id !== itemId),
            occurrences: previous.occurrences.filter(x => x.districtId !== itemId),creatures:previous.creatures.map(c=>c.districtId===itemId?{...c,districtId:undefined}:c),
          };
        case 'plant':
          return {
            ...previous,
            plants: previous.plants.filter(x => x.id !== itemId),
            occurrences: previous.occurrences.filter(x => x.plantId !== itemId),relations:previous.relations.filter(r=>r.sourceId!==itemId&&r.targetId!==itemId),
          };
        case 'biome':
          return { ...previous, biomes: previous.biomes.filter(x => x.id !== itemId), creatures:previous.creatures.map(c=>c.biomeId===itemId?{...c,biomeId:undefined}:c),plants:previous.plants.map(p=>p.biomeId===itemId?{...p,biomeId:undefined}:p),districts:previous.districts.map(d=>d.biomeId===itemId?{...d,biomeId:undefined}:d) };
        case 'feature':
          return { ...previous, features: previous.features.filter(x => x.id !== itemId) };
        case 'water':
          return { ...previous, waters: previous.waters.filter(x => x.id !== itemId) };
        case 'label':
          return { ...previous, labels: previous.labels.filter(x => x.id !== itemId) };
        case 'creature':return {...previous,creatures:previous.creatures.filter(x=>x.id!==itemId),relations:previous.relations.filter(r=>r.sourceId!==itemId&&r.targetId!==itemId)};
        case 'relation':return {...previous,relations:previous.relations.filter(x=>x.id!==itemId)};
      }
    });
    if (kind === 'district' && selectedDistrictId === itemId) setSelectedDistrictId(null);
    if (kind === 'water' && selectedWaterId === itemId) setSelectedWaterId(null);
    if (kind === 'plant' && existingPlant === itemId) setExistingPlant('');
  }
  function detachPlant(plantId: string) {
    if (!district) return;
    const species = data.plants.find(p => p.id === plantId);
    if (!species || !window.confirm(`Remove ${species.name} from ${district.name}? The species itself will remain in the atlas.`)) return;
    setData(previous => ({
      ...previous,
      occurrences: previous.occurrences.filter(x => !(x.districtId === district.id && x.plantId === plantId)),
    }));
  }
  function deleteRow(kind: 'district' | 'plant' | 'biome' | 'feature' | 'water' | 'label' | 'creature' | 'relation', itemId: string, itemName: string) {
    return <button type="button" className="record-delete" onClick={() => removeItem(kind, itemId, itemName)}>Delete</button>;
  }
  const selectedWater = data.waters.find(w => w.id === selectedWaterId) || null;
  const inCurrentScope = (r:{landId:string;biomeId?:string}) =>
    activeAquaticBiome ? r.biomeId===activeAquaticBiome.id : !!land && r.landId===land.id;
  const localCreatures=data.creatures.filter(c=>inCurrentScope(c) && (!district || c.districtId===district.id));
  const organisms=organismScope?[...data.plants.filter(inCurrentScope).map(p=>({id:p.id,name:p.name})),...data.creatures.filter(inCurrentScope).map(c=>({id:c.id,name:c.name}))]:[];
  const organismName=(rid:string)=>organisms.find(o=>o.id===rid)?.name||'Unrecorded organism';
  const localPlants = district ? data.occurrences.filter(o => o.districtId === district.id).map(o => data.plants.find(p => p.id === o.plantId)).filter((p): p is Plant => !!p) : organismScope ? data.plants.filter(inCurrentScope) : [];
  const gridX = Array.from({ length: Math.min(201, Math.ceil(width / 100) + 2) }, (_, i) => Math.floor(left / 100) * 100 + i * 100);
  const gridY = Array.from({ length: Math.min(201, Math.ceil(height / 100) + 2) }, (_, i) => Math.floor(top / 100) * 100 + i * 100);
  const mapPixelWidth=svg.current?.clientWidth || 920;
  const mapPixelHeight=svg.current?.clientHeight || 500;
  const allNames:AtlasName[]=[
    ...data.lands.map(l=>({key:`land-${l.id}`,name:l.name,x:l.x,y:l.y,priority:100,size:21})),
    ...data.districts.map(d=>({key:`district-${d.id}`,name:d.name,x:d.x,y:d.y,priority:85,size:18})),
    ...data.waters.map(w=>({key:`water-${w.id}`,name:w.name,x:w.points.reduce((a,p)=>a+p.x,0)/Math.max(w.points.length,1),y:w.points.reduce((a,p)=>a+p.y,0)/Math.max(w.points.length,1),priority:70,size:16})),
    ...data.labels.map(l=>({key:`label-${l.id}`,name:l.name,x:l.x,y:l.y,priority:95,size:19})),
    ...data.biomes.map(b=>({key:`biome-${b.id}`,name:b.name,x:b.x,y:b.y,priority:55,size:16})),
    ...(data.depthPatches||[]).map(p=>({key:`terrain-${p.id}`,name:p.name,x:p.x,y:p.y,priority:35,size:14})),
  ];
  // Expensive map geometry is recalculated only when the relevant records change,
  // NOT on every pan, zoom, field edit or journal interaction.
  const landPaths = useMemo(() => new Map(data.lands.map(l => [l.id, closedPath(outline(l))])), [data.lands]);
  const joinedSeams = useMemo(() => data.lands.flatMap(l => seams(l, data.lands)), [data.lands]);
  const biomePaths = useMemo(() => new Map(data.biomes.map(b => [b.id, closedPath(biomeOutline(b))])), [data.biomes]);
  const waterPaths = useMemo(() => new Map(data.waters.map(w => [w.id, w.kind === 'pond' ? closedPath(w.points) : openPath(w.points)])), [data.waters]);
  const terrainPaths = useMemo(() => new Map((data.depthPatches || []).map(p => [p.id, closedPath(terrainOutline(p))])), [data.depthPatches]);
  const visibleNames=showNames?arrangeNames(allNames,view,mapPixelWidth,mapPixelHeight):[];

  return (
    <main className="page">
      <header className="hero"><p className="eyebrow">The Botany Society · Cartographic Archive</p><h1>World Atlas</h1><p className="subtitle">An illustrated record of imaginary lands and botanical life.</p></header>
      <nav className="controls">
        {(['explore','land','drawland','district','biome','feature','river','pond','label','depth'] as Tool[]).map(t => <button className={tool === t ? 'tool-active' : ''} key={t} onClick={() => { if (t !== 'explore' && t !== 'land' && t !== 'drawland' && !['biome','district','feature','depth'].includes(t) && !land) return alert('Select an existing land first.'); changeTool(t); }}>{({ explore:'Explore', land:'Auto Land', drawland:'Draw Land', district:'District', biome:'Biome', feature:'Landscape', river:'Draw River', pond:'Draw Pond', label:'Place Label',depth:'Land Elevation / Depression' } as Record<Tool,string>)[t]}</button>)}
        <button onClick={() => setShowEquator(v => !v)}>{showEquator ? 'Hide Equator' : 'Show Equator'}</button>
        <button aria-pressed={showNames} onClick={() => setShowNames(v => !v)}>{showNames ? 'Hide Names' : 'Show Names'}</button>
        <button onClick={() => setView({ x: 0, y: 0, zoom: 1 })}>Reset View</button>
      </nav>
      <p className="atlas-shortcuts">Shortcuts: Ctrl+Z undo · Ctrl+Shift+Z redo · WASD pan when hovering the map · Delete selected map object (with confirmation)</p>
      <p className="atlas-instruction">{tool === 'explore' ? 'Click a land or district to explore · Drag to pan · Scroll to zoom' : tool === 'land' ? 'Click to place an automatically generated land; overlapping lands connect.' : tool === 'drawland' ? 'Click around the coast to draw a custom land, then enter its name below.' : tool === 'river' || tool === 'pond' ? 'Click successive points, including through the ocean, then finish the smooth water drawing below.' : 'Click on the map to position this feature, including offshore regions.'}</p>
      <section className="map-frame"><div className="atlas-map-shell"><div className="map-surface atlas-viewport">
        <svg ref={svg} onMouseEnter={() => { mapHovered.current = true; }} onMouseLeave={() => { mapHovered.current = false; }} className="atlas-map" viewBox={`${left} ${top} ${width} ${height}`} preserveAspectRatio="none" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { drag.current = null; }}>
          <defs>
            <filter id="joined-coast" x="-15%" y="-15%" width="130%" height="130%" colorInterpolationFilters="sRGB">
              <feMorphology in="SourceAlpha" operator="dilate" radius="3" result="expanded"/>
              <feComposite in="expanded" in2="SourceAlpha" operator="out" result="rim"/>
              <feFlood floodColor="#665b3e" result="ink"/><feComposite in="ink" in2="rim" operator="in" result="outline"/>
              <feMerge><feMergeNode in="outline"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            {data.lands.map(l => <clipPath key={l.id} id={`clip-${l.id}`}><path d={landPaths.get(l.id) || ''}/></clipPath>)}
            {/* A single clip path made from all coastlines; rivers are visible only over land. */}
            <clipPath id="river-land-clip" clipPathUnits="userSpaceOnUse">
              {data.lands.map(l => <path key={l.id} d={landPaths.get(l.id) || ''}/>)}
            </clipPath>
            <mask id="ocean-only" maskUnits="userSpaceOnUse" x={left} y={top} width={width} height={height}><rect x={left} y={top} width={width} height={height} fill="white"/>{data.lands.map(l=><path key={l.id} d={landPaths.get(l.id) || ''} fill="black"/>)}</mask>
            {data.waters.map(w=><clipPath key={`wclip-${w.id}`} id={`wclip-${w.id}`} clipPathUnits="userSpaceOnUse"><path d={waterPaths.get(w.id) || ''} stroke={w.kind==='river'?'black':'none'} strokeWidth={w.width||7}/></clipPath>)}
          </defs>
          <g className="coordinate-grid">{gridX.map(x => <line key={`x${x}`} x1={x} x2={x} y1={top} y2={top+height}/>)}{gridY.map(y => <line key={`y${y}`} x1={left} x2={left+width} y1={y} y2={y}/>)}</g>
          {showEquator && <line x1={left} y1={0} x2={left+width} y2={0} stroke="#6c4d36" strokeWidth={1.8/view.zoom} strokeDasharray={`${8/view.zoom} ${6/view.zoom}`}/>}
          <g filter="url(#joined-coast)">{data.lands.map(l => <path key={l.id} d={landPaths.get(l.id) || ''} fill={l.magical ? '#b6af91' : '#a8b38d'}/>)}</g>
          <g className="merge-seams" fill="none" stroke="#eee3c5" strokeWidth={2.2 / Math.sqrt(view.zoom)} strokeLinecap="round" opacity="0.8">{joinedSeams.map((d,i)=><path key={i} d={d}/>) }</g>
          {/* Land elevation tint sits BELOW all biome paint.
              Therefore any existing or newly created biome remains visible. */}
          {(data.depthPatches||[]).map(p => <g key={`terrain-${p.id}`} pointerEvents="none">
            {data.lands.map(l=><g key={l.id} clipPath={`url(#clip-${l.id})`}><path d={terrainPaths.get(p.id) || ''} fill={terrainTint(terrainAt({x:p.x,y:p.y},data.depthPatches||[])+(data.climates[l.id]?.elevation||0),true)} opacity="0.94"/></g>)}
          </g>)}
          {/* Terrain-driven cold/snow overlays are also under authored biomes. */}
          {(data.depthPatches||[]).map(p=>data.lands.map(l=>{
            const h=terrainAt({x:p.x,y:p.y},data.depthPatches||[])+(data.climates[l.id]?.elevation||0);
            const cold=isColdHighland(p.y,data.climates[l.id]||DEFAULT_CLIMATE,h);
            return cold?<g key={`snow-${p.id}-${l.id}`} clipPath={`url(#clip-${l.id})`} pointerEvents="none"><path d={terrainPaths.get(p.id) || ''} fill="#e9e9e0" opacity="0.83"/></g>:null;
          }))}
          {/* A patch can span land, inland water, and sea. Natural segments receive
              terrain-appropriate names/colors; magical patches keep one identity. */}
          {data.biomes.map(b => <g key={b.id}>
            {data.lands.filter(l=>Math.hypot(l.x-b.x,l.y-b.y) < (SIZES[l.size || 'Medium'] * 2.2 + b.radius * 1.8)).map(l=><g key={l.id} clipPath={`url(#clip-${l.id})`}><path d={biomePaths.get(b.id) || ''} fill={biomeColor(b.magical?b.kind:(b.landKind||b.kind))} stroke="none"/></g>)}
            <g mask="url(#ocean-only)"><path d={biomePaths.get(b.id) || ''} fill={biomeColor(b.magical?b.kind:(b.aquaticKind||b.kind))}/></g>
          </g>)}
          {data.waters.map(w => w.kind === 'pond' ? <path key={w.id} d={waterPaths.get(w.id) || ''} fill={depthColor(w.depthMeters??150)} stroke="#6b989b" strokeWidth="2" strokeLinejoin="round"/> : <path key={w.id} d={waterPaths.get(w.id) || ''} clipPath="url(#river-land-clip)" fill="none" stroke={depthColor(w.depthMeters??150)} strokeWidth={w.width || 7} strokeLinecap="round" strokeLinejoin="round"/>)}
          {selectedWater && <path pointerEvents="none" d={waterPaths.get(selectedWater.id) || ''}
            fill={selectedWater.kind === 'pond' ? '#f4e5bc33' : 'none'}
            stroke="#f6e3a9" strokeWidth={selectedWater.kind === 'river' ? (selectedWater.width||7)+4 : 3}
            strokeDasharray="7 5" strokeLinecap="round" strokeLinejoin="round"
            clipPath={selectedWater.kind === 'river' ? 'url(#river-land-clip)' : undefined}/>}
          {/* The same biome can also cover inland ponds and rivers. */}
          {data.biomes.map(b => data.waters.filter(w => w.points.some(p => Math.abs(p.x-b.x) < b.radius*2.3 + (w.width||7) && Math.abs(p.y-b.y) < b.radius*2.3 + (w.width||7)) || (w.kind==='pond' && inPolygon({x:b.x,y:b.y},w.points))).map(w=><g key={`${b.id}-${w.id}`} clipPath={`url(#wclip-${w.id})`}><path d={biomePaths.get(b.id) || ''} fill={biomeColor(b.magical?b.kind:(b.aquaticKind||b.kind))}/></g>))}
          {/* Terrain regions drawn beneath biome patches above. */}
          {data.districts.map(d => <g key={d.id}><circle cx={d.x} cy={d.y} r={d.radius || 24} fill={selectedDistrictId===d.id ? '#e8dab1' : '#d6ca9e'} fillOpacity="0.45" stroke="#766044" strokeDasharray="4 3" strokeWidth="1.5"/></g>)}
          {data.features.map(f => <g key={f.id} transform={`translate(${f.x} ${f.y})`} className="feature-icon"><title>{f.kind}</title><path d={LAND_ICON_PATHS[f.kind]||'M-20 12L0-16L20 12Z'} fill="none" stroke="#493c2b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="0" cy="0" r="1.3" fill="#493c2b"/></g>)}
          {data.lands.map(l => <g key={l.id}>{selectedLandId===l.id && <circle cx={l.x} cy={l.y} r="5" fill="#62442e"/>}</g>)}

          {drawing.length > 0 && <g clipPath={tool === 'river' ? 'url(#river-land-clip)' : undefined}><path d={tool === 'pond' || tool === 'drawland' ? (drawing.length>=3 ? closedPath(drawing):openPath(drawing)) : openPath(drawing)} fill={tool==='pond' ? '#8eaeaa88': tool==='drawland' ? '#a8b38d77':'none'} stroke="#385e6a" strokeWidth={tool==='river' ? waterWidth:2} strokeLinejoin="round" strokeLinecap="round" strokeDasharray="5 4"/>{drawing.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r="4" fill="#385e6a"/>)}</g>}
          {point && tool === 'biome' && <g pointerEvents="none">
            <path d={closedPath(biomeOutline({ id: 'biome-preview', landId: data.lands.find(l=>insideLand(point,l) || inPolygon(l.id?{x:point.x+biomeRadius*.7,y:point.y}:point,outline(l)) || inPolygon({x:point.x-biomeRadius*.7,y:point.y},outline(l)))?.id || '', x: point.x, y: point.y, radius: biomeRadius, kind: selectedBiome, name: biomeName || selectedBiome, magical }))} fill={biomeColor(selectedBiome)} fillOpacity="0.8" stroke="#62452d" strokeWidth="2" strokeDasharray="5 4"/>
          </g>}
          {point && tool !== 'explore' && tool !== 'biome' && <circle cx={point.x} cy={point.y} r={tool === 'land' ? SIZES[size] : tool === 'district' ? districtRadius : 9} fill="#d8c69b" opacity="0.55" stroke="#62452d" strokeWidth="2" strokeDasharray="5 4"/>}
          {/* Last SVG layer: names never disappear behind geography or drawings. */}
          <g className="atlas-names-layer" aria-label="Map location names" pointerEvents="none">
            {visibleNames.map(n=><text key={n.key} x={n.drawX} y={n.drawY}
              fontSize={n.fontSize} textAnchor="middle" dominantBaseline="middle"
              className={`atlas-top-label ${n.key.startsWith('land-')?'atlas-top-label-land':''}`}>
              {n.name}
            </text>)}
          </g>
        </svg>
        <div className="map-corner-label">CARTOGRAPHIC SURVEY · VOL. V</div><div className="zoom-indicator">{Math.round(view.zoom*100)}%</div>
      </div>
        <div className="atlas-gadgets">
          <button className={`atlas-book-spine ${bookOpen?'opened':''}`} onClick={()=>setBookOpen(v=>!v)} aria-label={bookOpen?'Close atlas book':'Open atlas book'} title="Open the Atlas Journal"><span className="spine-ornament">✦</span><span>ATLAS<br/>JOURNAL</span><span className="spine-ornament">✦</span></button>
          <button className="atlas-magnifier" onClick={()=>setMagnifierOpen(v=>!v)} aria-label="Magnifier and zoom settings" title="Magnifier"><svg viewBox="0 0 50 50" width="49" height="49"><circle cx="20" cy="19" r="13" fill="#e9dfc0" stroke="#6b5034" strokeWidth="3"/><path d="M30 29L45 46" stroke="#6b5034" strokeWidth="6" strokeLinecap="round"/><path d="M14 19h12 M20 13v12" stroke="#8d7859" strokeWidth="2"/></svg></button>
          {magnifierOpen && <div className="magnifier-tray"><p>Magnification · {Math.round(view.zoom*100)}%</p><input aria-label="Map magnification" type="range" min="0.15" max="15" step="0.05" value={Math.min(view.zoom,15)} onChange={e=>setView(v=>({...v,zoom:Number(e.target.value)}))}/><p>Scroll over the map to zoom.</p></div>}
        </div>
        <aside className={`atlas-book ${bookOpen?'book-open':''}`} aria-hidden={!bookOpen}>
          <div className="book-binding"/><div className="book-pages">
            <div className="book-top"><div><span className="panel-kicker">BOTANICAL FIELD ARCHIVE</span><h2>Atlas Journal</h2></div><button onClick={()=>setBookOpen(false)} aria-label="Close atlas book">×</button></div>
            <nav className="book-tabs">{BOOK_PAGES.map(p=><button className={bookPage===p.key?'current':''} key={p.key} onClick={()=>showBook(p.key)}>{p.title}</button>)}</nav>
            <div className="book-content">
              {bookPage==='dictionary' && <>
                <h3>Dictionary of Living Forms</h3><p>Built-in scientific reference terms are protected. Community additions can be marked as Real Term or Magical, and can be deleted. Real Term submissions are not automatically verified.</p>
                <input placeholder="Search the dictionary" value={bookSearch} onChange={e=>setBookSearch(e.target.value)}/>
                <div className="book-records">{terms.filter(t=>(t.name+' '+t.description).toLowerCase().includes(bookSearch.toLowerCase())).map(t=><article className="book-entry" key={t.id}><div className="book-entry-title"><strong>{t.name}</strong><span>{t.builtin?'Built-in reference':t.kind==='real'?'Real term · unverified':'Magical · custom'}</span></div><p>{t.description}</p>{!t.builtin&&t.sourceUrl&&<p><a href={t.sourceUrl} target="_blank" rel="noopener noreferrer">Source / further reading ↗</a></p>}{!t.builtin&&<button className="record-delete" onClick={()=>deleteTerm(t)}>Delete custom term</button>}</article>)}</div>
                <h3>Add a Dictionary Term</h3><form onSubmit={addTerm}>
                  <label>Type of entry<select value={termKind} onChange={e=>setTermKind(e.target.value as 'real'|'magical')}><option value="real">Real Term — real-world science</option><option value="magical">Magical — fictional worldbuilding</option></select></label>
                  <p>{termKind==='real'?'Use established real-world terminology. Add a source so future readers can verify your entry.':'Describe your fictional organism group, plant family, or magical ecology.'}</p>
                  <label>Term or family name<input required value={termName} onChange={e=>setTermName(e.target.value)} placeholder={termKind==='real'?'Mycorrhiza':'Glassfern family'}/></label>
                  <label>Description<textarea required rows={3} value={termDescription} onChange={e=>setTermDescription(e.target.value)}/></label>
                  {termKind==='real'&&<label>Reference link (recommended)<input type="url" value={termSource} onChange={e=>setTermSource(e.target.value)} placeholder="https://..."/></label>}
                  <button type="submit">Save to Dictionary</button>
                </form>
              </>}
              {bookPage==='research' && <>
                <h3>Botanical Research Library</h3>
                <p>Open trusted botanical resources for deeper research. External sites open in a new tab; their material is not copied into the Atlas.</p>
                <div className="book-records">
                  <article className="book-entry"><strong>Royal Botanic Gardens, Kew — Plants of the World Online</strong><p>Plant taxonomy, accepted scientific names, geographic ranges and descriptions.</p><a href="https://powo.science.kew.org/" target="_blank" rel="noopener noreferrer">Explore Kew's plant database ↗</a></article>
                  <article className="book-entry"><strong>World Flora Online</strong><p>Global scientific plant-name and taxonomic reference.</p><a href="https://www.worldfloraonline.org/" target="_blank" rel="noopener noreferrer">Explore World Flora Online ↗</a></article>
                  <article className="book-entry"><strong>USDA PLANTS Database</strong><p>Plant profiles, distributions and conservation-related data, especially for the United States.</p><a href="https://plants.usda.gov/" target="_blank" rel="noopener noreferrer">Explore USDA PLANTS ↗</a></article>
                  <article className="book-entry"><strong>iNaturalist</strong><p>Community observations and photographic examples of organisms. Identifications can be community-supplied; verify important facts with authoritative references.</p><a href="https://www.inaturalist.org/" target="_blank" rel="noopener noreferrer">Explore observations ↗</a></article>
                </div>
                <p>When adding a Real Term to the dictionary, consider including a direct link to an authoritative definition or taxonomic record.</p>
              </>}
              {bookPage==='notes' && <><h3>Personal Field Notes</h3><form onSubmit={addNote}><label>Title<input value={noteTitle} onChange={e=>setNoteTitle(e.target.value)}/></label><label>Observation<textarea rows={4} value={noteText} onChange={e=>setNoteText(e.target.value)}/></label><label>Attach illustration<input type="file" accept="image/*" onChange={e=>void pickImage(e,setNoteImage)}/></label>{noteImage&&<div className="book-upload-preview"><img src={noteImage} alt="Unpublished note attachment"/><button type="button" onClick={()=>setNoteImage('')}>Remove image</button></div>}<button type="submit">Save Personal Note</button></form><div className="book-records">{book.notes.map(n=><article className="book-entry" key={n.id}><div className="book-entry-title"><strong>{n.title}</strong><span>{n.created}</span></div><p>{n.text}</p>{n.image&&<img className="book-thumbnail" src={n.image} alt={n.title}/>}<button className="record-delete" onClick={()=>deleteNote(n)}>Delete Note</button></article>)}</div></>}
              {!['dictionary','research','notes'].includes(bookPage) && <>
                <h3>{BOOK_PAGES.find(p=>p.key===bookPage)?.title}</h3><p>All records currently created in this atlas. Choose View on Map to return to their location.</p>
                <div className="book-records">{(
                  bookPage==='lands'?data.lands.map(l=>({id:l.id,title:l.name,detail:`${latitudeLabel(l.y)} · ${l.biome} · ${l.size||'Medium'} · ${l.description}`,record:l})): 
                  bookPage==='plants'?data.plants.map(p=>({id:p.id,title:p.name,detail:`${findTerm(p.termId)} · ${p.habitat} · ${p.description}`,record:p,image:p.image})): 
                  bookPage==='creatures'?data.creatures.map(c=>({id:c.id,title:c.name,detail:`${c.group} · ${c.habitat} · ${c.description}`,record:c,image:c.image})): 
                  bookPage==='districts'?data.districts.map(d=>({id:d.id,title:d.name,detail:`District of ${data.lands.find(l=>l.id===d.landId)?.name||data.biomes.find(b=>b.id===d.biomeId)?.name||'open ocean'} · ${d.description||'No description yet'}`,record:d,image:d.image})): 
                  bookPage==='landscapes'?data.features.map(f=>({id:f.id,title:f.kind,detail:`Landscape of ${data.lands.find(l=>l.id===f.landId)?.name||'unknown land'}`,record:f})): 
                  bookPage==='waters'?[...data.waters.map(w=>({id:w.id,title:w.name,detail:`${w.kind} · ${w.points.length} charted points`,record:w})),...data.biomes.filter(b=>b.realm==='aquatic').map(b=>({id:b.id,title:b.name,detail:`Aquatic biome · ${b.kind} · ${b.landId?'Coastal/land-associated':'Open sea'}`,record:b}))]: 
                  data.labels.map(l=>({id:l.id,title:l.name,detail:`Map label in ${data.lands.find(x=>x.id===l.landId)?.name||'unknown land'}`,record:l}))
                ).map(entry=><article key={entry.id} className="book-entry"><strong>{entry.title}</strong><p>{entry.detail}</p>{'image' in entry&&entry.image&&<img className="book-thumbnail" src={entry.image} alt={entry.title}/>}<button onClick={()=>viewRecord(bookPage,entry.record)}>View on Map</button></article>)}</div>
              </>}
            </div>
          </div>
        </aside>
        </div></section>
      <section className="atlas-workspace"><div className="atlas-panel"><p className="panel-kicker">THE CARTOGRAPHER'S DESK</p>
          {selectedWater && <section className="selected-water-panel">
            <h2>Selected Waterbody: {selectedWater.name}</h2>
            <p>{selectedWater.kind === 'river' ? 'River' : 'Pond / Lake'} · {selectedWater.points.length} charted points · Depth {selectedWater.depthMeters ?? 150} m</p>
            <div className="atlas-record-actions">
              <button type="button" onClick={() => startEdit('water',selectedWater.id,selectedWater.name)}>Edit Waterbody</button>
              <button type="button" className="record-delete" onClick={() => removeItem('water', selectedWater.id, selectedWater.name)}>Delete Waterbody</button>
              <button type="button" onClick={() => setSelectedWaterId(null)}>Deselect</button>
            </div>
          </section>}
          <details className="terrain-records"><summary>Land Elevation & Depression Regions ({(data.depthPatches||[]).length})</summary>
            {(data.depthPatches||[]).map(dp=><div className="atlas-record-row" key={dp.id}><span>{dp.name} · signed change {dp.depthMeters} m</span><button type="button" onClick={()=>startEdit('depth',dp.id,dp.name)}>Edit</button><button type="button" className="record-delete" onClick={()=>{if(window.confirm(`Delete terrain region ${dp.name}?`))setData(d=>({...d,depthPatches:(d.depthPatches||[]).filter(p=>p.id!==dp.id)}))}}>Delete</button></div>)}
          </details>
        {editTarget && <div className="edit-atlas-record"><h3>Edit {editTarget.kind}</h3><label>Name / label<input value={editName} onChange={e=>setEditName(e.target.value)}/></label>{['district','biome','depth'].includes(editTarget.kind)&&<label>Region size<input type="range" min="8" max="180" value={editRadius} onChange={e=>setEditRadius(Number(e.target.value))}/></label>}{['biome','depth','feature'].includes(editTarget.kind)&&<label>{editTarget.kind==='depth'?'Signed terrain change (m)':'Aquatic depth (m)'}<input type="number" value={editDepth} min={editTarget.kind==='depth'?-11000:0} max={editTarget.kind==='depth'?8800:11000} onChange={e=>setEditDepth(Number(e.target.value))}/></label>}{!['water','plant','creature'].includes(editTarget.kind)&&<><label>Map X<input type="number" value={editX} onChange={e=>setEditX(Number(e.target.value))}/></label><label>Map Y<input type="number" value={editY} onChange={e=>setEditY(Number(e.target.value))}/></label></>}{['land','district'].includes(editTarget.kind)&&<label>Description<textarea value={editDescription} onChange={e=>setEditDescription(e.target.value)}/></label>}{editTarget.kind==='district'&&<><label>District image<input type="file" accept="image/*" onChange={e=>void pickImage(e,setEditDistrictImage)}/></label>{editDistrictImage&&<div className="book-upload-preview"><img src={editDistrictImage} alt="District image preview"/><button type="button" onClick={()=>setEditDistrictImage('')}>Remove image</button></div>}</>}<button onClick={saveEditedRecord}>Save Changes</button><button onClick={()=>setEditTarget(null)}>Cancel</button><p>To reposition or reshape existing geometry, we'll add draggable handles in a later version.</p></div>}
        {tool === 'explore' && <>
          <h2>{district ? district.name : land ? land.name : 'Uncharted Waters'}</h2>
          <p>{district ? `District of ${land?.name||activeAquaticBiome?.name||'Open Ocean'}` : land ? `${latitudeLabel(land.y)} · ${land.biome} · ${land.size || 'Medium'}` : 'Select a land or create one to begin.'}</p>
          {district && <section className="district-profile"><h3>District Profile</h3>{district.description ? <p>{district.description}</p> : <p>No description recorded yet.</p>}{district.image && <img className="district-profile-image" src={district.image} alt={`Illustration of ${district.name}`} />}<div className="atlas-record-actions"><button type="button" onClick={()=>startEdit('district',district.id,district.name)}>Edit Description / Image</button>{deleteRow('district',district.id,district.name)}</div></section>}
          {!land && activeAquaticBiome && <><h2>{activeAquaticBiome.name}</h2><p>Selected aquatic biome · Organism Register is available to the right.</p><button onClick={()=>startEdit('biome',activeAquaticBiome.id,activeAquaticBiome.name)}>Edit Biome</button></>}
          {!land && <><h3>Open Ocean Biome Regions</h3>{data.biomes.filter(b=>!b.landId).map(b=><div key={b.id} className="atlas-record-row"><span>{b.name} ({b.kind})</span><button onClick={()=>startEdit('biome',b.id,b.name)}>Edit</button><button className="record-delete" onClick={()=>{if(window.confirm(`Delete biome ${b.name}?`))setData(d=>({...d,biomes:d.biomes.filter(x=>x.id!==b.id)}))}}>Delete</button></div>)}</>}{district && !land && <><p>Independent offshore district · {latitudeLabel(district.y)}</p></>}
          {land && <>
            <p>{land.description}</p>          <h3>Local Climate & Oceanography</h3>
          <p>Latitude: {latitudeLabel(land.y)} · longitude: {longitudeAt(land.x).toFixed(1)}°. These are broad ecological guides, not a physical climate simulation.</p>
          <button type="button" onClick={()=>{setClimateDraft({...climate});setElevationDraft(climate.elevation)}}>Load This Land's Climate Values</button>
          <div className="ecology-form-grid">
            <label>Annual rainfall (mm)<input type="number" min="0" max="15000" value={climateDraft.rainfall} onChange={e=>setClimateDraft(v=>({...v,rainfall:Number(e.target.value)}))}/></label>
            
            <label>Temperature (°C)<input type="number" min="-80" max="80" value={climateDraft.temperature} onChange={e=>setClimateDraft(v=>({...v,temperature:Number(e.target.value)}))}/></label>
            <label>Salinity<select value={climateDraft.salinity} onChange={e=>setClimateDraft(v=>({...v,salinity:e.target.value}))}><option>Fresh</option><option>Brackish</option><option>Marine</option></select></label>
          </div>
          <button type="button" onClick={saveClimate}>Save Climate for This Land</button>
          <p>Current saved conditions: {climate.rainfall} mm rain, {climate.temperature}°C, {climate.salinity} local water conditions.</p>

          <button type="button" onClick={()=>startEdit('land',land.id,land.name,land.description)}>Edit Land Name / Description</button>
            <h3>Districts</h3>
            {data.districts.filter(d => d.landId === land.id).map(d => <div className="atlas-record-row" key={d.id}>
              <button type="button" onClick={() => setSelectedDistrictId(d.id)}>{d.name}{d.biomeId ? ` · ${data.biomes.find(b=>b.id===d.biomeId)?.name||'Biome removed'}` : ''}{selectedDistrictId === d.id ? ' (selected)' : ''}</button>
              <button type="button" onClick={()=>startEdit('district',d.id,d.name)}>Edit</button>{deleteRow('district', d.id, d.name)}
            </div>)}
            {district && <button type="button" onClick={() => setSelectedDistrictId(null)}>Back to Whole Land</button>}
            <h3>{district ? `Plants in ${district.name}` : 'Land Plant Records'} ({localPlants.length})</h3>
            {localPlants.map(p => <div className="plant-record" key={p.id}>
              <strong>{p.name}</strong><p>Classification: {findTerm(p.termId)} · Biome: {data.biomes.find(b=>b.id===p.biomeId)?.name||'Unassigned'}</p><p>{p.habitat}</p><p>{p.description}</p>{p.image&&<img className="plant-illustration" src={p.image} alt={`Illustration of ${p.name}`}/>}
              <div className="atlas-record-actions">
                {district && <button className="record-delete" type="button" onClick={() => detachPlant(p.id)}>Remove from District</button>}
                <button type="button" onClick={()=>startEdit('plant',p.id,p.name)}>Edit</button>{deleteRow('plant', p.id, p.name + ' and its occurrences everywhere')}
              </div>
            </div>)}
            <h3>Biome Regions ({data.biomes.filter(b => b.landId === land.id).length})</h3>
            {data.biomes.filter(b => b.landId === land.id).map(b => <div key={b.id} className="atlas-record-row">
              <span>{b.name} — {b.kind} ({b.realm||'terrestrial'}){b.magical ? ' (magical)' : ''}; districts: {data.districts.filter(d=>d.biomeId===b.id).length}, species: {data.plants.filter(p=>p.biomeId===b.id).length}, wildlife: {data.creatures.filter(c=>c.biomeId===b.id).length}</span>
              <button type="button" onClick={()=>startEdit('biome',b.id,b.name)}>Edit</button>{deleteRow('biome', b.id, b.name)}
            </div>)}
            <h3>Landscape Markers ({data.features.filter(f => f.landId === land.id).length})</h3>
            {data.features.filter(f => f.landId === land.id).map(f => <div key={f.id} className="atlas-record-row">
              <span>{f.kind}</span><button type="button" onClick={()=>startEdit('feature',f.id,f.kind)}>Edit</button>{deleteRow('feature', f.id, f.kind + ' marker')}
            </div>)}
            <h3>Rivers, Ponds & Lakes ({data.waters.filter(w => w.landId === land.id).length})</h3>
            {data.waters.filter(w => w.landId === land.id).map(w => <div key={w.id} className="atlas-record-row">
              <span>{w.name} ({w.kind})</span><button type="button" onClick={()=>startEdit('water',w.id,w.name)}>Edit</button>{deleteRow('water', w.id, w.name)}
            </div>)}
            <h3>Map Labels ({data.labels.filter(x => x.landId === land.id).length})</h3>
            {data.labels.filter(x => x.landId === land.id).map(x => <div key={x.id} className="atlas-record-row">
              <span>{x.name}</span><button type="button" onClick={()=>startEdit('label',x.id,x.name)}>Edit</button>{deleteRow('label', x.id, x.name)}
            </div>)}
            <h3>Whole Land</h3>
            <button type="button" className="delete-land-button" onClick={deleteLand}>Delete This Land and Its Contents</button>
          </>}
        </>}
        {tool === 'drawland' && <><h2>Draw Your Own Land</h2><p>{drawing.length} coastline points. Choose at least three; corners will be smoothed.</p><label>Land name<input value={name} onChange={e=>setName(e.target.value)} placeholder="New continent"/></label><label>Description<textarea value={description} onChange={e=>setDescription(e.target.value)}/></label><label className="atlas-check"><input type="checkbox" checked={magical} onChange={e=>setMagical(e.target.checked)}/>Magical environment</label>{magical && <><label>Climate override<select value={ALL_BIOMES.includes(biomeType)?biomeType:ALL_BIOMES[0]} onChange={e=>setBiomeType(e.target.value)}>{ALL_BIOMES.map(b=><option key={b}>{b}</option>)}</select></label><label>Custom name<input value={biomeName} onChange={e=>setBiomeName(e.target.value)}/></label></>}<button disabled={drawing.length<3||!name.trim()} onClick={finishCustomLand}>Finish Land</button><button onClick={()=>setDrawing(v=>v.slice(0,-1))} disabled={!drawing.length}>Undo Last Point</button><button onClick={()=>setDrawing([])}>Clear Coastline</button></>}
        {tool === 'land' && <><h2>Found a New Land</h2><label>Land size<select value={size} onChange={e=>setSize(e.target.value as Size)}>{Object.keys(SIZES).map(s=><option key={s}>{s}</option>)}</select></label>{!point ? <p>Click on the map to position your land.</p> : <form onSubmit={submit}><p>Latitude: {latitudeLabel(point.y)}</p><label>Land name<input value={name} onChange={e=>setName(e.target.value)} required/></label><label>Description<textarea value={description} onChange={e=>setDescription(e.target.value)}/></label><label className="atlas-check"><input type="checkbox" checked={magical} onChange={e=>setMagical(e.target.checked)}/>Magical environment</label>{magical && <><label>Environment<select value={selectedBiome} onChange={e=>setBiomeType(e.target.value)}>{ALL_BIOMES.map(b=><option key={b}>{b}</option>)}</select></label><label>Custom environment name (optional)<input value={biomeName} onChange={e=>setBiomeName(e.target.value)} placeholder="e.g. The Eternal Bloom"/></label></>}<p>Natural suggestion: {naturalBiomes(point.y)[0]}</p><button type="submit">Establish Land</button></form>}</>}
        {['district','biome','label','depth'].includes(tool) && <><h2>{tool === 'district' ? 'Create a District' : tool === 'biome' ? 'Paint a Biome Region' : tool==='depth'?'Raise / Lower Land':'Place a Map Label'}</h2><p>Region: {tool === 'depth' ? (land?.name || 'Select a land') : (land?.name||'Open ocean / independent habitat')}</p>{tool === 'depth' && <><label>Land height change (meters; positive raises, negative creates a depression)<input type="number" min="-11000" max="8800" step="100" value={depthMeters} onChange={e=>setDepthMeters(clamp(Number(e.target.value),-11000,8800))}/></label><label>Terrain region radius<input type="range" min="10" max="160" value={depthRadius} onChange={e=>setDepthRadius(Number(e.target.value))}/></label><p>Organic terrain patches can be placed only on land. Overlapping patches raise or lower land cumulatively, capped at −11,000 m and +8,800 m. Cold conditions produce pale highland terrain, while authored biome patches remain visible on top. Natural biome choices account for the total local elevation. The coastline remains unchanged.</p></>}{tool === 'district' && <><label>District radius<input type="range" min="10" max="70" value={districtRadius} onChange={e=>setDistrictRadius(Number(e.target.value))}/></label><label>District description<textarea rows={3} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Describe this district's landscape, culture or habitats..."/></label><label>District illustration (optional)<input type="file" accept="image/*" onChange={e=>void pickImage(e,setDistrictImage)}/></label>{districtImage&&<div className="book-upload-preview"><img src={districtImage} alt="District illustration preview"/><button type="button" onClick={()=>setDistrictImage('')}>Remove image</button></div>}</>}{tool === 'biome' && <>{(realm==='aquatic'||siteAquatic)&&<label>Water depth (meters, aquatic habitat)<input type="number" min="0" max="11000" value={depthMeters} onChange={e=>setDepthMeters(Number(e.target.value))}/></label>}<label>Biome patch size<input type="range" min="10" max="110" value={biomeRadius} onChange={e=>setBiomeRadius(Number(e.target.value))}/></label><label className="atlas-check"><input type="checkbox" checked={magical} onChange={e=>setMagical(e.target.checked)}/>Magical climate override</label><label>Ecological realm<select value={realm} onChange={e=>{setRealm(e.target.value as 'terrestrial'|'aquatic');setBiomeType('');}}><option value="terrestrial">Terrestrial / land</option><option value="aquatic">Aquatic / marine / freshwater</option></select></label><p>Natural choices account for latitude, rainfall and combined terrain elevation on land, or salinity/depth in water. Longitude: {point?longitudeAt(point.x).toFixed(1):land?longitudeAt(land.x).toFixed(1):'0'}°. Longitude locates a region but does not determine climate by itself.</p><p><strong>Placement:</strong> {point?biomeScope:'Click anywhere on land, a lake/river, or the ocean.'} · Natural land: {naturalLandHere} · Natural water: {naturalWaterHere}. Crossing a shoreline automatically uses the appropriate natural biome on each side. Magical patches keep their chosen identity throughout.</p><label>Biome type<select value={selectedBiome} onChange={e=>setBiomeType(e.target.value)}>{biomesToChoose.map(b=><option key={b}>{b}</option>)}</select></label><label>Custom biome name<input value={biomeName} onChange={e=>setBiomeName(e.target.value)} placeholder="Optional local name"/></label></>}{!point ? <p>Click the map to position this region. Elevation patches must be placed on land; biomes may cross into water.</p> : <form onSubmit={submit}>{tool !== 'biome' && tool!=='depth' && <label>Name<input value={name} onChange={e=>setName(e.target.value)} required/></label>}<button type="submit">{tool === 'district' ? 'Create District' : tool === 'biome' ? 'Add Biome' : tool==='depth'?'Apply Terrain Change':'Place Label'}</button></form>}</>}
        {tool === 'feature' && <><h2>Landscape Illustration</h2><p>{point?featureIsAquatic?'Aquatic environment':'Terrestrial environment':'Choose a position to see compatible landscapes.'}</p><label>Feature<select value={chosenFeature} onChange={e=>setFeatureKind(e.target.value)}>{featureChoices.map(x=><option key={x}>{x}</option>)}</select></label>{featureIsAquatic&&<label>Water depth (meters)<input type="number" min="0" max="11000" value={depthMeters} onChange={e=>setDepthMeters(Number(e.target.value))}/></label>}<p>{point ? 'Location chosen.' : 'Click on land or in water.'}</p><button disabled={!point} onClick={placeFeature}>Place Feature</button></>}
        {(tool === 'river' || tool === 'pond') && <><h2>{tool === 'river' ? 'Draw a River' : 'Draw a Pond or Lake'}</h2><p>{drawing.length} points chosen. {tool==='pond' ? 'Choose at least three points for an enclosed shape.' : 'Choose at least two points for a river.'}</p><label>Water depth (meters)<input type="number" min="0" max="11000" value={depthMeters} onChange={e=>setDepthMeters(Number(e.target.value))}/></label>{tool === 'river' && <label>River width<input type="range" min="3" max="28" value={waterWidth} onChange={e=>setWaterWidth(Number(e.target.value))}/></label>}<label>Water body name<input value={name} onChange={e=>setName(e.target.value)}/></label><button disabled={drawing.length < (tool==='pond'?3:2)} onClick={finishWater}>Finish Drawing</button><button onClick={()=>setDrawing(v=>v.slice(0,-1))} disabled={!drawing.length}>Undo Last Point</button><button onClick={()=>setDrawing([])}>Clear Points</button></>}
      </div>
      <div className="atlas-panel"><p className="panel-kicker">THE BOTANICAL REGISTER</p><h2>{district ? `Ecology of ${district.name}` : activeAquaticBiome ? `Ecology of ${activeAquaticBiome.name}` : 'Organism Register'}</h2>{organismScope && <nav className="organism-tabs"><button className={organismTab==='plants'?'selected':''} onClick={()=>setOrganismTab('plants')} type="button">Plants, Fungi & Algae</button><button className={organismTab==='wildlife'?'selected':''} onClick={()=>setOrganismTab('wildlife')} type="button">Animals & Aquatic Life</button><button className={organismTab==='relationships'?'selected':''} onClick={()=>setOrganismTab('relationships')} type="button">Ecological Relationships</button></nav>}{!organismScope ? <p>Select a land or an aquatic biome to register organisms. Terrestrial biomes outside lands do not have an independent register.</p> : <>{organismTab==='plants' && <><form onSubmit={addPlant}><p>{district ? `New species in ${district.name}` : `New species in ${activeAquaticBiome?.name || land?.name}`}</p><label>Species name<input value={plantName} onChange={e=>setPlantName(e.target.value)} required placeholder="Silvervein Yarrow"/></label><label>Habitat<input value={habitat} onChange={e=>setHabitat(e.target.value)}/></label><label>Classification (optional)<select value={plantTermId} onChange={e=>setPlantTermId(e.target.value)}><option value="">Not classified</option>{terms.map(t=><option key={t.id} value={t.id}>{t.name}{t.builtin?' · reference':t.kind==='real'?' · real (submitted)':' · magical'}</option>)}</select></label><label>Biome / habitat patch (optional)<select value={plantBiome} onChange={e=>setPlantBiome(e.target.value)}><option value="">General land record</option>{localBiomeOptions.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label><button type="button" onClick={()=>showBook('dictionary')}>Browse / Create Dictionary Terms</button><label>Observations<textarea value={plantNotes} onChange={e=>setPlantNotes(e.target.value)} rows={3}/></label><label>Botanical illustration (optional)<input type="file" accept="image/*" onChange={e=>void pickImage(e,setPlantImage)}/></label>{plantImage&&<div className="book-upload-preview"><img src={plantImage} alt="Plant illustration ready to save"/><button type="button" onClick={()=>setPlantImage('')}>Remove image</button></div>}<button type="submit">Create Plant Record</button></form>{district && <><h3>Add an Existing Species</h3><p>Select an existing species without duplicating its encyclopedia record.</p><select value={existingPlant} onChange={e=>setExistingPlant(e.target.value)}><option value="">Choose a plant</option>{data.plants.filter(p=>inCurrentScope(p) && !data.occurrences.some(o=>o.districtId===district.id && o.plantId===p.id)).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select><button disabled={!existingPlant} onClick={attachPlant}>Add to This District</button></>}</> }</>}
        {organismScope && <>
          <h3>Biomes as Local Habitats</h3>
          <p>Plant and wildlife records can be assigned to a specific biome. Districts may be placed inside biome regions using the District tool.</p>
          {organismTab==='wildlife' && <><h3>Wildlife & Aquatic Life</h3>
          <form onSubmit={createCreature}>
            <label>Name<input value={creatureName} onChange={e=>setCreatureName(e.target.value)} required placeholder="Glassfin lanternfish"/></label>
            <label>Organism group<select value={creatureGroup} onChange={e=>setCreatureGroup(e.target.value)}>{['Insect','Arachnid','Other arthropod','Mammal','Bird','Reptile','Amphibian','Fish','Mollusk','Crustacean','Cnidarian','Echinoderm','Marine invertebrate','Plankton','Other animal','Magical organism'].map(g=><option key={g}>{g}</option>)}</select></label>
            <label>District (optional)<select value={district?.id||''} disabled><option value="">Whole land / not in district</option>{data.districts.filter(d=>land ? d.landId===land.id : d.biomeId===scopeBiomeId).map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
            <label>Biome (optional)<select value={creatureBiome} onChange={e=>setCreatureBiome(e.target.value)}><option value="">Unassigned</option>{localBiomeOptions.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
            <label>Habitat<input value={creatureHabitat} onChange={e=>setCreatureHabitat(e.target.value)}/></label>
            <label>Description and adaptations<textarea rows={3} value={creatureNotes} onChange={e=>setCreatureNotes(e.target.value)}/></label>
            <label>Illustration (optional)<input type="file" accept="image/*" onChange={e=>void pickImage(e,setCreatureImage)}/></label>
            {creatureImage&&<div className="book-upload-preview"><img src={creatureImage} alt="Wildlife illustration preview"/><button type="button" onClick={()=>setCreatureImage('')}>Remove image</button></div>}
            <button type="submit">Register Organism</button>
          </form>
          {localCreatures.map(c=><article key={c.id} className="plant-record"><strong>{c.name} · {c.group}</strong><p>{c.habitat} — {c.description}</p>{c.image&&<img className="plant-illustration" src={c.image} alt={c.name}/>}<p>Biome: {data.biomes.find(b=>b.id===c.biomeId)?.name||'Unassigned'}</p><button type="button" onClick={()=>startEdit('creature',c.id,c.name)}>Edit</button>{deleteRow('creature', c.id,c.name)}</article>)}
          </>}
          {organismTab==='relationships' && <><h3>Ecological Relationships</h3>
          <p>Organisms include plants, fungi, algae, and animals together. Connect any two listed species; relationships are descriptive, not yet simulated.</p>
          <form onSubmit={createRelation}>
            <label>Organism A<select required value={relationSource} onChange={e=>setRelationSource(e.target.value)}><option value="">Choose organism</option>{organisms.map(o=><option value={o.id} key={o.id}>{o.name}</option>)}</select></label>
            <label>Organism B<select required value={relationTarget} onChange={e=>setRelationTarget(e.target.value)}><option value="">Choose organism</option>{organisms.map(o=><option value={o.id} key={o.id}>{o.name}</option>)}</select></label>
            <label>Relationship<select value={relationKind} onChange={e=>setRelationKind(e.target.value)}>{['Mutualism','Pollination','Seed dispersal','Parasitism','Predation','Herbivory','Competition','Commensalism','Symbiosis','Decomposition','Shelter / habitat','Other'].map(k=><option key={k}>{k}</option>)}</select></label>
            <label>Field observation<textarea value={relationNotes} onChange={e=>setRelationNotes(e.target.value)}/></label>
            <button type="submit" disabled={!relationSource||!relationTarget||relationSource===relationTarget}>Save Relationship</button>
          </form>
          {data.relations.filter(r=>r.landId===scopeLandId && organisms.some(o=>o.id===r.sourceId) && organisms.some(o=>o.id===r.targetId)).map(r=><div key={r.id} className="atlas-record-row"><span>{organismName(r.sourceId)} — {r.kind} — {organismName(r.targetId)}. {r.description}</span>{deleteRow('relation',r.id,r.kind+' relationship')}</div>)}
          </>}
        </>}
        {organismScope && <>
          <h3>{activeAquaticBiome ? 'Species of This Aquatic Biome' : 'All Species in This Land'}</h3>
          <p>Deleting a species here removes it from every district that uses it.</p>
          {data.plants.filter(inCurrentScope).map(p =>
            <div key={p.id} className="atlas-record-row"><span>{p.name}</span><button type="button" onClick={()=>startEdit('plant',p.id,p.name)}>Edit</button>{deleteRow('plant', p.id, p.name)}</div>
          )}
        </>}
      </div></section>
      <section className="notes">{storageWarning&&<p role="alert">{storageWarning}</p>}<p>{data.lands.length} lands · {data.districts.length} districts · {data.plants.length} plant species</p><p>Prototype records are saved only in this browser.</p></section>
    </main>
  );
}
