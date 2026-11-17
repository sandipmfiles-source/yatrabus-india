import { TransitRepository } from '../../backend/src/db/repository.js';

export function runTrackingSessionTests(assert:(description:string,pass:boolean)=>void) {
 const repository = new TransitRepository();
 const now = Date.now();
 const sessionId = 'test-destination-' + now;
 repository.createJourneySession({
  sessionId,busId:'test-bus',routeId:'test-route',destinationStopId:'test-stop',
  startTime:new Date(now).toISOString(),lastActiveTime:new Date(now).toISOString(),
  maxExpiryTime:new Date(now+60*60*1000).toISOString(),isActive:true,isConfirmedPassenger:true,
  observationsContributedCount:0,
 });
 const first=repository.recordDestinationArrival(sessionId,true,new Date(now).toISOString());
 assert('One destination GPS confirmation does not end the journey',!first && repository.getJourneySession(sessionId)?.isActive===true);
 const second=repository.recordDestinationArrival(sessionId,true,new Date(now+25_000).toISOString());
 assert('Two time-separated destination confirmations complete the journey',second && repository.getJourneySession(sessionId)?.isActive===false);
 assert('Automatic destination completion records JOURNEY_COMPLETED',repository.getJourneySession(sessionId)?.stoppedReason==='JOURNEY_COMPLETED');

 const resetId='test-destination-reset-'+now;
 repository.createJourneySession({
  sessionId:resetId,busId:'test-bus',routeId:'test-route',destinationStopId:'test-stop',
  startTime:new Date(now).toISOString(),lastActiveTime:new Date(now).toISOString(),
  maxExpiryTime:new Date(now+60*60*1000).toISOString(),isActive:true,isConfirmedPassenger:true,
  observationsContributedCount:0,
 });
 repository.recordDestinationArrival(resetId,true,new Date(now).toISOString());
 repository.recordDestinationArrival(resetId,false,new Date(now+25_000).toISOString());
 const afterReset=repository.recordDestinationArrival(resetId,true,new Date(now+50_000).toISOString());
 assert('Leaving the destination geofence resets the arrival confirmation sequence',!afterReset && repository.getJourneySession(resetId)?.isActive===true);
}
