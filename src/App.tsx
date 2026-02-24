/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  BookOpen, 
  FileText, 
  Headphones, 
  Trophy, 
  Calendar, 
  Upload, 
  Loader2, 
  ChevronRight, 
  Play, 
  Pause,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as pdfjs from 'pdfjs-dist';
import Markdown from 'react-markdown';
import { formatDistanceToNow, differenceInDays } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Lesson, QuizQuestion } from './types';
import { summarizeLesson, generateQuiz, generateAudio } from './services/gemini';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Initialize PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [view, setView] = useState<'dashboard' | 'summary' | 'quiz'>('dashboard');
  const [quiz, setQuiz] = useState<QuizQuestion[]>([]);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const examDate = new Date('2026-04-26');
  const daysToExam = differenceInDays(examDate, new Date());

  const activeLesson = lessons.find(l => l.id === activeLessonId);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const strings = content.items.map((item: any) => item.str);
        fullText += strings.join(' ') + '\n';
      }

      const summary = await summarizeLesson(fullText);
      
      const newLesson: Lesson = {
        id: Math.random().toString(36).substr(2, 9),
        title: file.name.replace('.pdf', ''),
        content: fullText,
        summary: summary || 'Özet çıkarılamadı.'
      };

      setLessons(prev => [...prev, newLesson]);
      setActiveLessonId(newLesson.id);
      setView('summary');
    } catch (error) {
      console.error('PDF Processing error:', error);
      alert('PDF işlenirken bir hata oluştu.');
    } finally {
      setIsProcessing(false);
    }
  };

  const startQuiz = async () => {
    if (!activeLesson) return;
    setIsProcessing(true);
    try {
      const questions = await generateQuiz(activeLesson.content);
      setQuiz(questions);
      setQuizIndex(0);
      setQuizScore(0);
      setQuizFinished(false);
      setSelectedAnswer(null);
      setView('quiz');
    } catch (error) {
      alert('Test oluşturulamadı.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAnswer = (index: number) => {
    if (selectedAnswer !== null) return;
    setSelectedAnswer(index);
    if (index === quiz[quizIndex].correctAnswer) {
      setQuizScore(prev => prev + 1);
    }
  };

  const nextQuestion = () => {
    if (quizIndex + 1 < quiz.length) {
      setQuizIndex(prev => prev + 1);
      setSelectedAnswer(null);
    } else {
      setQuizFinished(true);
    }
  };

  const toggleAudio = async () => {
    if (!activeLesson?.summary) return;

    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
    } else {
      if (!activeLesson.audioUrl) {
        setIsProcessing(true);
        const url = await generateAudio(activeLesson.summary);
        if (url) {
          const updatedLessons = lessons.map(l => 
            l.id === activeLesson.id ? { ...l, audioUrl: url } : l
          );
          setLessons(updatedLessons);
          playAudio(url);
        }
        setIsProcessing(false);
      } else {
        playAudio(activeLesson.audioUrl);
      }
    }
  };

  const playAudio = (url: string) => {
    if (!audioRef.current) {
      audioRef.current = new Audio(url);
      audioRef.current.onended = () => setIsPlaying(false);
    } else if (audioRef.current.src !== url) {
      audioRef.current.src = url;
    }
    audioRef.current.play();
    setIsPlaying(true);
  };

  return (
    <div className="flex h-screen bg-[#fdfcfb]">
      {/* Sidebar */}
      <aside className="w-72 border-r border-stone-200 flex flex-col p-6 bg-white">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 bg-stone-900 rounded-xl flex items-center justify-center text-white">
            <BookOpen size={20} />
          </div>
          <div>
            <h1 className="font-serif font-bold text-lg leading-tight">AUZEF Tarih</h1>
            <p className="text-xs text-stone-500 uppercase tracking-widest font-medium">Asistan Sistemi</p>
          </div>
        </div>

        <nav className="flex-1 space-y-2">
          <button 
            onClick={() => setView('dashboard')}
            className={cn("w-full sidebar-item", view === 'dashboard' ? "sidebar-item-active" : "sidebar-item-inactive")}
          >
            <Calendar size={18} />
            <span>Genel Bakış</span>
          </button>
          
          <div className="pt-6 pb-2">
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest px-4">Ders Kitaplarım</p>
          </div>

          <div className="space-y-1 overflow-y-auto max-h-[40vh]">
            {lessons.map(lesson => (
              <button
                key={lesson.id}
                onClick={() => {
                  setActiveLessonId(lesson.id);
                  setView('summary');
                }}
                className={cn(
                  "w-full sidebar-item text-sm truncate",
                  activeLessonId === lesson.id ? "bg-stone-100 text-stone-900" : "text-stone-500 hover:bg-stone-50"
                )}
              >
                <FileText size={16} />
                <span className="truncate">{lesson.title}</span>
              </button>
            ))}
            
            <label className="sidebar-item text-stone-500 hover:bg-stone-50 cursor-pointer border-2 border-dashed border-stone-100 mt-2">
              <Upload size={16} />
              <span className="text-sm">Yeni PDF Yükle</span>
              <input type="file" className="hidden" accept=".pdf" onChange={handleFileUpload} />
            </label>
          </div>
        </nav>

        <div className="mt-auto pt-6 border-t border-stone-100">
          <div className="bg-stone-50 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-stone-400 uppercase">Vize Sınavı</span>
              <span className="text-xs font-bold text-red-500">{daysToExam} Gün Kaldı</span>
            </div>
            <div className="w-full bg-stone-200 h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-stone-900 h-full transition-all duration-1000" 
                style={{ width: `${Math.max(0, Math.min(100, (1 - daysToExam / 60) * 100))}%` }}
              />
            </div>
            <p className="text-[10px] text-stone-500 mt-2 text-center">26 Nisan 2026</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative">
        <AnimatePresence mode="wait">
          {isProcessing && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-white/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center"
            >
              <Loader2 className="animate-spin text-stone-900 mb-4" size={40} />
              <p className="text-stone-600 font-medium italic">Akademik veriler işleniyor, lütfen bekleyin Oğuz...</p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="max-w-4xl mx-auto p-12">
          {view === 'dashboard' && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-10"
            >
              <header>
                <h2 className="text-4xl font-serif font-bold mb-2">Merhaba Oğuz,</h2>
                <p className="text-stone-500 text-lg">Bugün hangi dersimize odaklanıyoruz?</p>
              </header>

              <div className="grid grid-cols-2 gap-6">
                <div className="academic-card p-8 flex flex-col justify-between h-64 bg-stone-900 text-white border-none">
                  <div>
                    <Calendar className="mb-4 opacity-50" size={32} />
                    <h3 className="text-2xl font-serif font-bold mb-2">Sınav Geri Sayımı</h3>
                    <p className="text-stone-400 text-sm">Vize sınavına hazırlanmak için hala vaktimiz var. Kritik tarihlere odaklanmalıyız.</p>
                  </div>
                  <div className="text-4xl font-serif font-bold">{daysToExam} Gün</div>
                </div>

                <div className="academic-card p-8 flex flex-col justify-between h-64">
                  <div>
                    <Trophy className="mb-4 text-stone-400" size={32} />
                    <h3 className="text-2xl font-serif font-bold mb-2">Çalışma İstatistiği</h3>
                    <p className="text-stone-500 text-sm">Şu ana kadar {lessons.length} ders kitabı sisteme yüklendi.</p>
                  </div>
                  <div className="flex items-center gap-2 text-stone-900 font-bold">
                    Başarı Oranı: %0 <ChevronRight size={16} />
                  </div>
                </div>
              </div>

              <section>
                <h3 className="text-xl font-serif font-bold mb-6 flex items-center gap-2">
                  <Clock size={20} className="text-stone-400" />
                  Son Çalışmalar
                </h3>
                <div className="space-y-4">
                  {lessons.length === 0 ? (
                    <div className="text-center py-20 border-2 border-dashed border-stone-100 rounded-3xl">
                      <p className="text-stone-400 italic">Henüz bir ders notu yüklemediniz.</p>
                    </div>
                  ) : (
                    lessons.slice(-3).reverse().map(lesson => (
                      <div key={lesson.id} className="academic-card p-6 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-stone-50 rounded-xl flex items-center justify-center text-stone-400">
                            <FileText size={20} />
                          </div>
                          <div>
                            <h4 className="font-bold">{lesson.title}</h4>
                            <p className="text-xs text-stone-400">Son güncelleme: Bugün</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => {
                            setActiveLessonId(lesson.id);
                            setView('summary');
                          }}
                          className="px-4 py-2 bg-stone-100 hover:bg-stone-200 rounded-lg text-sm font-bold transition-colors"
                        >
                          Devam Et
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </motion.div>
          )}

          {view === 'summary' && activeLesson && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between">
                <button 
                  onClick={() => setView('dashboard')}
                  className="text-stone-400 hover:text-stone-900 flex items-center gap-2 text-sm font-medium"
                >
                  <ChevronRight className="rotate-180" size={16} />
                  Geri Dön
                </button>
                <div className="flex gap-2">
                  <button 
                    onClick={toggleAudio}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all",
                      isPlaying ? "bg-red-50 text-red-600" : "bg-stone-900 text-white"
                    )}
                  >
                    {isPlaying ? <Pause size={16} /> : <Headphones size={16} />}
                    {isPlaying ? "Durdur" : "Sesli Dinle"}
                  </button>
                  <button 
                    onClick={startQuiz}
                    className="flex items-center gap-2 px-4 py-2 bg-stone-100 hover:bg-stone-200 rounded-xl text-sm font-bold transition-all"
                  >
                    <Trophy size={16} />
                    Test Çöz
                  </button>
                </div>
              </div>

              <header>
                <h2 className="text-3xl font-serif font-bold mb-2">{activeLesson.title}</h2>
                <div className="flex items-center gap-4 text-stone-400 text-sm">
                  <span className="flex items-center gap-1"><Clock size={14} /> 5 dk okuma</span>
                  <span className="flex items-center gap-1"><FileText size={14} /> Akademik Özet</span>
                </div>
              </header>

              <div className="academic-card p-10 bg-white min-h-[60vh]">
                <div className="markdown-body">
                  <Markdown>{activeLesson.summary}</Markdown>
                </div>
              </div>
            </motion.div>
          )}

          {view === 'quiz' && quiz.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-8"
            >
              {!quizFinished ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-stone-400 uppercase tracking-widest">Soru {quizIndex + 1} / {quiz.length}</span>
                    <div className="w-32 h-2 bg-stone-100 rounded-full overflow-hidden">
                      <div 
                        className="bg-stone-900 h-full transition-all" 
                        style={{ width: `${((quizIndex + 1) / quiz.length) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div className="academic-card p-10">
                    <h3 className="text-2xl font-serif font-bold mb-8 leading-snug">
                      {quiz[quizIndex].question}
                    </h3>

                    <div className="space-y-4">
                      {quiz[quizIndex].options.map((option, idx) => {
                        const isCorrect = idx === quiz[quizIndex].correctAnswer;
                        const isSelected = selectedAnswer === idx;
                        
                        return (
                          <button
                            key={idx}
                            onClick={() => handleAnswer(idx)}
                            disabled={selectedAnswer !== null}
                            className={cn(
                              "w-full p-5 rounded-2xl text-left border-2 transition-all flex items-center justify-between",
                              selectedAnswer === null 
                                ? "border-stone-100 hover:border-stone-900 hover:bg-stone-50" 
                                : isCorrect 
                                  ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                                  : isSelected
                                    ? "border-red-500 bg-red-50 text-red-900"
                                    : "border-stone-100 opacity-50"
                            )}
                          >
                            <span className="font-medium">{option}</span>
                            {selectedAnswer !== null && isCorrect && <CheckCircle2 className="text-emerald-500" size={20} />}
                            {selectedAnswer !== null && isSelected && !isCorrect && <XCircle className="text-red-500" size={20} />}
                          </button>
                        );
                      })}
                    </div>

                    <AnimatePresence>
                      {selectedAnswer !== null && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="mt-8 p-6 bg-stone-50 rounded-2xl border border-stone-100"
                        >
                          <div className="flex items-start gap-3">
                            <AlertCircle className="text-stone-400 shrink-0 mt-1" size={18} />
                            <div>
                              <p className="text-sm font-bold text-stone-900 mb-1">Akademik Açıklama:</p>
                              <p className="text-sm text-stone-600 leading-relaxed italic">{quiz[quizIndex].explanation}</p>
                            </div>
                          </div>
                          <button 
                            onClick={nextQuestion}
                            className="w-full mt-6 py-3 bg-stone-900 text-white rounded-xl font-bold hover:bg-stone-800 transition-colors"
                          >
                            {quizIndex + 1 === quiz.length ? "Testi Bitir" : "Sonraki Soru"}
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </>
              ) : (
                <div className="text-center py-20 space-y-6">
                  <div className="w-24 h-24 bg-stone-900 text-white rounded-full flex items-center justify-center mx-auto mb-8">
                    <Trophy size={40} />
                  </div>
                  <h2 className="text-4xl font-serif font-bold">Test Tamamlandı!</h2>
                  <p className="text-stone-500 text-lg">Oğuz, bu konudaki başarı skorun:</p>
                  <div className="text-6xl font-serif font-bold text-stone-900">
                    {quizScore} / {quiz.length}
                  </div>
                  <div className="pt-10 flex gap-4 justify-center">
                    <button 
                      onClick={() => setView('summary')}
                      className="px-8 py-3 bg-stone-100 hover:bg-stone-200 rounded-xl font-bold transition-all"
                    >
                      Özete Dön
                    </button>
                    <button 
                      onClick={startQuiz}
                      className="px-8 py-3 bg-stone-900 text-white hover:bg-stone-800 rounded-xl font-bold transition-all"
                    >
                      Tekrar Çöz
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
}
