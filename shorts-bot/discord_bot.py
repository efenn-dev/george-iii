"""discord_bot.py - Discord bot for video approval workflow.

Posts a processed video to a configured Discord channel, reacts with ✅ / ❌,
and waits for an authorized user to approve or reject the upload.
"""

import asyncio
from pathlib import Path
from typing import Callable, Awaitable, Optional

import discord
from discord.ext import commands

from config import config


APPROVE_EMOJI = "✅"
REJECT_EMOJI = "❌"
APPROVAL_TIMEOUT_SECONDS = 86400  # 24 hours


def _format_size(size_bytes: int) -> str:
    """Return a human-readable file size string."""
    for unit in ("B", "KB", "MB", "GB"):
        if size_bytes < 1024:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024
    return f"{size_bytes:.1f} TB"


def _format_duration(seconds: float) -> str:
    """Return a human-readable duration string (e.g. '1m 23s')."""
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

        # These are set before the bot starts
        self._video_path: Optional[Path] = None
        self._title: str = ""
        self._description: str = ""
        self._platforms: list[str] = []
        self._duration: float = 0.0

        # Callback invoked on approval: async (approved: bool) -> None
        self._on_decision: Optional[Callable[[bool], Awaitable[None]]] = None

        # Result future resolved when a decision is made
        self._decision_future: Optional[asyncio.Future] = None

    async def on_ready(self) -> None:
        print(f"[discord_bot] Logged in as {self.user} (id: {self.user.id})")
        if self._video_path:
            await self._post_video()

    async def _post_video(self) -> None:
        """Post the video + embed to the configured channel and add reactions."""
        channel = self.get_channel(config.DISCORD_CHANNEL_ID)
        if channel is None:
            raise ValueError(
                f"Could not find Discord channel with ID {config.DISCORD_CHANNEL_ID}. "
                "Make sure the bot is in the server and has access to that channel."
            )

        video_path = self._video_path
        file_size = video_path.stat().st_size

        embed = discord.Embed(
            title=f"🎬 Approval Required: {self._title}",
            description=self._description or "_No description provided._",
            color=discord.Color.orange(),
        )
        embed.add_field(name="Platforms", value=", ".join(self._platforms) or "youtube", inline=True)
        embed.add_field(name="File Size", value=_format_size(file_size), inline=True)
        embed.add_field(
            name="Duration",
            value=_format_duration(self._duration) if self._duration else "Unknown",
            inline=True,
        )
        embed.set_footer(text=f"React {APPROVE_EMOJI} to upload or {REJECT_EMOJI} to skip. Times out in 24h.")

        print(f"[discord_bot] Uploading '{video_path.name}' to channel {config.DISCORD_CHANNEL_ID} ...")
        file = discord.File(str(video_path), filename=video_path.name)
        message = await channel.send(embed=embed, file=file)

        await message.add_reaction(APPROVE_EMOJI)
        await message.add_reaction(REJECT_EMOJI)
        print(f"[discord_bot] Message sent (id={message.id}). Waiting for reaction from user {config.DISCORD_AUTHORIZED_USER_ID} ...")

        # Wait for the authorized user's reaction
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
                timeout=APPROVAL_TIMEOUT_SECONDS,
            )
            approved = str(reaction.emoji) == APPROVE_EMOJI
        except asyncio.TimeoutError:
            await channel.send(
                f"⏰ Approval window expired for **{self._title}**. Skipping upload."
            )
            approved = False

        if approved:
            await channel.send(f"✅ Approved! Uploading **{self._title}** to {', '.join(self._platforms)} ...")
        else:
            await channel.send(f"❌ Rejected, skipping **{self._title}**.")

        if self._decision_future and not self._decision_future.done():
            self._decision_future.set_result(approved)

        # Invoke callback if provided
        if self._on_decision:
            await self._on_decision(approved)

        await self.close()

    async def post_completion_message(self, results: dict[str, str]) -> None:
        """Post a follow-up message with upload results.

        Args:
            results: Mapping of platform name to URL or error message.
        """
        channel = self.get_channel(config.DISCORD_CHANNEL_ID)
        if channel is None:
            return

        embed = discord.Embed(
            title=f"🚀 Upload Complete: {self._title}",
            color=discord.Color.green(),
        )
        for platform, result in results.items():
            embed.add_field(name=platform.capitalize(), value=result, inline=False)

        await channel.send(embed=embed)


async def post_for_approval(
    video_path: Path,
    title: str,
    description: str,
    platforms: list[str],
    duration: float = 0.0,
) -> bool:
    """Post a video to Discord for approval and wait for a reaction.

    Connects to Discord, posts the video with an approval embed, waits up to
    24 hours for the authorized user to react ✅ or ❌, then disconnects.

    Args:
        video_path:   Path to the processed video file to upload.
        title:        Video title shown in the embed.
        description:  Video description shown in the embed.
        platforms:    List of target platform names (e.g. ['youtube', 'tiktok']).
        duration:     Video duration in seconds for display purposes.

    Returns:
        True if the authorized user approved (✅), False otherwise.

    Raises:
        EnvironmentError: If Discord config values are missing.
    """
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

    # Wait for the future to be resolved (set in _post_video)
    try:
        approved = await asyncio.wait_for(decision_future, timeout=APPROVAL_TIMEOUT_SECONDS + 10)
    except asyncio.TimeoutError:
        approved = False

    return approved
