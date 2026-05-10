import React, { createContext, useContext, useState, useCallback } from 'react';
import { apiFetch } from '../config/api';

// ──────────────────────────────────────────────
// Strict TypeScript interfaces (API Contract)
// ──────────────────────────────────────────────

export interface AnalysisScores {
  keyword_match: number;
  impact_metrics: number;
  technical_relevance: number;
  structure?: number;
  structure_readability?: number;
  experience_depth?: number;
  consistency?: number;
}

export interface ResumeImprovement {
  original: string;
  improved: string;
  reason?: string;
  expected_by_companies?: string;
}

export interface AnalysisResult {
  overall_score: number;
  details: {
    scores: AnalysisScores;
    matched_keywords: string[];
    missing_keywords: string[];
    improvements: Array<string | ResumeImprovement>;
    strengths?: string[];
    weaknesses?: string[];
    recruiter_expectations?: string[];
    resume_verdict?: string;
    resume_text?: string;
    extracted_preview?: string;
    analysis_confidence: number;
    memory_insight?: string;
  };
}

export interface UserProfile {
  id: number;
  email: string;
  name: string;
  token: string;
  username?: string;
  profile_photo?: string;
  occupation?: string;
  college?: string;
  degree_field?: string;
  graduation_year?: string;
  looking_for?: string;
  company?: string;
  role?: string;
  experience?: string;
  industry?: string;
  open_to_opportunities?: string;
  interests?: string[];
  other_interest?: string;
  bio?: string;
  points?: number;
  reputation_level?: string;
  login_streak?: number;
}

export interface ResumeVersion {
  id: number;
  score: number;
  diff: number;
  date: string;
  data: AnalysisResult;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface UploadValidationState {
  status: 'idle' | 'validating' | 'accepted' | 'declined';
  message: string | null;
  processingSeconds?: number;
  canAnalyze?: boolean;
  extractedPreview?: string;
  extractedCharacterCount?: number;
  extractionMethod?: string;
}

function isSupportedResumeFile(file: File) {
  const name = file.name.toLowerCase();
  return name.endsWith('.pdf') || name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png');
}

// ──────────────────────────────────────────────
// Context Shape
// ──────────────────────────────────────────────

interface AppState {
  // Auth
  user: UserProfile | null;
  setUser: (u: UserProfile | null) => void;

  // Resume Upload
  file: File | null;
  setFile: (f: File | null) => void;
  
  // Job Description
  jobDesc: string;
  setJobDesc: (jd: string) => void;

  // Analysis
  analysisResult: AnalysisResult | null;
  setAnalysisResult: (r: AnalysisResult | null) => void;
  isAnalyzing: boolean;
  setIsAnalyzing: (v: boolean) => void;
  analysisError: string | null;
  uploadValidation: UploadValidationState;

  // History
  history: ResumeVersion[];
  setHistory: (h: ResumeVersion[]) => void;

  // Validation
  validate: () => ValidationError[];

  // Actions
  validateUpload: (file: File) => Promise<boolean>;
  submitAnalysis: () => Promise<AnalysisResult | null>;
  logout: () => void;
}

const AppContext = createContext<AppState>({} as AppState);

// ──────────────────────────────────────────────
// Validation Layer
// ──────────────────────────────────────────────

function validateInputs(
  file: File | null,
  jobDesc: string,
  user: UserProfile | null,
  uploadValidation: UploadValidationState
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!file) {
    errors.push({ field: 'file', message: 'Please upload your resume file.' });
  } else if (!isSupportedResumeFile(file)) {
    errors.push({ field: 'file', message: 'Accepted formats: PDF, JPG, JPEG, PNG.' });
  } else if (file.size > 5 * 1024 * 1024) {
    errors.push({ field: 'file', message: 'File size must be under 5MB.' });
  }

  if (file && uploadValidation.status === 'declined') {
    errors.push({ field: 'file', message: uploadValidation.message || 'This PDF was declined because it is not a resume.' });
  }

  if (file && uploadValidation.status !== 'accepted') {
    errors.push({ field: 'file', message: 'Please wait until the uploaded PDF is validated as a resume.' });
  }

  if (!jobDesc || jobDesc.trim().length < 10) {
    errors.push({ field: 'jobDesc', message: 'Job description must be at least 10 characters.' });
  }

  if (!user || !user.id) {
    errors.push({ field: 'user', message: 'You must be logged in.' });
  }

  return errors;
}

// ──────────────────────────────────────────────
// Provider
// ──────────────────────────────────────────────

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [jobDesc, setJobDesc] = useState('');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [uploadValidation, setUploadValidation] = useState<UploadValidationState>({ status: 'idle', message: null, canAnalyze: false });
  const [history, setHistory] = useState<ResumeVersion[]>([]);

  const validate = useCallback(() => {
    return validateInputs(file, jobDesc, user, uploadValidation);
  }, [file, jobDesc, user, uploadValidation]);

  const validateUpload = useCallback(async (selectedFile: File): Promise<boolean> => {
    setUploadValidation({
      status: 'validating',
      message: 'Reading PDF and checking whether it is a real resume...',
      canAnalyze: false,
      extractedPreview: '',
      extractedCharacterCount: 0,
      extractionMethod: 'pending',
    });
    setAnalysisError(null);

    const formData = new FormData();
    formData.append('file', selectedFile as any);

    try {
      const uploadFormData = new FormData();
      uploadFormData.append('file', selectedFile as any);

      const uploadRes = await fetch('http://localhost:5000/upload', {
        method: 'POST',
        body: uploadFormData,
      });

      const uploadData = await uploadRes.json();
      console.log(uploadData);

      const res = await apiFetch('/validate-upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || 'Upload validation failed.');
      }

      const processingSeconds = data?.validation?.processing_seconds;
      const extractedPreview = data?.extracted_preview || '';
      const extractedCharacterCount = data?.validation?.character_count ?? 0;
      const extractionMethod = data?.validation?.extraction_method || 'not-run';

      if (data?.status === 'accepted') {
        setUploadValidation({
          status: 'accepted',
          message: data?.message || 'Resume accepted.',
          processingSeconds,
          canAnalyze: data?.can_analyze !== false,
          extractedPreview,
          extractedCharacterCount,
          extractionMethod,
        });
        return true;
      }

      setUploadValidation({
        status: 'declined',
        message: data?.message || 'Resume declined.',
        processingSeconds,
        canAnalyze: false,
        extractedPreview,
        extractedCharacterCount,
        extractionMethod,
      });
      return false;
    } catch (e: any) {
      setUploadValidation({
        status: 'declined',
        message: e.message || 'Upload validation failed.',
        canAnalyze: false,
        extractedPreview: '',
        extractedCharacterCount: 0,
        extractionMethod: 'request-error',
      });
      return false;
    }
  }, []);

  const submitAnalysis = useCallback(async (): Promise<AnalysisResult | null> => {
    const errors = validateInputs(file, jobDesc, user, uploadValidation);
    if (errors.length > 0) {
      setAnalysisError(errors[0].message);
      return null;
    }

    setIsAnalyzing(true);
    setAnalysisError(null);

    const formData = new FormData();
    formData.append('file', file as any);
    formData.append('job_description', jobDesc);
    formData.append('user_id', String(user!.id));

    try {
      const res = await apiFetch('/analyze', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Server error ${res.status}: ${text}`);
      }

      const data: AnalysisResult = await res.json();

      if ((data as any)?.error) {
        const reason = (data as any)?.details ? `${(data as any).error}: ${(data as any).details}` : (data as any).error;
        throw new Error(reason);
      }

      if (!data || typeof data.overall_score !== 'number') {
        throw new Error('Invalid response format from server.');
      }

      setAnalysisResult(data);
      setIsAnalyzing(false);
      return data;
    } catch (e: any) {
      setAnalysisError(e.message || 'Analysis failed.');
      setIsAnalyzing(false);
      return null;
    }
  }, [file, jobDesc, user, uploadValidation]);

  const logout = useCallback(() => {
    setUser(null);
    setFile(null);
    setJobDesc('');
    setAnalysisResult(null);
    setHistory([]);
    setAnalysisError(null);
    setUploadValidation({ status: 'idle', message: null, canAnalyze: false });
  }, []);

  return (
    <AppContext.Provider value={{
      user, setUser,
      file, setFile,
      jobDesc, setJobDesc,
      analysisResult, setAnalysisResult,
      isAnalyzing, setIsAnalyzing,
      analysisError,
      uploadValidation,
      history, setHistory,
      validate,
      validateUpload,
      submitAnalysis,
      logout,
    }}>
      {children}
    </AppContext.Provider>
  );
}

// ──────────────────────────────────────────────
// Hook
// ──────────────────────────────────────────────

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx.setUser) {
    throw new Error('useApp must be used within <AppProvider>');
  }
  return ctx;
}
