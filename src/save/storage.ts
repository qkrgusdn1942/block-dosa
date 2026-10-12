import { newProfile, PROFILE_VERSION, type Profile } from '../core/profile';
import type { RunState } from '../core/run';

/**
 * 저장 → docs/12-tech.md
 * localStorage에 JSON으로. 비공개 모드처럼 저장이 막혀도 게임은 그대로 돌아간다.
 * 런 구조를 바꿔서 예전 저장을 못 읽게 되면 SAVE_VERSION을 올린다 (그 저장은 버린다).
 */

export const SAVE_VERSION = 2;
const RUN_KEY = 'block-dosa:run';
const PROFILE_KEY = 'block-dosa:profile';

export interface SavedRun {
  version: number;
  id: string;
  savedAt: number;
  run: RunState;
}

/**
 * 예전 저장을 지금 구조로 올린다. 못 올리면 null
 * - 1 → 2 (v0.4): 런 종류·공식 여부·판 결과 기록·최고 한 방 족보·끝판 표시가 생김
 */
function migrate(raw: RawSave): SavedRun | null {
  let { version, run } = raw;
  if (version === 1 && run) {
    run = {
      mode: 'normal',
      official: false,
      history: [],
      ...run,
      stats: { bestPattern: null, ...run.stats },
      stage: { scoreAttack: false, ...run.stage, stats: { bestPattern: null, ...run.stage?.stats } },
    };
    version = 2;
  }
  if (version !== SAVE_VERSION || typeof raw.id !== 'string' || !run?.stage) return null;
  return { version, id: raw.id, savedAt: Number(raw.savedAt) || 0, run: run as RunState };
}

/** JSON에서 막 읽은, 아직 구조를 확인하지 않은 저장 */
interface RawSave {
  version?: unknown;
  id?: unknown;
  savedAt?: unknown;
  // 예전 구조를 그대로 다루는 곳이라 타입을 느슨하게 둔다
  run?: any;
}

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function createSaveStore(storage: KeyValueStorage | null) {
  const read = (key: string): unknown => {
    try {
      const text = storage?.getItem(key);
      return text ? JSON.parse(text) : null;
    } catch {
      return null;
    }
  };
  const write = (key: string, value: unknown) => {
    try {
      storage?.setItem(key, JSON.stringify(value));
    } catch {
      // 용량 초과·저장 금지: 이번 저장만 건너뛴다
    }
  };
  const remove = (key: string) => {
    try {
      storage?.removeItem(key);
    } catch {
      // 위와 같음
    }
  };

  return {
    loadRun(): SavedRun | null {
      const saved = read(RUN_KEY);
      return saved && typeof saved === 'object' ? migrate(saved as RawSave) : null;
    },
    saveRun(id: string, run: RunState) {
      write(RUN_KEY, { version: SAVE_VERSION, id, savedAt: Date.now(), run } satisfies SavedRun);
    },
    clearRun() {
      remove(RUN_KEY);
    },
    loadProfile(): Profile {
      const saved = read(PROFILE_KEY) as Partial<Profile> | null;
      // 나중에 필드가 늘어도 기본값 위에 덮어서 읽는다
      return saved && saved.version === PROFILE_VERSION ? { ...newProfile(), ...saved } : newProfile();
    },
    saveProfile(profile: Profile) {
      write(PROFILE_KEY, profile);
    },
  };
}

export type SaveStore = ReturnType<typeof createSaveStore>;

function browserStorage(): KeyValueStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export const saveStore = createSaveStore(typeof window === 'undefined' ? null : browserStorage());
