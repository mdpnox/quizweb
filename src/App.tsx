import React, { useState, useEffect } from 'react';
import './App.css';

interface WordPair {
  id: string;
  word: string;
  meaning: string;
}

interface CardItem {
  id: string;      
  pairId: string;  
  text: string;    
  type: 'word' | 'meaning';
}

interface QuizQuestion {
  id: string;
  givenText: string;
  givenType: 'word' | 'meaning';
  correctAnswer: string;
  word: string;
  meaning: string;
}

interface StudentResult {
  id: string;
  studentName: string;
  gameModeTitle: string; 
  scoreText: string;
  accuracyPercent: number;
  timeFormatted: string;
  submittedAt: string;
  incorrectSummary?: string[];
}


function encodeData(data: any): string {
  try {
    const jsonStr = JSON.stringify(data);
    const bytes = new TextEncoder().encode(jsonStr);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  } catch (e) {
    return '';
  }
}


function decodeData(base64: string): any {
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const jsonStr = new TextDecoder().decode(bytes);
    return JSON.parse(jsonStr);
  } catch (e) {
    return null;
  }
}


function parseAcceptableAnswers(answerStr: string): string[] {
  return answerStr
    .split(/[/,;|\n]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
}

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const STORAGE_KEY_RESULTS = 'ezquiz_student_results_v1';

function App() {

  const [wordPairs, setWordPairs] = useState<WordPair[]>([]);


  const [newWord, setNewWord] = useState('');
  const [newMeaning, setNewMeaning] = useState('');


  const [gameMode, setGameMode] = useState<'input' | 'matching' | 'quiz' | 'finished'>('input');
  const [finishedMode, setFinishedMode] = useState<'matching' | 'quiz'>('matching');
  const [isStudentView, setIsStudentView] = useState(false);


  const [shareUrl, setShareUrl] = useState('');
  const [shareTitle, setShareTitle] = useState('');
  const [copied, setCopied] = useState(false);


  const [studentResults, setStudentResults] = useState<StudentResult[]>([]);
  const [pasteCode, setPasteCode] = useState('');
  const [showPasteBox, setShowPasteBox] = useState(false);


  const [studentNameInput, setStudentNameInput] = useState('');
  const [studentSubmitted, setStudentSubmitted] = useState(false);
  const [reportCode, setReportCode] = useState('');
  const [reportCopied, setReportCopied] = useState(false);


  const [wordCards, setWordCards] = useState<CardItem[]>([]);
  const [meaningCards, setMeaningCards] = useState<CardItem[]>([]);
  const [selectedWordCard, setSelectedWordCard] = useState<CardItem | null>(null);
  const [selectedMeaningCard, setSelectedMeaningCard] = useState<CardItem | null>(null);
  const [matchedPairIds, setMatchedPairIds] = useState<string[]>([]);
  const [wrongPair, setWrongPair] = useState<{ wordCardId: string; meaningCardId: string } | null>(null);
  const [matchingAttempts, setMatchingAttempts] = useState(0);
  const [matchingMistakes, setMatchingMistakes] = useState(0);
  const [matchingIncorrectList, setMatchingIncorrectList] = useState<{ word: string; wrongChosen: string; correctMeaning: string }[]>([]);


  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizIsCorrect, setQuizIsCorrect] = useState(false);
  const [quizScore, setQuizScore] = useState(0);
  const [incorrectQuizList, setIncorrectQuizList] = useState<{ question: QuizQuestion; userAnswer: string }[]>([]);


  const [timer, setTimer] = useState(0);


  const loadSavedResults = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_RESULTS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setStudentResults(parsed);
        }
      }
    } catch (e) {
      console.error('Error loading results', e);
    }
  };


  useEffect(() => {
    loadSavedResults();


    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY_RESULTS) {
        loadSavedResults();
      }
    };
    window.addEventListener('storage', handleStorage);

    const params = new URLSearchParams(window.location.search);
    const modeParam = params.get('mode');
    const dataParam = params.get('data');

    if (modeParam && dataParam) {
      const decodedPairs = decodeData(dataParam);
      if (Array.isArray(decodedPairs) && decodedPairs.length > 0) {
        setWordPairs(decodedPairs);
        setIsStudentView(true);

        if (modeParam === 'matching' && decodedPairs.length >= 2) {
          startMatchingGame(decodedPairs);
        } else if (modeParam === 'quiz') {
          startQuizGame(decodedPairs);
        }
      }
    }

    return () => {
      window.removeEventListener('storage', handleStorage);
    };
  }, []);


  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (gameMode === 'matching' || gameMode === 'quiz') {
      interval = setInterval(() => {
        setTimer((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [gameMode]);


  const handleAddPair = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWord.trim() || !newMeaning.trim()) return;

    const newPair: WordPair = {
      id: `pair-${Date.now()}-${Math.random()}`,
      word: newWord.trim(),
      meaning: newMeaning.trim(),
    };

    setWordPairs((prev) => [...prev, newPair]);
    setNewWord('');
    setNewMeaning('');
    setShareUrl('');
  };


  const handleDeletePair = (id: string) => {
    setWordPairs((prev) => prev.filter((item) => item.id !== id));
    setShareUrl('');
  };


  const handleGenerateShareLink = (mode: 'matching' | 'quiz') => {
    if (mode === 'matching' && wordPairs.length < 2) return;
    if (mode === 'quiz' && wordPairs.length < 1) return;

    const encoded = encodeData(wordPairs);
    const baseUrl = `${window.location.origin}${window.location.pathname}`;
    const generatedUrl = `${baseUrl}?mode=${mode}&data=${encodeURIComponent(encoded)}`;

    setShareUrl(generatedUrl);
    setShareTitle(mode === 'matching' ? 'Trò chơi Nối Từ' : 'Bài kiểm tra Điền Từ');
    setCopied(false);
  };

  const handleCopyLink = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };


  const startMatchingGame = (pairsList: WordPair[]) => {
    const words: CardItem[] = pairsList.map((pair) => ({
      id: `w-${pair.id}`,
      pairId: pair.id,
      text: pair.word,
      type: 'word',
    }));

    const meanings: CardItem[] = pairsList.map((pair) => ({
      id: `m-${pair.id}`,
      pairId: pair.id,
      text: pair.meaning,
      type: 'meaning',
    }));

    setWordCards(shuffleArray(words));
    setMeaningCards(shuffleArray(meanings));

    setSelectedWordCard(null);
    setSelectedMeaningCard(null);
    setMatchedPairIds([]);
    setWrongPair(null);
    setMatchingAttempts(0);
    setMatchingMistakes(0);
    setMatchingIncorrectList([]);
    setTimer(0);
    setStudentSubmitted(false);
    setStudentNameInput('');
    setReportCode('');

    setFinishedMode('matching');
    setGameMode('matching');
  };

  const handleStartMatching = () => {
    if (wordPairs.length < 2) return;
    startMatchingGame(wordPairs);
  };


  const handleCardClick = (card: CardItem) => {
    if (matchedPairIds.includes(card.pairId) || wrongPair !== null) return;

    if (card.type === 'word') {
      if (selectedWordCard?.id === card.id) {
        setSelectedWordCard(null);
        return;
      }
      setSelectedWordCard(card);
      if (selectedMeaningCard) {
        checkMatch(card, selectedMeaningCard);
      }
    } else {
      if (selectedMeaningCard?.id === card.id) {
        setSelectedMeaningCard(null);
        return;
      }
      setSelectedMeaningCard(card);
      if (selectedWordCard) {
        checkMatch(selectedWordCard, card);
      }
    }
  };


  const checkMatch = (wordCard: CardItem, meaningCard: CardItem) => {
    setMatchingAttempts((prev) => prev + 1);

    if (wordCard.pairId === meaningCard.pairId) {
      const newMatched = [...matchedPairIds, wordCard.pairId];
      setMatchedPairIds(newMatched);
      setSelectedWordCard(null);
      setSelectedMeaningCard(null);

      if (newMatched.length === wordPairs.length) {
        setTimeout(() => {
          setGameMode('finished');
        }, 500);
      }
    } else {
      setMatchingMistakes((prev) => prev + 1);
      setWrongPair({ wordCardId: wordCard.id, meaningCardId: meaningCard.id });


      const correctPair = wordPairs.find(p => p.id === wordCard.pairId);
      if (correctPair) {
        setMatchingIncorrectList((prev) => [
          ...prev,
          {
            word: wordCard.text,
            wrongChosen: meaningCard.text,
            correctMeaning: correctPair.meaning,
          },
        ]);
      }

      setTimeout(() => {
        setWrongPair(null);
        setSelectedWordCard(null);
        setSelectedMeaningCard(null);
      }, 700);
    }
  };


  const startQuizGame = (pairsList: WordPair[]) => {
    const questions: QuizQuestion[] = pairsList.map((pair) => {
      const isShowWord = Math.random() < 0.5;
      return {
        id: `q-${pair.id}`,
        givenText: isShowWord ? pair.word : pair.meaning,
        givenType: isShowWord ? 'word' : 'meaning',
        correctAnswer: isShowWord ? pair.meaning : pair.word,
        word: pair.word,
        meaning: pair.meaning,
      };
    });

    setQuizQuestions(shuffleArray(questions));
    setCurrentQuizIndex(0);
    setUserAnswer('');
    setQuizSubmitted(false);
    setQuizIsCorrect(false);
    setQuizScore(0);
    setIncorrectQuizList([]);
    setTimer(0);
    setStudentSubmitted(false);
    setStudentNameInput('');
    setReportCode('');

    setFinishedMode('quiz');
    setGameMode('quiz');
  };

  const handleStartQuiz = () => {
    if (wordPairs.length < 1) return;
    startQuizGame(wordPairs);
  };


  const handleQuizSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userAnswer.trim() || quizSubmitted) return;

    const currentQ = quizQuestions[currentQuizIndex];
    const normalizedUser = userAnswer.trim().toLowerCase();
    const acceptableAnswers = parseAcceptableAnswers(currentQ.correctAnswer);

    const isCorrect = acceptableAnswers.includes(normalizedUser);
    setQuizIsCorrect(isCorrect);
    setQuizSubmitted(true);

    if (isCorrect) {
      setQuizScore((prev) => prev + 1);
    } else {
      setIncorrectQuizList((prev) => [
        ...prev,
        { question: currentQ, userAnswer: userAnswer.trim() },
      ]);
    }
  };


  const handleNextQuizQuestion = () => {
    if (currentQuizIndex < quizQuestions.length - 1) {
      setCurrentQuizIndex((prev) => prev + 1);
      setUserAnswer('');
      setQuizSubmitted(false);
      setQuizIsCorrect(false);
    } else {
      setGameMode('finished');
    }
  };

  // Student Submits Result to Teacher
  const handleStudentSubmitResult = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentNameInput.trim()) return;

    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} - ${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;

    const modeTitle = finishedMode === 'matching' ? 'Nối từ' : 'Điền từ';
    const scoreStr = finishedMode === 'matching'
      ? `${wordPairs.length} cặp (Sai: ${matchingMistakes})`
      : `${quizScore}/${quizQuestions.length} câu`;

    const accuracy = finishedMode === 'matching'
      ? (matchingAttempts > 0 ? Math.round((wordPairs.length / matchingAttempts) * 100) : 100)
      : (quizQuestions.length > 0 ? Math.round((quizScore / quizQuestions.length) * 100) : 100);

    let incorrectDetailsList: string[] = [];
    if (finishedMode === 'quiz') {
      incorrectDetailsList = incorrectQuizList.map(
        (item) => `${item.question.givenText} ➔ Đúng: "${item.question.correctAnswer}" (Điền: "${item.userAnswer || 'bỏ trống'}")`
      );
    } else {
      incorrectDetailsList = matchingIncorrectList.map(
        (item) => `${item.word} ➔ Đúng: "${item.correctMeaning}" (Ghép nhầm: "${item.wrongChosen}")`
      );
    }

    const newResult: StudentResult = {
      id: `res-${Date.now()}-${Math.random()}`,
      studentName: studentNameInput.trim(),
      gameModeTitle: modeTitle,
      scoreText: scoreStr,
      accuracyPercent: accuracy,
      timeFormatted: formatTime(timer),
      submittedAt: timeStr,
      incorrectSummary: incorrectDetailsList,
    };


    try {
      const existing = JSON.parse(localStorage.getItem(STORAGE_KEY_RESULTS) || '[]');
      const updated = [newResult, ...existing];
      localStorage.setItem(STORAGE_KEY_RESULTS, JSON.stringify(updated));
      setStudentResults(updated);
      window.dispatchEvent(new Event('storage'));
    } catch (err) {
      console.error(err);
    }

  
    const reportCodeStr = `EZQ:${encodeData(newResult)}`;
    setReportCode(reportCodeStr);
    setStudentSubmitted(true);
  };


  const handleTeacherPasteResult = () => {
    if (!pasteCode.trim()) return;

    let targetCode = pasteCode.trim();
    if (targetCode.includes('EZQ:')) {
      targetCode = targetCode.split('EZQ:')[1].trim();
    }

    const decoded = decodeData(targetCode);
    if (decoded && decoded.studentName && decoded.scoreText) {
      const updated = [decoded, ...studentResults.filter(r => r.id !== decoded.id)];
      setStudentResults(updated);
      try {
        localStorage.setItem(STORAGE_KEY_RESULTS, JSON.stringify(updated));
      } catch (e) {}
      setPasteCode('');
      setShowPasteBox(false);
      alert(`✅ Đã thêm kết quả bài làm của học sinh: ${decoded.studentName}`);
    } else {
      alert('⚠️ Mã kết quả không hợp lệ. Vui lòng kiểm tra lại!');
    }
  };


  const handleClearResults = () => {
    if (window.confirm('Bạn có chắc chắn muốn xóa toàn bộ bảng kết quả của học sinh?')) {
      localStorage.removeItem(STORAGE_KEY_RESULTS);
      setStudentResults([]);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1>ezQuiz - Ôn Tập & Kiểm Tra Từ Vựng</h1>
        <p>Thêm từ vựng, tạo link làm bài và xem kết quả học sinh!</p>
        {isStudentView && (
          <div className="student-badge">
            🎓 Bạn đang ở trang làm bài dành cho Học Sinh
          </div>
        )}
      </header>

      {/* 1. INPUT MODE (FOR TEACHERS / USERS) */}
      {gameMode === 'input' && !isStudentView && (
        <div className="card-panel">
          <h2>1. Nhập danh sách từ vựng</h2>
          <form onSubmit={handleAddPair} className="input-group">
            <input
              type="text"
              className="input-field"
              placeholder="Từ/Cụm tiếng Anh..."
              value={newWord}
              onChange={(e) => setNewWord(e.target.value)}
            />
            <input
              type="text"
              className="input-field"
              placeholder="Nghĩa tiếng Việt..."
              value={newMeaning}
              onChange={(e) => setNewMeaning(e.target.value)}
            />
            <button type="submit" className="btn btn-primary">
              + Thêm từ
            </button>
          </form>
          <p style={{ margin: '-8px 0 16px 0', fontSize: '0.85rem', color: '#64748b' }}>
            💡 <em>Mẹo: Có thể nhập nhiều nghĩa từ đồng nghĩa ngăn cách bằng dấu <strong>/</strong> hoặc dấu phẩy (Ví dụ: <strong>Con mèo / Mèo</strong>).</em>
          </p>

          {/* Vocabulary List Display */}
          <div className="vocab-list-header" style={{ marginTop: '20px' }}>
            <h3>Danh sách đã thêm ({wordPairs.length} từ)</h3>
            {wordPairs.length > 0 && (
              <button
                className="btn btn-danger"
                style={{ fontSize: '0.85rem', padding: '6px 12px' }}
                onClick={() => setWordPairs([])}
              >
                Xóa tất cả
              </button>
            )}
          </div>

          {wordPairs.length === 0 ? (
            <p style={{ color: '#94a3b8', textAlign: 'center', margin: '20px 0' }}>
              Chưa có từ vựng nào. Hãy thêm từ vựng để bắt đầu!
            </p>
          ) : (
            <div className="vocab-list">
              {wordPairs.map((pair, idx) => (
                <div key={pair.id} className="vocab-item">
                  <div className="vocab-info">
                    <span style={{ color: '#94a3b8', width: '24px' }}>{idx + 1}.</span>
                    <span className="vocab-word">{pair.word}</span>
                    <span style={{ color: '#cbd5e1' }}>↔</span>
                    <span className="vocab-meaning">{pair.meaning}</span>
                  </div>
                  <button
                    className="btn btn-outline"
                    style={{ color: '#ef4444', borderColor: '#fca5a5', padding: '4px 8px' }}
                    onClick={() => handleDeletePair(pair.id)}
                  >
                    Xóa
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Action & Link Generator Buttons */}
          <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ margin: '0', fontSize: '1rem', color: '#334155' }}>2. Chọn hình thức bài làm:</h3>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button
                className="btn btn-success"
                style={{ flex: 1, minWidth: '220px' }}
                disabled={wordPairs.length < 2}
                onClick={handleStartMatching}
              >
                🧩 Chơi nối Từ
              </button>

              <button
                className="btn btn-outline"
                style={{ flex: 1, minWidth: '220px', borderColor: '#10b981', color: '#047857' }}
                disabled={wordPairs.length < 2}
                onClick={() => handleGenerateShareLink('matching')}
              >
                🔗 Tạo link nối từ gửi học sinh
              </button>
            </div>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button
                className="btn btn-purple"
                style={{ flex: 1, minWidth: '220px' }}
                disabled={wordPairs.length < 1}
                onClick={handleStartQuiz}
              >
                📝 Kiểm tra điền Từ
              </button>

              <button
                className="btn btn-outline"
                style={{ flex: 1, minWidth: '220px', borderColor: '#8b5cf6', color: '#6d28d9' }}
                disabled={wordPairs.length < 1}
                onClick={() => handleGenerateShareLink('quiz')}
              >
                🔗 Tạo link điền từ gửi học sinh
              </button>
            </div>
          </div>

          {/* Share Link Result Box */}
          {shareUrl && (
            <div className="share-box">
              <h4>🔗 Link bài làm độc lập cho Học Sinh ({shareTitle}):</h4>
              <div className="share-input-group">
                <input
                  type="text"
                  className="share-input"
                  value={shareUrl}
                  readOnly
                />
                <button className="btn btn-success" onClick={handleCopyLink}>
                  {copied ? '✅ Đã sao chép!' : '📋 Copy Link'}
                </button>
              </div>
            </div>
          )}

          {/* TEACHER DASHBOARD: STUDENT RESULTS TABLE */}
          <div className="results-dashboard">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <h3 style={{ margin: 0, color: '#1e293b' }}>
                📊 Bảng kết quả bài làm của Học Sinh ({studentResults.length})
              </h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn btn-outline"
                  style={{ fontSize: '0.85rem', padding: '6px 12px' }}
                  onClick={() => setShowPasteBox(!showPasteBox)}
                >
                  📥 Dán mã kết quả
                </button>
                {studentResults.length > 0 && (
                  <button
                    className="btn btn-outline"
                    style={{ fontSize: '0.85rem', padding: '6px 12px', color: '#ef4444', borderColor: '#fca5a5' }}
                    onClick={handleClearResults}
                  >
                    🗑️ Xóa bảng
                  </button>
                )}
              </div>
            </div>

            {/* Paste Code Box */}
            {showPasteBox && (
              <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '12px', marginTop: '12px' }}>
                <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: '#475569' }}>
                  Nếu học sinh nộp bằng mã báo cáo, dán mã vào đây:
                </p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    className="input-field"
                    style={{ fontSize: '0.85rem', padding: '8px 12px' }}
                    placeholder="Dán mã kết quả (EZQ:...)"
                    value={pasteCode}
                    onChange={(e) => setPasteCode(e.target.value)}
                  />
                  <button className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.85rem' }} onClick={handleTeacherPasteResult}>
                    Thêm
                  </button>
                </div>
              </div>
            )}

            {studentResults.length === 0 ? (
              <p style={{ color: '#94a3b8', textAlign: 'center', margin: '20px 0', fontSize: '0.95rem' }}>
                Chưa có kết quả nộp bài nào từ học sinh.
              </p>
            ) : (
              <div className="results-table-container">
                <table className="results-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Tên Học Sinh</th>
                      <th>Bài Làm</th>
                      <th>Kết Quả / Điểm</th>
                      <th>Độ Chính Xác</th>
                      <th>Thời Gian</th>
                      <th>Chi Tiết Câu Làm Sai</th>
                      <th>Thời Điểm Nộp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentResults.map((res, index) => (
                      <tr key={res.id || index}>
                        <td>{index + 1}</td>
                        <td style={{ fontWeight: '700', color: '#0f172a', whiteSpace: 'nowrap' }}>{res.studentName}</td>
                        <td>
                          <span className={`badge-mode ${res.gameModeTitle === 'Nối từ' ? 'matching' : 'quiz'}`}>
                            {res.gameModeTitle}
                          </span>
                        </td>
                        <td className="score-tag" style={{ whiteSpace: 'nowrap' }}>{res.scoreText}</td>
                        <td style={{ fontWeight: '600' }}>{res.accuracyPercent}%</td>
                        <td>{res.timeFormatted}</td>
                        <td style={{ maxWidth: '280px' }}>
                          {res.incorrectSummary && res.incorrectSummary.length > 0 ? (
                            <details style={{ cursor: 'pointer' }}>
                              <summary style={{ color: '#ef4444', fontWeight: '600', fontSize: '0.85rem' }}>
                                ⚠️ Sai {res.incorrectSummary.length} câu (Xem chi tiết)
                              </summary>
                              <ul style={{ margin: '6px 0 0 0', paddingLeft: '16px', fontSize: '0.8rem', color: '#9f1239' }}>
                                {res.incorrectSummary.map((item, i) => (
                                  <li key={i} style={{ marginBottom: '4px' }}>{item}</li>
                                ))}
                              </ul>
                            </details>
                          ) : (
                            <span style={{ color: '#059669', fontWeight: '600', fontSize: '0.85rem' }}>
                              ✅ Đúng 100%
                            </span>
                          )}
                        </td>
                        <td style={{ color: '#64748b', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{res.submittedAt}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. MATCHING GAME MODE */}
      {gameMode === 'matching' && (
        <div className="card-panel">
          {/* Stats Bar */}
          <div className="game-stats">
            <div className="stat-box">
              ⏱️ Thời gian: <span>{formatTime(timer)}</span>
            </div>
            <div className="stat-box">
              🎯 Đã nối: <span>{matchedPairIds.length} / {wordPairs.length}</span>
            </div>
            <div className="stat-box">
              ❌ Sai: <span>{matchingMistakes}</span>
            </div>
            {!isStudentView && (
              <button
                className="btn btn-outline"
                style={{ fontSize: '0.85rem', padding: '6px 12px' }}
                onClick={() => setGameMode('input')}
              >
                ⚙️ Sửa từ vựng
              </button>
            )}
          </div>

          {/* Game Cards Layout */}
          <div className="game-columns">
            {/* Left Column: English Words */}
            <div>
              <div className="column-title">Tiếng Anh</div>
              {wordCards.map((card) => {
                const isMatched = matchedPairIds.includes(card.pairId);
                const isSelected = selectedWordCard?.id === card.id;
                const isWrong = wrongPair?.wordCardId === card.id;

                let classNames = 'match-card';
                if (isMatched) classNames += ' matched';
                else if (isWrong) classNames += ' wrong';
                else if (isSelected) classNames += ' selected';

                return (
                  <div
                    key={card.id}
                    className={classNames}
                    onClick={() => handleCardClick(card)}
                  >
                    {card.text}
                  </div>
                );
              })}
            </div>

            {/* Right Column: Vietnamese Meanings */}
            <div>
              <div className="column-title">Nghĩa Tiếng Việt</div>
              {meaningCards.map((card) => {
                const isMatched = matchedPairIds.includes(card.pairId);
                const isSelected = selectedMeaningCard?.id === card.id;
                const isWrong = wrongPair?.meaningCardId === card.id;

                let classNames = 'match-card';
                if (isMatched) classNames += ' matched';
                else if (isWrong) classNames += ' wrong';
                else if (isSelected) classNames += ' selected';

                return (
                  <div
                    key={card.id}
                    className={classNames}
                    onClick={() => handleCardClick(card)}
                  >
                    {card.text}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 3. QUIZ MODE (FILL IN THE BLANK) */}
      {gameMode === 'quiz' && quizQuestions.length > 0 && (
        <div className="card-panel">
          {/* Header Stats */}
          <div className="game-stats">
            <div className="stat-box">
              ⏱️ Thời gian: <span>{formatTime(timer)}</span>
            </div>
            <div className="stat-box">
              📝 Câu: <span>{currentQuizIndex + 1} / {quizQuestions.length}</span>
            </div>
            <div className="stat-box">
              ⭐ Điểm: <span>{quizScore}</span>
            </div>
            {!isStudentView && (
              <button
                className="btn btn-outline"
                style={{ fontSize: '0.85rem', padding: '6px 12px' }}
                onClick={() => setGameMode('input')}
              >
                ⚙️ Thoát
              </button>
            )}
          </div>

          {/* Progress Bar */}
          <div className="progress-bar-container">
            <div
              className="progress-bar-fill"
              style={{
                width: `${((currentQuizIndex + 1) / quizQuestions.length) * 100}%`,
              }}
            />
          </div>

          {/* Quiz Question Card */}
          <div className="quiz-container">
            {quizQuestions[currentQuizIndex].givenType === 'word' ? (
              <div className="quiz-badge en">Từ Tiếng Anh</div>
            ) : (
              <div className="quiz-badge vi">Nghĩa Tiếng Việt</div>
            )}

            <div className="quiz-prompt-text">
              {quizQuestions[currentQuizIndex].givenText}
            </div>

            <div className="quiz-instruction">
              {quizQuestions[currentQuizIndex].givenType === 'word'
                ? 'Hãy điền Nghĩa Tiếng Việt tương ứng:'
                : 'Hãy điền Từ Tiếng Anh tương ứng:'}
            </div>

            <form onSubmit={handleQuizSubmit} className="quiz-form">
              <input
                type="text"
                className="quiz-input"
                placeholder="Nhập đáp án của bạn..."
                value={userAnswer}
                disabled={quizSubmitted}
                onChange={(e) => setUserAnswer(e.target.value)}
                autoFocus
              />

              {!quizSubmitted ? (
                <button
                  type="submit"
                  className="btn btn-purple"
                  style={{ width: '100%', fontSize: '1.1rem', padding: '12px' }}
                  disabled={!userAnswer.trim()}
                >
                  Kiểm tra đáp án
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ width: '100%', fontSize: '1.1rem', padding: '12px' }}
                  onClick={handleNextQuizQuestion}
                >
                  {currentQuizIndex < quizQuestions.length - 1
                    ? 'Câu tiếp theo ➔'
                    : 'Xem kết quả 🎉'}
                </button>
              )}
            </form>

            {/* Answer Feedback */}
            {quizSubmitted && (
              <div className={`feedback-box ${quizIsCorrect ? 'correct' : 'incorrect'}`}>
                {quizIsCorrect ? (
                  <div>🎉 Chính xác! Bạn làm rất tốt.</div>
                ) : (
                  <div>
                    ❌ Chưa đúng! Đáp án đúng là:{' '}
                    <strong style={{ textDecoration: 'underline' }}>
                      {quizQuestions[currentQuizIndex].correctAnswer}
                    </strong>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. FINISHED MODE */}
      {gameMode === 'finished' && (
        <div className="completion-banner">
          <div className="completion-icon">🎉</div>
          <h2>Chúc mừng bạn đã hoàn thành!</h2>

          {finishedMode === 'matching' ? (
            <>
              <p>Bạn đã nối thành công tất cả từ vựng!</p>
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-value">{formatTime(timer)}</div>
                  <div className="stat-label">Thời gian</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{wordPairs.length}</div>
                  <div className="stat-label">Từ đã ghép</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{matchingMistakes}</div>
                  <div className="stat-label">Lượt ghép sai</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">
                    {matchingAttempts > 0
                      ? Math.round((wordPairs.length / matchingAttempts) * 100)
                      : 100}%
                  </div>
                  <div className="stat-label">Độ chính xác</div>
                </div>
              </div>
            </>
          ) : (
            <>
              <p>Kết quả bài kiểm tra từ vựng:</p>
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-value">
                    {quizScore} / {quizQuestions.length}
                  </div>
                  <div className="stat-label">Số câu đúng</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">
                    {Math.round((quizScore / quizQuestions.length) * 100)}%
                  </div>
                  <div className="stat-label">Điểm số</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{formatTime(timer)}</div>
                  <div className="stat-label">Thời gian làm bài</div>
                </div>
              </div>

              {/* Display incorrect answers if any */}
              {incorrectQuizList.length > 0 && (
                <div className="review-list">
                  <h4>Các từ làm chưa đúng ({incorrectQuizList.length}):</h4>
                  {incorrectQuizList.map((item, idx) => (
                    <div key={idx} className="review-item">
                      <div>
                        <strong>{item.question.givenText}</strong>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ color: '#ef4444', textDecoration: 'line-through', marginRight: '8px' }}>
                          {item.userAnswer || '(Bỏ trống)'}
                        </span>
                        <span style={{ color: '#059669', fontWeight: 'bold' }}>
                          ➜ {item.question.correctAnswer}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Student Name Submission Form (For Student View) */}
          {isStudentView && (
            <div className="submit-name-box">
              {!studentSubmitted ? (
                <form onSubmit={handleStudentSubmitResult}>
                  <h3 style={{ margin: '0 0 8px 0', color: '#1e293b' }}>
                    📝 Nộp kết quả cho Giáo Viên:
                  </h3>
                  <p style={{ margin: '0 0 16px 0', fontSize: '0.9rem', color: '#64748b' }}>
                    Hãy nhập Họ và Tên của bạn để giáo viên ghi nhận kết quả bài làm:
                  </p>
                  <div style={{ display: 'flex', gap: '8px', maxWidth: '400px', margin: '0 auto' }}>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="Nhập Họ và Tên học sinh..."
                      value={studentNameInput}
                      onChange={(e) => setStudentNameInput(e.target.value)}
                      required
                    />
                    <button type="submit" className="btn btn-primary" disabled={!studentNameInput.trim()}>
                      🚀 Nộp bài
                    </button>
                  </div>
                </form>
              ) : (
                <div style={{ color: '#059669' }}>
                  <h3 style={{ margin: '0 0 6px 0' }}>✅ Đã nộp bài thành công!</h3>
                  <p style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: '#475569' }}>
                    Giáo viên của bạn đã nhận được kết quả làm bài của học sinh <strong>{studentNameInput}</strong>.
                  </p>
                  {reportCode && (
                    <div style={{ background: 'white', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', display: 'inline-flex', gap: '8px', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Mã báo cáo gửi qua nhắn tin:</span>
                      <button
                        className="btn btn-outline"
                        style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                        onClick={() => {
                          navigator.clipboard.writeText(reportCode);
                          setReportCopied(true);
                          setTimeout(() => setReportCopied(false), 2000);
                        }}
                      >
                        {reportCopied ? '✅ Đã copy' : '📋 Copy mã'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Action Buttons for Teacher */}
          {!isStudentView && (
            <div className="action-buttons">
              {finishedMode === 'matching' ? (
                <button className="btn btn-success" onClick={handleStartMatching}>
                  🔄 Chơi lại (Giáo viên làm thử)
                </button>
              ) : (
                <button className="btn btn-purple" onClick={handleStartQuiz}>
                  🔄 Kiểm tra lại (Giáo viên làm thử)
                </button>
              )}
              <button className="btn btn-secondary" onClick={() => setGameMode('input')}>
                📝 Chỉnh sửa / Quản lý danh sách từ
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
