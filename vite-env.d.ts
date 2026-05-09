/// <reference types="vite/client" />

declare global {
  interface Window {
    aistudio?: {
      openSelectKey?: () => Promise<void>;
    };
    pannellum: any;
  }
}

declare module 'https://deno.land/std@0.168.0/http/server.ts' {
  export function serve(handler: (request: Request) => Response | Promise<Response>): void;
}

export {};
