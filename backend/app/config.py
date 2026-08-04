from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    APP_NAME: str = "EVNet Sentinel"
    DEBUG: bool = True

settings = Settings()
