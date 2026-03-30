"""
07_metadata.py â€” AI Metadata Drafting
=====================================
Analyzes the transcript and generates YouTube-optimized
title, description, tags, and category using OpenAI GPT
or a local LLM, with template fallback.

Usage:
    python 07_metadata.py
    python 07_metadata.py --provider template
"""

import json
import yaml
import logging
import argparse
from pathlib import Path
from datetime import datetime

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler("C:/Users/efenn/.openclaw/workspace/projects/minecraft-pipeline/logs/metadata.log"),
        logging.StreamHandler()
    ]
)
log = logging.getLogger(__name__)

def load_config(path: str = "C:/Users/efenn/.openclaw/workspace/projects/minecraft-pipeline/config/pipeline_config.yaml") -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)

import requests

def generate_metadata_openai(transcript: str, config: dict) -> dict:
    """Generate metadata using OpenAI GPT API."""
    from openai import OpenAI

    meta_cfg = config["metadata_ai"]
    client = OpenAI()

    prompt = f"""You are a YouTube SEO expert for Minecraft gaming content.
Analyze this gameplay transcript and generate optimized YouTube metadata.

TRANSCRIPT (first 3000 chars):
{transcript[:3000]}

Generate a JSON object with:
1. \"title\": Catchy title under {meta_cfg['max_title_length']} characters.
   Include a compelling hook and Minecraft keywords.
2. \"description\": Structured description with:
   - Hook paragraph (2 sentences)
   - Content summary (what happens in this episode)
   - Timestamps section placeholder
   - Social links placeholder
   - Hashtags (3-5)
3. \"tags\": Array of {meta_cfg['max_tags']} relevant keywords/phrases
4. \"category_id\": \"{meta_cfg['default_category_id']}\"

Return ONLY valid JSON, no markdown formatting."""

    response = client.chat.completions.create(
        model=meta_cfg["openai_model"],
        messages=[
            {"role": "system", "content": "You generate YouTube metadata as JSON."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.7,
        max_tokens=1000
    )

    raw_text = response.choices[0].message.content.strip()

    if raw_text.startswith("```"):
        raw_text = raw_text.split("```")[1]
        if raw_text.startswith("json"):
            raw_text = raw_text[4:]

    metadata = json.loads(raw_text)
    log.info(f"AI-generated title: {metadata.get('title', 'N/A')}")
    return metadata

def generate_metadata_local_llm(transcript: str, config: dict) -> dict:
    """Generate metadata using local Ollama instance (Kimi K2.5)."""
    meta_cfg = config["metadata_ai"]
    ollama_url = meta_cfg.get("ollama_url", "http://localhost:11434/api/generate")
    model_name = meta_cfg.get("ollama_model", "kimi-k2.5:cloud")

    prompt = f"""You are a YouTube SEO expert for Minecraft gaming content.
Analyze this gameplay transcript and generate optimized YouTube metadata.

TRANSCRIPT (first 3000 chars):
{transcript[:3000]}

Generate a JSON object with:
1. "title": Catchy title under {meta_cfg['max_title_length']} characters.
   Include a compelling hook and Minecraft keywords.
2. "description": Structured description with:
   - Hook paragraph (2 sentences)
   - Content summary (what happens in this episode)
   - Timestamps section placeholder
   - Social links placeholder
   - Hashtags (3-5)
3. "tags": Array of {meta_cfg['max_tags']} relevant keywords/phrases
4. "category_id": "{meta_cfg['default_category_id']}"

Return ONLY valid JSON, no markdown formatting."""

    payload = {
        "model": model_name,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": 0.7,
            "num_predict": 1000
        }
    }

    try:
        response = requests.post(ollama_url, json=payload, timeout=120)
        response.raise_for_status()
        result = response.json()
        raw_text = result.get("response", "").strip()

        if raw_text.startswith("```"):
            raw_text = raw_text.split("```")[1]
            if raw_text.startswith("json"):
                raw_text = raw_text[4:]

        metadata = json.loads(raw_text)
        log.info(f"Local LLM generated title: {metadata.get('title', 'N/A')}")
        return metadata
    except requests.exceptions.ConnectionError:
        raise RuntimeError("Could not connect to Ollama. Is it running? (ollama serve)")
    except Exception as e:
        raise RuntimeError(f"Local LLM error: {e}")

def generate_metadata_template(transcript: str, config: dict) -> dict:
    """Fallback: Generate metadata from templates (no AI needed)."""
    meta_cfg = config["metadata_ai"]

    notable_words = [
        "diamond", "diamonds", "ender", "dragon", "nether",
        "wither", "creeper", "enchant", "villager", "raid",
        "cave", "ocean", "monument", "stronghold", "blaze",
        "netherite", "elytra", "shulker"
    ]
    found = [
        w for w in notable_words
        if w.lower() in transcript.lower()
    ]

    if found:
        highlight = found[0].title()
        title = f"Minecraft Survival â€” We Found {highlight}!"
    else:
        title = "Minecraft Survival â€” Epic Gameplay Highlights"

    title = title[:meta_cfg["max_title_length"]]

    description = f"""{title}

In this episode, we dive into another exciting Minecraft session!
Watch as we explore, build, and survive the blocky wilderness.

========================================
TIMESTAMPS
========================================
0:00 - Intro
0:15 - Gameplay Begins
(Timestamps auto-generated â€” edit before publishing)

========================================
ABOUT
========================================
Family-friendly Minecraft content recorded and produced
with an automated pipeline. New episodes posted regularly!

{' '.join(meta_cfg.get('default_hashtags', ['#Minecraft']))}
"""

    tags = [
        "Minecraft", "Minecraft gameplay", "Minecraft survival",
        "Minecraft highlights", "gaming", "let's play Minecraft",
        "Minecraft 2026", "Minecraft Bedrock", "Minecraft Java",
        "family friendly Minecraft", "Minecraft tips"
    ]
    tags.extend([w.title() for w in found if w.title() not in tags])
    tags = tags[:meta_cfg["max_tags"]]

    return {
        "title": title,
        "description": description,
        "tags": tags,
        "category_id": meta_cfg["default_category_id"]
    }

def main():
    parser = argparse.ArgumentParser(description="Generate YouTube metadata")
    parser.add_argument("--config", default="C:/Users/efenn/.openclaw/workspace/projects/minecraft-pipeline/config/pipeline_config.yaml")
    parser.add_argument("--provider", default=None,
                        choices=["openai", "local_llm", "template"],
                        help="Override metadata provider")
    args = parser.parse_args()

    config = load_config(args.config)
    meta_cfg = config["metadata_ai"]
    provider = args.provider or meta_cfg["provider"]

    captioned_dir = Path(config["paths"]["captioned"])
    transcript_path = captioned_dir / "transcript.txt"
    if not transcript_path.exists():
        log.error("Transcript not found! Run captioning stage first.")
        return
    transcript = transcript_path.read_text(encoding="utf-8")

    if provider == "openai":
        try:
            metadata = generate_metadata_openai(transcript, config)
        except Exception as e:
            log.warning(f"OpenAI failed ({e}), falling back to template")
            metadata = generate_metadata_template(transcript, config)
    elif provider == "local_llm":
        try:
            metadata = generate_metadata_local_llm(transcript, config)
        except Exception as e:
            log.warning(f"Local LLM failed ({e}), falling back to template")
            metadata = generate_metadata_template(transcript, config)
    else:
        metadata = generate_metadata_template(transcript, config)

    yt_cfg = config["youtube"]
    metadata["privacy_status"] = yt_cfg["default_privacy"]
    metadata["made_for_kids"] = yt_cfg["made_for_kids"]
    metadata["language"] = yt_cfg["default_language"]
    metadata["notify_subscribers"] = yt_cfg["notify_subscribers"]
    metadata["generated_at"] = datetime.now().isoformat()
    metadata["provider"] = provider

    meta_dir = Path(config["paths"]["metadata"])
    meta_dir.mkdir(parents=True, exist_ok=True)
    output_file = meta_dir / "metadata.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)

    log.info(f"Metadata saved: {output_file}")
    log.info(f"  Title: {metadata['title']}")
    log.info(f"  Tags: {len(metadata['tags'])} keywords")
    log.info(f"  Privacy: {metadata['privacy_status']}")

if __name__ == "__main__":
    main()




