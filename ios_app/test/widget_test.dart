import 'package:flutter_test/flutter_test.dart';
import 'package:reading_notes/models/type_entry.dart';

void main() {
  group('TypeEntry', () {
    test('enforceWordLimit returns text unchanged when under limit', () {
      const text = 'This is a test';
      final result = TypeEntry.enforceWordLimit(text);
      expect(result, text);
    });

    test('enforceWordLimit truncates text when over limit', () {
      const text = 'One two three four five six seven eight nine ten eleven twelve';
      final result = TypeEntry.enforceWordLimit(text);
      expect(result, 'One two three four five six seven eight nine ten');
    });

    test('getWordCount returns correct count', () {
      expect(TypeEntry.getWordCount(''), 0);
      expect(TypeEntry.getWordCount('hello'), 1);
      expect(TypeEntry.getWordCount('hello world'), 2);
      expect(TypeEntry.getWordCount('one two three'), 3);
    });
  });
}
