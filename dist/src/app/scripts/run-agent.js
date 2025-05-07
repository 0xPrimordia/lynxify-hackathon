import { AgentManager } from '../services/agents/agent-manager';
async function main() {
    const agentManager = new AgentManager();
    try {
        console.log('Starting agent manager...');
        await agentManager.start();
        console.log('Agent manager started successfully');
        // Keep the process running
        process.on('SIGINT', async () => {
            console.log('\nShutting down agent manager...');
            await agentManager.stop();
            process.exit(0);
        });
        process.on('SIGTERM', async () => {
            console.log('\nShutting down agent manager...');
            await agentManager.stop();
            process.exit(0);
        });
    }
    catch (error) {
        console.error('Error running agent manager:', error);
        process.exit(1);
    }
}
main().catch(console.error);
