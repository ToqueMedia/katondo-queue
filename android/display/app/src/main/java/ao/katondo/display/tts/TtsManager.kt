package ao.katondo.display.tts

import android.content.Context
import android.content.Intent
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.util.Log
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.util.Locale
import java.util.concurrent.ConcurrentLinkedQueue

/**
 * Diagnóstico de estado do TTS.
 */
data class TtsStatus(
    val hasEngines: Boolean = false,
    val defaultEngine: String = "",
    val hasPortugueseSupport: Boolean = false,
    val isInitialized: Boolean = false,
    val initializationError: Boolean = false,
    val installedEnginesList: List<String> = emptyList()
)

/**
 * Gestor de Text-to-Speech nativo Android com fallbacks robustos.
 * 
 * Problemas comuns em TVs Android:
 * - Motor TTS não instalado (Google TTS ou Samsung TTS)
 * - Vozes PT não disponíveis
 * - Locale pt-PT não suportado (apenas pt-BR)
 * - Engine demora a inicializar
 */
class TtsManager(private val context: Context) : TextToSpeech.OnInitListener {
    
    private var tts: TextToSpeech? = null
    private var isReady = false
    private var selectedLocale: Locale? = null
    
    private val _status = MutableStateFlow(TtsStatus())
    val status: StateFlow<TtsStatus> = _status.asStateFlow()

    // Queue para textos recebidos antes do TTS estar pronto
    private val pendingQueue = ConcurrentLinkedQueue<PendingSpeech>()
    
    private data class PendingSpeech(
        val text: String,
        val lang: String,
        val rate: Float,
        val voiceName: String? = null,
        val timestamp: Long = System.currentTimeMillis()
    )

    init {
        Log.i(TAG, "Initializing TTS engine...")
        try {
            tts = TextToSpeech(context, this)
            updateEngineDiagnostics()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to create TextToSpeech instance", e)
            _status.value = TtsStatus(initializationError = true)
        }
    }

    private fun updateEngineDiagnostics() {
        try {
            val enginesList = tts?.engines ?: emptyList()
            val engineNames = enginesList.map { "${it.label} (${it.name})" }
            val hasEngines = enginesList.isNotEmpty()
            val defaultEngine = tts?.defaultEngine ?: ""
            _status.value = TtsStatus(
                hasEngines = hasEngines,
                defaultEngine = defaultEngine,
                installedEnginesList = engineNames
            )
        } catch (e: Exception) {
            Log.e(TAG, "Failed to update engine diagnostics", e)
        }
    }

    private fun checkPortugueseAvailability(): Boolean {
        if (tts == null) return false
        val ptLocales = listOf(
            Locale("pt", "PT"),
            Locale("pt", "BR"),
            Locale("pt")
        )
        for (locale in ptLocales) {
            try {
                val result = tts?.isLanguageAvailable(locale)
                if (result == TextToSpeech.LANG_AVAILABLE ||
                    result == TextToSpeech.LANG_COUNTRY_AVAILABLE ||
                    result == TextToSpeech.LANG_COUNTRY_VAR_AVAILABLE) {
                    return true
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error checking availability for $locale", e)
            }
        }
        return false
    }

    /**
     * Tenta abrir as configurações de Text-to-Speech do sistema Android TV.
     */
    fun openTtsSettings(context: Context) {
        try {
            val intent = Intent("com.android.settings.TTS_SETTINGS").apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(intent)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to open TTS Settings, trying Accessibility Settings", e)
            try {
                val intent = Intent(android.provider.Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
                context.startActivity(intent)
            } catch (ex: Exception) {
                Log.e(TAG, "Failed to open Accessibility Settings", ex)
            }
        }
    }

    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            isReady = true
            Log.i(TAG, "TTS engine initialized successfully")
            
            val ptAvailable = checkPortugueseAvailability()
            val enginesList = tts?.engines ?: emptyList()
            val engineNames = enginesList.map { "${it.label} (${it.name})" }
            val defaultEngine = tts?.defaultEngine ?: ""

            _status.value = TtsStatus(
                hasEngines = enginesList.isNotEmpty(),
                defaultEngine = defaultEngine,
                hasPortugueseSupport = ptAvailable,
                isInitialized = true,
                installedEnginesList = engineNames
            )

            // Listar todas as vozes disponíveis para diagnóstico de forma segura
            var allVoices: Set<android.speech.tts.Voice> = emptySet()
            try {
                allVoices = tts?.voices ?: emptySet()
                Log.i(TAG, "Available voices: ${allVoices.size}")
                allVoices.take(10).forEach { voice ->
                    Log.d(TAG, "  Voice: ${voice.name} (${voice.locale})")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Device TTS engine failed to return available voices", e)
            }
            
            try {
                // Verificar vozes PT de forma segura
                val ptVoices = allVoices.filter { it.locale.language == "pt" }
                Log.i(TAG, "Portuguese voices: ${ptVoices.size}")
                ptVoices.forEach { voice ->
                    Log.d(TAG, "  PT Voice: ${voice.name} (${voice.locale})")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to filter Portuguese voices", e)
            }
            
            // Configurar UtteranceProgressListener para logging
            tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                override fun onStart(utteranceId: String?) {
                    Log.d(TAG, "TTS started: $utteranceId")
                }
                
                override fun onDone(utteranceId: String?) {
                    Log.d(TAG, "TTS completed: $utteranceId")
                }
                
                @Deprecated("Deprecated in Java")
                override fun onError(utteranceId: String?) {
                    Log.e(TAG, "TTS error: $utteranceId")
                }
            })
            
            // Processar queue de textos pendentes
            processPendingQueue()
            
        } else {
            Log.e(TAG, "TTS initialization failed with status: $status")
            when (status) {
                TextToSpeech.ERROR -> Log.e(TAG, "  Generic error")
                else -> Log.e(TAG, "  Unknown error code: $status")
            }
        }
    }

    /**
     * Fala o texto com fallbacks de locale e configurações opcionais.
     * Ordem de tentativa: pt-PT → pt-BR → pt → locale default
     */
    fun speak(text: String, lang: String = "pt-PT", rate: Float = 1.0f, voiceName: String? = null) {
        Log.d(TAG, "speak() called: text='$text', lang='$lang', rate=$rate, voiceName=$voiceName")
        
        if (tts == null) {
            Log.e(TAG, "TTS engine is null, cannot speak")
            return
        }
        
        if (!isReady) {
            Log.w(TAG, "TTS not ready yet, queueing text")
            pendingQueue.add(PendingSpeech(text, lang, rate, voiceName))
            return
        }

        // Tentar definir locale com fallbacks
        val targetLocale = resolveLocale(lang)
        if (targetLocale == null) {
            Log.e(TAG, "Could not resolve any suitable locale for lang='$lang'")
            // Tentar falar mesmo assim com locale default
            attemptSpeak(text, Locale.getDefault(), rate, voiceName)
            return
        }
        
        attemptSpeak(text, targetLocale, rate, voiceName)
    }
    
    /**
     * Resolve o melhor locale disponível com fallbacks.
     */
    private fun resolveLocale(lang: String): Locale? {
        val candidates = mutableListOf<Locale>()
        
        // Adicionar candidatos baseados no lang solicitado
        when {
            lang.startsWith("pt-PT") -> {
                candidates.add(Locale("pt", "PT"))
                candidates.add(Locale("pt", "BR"))
                candidates.add(Locale("pt"))
            }
            lang.startsWith("pt-BR") -> {
                candidates.add(Locale("pt", "BR"))
                candidates.add(Locale("pt", "PT"))
                candidates.add(Locale("pt"))
            }
            lang.startsWith("pt") -> {
                candidates.add(Locale("pt"))
                candidates.add(Locale("pt", "BR"))
                candidates.add(Locale("pt", "PT"))
            }
            lang.startsWith("en") -> {
                candidates.add(Locale.ENGLISH)
                candidates.add(Locale.US)
                candidates.add(Locale.UK)
            }
            lang.startsWith("es") -> {
                candidates.add(Locale("es"))
                candidates.add(Locale("es", "ES"))
            }
        }
        
        // Adicionar locale default como último recurso
        candidates.add(Locale.getDefault())
        
        // Tentar cada candidato
        for (locale in candidates) {
            val result = tts?.isLanguageAvailable(locale)
            Log.d(TAG, "Checking locale $locale: availability=$result")
            
            when (result) {
                TextToSpeech.LANG_AVAILABLE,
                TextToSpeech.LANG_COUNTRY_AVAILABLE,
                TextToSpeech.LANG_COUNTRY_VAR_AVAILABLE -> {
                    Log.i(TAG, "Selected locale: $locale")
                    return locale
                }
            }
        }
        
        Log.w(TAG, "No suitable locale found, returning null")
        return null
    }
    
    /**
     * Tenta falar com o locale especificado e configurações de voz e velocidade.
     */
    private fun attemptSpeak(text: String, locale: Locale, rate: Float, voiceName: String? = null) {
        try {
            // Se foi especificado um voiceName, tentar definir a voz diretamente
            var voiceSet = false
            if (!voiceName.isNullOrBlank()) {
                val allVoices = try {
                    tts?.voices ?: emptySet()
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to fetch voices in attemptSpeak", e)
                    emptySet()
                }
                val targetVoice = allVoices.find { it.name == voiceName }
                if (targetVoice != null) {
                    val voiceResult = tts?.setVoice(targetVoice)
                    if (voiceResult == TextToSpeech.SUCCESS) {
                        voiceSet = true
                        selectedLocale = targetVoice.locale
                        Log.i(TAG, "Successfully set specific voice: $voiceName")
                    } else {
                        Log.w(TAG, "Failed to set specific voice: $voiceName (result=$voiceResult), falling back to locale")
                    }
                } else {
                    Log.w(TAG, "Requested voice not found: $voiceName, falling back to locale")
                }
            }
            
            // Se não definimos uma voz específica, definimos apenas o idioma
            if (!voiceSet) {
                val langResult = tts?.setLanguage(locale)
                if (langResult == TextToSpeech.LANG_MISSING_DATA || langResult == TextToSpeech.LANG_NOT_SUPPORTED) {
                    Log.e(TAG, "Language not supported for locale $locale (result=$langResult)")
                    return
                }
                selectedLocale = locale
            }
            
            // Definir velocidade
            tts?.setSpeechRate(rate.coerceIn(0.1f, 2.0f))
            
            // Definir tom/pitch padrão (atualmente não configurável, mas resetamos)
            tts?.setPitch(1.0f)
            
            // Parar qualquer fala anterior
            tts?.stop()
            
            // Falar
            val params = android.os.Bundle()
            params.putString(TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID, "katondo_display")
            
            val speakResult = tts?.speak(text, TextToSpeech.QUEUE_FLUSH, params, "katondo_display")
            if (speakResult == TextToSpeech.SUCCESS) {
                Log.i(TAG, "Speaking: '$text' (locale=$locale, rate=$rate, voiceName=$voiceName)")
            } else {
                Log.e(TAG, "speak() returned error code: $speakResult")
            }
            
        } catch (e: Exception) {
            Log.e(TAG, "Exception in attemptSpeak", e)
        }
    }
    
    /**
     * Processa textos pendentes na queue.
     */
    private fun processPendingQueue() {
        if (pendingQueue.isEmpty()) return
        
        Log.i(TAG, "Processing ${pendingQueue.size} pending speech items")
        
        // Pegar apenas o mais recente (descartar antigos)
        val latest = pendingQueue.poll()
        pendingQueue.clear()
        
        if (latest != null) {
            // Verificar se não é muito antigo (mais de 10 segundos)
            val age = System.currentTimeMillis() - latest.timestamp
            if (age < 10000) {
                Log.i(TAG, "Speaking queued text: '${latest.text}'")
                speak(latest.text, latest.lang, latest.rate, latest.voiceName)
            } else {
                Log.w(TAG, "Discarding old queued text (age=${age}ms)")
            }
        }
    }

    fun stop() {
        tts?.stop()
        pendingQueue.clear()
    }

    fun isReady(): Boolean = isReady

    fun hasPortuguese(): Boolean {
        if (!isReady || tts == null) return false
        return try {
            val ptVoices = tts?.voices?.filter { it.locale.language == "pt" } ?: emptyList()
            ptVoices.isNotEmpty()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to filter Portuguese voices in hasPortuguese", e)
            false
        }
    }
    
    fun getSelectedLocale(): Locale? = selectedLocale

    fun shutdown() {
        Log.i(TAG, "Shutting down TTS")
        pendingQueue.clear()
        tts?.stop()
        tts?.shutdown()
        tts = null
        isReady = false
    }

    companion object {
        private const val TAG = "TtsManager"
    }
}
