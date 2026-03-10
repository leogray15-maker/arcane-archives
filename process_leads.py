#!/usr/bin/env python3
"""
process_leads.py — Arcane Archives Lead Processing Script
Converts Google Maps CSV exports into personalised outreach packages.

Usage:
    python3 process_leads.py [input.csv] [output.csv] [output.json]
    python3 process_leads.py                      # defaults: Maps_leads.csv -> arcane_outreach.csv + arcane_outreach.json

Output:
    arcane_outreach.csv  — CRM-ready CSV with 5 appended enrichment columns
    arcane_outreach.json — JSONL file (one JSON object per line) for Make.com / webhooks

Python 3.8+ | Standard library only (csv, json, re, os, sys)
"""

import csv
import json
import os
import re
import sys

# ─────────────────────────────────────────────────────────────
# CONSTANTS
# ─────────────────────────────────────────────────────────────

DEFAULT_INPUT       = 'Maps_leads.csv'
DEFAULT_OUTPUT_CSV  = 'arcane_outreach.csv'
DEFAULT_OUTPUT_JSON = 'arcane_outreach.json'

# Maps logical field names to lists of possible CSV header spellings (all lowercase)
COLUMN_ALIASES: dict = {
    'name':        ['name', 'business name', 'business_name', 'title',
                    'listing name', 'listing_name', 'place name', 'place_name', 'company name'],
    'address':     ['address', 'full_address', 'full address', 'street',
                    'location', 'street address', 'street_address'],
    'city':        ['city', 'town', 'locality', 'municipality', 'city name', 'city_name'],
    'phone':       ['phone', 'phone_number', 'phone number', 'telephone', 'tel',
                    'mobile', 'contact phone', 'contact_phone'],
    'website':     ['website', 'url', 'web', 'site', 'domain', 'link', 'website url'],
    'rating':      ['rating', 'google_rating', 'google rating', 'score',
                    'avg rating', 'average_rating', 'average rating'],
    'reviews':     ['reviews', 'review_count', 'review count', 'user_ratings_total',
                    'total_reviews', 'total reviews', 'num_reviews', 'num reviews',
                    'ratings', 'number of reviews', 'number_of_reviews'],
    'category':    ['category', 'type', 'business_type', 'business type',
                    'industry', 'categories', 'primary_category', 'primary category'],
    'email':       ['email', 'e-mail', 'email_address', 'email address', 'mail'],
    'description': ['description', 'desc', 'about', 'summary', 'snippet'],
}

# Legal suffixes stripped from business names (applied at end-of-string only)
_LEGAL_SUFFIX_PATTERNS = [
    r'\bLimited\b', r'\bLtd\.?\b', r'\bLLC\b', r'\bL\.L\.C\.?\b',
    r'\bLLP\b',     r'\bL\.L\.P\.?\b', r'\bInc\.?\b', r'\bIncorporated\b',
    r'\bCorp\.?\b', r'\bCorporation\b', r'\bPLC\b', r'\bP\.L\.C\.?\b',
    r'\bCo\.?\b',   r'\bCompany\b',     r'\b& Co\.?\b',
    r'\bGroup\b',   r'\bHoldings?\b',   r'\bEnterprises?\b',
    r'\bTrading\b', r'\bT\/A\b',        r'\bt\/a\b',
]
_SUFFIX_RE = re.compile(
    r'(?:' + '|'.join(_LEGAL_SUFFIX_PATTERNS) + r')[\s,\-\u2013\u2014]*$',
    re.IGNORECASE
)
_TRAILING_PUNCT_RE = re.compile(r'[,\-\u2013\u2014]+\s*$')

# Industry classification: each entry is (keyword_list, industry_label)
# Ordered most-specific first; first match wins.
INDUSTRY_MAP = [
    (['solicitor', 'law firm', 'legal services', 'barrister',
      'attorney', 'advocate', 'conveyancer', 'notary'],              'Legal/Law Firms'),
    (['accountant', 'accounting', 'bookkeeping', 'bookkeeper',
      'tax adviser', 'chartered accountant', 'audit', 'payroll',
      'ifa', 'financial adviser', 'financial advisor'],              'Accountancy/Finance'),
    (['clinic', 'medical', 'dental', 'dentist', 'doctor', ' gp ',
      'pharmacy', 'optician', 'physiotherapist', 'health centre',
      'hospital', 'nhs', 'therapist', 'psychology', 'counselling',
      'chiropractor', 'osteopath', 'podiatrist'],                    'Healthcare/Medical'),
    (['estate agent', 'real estate', 'property management',
      'letting agent', 'letting agency', 'mortgage broker',
      'realty', 'realtor', 'surveyor'],                              'Real Estate'),
    (['construction', 'builder', 'building contractor', 'contractor',
      'plumber', 'electrician', 'roofing', 'scaffolding', 'joiner',
      'carpenter', 'painter', 'decorator', 'groundwork', 'civil engineering',
      'bricklayer', 'tiler', 'plasterer', 'glazier'],                'Construction/Trades'),
    (['restaurant', 'cafe', 'coffee shop', 'bar ', ' pub ',
      ' hotel', 'hospitality', 'catering', 'takeaway', 'food',
      'bistro', 'eatery', 'brasserie', 'tavern', 'inn'],             'Restaurants/Hospitality'),
    (['marketing agency', 'advertising', 'seo agency', 'digital agency',
      'pr agency', 'creative agency', 'branding', 'media agency',
      'design agency', 'content agency'],                            'Marketing/Agency'),
    (['gym', 'fitness', 'personal trainer', 'pt studio',
      'pilates', 'yoga', 'wellness', 'spa', 'beauty salon',
      'barber', 'hairdress', 'nail salon', 'tanning', 'health club'], 'Fitness/Wellness'),
    (['manufacturer', 'manufacturing', 'factory', 'fabrication',
      'engineering', 'industrial', 'wholesale', 'logistics',
      'warehouse', 'distribution', 'supply chain'],                  'Manufacturing'),
    (['retail', ' shop', ' store', 'boutique', 'supermarket',
      'fashion', 'jeweller', 'florist', 'gift shop', 'newsagent',
      'off licence', 'tobacconist', 'bookshop'],                     'Retail'),
]

# Pain point templates indexed by industry label
PAIN_POINTS = {
    'Construction/Trades': (
        "Most {category} businesses in {city} are losing 20-30% of margin to "
        "job-site chaos and quoting bottlenecks -- work's coming in but the profit isn't sticking."
    ),
    'Restaurants/Hospitality': (
        "Margin squeeze and staff turnover are quietly eating the profit out of "
        "{category} operations across {city} -- the busier it gets, the harder the numbers are to hold."
    ),
    'Healthcare/Medical': (
        "Admin overload and compliance burden are forcing {category} practices in {city} "
        "to cap patient capacity -- the ceiling isn't clinical, it's operational."
    ),
    'Legal/Law Firms': (
        "Most {category} firms in {city} hit the same wall: billable hours cap out and "
        "client acquisition stays unpredictable -- growth stalls without a systems change."
    ),
    'Real Estate': (
        "Deal pipeline visibility and lead follow-up gaps cost {category} operators in "
        "{city} more closed deals than any market condition -- it's a systems problem, not a market one."
    ),
    'Retail': (
        "Inventory blind spots and thin margins are the silent killers for {category} "
        "businesses in {city} -- most owners are the last to see it coming."
    ),
    'Accountancy/Finance': (
        "Peak-season burnout and scaling constraints keep most {category} firms in {city} "
        "stuck trading time for money -- capacity won't grow without structural change."
    ),
    'Marketing/Agency': (
        "Scope creep and pricing power erosion are squeezing {category} agencies in "
        "{city} from both ends -- revenue grows, but take-home doesn't follow."
    ),
    'Fitness/Wellness': (
        "Client churn and programme commoditisation are the quiet growth ceiling for "
        "{category} businesses in {city} -- retention beats acquisition, but most don't have a system for it."
    ),
    'Manufacturing': (
        "Production bottlenecks and cash-flow timing mismatches trap most {category} "
        "operators in {city} in a cycle that's hard to scale out of without outside visibility."
    ),
    'Other': (
        "Most business owners in {city} hit the same owner-trap bottleneck -- "
        "the business runs on them, and that caps everything: income, time, and exit value."
    ),
}

# CRM-compatible output column order
# These names match arcane-consulting-crm.html autoMap keywords exactly
CRM_OUTPUT_COLUMNS = ['name', 'email', 'phone', 'company', 'website', 'address', 'industry', 'revenue']
ENRICHMENT_COLUMNS = ['cleaned_name', 'subject', 'icebreaker', 'pain_point', 'cta']

# ─────────────────────────────────────────────────────────────
# UTILITY FUNCTIONS
# ─────────────────────────────────────────────────────────────

def resolve_columns(headers: list) -> dict:
    """Return a dict mapping logical field name -> column index. Case-insensitive, BOM-stripped."""
    normalised = [h.strip().lstrip('\ufeff').lower() for h in headers]
    mapping = {}
    for field, aliases in COLUMN_ALIASES.items():
        for idx, h in enumerate(normalised):
            if h in aliases:
                mapping[field] = idx
                break
    return mapping


def get_field(row: list, col_map: dict, field: str, default: str = '') -> str:
    """Safely retrieve a field value from a CSV row."""
    idx = col_map.get(field)
    if idx is None or idx >= len(row):
        return default
    return row[idx].strip()


def extract_city_from_address(address: str) -> str:
    """Extract city from a comma-separated address string, skipping postcodes and country names."""
    if not address:
        return ''
    parts = [p.strip() for p in address.split(',')]
    UK_POSTCODE = re.compile(r'^[A-Z]{1,2}\d[\d A-Z]*\d[A-Z]{2}$', re.I)
    US_ZIP      = re.compile(r'^\d{5}(-\d{4})?$')
    COUNTRY     = re.compile(
        r'^(united kingdom|uk|england|scotland|wales|ireland|usa|united states|us|canada|australia)$',
        re.I
    )
    for part in reversed(parts):
        if not part or len(part) < 2:
            continue
        if UK_POSTCODE.match(part) or US_ZIP.match(part) or COUNTRY.match(part):
            continue
        if re.match(r'^\d+\s*\w{0,3}$', part):  # skip house numbers
            continue
        return part
    return parts[0] if parts else ''


def clean_name(raw: str) -> str:
    """Strip trailing legal suffixes from a business name, iterating until stable."""
    name = raw.strip()
    prev = None
    while prev != name:
        prev = name
        name = _SUFFIX_RE.sub('', name).strip()
        name = _TRAILING_PUNCT_RE.sub('', name).strip()
    return name or raw.strip()


def classify_industry(category: str) -> str:
    """Map a Google Maps category string to an internal industry label."""
    cat = (category or '').lower()
    if not cat:
        return 'Other'
    for keywords, label in INDUSTRY_MAP:
        if any(kw in cat for kw in keywords):
            return label
    return 'Other'


def build_icebreaker(city: str, reviews: str, category: str) -> str:
    city     = (city or 'your area').strip()
    category = (category or 'your sector').strip()
    try:
        count = int(float(str(reviews).replace(',', '').strip()))
    except (ValueError, TypeError):
        count = 0
    if count > 0:
        return (
            f"With {count} Google reviews in {city}, you've clearly built real "
            f"trust in {category} -- that's rare."
        )
    return (
        f"As a {category} business in {city}, you're operating in one of the "
        f"most competitive spaces going."
    )


def build_subject(city: str) -> str:
    return f"{(city or 'your area').lower().strip()} systems audit"


def build_pain_point(industry: str, city: str, category: str) -> str:
    template = PAIN_POINTS.get(industry, PAIN_POINTS['Other'])
    return template.format(
        city=city or 'your area',
        category=category or 'your sector',
    )


def build_cta(cleaned: str) -> str:
    name = cleaned or 'your business'
    return (
        f"I've put together a short 12-minute video that breaks down the exact "
        f"system we'd use to fix the bottleneck inside {name} -- "
        f"worth 12 minutes of your time?"
    )

# ─────────────────────────────────────────────────────────────
# CORE PROCESSING
# ─────────────────────────────────────────────────────────────

def process_row(row: list, col_map: dict, original_headers: list) -> dict:
    """Produce the full enriched record dict from a raw CSV row."""
    g = lambda field: get_field(row, col_map, field)

    raw_name  = g('name')
    address   = g('address')
    city      = g('city') or extract_city_from_address(address)
    phone     = g('phone')
    website   = g('website')
    reviews   = g('reviews')
    category  = g('category')
    email     = g('email')

    cleaned    = clean_name(raw_name)
    industry   = classify_industry(category)
    subject    = build_subject(city)
    icebreaker = build_icebreaker(city, reviews, category)
    pain_point = build_pain_point(industry, city, category)
    cta        = build_cta(cleaned)

    # Preserve all original columns
    original = {}
    for i, header in enumerate(original_headers):
        original[header] = row[i] if i < len(row) else ''

    # CRM-compatible columns (named to trigger arcane-consulting-crm.html autoMap)
    crm = {
        'name':     raw_name,
        'email':    email,
        'phone':    phone,
        'company':  raw_name,   # duplicate: ensures CRM 'company' field also populated
        'website':  website,
        'address':  address,
        'industry': industry,   # classified label, not raw category string
        'revenue':  '',         # not available from Maps; placeholder for CRM revenueEstimate
    }

    enrichment = {
        'cleaned_name': cleaned,
        'subject':      subject,
        'icebreaker':   icebreaker,
        'pain_point':   pain_point,
        'cta':          cta,
    }

    return {
        'original':    original,
        'crm':         crm,
        'enrichment':  enrichment,
        'json_record': {**original, **crm, **enrichment},
    }


def process_file(input_path: str, output_csv: str, output_json: str) -> None:
    """Main pipeline: read -> enrich -> write CSV + JSONL."""

    if not os.path.exists(input_path):
        print(f"ERROR: Input file not found: {input_path}")
        sys.exit(1)

    print(f"Reading: {input_path}")

    with open(input_path, newline='', encoding='utf-8-sig') as fh:
        reader = csv.reader(fh)
        try:
            headers = next(reader)
        except StopIteration:
            print("ERROR: Input CSV is empty.")
            sys.exit(1)
        rows = list(reader)

    print(f"Detected {len(rows)} data rows with {len(headers)} columns.")
    print(f"Headers: {headers}\n")

    col_map = resolve_columns(headers)
    print("Column mapping resolved:")
    for field, idx in col_map.items():
        print(f"  {field:12s} <- column {idx}: '{headers[idx]}'")

    missing = [f for f in ['name', 'address'] if f not in col_map]
    if missing:
        print(f"\nWARNING: Could not find columns for: {missing}")

    out_headers = CRM_OUTPUT_COLUMNS + ENRICHMENT_COLUMNS

    processed_records = []
    for i, row in enumerate(rows, start=1):
        result = process_row(row, col_map, headers)
        processed_records.append(result)
        print(f"\r  Processing row {i}/{len(rows)}...", end='', flush=True)

    print(f"\n\nWriting CSV:  {output_csv}")
    with open(output_csv, 'w', newline='', encoding='utf-8') as fh:
        writer = csv.DictWriter(fh, fieldnames=out_headers, extrasaction='ignore')
        writer.writeheader()
        for rec in processed_records:
            writer.writerow({**rec['crm'], **rec['enrichment']})

    print(f"Writing JSONL: {output_json}")
    with open(output_json, 'w', encoding='utf-8') as fh:
        for rec in processed_records:
            fh.write(json.dumps(rec['json_record'], ensure_ascii=False) + '\n')

    print(f"\nDone. {len(processed_records)} records written.")
    print(f"  CSV  -> {output_csv}")
    print(f"  JSONL -> {output_json}")

# ─────────────────────────────────────────────────────────────
# ENTRY POINT
# ─────────────────────────────────────────────────────────────

if __name__ == '__main__':
    args = sys.argv[1:]
    input_path  = args[0] if len(args) > 0 else DEFAULT_INPUT
    output_csv  = args[1] if len(args) > 1 else DEFAULT_OUTPUT_CSV
    output_json = args[2] if len(args) > 2 else DEFAULT_OUTPUT_JSON

    # Resolve relative paths from script directory
    base = os.path.dirname(os.path.abspath(__file__))
    if not os.path.isabs(input_path):
        input_path = os.path.join(base, input_path)
    if not os.path.isabs(output_csv):
        output_csv = os.path.join(base, output_csv)
    if not os.path.isabs(output_json):
        output_json = os.path.join(base, output_json)

    process_file(input_path, output_csv, output_json)
