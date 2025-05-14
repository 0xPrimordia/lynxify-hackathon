import { NextResponse } from 'next/server';
import { AgentManager } from '@/app/services/agents/agent-manager';
// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const agentManager = new AgentManager();
export async function POST(request, { params }) {
    try {
        const data = await request.json();
        const { agentId } = data;
        const action = params.action;
        if (!agentId || !['start', 'stop'].includes(action)) {
            return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });
        }
        if (action === 'start') {
            await agentManager.startAgent(agentId);
            return NextResponse.json({ success: true, status: 'started', agentId });
        }
        else {
            await agentManager.stopAgent(agentId);
            return NextResponse.json({ success: true, status: 'stopped', agentId });
        }
    }
    catch (error) {
        console.error('Error handling agent action:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
