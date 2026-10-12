import { CONSUMABLE_SLOTS, FREE_UNDOS, HAND_SIZE } from '../content/balance';
import { NO_UNLOCK_RECORDS } from '../content/unlocks';
import { newProfile, PROFILE_VERSION, type Profile } from '../core/profile';
import { NO_VOUCHERS, NOTHING_SEEN, type RunState } from '../core/run';

/**
 * 저장 → docs/12-tech.md
 * localStorage에 JSON으로. 비공개 모드처럼 저장이 막혀도 게임은 그대로 돌아간다.
 * 런 구조를 바꿔서 예전 저장을 못 읽게 되면 SAVE_VERSION을 올린다 (그 저장은 버린다).
 */

export const SAVE_VERSION = 4;
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
 * - 2 → 3 (v1.0): 가방 종류·난이도·끝없는 모드, 보관함·핸드 크기, 장터 무료 리롤·가격, 강화된 팩 블록, 해금 기록
 * - 3 → 4 (v1.1): 주간 도전 규칙, 건너뛰기 쿠폰, 도감, 방해 칸, 소모품 칸 수, 판마다 무료 되돌리기
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
  if (version === 2 && run) {
    const stage = run.stage ?? {};
    const shop = run.shop;
    run = {
      bagType: 'basic',
      stake: 1,
      endless: false,
      ...run,
      records: { ...NO_UNLOCK_RECORDS, ...run.records },
      shop: shop && {
        freeRerolls: 0,
        priceDelta: 0,
        ...shop,
        pack: { ...shop.pack, choices: shop.pack?.choices?.map((shape: string) => ({ shape })) ?? null },
      },
      stage: {
        stash: null,
        stashEnabled: false,
        handSize: HAND_SIZE,
        // 예전엔 손이 비어야 핸드가 끝났으니, 손을 떠난 블록 수 = 빈 칸 수
        resolvedThisHand: HAND_SIZE - (stage.hand ?? []).filter(Boolean).length,
        placedThisHand: 0,
        clearsThisHand: 0,
        ...stage,
        lastClear: stage.lastClear && { gold: 0, lucky: 0, broken: 0, ...stage.lastClear },
      },
    };
    version = 3;
  }
  if (version === 3 && run) {
    const stage = run.stage ?? {};
    const ids = (run.talismans ?? []).map((t: { id: string }) => t.id);
    run = {
      rule: null,
      vouchers: NO_VOUCHERS,
      seen: { ...NOTHING_SEEN, talismans: ids },
      ...run,
      shop: run.shop && { freePack: false, discount: false, ...run.shop },
      stage: {
        obstacle: null,
        consumableSlots: CONSUMABLE_SLOTS + (run.perks?.consumableSlots ?? 0),
        undo: null,
        undoLeft: FREE_UNDOS,
        ...stage,
        lastClear: stage.lastClear && { scrolls: 0, curses: 0, swept: false, ...stage.lastClear },
      },
    };
    version = 4;
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
      if (!saved || saved.version !== PROFILE_VERSION) return newProfile();
      // 나중에 필드가 늘어도 기본값 위에 덮어서 읽는다 (설정·도감은 한 겹 더)
      const base = newProfile();
      return {
        ...base,
        ...saved,
        settings: { ...base.settings, ...saved.settings },
        collection: { ...base.collection, ...saved.collection },
      };
    },
    saveProfile(profile: Profile) {
      write(PROFILE_KEY, profile);
    },
    /** 세이브 코드용: 저장된 글 그대로 */
    exportRaw(): RawStorage {
      const get = (key: string) => {
        try {
          return storage?.getItem(key) ?? null;
        } catch {
          return null;
        }
      };
      return { profile: get(PROFILE_KEY), run: get(RUN_KEY) };
    },
    /** 세이브 코드에서 꺼낸 글로 덮어쓴다. JSON이 아니면 아무것도 바꾸지 않고 false */
    importRaw(data: RawStorage): boolean {
      try {
        if (data.profile !== null) JSON.parse(data.profile);
        if (data.run !== null) JSON.parse(data.run);
        if (data.profile === null) storage?.removeItem(PROFILE_KEY);
        else storage?.setItem(PROFILE_KEY, data.profile);
        if (data.run === null) storage?.removeItem(RUN_KEY);
        else storage?.setItem(RUN_KEY, data.run);
        return true;
      } catch {
        return false;
      }
    },
  };
}

/** localStorage에 저장된 그대로의 글 (세이브 코드로 옮길 때) */
export interface RawStorage {
  profile: string | null;
  run: string | null;
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
