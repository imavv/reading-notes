import React, { useState, useEffect, useRef } from 'react';
import { Mic, Plus, X, Search, Moon, Sun, Edit2, Check, Trash2, Save } from 'lucide-react';

// IndexedDB setup
const DB_NAME = 'ReadingNotesDB';
const DB_VERSION = 1;

const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('books')) {
        const store = db.createObjectStore('books', { keyPath: 'id' });
        store.createIndex('lastEdited', 'lastEdited', { unique: false });
      }
    };
  });
};

const saveBook = async (book) => {
  const db = await initDB();
  const tx = db.transaction('books', 'readwrite');
  const store = tx.objectStore('books');
  await store.put(book);
};

const getAllBooks = async () => {
  const db = await initDB();
  const tx = db.transaction('books', 'readonly');
  const store = tx.objectStore('books');
  return new Promise((resolve) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
  });
};

const deleteBook = async (id) => {
  const db = await initDB();
  const tx = db.transaction('books', 'readwrite');
  const store = tx.objectStore('books');
  await store.delete(id);
};

function App() {
  const [darkMode, setDarkMode] = useState(false);
  const [books, setBooks] = useState([]);
  const [currentView, setCurrentView] = useState('list'); // 'list', 'book', 'voiceDetail'
  const [currentBook, setCurrentBook] = useState(null);
  const [showAddBook, setShowAddBook] = useState(false);
  const [newBookTitle, setNewBookTitle] = useState('');
  const [newBookAuthor, setNewBookAuthor] = useState('');
  const [activeTab, setActiveTab] = useState('voice'); // 'voice', 'type'
  
  // Voice detail view
  const [currentVoiceEntry, setCurrentVoiceEntry] = useState(null);
  const [isEditingVoiceDetail, setIsEditingVoiceDetail] = useState(false);
  
  // Voice recording states
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [editingTranscript, setEditingTranscript] = useState(false);
  const [tempTranscript, setTempTranscript] = useState('');
  const recognitionRef = useRef(null);
  
  // Type mode states
  const [showAddType, setShowAddType] = useState(false);
  const [newTypeText, setNewTypeText] = useState('');
  
  // Editing states
  const [editingVoiceText, setEditingVoiceText] = useState('');
  const [editingTypeId, setEditingTypeId] = useState(null);
  const [editingTypeText, setEditingTypeText] = useState('');

  useEffect(() => {
    loadBooks();
    const isDark = localStorage.getItem('darkMode') === 'true';
    setDarkMode(isDark);
  }, []);

  useEffect(() => {
    localStorage.setItem('darkMode', darkMode);
  }, [darkMode]);

  const loadBooks = async () => {
    const allBooks = await getAllBooks();
    const sorted = allBooks.sort((a, b) => b.lastEdited - a.lastEdited);
    setBooks(sorted);
  };

  const checkDuplicate = (title, author) => {
    return books.some(book => 
      book.title.toLowerCase().trim() === title.toLowerCase().trim() && 
      book.author.toLowerCase().trim() === author.toLowerCase().trim()
    );
  };

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
    
    const book = {
      id: Date.now().toString(),
      title,
      author,
      lastEdited: Date.now(),
      voiceEntries: [],
      typeEntries: []
    };
    
    await saveBook(book);
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
    setCurrentVoiceEntry(entry);
    setEditingVoiceText(entry.rawText);
    setIsEditingVoiceDetail(false);
    setCurrentView('voiceDetail');
  };

  const saveVoiceDetail = async () => {
    if (!editingVoiceText.trim()) return;
    
    const updated = {
      voiceEntries: currentBook.voiceEntries.map(e => 
        e.id === currentVoiceEntry.id 
          ? { ...e, rawText: editingVoiceText, timestamp: Date.now() }
          : e
      )
    };
    
    await updateCurrentBook(updated);
    setCurrentVoiceEntry({ ...currentVoiceEntry, rawText: editingVoiceText, timestamp: Date.now() });
    setIsEditingVoiceDetail(false);
  };

  const deleteVoiceDetail = async () => {
    if (!window.confirm('Delete this voice note?')) return;
    
    const updated = {
      voiceEntries: currentBook.voiceEntries.filter(e => e.id !== currentVoiceEntry.id)
    };
    await updateCurrentBook(updated);
    setCurrentView('book');
    setCurrentVoiceEntry(null);
  };

  const exportData = async () => {
    const allBooks = await getAllBooks();
    
    const exportData = {
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
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reading-notes-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    alert('Data exported successfully!');
  };

  const updateCurrentBook = async (updates) => {
    const updated = { ...currentBook, ...updates, lastEdited: Date.now() };
    await saveBook(updated);
    setCurrentBook(updated);
    await loadBooks();
  };

  const startRecording = async () => {
    // ADDED: Check if speech recognition is supported
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Speech recognition not supported in this browser. Please use Chrome or Safari.');
      return;
    }

    try {
      // ADDED: Request microphone permission FIRST using Navigator API
      // This is critical for iOS Safari - it needs explicit permission before speech recognition
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // ADDED: Immediately stop the stream (we just needed permission)
      // We don't need to keep this stream active since SpeechRecognition handles audio
      stream.getTracks().forEach(track => track.stop());
      
      // Now proceed with speech recognition
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = false;
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
          // ENHANCED: Better error message for iOS users
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
      
      // CHANGED: Start recognition synchronously (critical for iOS)
      recognition.start();
      setTranscript('');
      
    } catch (err) {
      // ADDED: Handle microphone permission errors
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
      // CHANGED: Use the manual stop handler to prevent auto-restart
      if (recognitionRef.current.stopManually) {
        recognitionRef.current.stopManually();
      } else {
        recognitionRef.current.stop();
      }
      
      setIsRecording(false);
      
      // ADDED: Short delay before showing edit screen to ensure transcript is captured
      setTimeout(() => {
        if (transcript.trim()) {
          setEditingTranscript(true);
          setTempTranscript(transcript);
        }
      }, 300);
    }
  };

  const saveVoiceEntry = async () => {
    if (!tempTranscript.trim()) return;
    
    const entry = {
      id: Date.now().toString(),
      rawText: tempTranscript,
      timestamp: Date.now()
    };
    
    const updated = {
      voiceEntries: [entry, ...currentBook.voiceEntries]
    };
    
    await updateCurrentBook(updated);
    setTranscript('');
    setTempTranscript('');
    setEditingTranscript(false);
  };

  const startEditVoice = (entry) => {
    openVoiceDetail(entry);
    setIsEditingVoiceDetail(true);
  };

  const saveEditVoice = async () => {
    await saveVoiceDetail();
  };

  const cancelEditVoice = () => {
    setEditingVoiceText(currentVoiceEntry.rawText);
    setIsEditingVoiceDetail(false);
  };

  const deleteVoiceEntry = async (entryId) => {
    if (!window.confirm('Delete this voice note?')) return;
    
    const updated = {
      voiceEntries: currentBook.voiceEntries.filter(e => e.id !== entryId)
    };
    await updateCurrentBook(updated);
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
    
    const updated = {
      typeEntries: [entry, ...currentBook.typeEntries]
    };
    
    await updateCurrentBook(updated);
    setNewTypeText('');
    setShowAddType(false);
  };

  const startEditType = (entry) => {
    setEditingTypeId(entry.id);
    setEditingTypeText(entry.text);
  };

  const saveEditType = async () => {
    const text = editingTypeText.trim();
    if (!text) return;
    
    const wordCount = text.split(/\s+/).length;
    if (wordCount > 10) {
      alert('Maximum 10 words allowed');
      return;
    }
    
    const updated = {
      typeEntries: currentBook.typeEntries.map(e => 
        e.id === editingTypeId 
          ? { ...e, text, timestamp: Date.now() }
          : e
      )
    };
    
    await updateCurrentBook(updated);
    setEditingTypeId(null);
    setEditingTypeText('');
  };

  const cancelEditType = () => {
    setEditingTypeId(null);
    setEditingTypeText('');
  };

  const deleteTypeEntry = async (entryId) => {
    if (!window.confirm('Delete this quick note?')) return;
    
    const updated = {
      typeEntries: currentBook.typeEntries.filter(e => e.id !== entryId)
    };
    await updateCurrentBook(updated);
  };

  const searchGoogle = (text) => {
    window.open(`https://www.google.com/search?q=${encodeURIComponent(text)}`, '_blank');
  };

  const getLastNote = (book) => {
    const allEntries = [
      ...book.voiceEntries.map(e => ({ text: e.rawText, time: e.timestamp })),
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
      await deleteBook(bookId);
      await loadBooks();
    }
  };

  const theme = darkMode
    ? 'bg-gray-900 text-gray-100'
    : 'bg-gray-50 text-gray-900';
  
  const cardBg = darkMode ? 'bg-gray-800' : 'bg-white';
  const borderColor = darkMode ? 'border-gray-700' : 'border-gray-200';
  const inputBg = darkMode ? 'bg-gray-700 text-gray-100' : 'bg-white text-gray-900';
  const buttonBg = darkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600';

  // List View
  if (currentView === 'list') {
    return (
      <div className={`min-h-screen ${theme} transition-colors`}>
        <div className="max-w-4xl mx-auto p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold">Reading Notes</h1>
            <div className="flex gap-3">
              <button
                onClick={exportData}
                className={`px-4 py-2 rounded-lg border ${borderColor} flex items-center gap-2 hover:bg-opacity-80`}
              >
                Export Data
              </button>
              <button
                onClick={() => setDarkMode(!darkMode)}
                className={`p-3 rounded-full ${cardBg} border ${borderColor}`}
              >
                {darkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              <button
                onClick={() => setShowAddBook(true)}
                className={`${buttonBg} text-white px-4 py-2 rounded-lg flex items-center gap-2`}
              >
                <Plus size={20} />
                Add Book
              </button>
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
      </div>
    );
  }

  // Voice Detail View
  if (currentView === 'voiceDetail') {
    return (
      <div className={`min-h-screen ${theme} transition-colors`}>
        <div className="max-w-4xl mx-auto p-6">
          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => {
                setCurrentView('book');
                setCurrentVoiceEntry(null);
              }}
              className={`px-4 py-2 rounded-lg border ${borderColor}`}
            >
              ← Back
            </button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">Voice Note</h1>
              <p className="text-sm opacity-70">{formatDate(currentVoiceEntry.timestamp)}</p>
            </div>
            <button
              onClick={deleteVoiceDetail}
              className="p-2 rounded-lg hover:bg-red-500 hover:text-white transition-colors"
            >
              <Trash2 size={20} />
            </button>
          </div>

          {/* Content */}
          <div className={`${cardBg} border ${borderColor} rounded-lg p-6`}>
            {isEditingVoiceDetail ? (
              <div>
                <textarea
                  value={editingVoiceText}
                  onChange={(e) => setEditingVoiceText(e.target.value)}
                  className={`w-full ${inputBg} border ${borderColor} rounded-lg p-4 min-h-[300px] text-base leading-relaxed`}
                  autoFocus
                />
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={cancelEditVoice}
                    className={`flex-1 px-4 py-3 rounded-lg border ${borderColor}`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveEditVoice}
                    className={`flex-1 ${buttonBg} text-white px-4 py-3 rounded-lg flex items-center justify-center gap-2`}
                  >
                    <Save size={20} />
                    Save Changes
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <p className="whitespace-pre-wrap text-base leading-relaxed mb-6">
                  {currentVoiceEntry.rawText}
                </p>
                <button
                  onClick={() => setIsEditingVoiceDetail(true)}
                  className={`w-full ${buttonBg} text-white px-4 py-3 rounded-lg flex items-center justify-center gap-2`}
                >
                  <Edit2 size={20} />
                  Edit Note
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Book View
  return (
    <div className={`min-h-screen ${theme} transition-colors`}>
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
                        startEditVoice(entry);
                      }}
                      className="p-2 rounded-lg hover:bg-blue-500 hover:text-white transition-colors"
                    >
                      <Edit2 size={16} />
                    </button>
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
                  <p className="whitespace-nowrap overflow-hidden text-ellipsis pr-20">{entry.rawText}</p>
                  <p className="text-xs opacity-50 mt-1">Click to view full note</p>
                </div>
              ))}
              
              {currentBook.voiceEntries.length === 0 && (
                <div className="text-center py-12 opacity-60">
                  <p>No voice notes yet. Click the mic button to record!</p>
                </div>
              )}
            </div>

            {/* Recording UI */}
            <div className="fixed bottom-6 left-0 right-0 px-6 z-10">
              <div className="max-w-4xl mx-auto">
                {!isRecording && !editingTranscript && (
                  <button
                    onClick={startRecording}
                    className={`w-full ${buttonBg} text-white py-4 rounded-lg flex items-center justify-center gap-2 shadow-lg`}
                  >
                    <Mic size={24} />
                    Start Recording
                  </button>
                )}

                {isRecording && (
                  <div className={`${cardBg} border ${borderColor} rounded-lg p-4 shadow-lg`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                        <span className="font-medium">Recording...</span>
                      </div>
                      <button
                        onClick={stopRecording}
                        className={`${buttonBg} text-white px-6 py-2 rounded-lg`}
                      >
                        Stop
                      </button>
                    </div>
                    {transcript && (
                      <p className="text-sm opacity-80 whitespace-pre-wrap">{transcript}</p>
                    )}
                  </div>
                )}

                {editingTranscript && (
                  <div className={`${cardBg} border ${borderColor} rounded-lg p-4 shadow-lg`}>
                    <textarea
                      value={tempTranscript}
                      onChange={(e) => setTempTranscript(e.target.value)}
                      className={`w-full ${inputBg} border ${borderColor} rounded-lg p-3 mb-3 min-h-[120px]`}
                      placeholder="Edit your transcript..."
                    />
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setEditingTranscript(false);
                          setTempTranscript('');
                          setTranscript('');
                        }}
                        className={`flex-1 px-4 py-2 rounded-lg border ${borderColor}`}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={saveVoiceEntry}
                        className={`flex-1 ${buttonBg} text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2`}
                      >
                        <Check size={20} />
                        Save
                      </button>
                    </div>
                  </div>
                )}
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
                  {editingTypeId === entry.id ? (
                    <div>
                      <input
                        type="text"
                        value={editingTypeText}
                        onChange={(e) => setEditingTypeText(e.target.value)}
                        className={`w-full ${inputBg} border ${borderColor} rounded-lg p-3 mb-3`}
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={cancelEditType}
                          className={`flex-1 px-3 py-2 rounded-lg border ${borderColor} text-sm`}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={saveEditType}
                          className={`flex-1 ${buttonBg} text-white px-3 py-2 rounded-lg text-sm flex items-center justify-center gap-1`}
                        >
                          <Save size={16} />
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
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
                  )}
                </div>
              ))}
              
              {currentBook.typeEntries.length === 0 && (
                <div className="text-center py-12 opacity-60">
                  <p>No quick notes yet. Click the + button to add one!</p>
                </div>
              )}
            </div>

            {/* Add Button */}
            <div className="fixed bottom-6 left-0 right-0 px-6 z-10">
              <div className="max-w-4xl mx-auto">
                {!showAddType ? (
                  <button
                    onClick={() => setShowAddType(true)}
                    className={`w-full ${buttonBg} text-white py-4 rounded-lg flex items-center justify-center gap-2 shadow-lg`}
                  >
                    <Plus size={24} />
                    Add Quick Note
                  </button>
                ) : (
                  <div className={`${cardBg} border ${borderColor} rounded-lg p-4 shadow-lg`}>
                    <input
                      type="text"
                      value={newTypeText}
                      onChange={(e) => setNewTypeText(e.target.value)}
                      placeholder="Enter text (max 10 words)"
                      className={`w-full ${inputBg} border ${borderColor} rounded-lg p-3 mb-3`}
                      onKeyPress={(e) => e.key === 'Enter' && addTypeEntry()}
                      autoFocus
                    />
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setShowAddType(false);
                          setNewTypeText('');
                        }}
                        className={`flex-1 px-4 py-2 rounded-lg border ${borderColor}`}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={addTypeEntry}
                        className={`flex-1 ${buttonBg} text-white px-4 py-2 rounded-lg`}
                      >
                        Add
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;