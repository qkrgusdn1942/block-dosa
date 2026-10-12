import { useState } from 'react';
import { BAG_BY_ID, BAG_TYPES, type BagType } from '../content/bags';
import { STAKES } from '../content/stakes';
import { isUnlocked } from '../content/unlocks';
import { maxStake, recordsOf, type Profile, type RunSetup } from '../core/profile';

interface Props {
  profile: Profile;
  onStart: (setup: RunSetup) => void;
  onBack: () => void;
}

/** 새 런 준비: 가방과 난이도 고르기 → docs/03-roguelike.md, docs/08-difficulty.md */
export function RunSetupScreen({ profile, onStart, onBack }: Props) {
  const records = recordsOf(profile);
  const highest = maxStake(profile);
  const last = profile.lastSetup;
  const [bagType, setBagType] = useState<BagType>(() =>
    last && isUnlocked(BAG_BY_ID[last.bagType].unlock, records) ? last.bagType : 'basic',
  );
  const [stake, setStake] = useState(() => Math.min(last?.stake ?? 1, highest));

  return (
    <div className="screen shop-screen">
      <header className="shop-head">
        <button className="back-button" onClick={onBack}>
          ← 처음 화면
        </button>
      </header>
      <h1 className="screen-title">새 런</h1>

      <h2 className="section-title">가방</h2>
      <div className="choices">
        {BAG_TYPES.map((bag) => {
          const unlocked = isUnlocked(bag.unlock, records);
          const classes = ['choice', ...(bagType === bag.id ? ['on'] : [])];
          return (
            <button
              key={bag.id}
              className={classes.join(' ')}
              disabled={!unlocked}
              aria-pressed={bagType === bag.id}
              onClick={() => setBagType(bag.id)}
            >
              <span className="choice-emoji">{unlocked ? bag.emoji : '🔒'}</span>
              <span className="choice-body">
                <b>{bag.name}</b>
                <small>{unlocked ? bag.text : `열기: ${bag.unlock?.text}`}</small>
              </span>
            </button>
          );
        })}
      </div>

      <h2 className="section-title">난이도</h2>
      <div className="stakes">
        {STAKES.map((def) => (
          <button
            key={def.level}
            className={def.level === stake ? 'stake on' : 'stake'}
            disabled={def.level > highest}
            aria-label={`난이도 ${def.level} ${def.name}`}
            aria-pressed={def.level === stake}
            onClick={() => setStake(def.level)}
          >
            {def.level > highest ? '🔒' : def.level}
          </button>
        ))}
      </div>
      <p className="stake-name">
        {stake}단계 · {STAKES[stake - 1].name}
      </p>
      <ul className="rules">
        {stake === 1 ? <li>기본 규칙</li> : STAKES.slice(1, stake).map((def) => <li key={def.level}>{def.rule}</li>)}
      </ul>
      <p className="hint">
        이 단계로 엔딩을 보면 다음 단계가 열려요. 단계가 오를수록 규칙이 하나씩 더 붙어요.
        {highest < STAKES.length && ` (다음: ${highest + 1}단계 ${STAKES[highest].name})`}
      </p>

      <div className="shop-footer">
        <button className="ctrl" onClick={() => onStart({ bagType, stake })}>
          시작
        </button>
      </div>
    </div>
  );
}
