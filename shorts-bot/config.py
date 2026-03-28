"""config.py - Load and validate configuration from .env file."""

import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from the project root (same directory as this file)
_ENV_PATH = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=_ENV_PATH)


def _require(key: str) -> str:
    """Return an env var value or raise a clear error if missing."""
    value = os.getenv(key)
    if not value:
        raise EnvironmentError(
            f"Missing required environment variable: {key}\n"
            f"Please set it in your .env file. See .env.example for reference."
        )
    return value


def _optional(key: str, default: str = "") -> str:
    """Return an env var value or a default."""
    return os.getenv(key, default)


class Config:
    """Central configuration object loaded from environment variables."""

    # Discord
    DISCORD_BOT_TOKEN: str = _optional("DISCORD_BOT_TOKEN")
    DISCORD_CHANNEL_ID: int = int(_optional("DISCORD_CHANNEL_ID", "0"))
    DISCORD_AUTHORIZED_USER_ID: int = int(_optional("DISCORD_AUTHORIZED_USER_ID", "0"))

    # YouTube
    YOUTUBE_CLIENT_SECRETS_FILE: str = _optional(
        "YOUTUBE_CLIENT_SECRETS_FILE", "client_secrets.json"
    )

    # TikTok
    TIKTOK_ACCESS_TOKEN: str = _optional("TIKTOK_ACCESS_TOKEN")

    # Instagram
    INSTAGRAM_ACCESS_TOKEN: str = _optional("INSTAGRAM_ACCESS_TOKEN")
    INSTAGRAM_USER_ID: str = _optional("INSTAGRAM_USER_ID")

    @classmethod
    def require_discord(cls) -> None:
        """Validate that all Discord config values are present."""
        if not cls.DISCORD_BOT_TOKEN:
            raise EnvironmentError(
                "DISCORD_BOT_TOKEN is not set. "
                "Create a bot at https://discord.com/developers/applications and paste the token in .env"
            )
        if not cls.DISCORD_CHANNEL_ID:
            raise EnvironmentError(
                "DISCORD_CHANNEL_ID is not set. "
                "Right-click a Discord channel (with Developer Mode enabled) and copy the ID."
            )
        if not cls.DISCORD_AUTHORIZED_USER_ID:
            raise EnvironmentError(
                "DISCORD_AUTHORIZED_USER_ID is not set. "
                "Right-click your Discord user (with Developer Mode enabled) and copy your User ID."
            )

    @classmethod
    def require_youtube(cls) -> None:
        """Validate that YouTube config values are present."""
        secrets_path = Path(cls.YOUTUBE_CLIENT_SECRETS_FILE)
        if not secrets_path.exists():
            raise FileNotFoundError(
                f"YouTube client secrets file not found: {secrets_path}\n"
                "Download it from Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client IDs.\n"
                "See README.md for full setup instructions."
            )


# Singleton instance for easy import
config = Config()
