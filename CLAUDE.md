# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

- `npm start` - Run development server at http://localhost:3000
- `npm test` - Run Jest tests in watch mode
- `npm run build` - Create production build in `/build`

**Note:** Voice recording requires HTTPS. Use Vercel deployment URL for testing microphone features, not localhost.

## Architecture

Bookworm is a single-page React PWA for capturing book notes via voice and text input. The entire app lives in `src/App.js`.

### View States

The app has three views controlled by the `selectedBook` and `selectedVoiceEntry` state:
1. **List View** - Shows all books sorted by last edited
2. **Book View** - Two-tab view (Voice Notes / Quick Notes) for a selected book
3. **Voice Detail View** - Full-screen editing for a single voice note

### Data Layer

- **IndexedDB** - All book data persists in `BookwormDB` database, `books` object store
- **Supabase** - Optional cloud sync when signed in with Google
- **localStorage** - Dark mode preference only

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

### Technical learning

For every project, write a detailed FORATMA.md file that explains the whole project in plain language. 

Explain the technical architecture, the structure of the codebase and how the various parts are connected, the technologies used, why we made these technical decisions, and lessons I can learn from it (this should include the bugs we ran into and how we fixed them, potential pitfalls and how to avoid them in the future, new technologies used, how good engineers think and work, best practices, etc).

For each new feature you add, every bug you fix, code you refactor, basically any medium-to-major changes you make to the codebase, i want you to log them into the bottom of FORATMA.md file showing: 1/ the date or timestamp of change 2/ what you changed 3/ the decision and trade-offs. i expect this file to grow longer as the project evolves to a more mature stage, and i can always revisit the file to recall the technical learnings.

It should be very engaging to read; don't make it sound like boring technical documentation/textbook. Where appropriate, use analogies and anecdotes to make it more understandable and memorable.
