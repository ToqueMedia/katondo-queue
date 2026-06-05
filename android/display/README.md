# Katondo Display - Android Nativo

Aplicação Android 100% nativa para display de senhas da Clínica General Katondo.

## Arquitetura

- **UI**: Jetpack Compose com Material 3
- **Networking**: Retrofit + OkHttp + Kotlin Serialization
- **Real-time**: Socket.IO nativo
- **TTS**: Android TextToSpeech nativo
- **State Management**: ViewModel + StateFlow

## Estrutura

```
app/src/main/java/ao/katondo/display/
├── MainActivity.kt           # Activity principal com Compose
├── model/
│   └── Models.kt            # Modelos de dados (Ticket, Advertisement, etc.)
├── network/
│   ├── ApiClient.kt         # Cliente HTTP com Retrofit
│   └── SocketManager.kt     # Gestor de Socket.IO nativo
├── tts/
│   └── TtsManager.kt        # Gestor de Text-to-Speech nativo
├── ui/
│   ├── DisplayScreen.kt     # Ecrã principal do display
│   └── LoginScreen.kt       # Ecrã de login (IP, porta, credenciais)
└── viewmodel/
    └── DisplayViewModel.kt  # ViewModel com estado da aplicação
```

## Funcionalidades

- ✅ Login com IP, porta e credenciais do sistema
- ✅ Conexão Socket.IO em tempo real
- ✅ Display de senha atual com destaque visual
- ✅ Lista de próximas senhas em espera
- ✅ Carrossel de anúncios (imagem, vídeo, texto)
- ✅ TTS nativo para chamada de senhas
- ✅ Relógio em tempo real
- ✅ Fullscreen imersivo
- ✅ Wake lock para manter ecrã ligado 24h
- ✅ Reconnection automática (10 tentativas)
- ✅ Persistência de credenciais e configuração do servidor

## Configuração

Na primeira execução, a app pede:
1. **IP do servidor**: endereço IP do servidor na rede local (ex: `10.245.80.118`)
2. **Porta**: porta do servidor (padrão: `3001`)
3. **Utilizador**: username do display configurado no painel admin
4. **Palavra-passe**: password do display

As credenciais e configuração do servidor são guardadas localmente e usadas em execuções futuras.

## Build

```bash
cd android/display
./gradlew assembleDebug
```

APK gerado em: `app/build/outputs/apk/debug/app-debug.apk`

## Instalação na TV

1. Copiar o APK para a TV Android (USB, rede, ou adb)
2. Instalar via gestor de ficheiros ou `adb install app-debug.apk`
3. Abrir a app e inserir IP, porta e credenciais
4. A app mantém-se em fullscreen e ligada 24h

## Permissões

- `INTERNET`: Conexão ao servidor
- `WAKE_LOCK`: Manter ecrã ligado
- `ACCESS_NETWORK_STATE`: Verificar conectividade

## Dependências

- Jetpack Compose (UI moderna)
- Retrofit + OkHttp (HTTP)
- Socket.IO Client 2.1.1 (real-time)
- Coil (image loading)
- Media3 ExoPlayer (video playback)
- DataStore Preferences (persistência)

## Diferenças do Wrapper WebView

| Aspecto | Wrapper WebView | Nativo |
|---------|----------------|--------|
| UI | HTML/CSS/JS | Jetpack Compose |
| Socket | socket.io-client (JS) | socket.io-client (Java) |
| TTS | Web Speech API + bridge | Android TTS nativo |
| Performance | WebView overhead | Nativo otimizado |
| Offline | Não funciona | Cache local |
| Boot time | ~3-5s | ~1-2s |
| Memory | ~150MB | ~80MB |

## Troubleshooting

**Ecrã branco**: Verificar se o servidor está acessível na rede
**Não conecta**: Verificar firewall e porta 3001 aberta
**TTS não funciona**: Verificar se vozes PT estão instaladas no Android
**Crash ao abrir**: Verificar logs com `adb logcat | grep KatondoDisplay`
