import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../models/book.dart';
import '../models/type_entry.dart';
import '../providers/book_provider.dart';
import '../services/speech_service.dart';
import '../widgets/voice_entry_card.dart';
import '../widgets/type_entry_card.dart';
import '../widgets/add_book_dialog.dart';
import 'voice_detail_screen.dart';

class BookDetailScreen extends StatefulWidget {
  final String bookId;

  const BookDetailScreen({super.key, required this.bookId});

  @override
  State<BookDetailScreen> createState() => _BookDetailScreenState();
}

class _BookDetailScreenState extends State<BookDetailScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final TextEditingController _quickNoteController = TextEditingController();
  final SpeechService _speechService = SpeechService();

  bool _isRecording = false;
  String _currentTranscript = '';

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _initSpeechService();
  }

  Future<void> _initSpeechService() async {
    await _speechService.initialize();
    _speechService.onResult = (text) {
      setState(() {
        _currentTranscript = text;
      });
    };
    _speechService.onListeningStopped = () {
      if (_currentTranscript.isNotEmpty) {
        _saveVoiceEntry();
      }
      setState(() {
        _isRecording = false;
      });
    };
    _speechService.onError = (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Speech error: $error')),
        );
      }
    };
  }

  @override
  void dispose() {
    _tabController.dispose();
    _quickNoteController.dispose();
    _speechService.dispose();
    super.dispose();
  }

  void _toggleRecording() async {
    if (_isRecording) {
      await _speechService.stopListening();
    } else {
      setState(() {
        _currentTranscript = '';
        _isRecording = true;
      });
      await _speechService.startListening();
    }
  }

  void _saveVoiceEntry() {
    if (_currentTranscript.isNotEmpty) {
      context.read<BookProvider>().addVoiceEntry(widget.bookId, _currentTranscript);
      setState(() {
        _currentTranscript = '';
      });
    }
  }

  void _addQuickNote() {
    final text = _quickNoteController.text.trim();
    if (text.isEmpty) return;

    context.read<BookProvider>().addTypeEntry(widget.bookId, text);
    _quickNoteController.clear();
  }

  Future<void> _showEditBookDialog(Book book) async {
    final result = await showDialog<Map<String, String>>(
      context: context,
      builder: (context) => AddBookDialog(
        initialTitle: book.title,
        initialAuthor: book.author,
        isEditing: true,
      ),
    );

    if (result != null && mounted) {
      final success = await context.read<BookProvider>().updateBook(
        book.id,
        result['title']!,
        result['author']!,
      );

      if (!success && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('A book with this title and author already exists'),
            backgroundColor: Colors.orange,
          ),
        );
      }
    }
  }

  Future<void> _deleteBook() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Book'),
        content: const Text('Are you sure you want to delete this book and all its notes?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: const Text('Delete'),
          ),
        ],
      ),
    );

    if (confirm == true && mounted) {
      await context.read<BookProvider>().deleteBook(widget.bookId);
      Navigator.pop(context);
    }
  }

  Future<void> _searchGoogle(String query) async {
    final encodedQuery = Uri.encodeComponent(query);
    final url = Uri.parse('https://www.google.com/search?q=$encodedQuery');
    if (await canLaunchUrl(url)) {
      await launchUrl(url, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    final book = context.watch<BookProvider>().getBook(widget.bookId);

    if (book == null) {
      return const Scaffold(
        body: Center(child: Text('Book not found')),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              book.title,
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            Text(
              book.author,
              style: TextStyle(
                fontSize: 12,
                color: Theme.of(context).colorScheme.onSurface.withOpacity(0.6),
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.search),
            onPressed: () => _searchGoogle('${book.title} ${book.author}'),
            tooltip: 'Search on Google',
          ),
          PopupMenuButton<String>(
            onSelected: (value) {
              if (value == 'edit') {
                _showEditBookDialog(book);
              } else if (value == 'delete') {
                _deleteBook();
              }
            },
            itemBuilder: (context) => [
              const PopupMenuItem(
                value: 'edit',
                child: Row(
                  children: [
                    Icon(Icons.edit),
                    SizedBox(width: 8),
                    Text('Edit'),
                  ],
                ),
              ),
              const PopupMenuItem(
                value: 'delete',
                child: Row(
                  children: [
                    Icon(Icons.delete, color: Colors.red),
                    SizedBox(width: 8),
                    Text('Delete', style: TextStyle(color: Colors.red)),
                  ],
                ),
              ),
            ],
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          tabs: const [
            Tab(text: 'Voice Notes'),
            Tab(text: 'Quick Notes'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildVoiceNotesTab(book),
          _buildQuickNotesTab(book),
        ],
      ),
    );
  }

  Widget _buildVoiceNotesTab(Book book) {
    return Column(
      children: [
        // Recording area
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Theme.of(context).cardTheme.color,
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.05),
                blurRadius: 4,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Column(
            children: [
              if (_currentTranscript.isNotEmpty || _isRecording)
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  margin: const EdgeInsets.only(bottom: 12),
                  decoration: BoxDecoration(
                    color: Theme.of(context).scaffoldBackgroundColor,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: _isRecording ? Colors.red : Colors.grey.withOpacity(0.3),
                    ),
                  ),
                  child: Text(
                    _currentTranscript.isEmpty ? 'Listening...' : _currentTranscript,
                    style: TextStyle(
                      color: _currentTranscript.isEmpty
                          ? Colors.grey
                          : Theme.of(context).colorScheme.onSurface,
                    ),
                  ),
                ),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  GestureDetector(
                    onTap: _toggleRecording,
                    child: Container(
                      width: 64,
                      height: 64,
                      decoration: BoxDecoration(
                        color: _isRecording ? Colors.red : Colors.blue,
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                            color: (_isRecording ? Colors.red : Colors.blue)
                                .withOpacity(0.3),
                            blurRadius: 12,
                            spreadRadius: 2,
                          ),
                        ],
                      ),
                      child: Icon(
                        _isRecording ? Icons.stop : Icons.mic,
                        color: Colors.white,
                        size: 28,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                _isRecording ? 'Tap to stop' : 'Tap to record',
                style: TextStyle(
                  fontSize: 12,
                  color: Colors.grey[600],
                ),
              ),
            ],
          ),
        ),
        // Voice entries list
        Expanded(
          child: book.voiceEntries.isEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.mic_none, size: 48, color: Colors.grey[400]),
                      const SizedBox(height: 8),
                      Text(
                        'No voice notes yet',
                        style: TextStyle(color: Colors.grey[600]),
                      ),
                    ],
                  ),
                )
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: book.voiceEntries.length,
                  itemBuilder: (context, index) {
                    // Show newest first
                    final entry = book.voiceEntries[book.voiceEntries.length - 1 - index];
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: VoiceEntryCard(
                        entry: entry,
                        onTap: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (context) => VoiceDetailScreen(
                                bookId: widget.bookId,
                                entryId: entry.id,
                              ),
                            ),
                          );
                        },
                        onDelete: () {
                          context.read<BookProvider>().deleteVoiceEntry(
                            widget.bookId,
                            entry.id,
                          );
                        },
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }

  Widget _buildQuickNotesTab(Book book) {
    final wordCount = TypeEntry.getWordCount(_quickNoteController.text);
    final isOverLimit = wordCount > 10;

    return Column(
      children: [
        // Input area
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Theme.of(context).cardTheme.color,
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.05),
                blurRadius: 4,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              TextField(
                controller: _quickNoteController,
                maxLines: 2,
                decoration: InputDecoration(
                  hintText: 'Add a quick note (max 10 words)...',
                  suffixIcon: IconButton(
                    icon: const Icon(Icons.send),
                    onPressed: _addQuickNote,
                  ),
                ),
                onChanged: (text) => setState(() {}),
                onSubmitted: (_) => _addQuickNote(),
              ),
              const SizedBox(height: 4),
              Text(
                '$wordCount/10 words',
                style: TextStyle(
                  fontSize: 12,
                  color: isOverLimit ? Colors.red : Colors.grey[600],
                ),
              ),
            ],
          ),
        ),
        // Quick notes list
        Expanded(
          child: book.typeEntries.isEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.notes, size: 48, color: Colors.grey[400]),
                      const SizedBox(height: 8),
                      Text(
                        'No quick notes yet',
                        style: TextStyle(color: Colors.grey[600]),
                      ),
                    ],
                  ),
                )
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: book.typeEntries.length,
                  itemBuilder: (context, index) {
                    // Show newest first
                    final entry = book.typeEntries[book.typeEntries.length - 1 - index];
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: TypeEntryCard(
                        entry: entry,
                        onEdit: (newText) {
                          context.read<BookProvider>().updateTypeEntry(
                            widget.bookId,
                            entry.id,
                            newText,
                          );
                        },
                        onDelete: () {
                          context.read<BookProvider>().deleteTypeEntry(
                            widget.bookId,
                            entry.id,
                          );
                        },
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }
}
