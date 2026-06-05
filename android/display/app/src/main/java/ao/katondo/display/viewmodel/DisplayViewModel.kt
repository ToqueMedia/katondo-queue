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

            // Build server URL from host and port
            val baseUrl = "http://$serverHost:$serverPort"
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
                val updatedActiveTickets = _state.value.activeTickets.toMutableList()
                if (ticket.stationId != null) {
                    updatedActiveTickets.removeAll { it.stationId == ticket.stationId }
                }
                updatedActiveTickets.add(0, ticket)

                val updatedRecentCalls = _state.value.recentCalls.toMutableList()
                updatedRecentCalls.removeAll { it.id == ticket.id }
                updatedRecentCalls.add(0, ticket)

                _state.value = _state.value.copy(
                    currentTicket = ticket,
                    currentVoiceText = voiceText,
                    nextTickets = _state.value.nextTickets.filter { it.id != ticket.id },
                    activeTickets = updatedActiveTickets,
                    recentCalls = updatedRecentCalls.take(3)
                )
                
                // Play the high-quality queue chime sound directly (handles custom web chimes & raw fallbacks)
                playChimeSound()
            }

            onTicketStarted = { ticketId ->
                // Ticket already updated via socket
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
                loadAdvertisements()
            }

            connect()
        }
    }

    private fun loadAdvertisements() {
        viewModelScope.launch {
            val areaId = _state.value.user?.areaId
            val currentBaseUrl = serverBaseUrl ?: ""
            apiClient?.getAdvertisements(token ?: "", areaId)?.onSuccess { ads ->
                val processedAds = ads.map { ad ->
                    if (ad.contentUrl != null && ad.contentUrl.startsWith("/")) {
                        ad.copy(contentUrl = currentBaseUrl + ad.contentUrl)
                    } else {
                        ad
                    }
                }
                _state.value = _state.value.copy(
                    advertisements = processedAds.filter { it.active },
                    currentAdIndex = 0
                )
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
        val todayStr = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())

        viewModelScope.launch {
            apiClient?.getTickets(currentToken, areaId, status = null, date = todayStr)?.onSuccess { allTickets ->
                val waitingTickets = allTickets.filter { it.status == "waiting" }
                
                // Active tickets are those with called or in_service status
                val activeTickets = allTickets
                    .filter { it.status == "called" || it.status == "in_service" }
                    .sortedByDescending { it.calledAt ?: "" }

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

                // Build the media item URL or raw resource URI!
                val mediaUri = if (soundMode == "chime" || !soundMode.startsWith("/uploads/")) {
                    // Raw resource URI for queue_chime.mp3!
                    android.net.Uri.parse("android.resource://" + getApplication<Application>().packageName + "/" + ao.katondo.display.R.raw.queue_chime)
                } else {
                    // Custom uploaded sound URL: http://[ip-servidor]:[porta]/uploads/nome_do_arquivo.mp3
                    android.net.Uri.parse((serverBaseUrl ?: "") + soundMode)
                }

                Log.i(TAG, "Playing sound via ExoPlayer: $mediaUri")

                // Create a lightweight ExoPlayer instance specifically for this playback (robust & universal on TVs)
                val player = androidx.media3.exoplayer.ExoPlayer.Builder(getApplication()).build()
                val audioAttributes = androidx.media3.common.AudioAttributes.Builder()
                    .setUsage(androidx.media3.common.C.USAGE_MEDIA)
                    .setContentType(androidx.media3.common.C.AUDIO_CONTENT_TYPE_MUSIC)
                    .build()
                player.setAudioAttributes(audioAttributes, true)
                player.setMediaItem(androidx.media3.common.MediaItem.fromUri(mediaUri))
                player.volume = 1.0f
                player.prepare()
                player.playWhenReady = true

                player.addListener(object : androidx.media3.common.Player.Listener {
                    override fun onPlaybackStateChanged(state: Int) {
                        if (state == androidx.media3.common.Player.STATE_ENDED) {
                            player.release()
                        }
                    }

                    override fun onPlayerError(error: androidx.media3.common.PlaybackException) {
                        Log.e(TAG, "ExoPlayer playback error, releasing", error)
                        player.release()
                        
                        // Fallback to local raw chime if network URL fails
                        if (soundMode.startsWith("/uploads/")) {
                            playLocalFallbackChime()
                        }
                    }
                })
            } catch (e: Exception) {
                Log.e(TAG, "Error playing sound via ExoPlayer", e)
            }
        }
    }

    private fun playLocalFallbackChime() {
        viewModelScope.launch(kotlinx.coroutines.Dispatchers.Main) {
            try {
                val mediaUri = android.net.Uri.parse("android.resource://" + getApplication<Application>().packageName + "/" + ao.katondo.display.R.raw.queue_chime)
                val player = androidx.media3.exoplayer.ExoPlayer.Builder(getApplication()).build()
                val audioAttributes = androidx.media3.common.AudioAttributes.Builder()
                    .setUsage(androidx.media3.common.C.USAGE_MEDIA)
                    .setContentType(androidx.media3.common.C.AUDIO_CONTENT_TYPE_MUSIC)
                    .build()
                player.setAudioAttributes(audioAttributes, true)
                player.setMediaItem(androidx.media3.common.MediaItem.fromUri(mediaUri))
                player.volume = 1.0f
                player.prepare()
                player.playWhenReady = true
                player.addListener(object : androidx.media3.common.Player.Listener {
                    override fun onPlaybackStateChanged(state: Int) {
                        if (state == androidx.media3.common.Player.STATE_ENDED) {
                            player.release()
                        }
                    }
                    override fun onPlayerError(error: androidx.media3.common.PlaybackException) {
                        player.release()
                    }
                })
            } catch (e: Exception) {
                Log.e(TAG, "Error playing local fallback chime", e)
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