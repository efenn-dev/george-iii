# Etsy Store Pipeline — Agent Workflow

## Org Chart

```
👑 George III (Orchestrator / Opus)
├── ⚡ Coder (GPT-5.4) — Automation & Tools
│   ├── Build pack optimization scripts
│   ├── Mission Control Etsy dashboard
│   ├── Etsy API integration (future)
│   └── Analytics/reporting tools
│
├── 📚 Scribe (Kimi) — Content & Research
│   ├── SEO tag research & optimization
│   ├── Listing descriptions & titles
│   ├── Market research (trending niches)
│   ├── Pinterest descriptions
│   ├── Social media copy
│   └── Seasonal trend forecasting
│
└── 🤖 QA Bot (automated) — Quality Gate
    ├── Validates task completeness
    ├── Checks listings before publish
    └── Gates all work for Master E approval
```

## Pipeline Stages

### Stage 1: DISCOVER (Scribe)
- Research trending niches on Etsy
- Identify seasonal opportunities (holidays, events)
- Analyze competitor pricing and tags
- **Output:** Niche report with recommended pack themes

### Stage 2: CURATE (Master E + George)
- Scan design library for matching assets
- Master E reviews and picks designs in OneDrive folders
- George packages into preliminary packs
- **Output:** Curated pack folder in OneDrive

### Stage 3: OPTIMIZE (Coder / Script)
- Resize PNGs to 2500px max
- Split into ZIPs under 20MB
- Add README-LICENSE.txt
- **Output:** Upload-ready ZIPs in ready-to-upload/

### Stage 4: LISTING (Scribe + George)
- Scribe writes SEO-optimized title (max 140 chars)
- Scribe generates 13 tags (using etsy-seo-tag-optimizer skill)
- Scribe writes product description
- George reviews and finalizes
- **Output:** Listing template ready to paste

### Stage 5: PUBLISH (Master E)
- Upload ZIPs to Etsy listing
- Copy-paste title, tags, description
- Add listing photos (mockups + design preview)
- Set price and publish
- **Output:** Live listing

### Stage 6: PROMOTE (Scribe + Coder)
- Scribe writes Pinterest pin descriptions
- Scribe drafts social media posts
- Coder sets up analytics tracking (future)
- Enable Etsy Ads at $3-5/day
- **Output:** Active promotion

### Stage 7: MONITOR (George + Coder)
- Track views, favorites, sales per listing
- Identify top performers for expansion
- Adjust tags/prices based on performance
- Create new packs in winning niches
- **Output:** Data-driven decisions

---

## Current Pack Status

| Pack | Theme | Designs | ZIPs | Status | Agent |
|------|-------|---------|------|--------|-------|
| 3 | Texas Pride | 6 | 1 | Ready to list | Master E |
| 4 | Christmas Holiday | 6 | 1 | Ready to list | Master E |
| 5 | Pop Art Animals | 9 | 2 parts | Ready to list | Master E |
| 6 | Humor Stickers | 4* | 1 | Needs curation | Master E |
| 7 | Social Humor OG | 5 | 1 | Ready to list | Master E |
| 8 | Most Excellent Cars | 4 | 1 | Ready to list | Master E |
| 9 | Space Cats | 11 | 4 parts | **LIVE** ✅ | Done |
| 10 | Stoner/420 | 5 | 2 parts | Ready to list | Master E |
| 11 | Space Astronaut | 3 | 1 | Ready to list | Master E |
| 12 | Tropical Vibes | 7 | 2 parts | Ready to list | Master E |
| 13 | Funny AI Art | 8 | 1 | Ready to list | Master E |
| 14 | Shaka Jesus | 6 | 1 | Ready to list | Master E |
| 15 | Badass/Edgy | 7 | 2 parts | Ready to list | Master E |

*Pack 6 was reduced during optimization — may need more designs added

---

## Upcoming Packs (Pipeline Queue)

| Priority | Theme | Target Date | Assigned |
|----------|-------|-------------|----------|
| 1 | Mother's Day Bundle | Apr 1 | Scribe (research) + Master E (curate) |
| 2 | Summer/Beach Mega Pack | Apr 15 | Scribe + George |
| 3 | Ape/Monkey Designs | When ready | Master E (curate from Midjourney/Apes) |
| 4 | Dragon Designs | When ready | Master E (curate from Midjourney/Dragons) |
| 5 | Meme/Viral Pack | When ready | Scribe (research trending memes) |

---

## Installed Skills

| Skill | Purpose | Used By |
|-------|---------|---------|
| etsy-seo-tag-optimizer | Optimize listing tags | Scribe |
| etsy-seller-helper | Etsy seller guidance | George/Scribe |
| product-title-optimization | Better listing titles | Scribe |
| trading | Stock trading tools | Future use |
