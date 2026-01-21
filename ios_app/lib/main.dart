import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'services/database_service.dart';
import 'providers/theme_provider.dart';
import 'providers/book_provider.dart';
import 'screens/book_list_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await DatabaseService.initialize();
  runApp(const ReadingNotesApp());
}

class ReadingNotesApp extends StatelessWidget {
  const ReadingNotesApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => ThemeProvider()),
        ChangeNotifierProvider(create: (_) => BookProvider()),
      ],
      child: Consumer<ThemeProvider>(
        builder: (context, themeProvider, child) {
          return MaterialApp(
            title: 'Reading Notes',
            theme: themeProvider.theme,
            debugShowCheckedModeBanner: false,
            home: const BookListScreen(),
          );
        },
      ),
    );
  }
}
