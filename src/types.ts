export interface Lesson {
  id: string;
  title: string;
  content: string;
  summary?: string;
  audioUrl?: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

export interface AppState {
  lessons: Lesson[];
  activeLessonId: string | null;
  isProcessing: boolean;
  examDate: Date;
}
