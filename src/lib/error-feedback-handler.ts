import {validFeedback,saveFeedback} from './error-feedback';
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
export async function handleFeedbackRequest(req:Request){
  const origin=req.headers.get('origin');
  try{if(!origin||new URL(origin).host!==req.headers.get('host'))return Response.json({error:'Invalid origin'},{status:403,headers});}catch{return Response.json({error:'Invalid origin'},{status:403,headers});}
  if(req.headers.get('content-type')?.split(';')[0]!=='application/json')return Response.json({error:'Unsupported content type'},{status:415,headers});
  const reader=req.body?.getReader();if(!reader)return Response.json({error:'Missing body'},{status:400,headers});
  const chunks:Uint8Array[]=[];let size=0;
  try{
    while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>2048){await reader.cancel();return Response.json({error:'Body too large'},{status:413,headers});}chunks.push(value);}
    const value:unknown=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if(!validFeedback(value))return Response.json({error:'Invalid feedback'},{status:400,headers});
    const result=saveFeedback(value);
    if(result==='limited')return Response.json({error:'Try later'},{status:429,headers:{...headers,'Retry-After':'60'}});
    return Response.json({saved:true},{headers});
  }catch{return Response.json({error:'Unable to save feedback'},{status:400,headers});}
}
