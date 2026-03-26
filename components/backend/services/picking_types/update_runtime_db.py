import datetime
from typing import List

from requests import Session

from models import MainType, Subtype, UserSubtypeRuntime, UserSubtypeWeight, UserTypeRuntime
from services.picking_types.config import DEFAULT_CONFIG, Config
from services.picking_types.sampling import load_or_create_main_runtime_rows, load_or_create_sub_runtime_rows, load_user_main_weights


def update_runtime_after_show(session: Session,user_id: int, shown_main_ids: List[int], 
                              shown_subtype_ids: List[int], cfg: Config = DEFAULT_CONFIG):
    
    all_main_weights = load_user_main_weights(session, user_id)
    all_main_ids = list(all_main_weights.keys())

    load_or_create_main_runtime_rows(session, user_id, all_main_ids)
    hotel = session.query(MainType).filter(
            MainType.name.ilike("Hotels & Accommodation")).first()
    
    all_sub_weights = (session.query(UserSubtypeWeight, Subtype)
         .join(Subtype, Subtype.id == UserSubtypeWeight.subtype_id)
         .filter(UserSubtypeWeight.user_id == user_id, Subtype.main_type_id != hotel.id)
         .all())
    all_sub_ids = {usw.subtype_id for usw, st in all_sub_weights}

    load_or_create_sub_runtime_rows(session=session, user_id=user_id, sub_ids=all_sub_ids)

    for mid in shown_main_ids:
        r = session.query(UserTypeRuntime).filter_by(user_id=user_id, main_type_id=mid).one()
        r.fatigue = min(cfg.max_fatigue, r.fatigue + cfg.fatigue_increase_on_show)
        r.last_shown_at = datetime.datetime.now(datetime.timezone.utc)
    all_rows = session.query(UserTypeRuntime).filter(UserTypeRuntime.user_id == user_id).all()
    shown_set = set(shown_main_ids)
    for r in all_rows:
        if r.main_type_id not in shown_set:
            r.exploration = min(cfg.max_exploration, r.exploration + cfg.exploration_increase_off_show)
    for st_id in shown_subtype_ids:
        sub_row = session.query(UserSubtypeRuntime).filter_by(user_id=user_id, subtype_id=st_id[1]).one_or_none()
        if sub_row is None:
            sub_row = UserSubtypeRuntime(user_id=user_id, subtype_id=st_id[1], fatigue=0.0, exploration=0.0, last_shown_at=None)
            session.add(sub_row)
            session.flush()
        sub_row.fatigue = min(cfg.max_fatigue, sub_row.fatigue + cfg.fatigue_increase_on_show)
        sub_row.last_shown_at = datetime.datetime.now(datetime.timezone.utc)

    all_sub_rows = (
        session.query(UserSubtypeRuntime)
        .filter(UserSubtypeRuntime.user_id == user_id)
        .all())

    shown_sub_set = {sid[1] for sid in shown_subtype_ids}

    for row in all_sub_rows:
        if row.subtype_id not in shown_sub_set:
            row.exploration = min(cfg.max_exploration, row.exploration + cfg.exploration_increase_off_show)
            
    session.commit()