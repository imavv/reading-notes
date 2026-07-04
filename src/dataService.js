import { supabase, isSupabaseConfigured } from './supabaseClient';

// ============================================
// IndexedDB Functions (Local Storage)
// ============================================

const DB_NAME = 'BookwormDB';
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

// IndexedDB: Get all books
const getAllBooksLocal = async () => {
  const db = await initDB();
  const tx = db.transaction('books', 'readonly');
  const store = tx.objectStore('books');
  return new Promise((resolve) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
  });
};

// IndexedDB: Save book
const saveBookLocal = async (book) => {
  const db = await initDB();
  const tx = db.transaction('books', 'readwrite');
  const store = tx.objectStore('books');
  await store.put(book);
};

// IndexedDB: Delete book
const deleteBookLocal = async (id) => {
  const db = await initDB();
  const tx = db.transaction('books', 'readwrite');
  const store = tx.objectStore('books');
  await store.delete(id);
};

// ============================================
// Supabase Functions (Cloud Storage)
// ============================================

// Convert Supabase book data to app format
const convertFromSupabase = (book, voiceEntries = [], typeEntries = []) => {
  return {
    id: book.id,
    title: book.title,
    author: book.author,
    lastEdited: new Date(book.last_edited).getTime(),
    voiceEntries: voiceEntries.map(e => ({
      id: e.id,
      rawText: e.raw_text,
      summary: e.summary,
      title: e.title,
      timestamp: new Date(e.created_at).getTime()
    })),
    typeEntries: typeEntries.map(e => ({
      id: e.id,
      text: e.text,
      timestamp: new Date(e.created_at).getTime()
    }))
  };
};

// Supabase: Get all books with entries
const getAllBooksCloud = async (userId) => {
  if (!isSupabaseConfigured() || !userId) return [];

  // Get all books
  const { data: books, error: booksError } = await supabase
    .from('books')
    .select('*')
    .eq('user_id', userId)
    .order('last_edited', { ascending: false });

  if (booksError) {
    console.error('Error fetching books:', booksError);
    return [];
  }

  // Get all voice entries and type entries for all books
  const bookIds = books.map(b => b.id);

  const [voiceResult, typeResult] = await Promise.all([
    supabase.from('voice_entries').select('*').in('book_id', bookIds),
    supabase.from('type_entries').select('*').in('book_id', bookIds)
  ]);

  const voiceEntries = voiceResult.data || [];
  const typeEntries = typeResult.data || [];

  // Map entries to books
  return books.map(book => {
    const bookVoiceEntries = voiceEntries
      .filter(e => e.book_id === book.id)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const bookTypeEntries = typeEntries
      .filter(e => e.book_id === book.id)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return convertFromSupabase(book, bookVoiceEntries, bookTypeEntries);
  });
};

// Supabase: Create book
const createBookCloud = async (book, userId) => {
  if (!isSupabaseConfigured() || !userId) return null;

  const { data, error } = await supabase
    .from('books')
    .insert({
      user_id: userId,
      title: book.title,
      author: book.author
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating book:', error);
    return null;
  }

  return {
    id: data.id,
    title: data.title,
    author: data.author,
    lastEdited: new Date(data.last_edited).getTime(),
    voiceEntries: [],
    typeEntries: []
  };
};

// Supabase: Update book last_edited
const updateBookTimestampCloud = async (bookId) => {
  if (!isSupabaseConfigured()) return;

  await supabase
    .from('books')
    .update({ last_edited: new Date().toISOString() })
    .eq('id', bookId);
};

// Supabase: Delete book (cascade deletes entries)
const deleteBookCloud = async (bookId) => {
  if (!isSupabaseConfigured()) return;

  const { error } = await supabase
    .from('books')
    .delete()
    .eq('id', bookId);

  if (error) {
    console.error('Error deleting book:', error);
  }
};

// Supabase: Add voice entry
const addVoiceEntryCloud = async (bookId, entry) => {
  if (!isSupabaseConfigured()) return null;

  const { data, error } = await supabase
    .from('voice_entries')
    .insert({
      book_id: bookId,
      raw_text: entry.rawText,
      summary: entry.summary || null,
      title: entry.title || null
    })
    .select()
    .single();

  if (error) {
    console.error('Error adding voice entry:', error);
    return null;
  }

  await updateBookTimestampCloud(bookId);

  return {
    id: data.id,
    rawText: data.raw_text,
    summary: data.summary,
    title: data.title,
    timestamp: new Date(data.created_at).getTime()
  };
};

// Supabase: Update voice entry
const updateVoiceEntryCloud = async (entryId, updates) => {
  if (!isSupabaseConfigured()) return;

  const updateData = {};
  if (updates.rawText !== undefined) updateData.raw_text = updates.rawText;
  if (updates.summary !== undefined) updateData.summary = updates.summary;
  if (updates.title !== undefined) updateData.title = updates.title;

  const { data, error } = await supabase
    .from('voice_entries')
    .update(updateData)
    .eq('id', entryId)
    .select('book_id')
    .single();

  if (error) {
    console.error('Error updating voice entry:', error);
    return;
  }

  if (data?.book_id) {
    await updateBookTimestampCloud(data.book_id);
  }
};

// Supabase: Delete voice entry
const deleteVoiceEntryCloud = async (entryId) => {
  if (!isSupabaseConfigured()) return;

  // Get book_id first for timestamp update
  const { data: entry } = await supabase
    .from('voice_entries')
    .select('book_id')
    .eq('id', entryId)
    .single();

  const { error } = await supabase
    .from('voice_entries')
    .delete()
    .eq('id', entryId);

  if (error) {
    console.error('Error deleting voice entry:', error);
    return;
  }

  if (entry?.book_id) {
    await updateBookTimestampCloud(entry.book_id);
  }
};

// Supabase: Add type entry
const addTypeEntryCloud = async (bookId, entry) => {
  if (!isSupabaseConfigured()) return null;

  const { data, error } = await supabase
    .from('type_entries')
    .insert({
      book_id: bookId,
      text: entry.text
    })
    .select()
    .single();

  if (error) {
    console.error('Error adding type entry:', error);
    return null;
  }

  await updateBookTimestampCloud(bookId);

  return {
    id: data.id,
    text: data.text,
    timestamp: new Date(data.created_at).getTime()
  };
};

// Supabase: Update type entry
const updateTypeEntryCloud = async (entryId, updates) => {
  if (!isSupabaseConfigured()) return;

  const { data, error } = await supabase
    .from('type_entries')
    .update({ text: updates.text })
    .eq('id', entryId)
    .select('book_id')
    .single();

  if (error) {
    console.error('Error updating type entry:', error);
    return;
  }

  if (data?.book_id) {
    await updateBookTimestampCloud(data.book_id);
  }
};

// Supabase: Delete type entry
const deleteTypeEntryCloud = async (entryId) => {
  if (!isSupabaseConfigured()) return;

  // Get book_id first for timestamp update
  const { data: entry } = await supabase
    .from('type_entries')
    .select('book_id')
    .eq('id', entryId)
    .single();

  const { error } = await supabase
    .from('type_entries')
    .delete()
    .eq('id', entryId);

  if (error) {
    console.error('Error deleting type entry:', error);
    return;
  }

  if (entry?.book_id) {
    await updateBookTimestampCloud(entry.book_id);
  }
};

// ============================================
// Migration Function
// ============================================

export const migrateLocalToCloud = async (userId, onProgress) => {
  if (!isSupabaseConfigured() || !userId) {
    return { success: false, error: 'Not configured or not logged in' };
  }

  try {
    // Check if user already has books in Supabase
    const { data: existingBooks } = await supabase
      .from('books')
      .select('id')
      .eq('user_id', userId)
      .limit(1);

    if (existingBooks && existingBooks.length > 0) {
      // User already has data, skip migration
      return { success: true, migrated: 0, skipped: true };
    }

    // Get local books
    const localBooks = await getAllBooksLocal();

    if (localBooks.length === 0) {
      return { success: true, migrated: 0 };
    }

    let migrated = 0;

    for (const book of localBooks) {
      onProgress?.(`Migrating "${book.title}"...`, migrated, localBooks.length);

      // Create book in Supabase
      const { data: newBook, error: bookError } = await supabase
        .from('books')
        .insert({
          user_id: userId,
          title: book.title,
          author: book.author,
          last_edited: new Date(book.lastEdited).toISOString(),
          created_at: new Date(parseInt(book.id)).toISOString()
        })
        .select()
        .single();

      if (bookError) {
        console.error('Error migrating book:', bookError);
        continue;
      }

      // Migrate voice entries
      if (book.voiceEntries && book.voiceEntries.length > 0) {
        const voiceData = book.voiceEntries.map(e => ({
          book_id: newBook.id,
          raw_text: e.rawText,
          summary: e.summary || null,
          title: e.title || null,
          created_at: new Date(e.timestamp).toISOString()
        }));

        await supabase.from('voice_entries').insert(voiceData);
      }

      // Migrate type entries
      if (book.typeEntries && book.typeEntries.length > 0) {
        const typeData = book.typeEntries.map(e => ({
          book_id: newBook.id,
          text: e.text,
          created_at: new Date(e.timestamp).toISOString()
        }));

        await supabase.from('type_entries').insert(typeData);
      }

      migrated++;
    }

    onProgress?.('Migration complete!', migrated, localBooks.length);
    return { success: true, migrated };
  } catch (error) {
    console.error('Migration error:', error);
    return { success: false, error: error.message };
  }
};

// ============================================
// Unified Data Service
// ============================================

export const dataService = {
  // Get all books
  getAllBooks: async (userId) => {
    if (userId && isSupabaseConfigured()) {
      return getAllBooksCloud(userId);
    }
    return getAllBooksLocal();
  },

  // Create a new book
  createBook: async (bookData, userId) => {
    if (userId && isSupabaseConfigured()) {
      return createBookCloud(bookData, userId);
    }
    // Local mode
    const book = {
      id: Date.now().toString(),
      title: bookData.title,
      author: bookData.author,
      lastEdited: Date.now(),
      voiceEntries: [],
      typeEntries: []
    };
    await saveBookLocal(book);
    return book;
  },

  // Save/update a book (local mode only - cloud uses individual entry operations)
  saveBook: async (book, userId) => {
    if (userId && isSupabaseConfigured()) {
      // In cloud mode, we don't bulk save - individual operations handle this
      // But we can update timestamp
      await updateBookTimestampCloud(book.id);
      return;
    }
    await saveBookLocal(book);
  },

  // Delete a book
  deleteBook: async (bookId, userId) => {
    if (userId && isSupabaseConfigured()) {
      await deleteBookCloud(bookId);
      return;
    }
    await deleteBookLocal(bookId);
  },

  // Add voice entry
  addVoiceEntry: async (bookId, entry, userId) => {
    if (userId && isSupabaseConfigured()) {
      return addVoiceEntryCloud(bookId, entry);
    }
    // Local mode handled in App.js via saveBook
    return null;
  },

  // Update voice entry
  updateVoiceEntry: async (entryId, updates, userId) => {
    if (userId && isSupabaseConfigured()) {
      await updateVoiceEntryCloud(entryId, updates);
    }
    // Local mode handled in App.js via saveBook
  },

  // Delete voice entry
  deleteVoiceEntry: async (entryId, userId) => {
    if (userId && isSupabaseConfigured()) {
      await deleteVoiceEntryCloud(entryId);
    }
    // Local mode handled in App.js via saveBook
  },

  // Add type entry
  addTypeEntry: async (bookId, entry, userId) => {
    if (userId && isSupabaseConfigured()) {
      return addTypeEntryCloud(bookId, entry);
    }
    // Local mode handled in App.js via saveBook
    return null;
  },

  // Update type entry
  updateTypeEntry: async (entryId, updates, userId) => {
    if (userId && isSupabaseConfigured()) {
      await updateTypeEntryCloud(entryId, updates);
    }
    // Local mode handled in App.js via saveBook
  },

  // Delete type entry
  deleteTypeEntry: async (entryId, userId) => {
    if (userId && isSupabaseConfigured()) {
      await deleteTypeEntryCloud(entryId);
    }
    // Local mode handled in App.js via saveBook
  },

  // Check if using cloud storage
  isCloudMode: (userId) => {
    return userId && isSupabaseConfigured();
  }
};

export default dataService;
