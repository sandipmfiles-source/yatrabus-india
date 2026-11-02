import { rankBusCandidates } from '../../backend/src/engine/busCandidateMatcher.js';
import type { Bus, Route } from '../../packages/shared/src/types/bus.js';

const route: Route = {
 id:'r-test', routeNumber:'RT1', routeName:'Test corridor', originStopId:'a', originStopName:'A',
 destinationStopId:'b', destinationStopName:'B', operatorId:'op', direction:'UP', distanceKm:10,
 typicalDurationMinutes:30, operatingDays:['MON','TUE','WED','THU','FRI','SAT','SUN'],
 firstDepartureTime:'06:00', lastDepartureTime:'22:00',
 departures:[{id:'d1',timetableId:'t1',departureTime:'06:00',arrivalTime:'06:30',busIdentifier:'WB-01',operatingDays:['MON','TUE','WED','THU','FRI','SAT','SUN'],confidenceScore:90,isCancelled:false}],
 stops:[
  {id:'s1',routeId:'r-test',stopId:'a',stopName:'A',stopSequence:1,latitude:22.45,longitude:87.32,distanceFromStartKm:0},
  {id:'s2',routeId:'r-test',stopId:'b',stopName:'B',stopSequence:2,latitude:22.50,longitude:87.40,distanceFromStartKm:10},
 ],
 geometry:[{latitude:22.45,longitude:87.32},{latitude:22.50,longitude:87.40}],
 verificationStatus:'ADMIN_VERIFIED',serviceStatus:'OPERATING_SCHEDULED',createdAt:'',updatedAt:'',
};
const bus: Bus = {
 id:'bus-1',publicIdentifier:'WB-01',operatorId:'op',routeId:'r-test',vehicleType:'ORDINARY',
 hasCustomSvgIllustration:true,serviceStatus:'OPERATING_SCHEDULED',verificationStatus:'ADMIN_VERIFIED',
 isActive:true,createdAt:'',updatedAt:'',
};
export function runBusCandidateMatcherTests(assert:(description:string,pass:boolean)=>void) {
 const now=new Date('2026-11-02T00:05:00.000Z'); // 05:35 IST
 const input={latitude:22.475,longitude:87.36,accuracyMeters:15,speedKmh:35,headingDegrees:55};
 const single=rankBusCandidates([bus],[route],input,now);
 assert('A matching route and scheduled bus is returned as a candidate, never verified identity',single.status==='LIKELY_CANDIDATE' && single.selected?.busId==='bus-1');
 assert('Candidate result explicitly requires a second movement sample',single.explanation.includes('second independent'));
 const other={...bus,id:'bus-2',publicIdentifier:'WB-02'};
 const ambiguous=rankBusCandidates([bus,other],[{...route,departures:[{...route.departures![0],busIdentifier:undefined}]}],input,now);
 assert('Two indistinguishable buses remain ambiguous',ambiguous.status==='AMBIGUOUS' && !ambiguous.selected);
 const outside=rankBusCandidates([bus],[route],{...input,latitude:23.2,longitude:88.1},now);
 assert('Location far outside route produces no match',outside.status==='NO_MATCH');
 const inactive=rankBusCandidates([{...bus,isActive:false}],[route],input,now);
 assert('Inactive bus is never considered',inactive.status==='NO_MATCH');
}
