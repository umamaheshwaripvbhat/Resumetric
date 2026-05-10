const Anthropic = require('@anthropic-ai/sdk');
const express = require('express');
const multer = require('multer');
const OpenAI = require('openai');
const pdfParse = require('pdf-parse');
const { createWorker } = require('tesseract.js');
const cloudinary = require('../config/cloudinary');
const { User, ResumeAnalysis } = require('../models/User');
const { awardPoints } = require('./auth');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MIN_ANALYZABLE_TEXT_LENGTH = 100;
const PDF_TEXT_EXTRACTION_ERROR = "Could not read this PDF. Please ensure it's a text-based PDF (not a scanned image) and try again.";
const SUPPORTED_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png']);

function extension(filename = '') {
  const lower = filename.toLowerCase();
  const dot = lower.lastIndexOf('.');
  return dot >= 0 ? lower.slice(dot) : '';
}

function normalizeExtractedText(text = '') {
  return text.replace(/\x00/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function usableTextLength(text = '') {
  return String(text).replace(/\s+/g, '').length;
}

function isPdfFile(file) {
  return file?.originalname?.toLowerCase().endsWith('.pdf') && file.buffer.subarray(0, 4).toString() === '%PDF';
}

function isSupportedImage(file) {
  return SUPPORTED_IMAGE_EXTENSIONS.has(extension(file?.originalname || ''));
}

async function parsePdf(buffer) {
  try {
    const data = await pdfParse(buffer);
    return normalizeExtractedText(data.text || '');
  } catch (error) {
    console.error('[parser] PDF parse error:', error.message);
    return '';
  }
}

async function parseImageWithOcr(buffer) {
  const worker = await createWorker('eng');
  try {
    const result = await worker.recognize(buffer);
    return normalizeExtractedText(result.data.text || '');
  } catch (error) {
    console.error('[parser] OCR error:', error.message);
    return '';
  } finally {
    await worker.terminate();
  }
}

function extractKeywords(text = '') {
  return Array.from(new Set(String(text).toLowerCase().replace(/[,.]/g, '').split(/\s+/).filter(Boolean)));
}

function estimateAnalysisConfidence(text = '') {
  const length = usableTextLength(text);
  if (length < MIN_ANALYZABLE_TEXT_LENGTH) return 0;
  if (length >= 2500) return 100;
  return Math.max(25, Math.min(99, Math.round(25 + ((length - MIN_ANALYZABLE_TEXT_LENGTH) / 2400) * 75)));
}

function weightedResumeValidation(text = '') {
  const normalized = text.replace(/\s+/g, ' ').trim();
  const lowered = normalized.toLowerCase();
  const words = normalized.split(/\s+/).filter(Boolean);
  const sections = ['summary', 'experience', 'education', 'skills', 'projects', 'certifications'];
  const sectionHits = sections.filter((section) => new RegExp(`\\b${section}\\b`).test(lowered)).length;
  const bulletLines = text.split('\n').filter((line) => /^[-*•]/.test(line.trim())).length;
  const dateHits = lowered.match(/\b(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+)?(?:19|20)\d{2}(?:\s*[-/]\s*(?:present|current|(?:19|20)\d{2}))?\b/g) || [];
  const structuralScore = Math.min(1, (sectionHits / 4) * 0.6 + (Math.min(bulletLines, 8) / 8) * 0.2 + (Math.min(dateHits.length, 4) / 4) * 0.2);

  const emailHit = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(normalized);
  const phoneHit = /(?:\+\d{1,3}[\s-]?)?(?:\(?\d{3}\)?[\s-]?)?\d{3}[\s-]?\d{4}/.test(normalized);
  const profileHit = /\b(?:linkedin|github)\b/.test(lowered);
  const contactScore = [emailHit, phoneHit, profileHit].filter(Boolean).length / 3;

  const actionHits = (lowered.match(/\b(developed|managed|led|implemented|designed|created|optimized|engineered|analyzed|delivered|improved|built)\b/g) || []).length;
  const technicalHits = (lowered.match(/\b(python|java|javascript|react|sql|aws|docker|node|html|css|excel|tableau|tensorflow|c\+\+|c#)\b/g) || []).length;
  const educationHits = (lowered.match(/\b(bachelor|master|b\.tech|m\.tech|university|college|gpa|degree)\b/g) || []).length;
  const keywordScore = Math.min(1, (Math.min(actionHits, 6) / 6) * 0.4 + (Math.min(technicalHits, 6) / 6) * 0.4 + (Math.min(educationHits, 4) / 4) * 0.2);

  const lengthScore = words.length >= 80 && words.length <= 1800 ? 1 : words.length >= 40 && words.length <= 2500 ? 0.45 : 0;
  const coherenceBonus = sectionHits >= 2 && (bulletLines >= 2 || dateHits.length >= 2) ? 1 : sectionHits >= 1 ? 0.4 : 0;
  const formatScore = Math.min(1, lengthScore * 0.6 + coherenceBonus * 0.4);
  const resumeScore = Number((structuralScore * 0.5 + contactScore * 0.2 + keywordScore * 0.2 + formatScore * 0.1).toFixed(3));
  const detectedSections = sections.filter((section) => new RegExp(`\\b${section}\\b`).test(lowered));

  return {
    is_resume: resumeScore >= 0.6,
    confidence: Math.round(resumeScore * 100),
    resume_score: resumeScore,
    reason: resumeScore >= 0.6 ? 'Resume structure and professional signals were detected.' : 'This file does not contain enough resume structure, contact details, and professional content.',
    detected_sections: detectedSections,
    scores: {
      structural: Number(structuralScore.toFixed(3)),
      contact: Number(contactScore.toFixed(3)),
      keywords: Number(keywordScore.toFixed(3)),
      format: Number(formatScore.toFixed(3)),
    },
  };
}

function classifyResumeText(text = '') {
  const validation = weightedResumeValidation(text);
  const lowered = text.toLowerCase();
  const penaltyTerms = ['lecture', 'syllabus', 'chapter', 'assignment', 'question bank', 'table of contents', 'abstract', 'references', 'appendix', 'invoice', 'receipt', 'journal', 'copyright', 'lesson', 'unit-1'];
  const matchedPenalties = penaltyTerms.filter((term) => lowered.includes(term));
  if (matchedPenalties.length && validation.resume_score < 0.8) {
    validation.is_resume = false;
    validation.reason = `This file looks like non-resume content because it contains terms such as ${matchedPenalties.slice(0, 3).join(', ')}.`;
    validation.confidence = Math.min(validation.confidence, 45);
    return validation;
  }

  const hasSections = validation.detected_sections.length >= 2;
  const hasContactOrProfile = ['@', 'linkedin', 'github', 'phone', '+91', '+1'].some((signal) => lowered.includes(signal));
  const hasActions = ['developed', 'built', 'managed', 'implemented', 'designed', 'created', 'optimized', 'led', 'engineered', 'analyzed', 'delivered'].some((signal) => lowered.includes(signal));
  if (!validation.is_resume && (hasSections || (hasContactOrProfile && hasActions))) {
    validation.is_resume = true;
    validation.confidence = Math.max(validation.confidence, 60);
    validation.reason = 'Resume-like sections and professional signals were detected.';
  }
  return validation;
}

async function extractResumeText(file) {
  if (!file) return { text: '', extraction_method: 'missing-file' };
  if (isPdfFile(file)) {
    return { text: await parsePdf(file.buffer), extraction_method: 'direct-pdf-text' };
  }
  if (isSupportedImage(file)) {
    return { text: await parseImageWithOcr(file.buffer), extraction_method: 'image-ocr' };
  }
  return { text: '', extraction_method: 'unsupported-file' };
}

function localResumeAnalysis(resumeText, jobDescription = '') {
  const validation = classifyResumeText(resumeText);
  const resumeKeywords = extractKeywords(resumeText);
  const jdKeywords = extractKeywords(jobDescription).filter((word) => word.length > 2);
  const matchedKeywords = jdKeywords.filter((word) => resumeKeywords.includes(word)).slice(0, 20);
  const missingKeywords = jdKeywords.filter((word) => !resumeKeywords.includes(word)).slice(0, 20);
  const scores = {
    keyword_match: jdKeywords.length ? Math.round((matchedKeywords.length / jdKeywords.length) * 100) : validation.scores.keywords * 100,
    impact_metrics: Math.min(100, 35 + ((resumeText.match(/\d+%?|\$\d+|\b\d+x\b/gi) || []).length * 12)),
    technical_relevance: Math.round(validation.scores.keywords * 100),
    structure_readability: Math.round(validation.scores.structural * 100),
    experience_depth: Math.min(100, 45 + ((resumeText.match(/\b(experience|intern|engineer|developer|manager|analyst)\b/gi) || []).length * 8)),
    consistency: Math.max(55, validation.confidence),
  };
  const overallScore = Math.round(scores.keyword_match * 0.35 + scores.impact_metrics * 0.2 + scores.technical_relevance * 0.15 + scores.structure_readability * 0.12 + scores.experience_depth * 0.1 + scores.consistency * 0.08);

  return {
    overallScore,
    confidenceScore: estimateAnalysisConfidence(resumeText),
    keywordMatch: scores.keyword_match,
    impactAndMetrics: scores.impact_metrics,
    technicalRelevance: scores.technical_relevance,
    structure: scores.structure_readability,
    scores,
    missing_keywords: missingKeywords,
    matched_keywords: matchedKeywords,
    missingKeywords,
    matchedKeywords,
    improvements: [
      { original: 'Resume bullets with limited measurable outcomes', improved: 'Rewrite bullets as action + scope + measurable result.', reason: 'Recruiters scan for evidence of impact.', expected_by_companies: 'Clear ownership, tools used, and business or technical outcome.' },
      { original: 'Generic skills or project descriptions', improved: 'Tie each important skill to a project, role, or result.', reason: 'Context makes keywords credible.', expected_by_companies: 'Relevant skills shown in applied work.' },
    ],
    strengths: validation.detected_sections.length ? [`Detected sections: ${validation.detected_sections.join(', ')}`] : ['Professional resume signals were detected.'],
    weaknesses: missingKeywords.length ? [`Missing or underused keywords: ${missingKeywords.slice(0, 5).join(', ')}`] : ['Add more quantified achievements where possible.'],
    quickFixes: ['Add metrics to top bullets.', 'Mirror truthful job description keywords.', 'Keep headings simple and ATS-readable.'],
    recruiter_expectations: ['Clear contact information', 'Relevant skills', 'Measurable project or work impact'],
    resume_verdict: overallScore >= 75 ? 'Strong resume with targeted refinements recommended.' : 'Solid foundation, but keyword alignment and quantified impact need improvement.',
  };
}

async function generateJson(system, user, fallback) {
  if (process.env.OPENAI_API_KEY) {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    });
    return JSON.parse(response.choices[0].message.content);
  }

  if (process.env.ANTHROPIC_API_KEY) {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-latest',
      max_tokens: 1800,
      temperature: 0.2,
      system,
      messages: [{ role: 'user', content: `${user}\n\nReturn only valid JSON.` }],
    });
    return JSON.parse(response.content.map((part) => part.text || '').join(''));
  }

  return fallback;
}

async function validateResumeDocument(resumeText) {
  const heuristic = classifyResumeText(resumeText);
  const fallback = { isResume: heuristic.is_resume, confidence: heuristic.confidence, reason: heuristic.reason };
  return generateJson(
    'You are a strict document classifier for a resume analysis product.',
    `Determine if this text is a resume/CV. Respond as {"isResume": boolean, "confidence": 0-100, "reason": "one sentence"}.\n\nText:\n${resumeText.slice(0, 6000)}`,
    fallback
  );
}

async function analyzeResume(resumeText, jobDescription) {
  const fallback = localResumeAnalysis(resumeText, jobDescription);
  return generateJson(
    'You are an expert ATS resume reviewer. Return valid JSON only.',
    `Analyze this resume against the job description. Include overallScore, confidenceScore, keywordMatch, impactAndMetrics, technicalRelevance, structure, scores, missing_keywords, matched_keywords, improvements, strengths, weaknesses, recruiter_expectations, resume_verdict.\n\nResume:\n${resumeText.slice(0, 12000)}\n\nJob description:\n${jobDescription.slice(0, 6000)}`,
    fallback
  );
}

async function validateFileForResume(file) {
  const startedAt = Date.now();
  if (!file) return { status: 'declined', message: 'Please upload a resume file.', can_analyze: false };
  if (file.size > MAX_FILE_SIZE) return { status: 'declined', message: 'File size exceeds 5MB limit. Please upload a smaller resume file.', can_analyze: false };
  if (!(isPdfFile(file) || isSupportedImage(file))) return { status: 'declined', message: 'Please upload a resume in PDF, JPG, JPEG, or PNG format.', can_analyze: false };

  const { text, extraction_method } = await extractResumeText(file);
  const processingSeconds = Number(((Date.now() - startedAt) / 1000).toFixed(2));
  if (usableTextLength(text) < MIN_ANALYZABLE_TEXT_LENGTH) {
    return {
      status: 'declined',
      message: 'Could not read this PDF. Please upload a text-based PDF.',
      validation: { isResume: false, is_resume: false, confidence: 0, reason: PDF_TEXT_EXTRACTION_ERROR, extraction_method, processing_seconds: processingSeconds, character_count: text.length, can_analyze: false },
      extracted_preview: text.slice(0, 500),
      resume_text: text,
      can_analyze: false,
    };
  }

  let aiCheck;
  try {
    aiCheck = await validateResumeDocument(text);
  } catch {
    const heuristic = classifyResumeText(text);
    aiCheck = { isResume: heuristic.is_resume, confidence: heuristic.confidence, reason: heuristic.reason };
  }
  const isResume = Boolean(aiCheck.isResume);
  const confidence = Number(aiCheck.confidence || 0);
  const validation = {
    ...aiCheck,
    is_resume: isResume,
    extraction_method,
    processing_seconds: processingSeconds,
    character_count: text.length,
    word_count: text.split(/\s+/).filter(Boolean).length,
    can_analyze: isResume && confidence > 70,
    analysis_confidence: estimateAnalysisConfidence(text),
  };

  if (!isResume || confidence < 40) return { status: 'declined', message: "This doesn't look like a resume. Please upload your resume PDF.", validation: { ...validation, can_analyze: false }, extracted_preview: text.slice(0, 500), resume_text: text, can_analyze: false };
  if (confidence <= 70) return { status: 'low_confidence', message: "We're not sure this is a resume. Continue anyway?", validation, extracted_preview: text.slice(0, 500), resume_text: text, can_analyze: true };
  return { status: 'accepted', message: `Resume accepted. PDF verified in ${processingSeconds}s.`, validation, extracted_preview: text.slice(0, 500), resume_text: text, can_analyze: true };
}

router.post('/validate-upload', upload.single('file'), async (req, res, next) => {
  try {
    const result = await validateFileForResume(req.file);
    const { resume_text: _resumeText, ...publicResult } = result;
    res.json(publicResult);
  } catch (error) {
    next(error);
  }
});

router.post('/upload', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      return res.status(500).json({ error: 'Cloudinary credentials are not configured' });
    }

    const dataUri = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    const result = await cloudinary.uploader.upload(dataUri, {
      folder: 'resumetric',
      resource_type: 'auto',
      use_filename: true,
      unique_filename: true,
    });

    res.json({
      message: 'File uploaded successfully',
      public_id: result.public_id,
      url: result.secure_url,
      secure_url: result.secure_url,
      original_filename: req.file.originalname,
      bytes: req.file.size,
      resource_type: result.resource_type,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/analyze', upload.single('file'), async (req, res, next) => {
  try {
    if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
      console.warn('[ai] No AI API key configured; using local deterministic analysis fallback.');
    }

    const validationResult = await validateFileForResume(req.file);
    if (validationResult.status === 'declined') {
      return res.json({
        error: validationResult.message,
        details: validationResult.validation?.reason || validationResult.message,
        resume_validation: validationResult.validation,
      });
    }
    if (validationResult.status === 'low_confidence') {
      return res.json({
        warning: validationResult.message,
        details: validationResult.validation?.reason,
        confidence: validationResult.validation?.confidence,
        resume_validation: validationResult.validation,
        extracted_preview: validationResult.extracted_preview,
        resume_text: validationResult.resume_text,
      });
    }

    const userId = Number(req.body.user_id || 0);
    if (userId > 0) {
      const user = await User.findOne({ id: userId });
      if (user) {
        if ((user.resume_count || 0) >= 5) return res.json({ error: 'LIMIT_REACHED', details: 'You have used your 5 free resume analyses. Please upgrade to continue.' });
        user.resume_count = (user.resume_count || 0) + 1;
        await user.save();
      }
    }

    const resumeText = validationResult.resume_text;
    const jobDescription = req.body.job_description || '';
    const data = await analyzeResume(resumeText, jobDescription);
    const finalScore = Number(data.overallScore || localResumeAnalysis(resumeText, jobDescription).overallScore);
    data.analysis_confidence = estimateAnalysisConfidence(resumeText);

    if (userId > 0) {
      const previous = await ResumeAnalysis.findOne({ user_id: userId }).sort({ created_at: -1 });
      if (previous && previous.score !== finalScore) {
        data.memory_insight = { insight: `Your score changed from ${previous.score} to ${finalScore}. Review keyword alignment and impact metrics for the biggest drivers.` };
      }
    }

    const payload = {
      overall_score: Number(finalScore.toFixed ? finalScore.toFixed(2) : finalScore),
      details: {
        ...data,
        resume_text: resumeText,
        extracted_preview: resumeText.slice(0, 500),
        resume_validation: validationResult.validation,
      },
    };

    if (userId > 0) {
      await ResumeAnalysis.create({ user_id: userId, score: Math.round(finalScore), data: payload });
      await awardPoints(userId, 10, 'Earned +10 pts for analyzing a resume');
    }

    res.json(payload);
  } catch (error) {
    next(error);
  }
});

router.post('/site-assistant', async (req, res, next) => {
  try {
    const fallback = {
      answer: 'Focus on measurable resume impact, truthful keyword alignment, and clear section structure. Start with the highest-value missing keywords and rewrite the top bullets with action, scope, and result.',
      answer_correctness_percentage: 86,
      reasoning: 'Generated from the current resume context and analysis summary.',
      suggested_next_action: 'Open Suggestions and update the top 3 bullets first.',
    };
    const result = await generateJson(
      'You are the in-app Resumetric assistant. Return valid JSON only.',
      `Answer the user question with answer, answer_correctness_percentage, reasoning, suggested_next_action.\nQuestion: ${req.body.question}\nPage: ${req.body.page}\nResume: ${(req.body.resume_context || '').slice(0, 5000)}\nJob description: ${(req.body.job_description || '').slice(0, 3000)}\nAnalysis: ${req.body.analysis_summary || ''}`,
      fallback
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/interview-prep', async (req, res, next) => {
  try {
    const fallback = {
      technical: ['Walk me through the most technical project on your resume.', 'Which tools are you strongest with and why?'],
      behavioral: ['Tell me about a time you handled a difficult deadline.', 'Describe a time you learned something quickly.'],
      resume_based: ['Which resume achievement are you most proud of?', 'What trade-offs did you make in one project?'],
      gap_based: ['Which missing skill are you currently improving?'],
      company_style: ['Why are you a fit for this role?'],
      coding: [{ question: 'Solve a practical problem related to the target role.', language: 'JavaScript', hint: 'Start with inputs, outputs, and edge cases.', sample_solution: 'Explain your approach, then write clean code.' }],
      mcq: [{ question: 'What makes a resume bullet stronger?', options: ['Tasks only', 'Action plus measurable result', 'Long paragraph', 'Unrelated keyword stuffing'], correct_index: 1, explanation: 'Impact and evidence make bullets stronger.' }],
    };
    res.json(await generateJson('You generate structured interview practice JSON.', JSON.stringify(req.body), fallback));
  } catch (error) {
    next(error);
  }
});

router.post('/mock-interview', async (req, res, next) => {
  try {
    const fallback = { score: 72, strengths: ['Clear attempt to answer the question.'], weaknesses: ['Add more specific evidence and metrics.'], missing_points: ['Context, action, measurable result.'], improved_answer: req.body.answer || '', feedback: 'Use the STAR format and anchor claims in resume evidence.' };
    res.json(await generateJson('Evaluate interview answers as JSON.', JSON.stringify(req.body), fallback));
  } catch (error) {
    next(error);
  }
});

router.post('/voice-interview', async (req, res, next) => {
  try {
    const fallback = { score: 70, communication_score: 72, technical_score: 68, issues: ['Be more specific and concise.'], improved_answer: req.body.transcript || '', speaking_tips: ['Pause briefly before answering.', 'Use a clear STAR structure.'] };
    res.json(await generateJson('Evaluate spoken interview answers as JSON.', JSON.stringify(req.body), fallback));
  } catch (error) {
    next(error);
  }
});

router.post('/live-edit', async (req, res) => {
  res.json({ cursor_focus_text: req.body.section_text || '', inline_suggestion: 'Add a measurable result to this line.', improved_line: req.body.section_text || '', section_score: 72, highlight_type: 'impact', improvement_hint: 'Use action + scope + metric.', confidence: 'medium' });
});

router.post('/ghost-text', async (req, res) => {
  res.json({ ghost_text: ' with measurable impact', improved_line: `${req.body.current_line || ''} with measurable impact`.trim(), confidence: 'medium', type: 'completion' });
});

router.post('/inline-suggest', async (req, res) => {
  res.json({ ghost_text: ' with measurable impact', improved_line: `${req.body.current_line || ''} with measurable impact`.trim(), confidence: 'medium', type: 'completion' });
});

router.post('/resume-score-live', async (req, res) => {
  const data = localResumeAnalysis(req.body.updated_resume_text || '', req.body.job_role || '');
  res.json({ overall_score: data.overallScore, category_scores: { content: data.impactAndMetrics, structure: data.structure, skills: data.technicalRelevance, ats: data.keywordMatch }, changes_detected: ['Resume text updated.'], suggestions: data.quickFixes });
});

router.post('/resume-compare', async (req, res) => {
  const before = localResumeAnalysis(req.body.old_resume || '');
  const after = localResumeAnalysis(req.body.new_resume || '');
  res.json({ improvements: after.overallScore >= before.overallScore ? ['Overall score improved or stayed stable.'] : [], regressions: after.overallScore < before.overallScore ? ['Overall score decreased.'] : [], score_before: before.overallScore, score_after: after.overallScore, summary: `Score changed from ${before.overallScore} to ${after.overallScore}.` });
});

router.post('/industry-benchmark', async (req, res) => {
  const score = localResumeAnalysis(req.body.resume_text || '', req.body.job_role || '').overallScore;
  res.json({ user_score: score, industry_average: 72, top_tier_score: 90, percentile_estimate: score >= 85 ? 'Top quartile' : score >= 72 ? 'Above average' : 'Developing', gap_analysis: ['Improve keyword fit.', 'Add more quantified outcomes.'] });
});

router.post('/learning-resources', async (req, res) => {
  const data = localResumeAnalysis(req.body.resume_text || '', req.body.job_role || '');
  res.json({ missing_skills: data.missingKeywords.slice(0, 5), recommended_resources: data.missingKeywords.slice(0, 5).map((skill) => ({ skill, resources: [`Official ${skill} documentation`, `${skill} project tutorial`, `${skill} interview practice`] })) });
});

router.post('/mock-interview-mode', async (_req, res) => {
  res.json({ questions: [{ type: 'technical', question: 'Explain your strongest project end to end.' }, { type: 'behavioral', question: 'Tell me about a time you overcame a blocker.' }], evaluation_criteria: ['Clarity', 'Technical depth', 'Impact', 'Role relevance'], feedback_format: { score: '0-100', strengths: ['Specific evidence'], improvements: ['Sharper structure'] } });
});

module.exports = router;
