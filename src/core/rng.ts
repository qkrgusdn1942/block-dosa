/**
 * 시드 랜덤 → docs/12-tech.md
 * 상태가 32비트 정수 하나라서 게임 상태에 그대로 넣을 수 있다.
 * 리듀서 안에서 매번 상태로부터 새로 만들어 쓰므로, 같은 입력이면 항상 같은 결과가 나온다.
 */

/** 문자열 → 32비트 시드 (xmur3) */
export function hashSeed(text: string): number {
  let h = 1779033703 ^ text.length;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

/** mulberry32 */
export class Rng {
  constructor(public state: number) {}

  /** 시드와 용도 이름(스트림)으로 만든다. 예: fromSeed('K7Q2MX', 'bag', 1, 1) */
  static fromSeed(seed: string, ...stream: Array<string | number>): Rng {
    return new Rng(hashSeed([seed, ...stream].join('|')));
  }

  /** 0 이상 1 미만 */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** 0 이상 n 미만 정수 */
  int(n: number): number {
    return Math.floor(this.next() * n);
  }

  shuffle<T>(items: readonly T[]): T[] {
    const result = items.slice();
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}

export const SEED_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** 새 런용 6자리 시드 코드. 헷갈리는 글자(I, O, 0, 1)는 뺐다 */
export function randomSeedCode(length = 6): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += SEED_ALPHABET[Math.floor(Math.random() * SEED_ALPHABET.length)];
  }
  return code;
}
