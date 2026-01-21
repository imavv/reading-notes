# Reading Notes - Flutter iOS App

A native iOS app for capturing reading notes via voice recording and text input.

## Setup Instructions

### Prerequisites

1. Install Flutter SDK: https://docs.flutter.dev/get-started/install
2. Install Xcode from the App Store
3. Set up iOS development environment:
   ```bash
   sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
   sudo xcodebuild -runFirstLaunch
   ```

### Project Setup

1. Navigate to the ios_app directory:
   ```bash
   cd ios_app
   ```

2. Get Flutter dependencies:
   ```bash
   flutter pub get
   ```

3. Generate Hive type adapters (if making model changes):
   ```bash
   flutter pub run build_runner build
   ```

4. Run on iOS Simulator:
   ```bash
   flutter run
   ```

5. Run on physical iPhone (connect device via USB):
   ```bash
   flutter run -d <device-id>
   ```
   To list available devices: `flutter devices`

### Build for Release

```bash
flutter build ios --release
```

Then open `ios/Runner.xcworkspace` in Xcode to archive and submit to App Store.

## Features

- **Book Management**: Add, edit, and delete books with title and author
- **Voice Notes**: Record voice notes with live transcription
- **Quick Notes**: Add short text notes (10-word limit)
- **Dark/Light Mode**: Toggle between themes (persisted)
- **Search**: Search books by title or author
- **Google Search**: Quick search for book information
- **Export**: Export all notes to JSON file

## Architecture

- **State Management**: Provider pattern
- **Local Storage**: Hive (lightweight NoSQL)
- **Speech Recognition**: speech_to_text package (uses native iOS Speech framework)

## File Structure

```
lib/
├── main.dart              # App entry point
├── models/                # Data models with Hive annotations
│   ├── book.dart
│   ├── voice_entry.dart
│   └── type_entry.dart
├── services/              # Business logic
│   ├── database_service.dart
│   └── speech_service.dart
├── providers/             # State management
│   ├── book_provider.dart
│   └── theme_provider.dart
├── screens/               # UI screens
│   ├── book_list_screen.dart
│   ├── book_detail_screen.dart
│   └── voice_detail_screen.dart
└── widgets/               # Reusable components
    ├── book_card.dart
    ├── voice_entry_card.dart
    ├── type_entry_card.dart
    └── add_book_dialog.dart
```

## iOS Permissions

The app requires the following permissions (configured in `ios/Runner/Info.plist`):
- **Microphone**: For voice recording
- **Speech Recognition**: For transcription

## Testing

Voice recording requires a physical iOS device. The iOS Simulator does not support microphone input for speech recognition.
