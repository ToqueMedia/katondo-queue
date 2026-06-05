package ao.katondo.display.network

import android.util.Log
import ao.katondo.display.model.QueueUpdate
import ao.katondo.display.model.Ticket
import ao.katondo.display.model.TicketCalled
import ao.katondo.display.model.TicketCancelled
import io.socket.client.IO
import io.socket.client.Socket
import io.socket.emitter.Emitter
import kotlinx.serialization.json.Json
import org.json.JSONObject

class SocketManager(
    private val serverUrl: String,
    private val token: String,
    private val areaId: Int
) {
    private var socket: Socket? = null
    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
    }

    var onConnected: (() -> Unit)? = null
    var onDisconnected: ((String) -> Unit)? = null
    var onConnectionError: ((String) -> Unit)? = null
    var onTicketCreated: ((Ticket) -> Unit)? = null
    var onTicketCalled: ((Ticket, String?) -> Unit)? = null
    var onTicketStarted: ((Int) -> Unit)? = null
    var onTicketCompleted: ((Int) -> Unit)? = null
    var onTicketCancelled: ((Int) -> Unit)? = null
    var onQueueUpdated: ((Int, List<Ticket>) -> Unit)? = null
    var onAdsUpdated: (() -> Unit)? = null

    fun connect() {
        try {
            val opts = IO.Options().apply {
                transports = arrayOf("websocket", "polling")
                reconnectionDelay = 3000
                auth = mapOf("token" to token)
            }

            socket = IO.socket(serverUrl, opts)

            socket?.on(Socket.EVENT_CONNECT) {
                Log.i(TAG, "Socket connected")
                onConnected?.invoke()
                socket?.emit("join:area", areaId)
                socket?.emit("subscribe:queue", areaId)
            }

            socket?.on(Socket.EVENT_DISCONNECT) { args ->
                val reason = args.firstOrNull()?.toString() ?: "unknown"
                Log.i(TAG, "Socket disconnected: $reason")
                onDisconnected?.invoke(reason)
            }

            socket?.on(Socket.EVENT_CONNECT_ERROR) { args ->
                val error = args.firstOrNull()?.toString() ?: "unknown error"
                Log.e(TAG, "Socket connection error: $error")
                onConnectionError?.invoke(error)
            }

            socket?.on("ticket:created") { args ->
                try {
                    val data = args.firstOrNull() as? JSONObject
                    val ticketJson = data?.optJSONObject("ticket")?.toString()
                    if (ticketJson != null) {
                        val ticket = json.decodeFromString<Ticket>(ticketJson)
                        onTicketCreated?.invoke(ticket)
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Error parsing ticket:created", e)
                }
            }

            socket?.on("ticket:called") { args ->
                try {
                    val data = args.firstOrNull() as? JSONObject
                    val ticketJson = data?.optJSONObject("ticket")?.toString()
                    val voiceText = data?.optString("voiceText")
                    if (ticketJson != null) {
                        val ticket = json.decodeFromString<Ticket>(ticketJson)
                        onTicketCalled?.invoke(ticket, voiceText)
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Error parsing ticket:called", e)
                }
            }

            socket?.on("ticket:started") { args ->
                try {
                    val data = args.firstOrNull() as? JSONObject
                    val ticketId = data?.optInt("ticketId", -1) ?: -1
                    if (ticketId > 0) {
                        onTicketStarted?.invoke(ticketId)
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Error parsing ticket:started", e)
                }
            }

            socket?.on("ticket:completed") { args ->
                try {
                    val data = args.firstOrNull() as? JSONObject
                    val ticketId = data?.optInt("ticketId", -1) ?: -1
                    if (ticketId > 0) {
                        onTicketCompleted?.invoke(ticketId)
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Error parsing ticket:completed", e)
                }
            }

            socket?.on("ticket:cancelled") { args ->
                try {
                    val data = args.firstOrNull() as? JSONObject
                    val ticketId = data?.optInt("ticketId", -1) ?: -1
                    if (ticketId > 0) {
                        onTicketCancelled?.invoke(ticketId)
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Error parsing ticket:cancelled", e)
                }
            }

            socket?.on("queue:updated") { args ->
                try {
                    val data = args.firstOrNull() as? JSONObject
                    val waitingCount = data?.optInt("waitingCount", 0) ?: 0
                    val nextTicketsJson = data?.optJSONArray("nextTickets")?.toString()
                    val nextTickets = if (nextTicketsJson != null) {
                        json.decodeFromString<List<Ticket>>(nextTicketsJson)
                    } else {
                        emptyList()
                    }
                    onQueueUpdated?.invoke(waitingCount, nextTickets)
                } catch (e: Exception) {
                    Log.e(TAG, "Error parsing queue:updated", e)
                }
            }

            socket?.on("ads:updated") {
                Log.i(TAG, "Ads updated")
                onAdsUpdated?.invoke()
            }

            socket?.connect()
        } catch (e: Exception) {
            Log.e(TAG, "Error creating socket", e)
            onConnectionError?.invoke(e.message ?: "Unknown error")
        }
    }

    fun disconnect() {
        socket?.emit("leave:area", areaId)
        socket?.emit("unsubscribe:queue", areaId)
        socket?.disconnect()
        socket?.off()
        socket = null
    }

    fun isConnected(): Boolean = socket?.connected() == true

    companion object {
        private const val TAG = "SocketManager"
    }
}
