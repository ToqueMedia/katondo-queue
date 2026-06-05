// Management — Sound & Chime Configuration per Area with custom audio uploading

import { useState, useEffect, useRef } from 'react';
import { Heading, Text, VStack, Button, Flex, Card, Badge, Separator, SimpleGrid, Box } from '@chakra-ui/react';
import { NativeSelect } from '@chakra-ui/react';
import { listAreas } from '../../api/areas';
import { getVoiceConfig, updateVoiceConfig } from '../../api/voice-config';
import apiClient from '../../api/client';
import { useNotificationStore } from '../../store/notification-store';
import type { AreaRow, VoiceConfigRow } from '../../types';

export default function VoiceConfig() {
  const [areas, setAreas] = useState<AreaRow[]>([]);
  const [configs, setConfigs] = useState<Record<number, VoiceConfigRow>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const notify = useNotificationStore();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const a = await listAreas();
      setAreas(a);
      const cfgs: Record<number, VoiceConfigRow> = {};
      for (const area of a) {
        const cfg = await getVoiceConfig(area.id);
        cfgs[area.id] = cfg;
      }
      setConfigs(cfgs);
    } catch {
      notify.addNotification({ type: 'error', title: 'Erro ao carregar dados' });
    } finally { setLoading(false); }
  };

  const handleSave = async (areaId: number) => {
    setSavingId(areaId);
    try {
      const cfg = configs[areaId];
      await updateVoiceConfig(areaId, {
        callSoundMode: cfg.callSoundMode || 'chime',
      });
      notify.addNotification({ type: 'success', title: 'Configuração de som guardada' });
    } catch (err: any) {
      notify.addNotification({ type: 'error', title: err.response?.data?.error || 'Erro ao guardar' });
    } finally { setSavingId(null); }
  };

  const handleFileUpload = async (areaId: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate strictly is an MP3 file
    if (!file.type.includes('mpeg') && !file.type.includes('mp3') && !file.name.endsWith('.mp3')) {
      notify.addNotification({ type: 'error', title: 'Formato inválido. Por favor, envie um arquivo de som no formato MP3 (.mp3).' });
      return;
    }

    setUploadingId(areaId);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const { data } = await apiClient.post<{ url: string; filename: string }>('/upload/chime-sound', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      // Update local state with the uploaded file URL
      updateCfg(areaId, { callSoundMode: data.url });
      notify.addNotification({ type: 'success', title: 'Som personalizado enviado! Lembre-se de clicar em Gravar.' });
    } catch {
      notify.addNotification({ type: 'error', title: 'Erro ao enviar arquivo de som' });
    } finally {
      setUploadingId(null);
    }
  };

  const testSound = (soundMode: string) => {
    try {
      // If custom sound, play from server base URL
      if (soundMode.startsWith('/uploads/')) {
        const baseUrl = apiClient.defaults.baseURL || '';
        const serverUrl = baseUrl.endsWith('/api') ? baseUrl.slice(0, -4) : baseUrl;
        const audio = new Audio(serverUrl + soundMode);
        audio.play().catch(() => {
          notify.addNotification({ type: 'error', title: 'Não foi possível reproduzir o som personalizado localmente.' });
        });
        return;
      }

      // Play standard chime synthetically in browser
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();

      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, audioCtx.currentTime);
      gain1.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
      osc1.start(audioCtx.currentTime);
      osc1.stop(audioCtx.currentTime + 0.4);

      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1200, audioCtx.currentTime + 0.15);
      gain2.gain.setValueAtTime(0.3, audioCtx.currentTime + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.55);
      osc2.start(audioCtx.currentTime + 0.15);
      osc2.stop(audioCtx.currentTime + 0.55);

    } catch (err) {
      console.error(err);
    }
  };

  const updateCfg = (areaId: number, updates: Partial<VoiceConfigRow>) => {
    setConfigs((prev) => ({ ...prev, [areaId]: { ...prev[areaId], ...updates } }));
  };

  if (loading) {
    return (
      <VStack gap={4} align="stretch">
        <Heading size="lg">Configuração de Som</Heading>
        <Text color="gray.600">Personalize o som de notificação das chamadas por área.</Text>
        <Card.Root><Card.Body><Text>Carregando...</Text></Card.Body></Card.Root>
      </VStack>
    );
  }

  return (
    <VStack gap={6} align="stretch">
      <Flex justify="space-between" align="center">
        <VStack gap={1} align="start">
          <Heading size="lg">Configuração de Som das Chamadas</Heading>
          <Text color="gray.600">Ative, desative ou faça upload de um som personalizado para cada área.</Text>
        </VStack>
        <Button variant="outline" size="sm" onClick={loadData}>Actualizar</Button>
      </Flex>

      <SimpleGrid columns={{ base: 1, md: 2 }} gap={5}>
        {areas.map((area) => {
          const cfg = configs[area.id];
          if (!cfg) return null;

          const isSaving = savingId === area.id;
          const isUploading = uploadingId === area.id;
          const isCustomSound = cfg.callSoundMode?.startsWith('/uploads/');

          return (
            <Card.Root key={area.id} variant="outline">
              <Card.Body>
                <VStack gap={5} align="stretch">
                  <Flex justify="space-between" align="center">
                    <Heading size="md">{area.name}</Heading>
                    {isCustomSound ? (
                      <Badge colorPalette="teal" variant="solid">Som Personalizado</Badge>
                    ) : cfg.callSoundMode === 'none' ? (
                      <Badge colorPalette="gray" variant="outline">Silencioso</Badge>
                    ) : (
                      <Badge colorPalette="blue" variant="subtle">Sino Padrão</Badge>
                    )}
                  </Flex>

                  <Separator />

                  <VStack gap={4} align="stretch">
                    <VStack gap={2} align="stretch">
                      <Text fontSize="sm" fontWeight="medium" color="gray.700">Som de Notificação ao Chamar Senha</Text>
                      <NativeSelect.Root>
                        <NativeSelect.Field
                          value={isCustomSound ? 'custom' : (cfg.callSoundMode || 'chime')}
                          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                            const val = e.target.value;
                            if (val === 'custom') {
                              // Trigger click on hidden file input
                              fileInputRefs.current[area.id]?.click();
                            } else {
                              updateCfg(area.id, { callSoundMode: val });
                            }
                          }}
                        >
                          <option value="chime">🔔 Sino de Notificação Padrão</option>
                          <option value="custom">📤 Enviar/Usar Som Personalizado (.mp3)</option>
                          <option value="none">🔇 Desativado (Chamada Silenciosa)</option>
                        </NativeSelect.Field>
                      </NativeSelect.Root>

                      {/* Hidden File Input for Audio Upload */}
                      <input
                        type="file"
                        ref={el => { fileInputRefs.current[area.id] = el; }}
                        onChange={(e) => handleFileUpload(area.id, e)}
                        accept="audio/mp3,audio/mpeg"
                        style={{ display: 'none' }}
                      />

                      {isCustomSound && (
                        <Card.Root variant="subtle" size="sm" mt={1}>
                          <Card.Body>
                            <VStack gap={1} align="start">
                              <Text fontSize="xs" color="gray.500" fontWeight="medium">CAMINHO DO FICHEIRO ATIVO</Text>
                              <Text fontSize="xs" wordBreak="break-all" fontStyle="italic">{cfg.callSoundMode}</Text>
                              <Button size="xs" variant="outline" mt={1} onClick={() => fileInputRefs.current[area.id]?.click()}>
                                Substituir Ficheiro
                              </Button>
                            </VStack>
                          </Card.Body>
                        </Card.Root>
                      )}
                    </VStack>
                  </VStack>

                  <Flex gap={2} justify="space-between" pt={2} align="center">
                    <Box>
                      {isUploading && <Text fontSize="xs" color="teal.500">Enviando som...</Text>}
                    </Box>
                    <Flex gap={2}>
                      <Button size="sm" variant="ghost" onClick={() => testSound(cfg.callSoundMode)}>
                        🎧 Testar Som
                      </Button>
                      <Button size="sm" colorPalette="teal" loading={isSaving || isUploading} onClick={() => handleSave(area.id)}>
                        Guardar
                      </Button>
                    </Flex>
                  </Flex>
                </VStack>
              </Card.Body>
            </Card.Root>
          );
        })}
      </SimpleGrid>
    </VStack>
  );
}
