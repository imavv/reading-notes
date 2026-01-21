import 'package:hive/hive.dart';

part 'type_entry.g.dart';

@HiveType(typeId: 2)
class TypeEntry extends HiveObject {
  @HiveField(0)
  String id;

  @HiveField(1)
  String text;

  @HiveField(2)
  DateTime timestamp;

  TypeEntry({
    required this.id,
    required this.text,
    required this.timestamp,
  });

  TypeEntry copyWith({
    String? id,
    String? text,
    DateTime? timestamp,
  }) {
    return TypeEntry(
      id: id ?? this.id,
      text: text ?? this.text,
      timestamp: timestamp ?? this.timestamp,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'text': text,
      'timestamp': timestamp.toIso8601String(),
    };
  }

  factory TypeEntry.fromJson(Map<String, dynamic> json) {
    return TypeEntry(
      id: json['id'] as String,
      text: json['text'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
    );
  }

  /// Validates and enforces 10-word limit
  static String enforceWordLimit(String text, {int maxWords = 10}) {
    final words = text.trim().split(RegExp(r'\s+'));
    if (words.length <= maxWords) {
      return text;
    }
    return words.take(maxWords).join(' ');
  }

  /// Returns word count
  static int getWordCount(String text) {
    if (text.trim().isEmpty) return 0;
    return text.trim().split(RegExp(r'\s+')).length;
  }
}
