/**
 * Browser API shims for testing environments
 * This file provides necessary shims for tests that use browser APIs
 */
// Define global window if it doesn't exist (for Node.js environment)
if (typeof window === 'undefined') {
    global.window = {};
}
// Mock fetch if needed
if (typeof global.fetch === 'undefined') {
    global.fetch = (() => Promise.resolve({
        json: () => Promise.resolve({}),
        text: () => Promise.resolve(''),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
        blob: () => Promise.resolve(new Blob()),
        formData: () => Promise.resolve(new FormData()),
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
    }));
}
// Mock Request object needed by OpenAI
if (typeof Request === 'undefined') {
    // @ts-ignore
    global.Request = class Request {
        constructor(url, init) { }
    };
}
// Mock Response object needed by OpenAI
if (typeof Response === 'undefined') {
    // @ts-ignore
    global.Response = class Response {
        constructor(body, init) {
            this.ok = true;
            this.status = 200;
            this.statusText = 'OK';
            this.headers = new Headers();
        }
        json() { return Promise.resolve({}); }
        text() { return Promise.resolve(''); }
        arrayBuffer() { return Promise.resolve(new ArrayBuffer(0)); }
        blob() { return Promise.resolve(new Blob()); }
        formData() { return Promise.resolve(new FormData()); }
    };
}
// Mock Headers if needed
if (typeof Headers === 'undefined') {
    // @ts-ignore
    global.Headers = class Headers {
        append(name, value) { }
        delete(name) { }
        get(name) { return null; }
        has(name) { return false; }
        set(name, value) { }
        forEach(callback) { }
    };
}
// Other browser APIs needed by standards-sdk
if (typeof FormData === 'undefined') {
    // @ts-ignore
    global.FormData = class FormData {
    };
}
if (typeof Blob === 'undefined') {
    // @ts-ignore
    global.Blob = class Blob {
    };
}
export {};
