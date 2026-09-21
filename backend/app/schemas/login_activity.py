from datetime import datetime
from pydantic import BaseModel, ConfigDict


class LoginActivityOut(BaseModel):
    id: int
    user_id: int | None
    username: str
    ip_address: str | None
    successful: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
