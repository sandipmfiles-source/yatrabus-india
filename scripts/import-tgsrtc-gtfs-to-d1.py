#!/usr/bin/env python3
"""Convert a pinned TGSRTC static GTFS snapshot into append-only Cloudflare D1 SQL."""
from __future__ import annotations
import argparse, csv, hashlib, io, json, math, re, zipfile
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path

DATASET = "TGSRTC_GTFS_2026_02_08"
SOURCE_URL = "https://data.opencity.in/dataset/88e2d145-7ec6-4666-88dd-6cf18b18312e/resource/1b0d18bb-b2fb-4a79-8ed0-1e071da5790c/download/telangana_opendata_gtfs_tgsrtc_08_february_2026.zip"
SOURCE_PAGE = "https://www.tgsrtc.telangana.gov.in/open-data"
SOURCE_LICENSE = "TGSRTC Open Data Terms: free non-exclusive use; attribution required"
ATTRIBUTION = "Contains data provided by TGSRTC"
SNAPSHOT_DATE = "2026-02-08"
STATE = "Telangana"
MAX_SQL_BYTES = 72000
DAY_FIELDS = [("monday","Mon"),("tuesday","Tue"),("wednesday","Wed"),("thursday","Thu"),("friday","Fri"),("saturday","Sat"),("sunday","Sun")]

def read_csv(zf, name, required=False):
    matches = [n for n in zf.namelist() if n.lower().split("/")[-1] == name.lower()]
    if not matches:
        if required: raise ValueError(f"Required GTFS file missing: {name}")
        return []
    return list(csv.DictReader(io.StringIO(zf.read(matches[0]).decode("utf-8-sig"), newline="")))

def parse_time(value):
    parts = value.strip().split(":")
    if len(parts) != 3: raise ValueError(f"Invalid GTFS time: {value!r}")
    h,m,s = map(int, parts)
    if h < 0 or not 0 <= m < 60 or not 0 <= s < 60: raise ValueError(f"Invalid GTFS time: {value!r}")
    return h*3600+m*60+s

def hhmm(value):
    parse_time(value)
    h,m,_ = map(int,value.split(":"))
    return f"{h:02d}:{m:02d}"

def num(value, field):
    try: n=float(value)
    except (TypeError,ValueError): raise ValueError(f"Invalid {field}: {value!r}")
    if not math.isfinite(n): raise ValueError(f"Invalid {field}: {value!r}")
    return n

def sql(v):
    if v is None: return "NULL"
    if isinstance(v,bool): return "1" if v else "0"
    if isinstance(v,(int,float)): return str(v)
    return "'" + str(v).replace("'","''") + "'"

def js(v): return json.dumps(v,ensure_ascii=False,separators=(",",":"))
def sid(prefix,*parts):
    safe=re.sub(r"[^A-Za-z0-9_-]+","-", "|".join(parts)).strip("-")[:80]
    return f"{prefix}-{safe}"

def haversine(a,b):
    lat1,lon1=map(math.radians,a); lat2,lon2=map(math.radians,b)
    dlat,dlon=lat2-lat1,lon2-lon1
    h=math.sin(dlat/2)**2+math.cos(lat1)*math.cos(lat2)*math.sin(dlon/2)**2
    return 6371.0088*2*math.asin(min(1,math.sqrt(h)))

def service_is_current(service, exceptions, today):
    start=service.get("start_date",""); end=service.get("end_date","")
    if start and end:
        try:
            first=date(int(start[:4]),int(start[4:6]),int(start[6:8]))
            last=date(int(end[:4]),int(end[4:6]),int(end[6:8]))
            if first <= today+timedelta(days=365) and last >= today: return True
        except ValueError: pass
    for ex in exceptions:
        if ex.get("exception_type") != "1": continue
        raw=ex.get("date","")
        try:
            d=date(int(raw[:4]),int(raw[4:6]),int(raw[6:8]))
            if today <= d <= today+timedelta(days=365): return True
        except ValueError: pass
    return False

def operating_days(service_id, calendars, exceptions):
    row=calendars.get(service_id,{})
    days={label for field,label in DAY_FIELDS if row.get(field)=="1"}
    for ex in exceptions.get(service_id,[]):
        if ex.get("exception_type")=="1":
            raw=ex.get("date","")
            try:
                d=date(int(raw[:4]),int(raw[4:6]),int(raw[6:8]))
                if date.today() <= d <= date.today()+timedelta(days=365):
                    days.add(DAY_FIELDS[d.weekday()][1])
            except ValueError: pass
    return [label for _,label in DAY_FIELDS if label in days]

def build(zip_path,out_dir,test_mode=False):
    with zipfile.ZipFile(zip_path) as z:
        agencies=read_csv(z,"agency.txt",True); routes=read_csv(z,"routes.txt",True)
        stops=read_csv(z,"stops.txt",True); trips=read_csv(z,"trips.txt",True)
        stop_times=read_csv(z,"stop_times.txt",True)
        calendars={r["service_id"]:r for r in read_csv(z,"calendar.txt")}
        exceptions=defaultdict(list)
        for r in read_csv(z,"calendar_dates.txt"): exceptions[r["service_id"]].append(r)
    if len(agencies)!=1: raise ValueError(f"Expected one TGSRTC agency, got {len(agencies)}")
    agency=agencies[0]; agency_name=(agency.get("agency_name") or "").strip()
    if not agency_name: raise ValueError("agency_name is missing")
    route_map={r["route_id"]:r for r in routes if r.get("route_type") in {"3","700"}}
    if not route_map: raise ValueError("No GTFS bus routes (route_type 3 or 700)")
    stop_map={}
    for s in stops:
        stop_id=(s.get("stop_id") or "").strip(); name=(s.get("stop_name") or "").strip()
        if not stop_id or not name: continue
        lat=num(s.get("stop_lat"),"stop_lat"); lon=num(s.get("stop_lon"),"stop_lon")
        if not (6<=lat<=38 and 68<=lon<=98): raise ValueError(f"Stop outside India bounds: {stop_id}")
        stop_map[stop_id]={**s,"_lat":lat,"_lon":lon}
    if not test_mode and len(stop_map)<100: raise ValueError(f"Too few valid stops: {len(stop_map)}")
    stop_times_by_trip=defaultdict(list)
    for st in stop_times:
        if st.get("trip_id") and st.get("stop_id") in stop_map:
            stop_times_by_trip[st["trip_id"]].append(st)
    today=date.today(); patterns={}; timetable_rows=[]; skipped=0
    for trip in trips:
        rid=trip.get("route_id",""); trip_id=trip.get("trip_id",""); service_id=trip.get("service_id","")
        if rid not in route_map or not trip_id or not service_is_current(calendars.get(service_id,{}),exceptions.get(service_id,[]),today):
            skipped+=1; continue
        seq=sorted(stop_times_by_trip.get(trip_id,[]),key=lambda x:int(x.get("stop_sequence") or 0))
        if len(seq)<2 or len({x["stop_id"] for x in seq})<2: skipped+=1; continue
        try:
            first=parse_time(seq[0].get("departure_time") or seq[0].get("arrival_time") or "")
            last=parse_time(seq[-1].get("arrival_time") or seq[-1].get("departure_time") or "")
            for st in seq:
                parse_time(st.get("arrival_time") or st.get("departure_time") or "")
                parse_time(st.get("departure_time") or st.get("arrival_time") or "")
        except ValueError: skipped+=1; continue
        digest=hashlib.sha1("|".join(x["stop_id"] for x in seq).encode()).hexdigest()[:12]
        key=(rid,digest); route_id_out=sid("rt-tgsrtc",rid,digest)
        if key not in patterns:
            route=route_map[rid]; seq_stops=[]; distance=0; prev=None
            for index,st in enumerate(seq):
                stop=stop_map[st["stop_id"]]; coords=(stop["_lat"],stop["_lon"])
                if prev is not None: distance+=haversine(prev,coords)
                prev=coords
                arr=parse_time(st.get("arrival_time") or st.get("departure_time") or "")
                dep=parse_time(st.get("departure_time") or st.get("arrival_time") or "")
                seq_stops.append({"routeId":route_id_out,"stopId":sid("plc-tgsrtc",st["stop_id"]),
                    "stopName":stop["stop_name"].strip(),"stopSequence":index+1,
                    "arrivalOffsetMinutes":max(0,round((arr-first)/60)),
                    "departureOffsetMinutes":max(0,round((dep-first)/60)),
                    "distanceFromOriginKm":round(distance,2),"latitude":stop["_lat"],"longitude":stop["_lon"]})
            origin,dest=seq_stops[0],seq_stops[-1]
            patterns[key]={"id":route_id_out,"routeNumber":(route.get("route_short_name") or rid).strip(),
                "name":(route.get("route_long_name") or route.get("route_short_name") or rid).strip(),
                "operatorId":"op-tgsrtc","originPlaceId":origin["stopId"],"originName":origin["stopName"],
                "destinationPlaceId":dest["stopId"],"destinationName":dest["stopName"],
                "direction":"up" if trip.get("direction_id")=="0" else ("down" if trip.get("direction_id")=="1" else "unknown"),
                "durationMinutes":max(0,round((last-first)/60)),"distanceKm":round(distance,2),
                "operatingDays":[],"firstDepartureTime":hhmm(seq[0].get("departure_time") or seq[0].get("arrival_time") or ""),"lastDepartureTime":hhmm(seq[0].get("departure_time") or seq[0].get("arrival_time") or ""),"status":"active","verificationStatus":"published_unverified",
                "sourceDataset":DATASET,"sourceUrl":SOURCE_PAGE,"sourceDownloadUrl":SOURCE_URL,
                "sourceLicense":SOURCE_LICENSE,"sourceAttribution":ATTRIBUTION,
                "sourceSnapshotDate":SNAPSHOT_DATE,"polyline":[[x["latitude"],x["longitude"]] for x in seq_stops],
                "stops":seq_stops}
        days=operating_days(service_id,calendars,exceptions)
        timetable_rows.append({"id":sid("tt-tgsrtc",rid,digest,trip_id),"routeId":route_id_out,
            "tripCode":trip_id,"departureTime":hhmm(seq[0].get("departure_time") or seq[0].get("arrival_time") or ""),
            "arrivalTime":hhmm(seq[-1].get("arrival_time") or seq[-1].get("departure_time") or ""),
            "operatingDays":days,"serviceId":service_id,"headsign":(trip.get("trip_headsign") or "").strip() or None,
            "directionId":trip.get("direction_id") or None,"vehicleType":None,"fareInRupees":None,
            "isConfirmed":False,"verificationStatus":"published_unverified","version":1,
            "lastVerifiedDate":SNAPSHOT_DATE,"sourceDataset":DATASET,"sourceUrl":SOURCE_PAGE,
            "sourceLicense":SOURCE_LICENSE,"sourceAttribution":ATTRIBUTION,"sourceSnapshotDate":SNAPSHOT_DATE})
        current_departure=hhmm(seq[0].get("departure_time") or seq[0].get("arrival_time") or "")
        current_arrival=hhmm(seq[-1].get("arrival_time") or seq[-1].get("departure_time") or "")
        if current_departure < patterns[key]["firstDepartureTime"]: patterns[key]["firstDepartureTime"]=current_departure
        if current_departure > patterns[key]["lastDepartureTime"]: patterns[key]["lastDepartureTime"]=current_departure
        patterns[key]["operatingDays"]=sorted(set(patterns[key]["operatingDays"])|set(days),
            key=lambda d:next(i for i,(_,label) in enumerate(DAY_FIELDS) if label==d))
    if not test_mode and (len(timetable_rows)<1000 or len(patterns)<10): raise ValueError("Unexpectedly few current trips or route patterns")
    out_dir.mkdir(parents=True,exist_ok=True); statements=[]
    op={"id":"op-tgsrtc","name":agency_name,"shortCode":"TGSRTC","state":STATE,"serviceArea":"Telangana",
        "isGovernment":True,"verificationStatus":"published_unverified","sourceDataset":DATASET,
        "sourceUrl":SOURCE_PAGE,"sourceLicense":SOURCE_LICENSE,"sourceAttribution":ATTRIBUTION,"sourceSnapshotDate":SNAPSHOT_DATE}
    statements.append("INSERT OR IGNORE INTO operators (id,name,status,payload_json) VALUES "
        f"({sql('op-tgsrtc')},{sql(agency_name)},'active',{sql(js(op))});")
    for raw_id,stop in stop_map.items():
        place_id=sid("plc-tgsrtc",raw_id)
        payload={"id":place_id,"canonicalName":stop["stop_name"].strip(),"placeType":"bus_stop",
            "state":STATE,"district":"Not specified in source feed","latitude":stop["_lat"],"longitude":stop["_lon"],
            "sourceDataset":DATASET,"sourceRecordId":raw_id,"sourceUrl":SOURCE_PAGE,"sourceLicense":SOURCE_LICENSE,
            "sourceSnapshotDate":SNAPSHOT_DATE,"busServiceVerified":True,"verificationStatus":"published_unverified",
            "aliases":[],"lastUpdated":SNAPSHOT_DATE,"sourceAttribution":ATTRIBUTION}
        statements.append("INSERT OR IGNORE INTO places (id,canonical_name,place_type,state,district,latitude,longitude,source_dataset,verification_status,last_updated,aliases_json,payload_json) VALUES "
            f"({sql(place_id)},{sql(stop['stop_name'].strip())},'bus_stop',{sql(STATE)},{sql('Not specified in source feed')},{sql(stop['_lat'])},{sql(stop['_lon'])},{sql(DATASET)},'published_unverified',{sql(SNAPSHOT_DATE)},'[]',{sql(js(payload))});")
    for route in patterns.values():
        statements.append("INSERT OR IGNORE INTO routes (id,name,origin_place_id,destination_place_id,status,stops_json,payload_json) VALUES "
            f"({sql(route['id'])},{sql(route['name'])},{sql(route['originPlaceId'])},{sql(route['destinationPlaceId'])},'active',{sql(js(route['stops']))},{sql(js(route))});")
    for tt in timetable_rows:
        statements.append("INSERT OR IGNORE INTO timetables (id,route_id,departure_time,service_days_json,payload_json) VALUES "
            f"({sql(tt['id'])},{sql(tt['routeId'])},{sql(tt['departureTime'])},{sql(js(tt['operatingDays']))},{sql(js(tt))});")
    files=[]; batch=[]; size=0; batch_no=0
    for statement in statements:
        n=len(statement.encode("utf-8"))+1
        if n>MAX_SQL_BYTES: raise ValueError("One SQL insert exceeds safe D1 batch size")
        if batch and size+n>MAX_SQL_BYTES:
            p=out_dir/f"tgsrtc-{batch_no:04d}.sql"; p.write_text("\n".join(batch)+"\n",encoding="utf-8")
            files.append(p.name); batch_no+=1; batch=[]; size=0
        batch.append(statement); size+=n
    if batch:
        p=out_dir/f"tgsrtc-{batch_no:04d}.sql"; p.write_text("\n".join(batch)+"\n",encoding="utf-8"); files.append(p.name)
    manifest={"dataset":DATASET,"source":SOURCE_PAGE,"download":SOURCE_URL,"license":SOURCE_LICENSE,
        "attribution":ATTRIBUTION,"snapshotDate":SNAPSHOT_DATE,"agencyCount":1,"stopCount":len(stop_map),
        "routePatternCount":len(patterns),"tripCount":len(timetable_rows),"skippedTripCount":skipped,
        "sqlFileCount":len(files),"sqlFiles":files,"liveGpsIncluded":False,"fareDataIncluded":False,
        "note":"Static published schedules only; no live vehicle positions, fares, or individual bus vehicles are inferred."}
    (out_dir/"manifest.json").write_text(js(manifest)+"\n",encoding="utf-8")
    return manifest

def self_test():
    from tempfile import TemporaryDirectory
    sample={"agency.txt":"agency_id,agency_name,agency_url,agency_timezone\n1,TGSRTC,https://www.tgsrtc.telangana.gov.in,Asia/Kolkata\n",
      "routes.txt":"route_id,agency_id,route_short_name,route_long_name,route_type\nR1,1,1,Test City to Test Town,3\n",
      "stops.txt":"stop_id,stop_name,stop_lat,stop_lon\nS1,Test City,17.385,78.486\nS2,Test Town,17.5,78.6\n",
      "trips.txt":"route_id,service_id,trip_id,direction_id,trip_headsign\nR1,WK,T1,0,Test Town\n",
      "stop_times.txt":"trip_id,arrival_time,departure_time,stop_id,stop_sequence\nT1,06:00:00,06:00:00,S1,1\nT1,07:00:00,07:00:00,S2,2\n",
      "calendar.txt":"service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\nWK,1,1,1,1,1,0,0,20260101,20301231\n"}
    with TemporaryDirectory() as td:
        root=Path(td); zpath=root/"test.zip"
        with zipfile.ZipFile(zpath,"w") as z:
            for name,data in sample.items(): z.writestr(name,data)
        result=build(zpath,root/"out",test_mode=True)
        assert result["stopCount"]==2 and result["routePatternCount"]==1 and result["tripCount"]==1
        sqls="\n".join(p.read_text() for p in (root/"out").glob("*.sql"))
        assert "INSERT OR IGNORE INTO timetables" in sqls and '"fareInRupees":null' in sqls
    print("TGSRTC GTFS importer self-test passed.")

if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--input",type=Path); parser.add_argument("--output-dir",type=Path,default=Path("dist/tgsrtc-sql"))
    parser.add_argument("--self-test",action="store_true"); args=parser.parse_args()
    if args.self_test: self_test()
    elif not args.input or not args.input.is_file(): parser.error("--input must point to a GTFS ZIP")
    else: print(json.dumps(build(args.input,args.output_dir),indent=2))
