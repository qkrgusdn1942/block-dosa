import { useState, type ReactNode } from 'react';
import {
  BONUS_WEIGHTS,
  GEM_GOLD,
  OBSTACLE_FROM_ANTE,
  PATTERNS,
  PATTERN_IDS,
  RARITY_NAMES,
  SHOP_CONSUMABLE_WEIGHTS,
  STAR_MULT,
  TALISMAN_PRICE,
  type Rarity,
} from '../content/balance';
import { BAG_TYPES } from '../content/bags';
import { BOSSES, type BossId } from '../content/bosses';
import { CHANGE_LABELS, RELEASES } from '../content/changelog';
import { consumableInfo, type Consumable } from '../content/consumables';
import { ENHANCEMENT_IDS, ENHANCEMENTS } from '../content/enhancements';
import { OBSTACLE_IDS, OBSTACLES } from '../content/obstacles';
import { STAKES } from '../content/stakes';
import { TALISMAN_IDS, TALISMANS } from '../content/talismans';
import { UPGRADES } from '../content/upgrades';
import { consumablePrice } from '../core/shop';

/** 변경 사항과 모든 요소의 설명 → docs/11-ui-ux.md. 수치는 게임 데이터에서 바로 가져온다 */

type Tab = 'changes' | 'talismans' | 'consumables' | 'enhancements' | 'upgrades' | 'bosses' | 'cells' | 'bags';

const TABS: ReadonlyArray<readonly [Tab, string]> = [
  ['changes', '변경 사항'],
  ['talismans', '부적'],
  ['consumables', '소모품'],
  ['enhancements', '강화'],
  ['upgrades', '수련'],
  ['bosses', '요괴'],
  ['cells', '판의 칸'],
  ['bags', '가방·난이도'],
];

/** 이모지 + 이름 + 꼬리표 + 설명 한 줄 */
function Entry({ icon, name, tags = [], children }: { icon: ReactNode; name: string; tags?: string[]; children: ReactNode }) {
  return (
    <li className="info-entry">
      <span className="info-icon">{icon}</span>
      <div className="info-body">
        <div className="info-name">
          {name}
          {tags.map((tag) => (
            <span key={tag} className="tag">
              {tag}
            </span>
          ))}
        </div>
        <div className="info-text">{children}</div>
      </div>
    </li>
  );
}

function Changes() {
  return (
    <>
      {RELEASES.map((release) => (
        <section key={release.version} className="release">
          <h2 className="section-title">
            {release.version} <small>{release.title}</small>
          </h2>
          {release.sections.map((section) => (
            <div key={section.title}>
              <h3 className="info-subtitle">{section.title}</h3>
              <ul className="change-list">
                {section.lines.map((line) => (
                  <li key={line.target}>
                    <span className={`change-tag ${line.kind}`}>{CHANGE_LABELS[line.kind]}</span>
                    <div>
                      <b>{line.target}</b>
                      <p>{line.text}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ))}
    </>
  );
}

const RARITY_ORDER: readonly Rarity[] = ['common', 'uncommon', 'rare', 'legendary', 'cursed'];

function priceTag(rarity: Rarity): string {
  if (rarity === 'legendary') return '요괴 유품 전용';
  if (rarity === 'cursed') return `$${TALISMAN_PRICE.cursed} · 팔 수 없음`;
  return `$${TALISMAN_PRICE[rarity]}`;
}

function Talismans() {
  return (
    <>
      <p className="hint">최대 5칸. 왼쪽부터 순서대로 발동해요. 팔면 구매가의 절반.</p>
      {RARITY_ORDER.map((rarity) => (
        <section key={rarity}>
          <h3 className="info-subtitle">
            {RARITY_NAMES[rarity]} · {priceTag(rarity)}
          </h3>
          <ul className="info-list">
            {TALISMAN_IDS.filter((id) => TALISMANS[id].rarity === rarity).map((id) => {
              const def = TALISMANS[id];
              return (
                <Entry key={id} icon={def.emoji} name={def.name} tags={def.unlock ? [`열기: ${def.unlock.text}`] : []}>
                  {def.text}
                </Entry>
              );
            })}
          </ul>
        </section>
      ))}
    </>
  );
}

/** 소모품 종류마다 하나씩 (비전서·도장은 종류가 여러 개) */
const SAMPLES: readonly Consumable[] = [
  { kind: 'scroll', pattern: 'single' },
  { kind: 'hammer' },
  { kind: 'broom' },
  { kind: 'fan' },
  { kind: 'hourglass' },
  { kind: 'stamp', enh: 'gold' },
  { kind: 'ink' },
];

const USE_LABEL = { stage: '판 진행 중', shop: '장터에서', anywhere: '언제든' } as const;
const totalWeight = SHOP_CONSUMABLE_WEIGHTS.reduce((sum, [, w]) => sum + w, 0);
const shopShare = (kind: Consumable['kind']) =>
  Math.round(((SHOP_CONSUMABLE_WEIGHTS.find(([k]) => k === kind)?.[1] ?? 0) / totalWeight) * 100);

function Consumables() {
  return (
    <>
      <p className="hint">한 번 쓰면 사라져요. 기본 2칸 (수련 "소매"로 +1).</p>
      <ul className="info-list">
        {SAMPLES.map((item) => {
          const info = consumableInfo(item);
          const tags = [`$${consumablePrice(item)}`, USE_LABEL[info.use], `장터 ${shopShare(item.kind)}%`];
          if (item.kind === 'scroll') {
            return (
              <Entry key={item.kind} icon={info.emoji} name="비전서 (족보별 5종)" tags={tags}>
                그 족보 레벨 +1:{' '}
                {PATTERN_IDS.map((id) => `${PATTERNS[id].name} 칩 +${PATTERNS[id].chipsPerLevel}·배수 +${PATTERNS[id].multPerLevel}`).join(', ')}
              </Entry>
            );
          }
          if (item.kind === 'stamp') {
            return (
              <Entry key={item.kind} icon={info.emoji} name="도장 (강화별 5종)" tags={tags}>
                가방의 블록 2개를 그 강화 블록으로 ({ENHANCEMENT_IDS.map((id) => ENHANCEMENTS[id].name).join('·')})
              </Entry>
            );
          }
          return (
            <Entry key={item.kind} icon={info.emoji} name={info.name} tags={tags}>
              {info.text}
            </Entry>
          );
        })}
      </ul>
    </>
  );
}

function Enhancements() {
  return (
    <>
      <p className="hint">강화된 블록을 놓으면 그 칸들이 강화를 갖고 있다가, 줄과 함께 지워질 때 발동해요. 🐻 불가사리 판에서는 꺼져요.</p>
      <ul className="info-list">
        {ENHANCEMENT_IDS.map((id) => (
          <Entry key={id} icon={<span className={`enh-chip enh enh-${id}`}>{ENHANCEMENTS[id].mark}</span>} name={ENHANCEMENTS[id].name}>
            {ENHANCEMENTS[id].text}
          </Entry>
        ))}
      </ul>
      <p className="hint">얻는 법: 🔖 도장, 장터 블록 팩(블록마다 20%), 🖌️ 먹으로 복사, 혼돈 가방</p>
    </>
  );
}

function Upgrades() {
  return (
    <>
      <p className="hint">런이 끝나면 받는 공덕으로 배워요. 다음 런부터 적용 (오늘의 판·주간 도전·코드 도전은 빼고).</p>
      <ul className="info-list">
        {UPGRADES.map((upgrade) => (
          <Entry key={upgrade.id} icon={upgrade.emoji} name={upgrade.name} tags={[`공덕 ${upgrade.costs.join(' / ')}`]}>
            {upgrade.text}
          </Entry>
        ))}
      </ul>
    </>
  );
}

const BOSS_IDS = Object.keys(BOSSES) as BossId[];

function Bosses() {
  return (
    <>
      <p className="hint">고개마다 세 번째 판. 판 시작 전에 규칙을 보여줘요.</p>
      <ul className="info-list">
        {BOSS_IDS.map((id) => {
          const def = BOSSES[id];
          const when = def.final ? '고개 8 · 끝없는 모드의 8의 배수 고개' : `고개 ${def.minAnte}부터`;
          return (
            <Entry key={id} icon={def.emoji} name={def.name} tags={[when, `목표 ×${def.targetMult}`]}>
              {def.rule}
            </Entry>
          );
        })}
      </ul>
    </>
  );
}

const bonusShare = (kind: string) => BONUS_WEIGHTS.find(([k]) => k === kind)?.[1] ?? 0;

function Cells() {
  return (
    <>
      <h3 className="info-subtitle">방해 칸</h3>
      <ul className="info-list">
        <Entry icon="🪨" name="바위" tags={['고개 3 판 2부터']}>
          줄에 포함되지만 칩은 0. 한 번 지우면 금이 가고, 두 번째에 부서져요. 🔨 망치·🧹 빗자루로 바로 부술 수 있어요.
        </Entry>
        {OBSTACLE_IDS.map((id) => (
          <Entry
            key={id}
            icon={OBSTACLES[id].emoji}
            name={OBSTACLES[id].name}
            tags={[`판 2는 고개 ${OBSTACLE_FROM_ANTE.big}부터`, `판 1은 고개 ${OBSTACLE_FROM_ANTE.small}부터`]}
          >
            {OBSTACLES[id].rule}
          </Entry>
        ))}
      </ul>
      <p className="hint">방해 칸은 판마다 5종 중 1종. 판 미리보기와 장터의 "다음:" 줄에서 미리 보여줘요.</p>
      <h3 className="info-subtitle">보너스 칸 (판마다 0~2개)</h3>
      <ul className="info-list">
        <Entry icon="💎" name="보석 칸" tags={[`${bonusShare('gem')}%`]}>
          덮은 블록이 지워지면 +${GEM_GOLD}
        </Entry>
        <Entry icon="⭐" name="별 칸" tags={[`${bonusShare('star')}%`]}>
          덮은 블록이 지워지면 그 클리어 점수 ×{STAR_MULT}
        </Entry>
        <Entry icon="📜" name="두루마리 칸" tags={[`${bonusShare('scroll')}%`]}>
          덮은 블록이 지워지면 비전서 1장 (소모품 칸이 비어 있을 때)
        </Entry>
      </ul>
    </>
  );
}

function Bags() {
  return (
    <>
      <h3 className="info-subtitle">가방 (새 런 준비에서 고름)</h3>
      <ul className="info-list">
        {BAG_TYPES.map((bag) => (
          <Entry key={bag.id} icon={bag.emoji} name={bag.name} tags={bag.unlock ? [`열기: ${bag.unlock.text}`] : ['처음부터']}>
            {bag.text}
          </Entry>
        ))}
      </ul>
      <h3 className="info-subtitle">난이도 (엔딩을 보면 다음 단계가 열리고, 규칙이 쌓여요)</h3>
      <ul className="info-list">
        {STAKES.map((stake) => (
          <Entry key={stake.level} icon={<b className="stake-badge">{stake.level}</b>} name={stake.name}>
            {stake.rule}
          </Entry>
        ))}
      </ul>
    </>
  );
}

const CONTENT: Record<Tab, () => ReactNode> = {
  changes: Changes,
  talismans: Talismans,
  consumables: Consumables,
  enhancements: Enhancements,
  upgrades: Upgrades,
  bosses: Bosses,
  cells: Cells,
  bags: Bags,
};

export function InfoScreen({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<Tab>('changes');
  const Content = CONTENT[tab];
  return (
    <div className="screen shop-screen">
      <header className="shop-head">
        <button className="back-button" onClick={onBack}>
          ← 처음 화면
        </button>
      </header>
      <h1 className="screen-title">변경·설명</h1>
      <div className="info-tabs" role="tablist">
        {TABS.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      <Content />
    </div>
  );
}
