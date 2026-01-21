import 'package:hive/hive.dart';
import 'voice_entry.dart';
import 'type_entry.dart';

part 'book.g.dart';

@HiveType(typeId: 0)
class Book extends HiveObject {
  @HiveField(0)
  String id;

  @HiveField(1)
  String title;

  @HiveField(2)
  String author;

  @HiveField(3)
  DateTime lastEdited;

  @HiveField(4)
  List<VoiceEntry> voiceEntries;

  @HiveField(5)
  List<TypeEntry> typeEntries;

  Book({
    required this.id,
    required this.title,
    required this.author,
    required this.lastEdited,
    List<VoiceEntry>? voiceEntries,
    List<TypeEntry>? typeEntries,
  })  : voiceEntries = voiceEntries ?? [],
        typeEntries = typeEntries ?? [];

  Book copyWith({
    String? id,
    String? title,
    String? author,
    DateTime? lastEdited,
    List<VoiceEntry>? voiceEntries,
    List<TypeEntry>? typeEntries,
  }) {
    return Book(
      id: id ?? this.id,
      title: title ?? this.title,
      author: author ?? this.author,
      lastEdited: lastEdited ?? this.lastEdited,
      voiceEntries: voiceEntries ?? this.voiceEntries,
      typeEntries: typeEntries ?? this.typeEntries,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'author': author,
      'lastEdited': lastEdited.toIso8601String(),
      'voiceEntries': voiceEntries.map((e) => e.toJson()).toList(),
      'typeEntries': typeEntries.map((e) => e.toJson()).toList(),
    };
  }

  factory Book.fromJson(Map<String, dynamic> json) {
    return Book(
      id: json['id'] as String,
      title: json['title'] as String,
      author: json['author'] as String,
      lastEdited: DateTime.parse(json['lastEdited'] as String),
      voiceEntries: (json['voiceEntries'] as List<dynamic>?)
              ?.map((e) => VoiceEntry.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      typeEntries: (json['typeEntries'] as List<dynamic>?)
              ?.map((e) => TypeEntry.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }

  /// Check if this book matches another by title and author (case-insensitive)
  bool isDuplicateOf(Book other) {
    return title.toLowerCase().trim() == other.title.toLowerCase().trim() &&
        author.toLowerCase().trim() == other.author.toLowerCase().trim();
  }
}
