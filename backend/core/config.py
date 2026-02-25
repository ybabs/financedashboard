from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/CompaniesHouse"
    cors_origins: list[str] = ["http://localhost:3000"]
    tenant_header_name: str = "X-Tenant-Id"

settings = Settings()
