import { TALISMANS, type TalismanInstance } from '../content/talismans';
import type { ClearEvent } from '../core/stage';

interface Props {
  talismans: readonly TalismanInstance[];
  /** 부적 칸 수 (수련 "부적 주머니"로 늘어남) */
  slots: number;
  sealedUid: number | null;
  /** 이 클리어에서 발동한 부적이 흔들리고 효과가 떠오른다 */
  lastClear: ClearEvent | null;
  onTap: (uid: number) => void;
}

export function TalismanBar({ talismans, slots, sealedUid, lastClear, onTap }: Props) {
  const notes = new Map<number, string>();
  for (const step of lastClear?.result.steps ?? []) {
    if (step.source !== undefined) notes.set(step.source, step.note ?? '');
  }

  return (
    <div className="talisman-bar" style={{ gridTemplateColumns: `repeat(${slots}, 1fr)` }}>
      {Array.from({ length: slots }, (_, i) => {
        const talisman = talismans[i];
        if (!talisman) return <div key={`empty-${i}`} className="charm empty" aria-hidden="true" />;
        const def = TALISMANS[talisman.id];
        const note = notes.get(talisman.uid);
        const fired = note !== undefined && lastClear !== null;
        const classes = ['charm'];
        if (fired) classes.push('fired');
        if (talisman.uid === sealedUid) classes.push('sealed');
        return (
          <button
            // 발동할 때마다 key가 바뀌어 흔들림 연출이 다시 재생된다
            key={fired ? `${talisman.uid}-${lastClear.id}` : talisman.uid}
            className={classes.join(' ')}
            onClick={() => onTap(talisman.uid)}
            aria-label={def.name}
          >
            <span className="emoji">{def.emoji}</span>
            {talisman.uid === sealedUid && <span className="seal">🔒</span>}
            {def.status && talisman.counter > 0 && <span className="counter">{talisman.counter}</span>}
            {fired && <span className="note">{note}</span>}
          </button>
        );
      })}
    </div>
  );
}
