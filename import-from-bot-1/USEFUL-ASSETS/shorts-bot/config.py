"""config.py - Load and validate configuration from .env file."""

import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from the project root
_ENV_PATH = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=_ENV_PATH)


class Config:
    """Central configuration loaded from environment variables."""

    # Discord
    DISCORD_BOT_TOKEN: str = os.getenv("DISCORD_BOT_TOKEN", "")
    DISCORD_CHANNEL_ID: int = int(os.getenv("DISCORD_CHANNEL_ID", "0"))
    DISCORD_AUTHORIZED_USER_ID: int = int(os.getenv("DISCORD_AUTHORIZED_USER_ID", "0"))

    # YouTube
    YOUTUBE_CLIENT_SECRETS_FILE: str = os.getenv("YOUTUBE_CLIENT_SECRETS_FILE", "client_secrets.json")

    @classmethod
    def require_discord(cls) -> None:
        """Validate that all Discord config values are present."""
        if not cls.DISCORD_BOT_TOKEN:
            raise EnvironmentError(
                "DISCORD_BOT_TOKEN is not set. "
                "Create a bot at https://discord.com/developers/applications"
            )
        if not cls.DISCORD_CHANNEL_ID:
            raise EnvironmentError(
                "DISCORD_CHANNEL_ID is not set. "
                "Right-click a Discord channel and copy the ID."
            )
        if not cls.DISCORD_AUTHORIZED_USER_ID:
            raise EnvironmentError(
                "DISCORD_AUTHORIZED_USER_ID is not set. "
                "Right-click your Discord user and copy your User ID."
            )


# Singleton instance for easy import
config = Config()
