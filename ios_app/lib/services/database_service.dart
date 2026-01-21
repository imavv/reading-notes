import 'dart:convert';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import 'dart:io';
import 'package:intl/intl.dart';
import '../models/book.dart';
import '../models/voice_entry.dart';
import '../models/type_entry.dart';

class DatabaseService {
  static const String _booksBoxName = 'books';
  static const String _settingsBoxName = 'settings';

  static Box<Book>? _booksBox;
  static Box? _settingsBox;

  static Future<void> initialize() async {
    await Hive.initFlutter();

    // Register adapters
    Hive.registerAdapter(BookAdapter());
    Hive.registerAdapter(VoiceEntryAdapter());
    Hive.registerAdapter(TypeEntryAdapter());

    // Open boxes
    _booksBox = await Hive.openBox<Book>(_booksBoxName);
    _settingsBox = await Hive.openBox(_settingsBoxName);
  }

  // Book CRUD operations
  static List<Book> getAllBooks() {
    return _booksBox?.values.toList() ?? [];
  }

  static List<Book> getBooksSortedByLastEdited() {
    final books = getAllBooks();
    books.sort((a, b) => b.lastEdited.compareTo(a.lastEdited));
    return books;
  }

  static Book? getBook(String id) {
    return _booksBox?.values.firstWhere(
      (book) => book.id == id,
      orElse: () => throw Exception('Book not found'),
    );
  }

  static Future<void> saveBook(Book book) async {
    final existingIndex = _booksBox?.values.toList().indexWhere((b) => b.id == book.id);
    if (existingIndex != null && existingIndex >= 0) {
      await _booksBox?.putAt(existingIndex, book);
    } else {
      await _booksBox?.add(book);
    }
  }

  static Future<void> deleteBook(String id) async {
    final index = _booksBox?.values.toList().indexWhere((b) => b.id == id);
    if (index != null && index >= 0) {
      await _booksBox?.deleteAt(index);
    }
  }

  static bool isDuplicate(String title, String author, {String? excludeId}) {
    final books = getAllBooks();
    return books.any((book) =>
        book.id != excludeId &&
        book.title.toLowerCase().trim() == title.toLowerCase().trim() &&
        book.author.toLowerCase().trim() == author.toLowerCase().trim());
  }

  static List<Book> searchBooks(String query) {
    final lowerQuery = query.toLowerCase();
    return getAllBooks().where((book) {
      return book.title.toLowerCase().contains(lowerQuery) ||
          book.author.toLowerCase().contains(lowerQuery);
    }).toList();
  }

  // Settings
  static bool getDarkMode() {
    return _settingsBox?.get('darkMode', defaultValue: false) ?? false;
  }

  static Future<void> setDarkMode(bool value) async {
    await _settingsBox?.put('darkMode', value);
  }

  // Export functionality
  static Future<String> exportAllBooksToJson() async {
    final books = getAllBooks();
    final dateFormat = DateFormat('MMMM d, yyyy h:mm a');

    final exportData = books.map((book) {
      return {
        'id': book.id,
        'title': book.title,
        'author': book.author,
        'lastEdited': dateFormat.format(book.lastEdited),
        'voiceEntries': book.voiceEntries.map((entry) {
          return {
            'id': entry.id,
            'rawText': entry.rawText,
            'timestamp': dateFormat.format(entry.timestamp),
          };
        }).toList(),
        'typeEntries': book.typeEntries.map((entry) {
          return {
            'id': entry.id,
            'text': entry.text,
            'timestamp': dateFormat.format(entry.timestamp),
          };
        }).toList(),
      };
    }).toList();

    return const JsonEncoder.withIndent('  ').convert(exportData);
  }

  static Future<void> shareExport() async {
    final jsonString = await exportAllBooksToJson();
    final directory = await getTemporaryDirectory();
    final timestamp = DateFormat('yyyy-MM-dd_HH-mm').format(DateTime.now());
    final file = File('${directory.path}/reading_notes_$timestamp.json');
    await file.writeAsString(jsonString);

    await Share.shareXFiles(
      [XFile(file.path)],
      text: 'Reading Notes Export',
    );
  }
}
