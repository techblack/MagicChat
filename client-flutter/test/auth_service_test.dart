import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:magicchat_client/data/auth_service.dart';
import 'package:magicchat_client/data/session_store.dart';

void main() {
  test('邮箱验证码登录协商 Native Session 并保存令牌', () async {
    final requests = <http.Request>[];
    final sessions = _MemorySessionStore();
    final service = AuthService(
      client: MockClient((request) async {
        requests.add(request);
        return http.Response(
          jsonEncode({
            'success': true,
            'data': {
              'user': {'id': 'user-1'},
              'mobile_session': {'token': 'session-1'},
            },
          }),
          200,
        );
      }),
      sessions: sessions,
    );

    await service.loginWithEmailCode(
      serverUrl: 'https://chat.example.com',
      email: ' alice@example.com ',
      code: '01234567',
    );

    expect(requests.single.url.path, '/api/client/auth/email-code/login');
    expect(requests.single.headers['X-Dianbao-Mobile-Session'], '1');
    expect(jsonDecode(requests.single.body), {
      'email': 'alice@example.com',
      'code': '01234567',
    });
    expect(sessions.token, 'session-1');
  });

  test('验证码登录展示服务端错误消息', () async {
    final service = AuthService(
      client: MockClient((_) async => http.Response(
            jsonEncode({
              'success': false,
              'error': {'code': 'invalid_code', 'message': '验证码错误或已过期'},
            }),
            401,
          )),
    );

    await expectLater(
      service.loginWithEmailCode(
        serverUrl: 'https://chat.example.com',
        email: 'alice@example.com',
        code: '01234567',
      ),
      throwsA(predicate((error) => error.toString().contains('验证码错误或已过期'))),
    );
  });
}

class _MemorySessionStore extends SessionStore {
  _MemorySessionStore() : super();

  String? token;

  @override
  Future<void> writeToken(String value) async => token = value;

  @override
  Future<String?> readToken() async => token;
}
