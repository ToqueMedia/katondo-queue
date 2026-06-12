// Admin — Database Backup management with progress bar and local file saving

import { useState, useEffect } from 'react';
import { Heading, Text, VStack, Button, Flex, Badge, Box, Separator, Alert, SimpleGrid } from '@chakra-ui/react';
import { getBackupStatus, triggerBackupDownload } from '../../api/backup';
import { useNotificationStore } from '../../store/notification-store';
import { AdminPageHeader, AdminSectionCard } from '../../components/admin/admin-page';
import type { BackupStatusResponse } from '../../api/backup';

export default function BackupManagement() {
  const [status, setStatus] = useState<BackupStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [backingUp, setBackingUp] = useState(false);
  const [progress, setProgress] = useState(0);
  const notify = useNotificationStore();

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const s = await getBackupStatus();
      setStatus(s);
    } catch {
      notify.addNotification({ type: 'error', title: 'Erro ao carregar estado do backup' });
    } finally {
      setLoading(false);
    }
  };

  const handleBackup = async () => {
    setBackingUp(true);
    setProgress(0);

    // Beautiful progress bar animation (goes from 0% to 100% over 2 seconds during generation)
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          clearInterval(interval);
          return 90; // Wait at 90% until download actually finishes
        }
        return prev + 10;
      });
    }, 150);

    try {
      const blob = await triggerBackupDownload();

      // End progress bar immediately
      setProgress(100);
      clearInterval(interval);
      await new Promise(resolve => setTimeout(resolve, 300)); // Brief delay for success feel

      // Create local file save dialog
      const todayStr = new Date().toISOString().split('T')[0];
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `katondo_queue_backup_${todayStr}.sql`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      notify.addNotification({ type: 'success', title: 'Backup concluído e guardado com sucesso!' });

      // Reload status to reflect today's date
      loadStatus();
    } catch {
      notify.addNotification({ type: 'error', title: 'Erro ao gerar ou guardar o ficheiro de backup' });
    } finally {
      setBackingUp(false);
      setProgress(0);
    }
  };

  if (loading) {
    return (
      <VStack gap={4} align="stretch">
        <AdminPageHeader title="Cópias de Segurança" />
        <AdminSectionCard><Box p={6}><Text>Carregando...</Text></Box></AdminSectionCard>
      </VStack>
    );
  }

  return (
    <VStack gap={6} align="stretch">
      <AdminPageHeader
        title="Cópias de Segurança"
        description="Gere e descarregue cópias SQL da base de dados para proteção operacional."
      />

      {status?.isOverdue && (
        <Alert.Root status="warning" variant="subtle" borderRadius="12px">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title fontSize="md" fontWeight="bold">Cópia de Segurança Obrigatória em Atraso!</Alert.Title>
            <Alert.Description fontSize="sm">
              Já se passaram <strong>{status.daysSinceLastBackup} dias</strong> desde o seu último backup.
              Por razões de segurança e integridade dos dados da clínica, é altamente recomendável efetuar um backup agora.
            </Alert.Description>
          </Alert.Content>
        </Alert.Root>
      )}

      <SimpleGrid columns={{ base: 1, md: 2 }} gap={6}>
        {/* Main Backup Action Card */}
        <AdminSectionCard>
          <VStack gap={5} align="stretch" p={6}>
            <VStack gap={1} align="start">
              <Text fontSize="xs" fontWeight="bold" color="brand.600" textTransform="uppercase" letterSpacing="0.05em">Efectuar Backup</Text>
              <Heading size="md" fontWeight="600" color="ink.DEFAULT">Exportar Base de Dados</Heading>
              <Text fontSize="xs" color="ink.muted">Cria uma cópia completa de tabelas, configurações, utilizadores e histórico de senhas.</Text>
            </VStack>

            <Separator />

            <VStack gap={2} align="stretch" py={2}>
              <Flex justify="space-between">
                <Text fontSize="sm" color="ink.muted">Último Backup:</Text>
                <Badge colorPalette={status?.isOverdue ? 'orange' : 'emerald'} variant="subtle" px={2.5} py={0.5} borderRadius="6px">
                  {status?.lastBackupDate ? new Date(status.lastBackupDate).toLocaleDateString('pt', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Nunca'}
                </Badge>
              </Flex>
              <Flex justify="space-between">
                <Text fontSize="sm" color="ink.muted">Estado de Segurança:</Text>
                <Text fontSize="sm" fontWeight="bold" color={status?.isOverdue ? 'orange.600' : 'emerald.600'}>
                  {status?.isOverdue ? 'Atrasado (Aviso de risco)' : 'Protegido (Em dia)'}
                </Text>
              </Flex>
            </VStack>

            {backingUp && (
              <VStack gap={2} align="stretch" py={2}>
                <Flex justify="space-between" fontSize="xs" color="brand.600" fontWeight="bold">
                  <Text>A gerar ficheiro .sql...</Text>
                  <Text>{progress}%</Text>
                </Flex>
                <Box h="10px" bg="blackAlpha.50" borderRadius="full" overflow="hidden" border="1px solid" borderColor="blackAlpha.100">
                  <Box h="full" bg="brand.500" w={`${progress}%`} transition="width 0.2s ease" />
                </Box>
              </VStack>
            )}

            <Button
              colorPalette="teal"
              size="lg"
              h={12}
              borderRadius="10px"
              fontWeight="600"
              onClick={handleChimeSoundThenBackup}
              loading={backingUp}
            >
              Gerar e Guardar Backup (.sql)
            </Button>
          </VStack>
        </AdminSectionCard>

        {/* Information & Instructions Card */}
        <AdminSectionCard muted>
          <VStack gap={4} align="stretch" p={6}>
            <Heading size="sm" fontWeight="600" color="ink.DEFAULT">Boas Práticas de Segurança</Heading>

            <VStack gap={3} align="start" fontSize="sm" color="ink.muted">
              <Text>• <strong>Frequência Recomendada:</strong> Efetue cópias de segurança a cada 7 dias para evitar perda de dados em caso de sinistros físicos no servidor local.</Text>
              <Text>• <strong>Armazenamento Externo:</strong> Guarde os arquivos <code>.sql</code> descarregados num disco externo ou numa pasta segura de armazenamento na nuvem (Google Drive, OneDrive, etc.).</Text>
              <Text>• <strong>Importação/Restauro:</strong> O arquivo gerado é compatível com qualquer servidor MySQL standard e pode ser importado via phpMyAdmin ou CLI.</Text>
            </VStack>
          </VStack>
        </AdminSectionCard>
      </SimpleGrid>
    </VStack>
  );

  // Quick sound chime effect on click
  function handleChimeSoundThenBackup() {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1000, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + 0.15);
    } catch {}
    handleBackup();
  }
}
