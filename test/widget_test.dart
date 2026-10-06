import 'package:flutter_test/flutter_test.dart';
import 'package:vibemaster/main.dart';

void main() {
  testWidgets('shows VibeMaster home actions', (tester) async {
    await tester.pumpWidget(const VibeMasterApp());
    expect(find.text('VibeMaster'), findsOneWidget);
    expect(find.text('Create room'), findsOneWidget);
    expect(find.text('Join room'), findsOneWidget);
  });
}
