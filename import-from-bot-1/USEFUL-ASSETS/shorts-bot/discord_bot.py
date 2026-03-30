"""discord_bot.py - Discord bot for video approval workflow.

Posts a processed video to Discord, waits for ✅/❌ reaction from authorized user.
"""

import asyncio
from pathlib import Path
from typing import Callable, Awaitable, Optional

import discord

from config import config

APPROVE_EMOJI = "✅"
REJECT_EMOJI = "❌"
APPROVAL_TIMEOUT = 86400  # 24 hours


def _format_size(size_bytes: int) -> str:
    """Human-readable file size."""
    for unit in ("B", "KB", "MB", "GB"):
        if size_bytes < 1024:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024
    return f"{size_bytes:.1f} TB"


def _format_duration(seconds: float) -> str:
    """Human-readable duration."""
    m = int(seconds // 60)
    s = int(seconds % 60)
    if m > 0:
        return f"{m}m {s}s"
    return f"{s}s"


class ShortsApprovalBot(discord.Client):
    """Discord client that handles the approval flow for a single video."""

    def __init__(self) -> None:
        intents = discord.Intents.default()
        intents.message_content = True
        intents.reactions = True
        intents.guilds = True
        super().__init__(intents=intents)

        self._video_path: Optional[Path] = None
        self._title: str = ""
        self._description: str = ""
        self._platforms: list[str] = []
        self._duration: float = 0.0
        self._decision_future: Optional[asyncio.Future] = None

    async def on_ready(self) -> None:
        print(f"[discord] Logged in as {self.user}")
        if self._video_path:
            await self._post_video()

    async def _post_video(self) -> None:
        """Post video and wait for reaction."""
        channel = self.get_channel(config.DISCORD_CHANNEL_ID)
        if channel is None:
            raise ValueError(f"Channel {config.DISCORD_CHANNEL_ID} not found")

        file_size = self._video_path.stat().st_size

        embed = discord.Embed(
            title=f"🎬 Approval: {self._title}",
            description=self._description or "_No description_",
            color=discord.Color.orange(),
        )
        embed.add_field(
            name="Platforms",
            value=", ".join(self._platforms) or "youtube",
            inline=True
        )
        embed.add_field(name="Size", value=_format_size(file_size), inline=True)
        embed.add_field(
            name="Duration",
            value=_format_duration(self._duration) if self._duration else "Unknown",
            inline=True
        )
        embed.set_footer(
            text=f"React {APPROVE_EMOJI} to upload or {REJECT_EMOJI} to skip. 24h timeout."
        )

        file = discord.File(str(self._video_path), filename=self._video_path.name)
        message = await channel.send(embed=embed, file=file)

        await message.add_reaction(APPROVE_EMOJI)
        await message.add_reaction(REJECT_EMOJI)

        print(f"[discord] Waiting for approval from user {config.DISCORD_AUTHORIZED_USER_ID}...")

        def check(reaction: discord.Reaction, user: discord.User) -> bool:
            return (
                str(reaction.emoji) in (APPROVE_EMOJI, REJECT_EMOJI)
                and reaction.message.id == message.id
                and user.id == config.DISCORD_AUTHORIZED_USER_ID
            )

        try:
            reaction, _ = await self.wait_for(
                "reaction_add",
                check=check,
                timeout=APPROVAL_TIMEOUT,
            )
            approved = str(reaction.emoji) == APPROVE_EMOJI
        except asyncio.TimeoutError:
            await channel.send(f"⏰ Approval expired for **{self._title}**.")
            approved = False

        if approved:
            await channel.send(f"✅ Approved! Uploading **{self._title}**...")
        else:
            await channel.send(f"❌ Rejected: **{self._title}**.")

        if self._decision_future and not self._decision_future.done():
            self._decision_future.set_result(approved)

        await self.close()


async def post_for_approval(
    video_path: Path,
    title: str,
    description: str,
    platforms: list[str],
    duration: float = 0.0,
) -> bool:
    """Post video to Discord for approval. Returns True if approved."""
    config.require_discord()

    bot = ShortsApprovalBot()
    bot._video_path = video_path
    bot._title = title
    bot._description = description
    bot._platforms = platforms
    bot._duration = duration

    decision_future: asyncio.Future = asyncio.get_event_loop().create_future()
    bot._decision_future = decision_future

    await bot.start(config.DISCORD_BOT_TOKEN)

    try:
        approved = await asyncio.wait_for(decision_future, timeout=APPROVAL_TIMEOUT + 10)
    except asyncio.TimeoutError:
        approved = False

    return approved
