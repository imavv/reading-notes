import 'package:flutter/material.dart';
import 'package:uuid/uuid.dart';
import '../models/book.dart';
import '../models/voice_entry.dart';
import '../models/type_entry.dart';
import '../services/database_service.dart';

class BookProvider extends ChangeNotifier {
  List<Book> _books = [];
  String _searchQuery = '';
  final _uuid = const Uuid();

  List<Book> get books {
    if (_searchQuery.isEmpty) {
      return List.from(_books)..sort((a, b) => b.lastEdited.compareTo(a.lastEdited));
    }
    return DatabaseService.searchBooks(_searchQuery)
      ..sort((a, b) => b.lastEdited.compareTo(a.lastEdited));
  }

  String get searchQuery => _searchQuery;

  BookProvider() {
    loadBooks();
  }

  void loadBooks() {
    _books = DatabaseService.getAllBooks();
    notifyListeners();
  }

  void setSearchQuery(String query) {
    _searchQuery = query;
    notifyListeners();
  }

  void clearSearch() {
    _searchQuery = '';
    notifyListeners();
  }

  Book? getBook(String id) {
    try {
      return _books.firstWhere((book) => book.id == id);
    } catch (e) {
      return null;
    }
  }

  bool isDuplicate(String title, String author, {String? excludeId}) {
    return DatabaseService.isDuplicate(title, author, excludeId: excludeId);
  }

  Future<Book?> addBook(String title, String author) async {
    if (isDuplicate(title, author)) {
      return null; // Duplicate detected
    }

    final book = Book(
      id: _uuid.v4(),
      title: title.trim(),
      author: author.trim(),
      lastEdited: DateTime.now(),
    );

    await DatabaseService.saveBook(book);
    loadBooks();
    return book;
  }

  Future<bool> updateBook(String id, String title, String author) async {
    if (isDuplicate(title, author, excludeId: id)) {
      return false; // Duplicate detected
    }

    final book = getBook(id);
    if (book == null) return false;

    final updatedBook = book.copyWith(
      title: title.trim(),
      author: author.trim(),
      lastEdited: DateTime.now(),
    );

    await DatabaseService.saveBook(updatedBook);
    loadBooks();
    return true;
  }

  Future<void> deleteBook(String id) async {
    await DatabaseService.deleteBook(id);
    loadBooks();
  }

  // Voice Entry operations
  Future<void> addVoiceEntry(String bookId, String rawText) async {
    final book = getBook(bookId);
    if (book == null) return;

    final entry = VoiceEntry(
      id: _uuid.v4(),
      rawText: rawText.trim(),
      timestamp: DateTime.now(),
    );

    final updatedBook = book.copyWith(
      voiceEntries: [...book.voiceEntries, entry],
      lastEdited: DateTime.now(),
    );

    await DatabaseService.saveBook(updatedBook);
    loadBooks();
  }

  Future<void> updateVoiceEntry(String bookId, String entryId, String rawText) async {
    final book = getBook(bookId);
    if (book == null) return;

    final updatedEntries = book.voiceEntries.map((entry) {
      if (entry.id == entryId) {
        return entry.copyWith(rawText: rawText.trim());
      }
      return entry;
    }).toList();

    final updatedBook = book.copyWith(
      voiceEntries: updatedEntries,
      lastEdited: DateTime.now(),
    );

    await DatabaseService.saveBook(updatedBook);
    loadBooks();
  }

  Future<void> deleteVoiceEntry(String bookId, String entryId) async {
    final book = getBook(bookId);
    if (book == null) return;

    final updatedBook = book.copyWith(
      voiceEntries: book.voiceEntries.where((e) => e.id != entryId).toList(),
      lastEdited: DateTime.now(),
    );

    await DatabaseService.saveBook(updatedBook);
    loadBooks();
  }

  // Type Entry operations
  Future<void> addTypeEntry(String bookId, String text) async {
    final book = getBook(bookId);
    if (book == null) return;

    // Enforce 10-word limit
    final limitedText = TypeEntry.enforceWordLimit(text);

    final entry = TypeEntry(
      id: _uuid.v4(),
      text: limitedText,
      timestamp: DateTime.now(),
    );

    final updatedBook = book.copyWith(
      typeEntries: [...book.typeEntries, entry],
      lastEdited: DateTime.now(),
    );

    await DatabaseService.saveBook(updatedBook);
    loadBooks();
  }

  Future<void> updateTypeEntry(String bookId, String entryId, String text) async {
    final book = getBook(bookId);
    if (book == null) return;

    // Enforce 10-word limit
    final limitedText = TypeEntry.enforceWordLimit(text);

    final updatedEntries = book.typeEntries.map((entry) {
      if (entry.id == entryId) {
        return entry.copyWith(text: limitedText);
      }
      return entry;
    }).toList();

    final updatedBook = book.copyWith(
      typeEntries: updatedEntries,
      lastEdited: DateTime.now(),
    );

    await DatabaseService.saveBook(updatedBook);
    loadBooks();
  }

  Future<void> deleteTypeEntry(String bookId, String entryId) async {
    final book = getBook(bookId);
    if (book == null) return;

    final updatedBook = book.copyWith(
      typeEntries: book.typeEntries.where((e) => e.id != entryId).toList(),
      lastEdited: DateTime.now(),
    );

    await DatabaseService.saveBook(updatedBook);
    loadBooks();
  }

  // Export
  Future<void> exportAllBooks() async {
    await DatabaseService.shareExport();
  }
}
