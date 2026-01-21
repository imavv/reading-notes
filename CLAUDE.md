# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

- `npm start` - Run development server at http://localhost:3000
- `npm test` - Run Jest tests in watch mode
- `npm run build` - Create production build in `/build`

**Note:** Voice recording requires HTTPS. Use Vercel deployment URL for testing microphone features, not localhost.

## Architecture

This is a single-page React application for capturing reading notes via voice and text input. The entire app lives in `src/App.js` (~960 lines).

### View States

The app has three views controlled by the `selectedBook` and `selectedVoiceEntry` state:
1. **List View** - Shows all books sorted by last edited
2. **Book View** - Two-tab view (Voice Notes / Quick Notes) for a selected book
3. **Voice Detail View** - Full-screen editing for a single voice note

### Data Layer

- **IndexedDB** - All book data persists in `ReadingNotesDB` database, `books` object store
- **localStorage** - Dark mode preference only
- No backend; all data is browser-local

### Data Model

```javascript
Book: { id, title, author, lastEdited, voiceEntries[], typeEntries[] }
VoiceEntry: { id, rawText, timestamp }
TypeEntry: { id, text, timestamp }  // 10-word limit enforced
```

### Key Technologies

- React 19 with hooks (no class components)
- Tailwind CSS via CDN (in `public/index.html`)
- Lucide React for icons
- Web Speech Recognition API (Chrome/Safari)
- Navigator MediaDevices API for microphone access

### Voice Recording Notes

The app handles browser-specific speech recognition quirks:
- Uses `webkitSpeechRecognition` for Chrome, `SpeechRecognition` for Safari
- iOS requires explicit microphone permission request before recording
- Recording uses continuous mode with manual restart handling
- 300ms delay after stopping ensures final transcript capture

### Export Feature

The export button downloads all books as JSON with formatted dates (readable timestamps instead of epoch).
