import { PagesContext, json, unavailable, onRequestOptions } from "../../../../../_lib/api";
import { readAdminSession } from "../../../../../_lib/adminAuth";
export { onRequestOptions };

const validTime = (v: unknown): v is string => typeof v === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(v);

export async function onRequestPost({ request, env, params }: PagesContext): Promise<Response> {
  if (!env.DB) return unavailable();
  const admin = await readAdminSession(request, env, env.DB);
  if (!admin) return json({ success: false, error: "Administrator authorization required." }, 401);
  const id = params?.id || "";
  let body: any;
  try {
    const raw = await request.text();
    if (raw.length > 8192) return json({ success: false, error: "Request is too large." }, 413);
    body = JSON.parse(raw || "{}");
  } catch { return json({ success: false, error: "Valid JSON is required." }, 400); }
  const action = body?.action;
  const remarks = typeof body?.remarks === "string" ? body.remarks.trim().slice(0, 2000) : "";
  if (!["approved", "rejected", "merged"].includes(action)) return json({ success: false, error: "Invalid review action." }, 400);

  try {
    const row = await env.DB.prepare("SELECT id,submission_type,status,payload_json FROM community_submissions WHERE id = ? LIMIT 1")
      .bind(id).first<any>();
    if (!row) return json({ success: false, error: "Submission not found." }, 404);
    if (row.status !== "pending_review") return json({ success: false, error: "Submission has already been reviewed." }, 409);
    let submission: any = {};
    try { submission = JSON.parse(row.payload_json); } catch { submission = {}; }
    const proposed = submission.proposedData || {};
    const now = new Date().toISOString();
    const reviewer = admin.email;

    if (action === "approved") {
      if (row.submission_type === "correct_timetable") {
        const routeId = typeof proposed.routeId === "string" ? proposed.routeId : "";
        if (!routeId || !validTime(proposed.departureTime) || !validTime(proposed.arrivalTime)) {
          return json({ success: false, error: "A valid route, departure time and arrival time are required." }, 422);
        }
        const route = await env.DB.prepare("SELECT id FROM routes WHERE id = ? AND status = 'active' LIMIT 1").bind(routeId).first();
        if (!route) return json({ success: false, error: "The selected route is not active." }, 422);
        const id2 = "tt-community-" + id;
        const dep = proposed.departureTime as string;
        const arr = proposed.arrivalTime as string;
        const dayOffset = Number(arr.slice(0,2))*60+Number(arr.slice(3,5)) < Number(dep.slice(0,2))*60+Number(dep.slice(3,5)) ? 1 : 0;
        const timetable = { id:id2, routeId, tripCode:id, departureTime:dep, arrivalTime:arr, arrivalDayOffset:dayOffset, operatingDays:[], vehicleType:null, fareInRupees:null, isConfirmed:true, verificationStatus:"admin_verified", version:1, lastVerifiedDate:now, sourceDataset:"COMMUNITY_SUBMISSION", sourceAttribution:"Reviewed by YatraBus India Super Admin", reviewedBy:reviewer, reviewRemarks:remarks };
        await env.DB.prepare("INSERT OR IGNORE INTO timetables (id,route_id,departure_time,service_days_json,payload_json) VALUES (?,?,?,?,?)")
          .bind(id2,routeId,dep,"[]",JSON.stringify(timetable)).run();
      } else if (row.submission_type === "add_stop") {
        const name = typeof proposed.canonicalName === "string" ? proposed.canonicalName.trim() : "";
        const state = typeof proposed.state === "string" ? proposed.state.trim() : "";
        const district = typeof proposed.district === "string" ? proposed.district.trim() : "";
        if (!name || !state || !district || name.length>160 || state.length>100 || district.length>100) return json({ success:false,error:"Stop name, state and district are required." },422);
        const placeId = "plc-community-" + id;
        const place = { id:placeId, canonicalName:name, placeType:"community_place", state, district, latitude:null, longitude:null, sourceDataset:"COMMUNITY_SUBMISSION", sourceRecordId:id, busServiceVerified:false, verificationStatus:"published_unverified", aliases:[], lastUpdated:now, reviewedBy:reviewer, reviewRemarks:remarks };
        await env.DB.prepare("INSERT OR IGNORE INTO places (id,canonical_name,place_type,state,district,latitude,longitude,source_dataset,verification_status,last_updated,aliases_json,payload_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
          .bind(placeId,name,"community_place",state,district,null,null,"COMMUNITY_SUBMISSION","published_unverified",now,"[]",JSON.stringify(place)).run();
      } else if (row.submission_type === "report_disruption") {
        const routeId = typeof proposed.routeId === "string" ? proposed.routeId : "";
        const details = typeof proposed.details === "string" ? proposed.details.trim().slice(0,2000) : "";
        const route = routeId ? await env.DB.prepare("SELECT id FROM routes WHERE id = ? AND status = 'active' LIMIT 1").bind(routeId).first() : null;
        if (!route || !details) return json({ success:false,error:"A valid active route and disruption details are required." },422);
        const alertId = "alert-community-" + id;
        const validUntil = new Date(Date.now()+24*60*60*1000).toISOString();
        const alert = { id:alertId, routeId, alertType:proposed.disruptionType || "service_disruption", details, status:"active", createdAt:now, validUntil, sourceDataset:"COMMUNITY_SUBMISSION", verificationStatus:"admin_verified", reviewedBy:reviewer, reviewRemarks:remarks };
        await env.DB.prepare("INSERT OR IGNORE INTO service_alerts (id,route_id,alert_type,status,created_at,valid_until,payload_json) VALUES (?,?,?,?,?,?,?)")
          .bind(alertId,routeId,alert.alertType,"active",now,validUntil,JSON.stringify(alert)).run();
      } else if (row.submission_type === "add_bus") {
        const operatorId = typeof proposed.operatorId === "string" ? proposed.operatorId : "";
        const name = typeof proposed.name === "string" ? proposed.name.trim() : "";
        if (!operatorId || !name) return json({ success:false,error:"Bus name and existing operator are required." },422);
        const operator = await env.DB.prepare("SELECT id FROM operators WHERE id = ? LIMIT 1").bind(operatorId).first();
        if (!operator) return json({ success:false,error:"Operator is not in the directory; add the operator before approving this bus." },422);
        const busId = "bus-community-" + id;
        const bus = { id:busId, name, operatorId, vehicleType:proposed.vehicleType || null, features:Array.isArray(proposed.features)?proposed.features.slice(0,10):[], verificationStatus:"pending_route_assignment", sourceDataset:"COMMUNITY_SUBMISSION", reviewedBy:reviewer, reviewRemarks:remarks };
        await env.DB.prepare("INSERT OR IGNORE INTO buses (id,operator_id,registration_number,status,payload_json) VALUES (?,?,?,?,?)")
          .bind(busId,operatorId,null,"pending_route_assignment",JSON.stringify(bus)).run();
      } else {
        return json({ success:false,error:"This submission type cannot be published yet." },422);
      }
    }

    const updated = { ...submission, id, status:action, reviewedAt:now, reviewedBy:reviewer, reviewRemarks:remarks };
    await env.DB.prepare("UPDATE community_submissions SET status=?,reviewed_at=?,payload_json=? WHERE id=? AND status='pending_review'")
      .bind(action,now,JSON.stringify(updated),id).run();
    const auditId = "audit-" + crypto.randomUUID();
    const audit = { id:auditId, action:action==="approved"?"verify":action==="merged"?"merge":"update", entityType:"submission", entityId:id, performedBy:reviewer, reason:remarks || "Super Admin reviewed community submission", timestamp:now, newValue:updated, isRollbackable:false };
    await env.DB.prepare("INSERT INTO audit_logs (id,action,entity_type,entity_id,actor_id,created_at,payload_json) VALUES (?,?,?,?,?,?,?)")
      .bind(auditId,audit.action,"submission",id,reviewer,now,JSON.stringify(audit)).run();
    return json({ success:true,data:updated });
  } catch {
    return json({ success:false,error:"Submission review could not be completed." },503);
  }
}
