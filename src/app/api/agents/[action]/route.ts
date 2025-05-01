import { NextResponse } from 'next/server';
import { AgentManager } from '@/app/services/agents/agent-manager';

const agentManager = new AgentManager();

export async function POST(
  request: Request,
  { params }: { params: { action: string } }
) {
  try {
    const { agentId } = await request.json();
    const action = params.action;

    if (!agentId || !['start', 'stop'].includes(action)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    if (action === 'start') {
      await agentManager.startAgent(agentId);
      return NextResponse.json({ status: 'started', agentId });
    } else if (action === 'stop') {
      await agentManager.stopAgent(agentId);
      return NextResponse.json({ status: 'stopped', agentId });
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error handling agent action:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 