import { NextResponse } from 'next/server';
// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
/**
 * This is a compatibility route that forwards to the standardized /api/connections/approve route
 */
export async function POST(request) {
    try {
        console.log('🔍 DEBUG: Approval URL path:', request.nextUrl.pathname);
        // Extract connection ID from request body
        let connectionId;
        try {
            const body = await request.json();
            connectionId = body.connectionId;
            console.log('🔍 DEBUG: Found connection ID in body:', connectionId);
        }
        catch (error) {
            console.error('❌ Error parsing request body:', error);
            return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
        }
        if (!connectionId) {
            return NextResponse.json({ success: false, error: 'Missing connection ID in request' }, { status: 400 });
        }
        // Forward the request to the standard endpoint
        const forwardUrl = new URL('/api/connections/approve', request.nextUrl.origin);
        const forwardRequest = new Request(forwardUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ connectionId }),
        });
        return fetch(forwardRequest);
    }
    catch (error) {
        console.error('❌ Error handling connection approval:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
