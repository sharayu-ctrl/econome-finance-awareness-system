"""
EconoMe — Database Seed Script
Phase 10: Populates learning_content and initial macro_economic_data
for development and staging environments.

Run: python seed.py
"""
import asyncio
import uuid
from datetime import datetime
from shared.database import AsyncSessionLocal, init_db
from shared.models import LearningContent, MacroEconomicData

LESSONS = [
    {
        "topic": "What is Inflation?",
        "difficulty": "beginner",
        "content_md": """## What is Inflation?

Inflation is the rate at which the general level of prices for goods and services rises over time.

**Why it matters for you:**
When inflation is 5%, something that cost ₹100 last year now costs ₹105. Your same salary buys *less*.

**Key measures:**
- **CPI (Consumer Price Index)**: Tracks prices of a basket of everyday goods — food, clothing, housing, transport.
- **Food inflation**: Often higher than CPI. Directly hits your grocery and dining bills.
- **Core inflation**: CPI minus food & fuel — used by the RBI to set policy.

**What to watch:** If CPI > 6%, the RBI typically raises the repo rate to cool spending.

**Real-world example:** In 2023-24, India's food inflation was ~8%. A family spending ₹10,000/month on groceries effectively needed ₹10,800 to buy the same items.
""",
        "tags": ["inflation", "cpi", "basics", "money"],
    },
    {
        "topic": "RBI Repo Rate Explained",
        "difficulty": "beginner",
        "content_md": """## RBI Repo Rate Explained

The **Repo Rate** is the interest rate at which the Reserve Bank of India (RBI) lends money to commercial banks.

**The chain reaction:**
RBI raises repo rate → Banks pay more to borrow → Banks raise your loan rates → Your EMI increases.

**Current rate:** The RBI's Monetary Policy Committee (MPC) reviews this every 2 months.

**Impact on your finances:**
- **Home loan EMI**: A 0.25% repo rate hike on a ₹50L loan = ₹~800/month more.
- **FD rates**: When repo rises, FD interest rates often follow — good for savers.
- **Credit card rates**: Usually not directly linked, but overall credit cost rises.

**The RBI's goal:** Balance between controlling inflation and supporting economic growth.
""",
        "tags": ["repo-rate", "rbi", "emi", "loans", "basics"],
    },
    {
        "topic": "Understanding Your Savings Rate",
        "difficulty": "beginner",
        "content_md": """## Understanding Your Savings Rate

**Savings Rate = (Income - Expenses) ÷ Income × 100**

A savings rate of 20% means ₹20 of every ₹100 earned is saved.

**Why 15% is the benchmark:**
Financial planners widely recommend saving at least 15% of net income to:
1. Build an emergency fund (3-6 months of expenses)
2. Contribute to retirement
3. Create a financial buffer for life events

**Reading your rate:**
- **< 10%**: Critical — very little cushion for emergencies
- **10-15%**: Caution — below recommended minimum
- **15-25%**: Healthy — on track for financial stability
- **> 25%**: Strong — ahead of most peers

**The biggest savings killers in India:**
1. Lifestyle inflation (spending rises as income rises)
2. Unplanned discretionary spending
3. High EMI-to-income ratios
""",
        "tags": ["savings", "budgeting", "personal-finance", "basics"],
    },
    {
        "topic": "USD/INR: Why the Rupee's Value Matters",
        "difficulty": "intermediate",
        "content_md": """## USD/INR: Why the Rupee's Value Matters

The USD/INR rate tells you how many rupees equal one US dollar.
If USD/INR = 84, you need ₹84 to buy $1.

**When the rupee weakens (higher number):**
- Imports become expensive — crude oil, electronics, medicines
- Petrol prices often rise
- Imported goods in supermarkets cost more

**When the rupee strengthens (lower number):**
- Imports become cheaper
- IT companies exporting services earn more in rupee terms

**Your household impact:**
India imports ~85% of its crude oil. A weaker rupee → higher crude costs → higher petrol → higher transport costs → higher food delivery prices.

**Who decides the rupee's value?**
Primarily market demand/supply for foreign currency, influenced by trade balance, FII flows, RBI intervention, and US Fed policy.
""",
        "tags": ["forex", "usd-inr", "rupee", "imports", "intermediate"],
    },
    {
        "topic": "EMI Burden: How Much is Too Much?",
        "difficulty": "intermediate",
        "content_md": """## EMI Burden: How Much is Too Much?

Your **EMI-to-Income Ratio** = Total Monthly EMIs ÷ Net Monthly Income

**Industry guideline:** Keep total EMIs below 35-40% of net income.

**Example:**
- Net income: ₹80,000/month
- Home loan EMI: ₹22,000
- Car loan EMI: ₹8,000
- Total EMIs: ₹30,000 → 37.5% — at the upper edge of safe

**Risks of high EMI burden:**
1. **Liquidity trap**: Most of your income is committed before you can decide
2. **Emergency vulnerability**: One job loss or medical event can cause default
3. **Savings squeeze**: Less money available for investments or goals

**The compound problem:**
High EMI + rising inflation = savings rate collapse. If both happen simultaneously, even stable-income households can face stress.

**Health check:** If your EMI ratio is > 40%, look for opportunities to prepay the highest-interest loan first.
""",
        "tags": ["emi", "loans", "debt", "budgeting", "intermediate"],
    },
    {
        "topic": "How Crude Oil Prices Affect Your Daily Life",
        "difficulty": "intermediate",
        "content_md": """## How Crude Oil Prices Affect Your Daily Life

India is the world's third-largest oil importer. When crude prices rise internationally, almost everything gets more expensive domestically.

**The transmission chain:**
Crude price rises → Petrol/diesel costs more → Transport costs rise → Food delivery, logistics, FMCG goods, vegetables all get pricier.

**Brent Crude price thresholds (rough indicators):**
- **< $70/barrel**: Comfortable for India, low fuel price pressure
- **$70-90/barrel**: Moderate pressure, petrol prices stable if rupee is strong
- **> $90/barrel**: Significant pressure, petrol prices likely to rise

**Direct household impacts:**
1. **Petrol/diesel**: Most direct — affects commuters and vehicle owners
2. **LPG cylinders**: Cooking gas prices linked to international LPG rates
3. **Aviation fuel**: Flight ticket prices react within weeks
4. **Vegetables**: Farmer-to-market transport costs embedded in prices

**Indirect impacts (often ignored):**
- Fertilizer prices (oil-derived) affect farmer costs → food prices
- Plastic packaging costs affect FMCG product pricing
""",
        "tags": ["crude-oil", "fuel", "inflation", "intermediate"],
    },
    {
        "topic": "Building an Emergency Fund",
        "difficulty": "beginner",
        "content_md": """## Building an Emergency Fund

An emergency fund is a cash reserve specifically for unplanned expenses or financial disruptions.

**Target:** 3-6 months of essential expenses (rent + food + utilities + EMIs)

**Example calculation:**
- Monthly essentials: ₹35,000
- Target emergency fund: ₹1,05,000 to ₹2,10,000

**Where to keep it:**
- High-yield savings account or liquid mutual fund (NOT in fixed deposits — premature withdrawal penalties)
- Should be accessible within 1-2 business days

**Building it step by step:**
1. Start small — even ₹2,000/month is progress
2. Keep it separate from your regular savings account (prevents accidental spending)
3. Replenish immediately after any emergency use
4. Don't invest it in equity — stability matters more than returns here

**Why it protects your financial health:**
Without an emergency fund, any unexpected expense (medical, job loss, appliance repair) forces you to break long-term savings or take high-interest personal loans.
""",
        "tags": ["emergency-fund", "savings", "financial-planning", "beginner"],
    },
    {
        "topic": "Reading the NIFTY50: What It Tells You",
        "difficulty": "advanced",
        "content_md": """## Reading the NIFTY50: What It Tells You

The **NIFTY50** is India's benchmark stock market index — it tracks the performance of the top 50 companies listed on the National Stock Exchange.

**What it represents:**
A weighted average of 50 large-cap Indian companies across sectors: financials, IT, energy, consumer goods, healthcare.

**What NIFTY movements signal:**
- **Rising NIFTY**: Investor confidence is up, corporate earnings expectations are positive, FII money flowing in
- **Falling NIFTY**: Risk aversion, global uncertainty, or domestic economic concerns

**What it does NOT tell you:**
The NIFTY is a *lagging-to-coincident* indicator for most household finances. Your grocery bill is not directly determined by NIFTY.

**Indirect connections:**
- If NIFTY falls sharply, consumer confidence may drop → businesses cut costs → hiring slows → job market softens
- Corporate profitability (tracked by NIFTY earnings) eventually flows into salaries and bonuses

**Educational caveat:** Watching NIFTY daily without context creates anxiety. It is more meaningful when viewed in 3-6 month trends alongside macro indicators.
""",
        "tags": ["nifty50", "stock-market", "investing", "advanced", "equities"],
    },
]

MACRO_SEED = [
    {"indicator_key": "REPO_RATE",  "value": 6.50,    "unit": "%",          "source": "RBI"},
    {"indicator_key": "CPI_INDIA",  "value": 5.40,    "unit": "%",          "source": "MoSPI"},
    {"indicator_key": "USD_INR",    "value": 83.62,   "unit": "INR",        "source": "OpenExchangeRates"},
    {"indicator_key": "CRUDE_OIL",  "value": 82.45,   "unit": "USD/barrel", "source": "EIA"},
    {"indicator_key": "NIFTY50",    "value": 22530.00, "unit": "INR",       "source": "NSE"},
]


async def seed():
    await init_db()
    async with AsyncSessionLocal() as db:
        # ── Seed learning content ──────────────────────────────────────────────
        for lesson_data in LESSONS:
            lesson = LearningContent(
                lesson_id=str(uuid.uuid4()),
                topic=lesson_data["topic"],
                difficulty=lesson_data["difficulty"],
                content_md=lesson_data["content_md"],
                tags=lesson_data["tags"],
                is_active=True,
            )
            db.add(lesson)

        # ── Seed macro data ────────────────────────────────────────────────────
        for macro in MACRO_SEED:
            db.add(MacroEconomicData(
                record_id=str(uuid.uuid4()),
                indicator_key=macro["indicator_key"],
                value=macro["value"],
                unit=macro["unit"],
                source=macro["source"],
                recorded_at=datetime.utcnow(),
                is_latest=True,
            ))

        await db.commit()
        print(f"✓ Seeded {len(LESSONS)} lessons and {len(MACRO_SEED)} macro indicators.")


if __name__ == "__main__":
    asyncio.run(seed())
