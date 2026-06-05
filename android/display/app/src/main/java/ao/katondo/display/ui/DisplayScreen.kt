package ao.katondo.display.ui

import android.net.Uri
import androidx.annotation.OptIn
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.MediaItem
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import ao.katondo.display.model.Advertisement
import ao.katondo.display.viewmodel.DisplayState
import coil.compose.AsyncImage
import coil.request.ImageRequest

@Composable
fun DisplayScreen(
    state: DisplayState,
    initialHost: String,
    initialPort: String,
    onLogout: () -> Unit,
    onReconnect: (String, String) -> Unit,
    onAdEnded: () -> Unit = {}
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF0A192F))
    ) {
        // Ambient glows
        Box(
            modifier = Modifier
                .size(500.dp)
                .offset(x = (-100).dp, y = (-100).dp)
                .background(
                    Color(0x1F059669).copy(alpha = 0.12f),
                    shape = androidx.compose.foundation.shape.CircleShape
                )
        )
        Box(
            modifier = Modifier
                .size(450.dp)
                .align(Alignment.BottomStart)
                .offset(x = (-50).dp, y = (50).dp)
                .background(
                    Color(0xFF1565C0).copy(alpha = 0.10f),
                    shape = androidx.compose.foundation.shape.CircleShape
                )
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp)
        ) {
            // Header
            DisplayHeader(
                currentTime = state.currentTime,
                onLogout = onLogout
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Main content - 3 columns
            Row(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Left column - Active tickets by counter/station
                ActiveTicketsColumn(
                    tickets = state.activeTickets,
                    modifier = Modifier.weight(0.25f)
                )

                // Center column - Media
                val mediaAds = remember(state.advertisements) {
                    state.advertisements.filter { it.contentType == "image" || it.contentType == "video" }
                }
                MediaColumn(
                    advertisements = mediaAds,
                    currentAdIndex = state.currentAdIndex,
                    onAdEnded = onAdEnded,
                    modifier = Modifier.weight(0.5f)
                )

                // Right column - Current ticket and previous 2 calls
                CurrentTicketColumn(
                    currentTicket = state.currentTicket,
                    voiceText = state.currentVoiceText,
                    recentCalls = state.recentCalls,
                    modifier = Modifier.weight(0.25f)
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Footer with news ticker
            DisplayFooter(advertisements = state.advertisements)
        }

        // Loading overlay
        if (state.isLoading) {
            LoadingOverlay()
        }

        // Connection status
        if (!state.isConnected && !state.isLoading) {
            ConnectionErrorOverlay(
                errorMessage = state.errorMessage,
                initialHost = initialHost,
                initialPort = initialPort,
                onReconnect = onReconnect
            )
        }
    }
}

@Composable
private fun DisplayHeader(
    currentTime: String,
    onLogout: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color.Black.copy(alpha = 0.25f))
            .padding(horizontal = 24.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Logo and title
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            androidx.compose.foundation.Image(
                painter = androidx.compose.ui.res.painterResource(id = ao.katondo.display.R.drawable.logo_katondo),
                contentDescription = "Logo Katondo",
                modifier = Modifier.height(44.dp),
                contentScale = ContentScale.Fit
            )
        }

        // Clock and logout
        Row(
            horizontalArrangement = Arrangement.spacedBy(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = currentTime,
                fontSize = 28.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White
            )
            IconButton(onClick = onLogout) {
                Text(
                    text = "⎋",
                    fontSize = 20.sp,
                    color = Color.White.copy(alpha = 0.6f)
                )
            }
        }
    }
}

@Composable
private fun ActiveTicketsColumn(
    tickets: List<ao.katondo.display.model.Ticket>,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxHeight()
            .background(Color.Black.copy(alpha = 0.2f))
            .padding(16.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Senhas em atendimento",
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White.copy(alpha = 0.9f)
            )
        }

        Spacer(modifier = Modifier.height(16.dp))

        if (tickets.isEmpty()) {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "Sem chamadas activas",
                    color = Color.White.copy(alpha = 0.4f),
                    fontSize = 16.sp
                )
            }
        } else {
            Column(
                modifier = Modifier.fillMaxSize(),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                tickets.take(8).forEach { ticket ->
                    ActiveTicketItem(
                        ticket = ticket
                    )
                }
            }
        }
    }
}

@Composable
private fun ActiveTicketItem(
    ticket: ao.katondo.display.model.Ticket
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color.White.copy(alpha = 0.06f))
            .padding(horizontal = 16.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(
            modifier = Modifier.weight(1f),
            horizontalAlignment = Alignment.Start
        ) {
            Text(
                text = ticket.stationName ?: "Balcão",
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White,
                maxLines = 1,
                overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis
            )
            val serviceName = ticket.serviceName
            if (!serviceName.isNullOrBlank()) {
                Text(
                    text = serviceName,
                    fontSize = 11.sp,
                    color = Color.White.copy(alpha = 0.5f),
                    maxLines = 1,
                    overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis
                )
            }
        }
        Text(
            text = ticket.number,
            fontSize = 22.sp,
            fontWeight = FontWeight.Black,
            color = Color(0xFF34D399),
            modifier = Modifier.padding(start = 8.dp)
        )
    }
}

@Composable
private fun MediaColumn(
    advertisements: List<ao.katondo.display.model.Advertisement>,
    currentAdIndex: Int,
    onAdEnded: () -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current

    Box(
        modifier = modifier
            .fillMaxHeight()
            .clipToBounds()
            .background(Color.Black)
            .padding(2.dp),
        contentAlignment = Alignment.Center
    ) {
        if (advertisements.isEmpty()) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text(
                    text = "📺",
                    fontSize = 80.sp
                )
                Text(
                    text = "Aguarde — em breve conteúdo informativo",
                    fontSize = 20.sp,
                    color = Color.White.copy(alpha = 0.6f)
                )
            }
        } else {
            val safeAdIndex = if (currentAdIndex >= 0) currentAdIndex % advertisements.size else 0
            val currentAd = advertisements.getOrNull(safeAdIndex)

            // Timer-based auto-rotation for image advertisements
            if (currentAd?.contentType == "image") {
                val duration = (currentAd.durationSeconds).coerceAtLeast(3)
                LaunchedEffect(safeAdIndex, advertisements) {
                    kotlinx.coroutines.delay(duration * 1000L)
                    onAdEnded()
                }
            }

            when (currentAd?.contentType) {
                "image" -> {
                    val imageUrl = currentAd.contentUrl
                    if (!imageUrl.isNullOrBlank()) {
                        AsyncImage(
                            model = ImageRequest.Builder(context)
                                .data(imageUrl)
                                .crossfade(true)
                                .build(),
                            contentDescription = currentAd.title,
                            modifier = Modifier.fillMaxSize(),
                            contentScale = ContentScale.Crop
                        )
                    } else {
                        Text(
                            text = currentAd.contentText ?: currentAd.title,
                            fontSize = 24.sp,
                            color = Color.White,
                            textAlign = androidx.compose.ui.text.style.TextAlign.Center
                        )
                    }
                }
                "video" -> {
                    val videoUrl = currentAd.contentUrl
                    if (!videoUrl.isNullOrBlank()) {
                        VideoPlayer(
                            videoUrl = videoUrl,
                            adKey = "${currentAd.id}-$safeAdIndex",
                            isLooping = advertisements.size == 1,
                            onVideoEnded = onAdEnded
                        )
                    } else {
                        Text(
                            text = "🎬 ${currentAd.title}",
                            fontSize = 24.sp,
                            color = Color.White
                        )
                    }
                }
                else -> {
                    Text(
                        text = currentAd?.title ?: "",
                        fontSize = 24.sp,
                        color = Color.White
                    )
                }
            }
        }
    }
}

@OptIn(UnstableApi::class)
@Composable
private fun VideoPlayer(
    videoUrl: String,
    adKey: String,
    isLooping: Boolean,
    onVideoEnded: () -> Unit
) {
    val context = LocalContext.current
    var exoPlayer by remember(adKey) { mutableStateOf<ExoPlayer?>(null) }

    DisposableEffect(adKey) {
        val player = ExoPlayer.Builder(context).build().apply {
            setMediaItem(MediaItem.fromUri(Uri.parse(videoUrl)))
            repeatMode = if (isLooping) ExoPlayer.REPEAT_MODE_ONE else ExoPlayer.REPEAT_MODE_OFF
            playWhenReady = true
            prepare()
        }
        
        val listener = object : androidx.media3.common.Player.Listener {
            override fun onPlaybackStateChanged(playbackState: Int) {
                if (!isLooping && playbackState == androidx.media3.common.Player.STATE_ENDED) {
                    onVideoEnded()
                }
            }

            override fun onPlayerError(error: androidx.media3.common.PlaybackException) {
                android.util.Log.e("VideoPlayer", "Playback error for url: $videoUrl", error)
                onVideoEnded() // Skip ad on playback failure to avoid hanging
            }
        }
        
        player.addListener(listener)
        exoPlayer = player

        onDispose {
            player.removeListener(listener)
            player.release()
        }
    }

    exoPlayer?.let { player ->
        AndroidView(
            factory = { ctx ->
                PlayerView(ctx).apply {
                    this.player = player
                    useController = false
                    resizeMode = androidx.media3.ui.AspectRatioFrameLayout.RESIZE_MODE_ZOOM
                    setShowBuffering(PlayerView.SHOW_BUFFERING_ALWAYS)
                }
            },
            modifier = Modifier.fillMaxSize()
        )
    }
}

@Composable
private fun CurrentTicketColumn(
    currentTicket: ao.katondo.display.model.Ticket?,
    voiceText: String?,
    recentCalls: List<ao.katondo.display.model.Ticket>,
    modifier: Modifier = Modifier
) {
    val previousTickets = remember(recentCalls, currentTicket) {
        if (currentTicket != null) {
            recentCalls.filter { it.id != currentTicket.id }
        } else {
            recentCalls
        }
    }

    // Animated flash color for background (starts at transparent, flashes to brand green)
    val flashColor = remember { androidx.compose.animation.Animatable(Color.Transparent) }
    LaunchedEffect(currentTicket?.id) {
        if (currentTicket != null) {
            // Flash 5 times: alternate between brand green background and transparent
            repeat(5) {
                flashColor.animateTo(
                    targetValue = Color(0xFF009688), // Brand Green
                    animationSpec = tween(durationMillis = 250, easing = LinearEasing)
                )
                flashColor.animateTo(
                    targetValue = Color.Transparent,
                    animationSpec = tween(durationMillis = 250, easing = LinearEasing)
                )
            }
        }
    }

    // Determine colors based on whether background is currently flashing (instant on/off flash contrast!)
    val isFlashing = flashColor.value != Color.Transparent
    val cardBgColor = if (isFlashing) Color(0xFF009688) else Color.Black.copy(alpha = 0.3f)
    val ticketTextColor = if (isFlashing) Color.White else Color(0xFF34D399)
    val serviceTextColor = if (isFlashing) Color.White.copy(alpha = 0.9f) else Color(0xFF34D399).copy(alpha = 0.9f)
    val labelTextColor = if (isFlashing) Color.White.copy(alpha = 0.85f) else Color.White.copy(alpha = 0.75f)
    val voiceTextColor = if (isFlashing) Color.White.copy(alpha = 0.85f) else Color.White.copy(alpha = 0.65f)

    Column(
        modifier = modifier
            .fillMaxHeight()
            .background(Color.Black.copy(alpha = 0.2f))
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Top
    ) {
        if (currentTicket != null) {
            Text(
                text = "Última senha chamada",
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White.copy(alpha = 0.85f),
            )

            Spacer(modifier = Modifier.height(16.dp))

            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = cardBgColor
                )
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    // Service name above the ticket number
                    val sName = currentTicket.serviceName
                    if (!sName.isNullOrBlank()) {
                        Text(
                            text = sName,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = serviceTextColor,
                            maxLines = 1,
                            overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                    }

                    // Ticket number — horizontal, fits within column (Auto-sizes dynamically to prevent line wraps and truncation on any screen)
                    var numberScale by remember(currentTicket.number) { mutableStateOf(1f) }
                    Text(
                        text = currentTicket.number,
                        fontSize = (44 * numberScale).sp,
                        fontWeight = FontWeight.Black,
                        color = ticketTextColor,
                        maxLines = 1,
                        softWrap = false,
                        onTextLayout = { textLayoutResult ->
                            if (textLayoutResult.hasVisualOverflow) {
                                numberScale *= 0.9f
                            }
                        }
                    )

                    val stName = currentTicket.stationName
                    if (stName != null) {
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "Estação",
                            fontSize = 12.sp,
                            color = labelTextColor
                        )
                        Text(
                            text = stName,
                            fontSize = 24.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White,
                            maxLines = 1,
                            overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis
                        )
                    }

                    if (voiceText != null) {
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = voiceText,
                            fontSize = 12.sp,
                            color = voiceTextColor,
                            fontStyle = androidx.compose.ui.text.font.FontStyle.Italic,
                            maxLines = 2,
                            overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
                            textAlign = androidx.compose.ui.text.style.TextAlign.Center
                        )
                    }
                }
            }
        } else {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text(
                    text = "🔔",
                    fontSize = 80.sp
                )
                Text(
                    text = "A aguardar chamada...",
                    fontSize = 20.sp,
                    color = Color.White.copy(alpha = 0.6f)
                )
            }
        }

        // Previous calls list (show up to 2 previously called tickets)
        if (previousTickets.isNotEmpty()) {
            Spacer(modifier = Modifier.height(24.dp))

            Text(
                text = "Chamadas anteriores",
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White.copy(alpha = 0.5f),
                letterSpacing = 1.sp
            )

            Spacer(modifier = Modifier.height(12.dp))

            Column(
                verticalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                previousTickets.take(2).forEach { prevTicket ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Color.White.copy(alpha = 0.04f), shape = androidx.compose.foundation.shape.RoundedCornerShape(10.dp))
                            .padding(horizontal = 16.dp, vertical = 10.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(
                                text = prevTicket.number,
                                fontSize = 18.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color(0xFF34D399).copy(alpha = 0.7f)
                            )
                            val prevSvc = prevTicket.serviceName
                            if (!prevSvc.isNullOrBlank()) {
                                Text(
                                    text = prevSvc,
                                    fontSize = 10.sp,
                                    color = Color.White.copy(alpha = 0.4f),
                                    maxLines = 1,
                                    overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis
                                )
                            }
                        }
                        Text(
                            text = prevTicket.stationName ?: "Balcão",
                            fontSize = 14.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = Color.White.copy(alpha = 0.6f),
                            maxLines = 1,
                            overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun DisplayFooter(
    advertisements: List<Advertisement> = emptyList()
) {
    // Extract text ads for ticker
    val textAds = advertisements
        .filter { it.contentType == "text" && !it.contentText.isNullOrBlank() }
        .map { it.contentText ?: it.title }

    // Build ticker content: clinic info + text ads
    val clinicInfo = "Clínica General Katondo  •  Talatona, Luanda, Angola  •  +244 923 168 644  •  Funcionamos 24h por dia, 7 dias por semana"
    val tickerText = if (textAds.isNotEmpty()) {
        "$clinicInfo  •  ${textAds.joinToString("  •  ")}"
    } else {
        clinicInfo
    }

    // Footer ticker
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color.Black.copy(alpha = 0.22f))
            .padding(vertical = 12.dp)
            .clipToBounds()
    ) {
        FooterTicker(text = tickerText)
    }
}

/**
 * Smooth horizontal scrolling ticker for footer text
 */
@Composable
private fun FooterTicker(
    text: String,
    modifier: Modifier = Modifier
) {
    val infiniteTransition = rememberInfiniteTransition(label = "footer_ticker")
    var textWidth by remember { mutableStateOf(0f) }
    var containerWidth by remember { mutableStateOf(0f) }

    // Speed: ~60dp per second, minimum 20s
    val durationMillis = remember(text, textWidth, containerWidth) {
        ((textWidth + containerWidth) * 16).toInt().coerceAtLeast(20000)
    }

    val offsetX by infiniteTransition.animateFloat(
        initialValue = containerWidth,
        targetValue = -textWidth,
        animationSpec = infiniteRepeatable(
            animation = tween(
                durationMillis = durationMillis,
                easing = LinearEasing
            ),
            repeatMode = RepeatMode.Restart
        ),
        label = "footer_ticker_offset"
    )

    Row(
        modifier = modifier
            .fillMaxWidth()
            .onSizeChanged { size ->
                containerWidth = size.width.toFloat()
            }
    ) {
        Text(
            text = "     $text     ",
            fontSize = 14.sp,
            fontWeight = FontWeight.Medium,
            color = Color.White.copy(alpha = 0.65f),
            maxLines = 1,
            modifier = Modifier
                .offset(x = with(LocalDensity.current) { offsetX.toDp() })
                .onSizeChanged { size ->
                    textWidth = size.width.toFloat()
                }
        )
    }
}

@Composable
private fun LoadingOverlay() {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF0A192F).copy(alpha = 0.95f)),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            CircularProgressIndicator(
                color = Color(0xFF34D399),
                modifier = Modifier.size(64.dp)
            )
            Text(
                text = "A conectar ao servidor...",
                fontSize = 20.sp,
                fontWeight = FontWeight.SemiBold,
                color = Color.White
            )
            Text(
                text = "A aguardar ligação à rede",
                fontSize = 14.sp,
                color = Color.White.copy(alpha = 0.6f)
            )
        }
    }
}

@Composable
private fun ConnectionErrorOverlay(
    errorMessage: String?,
    initialHost: String,
    initialPort: String,
    onReconnect: (String, String) -> Unit
) {
    var host by remember { mutableStateOf(initialHost) }
    var port by remember { mutableStateOf(initialPort) }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF0A192F).copy(alpha = 0.95f)),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp),
            modifier = Modifier
                .padding(32.dp)
                .width(360.dp)
                .verticalScroll(rememberScrollState())
        ) {
            Text(
                text = "⚠️",
                fontSize = 64.sp
            )
            Text(
                text = "Erro de Conexão",
                fontSize = 24.sp,
                fontWeight = FontWeight.Bold,
                color = Color(0xFFFF6B6B)
            )
            Text(
                text = errorMessage ?: "Não foi possível conectar ao servidor",
                fontSize = 16.sp,
                color = Color.White.copy(alpha = 0.8f),
                textAlign = androidx.compose.ui.text.style.TextAlign.Center
            )
            Text(
                text = "Verifique se o servidor está a correr e se o IP está correto",
                fontSize = 14.sp,
                color = Color.White.copy(alpha = 0.6f),
                textAlign = androidx.compose.ui.text.style.TextAlign.Center
            )

            Spacer(modifier = Modifier.height(8.dp))

            OutlinedTextField(
                value = host,
                onValueChange = { host = it },
                label = { Text("IP / Host do Servidor") },
                singleLine = true,
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = Color(0xFF34D399),
                    focusedLabelColor = Color(0xFF34D399),
                    unfocusedBorderColor = Color.White.copy(alpha = 0.3f),
                    unfocusedLabelColor = Color.White.copy(alpha = 0.6f),
                    focusedTextColor = Color.White,
                    unfocusedTextColor = Color.White
                ),
                modifier = Modifier.fillMaxWidth()
            )

            OutlinedTextField(
                value = port,
                onValueChange = { port = it },
                label = { Text("Porta") },
                singleLine = true,
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = Color(0xFF34D399),
                    focusedLabelColor = Color(0xFF34D399),
                    unfocusedBorderColor = Color.White.copy(alpha = 0.3f),
                    unfocusedLabelColor = Color.White.copy(alpha = 0.6f),
                    focusedTextColor = Color.White,
                    unfocusedTextColor = Color.White
                ),
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(16.dp))

            Button(
                onClick = { onReconnect(host, port) },
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color(0xFF34D399),
                    contentColor = Color(0xFF0A192F)
                ),
                modifier = Modifier.fillMaxWidth().height(48.dp)
            ) {
                Text(
                    text = "Atualizar IP e Reconectar",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}
