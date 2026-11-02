import { deflateRawSync } from 'node:zlib';
import { importGtfsZip, parseGtfsCsv } from '../../backend/src/engine/gtfsImporter.js';

function makeStoredZip(files: Record<string, string>): string {
  const localParts: Buffer[] = [], centralParts: Buffer[] = [];
  let offset = 0;
  for (const [name, value] of Object.entries(files)) {
    const filename = Buffer.from(name, 'utf8'), data = Buffer.from(value, 'utf8');
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8); local.writeUInt32LE(0, 14); local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22); local.writeUInt16LE(filename.length, 26); local.writeUInt16LE(0, 28);
    localParts.push(local, filename, data);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8); central.writeUInt16LE(0, 10); central.writeUInt32LE(0, 16);
    central.writeUInt32LE(data.length, 20); central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(filename.length, 28); central.writeUInt16LE(0, 30); central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34); central.writeUInt16LE(0, 36); central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, filename);
    offset += local.length + filename.length + data.length;
  }
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10); end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16); end.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, ...centralParts, end]).toString('base64');
}

export function runGtfsImporterTests(assert: (description: string, pass: boolean) => void) {
  const csv = parseGtfsCsv('id,name,description\\r\\n1,"Stop, Main","A ""quoted"" place"\\r\\n');
  assert('GTFS CSV parser handles quoted commas and escaped quotes', csv[0]?.name === 'Stop, Main' && csv[0]?.description === 'A "quoted" place');

  const zip = makeStoredZip({
    'agency.txt': 'agency_id,agency_name,agency_url\\nwb,West Bengal Demo Transit,https://example.org\\n',
    'routes.txt': 'route_id,agency_id,route_short_name,route_long_name\\nr1,wb,WB1,Kharagpur to Jhargram\\n',
    'stops.txt': 'stop_id,stop_name,stop_lat,stop_lon\\na,Kharagpur,22.346,87.232\\nb,Jhargram,22.453,86.994\\n',
    'trips.txt': 'route_id,service_id,trip_id,direction_id,shape_id\\nr1,weekday,t1,0,\\n',
    'stop_times.txt': 'trip_id,arrival_time,departure_time,stop_id,stop_sequence\\nt1,23:50:00,23:50:00,a,1\\nt1,24:40:00,24:40:00,b,2\\n',
    'calendar.txt': 'service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\\nweekday,1,1,1,1,1,0,0,20261102,20261231\\n',
    'calendar_dates.txt': 'service_id,date,exception_type\\nweekday,20261103,2\\n',
  });
  const imported = importGtfsZip(zip, new Date('2026-11-02T00:00:00.000Z'));
  assert('GTFS ZIP imports a route, operator and trip', imported.errors.length === 0 && imported.routes.length === 1 && imported.operators.length === 1);
  assert('GTFS 24:40 trip arrival retains next-day offset', imported.routes[0]?.departures?.[0]?.arrivalTime === '00:40' && imported.routes[0]?.departures?.[0]?.stopTimes?.[1]?.arrivalDayOffset === 1);
  assert('GTFS service calendar and removed-date exception are retained', imported.routes[0]?.departures?.[0]?.operatingDays.includes('MON') === true && imported.routes[0]?.departures?.[0]?.removedServiceDates?.includes('20261103') === true);
  assert('Imported GTFS routes remain unverified until Super Admin review', imported.routes[0]?.verificationStatus === 'UNVERIFIED' && imported.routes[0]?.serviceStatus === 'SCHEDULE_UNVERIFIED');
  const missing = importGtfsZip(makeStoredZip({ 'agency.txt': 'agency_name\\nDemo\\n' }));
  assert('Missing required GTFS files are reported without applying partial data', missing.errors.some(error => error.includes('Missing required GTFS file')));
}
