import { PagesContext, json, unavailable, onRequestOptions } from "../../../../../_lib/api";
import { readAdminSession } from "../../../../../_lib/adminAuth";
export { onRequestOptions };

export async function onRequestPost({ request, env, params }: PagesContext): Promise<Response> {
  if (!env.DB) return unavailable();
  const admin = await readAdminSession(request, env, env.DB);
  if (!admin) return json({ success:false,error:"Administrator authorization required." },401);
  const id = params?.id || "";
  let body:any;
  try {
    const raw=await request.text();
    if(raw.length>4096) return json({success:false,error:"Request is too large."},413);
    body=JSON.parse(raw||"{}");
  } catch { return json({success:false,error:"Valid JSON is required."},400); }
  const action=body?.action;
  if(!["approved","rejected"].includes(action)) return json({success:false,error:"Action must be approved or rejected."},400);
  try {
    const claim=await env.DB.prepare("SELECT id,operator_id,status,payload_json FROM operator_claims WHERE id=? LIMIT 1").bind(id).first<any>();
    if(!claim) return json({success:false,error:"Operator claim not found."},404);
    if(claim.status!=="pending_review") return json({success:false,error:"This claim has already been reviewed."},409);
    let payload:any={}; try{payload=JSON.parse(claim.payload_json);}catch{payload={};}
    const now=new Date().toISOString();
    if(action==="approved"){
      const operator=await env.DB.prepare("SELECT payload_json FROM operators WHERE id=? LIMIT 1").bind(claim.operator_id).first<{payload_json:string}>();
      if(!operator) return json({success:false,error:"Operator record no longer exists."},404);
      let operatorPayload:any={}; try{operatorPayload=JSON.parse(operator.payload_json);}catch{operatorPayload={};}
      operatorPayload={...operatorPayload,verificationStatus:"admin_verified",isClaimed:true,claimedByName:payload.claimantName,claimedByEmail:payload.officialEmail,claimedAt:now};
      await env.DB.prepare("UPDATE operators SET status='active',payload_json=?,updated_at=? WHERE id=?")
        .bind(JSON.stringify(operatorPayload),now,claim.operator_id).run();
    }
    const reviewed={...payload,status:action,reviewedAt:now,reviewedBy:admin.email,reviewRemarks:typeof body.remarks==="string"?body.remarks.slice(0,1000):""};
    await env.DB.prepare("UPDATE operator_claims SET status=?,reviewed_at=?,payload_json=? WHERE id=? AND status='pending_review'")
      .bind(action,now,JSON.stringify(reviewed),id).run();
    const auditId="audit-"+crypto.randomUUID();
    const audit={id:auditId,action:action==="approved"?"verify":"update",entityType:"operator",entityId:claim.operator_id,performedBy:admin.email,reason:"Operator ownership claim "+action,timestamp:now,newValue:{claimId:id,status:action},isRollbackable:false};
    await env.DB.prepare("INSERT INTO audit_logs (id,action,entity_type,entity_id,actor_id,created_at,payload_json) VALUES (?,?,?,?,?,?,?)")
      .bind(auditId,audit.action,"operator",claim.operator_id,admin.email,now,JSON.stringify(audit)).run();
    return json({success:true,data:reviewed});
  } catch { return json({success:false,error:"Operator claim review could not be completed."},503); }
}
