import { NextResponse } from 'next/server';
import { AgentManager } from '@/app/services/agents/agent-manager';
const agentManager = new AgentManager();
export async function GET() {
    try {
        const statuses = agentManager.getAllAgentStatuses();
        const agents = Object.entries(statuses).map(([id, status]) => ({
            id,
            type: id.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
            status,
            lastMessage: {
                type: 'StatusUpdate',
                timestamp: Date.now()
            }
        }));
        return NextResponse.json(agents);
    }
    catch (error) {
        console.error('Error getting agent status:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
