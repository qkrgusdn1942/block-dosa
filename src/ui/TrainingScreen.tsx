import { UPGRADES, type UpgradeId } from '../content/upgrades';
import { nextUpgradeCost, upgradeLevel, type Profile } from '../core/profile';
import { OfferCard } from './OfferCard';

interface Props {
  profile: Profile;
  onBuy: (id: UpgradeId) => void;
  onBack: () => void;
}

/** 수련: 공덕으로 영구 강화 → docs/06-incremental.md */
export function TrainingScreen({ profile, onBuy, onBack }: Props) {
  return (
    <div className="screen shop-screen">
      <header className="shop-head">
        <button className="back-button" onClick={onBack}>
          ← 처음 화면
        </button>
        <span className="merit big">공덕 {profile.merit}</span>
      </header>
      <h1 className="screen-title">수련</h1>
      <p className="next-info">런이 끝나면 고개·요괴·엔딩에 따라 공덕을 받아요. 배운 수련은 다음 런부터 적용돼요.</p>

      <div className="offers">
        {UPGRADES.map((upgrade) => {
          const level = upgradeLevel(profile, upgrade.id);
          const cost = nextUpgradeCost(profile, upgrade.id);
          return (
            <OfferCard
              key={upgrade.id}
              emoji={upgrade.emoji}
              name={upgrade.name}
              tag={`${level}/${upgrade.costs.length}단계`}
              text={upgrade.text}
              action={cost === null ? '다 배움' : `공덕 ${cost}`}
              disabled={cost === null || profile.merit < cost}
              onAction={() => onBuy(upgrade.id)}
            />
          );
        })}
      </div>
    </div>
  );
}
