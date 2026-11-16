#!/usr/bin/env python3
"""Import the pinned RRL GTFS feed; append route data and enrich timetable calendars idempotently."""
from __future__ import annotations
import argparse, csv, hashlib, io, json, math, re, zipfile
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path

DATASET = "RRL_RAJKOT_GTFS_2026_11_16"
REPO_URL = "https://github.com/croyla/rrl-gtfs"
ARCHIVE_URL = "https://raw.githubusercontent.com/croyla/rrl-gtfs/3937952038f7fa052a019418d064991cfa14a2fe/gtfs_compat.zip"
LICENSE = "MIT-0"
ATTRIBUTION = "GTFS feed for Rajkot Rampath Limited services; repository by croylA (MIT-0)"
SNAPSHOT_DATE = "2026-11-16"
STATE = "Gujarat"
DISTRICT = "Rajkot"
MAX_SQL_BYTES = 72000
DAY_FIELDS = [("monday","Mon"),("tuesday","Tue"),("wednesday","Wed"),("thursday","Thu"),("friday","Fri"),("saturday","Sat"),("sunday","Sun")]

def read_csv(zf,name,required=False):
    files=[n for n in zf.namelist() if n.lower().split("/")[-1]==name.lower()]
    if not files:
        if required: raise ValueError("Required GTFS file missing: "+name)
        return []
    return list(csv.DictReader(io.StringIO(zf.read(files[0]).decode("utf-8-sig"),newline="")))

def parse_time(value):
    parts=value.strip().split(":")
    if len(parts)!=3: raise ValueError("Invalid GTFS time: "+repr(value))
    h,m,s=map(int,parts)
    if h<0 or not 0<=m<60 or not 0<=s<60: raise ValueError("Invalid GTFS time: "+repr(value))
    return h*3600+m*60+s

def hhmm(value):
    parse_time(value)
    h,m,_=map(int,value.split(":"))
    return f"{h:02d}:{m:02d}"

def iso_gtfs_date(value):
    raw=str(value or "").strip()
    if not re.fullmatch(r"\\d{8}",raw): return None
    try:
        date(int(raw[:4]),int(raw[4:6]),int(raw[6:8]))
        return f"{raw[:4]}-{raw[4:6]}-{raw[6:8]}"
    except ValueError:
        return None

def num(value,field):
    try: result=float(value)
    except (TypeError,ValueError): raise ValueError(f"Invalid {field}: {value!r}")
    if not math.isfinite(result): raise ValueError(f"Invalid {field}: {value!r}")
    return result

def sql(value):
    if value is None: return "NULL"
    if isinstance(value,bool): return "1" if value else "0"
    if isinstance(value,(int,float)): return str(value)
    return "'" + str(value).replace("'","''") + "'"

def js(value): return json.dumps(value,ensure_ascii=False,separators=(",",":"))

def sid(prefix,*parts):
    safe=re.sub(r"[^A-Za-z0-9_-]+","-", "|".join(parts)).strip("-")[:80]
    return prefix+"-"+safe

def distance_km(a,b):
    lat1,lon1=map(math.radians,a); lat2,lon2=map(math.radians,b)
    dlat,dlon=lat2-lat1,lon2-lon1
    h=math.sin(dlat/2)**2+math.cos(lat1)*math.cos(lat2)*math.sin(dlon/2)**2
    return 6371.0088*2*math.asin(min(1,math.sqrt(h)))

def service_is_current(service,exceptions,today):
    start,end=service.get("start_date",""),service.get("end_date","")
    if start and end:
        try:
            first=date(int(start[:4]),int(start[4:6]),int(start[6:8]))
            last=date(int(end[:4]),int(end[4:6]),int(end[6:8]))
            if first<=today+timedelta(days=365) and last>=today: return True
        except ValueError: pass
    for ex in exceptions:
        if ex.get("exception_type")!="1": continue
        raw=ex.get("date","")
        try:
            d=date(int(raw[:4]),int(raw[4:6]),int(raw[6:8]))
            if today<=d<=today+timedelta(days=365): return True
        except ValueError: pass
    return False

def service_days(service_id,calendars,exceptions=None):
    # Weekly days are kept separate from date-specific additions/removals.
    row=calendars.get(service_id,{})
    days={label for field,label in DAY_FIELDS if row.get(field)=="1"}
    return [label for _,label in DAY_FIELDS if label in days]

def build(zip_path,out_dir,test_mode=False):
    with zipfile.ZipFile(zip_path) as z:
        agencies=read_csv(z,"agency.txt",True)
        routes=read_csv(z,"routes.txt",True)
        stops=read_csv(z,"stops.txt",True)
        trips=read_csv(z,"trips.txt",True)
        stop_times=read_csv(z,"stop_times.txt",True)
        calendars={r["service_id"]:r for r in read_csv(z,"calendar.txt")}
        exceptions=defaultdict(list)
        for row in read_csv(z,"calendar_dates.txt"): exceptions[row["service_id"]].append(row)
    agency_by_id={a.get("agency_id",""):a for a in agencies}
    if not agencies or any(not (a.get("agency_name") or "").strip() for a in agencies):
        raise ValueError("GTFS agency metadata is missing.")
    route_map={r["route_id"]:r for r in routes if r.get("route_type") in {"3","700"}}
    if not route_map: raise ValueError("No bus routes (GTFS route_type 3 or 700) were found.")
    stop_map={}
    for row in stops:
        stop_id=(row.get("stop_id") or "").strip()
        name=(row.get("stop_name") or "").strip()
        if not stop_id or not name: continue
        try:
            lat=num(row.get("stop_lat"),"stop_lat"); lon=num(row.get("stop_lon"),"stop_lon")
        except ValueError:
            continue
        if not (6<=lat<=38 and 68<=lon<=98): continue
        stop_map[stop_id]={**row,"_lat":lat,"_lon":lon}
    if not test_mode and len(stop_map)<10: raise ValueError(f"Too few valid Indian stops: {len(stop_map)}")
    by_trip=defaultdict(list)
    for row in stop_times:
        if row.get("trip_id"): by_trip[row["trip_id"]].append(row)
    today=date.today(); patterns={}; timetable_rows=[]; skipped=0
    for trip in trips:
        route_id=trip.get("route_id",""); trip_id=trip.get("trip_id",""); service_id=trip.get("service_id","")
        route=route_map.get(route_id)
        if not route or not trip_id or not service_is_current(calendars.get(service_id,{}),exceptions.get(service_id,[]),today):
            skipped+=1; continue
        seq=sorted(by_trip.get(trip_id,[]),key=lambda r:int(r.get("stop_sequence") or 0))
        if len(seq)<2 or any(r.get("stop_id") not in stop_map for r in seq) or len({r["stop_id"] for r in seq})<2:
            skipped+=1; continue
        try:
            first=parse_time(seq[0].get("departure_time") or seq[0].get("arrival_time") or "")
            last=parse_time(seq[-1].get("arrival_time") or seq[-1].get("departure_time") or "")
            for row in seq:
                parse_time(row.get("arrival_time") or row.get("departure_time") or "")
                parse_time(row.get("departure_time") or row.get("arrival_time") or "")
        except ValueError:
            skipped+=1; continue
        digest=hashlib.sha1("|".join(r["stop_id"] for r in seq).encode()).hexdigest()[:12]
        key=(route_id,digest)
        agency_id=route.get("agency_id") or (agencies[0].get("agency_id") or "default")
        if agency_id not in agency_by_id:
            agency_id=agencies[0].get("agency_id") or "default"
        operator_id=sid("op-rrl",agency_id)
        route_out_id=sid("rt-rrl",route_id,digest)
        if key not in patterns:
            stops_out=[]; distance=0; previous=None
            for index,row in enumerate(seq):
                stop=stop_map[row["stop_id"]]; coords=(stop["_lat"],stop["_lon"])
                if previous is not None: distance+=distance_km(previous,coords)
                previous=coords
                arrival=parse_time(row.get("arrival_time") or row.get("departure_time") or "")
                departure=parse_time(row.get("departure_time") or row.get("arrival_time") or "")
                stops_out.append({
                    "routeId":route_out_id,"stopId":sid("plc-rrl",row["stop_id"]),
                    "stopName":stop["stop_name"].strip(),"stopSequence":index+1,
                    "arrivalOffsetMinutes":max(0,round((arrival-first)/60)),
                    "departureOffsetMinutes":max(0,round((departure-first)/60)),
                    "distanceFromOriginKm":round(distance,2),
                    "latitude":stop["_lat"],"longitude":stop["_lon"]
                })
            agency=agency_by_id.get(agency_id) or agencies[0]
            name=(route.get("route_long_name") or route.get("route_short_name") or route_id).strip()
            patterns[key]={
                "id":route_out_id,"routeNumber":(route.get("route_short_name") or route_id).strip(),
                "name":name,"operatorId":operator_id,
                "originPlaceId":stops_out[0]["stopId"],"originName":stops_out[0]["stopName"],
                "destinationPlaceId":stops_out[-1]["stopId"],"destinationName":stops_out[-1]["stopName"],
                "direction":"up" if trip.get("direction_id")=="0" else ("down" if trip.get("direction_id")=="1" else "unknown"),
                "durationMinutes":0,"durationSamples":[],
                "durationMethod":"median_of_published_gtfs_trips","distanceKm":round(distance,2),
                "distanceMethod":"approximate_haversine_between_published_stops",
                "operatingDays":[],"firstDepartureTime":hhmm(seq[0].get("departure_time") or seq[0].get("arrival_time") or ""),
                "lastDepartureTime":hhmm(seq[0].get("departure_time") or seq[0].get("arrival_time") or ""),
                "status":"active","verificationStatus":"published_unverified",
                "sourceDataset":DATASET,"sourceUrl":REPO_URL,"sourceDownloadUrl":ARCHIVE_URL,
                "sourceLicense":LICENSE,"sourceAttribution":ATTRIBUTION,"sourceSnapshotDate":SNAPSHOT_DATE,
                "polyline":[[r["latitude"],r["longitude"]] for r in stops_out],"stops":stops_out
            }
        days=service_days(service_id,calendars,exceptions)
        service=calendars.get(service_id,{})
        service_exceptions=[]
        for exception in exceptions.get(service_id,[]):
            exception_date=iso_gtfs_date(exception.get("date"))
            try: exception_type=int(exception.get("exception_type","0"))
            except (TypeError,ValueError): continue
            if exception_date and exception_type in (1,2):
                service_exceptions.append({"date":exception_date,"exceptionType":exception_type})
        service_exceptions.sort(key=lambda item:(item["date"],item["exceptionType"]))
        departure=hhmm(seq[0].get("departure_time") or seq[0].get("arrival_time") or "")
        arrival=hhmm(seq[-1].get("arrival_time") or seq[-1].get("departure_time") or "")
        timetable_rows.append({
            "id":sid("tt-rrl",route_id,digest,trip_id),"routeId":route_out_id,
            "tripCode":trip_id,"departureTime":departure,"arrivalTime":arrival,
            "operatingDays":days,"serviceId":service_id,
            "serviceStartDate":iso_gtfs_date(service.get("start_date")),
            "serviceEndDate":iso_gtfs_date(service.get("end_date")),
            "serviceExceptions":service_exceptions,
            "headsign":(trip.get("trip_headsign") or "").strip() or None,
            "directionId":trip.get("direction_id") or None,"vehicleType":None,"fareInRupees":None,
            "isConfirmed":False,"verificationStatus":"published_unverified","version":1,
            "lastVerifiedDate":SNAPSHOT_DATE,"sourceDataset":DATASET,"sourceUrl":REPO_URL,
            "sourceLicense":LICENSE,"sourceAttribution":ATTRIBUTION,"sourceSnapshotDate":SNAPSHOT_DATE
        })
        pattern=patterns[key]
        duration=max(0,round((last-first)/60))
        pattern["durationSamples"].append(duration)
        ordered=sorted(pattern["durationSamples"])
        middle=len(ordered)//2
        pattern["durationMinutes"]=ordered[middle] if len(ordered)%2 else round((ordered[middle-1]+ordered[middle])/2)
        if departure<pattern["firstDepartureTime"]: pattern["firstDepartureTime"]=departure
        if departure>pattern["lastDepartureTime"]: pattern["lastDepartureTime"]=departure
        pattern["operatingDays"]=sorted(set(pattern["operatingDays"])|set(days),
            key=lambda d:next(i for i,(_,label) in enumerate(DAY_FIELDS) if label==d))
    if not test_mode and (len(patterns)<1 or len(timetable_rows)<10):
        raise ValueError(f"Too few current RRL route patterns/trips: routes={len(patterns)}, trips={len(timetable_rows)}")
    out_dir.mkdir(parents=True,exist_ok=True); statements=[]
    for agency in agencies:
        agency_id=agency.get("agency_id") or "default"
        operator_id=sid("op-rrl",agency_id)
        operator={
            "id":operator_id,"name":agency["agency_name"].strip(),"shortCode":"RRL",
            "state":STATE,"serviceArea":DISTRICT,"isGovernment":False,
            "verificationStatus":"published_unverified","sourceDataset":DATASET,
            "sourceUrl":REPO_URL,"sourceLicense":LICENSE,"sourceAttribution":ATTRIBUTION,
            "sourceSnapshotDate":SNAPSHOT_DATE
        }
        statements.append("INSERT OR IGNORE INTO operators (id,name,status,payload_json) VALUES "
            f"({sql(operator_id)},{sql(operator['name'])},'active',{sql(js(operator))});")
    for raw_id,stop in stop_map.items():
        place_id=sid("plc-rrl",raw_id)
        place={
            "id":place_id,"canonicalName":stop["stop_name"].strip(),"placeType":"bus_stop",
            "state":STATE,"district":DISTRICT,"latitude":stop["_lat"],"longitude":stop["_lon"],
            "sourceDataset":DATASET,"sourceRecordId":raw_id,"sourceUrl":REPO_URL,
            "sourceLicense":LICENSE,"sourceSnapshotDate":SNAPSHOT_DATE,"busServiceVerified":True,
            "verificationStatus":"published_unverified","aliases":[],"lastUpdated":SNAPSHOT_DATE,
            "sourceAttribution":ATTRIBUTION
        }
        statements.append("INSERT OR IGNORE INTO places (id,canonical_name,place_type,state,district,latitude,longitude,source_dataset,verification_status,last_updated,aliases_json,payload_json) VALUES "
            f"({sql(place_id)},{sql(stop['stop_name'].strip())},'bus_stop',{sql(STATE)},{sql(DISTRICT)},{sql(stop['_lat'])},{sql(stop['_lon'])},{sql(DATASET)},'published_unverified',{sql(SNAPSHOT_DATE)},'[]',{sql(js(place))});")
    for route in patterns.values():
        route.pop("durationSamples",None)
        statements.append("INSERT OR IGNORE INTO routes (id,name,origin_place_id,destination_place_id,status,stops_json,payload_json) VALUES "
            f"({sql(route['id'])},{sql(route['name'])},{sql(route['originPlaceId'])},{sql(route['destinationPlaceId'])},'active',{sql(js(route['stops']))},{sql(js(route))});")
    for route in patterns.values():
        for stop in route["stops"]:
            statements.append("INSERT OR IGNORE INTO route_stops (route_id,stop_id,stop_sequence,stop_name,arrival_offset_minutes,departure_offset_minutes) VALUES "
                f"({sql(route['id'])},{sql(stop['stopId'])},{sql(stop['stopSequence'])},{sql(stop['stopName'])},{sql(stop['arrivalOffsetMinutes'])},{sql(stop['departureOffsetMinutes'])});")
    for timetable in timetable_rows:
        statements.append("INSERT INTO timetables (id,route_id,departure_time,service_days_json,service_start_date,service_end_date,service_exceptions_json,payload_json) VALUES "
            f"({sql(timetable['id'])},{sql(timetable['routeId'])},{sql(timetable['departureTime'])},{sql(js(timetable['operatingDays']))},{sql(timetable['serviceStartDate'])},{sql(timetable['serviceEndDate'])},{sql(js(timetable['serviceExceptions']))},{sql(js(timetable))}) "
            "ON CONFLICT(id) DO UPDATE SET service_days_json=excluded.service_days_json,service_start_date=excluded.service_start_date,service_end_date=excluded.service_end_date,service_exceptions_json=excluded.service_exceptions_json,"
            "payload_json=json_set(timetables.payload_json,'$.operatingDays',json(excluded.service_days_json),'$.serviceStartDate',excluded.service_start_date,'$.serviceEndDate',excluded.service_end_date,'$.serviceExceptions',json(excluded.service_exceptions_json));")
    files=[]; batch=[]; size=0; index=0
    for statement in statements:
        n=len(statement.encode("utf-8"))+1
        if n>MAX_SQL_BYTES: raise ValueError("One SQL insert exceeds the safe D1 batch size.")
        if batch and size+n>MAX_SQL_BYTES:
            name=f"rrl-{index:04d}.sql"; (out_dir/name).write_text("\n".join(batch)+"\n",encoding="utf-8")
            files.append(name); index+=1; batch=[]; size=0
        batch.append(statement); size+=n
    if batch:
        name=f"rrl-{index:04d}.sql"; (out_dir/name).write_text("\n".join(batch)+"\n",encoding="utf-8"); files.append(name)
    manifest={
        "dataset":DATASET,"repository":REPO_URL,"archive":ARCHIVE_URL,"license":LICENSE,
        "attribution":ATTRIBUTION,"snapshotDate":SNAPSHOT_DATE,"agencyCount":len(agencies),
        "stopCount":len(stop_map),"routePatternCount":len(patterns),"routeStopCount":sum(len(route["stops"]) for route in patterns.values()),"tripCount":len(timetable_rows),
        "skippedTripCount":skipped,"sqlFileCount":len(files),"sqlFiles":files,
        "liveGpsIncluded":False,"fareDataIncluded":False,"vehicleRecordsCreated":0,
        "note":"Community-published static GTFS for Rajkot Rampath Limited; not independently verified by YatraBus or the operator. No live positions, fares or individual vehicles are inferred."
    }
    (out_dir/"manifest.json").write_text(js(manifest)+"\n",encoding="utf-8")
    return manifest

def self_test():
    from tempfile import TemporaryDirectory
    sample={
      "agency.txt":"agency_id,agency_name,agency_url,agency_timezone\nRRL,Rajkot Rampath Limited,https://example.test,Asia/Kolkata\n",
      "routes.txt":"route_id,agency_id,route_short_name,route_long_name,route_type\nR1,RRL,1,Test City to Test Town,3\n",
      "stops.txt":"stop_id,stop_name,stop_lat,stop_lon\nS1,Test City,22.3,70.8\nS2,Test Town,22.4,70.9\n",
      "trips.txt":"route_id,service_id,trip_id,direction_id,trip_headsign\nR1,WK,T1,0,Test Town\n",
      "stop_times.txt":"trip_id,arrival_time,departure_time,stop_id,stop_sequence\nT1,06:00:00,06:00:00,S1,1\nT1,07:00:00,07:00:00,S2,2\n",
      "calendar.txt":"service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\nWK,1,1,1,1,1,0,0,20260101,20301231\n"
    }
    with TemporaryDirectory() as td:
        root=Path(td); zpath=root/"test.zip"
        with zipfile.ZipFile(zpath,"w") as z:
            for name,data in sample.items(): z.writestr(name,data)
        result=build(zpath,root/"out",test_mode=True)
        assert result["stopCount"]==2 and result["routePatternCount"]==1 and result["tripCount"]==1
        sqls="\n".join(p.read_text() for p in (root/"out").glob("*.sql"))
        assert "INSERT OR IGNORE INTO route_stops" in sqls and "INSERT OR IGNORE INTO timetables" in sqls and '"fareInRupees":null' in sqls
    print("RRL Rajkot GTFS importer self-test passed.")

if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--input",type=Path); parser.add_argument("--output-dir",type=Path,default=Path("dist/rrl-sql"))
    parser.add_argument("--self-test",action="store_true"); args=parser.parse_args()
    if args.self_test: self_test()
    elif not args.input or not args.input.is_file(): parser.error("--input must point to a GTFS ZIP")
    else: print(json.dumps(build(args.input,args.output_dir),indent=2))
