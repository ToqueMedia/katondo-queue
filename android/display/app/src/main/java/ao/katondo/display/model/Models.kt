package ao.katondo.display.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class NestedService(
    val name: String? = null
)

@Serializable
data class NestedStation(
    val name: String? = null
)

@Serializable
data class Ticket(
    val id: Int,
    val number: String,
    val status: String = "waiting",
    
    @SerialName("serviceName")
    private val rawServiceName: String? = null,
    
    @SerialName("service")
    private val service: NestedService? = null,
    
    @SerialName("stationName")
    private val rawStationName: String? = null,
    
    @SerialName("station")
    private val station: NestedStation? = null,
    
    @SerialName("stationId")
    val stationId: Int? = null,
    @SerialName("calledAt")
    val calledAt: String? = null,
    @SerialName("startedAt")
    val startedAt: String? = null,
    @SerialName("completedAt")
    val completedAt: String? = null
) {
    val serviceName: String?
        get() = rawServiceName ?: service?.name

    val stationName: String?
        get() = rawStationName ?: station?.name
}

@Serializable
data class Advertisement(
    val id: Int,
    val title: String,
    @SerialName("contentType")
    val contentType: String, // "image", "video", "text", "html"
    @SerialName("contentUrl")
    val contentUrl: String? = null,
    @SerialName("contentText")
    val contentText: String? = null,
    @SerialName("areaId")
    val areaId: Int? = null,
    val active: Boolean = true,
    @SerialName("durationSeconds")
    val durationSeconds: Int = 10,
    @SerialName("sortOrder")
    val sortOrder: Int = 0
)

@Serializable
data class VoiceConfig(
    val id: Int,
    @SerialName("areaId")
    val areaId: Int,
    val language: String = "pt",
    @SerialName("voiceName")
    val voiceName: String? = null,
    val speed: Float = 1.0f,
    @SerialName("voiceTextTemplate")
    val voiceTextTemplate: String = "Senha {ticketNumber}, dirija-se à {stationName}",
    @SerialName("callSoundMode")
    val callSoundMode: String = "chime"
)

@Serializable
data class LoginRequest(
    val username: String,
    val password: String
)

@Serializable
data class LoginResponse(
    val token: String,
    @SerialName("refreshToken")
    val refreshToken: String,
    val user: User
)

@Serializable
data class User(
    val id: Int,
    val username: String,
    val role: String,
    @SerialName("areaId")
    val areaId: Int? = null,
    @SerialName("stationId")
    val stationId: Int? = null
)

@Serializable
data class QueueUpdate(
    @SerialName("waitingCount")
    val waitingCount: Int,
    @SerialName("nextTickets")
    val nextTickets: List<Ticket> = emptyList()
)

@Serializable
data class TicketCalled(
    val ticket: Ticket,
    @SerialName("voiceText")
    val voiceText: String? = null
)

@Serializable
data class TicketCancelled(
    @SerialName("ticketId")
    val ticketId: Int
)
