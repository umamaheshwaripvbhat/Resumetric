import os
from openai import OpenAI
from pydantic import BaseModel
from typing import List
import io
import base64
import json

# Setup Groq Client (FREE — llama-3.3-70b)
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
client = OpenAI(
    api_key=GROQ_API_KEY,
    base_url="https://api.groq.com/openai/v1"
)
GEMINI_MODEL = "llama-3.3-70b-versatile"
HAS_OPENAI_API_KEY = bool(GROQ_API_KEY)


def gemini_parse(messages, response_model, temperature=0):
    """
    Replacement for client.beta.chat.completions.parse().
    Uses Gemini with JSON mode + manual Pydantic parsing.
    """
    schema = response_model.model_json_schema()
    if messages and messages[0]["role"] == "system":
        messages = list(messages)
        messages[0] = {
            "role": "system",
            "content": messages[0]["content"] + f"\n\nYou MUST respond with valid JSON matching this exact schema:\n{json.dumps(schema, indent=2)}"
        }

    response = client.chat.completions.create(
        model=GEMINI_MODEL,
        messages=messages,
        response_format={"type": "json_object"},
        temperature=temperature,
    )
    raw = response.choices[0].message.content
    data = json.loads(raw)
    parsed = response_model.model_validate(data)
    return parsed


class Scores(BaseModel):
    keyword_match: int
    impact_metrics: int
    technical_relevance: int
    structure_readability: int
    experience_depth: int
    consistency: int

class Improvement(BaseModel):
    original: str
    improved: str
    reason: str
    expected_by_companies: str

class ResumeAnalysis(BaseModel):
    scores: Scores
    missing_keywords: List[str]
    matched_keywords: List[str]
    improvements: List[Improvement]
    strengths: List[str]
    weaknesses: List[str]
    recruiter_expectations: List[str]
    resume_verdict: str


class StructuredResumeAnalysis(BaseModel):
    overallScore: int
    confidenceScore: int
    keywordMatch: int
    impactAndMetrics: int
    technicalRelevance: int
    structure: int
    strengths: List[str]
    weaknesses: List[str]
    quickFixes: List[str]
    missingKeywords: List[str]
    matchedKeywords: List[str]

# Pass 2 Types
class RefinedImprovement(BaseModel):
    original: str
    improved: str
    reason: str
    expected_by_companies: str

class RefinedSuggestionsList(BaseModel):
    improvements: List[RefinedImprovement]

class ResumeDocumentCheck(BaseModel):
    isResume: bool
    confidence: int
    reason: str

class SiteAssistantResponse(BaseModel):
    answer: str
    answer_correctness_percentage: int
    reasoning: str
    suggested_next_action: str


class LiveScoreCategoryScores(BaseModel):
    content: int
    structure: int
    skills: int
    ats: int


class LiveScoreUpdateResponse(BaseModel):
    overall_score: int
    category_scores: LiveScoreCategoryScores
    changes_detected: List[str]
    suggestions: List[str]


class ResumeComparisonResponse(BaseModel):
    improvements: List[str]
    regressions: List[str]
    score_before: int
    score_after: int
    summary: str


class IndustryBenchmarkResponse(BaseModel):
    user_score: int
    industry_average: int
    top_tier_score: int
    percentile_estimate: str
    gap_analysis: List[str]


class LearningResourceItem(BaseModel):
    skill: str
    resources: List[str]


class LearningResourcesResponse(BaseModel):
    missing_skills: List[str]
    recommended_resources: List[LearningResourceItem]


class MockInterviewQuestion(BaseModel):
    type: str
    question: str


class MockInterviewFeedbackFormat(BaseModel):
    score: str
    strengths: List[str]
    improvements: List[str]


class MockInterviewModeResponse(BaseModel):
    questions: List[MockInterviewQuestion]
    evaluation_criteria: List[str]
    feedback_format: MockInterviewFeedbackFormat

# Pass 3 Types
class ImprovementExplanation(BaseModel):
    insight: str

# Editor Assistant Types
class RealTimeAssistantResponse(BaseModel):
    cursor_focus_text: str
    inline_suggestion: str
    improved_line: str
    section_score: int
    highlight_type: str
    improvement_hint: str
    confidence: str

# Ghost Text Autocomplete Types
class GhostTextResponse(BaseModel):
    ghost_text: str
    improved_line: str
    confidence: str
    type: str

# Interview Prep Types
class MCQQuestion(BaseModel):
    question: str
    options: List[str]        # exactly 4 options
    correct_index: int        # 0-3
    explanation: str

class CodingQuestion(BaseModel):
    question: str
    language: str             # e.g. Python, JavaScript, SQL, React, Figma concept
    hint: str
    sample_solution: str

class InterviewQuestions(BaseModel):
    technical: List[str]
    behavioral: List[str]
    resume_based: List[str]
    gap_based: List[str]
    company_style: List[str]
    coding: List[CodingQuestion]
    mcq: List[MCQQuestion]

# Mock Interview Evaluation Types
class AnswerEvaluation(BaseModel):
    score: int
    strengths: List[str]
    weaknesses: List[str]
    missing_points: List[str]
    improved_answer: str
    feedback: str

# Voice Interview Evaluation Types
class VoiceEvaluation(BaseModel):
    score: int
    communication_score: int
    technical_score: int
    issues: List[str]
    improved_answer: str
    speaking_tips: List[str]

def validate_resume_document(resume_text: str) -> dict:
    """
    STEP 2 — AI Resume Classifier.
    Uses the exact prompt specified for the PDF validation pipeline.
    Returns: { isResume: bool, confidence: 0-100, reason: str }
    """
    prompt = f"""Read the following text extracted from a PDF.
Determine if this is a resume/CV or not.
A resume typically contains: name, contact info, work experience, education, skills.

Respond ONLY with JSON:
{{
  "isResume": true or false,
  "confidence": 0-100,
  "reason": "one sentence explanation"
}}

Text: {resume_text[:6000]}"""

    parsed = gemini_parse(
        messages=[
            {"role": "system", "content": "You are a strict document classifier for a resume analysis product. Return only valid JSON."},
            {"role": "user", "content": prompt}
        ],
        response_model=ResumeDocumentCheck,
        temperature=0
    )
    return parsed.model_dump()


def _parse_analysis_summary(analysis_summary: str) -> dict:
    try:
        return json.loads(analysis_summary) if analysis_summary else {}
    except Exception:
        return {}


def _local_site_assistant(question: str, resume_context: str, job_description: str, analysis_summary: str) -> dict:
    question_lower = question.strip().lower()
    summary = _parse_analysis_summary(analysis_summary)
    score = summary.get("score")
    missing_keywords = summary.get("missing_keywords") or []
    matched_keywords = summary.get("matched_keywords") or []
    weaknesses = summary.get("weaknesses") or []
    strengths = summary.get("strengths") or []
    verdict = summary.get("resume_verdict") or "Your resume can be improved further."

    if "enhance" in question_lower:
        return {
            "answer": (
                "🎯 ENHANCEMENT SUMMARY\n\n"
                f"Your resume already has a solid base. {verdict}\n\n"
                "✅ Changes I would make:\n"
                f"• Strengthen weak bullets with action-and-impact phrasing\n"
                f"• Add measurable outcomes to project and experience sections\n"
                f"• Improve ATS coverage for these likely missing keywords: {', '.join(missing_keywords[:5]) or 'role-specific terms'}\n"
                "• Tighten section formatting for faster recruiter scanning\n\n"
                "📈 Score Improvement:\n"
                f"• Overall Score: {score if score is not None else 70} → {min((score if score is not None else 70) + 12, 95)}\n"
                "• ATS Compatibility: stronger after keyword alignment and clearer headings\n"
                "• Impact Score: higher once metrics and outcomes are added\n\n"
                "1. Rewrite responsibilities as results.\n"
                "2. Add missing role keywords naturally.\n"
                "3. Lead with your strongest, most relevant experience.\n\n"
                "Confidence: 88%\n\n"
                "🧩 WHAT YOU MIGHT BE MISSING:\n"
                "• Recruiters look for outcomes, not task lists\n"
                "• ATS readability improves with clean headings and simple formatting\n"
                "• Strong technical resumes still need business impact"
            ),
            "answer_correctness_percentage": 88,
            "reasoning": "Built from the current resume summary, missing keywords, and resume verdict.",
            "suggested_next_action": "Open Suggestions and start with the top 3 bullet improvements.",
        }

    if "interview" in question_lower or "questions" in question_lower:
        role_hint = "your target role"
        if job_description:
            role_hint = "the role described in your job description"
        return {
            "answer": (
                f"🎯 TOP INTERVIEW QUESTIONS FOR {role_hint.upper()}\n\n"
                "1. Tell me about the most technically challenging project on your resume.\n"
                "2. Which achievement best proves your impact, and how did you measure it?\n"
                "3. How do you approach debugging under time pressure?\n"
                "4. Which tools or frameworks on your resume are you strongest in?\n"
                "5. Tell me about a time you improved performance, quality, or delivery speed.\n"
                "6. How do you prioritize competing deadlines?\n"
                "7. What trade-offs did you make in one of your projects?\n"
                "8. Which missing skill are you currently improving, and how?\n"
                "9. Why are you a fit for this role?\n"
                "10. What would your first 90 days look like in this position?\n\n"
                "Confidence: 84%\n\n"
                "🧩 WHAT YOU MIGHT BE MISSING:\n"
                "• Interviewers will test the strongest claim on your resume first\n"
                "• Missing keywords often become interview weak spots\n"
                "• Results with numbers are easier to defend under pressure"
            ),
            "answer_correctness_percentage": 84,
            "reasoning": "Generated from resume-analysis patterns without requiring the external model.",
            "suggested_next_action": "Pick 3 questions and draft STAR-style answers using your own projects.",
        }

    if "keyword" in question_lower:
        return {
            "answer": (
                "🎯 KEYWORD ANALYSIS\n\n"
                f"Matched keywords already helping you: {', '.join(matched_keywords[:5]) or 'some relevant role terms'}.\n"
                f"Keywords likely missing or underused: {', '.join(missing_keywords[:6]) or 'role-specific technical skills and business terms'}.\n\n"
                "✅ Action Steps:\n"
                "1. Add missing keywords inside real project bullets.\n"
                "2. Mirror the job description terminology where it truthfully matches your experience.\n"
                "3. Place the strongest matching tools in Skills and Experience, not just one section.\n\n"
                "Confidence: 86%\n\n"
                "🧩 WHAT YOU MIGHT BE MISSING:\n"
                "• ATS tools value repeated relevance across sections\n"
                "• Keyword stuffing hurts readability\n"
                "• Resume bullets should connect skill + action + outcome"
            ),
            "answer_correctness_percentage": 86,
            "reasoning": "Used matched and missing keyword lists from the stored resume analysis.",
            "suggested_next_action": "Update 3 bullets to include the highest-value missing keywords naturally.",
        }

    if "ats" in question_lower or "score" in question_lower:
        return {
            "answer": (
                "🎯 ATS REVIEW\n\n"
                f"Your current score is {score if score is not None else 'not available'}.\n"
                f"Strong areas: {', '.join(strengths[:3]) or 'core resume structure and relevant experience'}.\n"
                f"Biggest risks: {', '.join(weaknesses[:3]) or 'missing role keywords and limited measurable impact'}.\n\n"
                "✅ Fastest improvements:\n"
                "1. Add metrics to experience bullets.\n"
                "2. Improve keyword alignment with the target role.\n"
                "3. Keep section headers clear and ATS-friendly.\n\n"
                "Confidence: 90%\n\n"
                "🧩 WHAT YOU MIGHT BE MISSING:\n"
                "• ATS compatibility depends on both wording and structure\n"
                "• Recruiters scan the top third of the resume first\n"
                "• Stronger summaries help only if the experience section proves them"
            ),
            "answer_correctness_percentage": 90,
            "reasoning": "Used the saved analysis score, strengths, and weaknesses to produce a deterministic review.",
            "suggested_next_action": "Improve the top weak section first, then re-run analysis for a measurable score jump.",
        }

    return {
        "answer": (
            "🎯 ANSWER TO YOUR QUESTION\n\n"
            f"{verdict}\n\n"
            "📊 Here's what I found in your resume:\n"
            f"• Strong points: {', '.join(strengths[:2]) or 'relevant experience and a usable structure'}\n"
            f"• Improvement areas: {', '.join(weaknesses[:2]) or 'clearer impact and better keyword coverage'}\n"
            f"• Missing signals: {', '.join(missing_keywords[:4]) or 'more role-specific evidence'}\n\n"
            "✅ Action Steps:\n"
            "1. Strengthen your most relevant experience bullets.\n"
            "2. Add missing role keywords where they are true.\n"
            "3. Use numbers to prove outcomes.\n\n"
            "Confidence: 82%\n\n"
            "🧩 WHAT YOU MIGHT BE MISSING:\n"
            "• Hiring managers trust specific evidence more than broad claims\n"
            "• Each major skill should appear in both Skills and Experience when possible\n"
            "• Cleaner formatting improves both ATS and recruiter readability"
        ),
        "answer_correctness_percentage": 82,
        "reasoning": "Returned a local fallback because the external AI key is not configured.",
        "suggested_next_action": "Ask about keywords, ATS, enhancements, or interview prep for more focused guidance.",
    }

def analyze_resume(resume_text: str, job_description: str, jd_keywords: list, resume_keywords: list) -> dict:
    prompt = f"""
You are a resume evaluator. Analyze the following resume text against the job description. Return a JSON object with these exact keys:
- overallScore (0-100)
- confidenceScore (0-100, based on how much content you could analyze)
- keywordMatch (0-100)
- impactAndMetrics (0-100)
- technicalRelevance (0-100)
- structure (0-100)
- strengths (array of strings)
- weaknesses (array of strings)
- quickFixes (array of strings)
- missingKeywords (array of strings)
- matchedKeywords (array of strings)

Rules:
- Return only valid JSON.
- Do not invent skills, employers, certifications, projects, or metrics not present in the resume text.
- Use the job description to decide matchedKeywords and missingKeywords.
- Score strictly, but do not return zero unless the extracted resume text is unusable.

Resume Text: {resume_text}
Job Description: {job_description}
"""

    parsed = gemini_parse(
        messages=[
            {"role": "system", "content": "You are a production resume scoring API. Return ONLY valid JSON with the exact requested keys."},
            {"role": "user", "content": prompt}
        ],
        response_model=StructuredResumeAnalysis,
        temperature=0.1
    ).model_dump()

    return {
        "overallScore": parsed["overallScore"],
        "confidenceScore": parsed["confidenceScore"],
        "scores": {
            "keyword_match": parsed["keywordMatch"],
            "impact_metrics": parsed["impactAndMetrics"],
            "technical_relevance": parsed["technicalRelevance"],
            "structure_readability": parsed["structure"],
            "structure": parsed["structure"],
            "experience_depth": parsed["technicalRelevance"],
            "consistency": parsed["structure"],
        },
        "missing_keywords": parsed["missingKeywords"],
        "matched_keywords": parsed["matchedKeywords"],
        "improvements": parsed["quickFixes"],
        "strengths": parsed["strengths"],
        "weaknesses": parsed["weaknesses"],
        "recruiter_expectations": parsed["missingKeywords"][:5],
        "resume_verdict": "Analysis completed using extracted resume text and the target job description.",
    }

def refine_suggestions(improvements_raw: list, job_description: str) -> list:
    """Step 4: Multi-Pass AI Pipeline logic"""
    prompt = f"""
    We extracted these rough suggestions from a resume.
    Polish them against this Target Job Description while preserving all fields:
    original, improved, reason, expected_by_companies.
    Make the improved line honest: do not invent fake metrics, companies, tools, or achievements.

    JD: {job_description}
    Suggestions: {improvements_raw}
    """
    
    parsed = gemini_parse(
        messages=[
            {"role": "system", "content": "You are an Elite Resume Coach. Ensure perfect grammar and high-impact phrasing."},
            {"role": "user", "content": prompt}
        ],
        response_model=RefinedSuggestionsList,
        temperature=0.4
    )
    return parsed.model_dump()["improvements"]

def explain_score_shift(prev_score: int, curr_score: int) -> str:
    """Step 5: Contextual Memory AI logic"""
    prompt = f"A user's resume score changed from {prev_score}% to {curr_score}% after they updated it based on previous analysis. Write an encouraging 1-sentence technical explanation describing this momentum."
    
    parsed = gemini_parse(
        messages=[
            {"role": "system", "content": "Return the output in valid JSON format."},
            {"role": "user", "content": prompt}
        ],
        response_model=ImprovementExplanation
    )
    return parsed.insight

def improve_resume_phrase(full_text: str, section_text: str, cursor_position: int, role: str = "General", tone: str = "formal") -> dict:
    """Real-time Editor Embedded Assistant."""
    prompt = f"""
    You are an advanced AI Resume Copilot integrated into a real-time editor with cursor awareness.
    Your task is to provide inline suggestions, contextual improvements, and real-time scoring without overwhelming the user.

    ---
    # 🎯 OBJECTIVE
    * Improve resume content in real-time
    * Provide inline suggestions near cursor position
    * Score the current section dynamically
    * Keep feedback minimal, precise, and actionable

    ---
    # 📥 INPUT
    Full Text:
    {full_text}

    Current Section:
    {section_text}

    Cursor Position:
    {cursor_position}

    Target Role:
    {role}

    Tone:
    {tone}

    ---
    # 🧠 TASKS
    ## 1. Cursor-Based Analysis
    * Focus ONLY on text near cursor (±1–2 lines)
    * Detect: Weak phrasing, Missing impact, Poor verbs

    ## 2. Inline Suggestion
    Generate a short inline suggestion that:
    * Improves ONLY the current sentence
    * Is concise (1 line max)
    * Can be directly inserted

    ## 3. Section Scoring (REAL-TIME)
    Score the current section (0–100) based on:
    * Keyword relevance
    * Impact & metrics
    * Clarity
    * Technical depth

    ## 4. Improvement Hint
    Provide ONE short improvement hint (e.g. "Add measurable impact to strengthen this section")

    ## 5. Highlight Strength
    If content is good, acknowledge briefly (Do NOT over-praise)

    ---
    # 🔄 BEHAVIORAL RULES
    * Act like Grammarly + Senior Recruiter
    * Be subtle, not intrusive
    * Prioritize clarity and impact
    """
    
    parsed = gemini_parse(
        messages=[
            {"role": "system", "content": "You are a highly strict ATS real-time grammar copilot. Return ONLY valid JSON."},
            {"role": "user", "content": prompt}
        ],
        response_model=RealTimeAssistantResponse,
        temperature=0.3
    )
    return parsed.model_dump()

def predict_ghost_text(full_text: str, current_line: str, cursor_context: str, role: str = "Software Engineer", tone: str = "strong") -> dict:
    """VS Code-style ghost text — cursor-aware, minimal, fast (temperature=0.1)."""
    prompt = f"""
    You are an AI Resume Copilot providing real-time, cursor-aware inline suggestions inside a resume editor.
    Your behavior must be fast, precise, and non-intrusive.

    ---
    # INPUT
    Full Resume Text:
    {full_text}

    Current Line:
    {current_line}

    Cursor Context (last 5-10 words before cursor):
    {cursor_context}

    Target Role: {role}
    Tone: {tone}

    ---
    # TASKS
    1. Focus ONLY on the current line. Use cursor context to understand intent. Ignore unrelated sections.
    2. Produce ONE short ghost-text suggestion that:
       * Continues or improves the sentence
       * Uses strong action verbs
       * Adds measurable impact if possible
       * Is max 5-10 words
    3. Also produce an improved_line: a full improved version of the current_line only.

    ---
    # STRICT RULES
    * Do NOT repeat original text in ghost_text
    * Do NOT hallucinate technologies or metrics not present in the input
    * Suggest only what logically fits current context
    * ghost_text = short continuation (5-10 words max)
    * improved_line = full improved current sentence (1 line max)
    * Act like VS Code autocomplete + recruiter intelligence
    """

    parsed = gemini_parse(
        messages=[
            {"role": "system", "content": "You are a real-time resume autocomplete engine. Return ONLY valid JSON. ghost_text must be under 10 words."},
            {"role": "user", "content": prompt}
        ],
        response_model=GhostTextResponse,
        temperature=0.1  # Near-deterministic — same context → same suggestion
    )
    return parsed.model_dump()

def generate_interview_questions(resume_text: str, job_description: str, weaknesses: list, role: str) -> dict:
    """Personalized interview question generator — 2 per category + coding + MCQ."""

    # Detect the primary language/tool domain from JD for coding questions
    jd_lower = job_description.lower()
    if any(k in jd_lower for k in ['figma', 'ui/ux', 'user experience', 'design system', 'prototyping']):
        coding_domain = "UI/UX — Figma concepts, design tokens, component architecture, accessibility. NO code compilation questions."
        coding_lang = "UI/UX Design Concepts"
    elif any(k in jd_lower for k in ['react native', 'flutter', 'mobile app']):
        coding_domain = "React Native and mobile app development — components, state management, navigation, performance."
        coding_lang = "React Native"
    elif any(k in jd_lower for k in ['react', 'vue', 'angular', 'frontend', 'next.js', 'typescript']):
        coding_domain = "Frontend JavaScript/TypeScript — React hooks, state management, async/await, DOM, performance."
        coding_lang = "JavaScript/TypeScript"
    elif any(k in jd_lower for k in ['sql', 'database', 'postgres', 'mysql', 'dbms']):
        coding_domain = "SQL and database concepts — queries, joins, indexing, normalization, optimization."
        coding_lang = "SQL"
    elif any(k in jd_lower for k in ['python', 'django', 'flask', 'fastapi', 'machine learning', 'ml', 'data science']):
        coding_domain = "Python — algorithms, data structures, OOP, async, or data manipulation with pandas/numpy."
        coding_lang = "Python"
    elif any(k in jd_lower for k in ['java', 'spring', 'backend java']):
        coding_domain = "Java — OOP, collections, multithreading, Spring Boot REST APIs."
        coding_lang = "Java"
    elif any(k in jd_lower for k in ['embedded', 'c++', 'vlsi', 'firmware', 'microcontroller']):
        coding_domain = "C/C++ — embedded systems, pointers, memory management, bit manipulation."
        coding_lang = "C/C++"
    else:
        coding_domain = "General DSA — arrays, strings, linked lists, trees, basic algorithm problems appropriate for the role."
        coding_lang = "Python or pseudocode"

    prompt = f"""
    You are an expert technical interviewer generating a STRUCTURED mock interview for a {role} position.

    ---
    # INPUT
    Resume:
    {resume_text}

    Job Description:
    {job_description}

    Skill Gaps / Weaknesses:
    {weaknesses}

    Target Role: {role}
    Coding Domain for this role: {coding_domain}

    ---
    # TASK — Generate the following (these form the question POOL for the prep screen; mock interview will pick 2 from each):

    1. **technical** (6 questions): Deep technical questions on stack/domain from JD. Reference specific technologies.
    2. **behavioral** (6 questions): STAR-format questions referencing specific resume projects.
    3. **resume_based** (6 questions): Challenge specific achievements/claims in the resume.
    4. **gap_based** (6 questions): Target the identified skill gaps directly.
    5. **company_style** (6 questions): Pattern questions (Google/Amazon/Microsoft/FAANG style) relevant to the role.
    6. **coding** (4 objects): Role-specific coding/problem-solving questions in `{coding_lang}`. Each must have:
       - question: clear problem statement
       - language: "{coding_lang}"
       - hint: one-line hint to steer thinking
       - sample_solution: a clean, complete code or concept answer
    7. **mcq** (10 objects): Multiple-choice questions testing core concepts for this role. Each must have:
       - question: clear question
       - options: exactly 4 options (strings)
       - correct_index: 0-3 (which option is correct)
       - explanation: why the correct answer is right

    ---
    # STRICT RULES
    * Every question must be 100% specific to the resume/JD. NO generic questions.
    * For MCQ: options must be plausible, correct_index must be accurate.
    * For coding: questions must match the `{coding_lang}` domain. UI/UX gets design/concept tasks not code.
    * Return ONLY valid JSON, no other text.
    """

    parsed = gemini_parse(
        messages=[
            {"role": "system", "content": "You are a senior technical interviewer. Return ONLY valid JSON matching the exact schema. Be specific and role-accurate."},
            {"role": "user", "content": prompt}
        ],
        response_model=InterviewQuestions,
        temperature=0.5
    )
    return parsed.model_dump()


def evaluate_mock_answer(resume_text: str, job_description: str, role: str, question: str, answer: str) -> dict:
    """Strict answer evaluator — acts like a senior technical interviewer."""

    # Pre-check: detect gibberish / clearly irrelevant answers before wasting an API call
    import re as _re
    stripped = answer.strip()
    words = stripped.split()
    alpha_chars = sum(c.isalpha() for c in stripped)
    total_chars = max(len(stripped), 1)
    # Flag as gibberish if: fewer than 5 real words, OR less than 60% alphabetic chars
    is_gibberish = len(words) < 5 or (alpha_chars / total_chars) < 0.6

    if is_gibberish:
        return {
            "score": 0,
            "strengths": [],
            "weaknesses": ["The response is not a valid answer to the question."],
            "missing_points": ["A genuine, relevant response addressing the actual question asked."],
            "improved_answer": "",
            "feedback": "❌ Irrelevant or unreadable answer. Please provide a real response to the question before continuing."
        }

    prompt = f"""
    You are a strict senior technical interviewer at a top-tier company conducting a real mock interview for a {role} position.

    ---
    # INPUT
    Question asked:
    {question}

    Candidate's answer:
    {answer}

    Job Description:
    {job_description}

    Target Role: {role}

    ---
    # CRITICAL EVALUATION RULES

    **RELEVANCE CHECK (do this first):**
    - If the answer is gibberish, random characters, or completely unrelated to the question, give score = 0 and explain why.
    - If the answer is vaguely on-topic but shows no real understanding, max score = 20.
    - Only give score > 60 if the answer specifically addresses what was asked with real knowledge.

    **SCORING RUBRIC (total = 100):**
    1. Relevance to the specific question asked (0-30 pts):
       - 0 = completely off-topic or gibberish
       - 10 = mentions keywords but doesn't answer
       - 20 = partially addresses the question
       - 30 = directly and fully addresses what was asked
    2. Technical Accuracy (0-30 pts):
       - Penalize heavily for wrong facts or empty buzzwords
    3. Depth & Specificity (0-25 pts):
       - Vague answers without examples max out at 10 pts here
    4. Communication Clarity (0-15 pts)

    **HARSH HONESTY RULE:**
    - A short, fluffy, or off-topic answer should score 10-25, not 40-60.
    - Do NOT give points for keywords that appear without real understanding.
    - Do NOT give 'Strengths' if the answer has none — return an empty list.
    - The score must reflect what a real FAANG interviewer would give, not what encourages the user.

    ---
    # TASKS
    1. Score out of 100 (apply rubric strictly above)
    2. List specific strengths (empty list [] if none)
    3. List specific weaknesses (be brutal and specific)
    4. List key missing_points the candidate failed to mention
    5. Write an improved_answer showing what a strong answer looks like
    6. Write a one-sentence feedback summary as if you're the interviewer giving a debrief
    """

    parsed = gemini_parse(
        messages=[
            {"role": "system", "content": "You are a strict senior technical interviewer. Gibberish or irrelevant answers get 0. Do not be encouraging. Return ONLY valid JSON."},
            {"role": "user", "content": prompt}
        ],
        response_model=AnswerEvaluation,
        temperature=0.1
    )
    return parsed.model_dump()


def transcribe_audio(audio_bytes: bytes) -> str:
    """Transcribes audio using Gemini (base64 inline audio)."""
    try:
        audio_b64 = base64.b64encode(audio_bytes).decode('utf-8')
        response = client.chat.completions.create(
            model=GEMINI_MODEL,
            messages=[
                {"role": "user", "content": [
                    {"type": "text", "text": "Transcribe this audio exactly. Return only the spoken words, no additional commentary."},
                    {"type": "image_url", "image_url": {"url": f"data:audio/m4a;base64,{audio_b64}"}}
                ]}
            ],
        )
        return response.choices[0].message.content or ""
    except Exception as e:
        print(f"Transcription error: {e}")
        return ""

def evaluate_voice_answer(question: str, transcript: str, role: str) -> dict:
    """Evaluates a spoken response for communication quality and technical depth."""
    prompt = f"""
    You are an expert technical interviewer evaluating a SPOKEN answer from a candidate.
    
    ---
    # OBJECTIVE
    Evaluate the transcription of a spoken response realistically, focusing on both content and communication quality.
    
    ---
    # INPUT
    Target Role: {role}
    Current Question: {question}
    Transcribed Answer: {transcript}
    
    ---
    # TASKS
    Evaluate based on:
    1. Clarity & Communication: Did the candidate speak clearly? (Check for "um", "uh", or repetitive loops in transcript if present, or lack of structure).
    2. Structure: Did the candidate use an Intro -> Explanation -> Conclusion format?
    3. Technical Depth: Was the answer technically complete and accurate for a {role}?
    
    ---
    # OUTPUT REQUIREMENTS
    1. Overall Score (0-100)
    2. communication_score (0-100)
    3. technical_score (0-100)
    4. List specific issues (e.g., "Used 'um' too frequently", "Failed to explain trade-offs")
    5. Write a model improved_answer (what a strong spoken answer sounds like)
    6. List 3 speaking_tips for the candidate to improve their verbal delivery
    
    ---
    # STRICT RULES
    * Be realistic and strict - do not over-praise.
    * Return ONLY JSON matching the VoiceEvaluation schema.
    """

    parsed = gemini_parse(
        messages=[
            {"role": "system", "content": "You are a senior technical interviewer focused on verbal communication. Return ONLY valid JSON."},
            {"role": "user", "content": prompt}
        ],
        response_model=VoiceEvaluation,
        temperature=0.3
    )
    return parsed.model_dump()


def generate_live_score_update(updated_resume_text: str, previous_resume_text: str = "", job_role: str = "") -> dict:
    prompt = f"""
    You are a resume evaluation engine.

    Your task is to analyze the updated resume text and return a structured scoring breakdown in real-time.

    Instructions:
    - Evaluate across these categories:
      1. Content Quality (clarity, impact, relevance)
      2. Structure & Formatting
      3. Skills Match (based on job role if provided)
      4. ATS Compatibility
    - Compare with previous version if available.
    - Highlight incremental improvements or regressions.
    - Be strict but practical.

    Job Role:
    {job_role}

    Previous Resume Version:
    {previous_resume_text[:5000]}

    Updated Resume Text:
    {updated_resume_text[:7000]}
    """

    parsed = gemini_parse(
        messages=[
            {"role": "system", "content": "You are a production resume scoring engine. Return ONLY valid JSON."},
            {"role": "user", "content": prompt},
        ],
        response_model=LiveScoreUpdateResponse,
        temperature=0.2,
    )
    return parsed.model_dump()


def compare_resume_versions(old_resume: str, new_resume: str) -> dict:
    prompt = f"""
    You are a resume comparison engine.

    Your task is to compare two versions of a resume and highlight improvements.

    Instructions:
    - Identify differences in:
      * Content depth
      * Keyword usage
      * Structure
      * Impact of bullet points
    - Focus on meaningful improvements, not minor wording changes.

    Before:
    {old_resume[:7000]}

    After:
    {new_resume[:7000]}
    """

    parsed = gemini_parse(
        messages=[
            {"role": "system", "content": "You compare resume revisions. Return ONLY valid JSON."},
            {"role": "user", "content": prompt},
        ],
        response_model=ResumeComparisonResponse,
        temperature=0.2,
    )
    return parsed.model_dump()


def benchmark_resume_against_industry(job_role: str, resume_text: str) -> dict:
    prompt = f"""
    You are a resume benchmarking system.

    Your task is to compare a user's resume score against industry averages for a given job role.

    Instructions:
    - Use general industry expectations for the role.
    - Estimate benchmark scores for:
      * Entry-level
      * Mid-level
      * Top-tier resumes
    - Compare user resume against these.
    - Keep percentile estimates realistic.

    Role: {job_role}

    Resume:
    {resume_text[:7000]}
    """

    parsed = gemini_parse(
        messages=[
            {"role": "system", "content": "You benchmark resumes against industry standards. Return ONLY valid JSON."},
            {"role": "user", "content": prompt},
        ],
        response_model=IndustryBenchmarkResponse,
        temperature=0.2,
    )
    return parsed.model_dump()


def recommend_learning_resources(job_role: str, resume_text: str) -> dict:
    prompt = f"""
    You are a career learning assistant.

    Your task is to identify skill gaps in a resume and recommend learning resources.

    Instructions:
    - Extract missing or weak skills relevant to the target role.
    - Recommend:
      * Courses
      * Articles
      * Projects to build
    - Keep suggestions practical and beginner-to-intermediate friendly.
    - Use generic resource descriptions rather than unverifiable provider claims.

    Target Role: {job_role}

    Resume:
    {resume_text[:7000]}
    """

    parsed = gemini_parse(
        messages=[
            {"role": "system", "content": "You identify resume skill gaps and learning plans. Return ONLY valid JSON."},
            {"role": "user", "content": prompt},
        ],
        response_model=LearningResourcesResponse,
        temperature=0.3,
    )
    return parsed.model_dump()


def generate_mock_interview_mode(resume_text: str) -> dict:
    prompt = f"""
    You are an AI interviewer.

    Your task is to simulate a mock interview based on the candidate's resume.

    Instructions:
    - Generate relevant interview questions:
      * Technical (based on skills/projects)
      * Behavioral
    - After user answers, they will be evaluated on:
      * Clarity
      * Confidence
      * Technical correctness
    - Provide actionable feedback expectations in the response schema.
    - Generate at least 8 questions when possible.

    Resume:
    {resume_text[:7000]}
    """

    parsed = gemini_parse(
        messages=[
            {"role": "system", "content": "You generate mock interview sessions from resumes. Return ONLY valid JSON."},
            {"role": "user", "content": prompt},
        ],
        response_model=MockInterviewModeResponse,
        temperature=0.3,
    )
    return parsed.model_dump()

def answer_site_assistant(question: str, page: str, resume_context: str, job_description: str, analysis_summary: str) -> dict:
    if not HAS_OPENAI_API_KEY:
        return _local_site_assistant(question, resume_context, job_description, analysis_summary)

    question_lower = question.strip().lower()

    quick_action_map = {
        "enhance": "Enhance My Resume",
        "✨ enhance my resume": "Enhance My Resume",
        "questions": "Most Asked Interview Questions",
        "💼 most asked interview questions": "Most Asked Interview Questions",
        "flashcards": "Interview Flashcards",
        "build resume": "Build Resume From Scratch",
        "score": "Resume Score Review",
        "keywords": "Keyword Analysis",
        "ats": "ATS Review",
    }
    normalized_intent = quick_action_map.get(question_lower, question.strip())

    intent_instructions = ""
    if normalized_intent == "Enhance My Resume":
        intent_instructions = """
        The user chose the Enhance My Resume action.
        Provide:
        1. A short direct summary.
        2. An "ENHANCEMENT SUMMARY" section.
        3. A flat bullet list of strong changes you would make.
        4. A "Score Improvement" section with plausible before/after ranges grounded in the provided analysis summary.
        5. A "Key Improvements" section with 3 numbered points.
        6. A confidence line.
        7. A "WHAT YOU MIGHT BE MISSING" section with 3 bullets.
        Keep it realistic and do not invent fake experience.
        """
    elif normalized_intent == "Most Asked Interview Questions":
        intent_instructions = """
        The user chose the Most Asked Interview Questions action.
        Generate at least 10 tailored interview questions.
        Split them into Behavioral, Technical, Role-Specific, Situational, and Company Fit.
        Add a short tip after each question when possible using the resume context.
        Finish with 2 bonus questions, one confidence line, and a "WHAT YOU MIGHT BE MISSING" section.
        """
    elif normalized_intent == "Interview Flashcards":
        intent_instructions = """
        The user wants interview flashcards.
        Generate at least 15 flashcards.
        Format clearly as CARD 1, CARD 2, etc. with FRONT and BACK.
        Personalize answers using resume context when possible.
        Cover strengths, weaknesses, project deep-dives, salary, conflict, leadership, and technical discussions.
        Finish with a confidence line and a "WHAT YOU MIGHT BE MISSING" section.
        """
    elif normalized_intent == "Build Resume From Scratch":
        intent_instructions = """
        The user wants resume creation from scratch.
        Provide a checklist covering personal info, summary, work experience, education, skills, projects, and optional sections.
        End with 3 ways they can provide the information and recommend one.
        Include a confidence line and a "WHAT YOU MIGHT BE MISSING" section.
        """
    elif normalized_intent == "Resume Score Review":
        intent_instructions = """
        The user wants their current score explained.
        Answer directly.
        Reference the analysis summary.
        Explain what is helping, what is lowering the score, and the top 3 actions to raise it fastest.
        Include a confidence line and a "WHAT YOU MIGHT BE MISSING" section.
        """
    elif normalized_intent == "Keyword Analysis":
        intent_instructions = """
        The user wants keyword guidance.
        Explain missing vs matched keywords, why the gaps matter, and what to add without stuffing.
        Include 5 concrete keyword improvement suggestions if context exists.
        Finish with a confidence line and a "WHAT YOU MIGHT BE MISSING" section.
        """
    elif normalized_intent == "ATS Review":
        intent_instructions = """
        The user wants ATS compatibility feedback.
        Review formatting, headings, keyword coverage, readability, and measurable impact.
        Give short direct fixes.
        Finish with a confidence line and a "WHAT YOU MIGHT BE MISSING" section.
        """
    else:
        intent_instructions = """
        Answer as Resumetric AI, an expert resume coach and career advisor.
        Use this style:
        - Direct answer first
        - Clear sections with emojis when useful
        - Actionable flat bullets
        - Confidence line
        - End with "WHAT YOU MIGHT BE MISSING" and 3 bullets
        Stay encouraging, conversational, and forward-thinking.
        Avoid fake resume facts.
        """

    prompt = f"""
    You are Resumetric AI, an expert resume coach and career advisor built into a resume analysis platform.
    Your voice is encouraging, conversational, forward-thinking, and direct.
    Get straight to the point. Use affirmative sentences. Be enthusiastic about the user's potential.
    Point out knowledge gaps proactively.

    Page: {page}
    User question: {question}
    Interpreted intent: {normalized_intent}

    Resume context:
    {resume_context[:5000]}

    Job description:
    {job_description[:3000]}

    Current analysis summary:
    {analysis_summary[:3000]}

    Requirements:
    - Answer only about resumes, job descriptions, ATS scoring, interview prep, resume editing, keyword gaps, career guidance, and this app's analysis.
    - Give a direct answer in the first 2-3 sentences.
    - Use specific details from the provided context when available.
    - If context is missing, say exactly what is missing and give the safest next step.
    - Do not invent resume facts, employers, dates, scores, or achievements.
    - Include a confidence line inside the answer text.
    - If the user is asking whether something is correct, or asking for evaluation, include a realistic answer_correctness_percentage.

    Intent-specific instructions:
    {intent_instructions}
    """

    parsed = gemini_parse(
        messages=[
            {"role": "system", "content": "You are Resumetric AI, a high-signal resume coach and career advisor embedded inside Resumetric. Return only valid JSON matching the schema."},
            {"role": "user", "content": prompt}
        ],
        response_model=SiteAssistantResponse,
        temperature=0.2
    )
    return parsed.model_dump()
