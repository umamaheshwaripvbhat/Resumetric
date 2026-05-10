def calculate_score(data: dict) -> float:
    """
    Weighted mathematical formula validating overall score based on deep AI metrics array.
    """
    scores = data.get("scores", {})
    return (
        scores.get("keyword_match", 0) * 0.35 +
        scores.get("impact_metrics", 0) * 0.20 +
        scores.get("technical_relevance", 0) * 0.15 +
        scores.get("structure_readability", 0) * 0.12 +
        scores.get("experience_depth", 0) * 0.10 +
        scores.get("consistency", 0) * 0.08
    )
