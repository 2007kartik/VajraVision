"""
app/agent/cache.py — Semantic Caching layer for Agent queries.
"""
import json
import logging
import math
from typing import Optional

from langchain_google_genai import GoogleGenerativeAIEmbeddings
from app.config import get_settings
from app.redis_client import get_redis

logger = logging.getLogger(__name__)
settings = get_settings()

CACHE_LIST_KEY = "semantic_cache_recent"
MAX_CACHE_SIZE = 100
SIMILARITY_THRESHOLD = 0.95

# Initialize Embeddings Model
embeddings_model = GoogleGenerativeAIEmbeddings(
    model="models/text-embedding-004",
    google_api_key=settings.gemini_api_key
)

def cosine_similarity(v1: list[float], v2: list[float]) -> float:
    dot_product = sum(a * b for a, b in zip(v1, v2))
    mag1 = math.sqrt(sum(a * a for a in v1))
    mag2 = math.sqrt(sum(b * b for b in v2))
    if mag1 == 0 or mag2 == 0:
        return 0.0
    return dot_product / (mag1 * mag2)

async def check_semantic_cache(query: str) -> Optional[dict]:
    """
    Check if a semantically similar query was recently answered.
    Returns the cached response data if a match > SIMILARITY_THRESHOLD is found.
    """
    try:
        r = await get_redis()
        cached_items = await r.lrange(CACHE_LIST_KEY, 0, -1)
        if not cached_items:
            return None

        # Generate embedding for the new query
        query_embedding = await embeddings_model.aembed_query(query)

        best_match = None
        best_score = 0.0

        for item_str in cached_items:
            item = json.loads(item_str)
            score = cosine_similarity(query_embedding, item["embedding"])
            if score > best_score:
                best_score = score
                best_match = item

        if best_match and best_score >= SIMILARITY_THRESHOLD:
            logger.info("Semantic cache HIT! Score: %.2f | Query: %s", best_score, query)
            return {
                "answer_text": best_match["answer_text"],
                "confidence": best_match["confidence"],
                "task_type": best_match["task_type"],
                "specialist": best_match["specialist"],
                "model_used": best_match["model_used"] + " (Cached)",
                "similarity_score": best_score
            }
            
        logger.info("Semantic cache MISS. Best score: %.2f", best_score)
        return None

    except Exception as exc:
        logger.warning("Semantic caching check failed: %s", exc)
        return None


async def save_to_semantic_cache(
    query: str, 
    answer_text: str, 
    confidence: int, 
    task_type: str, 
    specialist: str, 
    model_used: str
) -> None:
    """Save a successful query and its embedding to the cache."""
    try:
        query_embedding = await embeddings_model.aembed_query(query)
        
        cache_entry = {
            "query": query,
            "embedding": query_embedding,
            "answer_text": answer_text,
            "confidence": confidence,
            "task_type": task_type,
            "specialist": specialist,
            "model_used": model_used
        }
        
        r = await get_redis()
        # Push to left of list
        await r.lpush(CACHE_LIST_KEY, json.dumps(cache_entry))
        # Trim list to max size
        await r.ltrim(CACHE_LIST_KEY, 0, MAX_CACHE_SIZE - 1)
        
    except Exception as exc:
        logger.warning("Failed to save to semantic cache: %s", exc)
