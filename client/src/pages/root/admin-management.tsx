// Root — Admin Management page

import { useState, useEffect } from 'react';
import { Heading, Text, VStack, Button, Badge, Flex, Dialog, Card, Separator } from '@chakra-ui/react';
import { Table } from '@chakra-ui/react';
import { Field, Input } from '@chakra-ui/react';
import { listUsers, createUser, deleteUser } from '../../api/users';
import { getSettings, updateSetting } from '../../api/settings';
import { useNotificationStore } from '../../store/notification-store';
import type { UserRow } from '../../types';

export default function AdminManagement() {
  const [admins, setAdmins] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  // Server settings
  const [serverHost, setServerHost] = useState('');
  const [serverPort, setServerPort] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  
  const notify = useNotificationStore();

  useEffect(() => {
    loadAdmins();
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const settings = await getSettings();
      setServerHost(settings.server_host || 'localhost');
      setServerPort(settings.server_port || '3001');
    } catch {
      // ignore — use defaults
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await updateSetting('server_host', serverHost, 'IP ou hostname do servidor na rede local');
      await updateSetting('server_port', serverPort, 'Porta do servidor');
      notify.addNotification({ type: 'success', title: 'Configurações guardadas' });
    } catch (err: any) {
      notify.addNotification({ type: 'error', title: err.response?.data?.error || 'Erro ao guardar' });
    } finally {
      setSavingSettings(false);
    }
  };

  const loadAdmins = async () => {
    setLoading(true);
    try {
      const usersList = await listUsers(true);
      setAdmins(usersList.filter((u) => u.role === 'admin'));
    } catch {
      notify.addNotification({ type: 'error', title: 'Erro ao carregar administradores' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      await createUser(newUsername, newPassword, 'admin');
      notify.addNotification({ type: 'success', title: 'Administrador criado' });
      setCreateOpen(false);
      setNewUsername('');
      setNewPassword('');
      loadAdmins();
    } catch (err: any) {
      notify.addNotification({ type: 'error', title: err.response?.data?.error || 'Erro ao criar administrador' });
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteClick = (admin: UserRow) => {
    setDeleteTarget(admin);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteUser(deleteTarget.id);
      notify.addNotification({ type: 'success', title: 'Administrador eliminado' });
      loadAdmins();
    } catch (err: any) {
      notify.addNotification({ type: 'error', title: err.response?.data?.error || 'Erro ao eliminar' });
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    }
  };

  return (
    <VStack gap={6} align="stretch">
      {/* Server Configuration */}
      <Card.Root>
        <Card.Body>
          <VStack gap={4} align="stretch">
            <Heading size="md">Configuração do Servidor</Heading>
            <Text fontSize="sm" color="gray.600">
              Configure o IP e porta do servidor para os dispositivos Android (displays e dispensadores).
            </Text>
            <Flex gap={4}>
              <Field.Root flex={2}>
                <Field.Label>IP / Hostname</Field.Label>
                <Input 
                  value={serverHost} 
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setServerHost(e.target.value)}
                  placeholder="192.168.1.100"
                />
              </Field.Root>
              <Field.Root flex={1}>
                <Field.Label>Porta</Field.Label>
                <Input 
                  value={serverPort} 
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setServerPort(e.target.value)}
                  placeholder="3001"
                />
              </Field.Root>
            </Flex>
            <Text fontSize="xs" color="gray.500">
              URL completo: <strong>http://{serverHost}:{serverPort}</strong>
            </Text>
            <Button 
              colorPalette="teal" 
              size="sm" 
              alignSelf="start"
              loading={savingSettings}
              onClick={handleSaveSettings}
            >
              Guardar Configurações
            </Button>
          </VStack>
        </Card.Body>
      </Card.Root>

      <Separator />

      {/* Admin Management */}
      <Flex justify="space-between" align="center">
        <Heading size="lg">Administradores</Heading>
        <Button colorPalette="teal" onClick={() => setCreateOpen(true)}>
          + Administrador
        </Button>
      </Flex>

      {loading ? (
        <Text>Carregando...</Text>
      ) : admins.length === 0 ? (
        <Text color="gray.500">Nenhum administrador criado — clique + para adicionar o primeiro administrador.</Text>
      ) : (
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader>ID</Table.ColumnHeader>
              <Table.ColumnHeader>Utilizador</Table.ColumnHeader>
              <Table.ColumnHeader>Estado</Table.ColumnHeader>
              <Table.ColumnHeader>Criado</Table.ColumnHeader>
              <Table.ColumnHeader>Acções</Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {admins.map((admin) => (
              <Table.Row key={admin.id}>
                <Table.Cell>{admin.id}</Table.Cell>
                <Table.Cell>{admin.username}</Table.Cell>
                <Table.Cell>
                  <Badge colorPalette={admin.active ? 'green' : 'red'}>
                    {admin.active ? 'Activo' : 'Inactivo'}
                  </Badge>
                </Table.Cell>
                <Table.Cell>{new Date(admin.createdAt).toLocaleDateString('pt')}</Table.Cell>
                <Table.Cell>
                  <Button size="sm" variant="ghost" colorPalette="red" onClick={() => handleDeleteClick(admin)}>
                    Eliminar
                  </Button>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      )}

      {/* Create dialog */}
      <Dialog.Root open={createOpen} onOpenChange={(e: { open: boolean }) => setCreateOpen(e.open)}>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Novo Administrador</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <VStack gap={4}>
                <Field.Root>
                  <Field.Label>Utilizador</Field.Label>
                  <Input value={newUsername} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewUsername(e.target.value)} />
                </Field.Root>
                <Field.Root>
                  <Field.Label>Senha</Field.Label>
                  <Input type="password" value={newPassword} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewPassword(e.target.value)} />
                </Field.Root>
              </VStack>
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancelar</Button>
              <Button colorPalette="teal" loading={creating} onClick={handleCreate}>Criar</Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>

      <Dialog.Root
        open={deleteDialogOpen}
        onOpenChange={(e: { open: boolean }) => setDeleteDialogOpen(e.open)}
      >
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Confirmar eliminação</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Text>
                Tem certeza que deseja eliminar o administrador <strong>{deleteTarget?.username}</strong>? Esta acção não pode ser revertida.
              </Text>
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="ghost" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
                Cancelar
              </Button>
              <Button colorPalette="red" loading={deleting} onClick={handleDeleteConfirm}>
                Eliminar
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </VStack>
  );
}
