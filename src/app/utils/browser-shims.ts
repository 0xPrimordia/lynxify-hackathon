/**
 * Browser API shims for testing environments
 * This file provides necessary shims for tests that use browser APIs
 */

// Define global window if it doesn't exist (for Node.js environment)
if (typeof window === 'undefined') {
  global.window = {} as any;
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
  })) as any;
}

// Mock Request object needed by OpenAI
if (typeof Request === 'undefined') {
  // @ts-ignore
  global.Request = class Request {
    constructor(url: string, init?: RequestInit) {}
  };
}

// Mock Response object needed by OpenAI
if (typeof Response === 'undefined') {
  // @ts-ignore
  global.Response = class Response {
    constructor(body?: BodyInit | null, init?: ResponseInit) {}
    json() { return Promise.resolve({}); }
    text() { return Promise.resolve(''); }
    arrayBuffer() { return Promise.resolve(new ArrayBuffer(0)); }
    blob() { return Promise.resolve(new Blob()); }
    formData() { return Promise.resolve(new FormData()); }
    ok: boolean = true;
    status: number = 200;
    statusText: string = 'OK';
    headers: Headers = new Headers();
  };
}

// Mock Headers if needed
if (typeof Headers === 'undefined') {
  // @ts-ignore
  global.Headers = class Headers {
    append(name: string, value: string): void {}
    delete(name: string): void {}
    get(name: string): string | null { return null; }
    has(name: string): boolean { return false; }
    set(name: string, value: string): void {}
    forEach(callback: Function): void {}
  };
}

// Other browser APIs needed by standards-sdk
if (typeof FormData === 'undefined') {
  // @ts-ignore
  global.FormData = class FormData {};
}

if (typeof Blob === 'undefined') {
  // @ts-ignore
  global.Blob = class Blob {};
}

export {}; 