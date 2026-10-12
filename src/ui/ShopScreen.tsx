import { MIN_BAG_SIZE, PACK_PRICE, RARITY_NAMES, REMOVAL_PRICE, STAGE_NAMES } from '../content/balance';
import { BOSSES } from '../content/bosses';
import { consumableInfo } from '../content/consumables';
import { TALISMANS } from '../content/talismans';
import { formatKo } from '../core/format';
import {
  consumableSlots,
  consumableSlotsFull,
  talismanSlots,
  talismanSlotsFull,
  upcomingStage,
  type RunAction,
  type RunState,
} from '../core/run';
import { rerollCost } from '../core/shop';
import { ConsumableSlots } from './ConsumableSlots';
import { OfferCard } from './OfferCard';
import { TalismanBar } from './TalismanBar';

interface Props {
  run: RunState;
  dispatch: (action: RunAction) => void;
  onTalismanTap: (uid: number) => void;
  onConsumableTap: (index: number) => void;
  onBag: () => void;
  onRemoveBlock: () => void;
}

/** 판 사이 장터 → docs/03-roguelike.md */
export function ShopScreen({ run, dispatch, onTalismanTap, onConsumableTap, onBag, onRemoveBlock }: Props) {
  const shop = run.shop;
  if (!shop) return null;
  const next = upcomingStage(run);
  const nextBoss = next.boss ? BOSSES[next.boss] : null;
  const fullTalismans = talismanSlotsFull(run);
  const fullConsumables = consumableSlotsFull(run);
  const reroll = rerollCost(shop);
  const canRemove = !shop.removalUsed && run.gold >= REMOVAL_PRICE && run.bag.length > MIN_BAG_SIZE;

  const buyLabel = (sold: boolean, full: boolean, price: number) => (sold ? '판매 완료' : full ? '칸 가득' : `$${price}`);

  return (
    <div className="screen shop-screen">
      <header className="shop-head">
        <h1>장터</h1>
        <span className="gold big">${run.gold}</span>
      </header>
      <p className="next-info">
        {next.kind === 'finale' ? (
          '다음: 🏁 끝판 · 목표 없이 최대한 점수 내기'
        ) : (
          <>
            다음: 고개 {next.ante} · {STAGE_NAMES[next.kind]}
            {nextBoss && ` ${nextBoss.emoji} ${nextBoss.name}`} · 목표 {formatKo(next.target)}
          </>
        )}
      </p>

      <TalismanBar
        talismans={run.talismans}
        slots={talismanSlots(run)}
        sealedUid={null}
        lastClear={null}
        onTap={onTalismanTap}
      />

      <h2 className="section-title">부적</h2>
      <div className="offers">
        {shop.talismans.length === 0 && <p className="hint">더 살 수 있는 부적이 없어요.</p>}
        {shop.talismans.map((offer, slot) => {
          const def = TALISMANS[offer.item];
          return (
            <OfferCard
              key={`${offer.item}-${slot}`}
              emoji={def.emoji}
              name={def.name}
              tag={RARITY_NAMES[def.rarity]}
              text={def.text}
              action={buyLabel(offer.sold, fullTalismans, offer.price)}
              disabled={offer.sold || fullTalismans || run.gold < offer.price}
              onAction={() => dispatch({ type: 'buyTalisman', slot })}
            />
          );
        })}
      </div>

      <h2 className="section-title">소모품</h2>
      <div className="offers">
        {shop.consumables.map((offer, slot) => {
          const info = consumableInfo(offer.item);
          return (
            <OfferCard
              key={slot}
              emoji={info.emoji}
              name={info.name}
              text={info.text}
              action={buyLabel(offer.sold, fullConsumables, offer.price)}
              disabled={offer.sold || fullConsumables || run.gold < offer.price}
              onAction={() => dispatch({ type: 'buyConsumable', slot })}
            />
          );
        })}
      </div>

      <h2 className="section-title">블록</h2>
      <div className="offers">
        <OfferCard
          emoji="🎁"
          name="블록 팩"
          text="블록 3개 중 1개를 골라 가방에 넣어요"
          action={shop.pack.bought ? '판매 완료' : `$${PACK_PRICE}`}
          disabled={shop.pack.bought || run.gold < PACK_PRICE}
          onAction={() => dispatch({ type: 'buyPack' })}
        />
        <OfferCard
          emoji="🗑️"
          name="블록 빼기"
          text={`가방에서 블록 1개를 빼요 (장터마다 1번, 최소 ${MIN_BAG_SIZE}개)`}
          action={shop.removalUsed ? '사용함' : `$${REMOVAL_PRICE}`}
          disabled={!canRemove}
          onAction={onRemoveBlock}
        />
      </div>

      <div className="shop-footer">
        <ConsumableSlots
          items={run.consumables}
          slots={consumableSlots(run)}
          activeIndex={null}
          onTap={onConsumableTap}
        />
        <button className="ctrl secondary" onClick={onBag}>
          가방
        </button>
        <button className="ctrl secondary" disabled={run.gold < reroll} onClick={() => dispatch({ type: 'reroll' })}>
          리롤 ${reroll}
        </button>
        <button className="ctrl" onClick={() => dispatch({ type: 'next' })}>
          다음 판 →
        </button>
      </div>
    </div>
  );
}
