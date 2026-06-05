// Voice config service — per-area TTS configuration

import { eq } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { voiceConfigs } from '../db/schema.js';
// NotFoundError not used — getVoiceConfig returns defaults instead of throwing
import { logger } from '../utils/logger.js';

export async function getVoiceConfig(areaId: number) {
  const config = await db.query.voiceConfigs.findFirst({
    where: eq(voiceConfigs.areaId, areaId),
  });

  if (!config) {
    // Return defaults if not configured
    return {
      id: 0,
      areaId,
      language: 'pt',
      voiceName: null,
      speed: 1,
      voiceTextTemplate: 'Senha {ticketNumber}, dirija-se à {stationName}',
      callSoundMode: 'chime',
      createdAt: new Date(),
    };
  }

  return {
    ...config,
    voiceTextTemplate: config.voiceTextTemplate || 'Senha {ticketNumber}, dirija-se à {stationName}',
  };
}

export async function upsertVoiceConfig(
  areaId: number,
  updates: { language?: string; voiceName?: string | null; speed?: number; voiceTextTemplate?: string | null; callSoundMode?: string },
) {
  const existing = await db.query.voiceConfigs.findFirst({
    where: eq(voiceConfigs.areaId, areaId),
  });

  if (existing) {
    const { voiceTextTemplate, ...rest } = updates;
    const setPayload: any = { ...rest };
    if (typeof voiceTextTemplate === 'string') setPayload.voiceTextTemplate = voiceTextTemplate;
    await db.update(voiceConfigs)
      .set(setPayload)
      .where(eq(voiceConfigs.areaId, areaId));
    logger.info('Voice config updated', { module: 'voice', areaId });
  } else {
    await db.insert(voiceConfigs).values({
      areaId,
      language: updates.language || 'pt',
      voiceName: updates.voiceName || null,
      speed: updates.speed || 1,
      voiceTextTemplate: updates.voiceTextTemplate || 'Senha {ticketNumber}, dirija-se à {stationName}',
      callSoundMode: updates.callSoundMode || 'chime',
    });
    logger.info('Voice config created', { module: 'voice', areaId });
  }

  return getVoiceConfig(areaId);
}