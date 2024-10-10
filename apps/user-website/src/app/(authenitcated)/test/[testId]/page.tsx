"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useRouter, useParams } from "next/navigation";
import { useTheme } from "@/components/context/ThemeContext";
import TestResults from "@/src/components/TestResults/page";
import { toast } from 'sonner';

interface Question {
  id: string;
  question: string;
  choice: { id: string; text: string }[];
}

interface TestResult {
  totalQuestions: number;
  correctAnswers: number;
  score: number;
  correctAnswersIds: string[][];
  userAnswers: string[][];
}

export default function TestPage() {
  const router = useRouter();
  const params = useParams();
  const { isDarkTheme } = useTheme();
  const searchParams = useSearchParams();
  const category = searchParams.get("category");
  const questionCount = parseInt(searchParams.get("questionCount") || "20", 10);
  const [isTimed, setIsTimed] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedIndex = localStorage.getItem(`testProgress_${params.testId}_currentIndex`);
      return savedIndex ? parseInt(savedIndex, 10) : 0;
    }
    return 0;
  });
  const [selectedAnswers, setSelectedAnswers] = useState<{
    [key: string]: string[];
  }>(() => {
    if (typeof window !== 'undefined') {
      const savedAnswers = localStorage.getItem(`testProgress_${params.testId}_answers`);
      return savedAnswers ? JSON.parse(savedAnswers) : {};
    }
    return {};
  });
  const selectedAnswersRef = useRef<{ [key: string]: string[] }>({});
  const [duration, setDuration] = useState(0);
  const [showDialog, setShowDialog] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [remainingTime, setRemainingTime] = useState<number | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Update the ref whenever selectedAnswers changes
  useEffect(() => {
    selectedAnswersRef.current = selectedAnswers;
  }, [selectedAnswers]);

  const saveProgress = useCallback(() => {
    localStorage.setItem(`testProgress_${params.testId}_currentIndex`, currentQuestionIndex.toString());
    localStorage.setItem(`testProgress_${params.testId}_answers`, JSON.stringify(selectedAnswers));
  }, [currentQuestionIndex, selectedAnswers, params.testId]);

  useEffect(() => {
    saveProgress();
  }, [currentQuestionIndex, selectedAnswers, saveProgress]);

  const handleSubmit = async (forcedSubmit = false) => {
    if (!forcedSubmit) {
      setShowConfirmDialog(true);
      return;
    }

    setShowConfirmDialog(false);
    setIsSubmitting(true);

    const submitPromise = async () => {
      // Use the ref to get the latest answers
      const currentSelectedAnswers = selectedAnswersRef.current;
      
      const answersToSubmit = questions.map(question => 
        currentSelectedAnswers[question.id] || []
      );

      const response = await fetch(`/api/test/${params.testId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userAnswers: answersToSubmit,
        }),
      });
      const data = await response.json();
      if (data.err) {
        throw new Error(data.msg);
      }
      return data.data;
    };

    toast.promise(submitPromise, {
      loading: 'Submitting test...',
      success: (data) => {
        setTestResult(data);
        setShowDialog(true);
        setIsSubmitting(false);
        
        // Remove test progress from local storage
        localStorage.removeItem(`testProgress_${params.testId}_currentIndex`);
        localStorage.removeItem(`testProgress_${params.testId}_answers`);
        
        return 'Test submitted successfully!';
      },
      error: (err) => {
        console.error("Failed to submit test:", err);
        setIsSubmitting(false);
        return 'Failed to submit test. Please try again.';
      },
    });
  };

  const confirmSubmit = () => {
    setShowConfirmDialog(false);
    handleSubmit(true);
  };

  const cancelSubmit = () => {
    setShowConfirmDialog(false);
  };

  useEffect(() => {
    const fetchQuestions = async () => {
      const fetchPromise = async () => {
        const response = await fetch(`/api/test/${params.testId}`);
        const data = await response.json();
        if (data.err) {
          throw new Error(data.msg);
        }
        if (data.data.isCompleted) {
          router.push(`/test/${params.testId}/results`);
          throw new Error('Test already completed');
        }
        return data.data;
      };

      toast.promise(fetchPromise, {
        loading: 'Fetching questions...',
        success: (data) => {
          setQuestions(data.questions);
          setIsTimed(data.isTimed);
          
          if (data.isTimed) {
            const createdAt = new Date(data.createdAt).getTime();
            const currentTime = Date.now();
            const elapsedSeconds = Math.floor((currentTime - createdAt) / 1000);
            const remainingSeconds = Math.max(data.duration - elapsedSeconds, 0);
            
            setRemainingTime(remainingSeconds);
          }
          
          return 'Questions loaded successfully';
        },
        error: (err) => {
          console.error("Failed to fetch questions:", err);
          return 'Failed to fetch questions';
        },
      });

      try {
        await fetchPromise();
      } catch (error) {
        // Error is handled by toast.promise, no need for additional handling here
      } finally {
        setIsLoading(false);
      }
    };

    fetchQuestions();
  }, [params.testId, router]);

  useEffect(() => {
    if (isTimed && remainingTime !== null) {
      const timer = setInterval(() => {
        setRemainingTime((prevTime) => {
          if (prevTime !== null && prevTime <= 1) {
            clearInterval(timer);
            handleSubmit(true); // Force submit when time is up
            return 0;
          }
          return prevTime === null ? null : prevTime - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [isTimed, remainingTime]);

  const handleAnswerSelect = (questionId: string, answerId: string) => {
    setSelectedAnswers((prev) => {
      const currentAnswers = prev[questionId] || [];
      const updatedAnswers = currentAnswers.includes(answerId)
        ? currentAnswers.filter((id) => id !== answerId)
        : [...currentAnswers, answerId];
      const newState = { ...prev, [questionId]: updatedAnswers };
      selectedAnswersRef.current = newState;
      return newState;
    });
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    } else {
      handleSubmit();
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
    }
  };

  const handleSkipQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    }
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
  };

  const isAnswerSelected = (questionId: string) => {
    return selectedAnswers[questionId] && selectedAnswers[questionId].length > 0;
  };

  if (isLoading || questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900 dark:border-gray-100"></div>
        <div className="text-center mt-4 text-xl font-semibold">Loading questions...</div>
      </div>
    );
  }

  const handleCloseDialog = () => {
    setShowDialog(false);
    
    toast.promise(
      new Promise((resolve) => {
        router.push(`/test/${params.testId}/results`);
        // Simulate a delay to show the loading state
        setTimeout(resolve, 1000);
      }),
      {
        loading: 'Loading results...',
        success: 'Results loaded successfully',
        error: 'Failed to load results',
      }
    );

    // Remove test progress from local storage
    localStorage.removeItem(`testProgress_${params.testId}_currentIndex`);
    localStorage.removeItem(`testProgress_${params.testId}_answers`);
  };

  if (questions.length === 0) {
    return <div className="text-center mt-8">Loading questions...</div>;
  }

  const currentQuestion = questions[currentQuestionIndex];

  const isLastQuestion = () => currentQuestionIndex === questions.length - 1;

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl bg-white dark:bg-gray-900 text-black dark:text-white">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-center">
          {category || "General"} Test
        </h1>
        <button
          className="bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors duration-200"
          onClick={() => handleSubmit()}
        >
          Complete Test
        </button>
      </div>
      
      {isTimed && remainingTime !== null && (
        <div className="text-xl font-semibold mb-6 text-center bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-100 p-3 rounded-lg">
          Time Remaining: {formatTime(remainingTime)}
        </div>
      )}
      {/* Progress bar */}
      <div className="mb-6 bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
        <div
          className="bg-blue-600 h-2.5 rounded-full"
          style={{
            width: `${((currentQuestionIndex + 1) / questions.length) * 100}%`,
          }}
        ></div>
      </div>
      <div className="bg-gray-100 dark:bg-gray-800 shadow-lg rounded-lg p-6 mb-8">
        <h2 className="text-2xl font-semibold mb-4">
          Question {currentQuestionIndex + 1} of {questions.length}
        </h2>
        <div className="mb-6 p-4 bg-white dark:bg-gray-700 rounded-lg shadow-inner">
          <p className="text-lg text-gray-700 dark:text-gray-200 whitespace-pre-wrap">
            {currentQuestion.question}
          </p>
        </div>
        <div className="space-y-3">
          {currentQuestion.choice.map((option, index) => (
            <button
              key={option.id}
              className={`w-full p-3 text-left border rounded-lg transition-colors duration-200 ${
                selectedAnswers[currentQuestion?.id]?.includes(option.id)
                  ? "bg-blue-600 text-white"
                  : "bg-white dark:bg-gray-700 text-gray-800 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
              onClick={() => handleAnswerSelect(currentQuestion.id, option.id)}
            >
              <span className="font-bold mr-2">{String.fromCharCode(65 + index)}.</span>
              {option.text}
              <span className="float-right">
                {selectedAnswers[currentQuestion?.id]?.includes(option.id) ? '✓' : '◯'}
              </span>
            </button>
          ))}
        </div>
      </div>
      
      {/* Navigation buttons */}
      <div className="flex justify-between items-center mb-4">
        <button
          className="bg-blue-600 text-white hover:bg-blue-700 px-6 py-2 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handlePreviousQuestion}
          disabled={currentQuestionIndex === 0}
        >
          Previous
        </button>
        <button
          className="bg-blue-600 text-white hover:bg-blue-700 px-6 py-2 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleSkipQuestion}
          disabled={isAnswerSelected(currentQuestion.id)}
        >
          Skip
        </button>
        <button
          className="bg-blue-600 text-white hover:bg-blue-700 px-6 py-2 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleNextQuestion}
          disabled={!isAnswerSelected(currentQuestion.id)}
        >
          {isLastQuestion() ? "Submit" : "Next"}
        </button>
      </div>
      
      {showDialog && testResult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-full relative">
            <button
              onClick={handleCloseDialog}
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h2 className="text-2xl font-bold mb-4">Test Submitted</h2>
            <p className="mb-2">Your test has been successfully submitted. Thank you!</p>
            <p className="mb-2">Total Questions: {testResult.totalQuestions}</p>
            <p className="mb-2">Correct Answers: {testResult.correctAnswers}</p>
            <p className="mb-4">Score: {testResult.score.toFixed(2)}%</p>
            <div className="text-center">
              <button
                onClick={handleCloseDialog}
                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 cursor-pointer font-medium"
              >
                View Results
              </button>
            </div>
          </div>
        </div>
      )}

      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-full">
            <h2 className="text-2xl font-bold mb-4">Confirm Submission</h2>
            <p className="mb-4">Are you sure you want to submit the test?</p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={cancelSubmit}
                className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400 transition-colors duration-200"
                disabled={isSubmitting}
              >
                No, continue test
              </button>
              <button
                onClick={() => handleSubmit(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors duration-200"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Submitting...' : 'Yes, submit test'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isSubmitting && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg flex flex-col items-center">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
            <p className="mt-4 text-lg font-semibold">Submitting test...</p>
          </div>
        </div>
      )}
    </div>
  );
}