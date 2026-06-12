package ao.katondo.display.viewmodel

import android.app.Application
import android.content.Context
import android.util.Log
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import ao.katondo.display.model.Advertisement
import ao.katondo.display.model.Ticket
import ao.katondo.display.model.User
import ao.katondo.display.model.VoiceConfig
import ao.katondo.display.network.ApiClient
import ao.katondo.display.network.SocketManager
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

data class DisplayState(
    val isConnected: Boolean = false,
    val isLoading: Boolean = true,
    val errorMessage: String? = null,
    val user: User? = null,
    val currentTicket: Ticket? = null,
    val currentVoiceText: String? = null,
    val nextTickets: List<Ticket> = emptyList(),
    val activeTickets: List<Ticket> = emptyList(),
    val recentCalls: List<Ticket> = emptyList(),
    val waitingCount: Int = 0,
    val advertisements: List<Advertisement> = emptyList(),
    val currentAdIndex: Int = 0,
    val voiceConfig: VoiceConfig? = null,
    val currentTime: String = ""
)

class DisplayViewModel(application: Application) : AndroidViewModel(application) {
    private val _state = MutableStateFlow(DisplayState())
    val state: StateFlow<DisplayState> = _state.asStateFlow()

    private var apiClient: ApiClient? = null
    private var socketManager: SocketManager? = null
    private var serverBaseUrl: String? = null
    private var token: String? = null
    private var refreshToken: String? = null

    private val timeFormat = SimpleDateFormat("HH:mm:ss", Locale("pt", "PT"))

    init {
        updateTime()
    }

    fun initialize(serverHost: String, serverPort: String, username: String, password: String) {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, errorMessage = null)

            // Build server URL from host and port safely (supports full http/https URLs)
            val baseUrl = if (serverHost.startsWith("http://") || serverHost.startsWith("https://")) {
                "$serverHost:$serverPort"
            } else {
                "http://$serverHost:$serverPort"
            }
            serverBaseUrl = baseUrl
            apiClient = ApiClient(baseUrl)

            val loginResult = apiClient?.login(username, password)
            loginResult?.onSuccess { response ->
                token = response.token
                refreshToken = response.refreshToken
                _state.value = _state.value.copy(user = response.user)

                // Connect to Socket.IO
                connectSocket(baseUrl, response.token, response.user.areaId ?: 0)

                // Load initial data
                loadAdvertisements()
                loadVoiceConfig()
                loadInitialTickets()
            }?.onFailure { error ->
                Log.e(TAG, "Login failed", error)
                _state.value = _state.value.copy(
                    isLoading = false,
                    errorMessage = "Falha no login: ${error.message}"
                )
            }
        }
    }

    private fun connectSocket(serverUrl: String, token: String, areaId: Int) {
        socketManager = SocketManager(serverUrl, token, areaId).apply {
            onConnected = {
                _state.value = _state.value.copy(isConnected = true, isLoading = false)
            }

            onDisconnected = { reason ->
                _state.value = _state.value.copy(isConnected = false)
            }

            onConnectionError = { error ->
                _state.value = _state.value.copy(
                    isConnected = false,
                    errorMessage = "Erro de conexão: $error"
                )
            }

            onTicketCreated = { ticket ->
                val currentTickets = _state.value.nextTickets.toMutableList()
                currentTickets.add(ticket)
                _state.value = _state.value.copy(
                    nextTickets = currentTickets,
                    waitingCount = currentTickets.size
                )
            }

            onTicketCalled = { ticket, voiceText ->
                val updatedRecentCalls = _state.value.recentCalls.toMutableList()
                updatedRecentCalls.removeAll { it.id == ticket.id }
                updatedRecentCalls.add(0, ticket)

                _state.value = _state.value.copy(
                    currentTicket = ticket,
                    currentVoiceText = voiceText,
                    nextTickets = _state.value.nextTickets.filter { it.id != ticket.id },
                    recentCalls = updatedRecentCalls.take(3)
                )
                
                // Play the high-quality queue chime sound directly (handles custom web chimes & raw fallbacks)
                playChimeSound()
            }

            onTicketStarted = { ticketId ->
                val sourceTicket = _state.value.recentCalls.find { it.id == ticketId }
                    ?: _state.value.currentTicket?.takeIf { it.id == ticketId }

                if (sourceTicket != null) {
                    val inServiceTicket = sourceTicket.copy(status = "in_service")
                    val updatedActiveTickets = _state.value.activeTickets
                        .filter { it.id != ticketId && it.stationId != inServiceTicket.stationId }
                        .toMutableList()
                    updatedActiveTickets.add(0, inServiceTicket)

                    _state.value = _state.value.copy(
                        activeTickets = updatedActiveTickets,
                        currentTicket = _state.value.currentTicket?.let {
                            if (it.id == ticketId) inServiceTicket else it
                        }
                    )
                } else {
                    loadInitialTickets()
                }
            }

            onTicketCompleted = { ticketId ->
                // Do not clear currentTicket (to show last called ticket), but remove it from activeTickets being served
                _state.value = _state.value.copy(
                    activeTickets = _state.value.activeTickets.filter { it.id != ticketId }
                )
            }

            onTicketCancelled = { ticketId ->
                _state.value = _state.value.copy(
                    nextTickets = _state.value.nextTickets.filter { it.id != ticketId },
                    activeTickets = _state.value.activeTickets.filter { it.id != ticketId }
                )
            }

            onQueueUpdated = { waitingCount, nextTickets ->
                _state.value = _state.value.copy(
                    waitingCount = waitingCount,
                    nextTickets = nextTickets
                )
            }

            onAdsUpdated = {
                viewModelScope.launch(kotlinx.coroutines.Dispatchers.Main) {
                    Log.i(TAG, "Socket event 'ads:updated' received! Reloading advertisements...")
                    loadAdvertisements()
                }
            }

            connect()
        }
    }

    fun loadAdvertisements() {
        viewModelScope.launch(kotlinx.coroutines.Dispatchers.Main) {
            val areaId = _state.value.user?.areaId
            val currentBaseUrl = serverBaseUrl ?: ""
            Log.i(TAG, "Fetching advertisements for areaId: $areaId from server: $currentBaseUrl")
            apiClient?.getAdvertisements(token ?: "", areaId)
                ?.onSuccess { ads ->
                    val processedAds = ads.map { ad ->
                        if (ad.contentUrl != null && ad.contentUrl.startsWith("/")) {
                            ad.copy(contentUrl = currentBaseUrl + ad.contentUrl)
                        } else {
                            ad
                        }
                    }
                    val activeAds = processedAds.filter { it.active }
                    Log.i(TAG, "Advertisements loaded successfully. Total: ${ads.size}, Active: ${activeAds.size}")
                    _state.value = _state.value.copy(
                        advertisements = activeAds,
                        currentAdIndex = 0
                    )
                }
                ?.onFailure { error ->
                    Log.e(TAG, "Failed to load advertisements", error)
                }
        }
    }

    private fun loadVoiceConfig() {
        viewModelScope.launch {
            val areaId = _state.value.user?.areaId ?: return@launch
            if (areaId == 0) return@launch
            apiClient?.getVoiceConfig(token ?: "", areaId)?.onSuccess { config ->
                _state.value = _state.value.copy(voiceConfig = config)
            }
        }
    }



    fun updateTime() {
        _state.value = _state.value.copy(currentTime = timeFormat.format(Date()))
    }

    fun nextAd() {
        val mediaAds = _state.value.advertisements.filter { it.contentType == "image" || it.contentType == "video" }
        if (mediaAds.isNotEmpty()) {
            val nextIndex = (_state.value.currentAdIndex + 1) % mediaAds.size
            _state.value = _state.value.copy(currentAdIndex = nextIndex)
        } else {
            _state.value = _state.value.copy(currentAdIndex = 0)
        }
    }

    fun getCredentials(): Quadruple<String, String, String, String>? {
        val prefs = getApplication<Application>().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val serverHost = prefs.getString(PREF_SERVER_HOST, null) ?: return null
        val serverPort = prefs.getString(PREF_SERVER_PORT, null) ?: return null
        val username = prefs.getString(PREF_USERNAME, null) ?: return null
        val password = prefs.getString(PREF_PASSWORD, null) ?: return null
        return Quadruple(serverHost, serverPort, username, password)
    }

    fun saveCredentials(serverHost: String, serverPort: String, username: String, password: String) {
        val prefs = getApplication<Application>().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit()
            .putString(PREF_SERVER_HOST, serverHost)
            .putString(PREF_SERVER_PORT, serverPort)
            .putString(PREF_USERNAME, username)
            .putString(PREF_PASSWORD, password)
            .apply()
    }

    fun logout() {
        socketManager?.disconnect()
        token = null
        refreshToken = null
        clearCredentials()
        _state.value = DisplayState()
    }

    private fun clearCredentials() {
        val prefs = getApplication<Application>().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().clear().apply()
    }

    private fun loadInitialTickets() {
        val areaId = _state.value.user?.areaId
        val currentToken = token ?: return

        viewModelScope.launch {
            // Use "today" so that the server calculates the date in its own timezone (Africa/Luanda),
            // making the app 100% immune to wrong local clocks/dates on Android TV devices.
            apiClient?.getTickets(currentToken, areaId, status = null, date = "today")?.onSuccess { allTickets ->
                val waitingTickets = allTickets.filter { it.status == "waiting" }
                
                // Active tickets are only those already started by the station user.
                val activeTickets = allTickets
                    .filter { it.status == "in_service" }
                    .sortedByDescending { it.startedAt ?: it.calledAt ?: "" }

                // The last called ticket is the one with the latest calledAt timestamp
                val lastCalledTicket = allTickets
                    .filter { it.calledAt != null }
                    .maxByOrNull { it.calledAt!! }

                // Recent called tickets are all tickets called today, sorted by calledAt descending
                val recentCallsList = allTickets
                    .filter { it.calledAt != null }
                    .sortedByDescending { it.calledAt ?: "" }

                _state.value = _state.value.copy(
                    nextTickets = waitingTickets,
                    waitingCount = waitingTickets.size,
                    currentTicket = lastCalledTicket,
                    activeTickets = activeTickets,
                    recentCalls = recentCallsList.take(3)
                )
            }?.onFailure { error ->
                Log.e(TAG, "Failed to load initial tickets", error)
            }
        }
    }



    private fun playChimeSound() {
        val soundMode = _state.value.voiceConfig?.callSoundMode ?: "chime"
        if (soundMode == "none") {
            Log.i(TAG, "Sound is disabled (silent call)")
            return
        }

        viewModelScope.launch(kotlinx.coroutines.Dispatchers.Main) {
            try {
                // Force system music volume stream to be active and audible (unmute & boost to 80% volume)
                try {
                    val audioManager = getApplication<Application>().getSystemService(android.content.Context.AUDIO_SERVICE) as android.media.AudioManager
                    audioManager.adjustStreamVolume(android.media.AudioManager.STREAM_MUSIC, android.media.AudioManager.ADJUST_UNMUTE, 0)
                    val maxVol = audioManager.getStreamMaxVolume(android.media.AudioManager.STREAM_MUSIC)
                    val currentVol = audioManager.getStreamVolume(android.media.AudioManager.STREAM_MUSIC)
                    if (currentVol < (maxVol * 0.7).toInt()) {
                        audioManager.setStreamVolume(android.media.AudioManager.STREAM_MUSIC, (maxVol * 0.8).toInt(), 0)
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to adjust system stream volume", e)
                }

                val customMode = soundMode != "chime" && soundMode.startsWith("/uploads/")
                Log.i(TAG, "Playing sound via MediaPlayer. Custom mode: $customMode. Mode: $soundMode")

                val mediaPlayer = if (customMode) {
                    // Custom uploaded sound URL: http://[ip-servidor]:[porta]/uploads/nome_do_arquivo.mp3
                    val customUri = android.net.Uri.parse((serverBaseUrl ?: "") + soundMode)
                    android.media.MediaPlayer().apply {
                        setAudioAttributes(
                            android.media.AudioAttributes.Builder()
                                .setUsage(android.media.AudioAttributes.USAGE_MEDIA)
                                .setContentType(android.media.AudioAttributes.CONTENT_TYPE_MUSIC)
                                .build()
                        )
                        setDataSource(getApplication(), customUri)
                    }
                } else {
                    // Raw resource directly using robust MediaPlayer.create (No URI parsing or stream issues)
                    android.media.MediaPlayer.create(getApplication(), ao.katondo.display.R.raw.queue_chime)
                }

                mediaPlayer?.apply {
                    if (customMode) {
                        prepareAsync()
                        setOnPreparedListener { start() }
                    } else {
                        start()
                    }

                    setOnCompletionListener {
                        it.release()
                    }

                    setOnErrorListener { mp, what, extra ->
                        Log.e(TAG, "MediaPlayer error: what=$what, extra=$extra. Releasing and falling back.")
                        mp.release()
                        if (customMode) {
                            playLocalFallbackChime()
                        }
                        true
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error playing sound via MediaPlayer", e)
            }
        }
    }

    private fun playLocalFallbackChime() {
        viewModelScope.launch(kotlinx.coroutines.Dispatchers.Main) {
            try {
                val mediaPlayer = android.media.MediaPlayer.create(getApplication(), ao.katondo.display.R.raw.queue_chime)
                mediaPlayer?.apply {
                    start()
                    setOnCompletionListener {
                        it.release()
                    }
                    setOnErrorListener { mp, _, _ ->
                        mp.release()
                        true
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error playing local fallback chime via MediaPlayer", e)
            }
        }
    }

    override fun onCleared() {
        super.onCleared()
        socketManager?.disconnect()
    }

    companion object {
        private const val TAG = "DisplayViewModel"
        private const val PREFS_NAME = "katondo_display_prefs"
        private const val PREF_SERVER_HOST = "server_host"
        private const val PREF_SERVER_PORT = "server_port"
        private const val PREF_USERNAME = "username"
        private const val PREF_PASSWORD = "password"
    }
}

data class Quadruple<out A, out B, out C, out D>(
    val first: A,
    val second: B,
    val third: C,
    val fourth: D
)
