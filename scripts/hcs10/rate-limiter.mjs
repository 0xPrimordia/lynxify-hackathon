class RateLimiter {
    constructor() {
        this.requestQueue = new Map(); // topic -> Queue
        this.cache = new Map(); // topicId -> cached messages
        this.backoffDelays = new Map(); // topicId -> current backoff delay
        this.processingTopics = new Set(); // Currently processing topics
        this.BASE_DELAY = 1000; // 1 second base delay
        this.MAX_BACKOFF = 60000; // Max 60 second delay
        this.CACHE_TTL = 300000; // 5 minute cache TTL
    }

    async enqueueRequest(topicId, requestFn) {
        if (!this.requestQueue.has(topicId)) {
            this.requestQueue.set(topicId, []);
        }
        
        // Add request to queue
        const queue = this.requestQueue.get(topicId);
        const promise = new Promise((resolve, reject) => {
            queue.push({ requestFn, resolve, reject });
        });

        // Start processing if not already processing this topic
        if (!this.processingTopics.has(topicId)) {
            this.processQueue(topicId);
        }

        return promise;
    }

    async processQueue(topicId) {
        if (this.processingTopics.has(topicId)) return;
        this.processingTopics.add(topicId);

        try {
            while (this.requestQueue.get(topicId)?.length > 0) {
                const currentDelay = this.backoffDelays.get(topicId) || this.BASE_DELAY;
                await this.delay(currentDelay);

                const request = this.requestQueue.get(topicId)[0];
                try {
                    const result = await request.requestFn();
                    
                    // Success - reduce backoff
                    this.backoffDelays.set(topicId, Math.max(this.BASE_DELAY, currentDelay / 2));
                    request.resolve(result);
                    
                    // Cache successful result
                    this.cache.set(this.getCacheKey(topicId, result), {
                        data: result,
                        timestamp: Date.now()
                    });

                } catch (error) {
                    if (error.response?.status === 429) {
                        // Rate limit hit - increase backoff
                        const newDelay = Math.min(currentDelay * 2, this.MAX_BACKOFF);
                        this.backoffDelays.set(topicId, newDelay);
                        
                        // Re-queue the request
                        this.requestQueue.get(topicId).push(this.requestQueue.get(topicId)[0]);
                    } else {
                        request.reject(error);
                    }
                }

                this.requestQueue.get(topicId).shift();
            }
        } finally {
            this.processingTopics.delete(topicId);
        }
    }

    getCacheKey(topicId, data) {
        // Create a unique cache key based on topic and relevant data
        return `${topicId}-${JSON.stringify(data)}`;
    }

    getCachedResult(topicId, data) {
        const key = this.getCacheKey(topicId, data);
        const cached = this.cache.get(key);
        
        if (!cached) return null;
        
        // Check if cache is still valid
        if (Date.now() - cached.timestamp > this.CACHE_TTL) {
            this.cache.delete(key);
            return null;
        }
        
        return cached.data;
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    clearCache() {
        const now = Date.now();
        for (const [key, value] of this.cache.entries()) {
            if (now - value.timestamp > this.CACHE_TTL) {
                this.cache.delete(key);
            }
        }
    }
}

export default RateLimiter;
