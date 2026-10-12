/** 해금 조건에 쓰는 지금까지의 기록 → docs/06-incremental.md */
export interface UnlockRecords {
  /** 가장 멀리 간 고개 */
  bestAnte: number;
  endings: number;
  /** 지금까지 한 대청소 수 */
  totalPerfects: number;
  runs: number;
}

export interface Unlock {
  /** "대청소 누적 3번" 처럼 화면에 보여줄 조건 */
  text: string;
  check: (records: UnlockRecords) => boolean;
}

export const NO_UNLOCK_RECORDS: UnlockRecords = { bestAnte: 0, endings: 0, totalPerfects: 0, runs: 0 };

export const isUnlocked = (unlock: Unlock | undefined, records: UnlockRecords | null) =>
  !unlock || records === null || unlock.check(records);
