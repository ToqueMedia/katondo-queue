// Admin — System Settings (server configuration)

import { useState, useEffect } from 'react';
import { VStack, Heading, Text, Button, Field, Input, Separator } from '@chakra-ui/react';
import { getSettings, updateSetting } from '../../api/settings';
import { useNotificationStore } from '../../store/notification-store';
import { AdminPageHeader, AdminSectionCard } from '../../components/admin/admin-page';

export default function AdminSettings() {
  const [serverHost, setServerHost] = useState('');
  const [serverPort, setServerPort] = useState('');
  const [saving, setSaving] = useState(false);
  const notify = useNotificationStore();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const settings = await getSettings();
      setServerHost(settings.server_host || 'localhost');
      setServerPort(settings.server_port || '3001');
    } catch {
      // ignore
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSetting('server_host', serverHost, 'IP ou hostname do servidor na rede local');
      await updateSetting('server_port', serverPort, 'Porta do servidor');
      notify.addNotification({ type: 'success', title: 'Configurações guardadas' });
    } catch (err: any) {
      notify.addNotification({ type: 'error', title: err.response?.data?.error || 'Erro ao guardar' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <VStack gap={6} align="stretch">
      <AdminPageHeader
        title="Configurações do Sistema"
        description="Defina parâmetros usados pelos dispositivos Android e integrações locais."
      />

      <AdminSectionCard>
          <VStack gap={4} align="stretch" p={6}>
            <Heading size="md">Configuração do Servidor</Heading>
            <Text fontSize="sm" color="gray.600">
              Configure o IP e porta do servidor para os dispositivos Android (displays e dispensadores).
            </Text>
            
            <Field.Root>
              <Field.Label>IP / Hostname</Field.Label>
              <Input 
                value={serverHost} 
                onChange={(e) => setServerHost(e.target.value)}
                placeholder="192.168.1.100"
              />
            </Field.Root>

            <Field.Root>
              <Field.Label>Porta</Field.Label>
              <Input 
                value={serverPort} 
                onChange={(e) => setServerPort(e.target.value)}
                placeholder="3001"
              />
            </Field.Root>

            <Text fontSize="xs" color="gray.500">
              URL completo: <strong>http://{serverHost}:{serverPort}</strong>
            </Text>

            <Separator />

            <Button 
              colorPalette="teal" 
              size="sm" 
              alignSelf="start"
              loading={saving}
              onClick={handleSave}
            >
              Guardar Configurações
            </Button>
          </VStack>
      </AdminSectionCard>
    </VStack>
  );
}
