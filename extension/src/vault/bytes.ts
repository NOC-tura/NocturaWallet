import {base64} from '@scure/base';

export const b64 = (bytes: Uint8Array): string => base64.encode(bytes);
export const unb64 = (s: string): Uint8Array<ArrayBuffer> => new Uint8Array(base64.decode(s));
export const utf8 = (s: string): Uint8Array<ArrayBuffer> => new TextEncoder().encode(s);
