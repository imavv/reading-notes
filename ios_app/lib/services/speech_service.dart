import 'package:speech_to_text/speech_to_text.dart';
import 'package:speech_to_text/speech_recognition_result.dart';
import 'package:speech_to_text/speech_recognition_error.dart';

class SpeechService {
  final SpeechToText _speechToText = SpeechToText();
  bool _isInitialized = false;
  bool _isListening = false;

  Function(String)? onResult;
  Function(String)? onError;
  Function()? onListeningStarted;
  Function()? onListeningStopped;

  bool get isListening => _isListening;
  bool get isAvailable => _isInitialized;

  Future<bool> initialize() async {
    if (_isInitialized) return true;

    _isInitialized = await _speechToText.initialize(
      onError: _onError,
      onStatus: _onStatus,
    );

    return _isInitialized;
  }

  Future<void> startListening() async {
    if (!_isInitialized) {
      final success = await initialize();
      if (!success) {
        onError?.call('Speech recognition not available');
        return;
      }
    }

    if (_isListening) return;

    _isListening = true;
    onListeningStarted?.call();

    await _speechToText.listen(
      onResult: _onSpeechResult,
      listenFor: const Duration(minutes: 5),
      pauseFor: const Duration(seconds: 3),
      partialResults: true,
      localeId: 'en_US',
      cancelOnError: false,
      listenMode: ListenMode.dictation,
    );
  }

  Future<void> stopListening() async {
    if (!_isListening) return;

    await _speechToText.stop();

    // Small delay to ensure final transcript is captured
    await Future.delayed(const Duration(milliseconds: 300));

    _isListening = false;
    onListeningStopped?.call();
  }

  Future<void> cancelListening() async {
    await _speechToText.cancel();
    _isListening = false;
    onListeningStopped?.call();
  }

  void _onSpeechResult(SpeechRecognitionResult result) {
    onResult?.call(result.recognizedWords);
  }

  void _onError(SpeechRecognitionError error) {
    onError?.call(error.errorMsg);
    _isListening = false;
    onListeningStopped?.call();
  }

  void _onStatus(String status) {
    if (status == 'done' || status == 'notListening') {
      _isListening = false;
      onListeningStopped?.call();
    }
  }

  void dispose() {
    _speechToText.stop();
    _speechToText.cancel();
  }
}
