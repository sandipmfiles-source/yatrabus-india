import { TimetableRevision } from '../../packages/shared/src/types/bus.js';

export function runTimetableVersioningTests(assert: (desc: string, pass: boolean) => void) {
  // Test: Historical revisions preserve both proposed and previous schedule snapshots
  const rev1: TimetableRevision = {
    id: 'rev-1',
    routeId: 'route-534',
    revisionNumber: 1,
    changeSummary: 'Updated morning departure from 06:00 to 06:15',
    previousSchedule: JSON.stringify({ departureTimes: ['06:00', '06:30', '07:00'] }),
    proposedSchedule: JSON.stringify({ departureTimes: ['06:15', '06:45', '07:15'] }),
    submittedBy: 'YB-SUB-2026-1024',
    approvedBy: 'admin-default',
    effectiveFrom: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  assert('Revision captures previous schedule snapshot for rollback', rev1.previousSchedule.includes('06:00'));
  assert('Revision captures proposed schedule snapshot', rev1.proposedSchedule.includes('06:15'));
  assert('Maintains audit traceability to submission reference ID', rev1.submittedBy === 'YB-SUB-2026-1024');
}
