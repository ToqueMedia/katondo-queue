package ao.katondo.display

import android.content.Context
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.lifecycleScope
import ao.katondo.display.ui.DisplayScreen
import ao.katondo.display.ui.LoginScreen
import ao.katondo.display.viewmodel.DisplayViewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    private val viewModel: DisplayViewModel by viewModels()
    private var wakeLock: android.os.PowerManager.WakeLock? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        acquireWakeLock()

        setContent {
            MaterialTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    DisplayApp()
                }
            }
        }

        // Setup fullscreen AFTER setContent() so decorView is available
        setupFullscreen()

        // Start time updates
        val scope = kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.Main)
        scope.launch {
            while (true) {
                viewModel.updateTime()
                delay(1000)
            }
        }
    }

    @Composable
    private fun DisplayApp() {
        val state by viewModel.state.collectAsStateWithLifecycle()
        var showLogin by remember { mutableStateOf(true) }

        // Check if we have saved credentials
        LaunchedEffect(Unit) {
            val credentials = viewModel.getCredentials()
            if (credentials != null) {
                viewModel.initialize(credentials.first, credentials.second, credentials.third, credentials.fourth)
                showLogin = false
            }
        }

        when {
            showLogin -> {
                val credentials = viewModel.getCredentials()
                LoginScreen(
                    initialServerHost = credentials?.first ?: "",
                    initialServerPort = credentials?.second ?: "3001",
                    initialUsername = credentials?.third ?: "",
                    initialPassword = credentials?.fourth ?: "",
                    onLogin = { serverHost, serverPort, username, password ->
                        viewModel.saveCredentials(serverHost, serverPort, username, password)
                        viewModel.initialize(serverHost, serverPort, username, password)
                        showLogin = false
                    }
                )
            }
            else -> {
                val credentials = viewModel.getCredentials()
                DisplayScreen(
                    state = state,
                    initialHost = credentials?.first ?: "",
                    initialPort = credentials?.second ?: "3001",
                    onLogout = {
                        viewModel.logout()
                        showLogin = true
                    },
                    onReconnect = { serverHost, serverPort ->
                        if (credentials != null) {
                            viewModel.saveCredentials(serverHost, serverPort, credentials.third, credentials.fourth)
                            viewModel.initialize(serverHost, serverPort, credentials.third, credentials.fourth)
                        }
                    },
                    onAdEnded = {
                        viewModel.nextAd()
                    }
                )
            }
        }
    }

    private fun setupFullscreen() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.setDecorFitsSystemWindows(false)
            window.insetsController?.apply {
                hide(WindowInsets.Type.systemBars())
                systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }
        } else {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = (
                View.SYSTEM_UI_FLAG_FULLSCREEN
                or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            )
        }
    }

    private fun acquireWakeLock() {
        try {
            val powerManager = getSystemService(POWER_SERVICE) as android.os.PowerManager
            wakeLock = powerManager.newWakeLock(
                android.os.PowerManager.SCREEN_BRIGHT_WAKE_LOCK or
                android.os.PowerManager.ACQUIRE_CAUSES_WAKEUP,
                "KatondoDisplay:WakeLock"
            )
            wakeLock?.acquire(24 * 60 * 60 * 1000L) // 24 hours
        } catch (e: Exception) {
            android.util.Log.e("MainActivity", "Failed to acquire wake lock due to device restrictions: ${e.message}", e)
        }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            setupFullscreen()
        }
    }

    override fun onDestroy() {
        try {
            wakeLock?.let {
                if (it.isHeld) it.release()
            }
        } catch (e: Exception) {
            android.util.Log.e("MainActivity", "Failed to release wake lock: ${e.message}", e)
        }
        super.onDestroy()
    }

    companion object {
        private const val PREFS_NAME = "katondo_display_prefs"
    }
}
