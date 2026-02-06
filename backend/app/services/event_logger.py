from app.models.events import AppEvent
from typing import Dict, Any

async def log_event(
    event_name: str, 
    source: str, 
    user_id: str = None, 
    payload: Dict[str, Any] = None, 
    ip_address: str = None,
    user_agent: str = None
):
    """
    Log safe/audit events. 
    Filters out highly sensitive keys just in case.
    """
    safe_payload = {}
    if payload:
        # Blocklist for sensitive keys
        blocklist = {"password", "token", "access_token", "secret"}
        for k, v in payload.items():
            if k.lower() not in blocklist:
                safe_payload[k] = v
            else:
                safe_payload[k] = "[REDACTED]"
                
    event = AppEvent(
        event_name=event_name,
        source=source,
        user_id=user_id,
        payload=safe_payload,
        ip_address=ip_address,
        user_agent=user_agent
    )
    try:
        await event.insert()
    except Exception as e:
        print(f"Error logging event {event_name}: {e}")
