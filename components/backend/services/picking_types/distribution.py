import math
from typing import Dict, List, Optional

from requests import Session

from services.picking_types.update_runtime_db import update_runtime_after_show
from services.picking_types.config import DEFAULT_CONFIG, Config
from services.picking_types.sampling import compute_final_main_weights, compute_final_sub_weights, decay_all_runtime_for_user, load_or_create_main_runtime_rows, load_user_subtype_weights_for_main
from services.picking_types.sampling_helper import pick_k_unique_by_weight, safe_normalize, weighted_sample_no_replacement


def distribute_quotas_among_mains(final_main_weights: Dict[int, float], chosen_mains: List[int],
                                   total_subtypes_target: int, cfg: Config = DEFAULT_CONFIG) -> Dict[int, int]:
    try:
        K = len(chosen_mains)
        if K == 0:
            return {}

        min_per = cfg.min_subtypes_per_main
        max_per = cfg.max_subtypes_per_main
        target = min(total_subtypes_target, cfg.max_subtypes_total)

        quotas = {m: min_per for m in chosen_mains}
        assigned = sum(quotas.values())
        remaining = max(0, target - assigned)

        weights = {m: final_main_weights.get(m, 0.0) for m in chosen_mains}
        weights = safe_normalize(weights)

        desired = {m: weights[m] * remaining for m in chosen_mains}
        floors = {m: math.floor(desired[m]) for m in chosen_mains}
        quotas = {m: quotas[m] + floors[m] for m in chosen_mains}

        assigned = sum(quotas.values())
        remainder = target - assigned

        fracs = {m: desired[m] - floors[m] for m in chosen_mains}
        sorted_keys = sorted(chosen_mains, key=lambda x: (-fracs[x], -weights[x]))

        idx = 0
        while remainder > 0 and idx < len(sorted_keys):
            m = sorted_keys[idx]
            if quotas[m] < max_per:
                quotas[m] += 1
                remainder -= 1
            idx += 1

            if idx == len(sorted_keys) and remainder > 0:
                idx = 0
                if not any(quotas[m] < max_per for m in chosen_mains):
                    break

        for m in quotas:
            quotas[m] = min(quotas[m], max_per)

        total = sum(quotas.values())
        if total > cfg.max_subtypes_total:
            factor = cfg.max_subtypes_total / total
            quotas = {
                m: max(cfg.min_subtypes_per_main, int(math.floor(q * factor)))
                for m, q in quotas.items()
            }

            total = sum(quotas.values())
            keys = list(quotas.keys())
            i = 0
            while total < cfg.max_subtypes_total:
                quotas[keys[i % len(keys)]] += 1
                total += 1
                i += 1

        return quotas

    except Exception as e:
        print(f"[distribute_quotas_among_mains] ERROR: {e}")
        return {}


def pick_subtypes_for_user(session: Session, user_id: int, cfg: Config = DEFAULT_CONFIG, seed: Optional[int] = None):
    try:
        decay_all_runtime_for_user(session, user_id, cfg=cfg)

        final_main = compute_final_main_weights(session, user_id, cfg=cfg)
        if not final_main:
            raise RuntimeError

        
        chosen_mains = pick_k_unique_by_weight(final_main, cfg.K_main_to_select, seed=seed)

        load_or_create_main_runtime_rows(session, user_id, chosen_mains)
        
        quotas = distribute_quotas_among_mains(final_main, chosen_mains, cfg.target_subtypes_total, cfg=cfg)

        result = []
        for m in chosen_mains:
            q = quotas.get(m, 0)
            if q <= 0:
                continue
            sub_w = compute_final_sub_weights(session, user_id, m, cfg)
            if not sub_w:
                continue
            pop = list(sub_w.keys())
            weights = [sub_w[k] for k in pop]
            chosen = weighted_sample_no_replacement(pop, weights, q, seed=seed)
            result.extend([(m, s) for s in chosen])

        
        update_runtime_after_show(
            session=session,
            user_id=user_id,
            shown_main_ids=chosen_mains,
            shown_subtype_ids=result
        )

        return result

    except Exception as e:
        print(f"[pick_subtypes_for_user] ERROR for user {user_id}: {e}")
        return []