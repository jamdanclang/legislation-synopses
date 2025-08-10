# scripts/etl.py
import os, json, time, datetime
from typing import List, Dict, Any, Optional
import requests
from bs4 import BeautifulSoup

OPENSTATES_API_KEY = os.environ.get("OPENSTATES_API_KEY")
LOOKBACK_DAYS = int(os.environ.get("ETL_LOOKBACK_DAYS", "7"))
NE_REQUEST_DELAY = float(os.environ.get("NE_REQUEST_DELAY_MS", "0.5"))
SESSION_IDENTIFIER = os.environ.get("SESSION_IDENTIFIER")
API_BASE = "https://v3.openstates.org"
HEADERS = {"X-API-KEY": (os.environ.get("OPENSTATES_API_KEY") or "").strip(),
           "Accept": "application/json"}

OCD_NE = "ocd-jurisdiction/country:us/state:ne/government"

def _get_ne_current_session_identifier() -> str:
    """Fetch Nebraska jurisdiction with sessions and return the active session identifier."""
    url = f"{API_BASE}/jurisdictions"
    params = {"include": "legislative_sessions", "per_page": 50, "page": 1}
    r = requests.get(url, params=params, headers=HEADERS, timeout=30)
    if r.status_code >= 400:
        raise RuntimeError(f"Jurisdictions error {r.status_code}: {r.text[:500]}")
    data = r.json()
    ne = next((j for j in data.get("results", []) if j.get("name") == "Nebraska"), None)
    if not ne:
        raise RuntimeError("Could not find Nebraska in jurisdictions.")
    sessions = ne.get("legislative_sessions", [])
    active = [s for s in sessions if s.get("active")]
    chosen = None
    if active:
        # pick the most recent active session by start_date
        chosen = max(active, key=lambda s: s.get("start_date") or "")
    elif sessions:
        chosen = max(sessions, key=lambda s: s.get("start_date") or "")
    if not chosen or not chosen.get("identifier"):
        raise RuntimeError("Nebraska session identifier not found.")
    return chosen["identifier"]


def date_n_days_ago(n:int) -> str:
    d = datetime.datetime.utcnow() - datetime.timedelta(days=n)
    return d.strftime("%Y-%m-%d")

def fetch_openstates_bills():
    key = (os.environ.get("OPENSTATES_API_KEY") or "").strip()
    if not key:
        raise SystemExit("OPENSTATES_API_KEY is not set.")
    session_id = os.environ.get("SESSION_IDENTIFIER") or _get_ne_current_session_identifier()

    base = f"{API_BASE}/bills"
    params = {
        "jurisdiction": OCD_NE,     # robust canonical ID
        "session": session_id,      # <-- the fix
        "sort": "-updated_at",      # optional; stable
        "per_page": 50,
        "page": 1,
    }

    results = []
    while True:
        r = requests.get(base, params=params, headers=HEADERS, timeout=30)
        if r.status_code in (400, 422):
            # Show the server’s message in Actions logs to diagnose quickly
            raise RuntimeError(f"Bills error {r.status_code}: {r.text[:800]}")
        r.raise_for_status()
        data = r.json()
        results += data.get("results", [])
        max_page = int(data.get("pagination", {}).get("max_page", 1))
        if params["page"] >= max_page or params["page"] >= 4:  # cap to ~200 for speed
            break
        params["page"] += 1
    return results


def first_ne_official_url(item:Dict[str,Any]) -> Optional[str]:
    for s in item.get("sources", []):
        u = s.get("url") or ""
        if "nebraskalegislature.gov" in u:
            return u
    return None

def scrape_ne_links(official_url:str) -> Dict[str,Optional[str]]:
    """Best-effort parse of official page for Statement of Intent, Fiscal Note, Bill text PDFs"""
    try:
        r = requests.get(official_url, timeout=30)
        r.raise_for_status()
    except Exception:
        return {"soi_pdf_url": None, "fiscal_pdf_url": None, "text_pdf_url": None}
    soup = BeautifulSoup(r.text, "html.parser")
    soi = fiscal = textpdf = None
    for a in soup.find_all("a"):
        label = (a.get_text() or "").strip()
        href = a.get("href") or ""
        if not href: 
            continue
        url = requests.compat.urljoin(official_url, href)
        if (not soi) and ("statement of intent" in label.lower()):
            soi = url
        if (not fiscal) and ("fiscal note" in label.lower()):
            fiscal = url
        if (not textpdf) and (("introduced" in label.lower()) or ("bill text" in label.lower())):
            textpdf = url
    return {
        "soi_pdf_url": soi,
        "fiscal_pdf_url": fiscal,
        "text_pdf_url": textpdf
    }

AGENCY_SEED = [
    {"name": "Department of Health and Human Services", "slug": "dhhs", "hints": ["Department of Health and Human Services", "DHHS"]},
    {"name": "Department of Revenue", "slug": "revenue", "hints": ["Department of Revenue"]},
    {"name": "Department of Education", "slug": "education", "hints": ["Department of Education", "NDE"]},
    {"name": "Department of Transportation", "slug": "dot", "hints": ["Department of Transportation", "NDOT"]},
    {"name": "State Fire Marshal", "slug": "sfm", "hints": ["State Fire Marshal"]},
    {"name": "Department of Labor", "slug": "labor", "hints": ["Department of Labor"]},
]

def detect_agencies(text:str) -> List[Dict[str,str]]:
    found = []
    lt = text.lower()
    for a in AGENCY_SEED:
        for h in a["hints"]:
            if h.lower() in lt:
                found.append({"name": a["name"], "slug": a["slug"]})
                break
    uniq = {a["slug"]: a for a in found}
    return list(uniq.values())

def summarize(title:str) -> Dict[str,str]:
    return {
        "general_summary": title[:380],
        "impact_summary": "Short impact placeholder. Update with a real summary later."
    }

def main():
    bills_raw = fetch_openstates_bills()
    bills = []
    for item in bills_raw:
        official = first_ne_official_url(item)
        links = scrape_ne_links(official) if official else {"soi_pdf_url": None, "fiscal_pdf_url": None, "text_pdf_url": None}
        title = item.get("title") or ""
        sums = summarize(title)
        bill = {
            "id": item.get("id"),
            "number": item.get("identifier"),
            "session": item.get("session"),
            "title": title,
            "status": str(item.get("latest_action") or ""),
            "introduced_date": (item.get("first_action_date") or item.get("created_at") or "")[:10],
            "sponsor": (item.get("sponsorships") or [{}])[0].get("name"),
            "committee": None,
            "official_url": official,
            "text_pdf_url": links.get("text_pdf_url"),
            "soi_pdf_url": links.get("soi_pdf_url"),
            "fiscal_pdf_url": links.get("fiscal_pdf_url"),
            "general_summary": sums["general_summary"],
            "impact_summary": sums["impact_summary"],
            "agencies": detect_agencies(title),
        }
        bills.append(bill)
        time.sleep(NE_REQUEST_DELAY)
    os.makedirs("data", exist_ok=True)
    with open("data/bills.json", "w", encoding="utf-8") as f:
        json.dump(bills, f, ensure_ascii=False, indent=2)
    with open("data/agencies.json", "w", encoding="utf-8") as f:
        json.dump([{"name": a["name"], "slug": a["slug"]} for a in AGENCY_SEED], f, ensure_ascii=False, indent=2)
    print(f"Wrote {len(bills)} bills to data/bills.json")

if __name__ == "__main__":
    main()
