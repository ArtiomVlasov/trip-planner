from typing import Dict

from sqlalchemy.orm import Session

from models import UserSubtypeRuntime, UserTypeRuntime
from services.picking_types.config import DEFAULT_CONFIG, Config
from services.picking_types.sampling_helper import load_or_create_main_runtime_rows, load_or_create_sub_runtime_rows, load_user_main_weights, load_user_subtype_weights_for_main, safe_normalize

def decay_all_runtime_for_user(session: Session, user_id: int, cfg: Config = DEFAULT_CONFIG):

    rows = session.query(UserTypeRuntime).filter(UserTypeRuntime.user_id == user_id).all()
    for r in rows:
        r.fatigue = max(0.0, r.fatigue * cfg.fatigue_decay_mul)
        r.exploration = max(0.0, r.exploration * cfg.exploration_decay_mul)
    session.commit()

def compute_final_main_weights(session: Session, user_id: int, cfg: Config = DEFAULT_CONFIG) -> Dict[int, float]:
    try:
        base = load_user_main_weights(session, user_id)  # base stored normalized
        if not base:
            return {}
        load_or_create_main_runtime_rows(session, user_id, list(base.keys()))

        runtimes = session.query(UserTypeRuntime).filter(UserTypeRuntime.user_id == user_id).all()
        runtime_map = {r.main_type_id: r for r in runtimes}

        final_raw = {}
        for mid, b in base.items():
            rt = runtime_map.get(mid)
            fatigue = rt.fatigue if rt else 0.0
            exploration = rt.exploration if rt else 0.0
            val = b + exploration - fatigue
            if val <= 0:
                val = 1e-6
            final_raw[mid] = val

        return safe_normalize(final_raw)

    except Exception as e:
        print(f"[compute_final_main_weights] ERROR for user {user_id}: {e}")
        return {}
    
    
def compute_final_sub_weights(session, user_id: int, main_id: int, cfg: Config = DEFAULT_CONFIG) -> Dict[int, float]:
    try:
        base = load_user_subtype_weights_for_main(session, user_id, main_id)
        if not base:
            return {}

        sub_ids = list(base.keys())
        load_or_create_sub_runtime_rows(session, user_id, sub_ids)

        runtime_rows = (
            session.query(UserSubtypeRuntime)
            .filter(UserSubtypeRuntime.user_id == user_id,
                    UserSubtypeRuntime.subtype_id.in_(sub_ids))
            .all()
        )
        runtime_map = {r.subtype_id: r for r in runtime_rows}

        final_raw = {}
        for sid, b in base.items():
            rt = runtime_map.get(sid)
            fatigue = rt.fatigue if rt else 0.0
            exploration = rt.exploration if rt else 0.0
            val = b + exploration - fatigue
            if val <= 0:
                val = 1e-6
            final_raw[sid] = val

        return safe_normalize(final_raw)

    except Exception as e:
        print(f"[compute_final_sub_weights] ERROR for user {user_id}, main {main_id}: {e}")
        return {}