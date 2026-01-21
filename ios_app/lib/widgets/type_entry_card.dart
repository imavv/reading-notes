import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/type_entry.dart';

class TypeEntryCard extends StatefulWidget {
  final TypeEntry entry;
  final Function(String) onEdit;
  final VoidCallback onDelete;

  const TypeEntryCard({
    super.key,
    required this.entry,
    required this.onEdit,
    required this.onDelete,
  });

  @override
  State<TypeEntryCard> createState() => _TypeEntryCardState();
}

class _TypeEntryCardState extends State<TypeEntryCard> {
  bool _isEditing = false;
  late TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.entry.text);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _toggleEdit() {
    setState(() {
      _isEditing = !_isEditing;
      if (!_isEditing) {
        _controller.text = widget.entry.text;
      }
    });
  }

  void _saveEdit() {
    final newText = _controller.text.trim();
    if (newText.isNotEmpty && newText != widget.entry.text) {
      widget.onEdit(newText);
    }
    setState(() {
      _isEditing = false;
    });
  }

  Future<void> _confirmDelete() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Quick Note'),
        content: const Text('Are you sure you want to delete this quick note?'),
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

    if (confirm == true) {
      widget.onDelete();
    }
  }

  @override
  Widget build(BuildContext context) {
    final dateFormat = DateFormat('MMM d, yyyy • h:mm a');
    final wordCount = TypeEntry.getWordCount(_controller.text);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  Icons.notes,
                  size: 16,
                  color: Colors.green[400],
                ),
                const SizedBox(width: 8),
                Text(
                  dateFormat.format(widget.entry.timestamp),
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.grey[600],
                  ),
                ),
                const Spacer(),
                if (_isEditing) ...[
                  TextButton(
                    onPressed: _toggleEdit,
                    child: const Text('Cancel'),
                  ),
                  TextButton(
                    onPressed: _saveEdit,
                    child: const Text('Save'),
                  ),
                ] else ...[
                  IconButton(
                    icon: const Icon(Icons.edit_outlined, size: 20),
                    onPressed: _toggleEdit,
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                    color: Colors.grey[500],
                  ),
                  const SizedBox(width: 12),
                  IconButton(
                    icon: const Icon(Icons.delete_outline, size: 20),
                    onPressed: _confirmDelete,
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                    color: Colors.grey[500],
                  ),
                ],
              ],
            ),
            const SizedBox(height: 8),
            if (_isEditing)
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  TextField(
                    controller: _controller,
                    maxLines: 2,
                    decoration: const InputDecoration(
                      hintText: 'Edit note (max 10 words)...',
                    ),
                    onChanged: (text) => setState(() {}),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '$wordCount/10 words',
                    style: TextStyle(
                      fontSize: 12,
                      color: wordCount > 10 ? Colors.red : Colors.grey[600],
                    ),
                  ),
                ],
              )
            else
              Text(
                widget.entry.text,
                style: const TextStyle(
                  fontSize: 14,
                  height: 1.4,
                ),
              ),
          ],
        ),
      ),
    );
  }
}
