/**
 * Utility function to safely disable all timers in the agent for testing
 * This helps prevent "Cannot log after tests are done" errors
 */
export async function disableAgentTimers(agent) {
    // Safely access services and disable their timers
    try {
        const hcs10Service = agent.getHCS10Service();
        if (hcs10Service && typeof hcs10Service.disablePeriodicTimers === 'function') {
            hcs10Service.disablePeriodicTimers();
        }
        const indexService = agent.getIndexService();
        if (indexService && typeof indexService.disableRiskAssessmentTimer === 'function') {
            indexService.disableRiskAssessmentTimer();
        }
    }
    catch (error) {
        // Ignore errors - this is just a best-effort cleanup function
        console.warn('Error while disabling agent timers:', error);
    }
}
