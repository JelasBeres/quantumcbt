from pydantic import BaseModel, ConfigDict


class KelasCreate(BaseModel):
    nama: str


class KelasOut(BaseModel):
    id: int
    nama: str

    model_config = ConfigDict(from_attributes=True)
