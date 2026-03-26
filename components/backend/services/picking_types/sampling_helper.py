import random
from typing import Dict, List, Optional
from typing import Dict, List
from unittest.mock import Base

from sqlalchemy.orm import Session

from models import MainType, Subtype, UserMainTypeWeight, UserSubtypeRuntime, UserSubtypeWeight, UserTypeRuntime


def init_runtime_db(engine):
    Base.metadata.create_all(engine, tables=[UserTypeRuntime.__table__, UserSubtypeRuntime.__table__])

def load_user_main_weights(session: Session, user_id: int) -> Dict[int, float]:
    try:
        hotel_main = session.query(MainType).filter(
            MainType.name.ilike("Hotels & Accommodation")
        ).first()

        q = session.query(UserMainTypeWeight).filter(
            UserMainTypeWeight.user_id == user_id,
            UserMainTypeWeight.main_type_id != hotel_main.id
        ).all()

        return {r.main_type_id: float(r.weight) for r in q}

    except Exception as e:
        print(f"[load_user_main_weights] ERROR for user {user_id}: {e}")
        return {}
    
    
def load_user_subtype_weights_for_main(session: Session, user_id: int, main_id: int) -> Dict[int, float]:
    q = (session.query(UserSubtypeWeight, Subtype)
         .join(Subtype, Subtype.id == UserSubtypeWeight.subtype_id)
         .filter(UserSubtypeWeight.user_id == user_id, Subtype.main_type_id == main_id)
         .all())
    res = {}
    for uw, st in q:
        res[st.id] = float(uw.weight)
    return res

def load_or_create_main_runtime_rows(session: Session, user_id: int, main_ids: List[int]):
    existing = session.query(UserTypeRuntime).filter(
        UserTypeRuntime.user_id == user_id,
        UserTypeRuntime.main_type_id.in_(main_ids)
    ).all()
    existing_map = {(r.user_id, r.main_type_id): r for r in existing}
    new_rows = []
    for mid in main_ids:
        if (user_id, mid) not in existing_map:
            row = UserTypeRuntime(user_id=user_id, main_type_id=mid, fatigue=0.0, exploration=0.0, last_shown_at=None)
            session.add(row)
            new_rows.append(row)
    if new_rows:
        session.commit()

def load_or_create_sub_runtime_rows(session: Session, user_id: int, sub_ids: List[int]):
    existing = session.query(UserSubtypeRuntime).filter(
        UserSubtypeRuntime.user_id == user_id,
        UserSubtypeRuntime.subtype_id.in_(sub_ids)
    ).all()
    existing_map = {(r.user_id, r.subtype_id): r for r in existing}
    new_rows = []
    for sid in sub_ids:
        if (user_id, sid) not in existing_map:
            row = UserSubtypeRuntime(user_id=user_id, subtype_id=sid, fatigue=0.0, exploration=0.0, last_shown_at=None)
            session.add(row)
            new_rows.append(row)
    if new_rows:
        session.commit()


def safe_normalize(d: Dict[int, float]) -> Dict[int, float]:
    total = sum(d.values())
    if total <= 0:
        n = {k: 1.0 / len(d) for k in d} if d else {}
        return n
    return {k: v / total for k, v in d.items()}

def pick_k_unique_by_weight(weights: Dict[int, float], k: int, seed: Optional[int] = None) -> List[int]:
    try:
        rng = random.Random(seed)
        items = list(weights.items())

        if k <= 0 or not items:
            return []

        picked = []
        for _ in range(min(k, len(items))):
            ids = [it[0] for it in items]
            wts = [float(it[1]) for it in items]
            total = sum(wts)

            if total <= 0:
                choice = rng.choice(ids)
                chosen_idx = ids.index(choice)
            else:
                r = rng.random() * total
                cum = 0.0
                chosen_idx = 0
                for i, wt in enumerate(wts):
                    cum += wt
                    if r <= cum:
                        chosen_idx = i
                        break

            picked.append(items[chosen_idx][0])
            del items[chosen_idx]

        return picked

    except Exception as e:
        print(f"[pick_k_unique_by_weight] ERROR: {e}")
        return []
    
def weighted_sample_no_replacement(population: List[int], weights: List[float], k: int, seed: Optional[int] = None) -> List[int]:
    if k <= 0:
        return []
    rng = random.Random(seed)
    items = population.copy()
    probs = [float(w) for w in weights]
    selected = []
    for _ in range(min(k, len(items))):
        total = sum(probs)
        if total <= 0:
            idx = rng.randrange(len(items))
            selected.append(items.pop(idx))
            probs.pop(idx)
            continue
        r = rng.random() * total
        cum = 0.0
        chosen = None
        for i, p in enumerate(probs):
            cum += p
            if r <= cum:
                chosen = i
                break
        if chosen is None:
            chosen = len(probs) - 1
        selected.append(items.pop(chosen))
        probs.pop(chosen)
    return selected
