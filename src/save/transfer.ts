import type { RawStorage } from './storage';

/**
 * 세이브 코드: 프로필과 진행 중인 런을 압축해서 글자로 → docs/12-tech.md
 * 기기를 옮기거나, 아이폰이 저장 데이터를 지울 때를 대비한 백업용. 'BDS1.' + base64url(deflate(JSON))
 */

const PREFIX = 'BDS1.';

type Bytes = Uint8Array<ArrayBuffer>;

async function pipe(bytes: Bytes, stream: CompressionStream | DecompressionStream): Promise<Bytes> {
  const output = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(output).arrayBuffer());
}

function toBase64Url(bytes: Bytes): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Bytes {
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
}

export async function encodeSave(data: RawStorage): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(data));
  return PREFIX + toBase64Url(await pipe(json, new CompressionStream('deflate-raw')));
}

/** 코드를 읽는다. 앞뒤 공백·줄바꿈이 섞여도 되고, 깨진 코드면 null */
export async function decodeSave(code: string): Promise<RawStorage | null> {
  const text = code.replace(/\s+/g, '');
  if (!text.startsWith(PREFIX)) return null;
  try {
    const bytes = await pipe(fromBase64Url(text.slice(PREFIX.length)), new DecompressionStream('deflate-raw'));
    const data = JSON.parse(new TextDecoder().decode(bytes)) as Partial<RawStorage>;
    const valid = (value: unknown) => value === null || typeof value === 'string';
    if (!valid(data.profile) || !valid(data.run)) return null;
    return { profile: data.profile ?? null, run: data.run ?? null };
  } catch {
    return null;
  }
}
