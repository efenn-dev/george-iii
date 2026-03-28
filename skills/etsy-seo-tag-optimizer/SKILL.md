---
name: etsy-seo-tag-optimizer
description: "Etsy SEO tag extractor and keyword optimizer agent. Find Etsy listing tags, extract all 13 tags from any listing, research high-performing keywords, optimize your tag strategy, and improve search ranking on Etsy marketplace. Triggers: etsy tags, etsy seo, etsy keyword, etsy listing optimization, etsy tag extractor, etsy search ranking, etsy shop optimization, etsy product tags, etsy keyword research, etsy algorithm, handmade seo, etsy shop"
allowed-tools: Bash
metadata:
  openclaw:
    homepage: https://github.com/mguozhen/etsy-seo-tag-optimizer
---

# Etsy SEO Tag Optimizer

Extract, analyze, and optimize Etsy listing tags for maximum search visibility. Find what keywords successful competitors use, build a winning tag strategy, and rank higher in Etsy search results.

## Commands

```
tag extract <listing>             # extract all tags from a pasted Etsy listing
tag analyze <tags>                # analyze tag strength and keyword quality
tag suggest <product>             # suggest 13 optimized tags for a product
tag competitor <listing>          # extract and analyze competitor tags
tag gaps <your-tags> <comp-tags>  # find missing tag opportunities
tag rank <keyword>                # estimate keyword competition on Etsy
tag seasonal <product>            # add seasonal tag opportunities
tag refresh <listing>             # refresh outdated tags with fresh keywords
tag copy <tags>                   # format tags for one-click copy
tag report <product>              # full Etsy SEO analysis report
```

## What Data to Provide

- **Etsy listing text** — paste the full listing title, description, tags
- **Product description** — what you're selling in plain terms
- **Target buyer** — who buys this (occasion, demographic, use case)
- **Competitor listings** — paste competing listing data
- **Current tags** — your existing 13 tags for optimization

## Etsy SEO Framework

### How Etsy Search Works

Etsy's algorithm ranks listings based on:
1. **Query match** — how well listing title + tags match the search
2. **Listing quality score** — views, favorites, purchases, CTR
3. **Recency** — recently added/renewed listings get temporary boost
4. **Customer experience score** — seller reviews, dispute rate
5. **Shipping price** — free shipping gets significant boost
6. **Buyer personalization** — Etsy personalizes results per buyer

**Critical insight:** Tags must exactly match what buyers search. Etsy uses EXACT match, not semantic matching like Google.

### Tag Structure Rules

**Etsy tag requirements:**
- Maximum 13 tags per listing
- Each tag: up to 20 characters
- Multi-word tags allowed (use all available space)
- Avoid single words — phrases convert better
- No punctuation except hyphens
- No trademark violations

**Tag types by function:**
```
Primary tags (5):     Core product type phrases
Attribute tags (4):   Color, material, size, style
Use case tags (2):    Occasion, recipient, purpose
Long-tail tags (2):   Specific buyer-intent phrases
```

### Tag Generation Framework

**Step 1: Identify core product terms**
```
Product: Handmade ceramic coffee mug
Core terms: coffee mug, ceramic mug, handmade mug, pottery mug, stoneware mug
```

**Step 2: Add attribute modifiers**
```
Color: blue mug, navy mug, speckled mug
Size: large coffee mug, 16oz mug, big mug
Style: rustic mug, minimalist mug, boho mug
Material: clay mug, pottery mug, stoneware mug
```

**Step 3: Identify use cases and occasions**
```
Occasions: birthday gift mug, Christmas gift, mother day gift
Recipients: gift for him, gift for her, coffee lover gift, teacher gift
Use cases: office mug, unique mug, personalized mug
```

**Step 4: Add long-tail buyer intent phrases**
```
Specific: handmade blue ceramic mug, rustic coffee cup pottery
Problem-solving: microwave safe mug, dishwasher safe pottery
Sentiment: cozy mug, unique coffee mug, artisan mug
```

**Step 5: Seasonal adjustments**
```
Q4 (Oct-Dec): Christmas gift, holiday gift, stocking stuffer
Q1 (Jan-Mar): Valentine gift, self care gift, new home gift
Q2 (Apr-Jun): Mother's Day gift, graduation gift, spring
Q3 (Jul-Sep): Birthday gift, back to school, summer
```

### Tag Optimization by Product Category

**Jewelry:**
```
Good tags: sterling silver necklace, layered necklace gift, dainty chain necklace
Poor tags: necklace, jewelry, silver (too broad, low intent)
```

**Home Decor:**
```
Good tags: boho wall art print, nursery decor girl, minimalist bedroom art
Poor tags: art, print, home (too generic)
```

**Clothing:**
```
Good tags: floral summer dress women, cottagecore midi dress, romantic dress gift
Poor tags: dress, women clothing, summer (too generic)
```

**Digital Downloads:**
```
Good tags: printable wall art instant download, budget planner digital, wedding invitation template
Poor tags: printable, download, digital (too broad)
```

### Competitor Tag Analysis

From a competitor's listing, extract all tags and classify:
```
Tag                    Type          Competition Level
coffee mug gift        Use case      High
handmade ceramic mug   Primary       Medium
rustic pottery mug     Attribute+    Low
birthday mug           Occasion      High
unique coffee cup      Modifier      Low
minimalist mug         Style         Medium
...
```

Find the low-competition tags competitors use that you don't → add to your listing.

### Tag Gap Analysis

```
Your tags: [A, B, C, D, E, F, G, H, I, J, K, L, M]
Comp tags: [B, C, D, E, F, N, O, P, Q, R, S, T, U]

Gap (in theirs, not yours): N, O, P, Q, R, S, T, U
Your unique tags:            A, G, H, I, J, K, L, M

Recommendation:
- Drop lowest-performing unique tags
- Add gap tags with good potential
```

### Etsy Title Optimization

Title works with tags for search matching. Rules:
- First 40 characters most important (show in search results)
- Include top 2-3 tag phrases naturally in title
- Keep it readable — not keyword-stuffed
- Format: `[Primary Keyword] [Key Feature/Attribute] [Use Case/Gift]`

```
Bad title: "Mug Handmade Ceramic Blue Coffee Gift Pottery Cup"
Good title: "Handmade Ceramic Coffee Mug | Blue Pottery Cup | Birthday Gift for Coffee Lover"
```

### Keyword Competition Estimation

Estimate competition level:
```
Low competition (good target):    <5,000 Etsy results, meaningful buyer intent
Medium competition:               5,000-50,000 results
High competition (hard to win):   >50,000 results
Very high (avoid as main tag):    >200,000 results

Strategy: Mix 3-4 low competition tags with 5-6 medium, 2-3 high
```

### Tag Refresh Strategy

Refresh tags when:
- Listing has been active >90 days with declining traffic
- Season changes (swap seasonal tags)
- New trends emerge in your category
- After analyzing competitor tags of new top sellers

**Refresh cadence:**
- Seasonal tags: Every 3 months
- Trend tags: Monthly (monitor Etsy Trend Reports)
- Core product tags: Only if not performing after 90 days

## Workspace

Creates `~/etsy-seo/` containing:
- `tags/` — optimized tag sets per product
- `competitors/` — competitor tag extractions
- `seasonal/` — seasonal tag calendars
- `research/` — keyword competition data
- `reports/` — full SEO audit reports

## Output Format

Every tag optimization outputs:
1. **Optimized 13 Tags** — ready-to-copy tag set with type classification
2. **One-Click Copy Format** — tags formatted for easy pasting into Etsy
3. **Tag Analysis** — competition estimate and rationale for each tag
4. **Title Recommendation** — optimized title incorporating top tags
5. **Competitor Gap Analysis** — tags from top competitors you're missing
6. **Seasonal Tags** — upcoming seasonal additions with optimal timing
7. **Monthly Refresh Calendar** — when to swap which tags
