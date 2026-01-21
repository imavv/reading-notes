import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../providers/book_provider.dart';

class VoiceDetailScreen extends StatefulWidget {
  final String bookId;
  final String entryId;

  const VoiceDetailScreen({
    super.key,
    required this.bookId,
    required this.entryId,
  });

  @override
  State<VoiceDetailScreen> createState() => _VoiceDetailScreenState();
}

class _VoiceDetailScreenState extends State<VoiceDetailScreen> {
  final TextEditingController _textController = TextEditingController();
  bool _isEditing = false;
  bool _hasChanges = false;

  @override
  void initState() {
    super.initState();
    _loadEntry();
  }

  void _loadEntry() {
    final book = context.read<BookProvider>().getBook(widget.bookId);
    if (book != null) {
      final entry = book.voiceEntries.firstWhere(
        (e) => e.id == widget.entryId,
        orElse: () => throw Exception('Entry not found'),
      );
      _textController.text = entry.rawText;
    }
  }

  @override
  void dispose() {
    _textController.dispose();
    super.dispose();
  }

  void _toggleEdit() {
    setState(() {
      _isEditing = !_isEditing;
      if (!_isEditing) {
        // Cancelled editing, reload original
        _loadEntry();
        _hasChanges = false;
      }
    });
  }

  Future<void> _saveChanges() async {
    await context.read<BookProvider>().updateVoiceEntry(
      widget.bookId,
      widget.entryId,
      _textController.text,
    );
    setState(() {
      _isEditing = false;
      _hasChanges = false;
    });
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Changes saved')),
      );
    }
  }

  Future<void> _deleteEntry() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Voice Note'),
        content: const Text('Are you sure you want to delete this voice note?'),
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
      await context.read<BookProvider>().deleteVoiceEntry(
        widget.bookId,
        widget.entryId,
      );
      Navigator.pop(context);
    }
  }

  Future<bool> _onWillPop() async {
    if (_hasChanges) {
      final result = await showDialog<String>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Unsaved Changes'),
          content: const Text('You have unsaved changes. What would you like to do?'),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, 'discard'),
              child: const Text('Discard'),
            ),
            TextButton(
              onPressed: () => Navigator.pop(context, 'cancel'),
              child: const Text('Cancel'),
            ),
            TextButton(
              onPressed: () => Navigator.pop(context, 'save'),
              child: const Text('Save'),
            ),
          ],
        ),
      );

      if (result == 'save') {
        await _saveChanges();
        return true;
      } else if (result == 'discard') {
        return true;
      }
      return false;
    }
    return true;
  }

  @override
  Widget build(BuildContext context) {
    final book = context.watch<BookProvider>().getBook(widget.bookId);
    if (book == null) {
      return const Scaffold(
        body: Center(child: Text('Book not found')),
      );
    }

    final entry = book.voiceEntries.firstWhere(
      (e) => e.id == widget.entryId,
      orElse: () => throw Exception('Entry not found'),
    );

    final dateFormat = DateFormat('MMMM d, yyyy • h:mm a');

    return WillPopScope(
      onWillPop: _onWillPop,
      child: Scaffold(
        appBar: AppBar(
          title: Text(dateFormat.format(entry.timestamp)),
          actions: [
            if (_isEditing) ...[
              TextButton(
                onPressed: _toggleEdit,
                child: const Text('Cancel'),
              ),
              TextButton(
                onPressed: _hasChanges ? _saveChanges : null,
                child: const Text('Save'),
              ),
            ] else ...[
              IconButton(
                icon: const Icon(Icons.edit),
                onPressed: _toggleEdit,
              ),
              IconButton(
                icon: const Icon(Icons.delete),
                onPressed: _deleteEntry,
              ),
            ],
          ],
        ),
        body: Padding(
          padding: const EdgeInsets.all(16),
          child: _isEditing
              ? TextField(
                  controller: _textController,
                  maxLines: null,
                  expands: true,
                  textAlignVertical: TextAlignVertical.top,
                  decoration: const InputDecoration(
                    hintText: 'Edit your voice note...',
                    border: OutlineInputBorder(),
                  ),
                  onChanged: (text) {
                    setState(() {
                      _hasChanges = text != entry.rawText;
                    });
                  },
                )
              : SingleChildScrollView(
                  child: Text(
                    entry.rawText,
                    style: const TextStyle(
                      fontSize: 16,
                      height: 1.6,
                    ),
                  ),
                ),
        ),
      ),
    );
  }
}
