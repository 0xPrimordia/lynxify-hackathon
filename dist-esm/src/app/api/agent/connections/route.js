import { NextResponse } from 'next/server';
// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
/**
 * This is a compatibility route that forwards to the standardized /api/connections route
 */
export async function GET(request) {
    try {
        console.log('🔍 DEBUG: Connections URL path:', request.nextUrl.pathname);
        // Forward the request to the standard endpoint
        const forwardUrl = new URL('/api/connections', request.nextUrl.origin);
        const forwardRequest = new Request(forwardUrl, {
            method: 'GET',
            headers: request.headers,
        });
        return fetch(forwardRequest);
    }
    catch (error) {
        console.error('❌ Error handling connections request:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
