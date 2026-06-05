package ao.katondo.display.network

import ao.katondo.display.model.Advertisement
import ao.katondo.display.model.LoginRequest
import ao.katondo.display.model.LoginResponse
import ao.katondo.display.model.VoiceConfig
import kotlinx.serialization.json.Json
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query
import java.util.concurrent.TimeUnit

interface KatondoApi {
    @GET("api/settings/server-url")
    suspend fun getServerUrl(): ServerUrlResponse

    @POST("api/auth/login")
    suspend fun login(@Body request: LoginRequest): LoginResponse

    @GET("api/advertisements")
    suspend fun getAdvertisements(
        @Header("Authorization") auth: String,
        @Query("areaId") areaId: Int? = null
    ): List<Advertisement>

    @GET("api/voice-config/{areaId}")
    suspend fun getVoiceConfig(
        @Header("Authorization") auth: String,
        @Path("areaId") areaId: Int
    ): VoiceConfig

    @GET("api/tickets")
    suspend fun getTickets(
        @Header("Authorization") auth: String,
        @Query("areaId") areaId: Int? = null,
        @Query("status") status: String? = null,
        @Query("date") date: String? = null
    ): List<ao.katondo.display.model.Ticket>

    @POST("api/auth/refresh")
    suspend fun refreshToken(@Body body: Map<String, String>): LoginResponse
}

@kotlinx.serialization.Serializable
data class ServerUrlResponse(
    val serverUrl: String
)

class ApiClient(private val baseUrl: String) {
    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
    }

    private val loggingInterceptor = HttpLoggingInterceptor().apply {
        level = HttpLoggingInterceptor.Level.BODY
    }

    private val okHttpClient = OkHttpClient.Builder()
        .addInterceptor(loggingInterceptor)
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()

    private val retrofit = Retrofit.Builder()
        .baseUrl(baseUrl)
        .client(okHttpClient)
        .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
        .build()

    val api: KatondoApi = retrofit.create(KatondoApi::class.java)

    suspend fun login(username: String, password: String): Result<LoginResponse> {
        return try {
            val response = api.login(LoginRequest(username, password))
            Result.success(response)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun fetchServerUrl(): Result<String> {
        return try {
            val response = api.getServerUrl()
            Result.success(response.serverUrl)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getAdvertisements(token: String, areaId: Int?): Result<List<Advertisement>> {
        return try {
            val response = api.getAdvertisements("Bearer $token", areaId)
            Result.success(response)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getVoiceConfig(token: String, areaId: Int): Result<VoiceConfig> {
        return try {
            val response = api.getVoiceConfig("Bearer $token", areaId)
            Result.success(response)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getTickets(token: String, areaId: Int?, status: String?, date: String?): Result<List<ao.katondo.display.model.Ticket>> {
        return try {
            val response = api.getTickets("Bearer $token", areaId, status, date)
            Result.success(response)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
