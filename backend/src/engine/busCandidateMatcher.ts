import type { Bus, Route } from '../../../packages/shared/src/types/bus.js';

export interface BusCandidateInput {
  latitude: number; longitude: number; accuracyMeters: number;
  speedKmh?: number; headingDegrees?: number; observedAt?: string;
}
export interface BusCandidateScore {
  busId: string; busLabel: string; routeId: string; routeName: string;
  score: number; routeDistanceMeters: number; scheduleDeviationMinutes: number;
  evidence: string[];
}
export interface BusCandidateResult {
  status: 'VERIFIED_CANDIDATE' | 'AMBIGUOUS' | 'NO_MATCH';
  selected?: BusCandidateScore;
  candidates: BusCandidateScore[];
  explanation: string;
}
const rad=(n:number)=>n*Math.PI/180;
function distance(a:{latitude:number;longitude:number},b:{latitude:number;longitude:number}) {
 const R=6371000, dLat=rad(b.latitude-a.latitude), dLon=rad(b.longitude-a.longitude);
 const x=Math.sin(dLat/2)**2+Math.cos(rad(a.latitude))*Math.cos(rad(b.latitude))*Math.sin(dLon/2)**2;
 return 2*R*Math.asin(Math.sqrt(x));
}
function bearing(a:{latitude:number;longitude:number},b:{latitude:number;longitude:number}) {
 const y=Math.sin(rad(b.longitude-a.longitude))*Math.cos(rad(b.latitude));
 const x=Math.cos(rad(a.latitude))*Math.sin(rad(b.latitude))-Math.sin(rad(a.latitude))*Math.cos(rad(b.latitude))*Math.cos(rad(b.longitude-a.longitude));
 return (Math.atan2(y,x)*180/Math.PI+360)%360;
}
function angleDiff(a:number,b:number) { const d=Math.abs((a-b)%360); return Math.min(d,360-d); }
function clock(v:string) { const m=/^(\d{1,2}):(\d{2})$/.exec(v); return m?Number(m[1])*60+Number(m[2]):undefined; }
function nowIST(date:Date) {
 const p=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date);
 return Number(p.find(x=>x.type==='hour')?.value||0)*60+Number(p.find(x=>x.type==='minute')?.value||0);
}
function routeDistance(point:{latitude:number;longitude:number}, route:Route) {
 const points=route.geometry?.length ? route.geometry : [...route.stops].sort((a,b)=>a.stopSequence-b.stopSequence);
 if(!points.length) return Number.POSITIVE_INFINITY;
 let best=Number.POSITIVE_INFINITY;
 for(const p of points) best=Math.min(best,distance(point,p));
 return best;
}
/**
 * Ranks possible bus identities using a consented, single GPS/network fix.
 * It deliberately refuses to infer a unique bus where schedules or route geometry overlap.
 */
export function rankBusCandidates(buses:Bus[], routes:Route[], input:BusCandidateInput, now=new Date()):BusCandidateResult {
 const point={latitude:input.latitude,longitude:input.longitude};
 const day=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Kolkata',weekday:'short'}).format(now).toUpperCase();
 const minute=nowIST(now);
 const scores:BusCandidateScore[]=[];
 for(const bus of buses) {
  if(!bus.isActive||!bus.routeId) continue;
  const route=routes.find(r=>r.id===bus.routeId);
  if(!route||!route.operatingDays.includes(day as any)) continue;
  const corridor=routeDistance(point,route);
  if(!Number.isFinite(corridor)||corridor>Math.max(1200,input.accuracyMeters*2.5)) continue;
  const departures=(route.departures||[]).filter(d=>!d.isCancelled&&d.operatingDays.includes(day as any)&&(!d.busIdentifier||d.busIdentifier.toLowerCase()===bus.publicIdentifier.toLowerCase()));
  const scheduled=departures.map(d=>clock(d.departureTime)).filter((x):x is number=>x!==undefined);
  if(!scheduled.length) {
   const first=clock(route.firstDepartureTime), last=clock(route.lastDepartureTime);
   if(first===undefined||last===undefined||minute<first-15||minute>last+route.typicalDurationMinutes) continue;
  }
  const nearestSchedule=scheduled.length?Math.min(...scheduled.map(t=>Math.abs(minute-t))):Math.abs(minute-(clock(route.firstDepartureTime)??minute));
  // Single-point candidate is weak evidence; a timetable match cannot verify physical bus identity.
  let score=45;
  const evidence=['Route corridor proximity'];
  if(corridor<=150){score+=25;evidence.push('Within 150m of route');}
  else if(corridor<=500){score+=15;evidence.push('Within 500m of route');}
  else score+=5;
  if(input.accuracyMeters<=30){score+=10;evidence.push('High-accuracy location sample');}
  else if(input.accuracyMeters>500){score-=15;evidence.push('Low-accuracy location sample');}
  if(scheduled.length) {
   if(nearestSchedule<=10){score+=12;evidence.push('Bus-specific departure time is close');}
   else if(nearestSchedule<=30){score+=6;evidence.push('Departure time is plausible');}
   else score-=Math.min(20,nearestSchedule/3);
  }
  if(input.speedKmh!==undefined) {
   if(input.speedKmh<0||input.speedKmh>120) score-=20;
   else if(input.speedKmh>=5&&input.speedKmh<=90){score+=4;evidence.push('Plausible vehicle speed');}
  }
  if(input.headingDegrees!==undefined&&route.stops.length>=2) {
   const ordered=[...route.stops].sort((a,b)=>a.stopSequence-b.stopSequence);
   const expected=bearing(ordered[0],ordered[ordered.length-1]);
   if(angleDiff(input.headingDegrees,expected)<=55){score+=8;evidence.push('Heading broadly follows route direction');}
   else {score-=12;evidence.push('Heading differs from route direction');}
  }
  scores.push({busId:bus.id,busLabel:bus.publicIdentifier,routeId:route.id,routeName:route.routeName,score:Math.max(0,Math.min(100,Math.round(score))),routeDistanceMeters:Math.round(corridor),scheduleDeviationMinutes:Math.round(nearestSchedule),evidence});
 }
 scores.sort((a,b)=>b.score-a.score);
 if(!scores.length) return {status:'NO_MATCH',candidates:[],explanation:'No active scheduled bus has a route corridor compatible with this location and time.'};
 const first=scores[0], second=scores[1];
 // A single point can only produce a candidate, never final bus identity verification.
 if(first.score>=75&&(!second||first.score-second.score>=18)) return {status:'VERIFIED_CANDIDATE',selected:first,candidates:scores.slice(0,5),explanation:'Strong route/time candidate only. Confirm with a second independent time-separated movement sample before attaching passenger evidence to this bus.'};
 return {status:'AMBIGUOUS',candidates:scores.slice(0,5),explanation:'Multiple buses or insufficient evidence. Do not assign this passenger to a bus yet; collect a second consented sample and compare movement over time.'};
}
