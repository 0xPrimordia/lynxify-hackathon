import { NextRequest } from 'next/server';
export declare const dynamic = "force-dynamic";
export declare const runtime = "nodejs";
/**
 * This is a compatibility route that forwards to the standardized /api/connections/pending route
 */
export declare function GET(request: NextRequest): Promise<any>;
