export declare const dynamic = "force-dynamic";
export declare const runtime = "nodejs";
export declare function POST(request: Request, { params }: {
    params: {
        action: string;
    };
}): Promise<any>;
