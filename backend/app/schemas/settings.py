from pydantic import BaseModel


class SettingUpdate(BaseModel):
    key: str
    value: str | None


class SettingResponse(BaseModel):
    key: str
    value: str | None

    model_config = {"from_attributes": True}


class SettingsBulkUpdate(BaseModel):
    settings: list[SettingUpdate]
