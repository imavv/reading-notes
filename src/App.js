import React, { useState, useEffect, useRef } from 'react';
import { Mic, Plus, Search, Moon, Sun, Edit2, Trash2, Sparkles, Loader2, Download, LogIn, LogOut, User, Cloud, CloudOff, Menu, X, WifiOff } from 'lucide-react';
import { initLLM, generateSummary, generateTitle, isModelLoaded, isModelLoading } from './llmService';
import { AuthProvider, useAuth } from './AuthContext';
import { dataService, migrateLocalToCloud } from './dataService';

function AppContent() {
  const { user, loading: authLoading, signInWithGoogle, signOut, isConfigured } = useAuth();

  const [darkMode, setDarkMode] = useState(true);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [books, setBooks] = useState([]);
  const [currentView, setCurrentView] = useState('list'); // 'list', 'book', 'voiceDetail', 'voiceRecording', 'typeInput'
  const [currentBook, setCurrentBook] = useState(null);
  const [showAddBook, setShowAddBook] = useState(false);
  const [newBookTitle, setNewBookTitle] = useState('');
  const [newBookAuthor, setNewBookAuthor] = useState('');
  const [activeTab, setActiveTab] = useState('voice'); // 'voice', 'type'

  // Voice detail view
  const [currentVoiceEntryId, setCurrentVoiceEntryId] = useState(null);

  // Derived: get current voice entry from currentBook (single source of truth)
  const currentVoiceEntry = currentBook?.voiceEntries?.find(e => e.id === currentVoiceEntryId) || null;

  // Voice recording states
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef(null);
  const transcriptScrollRef = useRef(null);

  // Type mode states
  const [newTypeText, setNewTypeText] = useState('');

  // Editing states
  const [editingVoiceText, setEditingVoiceText] = useState('');
  const [editingTypeId, setEditingTypeId] = useState(null);

  // LLM states
  const [llmProgress, setLlmProgress] = useState(0);
  const [llmProgressText, setLlmProgressText] = useState('');
  const [showLlmLoadingModal, setShowLlmLoadingModal] = useState(false);
  const [showSummarizePrompt, setShowSummarizePrompt] = useState(false);
  const [pendingVoiceEntry, setPendingVoiceEntry] = useState(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [voiceDetailTab, setVoiceDetailTab] = useState('raw'); // 'raw' or 'summary'

  // Migration states
  const [showMigrationModal, setShowMigrationModal] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState('');
  const [migrationCurrent, setMigrationCurrent] = useState(0);
  const [migrationTotal, setMigrationTotal] = useState(0);

  // Track if migration check has been done for this session
  const migrationChecked = useRef(false);

  // PWA offline status
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const stored = localStorage.getItem('darkMode');
    // Default to dark mode if not set
    const isDark = stored === null ? true : stored === 'true';
    setDarkMode(isDark);
  }, []);

  useEffect(() => {
    localStorage.setItem('darkMode', darkMode);
  }, [darkMode]);

  // Track online/offline status for PWA
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load books when user changes
  useEffect(() => {
    if (!authLoading) {
      loadBooks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  // Check for migration when user logs in
  useEffect(() => {
    if (user && !migrationChecked.current && isConfigured) {
      migrationChecked.current = true;
      checkAndMigrate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isConfigured]);

  // Auto-scroll transcript to bottom when new text arrives
  useEffect(() => {
    if (transcriptScrollRef.current) {
      transcriptScrollRef.current.scrollTop = transcriptScrollRef.current.scrollHeight;
    }
  }, [transcript]);

  const checkAndMigrate = async () => {
    setShowMigrationModal(true);
    setMigrationProgress('Checking for local data to migrate...');

    const result = await migrateLocalToCloud(user.id, (message, current, total) => {
      setMigrationProgress(message);
      setMigrationCurrent(current);
      setMigrationTotal(total);
    });

    if (result.skipped) {
      setMigrationProgress('You already have cloud data. Loading...');
    } else if (result.migrated > 0) {
      setMigrationProgress(`Successfully migrated ${result.migrated} book(s)!`);
    } else if (result.migrated === 0) {
      setMigrationProgress('No local data to migrate. Ready to go!');
    }

    // Brief delay to show the message
    await new Promise(resolve => setTimeout(resolve, 1500));
    setShowMigrationModal(false);
    loadBooks();
  };

  const loadBooks = async () => {
    const allBooks = await dataService.getAllBooks(user?.id);
    const sorted = allBooks.sort((a, b) => b.lastEdited - a.lastEdited);
    setBooks(sorted);
  };

  const checkDuplicate = (title, author) => {
    return books.some(book =>
      book.title.toLowerCase().trim() === title.toLowerCase().trim() &&
      book.author.toLowerCase().trim() === author.toLowerCase().trim()
    );
  };

  const isCloudMode = dataService.isCloudMode(user?.id);

  const createBook = async () => {
    const title = newBookTitle.trim();
    const author = newBookAuthor.trim();

    if (!title || !author) {
      alert('Please enter both book title and author name');
      return;
    }

    if (checkDuplicate(title, author)) {
      alert('This book and author combination already exists!');
      return;
    }

    const book = await dataService.createBook({ title, author }, user?.id);

    await loadBooks();
    setNewBookTitle('');
    setNewBookAuthor('');
    setShowAddBook(false);
    openBook(book);
  };

  const openBook = (book) => {
    setCurrentBook(book);
    setCurrentView('book');
    setActiveTab('voice');
  };

  const openVoiceDetail = (entry) => {
    setCurrentVoiceEntryId(entry.id);
    setEditingVoiceText(entry.rawText);
    setCurrentView('voiceDetail');
    setVoiceDetailTab('raw');
  };

  const saveVoiceDetail = async () => {
    if (!editingVoiceText.trim()) return;

    if (isCloudMode) {
      await dataService.updateVoiceEntry(currentVoiceEntryId, { rawText: editingVoiceText }, user.id);
      await loadBooks();
      // Refresh currentBook - currentVoiceEntry will auto-update since it's derived
      const refreshedBooks = await dataService.getAllBooks(user.id);
      const refreshedBook = refreshedBooks.find(b => b.id === currentBook.id);
      if (refreshedBook) {
        setCurrentBook(refreshedBook);
      }
    } else {
      const updated = {
        voiceEntries: currentBook.voiceEntries.map(e =>
          e.id === currentVoiceEntryId
            ? { ...e, rawText: editingVoiceText, timestamp: Date.now() }
            : e
        )
      };
      await updateCurrentBook(updated);
    }

    // Return to book view after saving
    setCurrentView('book');
    setCurrentVoiceEntryId(null);
    setVoiceDetailTab('raw');
  };


  const deleteVoiceDetail = async () => {
    if (!window.confirm('Delete this voice note?')) return;

    if (isCloudMode) {
      await dataService.deleteVoiceEntry(currentVoiceEntryId, user.id);
      await loadBooks();
      // Refresh currentBook
      const refreshedBooks = await dataService.getAllBooks(user.id);
      const refreshedBook = refreshedBooks.find(b => b.id === currentBook.id);
      if (refreshedBook) {
        setCurrentBook(refreshedBook);
      }
    } else {
      const updated = {
        voiceEntries: currentBook.voiceEntries.filter(e => e.id !== currentVoiceEntryId)
      };
      await updateCurrentBook(updated);
    }
    setCurrentView('book');
    setCurrentVoiceEntryId(null);
  };

  const exportData = async () => {
    const allBooks = await dataService.getAllBooks(user?.id);

    const exportDataObj = {
      exportDate: new Date().toISOString(),
      totalBooks: allBooks.length,
      books: allBooks.map(book => ({
        id: book.id,
        title: book.title,
        author: book.author,
        createdAt: book.id, // ID is timestamp of creation
        lastEdited: book.lastEdited,
        lastEditedFormatted: formatDate(book.lastEdited),
        voiceEntries: book.voiceEntries.map(entry => ({
          id: entry.id,
          text: entry.rawText,
          createdAt: entry.timestamp,
          createdAtFormatted: formatDate(entry.timestamp)
        })),
        typeEntries: book.typeEntries.map(entry => ({
          id: entry.id,
          text: entry.text,
          createdAt: entry.timestamp,
          createdAtFormatted: formatDate(entry.timestamp)
        }))
      }))
    };

    const blob = new Blob([JSON.stringify(exportDataObj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bookworm-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    alert('Data exported successfully!');
  };

  const updateCurrentBook = async (updates) => {
    const updated = { ...currentBook, ...updates, lastEdited: Date.now() };
    await dataService.saveBook(updated, user?.id);
    setCurrentBook(updated);
    await loadBooks();
  };

  const startRecording = async () => {
    // Check if speech recognition is supported
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Speech recognition not supported in this browser. Please use Chrome or Safari.');
      return;
    }

    try {
      // Request microphone permission FIRST using Navigator API
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();

      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 1;

      let finalTranscript = '';
      let isManualStop = false;

      recognition.onstart = () => {
        console.log('Recording started');
        setIsRecording(true);
      };

      recognition.onresult = (event) => {
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
          } else {
            interimTranscript += transcript;
          }
        }

        setTranscript(finalTranscript + interimTranscript);
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);

        if (event.error === 'no-speech') {
          alert('No speech detected. Please try again and speak clearly.');
        } else if (event.error === 'aborted') {
          if (!isManualStop) {
            alert('Recording was interrupted. Please try again.');
          }
        } else if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          alert('Microphone access denied. Please:\n\n1. Go to iPhone Settings → Safari → Microphone → Allow\n2. Go to iPhone Settings → Privacy & Security → Speech Recognition → Enable Safari\n3. Refresh this page and try again');
        } else {
          alert(`Recording error: ${event.error}. Please try again.`);
        }

        setIsRecording(false);
      };

      recognition.onend = () => {
        console.log('Recording ended');

        if (isRecording && !isManualStop && recognitionRef.current) {
          try {
            recognition.start();
          } catch (err) {
            console.error('Failed to restart:', err);
            setIsRecording(false);
          }
        } else {
          setIsRecording(false);
        }
      };

      recognitionRef.current = recognition;

      recognitionRef.current.stopManually = () => {
        isManualStop = true;
        recognition.stop();
      };

      recognition.start();
      setTranscript('');

    } catch (err) {
      console.error('Microphone access error:', err);

      if (err.name === 'NotAllowedError') {
        alert('Microphone permission denied. Please:\n\n1. Tap the "AA" icon in Safari address bar\n2. Select "Website Settings"\n3. Enable Microphone\n4. Refresh page and try again');
      } else if (err.name === 'NotFoundError') {
        alert('No microphone found on this device.');
      } else if (err.name === 'NotSupportedError') {
        alert('Microphone access requires HTTPS. Please use the Vercel URL (https://...) instead of localhost.');
      } else {
        alert(`Could not access microphone: ${err.message}\n\nPlease check your device settings.`);
      }
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      if (recognitionRef.current.stopManually) {
        recognitionRef.current.stopManually();
      } else {
        recognitionRef.current.stop();
      }

      setIsRecording(false);
    }
  };

  const saveVoiceEntry = async () => {
    if (!transcript.trim()) return;

    const entry = {
      id: Date.now().toString(),
      rawText: transcript,
      timestamp: Date.now(),
      summary: null,
      title: null
    };

    if (isCloudMode) {
      const cloudEntry = await dataService.addVoiceEntry(currentBook.id, entry, user.id);
      if (cloudEntry) {
        entry.id = cloudEntry.id;
        entry.timestamp = cloudEntry.timestamp;
      }
      await loadBooks();
      // Refresh currentBook
      const refreshedBooks = await dataService.getAllBooks(user.id);
      const refreshedBook = refreshedBooks.find(b => b.id === currentBook.id);
      if (refreshedBook) {
        setCurrentBook(refreshedBook);
      }
    } else {
      const updated = {
        voiceEntries: [entry, ...currentBook.voiceEntries]
      };
      await updateCurrentBook(updated);
    }

    setTranscript('');

    // Show summarization prompt
    setPendingVoiceEntry(entry);
    setShowSummarizePrompt(true);

    // Return to book view after saving
    setCurrentView('book');
  };


  const deleteVoiceEntry = async (entryId) => {
    if (!window.confirm('Delete this voice note?')) return;

    if (isCloudMode) {
      await dataService.deleteVoiceEntry(entryId, user.id);
      await loadBooks();
      // Refresh currentBook
      const refreshedBooks = await dataService.getAllBooks(user.id);
      const refreshedBook = refreshedBooks.find(b => b.id === currentBook.id);
      if (refreshedBook) {
        setCurrentBook(refreshedBook);
      }
    } else {
      const updated = {
        voiceEntries: currentBook.voiceEntries.filter(e => e.id !== entryId)
      };
      await updateCurrentBook(updated);
    }
  };

  const addTypeEntry = async () => {
    const text = newTypeText.trim();
    if (!text) return;

    const wordCount = text.split(/\s+/).length;
    if (wordCount > 10) {
      alert('Maximum 10 words allowed');
      return;
    }

    const entry = {
      id: Date.now().toString(),
      text,
      timestamp: Date.now()
    };

    if (isCloudMode) {
      await dataService.addTypeEntry(currentBook.id, entry, user.id);
      await loadBooks();
      // Refresh currentBook
      const refreshedBooks = await dataService.getAllBooks(user.id);
      const refreshedBook = refreshedBooks.find(b => b.id === currentBook.id);
      if (refreshedBook) {
        setCurrentBook(refreshedBook);
      }
    } else {
      const updated = {
        typeEntries: [entry, ...currentBook.typeEntries]
      };
      await updateCurrentBook(updated);
    }

    setNewTypeText('');

    // Return to book view after saving
    setCurrentView('book');
  };

  const startEditType = (entry) => {
    setEditingTypeId(entry.id);
    setNewTypeText(entry.text);
    setCurrentView('typeInput');
  };

  const saveEditType = async () => {
    const text = newTypeText.trim();
    if (!text) return;

    const wordCount = text.split(/\s+/).length;
    if (wordCount > 10) {
      alert('Maximum 10 words allowed');
      return;
    }

    if (isCloudMode) {
      await dataService.updateTypeEntry(editingTypeId, { text }, user.id);
      await loadBooks();
      // Refresh currentBook
      const refreshedBooks = await dataService.getAllBooks(user.id);
      const refreshedBook = refreshedBooks.find(b => b.id === currentBook.id);
      if (refreshedBook) {
        setCurrentBook(refreshedBook);
      }
    } else {
      const updated = {
        typeEntries: currentBook.typeEntries.map(e =>
          e.id === editingTypeId
            ? { ...e, text, timestamp: Date.now() }
            : e
        )
      };
      await updateCurrentBook(updated);
    }

    setEditingTypeId(null);
    setNewTypeText('');
    setCurrentView('book');
  };


  const deleteTypeEntry = async (entryId) => {
    if (!window.confirm('Delete this quick note?')) return;

    if (isCloudMode) {
      await dataService.deleteTypeEntry(entryId, user.id);
      await loadBooks();
      // Refresh currentBook
      const refreshedBooks = await dataService.getAllBooks(user.id);
      const refreshedBook = refreshedBooks.find(b => b.id === currentBook.id);
      if (refreshedBook) {
        setCurrentBook(refreshedBook);
      }
    } else {
      const updated = {
        typeEntries: currentBook.typeEntries.filter(e => e.id !== entryId)
      };
      await updateCurrentBook(updated);
    }
  };

  const searchGoogle = (text) => {
    window.open(`https://www.google.com/search?q=${encodeURIComponent(text)}`, '_blank');
  };

  // LLM functions
  const loadLLM = async () => {
    if (isModelLoaded() || isModelLoading()) {
      return isModelLoaded();
    }

    setShowLlmLoadingModal(true);
    setLlmProgress(0);

    try {
      await initLLM((progress, text) => {
        setLlmProgress(progress);
        setLlmProgressText(text || '');
      });
      setShowLlmLoadingModal(false);
      localStorage.setItem('llmModelDownloaded', 'true');
      return true;
    } catch (error) {
      console.error('Failed to load LLM:', error);
      setShowLlmLoadingModal(false);
      alert('Failed to load AI model. Please try again.');
      return false;
    }
  };

  const summarizeEntry = async (entry) => {
    if (!isModelLoaded()) {
      const loaded = await loadLLM();
      if (!loaded) return null;
    }

    setIsSummarizing(true);
    try {
      const [summary, title] = await Promise.all([
        generateSummary(entry.rawText),
        generateTitle(entry.rawText)
      ]);

      return { summary, title };
    } catch (error) {
      console.error('Failed to summarize:', error);
      alert('Failed to generate summary. Please try again.');
      return null;
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleSummarizeAfterRecording = async (shouldSummarize) => {
    if (!pendingVoiceEntry) return;

    if (shouldSummarize) {
      const result = await summarizeEntry(pendingVoiceEntry);
      if (result) {
        const updatedEntry = {
          ...pendingVoiceEntry,
          summary: result.summary,
          title: result.title
        };

        if (isCloudMode) {
          await dataService.updateVoiceEntry(pendingVoiceEntry.id, {
            summary: result.summary,
            title: result.title
          }, user.id);
          await loadBooks();
          // Refresh currentBook
          const refreshedBooks = await dataService.getAllBooks(user.id);
          const refreshedBook = refreshedBooks.find(b => b.id === currentBook.id);
          if (refreshedBook) {
            setCurrentBook(refreshedBook);
          }
        } else {
          const updated = {
            voiceEntries: currentBook.voiceEntries.map(e =>
              e.id === pendingVoiceEntry.id ? updatedEntry : e
            )
          };
          await updateCurrentBook(updated);
        }
      }
    }

    setShowSummarizePrompt(false);
    setPendingVoiceEntry(null);
  };

  const summarizeCurrentVoiceEntry = async () => {
    if (!currentVoiceEntry) return;

    const result = await summarizeEntry(currentVoiceEntry);
    if (result) {
      if (isCloudMode) {
        await dataService.updateVoiceEntry(currentVoiceEntryId, {
          summary: result.summary,
          title: result.title
        }, user.id);
        await loadBooks();
        // Refresh currentBook - currentVoiceEntry will auto-update since it's derived
        const refreshedBooks = await dataService.getAllBooks(user.id);
        const refreshedBook = refreshedBooks.find(b => b.id === currentBook.id);
        if (refreshedBook) {
          setCurrentBook(refreshedBook);
        }
      } else {
        const updatedEntry = {
          ...currentVoiceEntry,
          summary: result.summary,
          title: result.title
        };
        const updated = {
          voiceEntries: currentBook.voiceEntries.map(e =>
            e.id === currentVoiceEntryId ? updatedEntry : e
          )
        };
        await updateCurrentBook(updated);
      }
    }
  };

  const getLastNote = (book) => {
    const allEntries = [
      ...book.voiceEntries.map(e => ({ text: e.title || e.rawText, time: e.timestamp })),
      ...book.typeEntries.map(e => ({ text: e.text, time: e.timestamp }))
    ].sort((a, b) => b.time - a.time);

    if (allEntries.length === 0) return 'No notes yet';
    return allEntries[0].text.substring(0, 60) + (allEntries[0].text.length > 60 ? '...' : '');
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleDeleteBook = async (bookId, e) => {
    e.stopPropagation();
    if (window.confirm('Delete this book and all its notes?')) {
      await dataService.deleteBook(bookId, user?.id);
      await loadBooks();
    }
  };

  const handleSignIn = async () => {
    const { error } = await signInWithGoogle();
    if (error) {
      console.error('Sign in error:', error);
      alert('Failed to sign in. Please try again.');
    }
  };

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      console.error('Sign out error:', error);
    }
    migrationChecked.current = false;
    setBooks([]);
    loadBooks();
  };

  const theme = darkMode
    ? 'bg-gray-900 text-gray-100'
    : 'bg-gray-50 text-gray-900';

  const cardBg = darkMode ? 'bg-gray-800' : 'bg-white';
  const borderColor = darkMode ? 'border-gray-700' : 'border-gray-200';
  const inputBg = darkMode ? 'bg-gray-700 text-gray-100' : 'bg-white text-gray-900';
  const buttonBg = darkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600';

  // Auth loading state
  if (authLoading) {
    return (
      <div className={`min-h-screen ${theme} flex items-center justify-center`}>
        <Loader2 size={32} className="animate-spin" />
      </div>
    );
  }

  // Offline Banner Component
  const OfflineBanner = () => !isOnline && (
    <div className="bg-amber-500 text-black px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-2">
      <WifiOff size={16} />
      You're offline. Changes will sync when you reconnect.
    </div>
  );

  // List View
  if (currentView === 'list') {
    return (
      <div className={`min-h-screen ${theme} transition-colors`}>
        <OfflineBanner />
        <div className="max-w-4xl mx-auto p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">Bookworm</h1>
              {/* Cloud status indicator */}
              {isConfigured && (
                <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs ${
                  isCloudMode
                    ? 'bg-green-500/20 text-green-500'
                    : 'bg-gray-500/20 text-gray-500'
                }`}>
                  {isCloudMode ? <Cloud size={14} /> : <CloudOff size={14} />}
                  {isCloudMode ? 'Synced' : 'Local'}
                </div>
              )}
            </div>
            <div className="flex gap-3 items-center">
              <button
                onClick={() => setShowAddBook(true)}
                className={`${buttonBg} text-white px-4 py-2 rounded-lg flex items-center gap-2`}
              >
                <Plus size={20} />
                <span className="hidden sm:inline">Add Book</span>
              </button>
              {/* Header Menu Button */}
              <div className="relative">
                <button
                  onClick={() => setShowHeaderMenu(!showHeaderMenu)}
                  className={`p-3 rounded-full ${cardBg} border ${borderColor}`}
                >
                  {showHeaderMenu ? <X size={20} /> : <Menu size={20} />}
                </button>
                {/* Header Dropdown */}
                {showHeaderMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowHeaderMenu(false)}
                    />
                    <div className={`absolute right-0 mt-2 w-64 ${cardBg} border ${borderColor} rounded-lg shadow-lg z-50 overflow-hidden`}>
                      {/* User info section */}
                      {isConfigured && user && (
                        <div className={`px-4 py-3 border-b ${borderColor}`}>
                          <div className="flex items-center gap-3">
                            {user.user_metadata?.avatar_url ? (
                              <img
                                src={user.user_metadata.avatar_url}
                                alt="Avatar"
                                className="w-10 h-10 rounded-full"
                              />
                            ) : (
                              <div className={`w-10 h-10 rounded-full ${darkMode ? 'bg-gray-700' : 'bg-gray-200'} flex items-center justify-center`}>
                                <User size={20} className="opacity-70" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{user.user_metadata?.full_name || 'User'}</p>
                              <p className="text-xs opacity-60 truncate">{user.email}</p>
                            </div>
                          </div>
                        </div>
                      )}
                      {/* Menu items */}
                      <div className="py-2">
                        {/* Theme toggle */}
                        <button
                          onClick={() => {
                            setDarkMode(!darkMode);
                            setShowHeaderMenu(false);
                          }}
                          className={`w-full px-4 py-3 flex items-center gap-3 hover:${darkMode ? 'bg-gray-700' : 'bg-gray-100'} transition-colors`}
                        >
                          {darkMode ? <Sun size={18} /> : <Moon size={18} />}
                          <span>{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
                        </button>
                        {/* Export */}
                        <button
                          onClick={() => {
                            exportData();
                            setShowHeaderMenu(false);
                          }}
                          className={`w-full px-4 py-3 flex items-center gap-3 hover:${darkMode ? 'bg-gray-700' : 'bg-gray-100'} transition-colors`}
                        >
                          <Download size={18} />
                          <span>Export Data</span>
                        </button>
                        {/* Sign in/out */}
                        {isConfigured && (
                          user ? (
                            <button
                              onClick={() => {
                                handleSignOut();
                                setShowHeaderMenu(false);
                              }}
                              className={`w-full px-4 py-3 flex items-center gap-3 hover:${darkMode ? 'bg-gray-700' : 'bg-gray-100'} transition-colors text-red-500`}
                            >
                              <LogOut size={18} />
                              <span>Sign Out</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                handleSignIn();
                                setShowHeaderMenu(false);
                              }}
                              className={`w-full px-4 py-3 flex items-center gap-3 hover:${darkMode ? 'bg-gray-700' : 'bg-gray-100'} transition-colors`}
                            >
                              <LogIn size={18} />
                              <span>Sign in with Google</span>
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Books Grid */}
          <div className="grid gap-4">
            {books.map(book => (
              <div
                key={book.id}
                onClick={() => openBook(book)}
                className={`${cardBg} border ${borderColor} rounded-lg p-6 cursor-pointer hover:shadow-lg transition-shadow relative group`}
              >
                <button
                  onClick={(e) => handleDeleteBook(book.id, e)}
                  className="absolute top-4 right-4 p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 hover:text-white"
                >
                  <Trash2 size={18} />
                </button>
                <h2 className="text-xl font-semibold mb-1">{book.title}</h2>
                <p className="text-sm opacity-70 mb-2">by {book.author}</p>
                <p className="text-sm opacity-60 mb-3">{formatDate(book.lastEdited)}</p>
                <p className="text-sm opacity-80">{getLastNote(book)}</p>
              </div>
            ))}

            {books.length === 0 && (
              <div className="text-center py-12 opacity-60">
                <p>No books yet. Click "Add Book" to get started!</p>
              </div>
            )}
          </div>
        </div>

        {/* Add Book Modal */}
        {showAddBook && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className={`${cardBg} rounded-lg p-6 w-full max-w-md`}>
              <h2 className="text-xl font-semibold mb-4">Add New Book</h2>
              <input
                type="text"
                value={newBookTitle}
                onChange={(e) => setNewBookTitle(e.target.value)}
                placeholder="Book title"
                className={`w-full px-4 py-3 rounded-lg border ${borderColor} ${inputBg} mb-3`}
                autoFocus
              />
              <input
                type="text"
                value={newBookAuthor}
                onChange={(e) => setNewBookAuthor(e.target.value)}
                placeholder="Author name"
                className={`w-full px-4 py-3 rounded-lg border ${borderColor} ${inputBg} mb-4`}
                onKeyPress={(e) => e.key === 'Enter' && createBook()}
              />
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowAddBook(false);
                    setNewBookTitle('');
                    setNewBookAuthor('');
                  }}
                  className={`flex-1 px-4 py-2 rounded-lg border ${borderColor}`}
                >
                  Cancel
                </button>
                <button
                  onClick={createBook}
                  className={`flex-1 ${buttonBg} text-white px-4 py-2 rounded-lg`}
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Migration Modal */}
        {showMigrationModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className={`${cardBg} rounded-lg p-6 w-full max-w-md`}>
              <div className="flex items-center gap-3 mb-4">
                <Cloud size={24} className="text-blue-500" />
                <h2 className="text-xl font-semibold">Setting Up Cloud Sync</h2>
              </div>
              <p className="text-sm opacity-70 mb-4">{migrationProgress}</p>
              {migrationTotal > 0 && (
                <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                  <div
                    className="bg-blue-500 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${(migrationCurrent / migrationTotal) * 100}%` }}
                  />
                </div>
              )}
              <div className="flex items-center justify-center gap-3">
                <Loader2 size={20} className="animate-spin text-blue-500" />
                <span className="text-sm opacity-60">Please wait...</span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Voice Recording View - Full screen blank page
  if (currentView === 'voiceRecording') {
    return (
      <div className={`min-h-screen ${theme} transition-colors`}>
        <OfflineBanner />
        <div className="max-w-4xl mx-auto p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <button
              onClick={() => {
                stopRecording();
                setTranscript('');
                setCurrentView('book');
              }}
              className="text-lg opacity-70 hover:opacity-100"
            >
              Close
            </button>
            <div className="flex items-center gap-3">
              {isRecording ? (
                <>
                  <Mic size={20} className="text-blue-500" />
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium text-red-500">Recording</span>
                  </div>
                </>
              ) : (
                <Mic size={20} className="opacity-50" />
              )}
            </div>
            <button
              onClick={saveVoiceEntry}
              disabled={!transcript.trim()}
              className={`text-lg font-medium ${
                transcript.trim()
                  ? 'text-green-500 hover:text-green-400'
                  : 'opacity-30 cursor-not-allowed'
              }`}
            >
              Save
            </button>
          </div>

          {/* Main Content Area */}
          <div className="min-h-[70vh]">
            <textarea
              ref={transcriptScrollRef}
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Tap the microphone to start recording..."
              className={`w-full h-full min-h-[70vh] ${inputBg} border-0 text-xl leading-relaxed resize-none focus:outline-none focus:ring-0`}
              style={{
                background: 'transparent',
                fontFamily: 'inherit'
              }}
            />
          </div>

          {/* Recording Controls - Fixed at bottom */}
          <div className="fixed bottom-8 left-0 right-0 px-6">
            <div className="max-w-4xl mx-auto flex justify-center">
              {!isRecording ? (
                <button
                  onClick={startRecording}
                  className="bg-blue-500 hover:bg-blue-600 text-white p-6 rounded-full shadow-lg transition-all"
                >
                  <Mic size={32} />
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  className="bg-red-500 hover:bg-red-600 text-white px-8 py-4 rounded-full shadow-lg transition-all font-medium"
                >
                  Stop Recording
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Type Input View - Full screen blank page
  if (currentView === 'typeInput') {
    const wordCount = newTypeText.trim() ? newTypeText.trim().split(/\s+/).length : 0;
    const wordsRemaining = 10 - wordCount;
    const isOverLimit = wordCount > 10;
    const isEditMode = editingTypeId !== null;

    return (
      <div className={`min-h-screen ${theme} transition-colors`}>
        <OfflineBanner />
        <div className="max-w-4xl mx-auto p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <button
              onClick={() => {
                setNewTypeText('');
                setEditingTypeId(null);
                setCurrentView('book');
              }}
              className="text-lg opacity-70 hover:opacity-100"
            >
              Close
            </button>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-medium ${
                isOverLimit ? 'text-red-500' : wordsRemaining <= 3 ? 'text-amber-500' : 'text-red-400'
              }`}>
                {wordsRemaining} word{wordsRemaining !== 1 ? 's' : ''} remaining
              </span>
            </div>
            <button
              onClick={isEditMode ? saveEditType : addTypeEntry}
              disabled={!newTypeText.trim() || isOverLimit}
              className={`text-lg font-medium ${
                newTypeText.trim() && !isOverLimit
                  ? 'text-green-500 hover:text-green-400'
                  : 'opacity-30 cursor-not-allowed'
              }`}
            >
              Save
            </button>
          </div>

          {/* Main Content Area */}
          <div className="min-h-[70vh]">
            <textarea
              value={newTypeText}
              onChange={(e) => setNewTypeText(e.target.value)}
              placeholder="Type your quick note (max 10 words)..."
              className={`w-full h-full min-h-[70vh] ${inputBg} border-0 text-xl leading-relaxed resize-none focus:outline-none focus:ring-0`}
              style={{
                background: 'transparent',
                fontFamily: 'inherit'
              }}
              autoFocus
            />
          </div>

          {/* Word limit warning */}
          {isOverLimit && (
            <div className="fixed bottom-8 left-0 right-0 px-6">
              <div className="max-w-4xl mx-auto">
                <div className="bg-red-500 text-white px-6 py-3 rounded-lg text-center font-medium shadow-lg">
                  Exceeded word limit. Please reduce to 10 words or less.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Voice Detail View
  if (currentView === 'voiceDetail') {
    return (
      <div className={`min-h-screen ${theme} transition-colors`}>
        <OfflineBanner />
        <div className="max-w-4xl mx-auto p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <button
              onClick={() => {
                setEditingVoiceText(currentVoiceEntry.rawText);
                setCurrentView('book');
                setCurrentVoiceEntryId(null);
                setVoiceDetailTab('raw');
              }}
              className="text-lg opacity-70 hover:opacity-100"
            >
              Close
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={deleteVoiceDetail}
                className="p-2 rounded-lg hover:bg-red-500 hover:text-white transition-colors"
              >
                <Trash2 size={18} />
              </button>
            </div>
            <button
              onClick={async () => {
                await saveVoiceDetail();
              }}
              disabled={!editingVoiceText.trim()}
              className={`text-lg font-medium ${
                editingVoiceText.trim()
                  ? 'text-green-500 hover:text-green-400'
                  : 'opacity-30 cursor-not-allowed'
              }`}
            >
              Save
            </button>
          </div>

          {/* Tabs for Raw/Summary */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setVoiceDetailTab('raw')}
              className={`flex-1 py-3 rounded-lg font-medium transition-colors ${
                voiceDetailTab === 'raw'
                  ? `${buttonBg} text-white`
                  : `${cardBg} border ${borderColor}`
              }`}
            >
              Edit
            </button>
            <button
              onClick={() => setVoiceDetailTab('summary')}
              className={`flex-1 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                voiceDetailTab === 'summary'
                  ? `${buttonBg} text-white`
                  : `${cardBg} border ${borderColor}`
              }`}
            >
              <Sparkles size={18} />
              AI Summary
            </button>
          </div>

          {voiceDetailTab === 'raw' ? (
            // Raw Transcript Tab - Always editable
            <div className="min-h-[60vh]">
              <textarea
                value={editingVoiceText}
                onChange={(e) => setEditingVoiceText(e.target.value)}
                placeholder="Edit your voice note..."
                className={`w-full h-full min-h-[60vh] ${inputBg} border-0 text-xl leading-relaxed resize-none focus:outline-none focus:ring-0`}
                style={{
                  background: 'transparent',
                  fontFamily: 'inherit'
                }}
                autoFocus
              />
            </div>
          ) : (
            // AI Summary Tab
            <div className={`${cardBg} border ${borderColor} rounded-lg p-6`}>
              {currentVoiceEntry.summary ? (
                <div>
                  <div className="whitespace-pre-wrap text-base leading-relaxed mb-6">
                    {currentVoiceEntry.summary}
                  </div>
                  <button
                    onClick={summarizeCurrentVoiceEntry}
                    disabled={isSummarizing}
                    className={`w-full ${buttonBg} text-white px-4 py-3 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50`}
                  >
                    {isSummarizing ? (
                      <>
                        <Loader2 size={20} className="animate-spin" />
                        Regenerating...
                      </>
                    ) : (
                      <>
                        <Sparkles size={20} />
                        Regenerate Summary
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Sparkles size={48} className="mx-auto mb-4 opacity-30" />
                  <p className="opacity-60 mb-6">No AI summary generated yet</p>
                  <button
                    onClick={summarizeCurrentVoiceEntry}
                    disabled={isSummarizing}
                    className={`${buttonBg} text-white px-6 py-3 rounded-lg flex items-center justify-center gap-2 mx-auto disabled:opacity-50`}
                  >
                    {isSummarizing ? (
                      <>
                        <Loader2 size={20} className="animate-spin" />
                        Generating Summary...
                      </>
                    ) : (
                      <>
                        <Sparkles size={20} />
                        Generate Summary
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* LLM Loading Modal */}
        {showLlmLoadingModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className={`${cardBg} rounded-lg p-6 w-full max-w-md`}>
              <div className="flex items-center gap-3 mb-4">
                <Download size={24} className="text-blue-500" />
                <h2 className="text-xl font-semibold">Loading AI Model</h2>
              </div>
              <p className="text-sm opacity-70 mb-4">
                Downloading AI model (~500MB). This only happens once and will be cached for future use.
              </p>
              <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                <div
                  className="bg-blue-500 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${llmProgress}%` }}
                />
              </div>
              <p className="text-sm opacity-60 text-center">{llmProgress}%</p>
              {llmProgressText && (
                <p className="text-xs opacity-50 text-center mt-1 truncate">{llmProgressText}</p>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Book View
  return (
    <div className={`min-h-screen ${theme} transition-colors`}>
      <OfflineBanner />
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => setCurrentView('list')}
            className={`px-4 py-2 rounded-lg border ${borderColor}`}
          >
            ← Back
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{currentBook.title}</h1>
            <p className="text-sm opacity-70">by {currentBook.author}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('voice')}
            className={`flex-1 py-3 rounded-lg font-medium transition-colors ${
              activeTab === 'voice'
                ? `${buttonBg} text-white`
                : `${cardBg} border ${borderColor}`
            }`}
          >
            Voice Notes
          </button>
          <button
            onClick={() => setActiveTab('type')}
            className={`flex-1 py-3 rounded-lg font-medium transition-colors ${
              activeTab === 'type'
                ? `${buttonBg} text-white`
                : `${cardBg} border ${borderColor}`
            }`}
          >
            Quick Notes
          </button>
        </div>

        {/* Voice Mode */}
        {activeTab === 'voice' && (
          <div>
            {/* Entries */}
            <div className="space-y-4 mb-24">
              {currentBook.voiceEntries.map(entry => (
                <div
                  key={entry.id}
                  className={`${cardBg} border ${borderColor} rounded-lg p-4 relative group cursor-pointer transition-all hover:shadow-md`}
                  onClick={() => openVoiceDetail(entry)}
                >
                  <div
                    className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteVoiceEntry(entry.id);
                      }}
                      className="p-2 rounded-lg hover:bg-red-500 hover:text-white transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <p className="text-sm opacity-60 mb-2">{formatDate(entry.timestamp)}</p>
                  <p className="whitespace-nowrap overflow-hidden text-ellipsis pr-20 font-medium">
                    {entry.title || entry.rawText}
                  </p>
                  {entry.title && (
                    <p className="text-sm opacity-60 mt-1 whitespace-nowrap overflow-hidden text-ellipsis pr-20">
                      {entry.rawText}
                    </p>
                  )}
                  <p className="text-xs opacity-50 mt-1">Click to view full note</p>
                </div>
              ))}

              {currentBook.voiceEntries.length === 0 && (
                <div className="text-center py-12 opacity-60">
                  <p>No voice notes yet. Click the mic button to record!</p>
                </div>
              )}
            </div>

            {/* Add Voice Note Button */}
            <div className="fixed bottom-6 left-0 right-0 px-6 z-10">
              <div className="max-w-4xl mx-auto">
                <button
                  onClick={() => {
                    setCurrentView('voiceRecording');
                    setTimeout(() => startRecording(), 300);
                  }}
                  className={`w-full ${buttonBg} text-white py-4 rounded-lg flex items-center justify-center gap-2 shadow-lg`}
                >
                  <Mic size={24} />
                  Add Voice Note
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Type Mode */}
        {activeTab === 'type' && (
          <div>
            <div className="space-y-4 mb-24">
              {currentBook.typeEntries.map(entry => (
                <div key={entry.id} className={`${cardBg} border ${borderColor} rounded-lg p-4 group`}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm opacity-60 mb-1">{formatDate(entry.timestamp)}</p>
                      <p className="font-medium">{entry.text}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => searchGoogle(entry.text)}
                        className={`p-2 rounded-lg border ${borderColor} hover:bg-blue-500 hover:text-white hover:border-blue-500 transition-colors`}
                      >
                        <Search size={18} />
                      </button>
                      <button
                        onClick={() => startEditType(entry)}
                        className="p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-500 hover:text-white"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => deleteTypeEntry(entry.id)}
                        className="p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 hover:text-white"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {currentBook.typeEntries.length === 0 && (
                <div className="text-center py-12 opacity-60">
                  <p>No quick notes yet. Click the + button to add one!</p>
                </div>
              )}
            </div>

            {/* Add Quick Note Button */}
            <div className="fixed bottom-6 left-0 right-0 px-6 z-10">
              <div className="max-w-4xl mx-auto">
                <button
                  onClick={() => setCurrentView('typeInput')}
                  className={`w-full ${buttonBg} text-white py-4 rounded-lg flex items-center justify-center gap-2 shadow-lg`}
                >
                  <Plus size={24} />
                  Add Quick Note
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Summarization Prompt Modal */}
      {showSummarizePrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className={`${cardBg} rounded-lg p-6 w-full max-w-md`}>
            <div className="flex items-center gap-3 mb-4">
              <Sparkles size={24} className="text-blue-500" />
              <h2 className="text-xl font-semibold">Summarize with AI?</h2>
            </div>
            <p className="text-sm opacity-70 mb-6">
              Generate a bullet point summary and title for this voice note using AI.
              {!localStorage.getItem('llmModelDownloaded') && (
                <span className="block mt-2 text-amber-500">
                  Note: First-time use requires downloading the AI model (~500MB).
                </span>
              )}
            </p>
            {isSummarizing ? (
              <div className="flex items-center justify-center gap-3 py-4">
                <Loader2 size={24} className="animate-spin text-blue-500" />
                <span>Generating summary...</span>
              </div>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={() => handleSummarizeAfterRecording(false)}
                  className={`flex-1 px-4 py-3 rounded-lg border ${borderColor}`}
                >
                  Not Now
                </button>
                <button
                  onClick={() => handleSummarizeAfterRecording(true)}
                  className={`flex-1 ${buttonBg} text-white px-4 py-3 rounded-lg flex items-center justify-center gap-2`}
                >
                  <Sparkles size={20} />
                  Yes, Summarize
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* LLM Loading Modal */}
      {showLlmLoadingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className={`${cardBg} rounded-lg p-6 w-full max-w-md`}>
            <div className="flex items-center gap-3 mb-4">
              <Download size={24} className="text-blue-500" />
              <h2 className="text-xl font-semibold">Loading AI Model</h2>
            </div>
            <p className="text-sm opacity-70 mb-4">
              Downloading AI model (~500MB). This only happens once and will be cached for future use.
            </p>
            <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
              <div
                className="bg-blue-500 h-3 rounded-full transition-all duration-300"
                style={{ width: `${llmProgress}%` }}
              />
            </div>
            <p className="text-sm opacity-60 text-center">{llmProgress}%</p>
            {llmProgressText && (
              <p className="text-xs opacity-50 text-center mt-1 truncate">{llmProgressText}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
