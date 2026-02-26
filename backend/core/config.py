from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/CompaniesHouse"
    cors_origins: list[str] = ["http://localhost:3000"]
    tenant_header_name: str = "X-Tenant-Id"
    auth_required: bool = True
    auth_jwt_issuer: str = "capitalbase-dev"
    auth_jwt_audience: str = "capitalbase-api"
    auth_jwt_algorithm: str = "HS256"
    auth_jwt_secret: str = "change-me-in-env"
    auth_tenant_claim: str = "tenant_id"
    auth_allow_dev_header_override: bool = False
    financials_raw_fallback_enabled: bool = False
    request_timeout_seconds: float = 15.0
    max_request_body_bytes: int = 1_048_576
    rate_limit_requests: int = 120
    rate_limit_window_seconds: int = 60
    security_headers_enabled: bool = True
    security_hsts_enabled: bool = False
    cors_allow_methods: list[str] = ["GET", "POST", "DELETE", "OPTIONS"]
    cors_allow_headers: list[str] = ["Authorization", "Content-Type", "X-Tenant-Id"]

settings = Settings()
