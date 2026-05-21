"""
EconoMe — AI Finance Tutor (Phase 4 §4.7)
Context-injection pipeline wrapped around a local LLM or TF-IDF retrieval fallback.
Guardrails: regex blocks investment advice keywords before delivery.
"""
import re
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from shared.models import AiChatHistory, LearningContent, AiContext
from shared.crypto import encrypt, decrypt
from shared.redis_client import cache_set, cache_get
import json

# ── Guardrail Configuration ───────────────────────────────────────────────────

BLOCKED_PHRASES = re.compile(
    r"\b(invest in|buy\s+(?:this|the|a)\s+(?:stock|fund|share)|"
    r"guaranteed\s+return|sell\s+(?:your|the)\s+(?:stocks?|funds?)|"
    r"specific\s+(?:stock|fund)|SIP\s+in|lump\s+sum\s+into)\b",
    re.IGNORECASE,
)

GUARDRAIL_REPLACEMENT = (
    "I can help you understand financial concepts educationally, "
    "but for personalized investment advice, please consult a SEBI-registered advisor."
)

ESCALATION_TRIGGERS = re.compile(
    r"\b(which\s+(?:stock|fund|share)|where\s+(?:should\s+I\s+invest|to\s+invest)|"
    r"recommend\s+(?:a\s+)?(?:stock|fund)|best\s+mutual\s+fund)\b",
    re.IGNORECASE,
)


# ── Session History ───────────────────────────────────────────────────────────

async def get_session_history(db: AsyncSession, session_id: str, user_id: str, limit: int = 10) -> list[dict]:
    result = await db.execute(
        select(AiChatHistory)
        .where(AiChatHistory.session_id == session_id)
        .order_by(AiChatHistory.created_at.desc())
        .limit(limit)
    )
    rows = result.scalars().all()
    history = []
    for r in reversed(rows):
        try:
            msg = decrypt(r.message_enc, user_id)
        except Exception:
            msg = "[encrypted]"
        history.append({"role": r.role, "content": msg})
    return history


async def save_message(
    db: AsyncSession, session_id: str, user_id: str, role: str, content: str
) -> None:
    msg_enc = encrypt(content, user_id)
    db.add(AiChatHistory(
        session_id=session_id,
        user_id=user_id,
        role=role,
        message_enc=msg_enc,
    ))


# ── Guardrails ────────────────────────────────────────────────────────────────

def apply_guardrails(response: str) -> tuple[str, bool]:
    """
    Returns (safe_response, was_blocked).
    Escalation triggers return a redirect message.
    Investment advice is replaced wholesale.
    """
    if ESCALATION_TRIGGERS.search(response):
        return GUARDRAIL_REPLACEMENT, True
    if BLOCKED_PHRASES.search(response):
        return GUARDRAIL_REPLACEMENT, True
    return response, False


# ── TF-IDF Retrieval Fallback ─────────────────────────────────────────────────

async def retrieve_from_lessons(db: AsyncSession, query: str, top_k: int = 2) -> str:
    """
    When no LLM is configured: match user query to learning content via TF-IDF cosine similarity.
    """
    result = await db.execute(
        select(LearningContent).where(LearningContent.is_active == True).limit(200)
    )
    lessons = result.scalars().all()
    if not lessons:
        return "I don't have specific content on that topic yet. Check the Learning Hub for available lessons."

    try:
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.metrics.pairwise import cosine_similarity
        import numpy as np

        corpus = [l.content_md for l in lessons]
        vectorizer = TfidfVectorizer(max_features=500, stop_words="english")
        tfidf_matrix = vectorizer.fit_transform(corpus)
        query_vec = vectorizer.transform([query])
        scores = cosine_similarity(query_vec, tfidf_matrix).flatten()
        top_idx = np.argsort(scores)[::-1][:top_k]

        excerpts = []
        for i in top_idx:
            if scores[i] > 0.05:  # relevance threshold
                lesson = lessons[i]
                excerpt = lesson.content_md[:300].strip()
                excerpts.append(f"**{lesson.topic}**: {excerpt}...")

        if excerpts:
            return "\n\n".join(excerpts)
        return "I don't have specific content matching your question. Try rephrasing or explore the Learning Hub."
    except Exception as e:
        return f"Let me find that for you — {str(e)}"


# ── Main Chat Handler ─────────────────────────────────────────────────────────

async def handle_chat_message(
    db: AsyncSession,
    user_id: str,
    session_id: str,
    user_message: str,
    financial_context: dict,
    macro_context: dict,
    local_llm=None,
) -> dict:
    """
    Full chat turn:
    1. Save user message.
    2. Build context-injected prompt.
    3. Generate response (LLM or retrieval).
    4. Apply guardrails.
    5. Save assistant response.
    6. Return response dict.
    """
    # Save user turn
    await save_message(db, session_id, user_id, "user", user_message)

    # Load recent history
    history = await get_session_history(db, session_id, user_id, limit=10)

    # Escalation check on user message
    if ESCALATION_TRIGGERS.search(user_message):
        response = GUARDRAIL_REPLACEMENT
        was_blocked = True
    else:
        if local_llm:
            response = _generate_with_llm(
                local_llm, user_message, history, financial_context, macro_context
            )
        else:
            response = await retrieve_from_lessons(db, user_message)

        response, was_blocked = apply_guardrails(response)

    # Save assistant turn
    await save_message(db, session_id, user_id, "assistant", response)

    return {
        "session_id":   session_id,
        "response":     response,
        "was_filtered": was_blocked,
        "timestamp":    datetime.utcnow().isoformat(),
    }


def _generate_with_llm(llm, user_message: str, history: list[dict], fin_ctx: dict, macro_ctx: dict) -> str:
    """Build context-injected prompt and call local LLM."""
    system_block = f"""You are EconoMe, a financial awareness educator for Indian households.
You explain financial concepts clearly and empathetically in simple language.
You NEVER give investment advice. You NEVER suggest specific stocks, funds, or products.
You ONLY educate and explain.

User Financial Context:
- Savings rate: {fin_ctx.get('savings_rate', 'N/A')}
- Monthly income: ₹{fin_ctx.get('total_income', 'N/A')}
- This month's top expenses: {fin_ctx.get('expense_by_category', {})}

Macro Context:
- Repo Rate: {macro_ctx.get('REPO_RATE', {}).get('value', 'N/A')}%
- CPI Inflation: {macro_ctx.get('CPI_INDIA', {}).get('value', 'N/A')}%
- USD/INR: {macro_ctx.get('USD_INR', {}).get('value', 'N/A')}
"""
    conversation = "\n".join(
        f"{turn['role'].upper()}: {turn['content']}" for turn in history[-5:]
    )
    prompt = f"{system_block}\n\nCONVERSATION:\n{conversation}\nUSER: {user_message}\nASSISTANT:"
    try:
        return llm.generate(prompt, max_tokens=300)
    except Exception:
        return "I'm having trouble processing that right now. Please try again in a moment."
