import 'package:hive/hive.dart';

part 'voice_entry.g.dart';

@HiveType(typeId: 1)
class VoiceEntry extends HiveObject {
  @HiveField(0)
  String id;

  @HiveField(1)
  String rawText;

  @HiveField(2)
  DateTime timestamp;

  VoiceEntry({
    required this.id,
    required this.rawText,
    required this.timestamp,
  });

  VoiceEntry copyWith({
    String? id,
    String? rawText,
    DateTime? timestamp,
  }) {
    return VoiceEntry(
      id: id ?? this.id,
      rawText: rawText ?? this.rawText,
      timestamp: timestamp ?? this.timestamp,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'rawText': rawText,
      'timestamp': timestamp.toIso8601String(),
    };
  }

  factory VoiceEntry.fromJson(Map<String, dynamic> json) {
    return VoiceEntry(
      id: json['id'] as String,
      rawText: json['rawText'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
    );
  }
}
