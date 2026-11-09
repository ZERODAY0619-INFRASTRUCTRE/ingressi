import {NextRequest,NextResponse} from 'next/server';
import {auth} from '@/src/lib/auth';
import {feedbackSummary} from '@/src/lib/error-feedback';
import {handleFeedbackRequest} from '@/src/lib/error-feedback-handler';
export const runtime='nodejs';
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
export async function POST(req:NextRequest){return handleFeedbackRequest(req);}
export async function GET(req:NextRequest){
  const session=await auth(req);
  if(session?.user.role!=='admin')return NextResponse.json({error:'Forbidden'},{status:403,headers});
  return NextResponse.json({last30Days:feedbackSummary()},{headers});
}
