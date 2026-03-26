from dataclasses import dataclass


@dataclass
class Config:
    # sampling params
    K_main_to_select: int = 4          
    target_subtypes_total: int = 8      
    max_subtypes_total: int = 12        
    min_subtypes_per_main: int = 1      
    max_subtypes_per_main: int = 3      
    # decay/step params (applied per request)
    fatigue_increase_on_show: float = 0.04   
    exploration_increase_off_show: float = 0.02  
    fatigue_decay_mul: float = 0.96      
    exploration_decay_mul: float = 0.96  
    # caps
    max_fatigue: float = 0.3
    max_exploration: float = 0.3

DEFAULT_CONFIG = Config()
