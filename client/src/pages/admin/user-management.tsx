// Admin — User Management page

import { useState, useEffect } from 'react';
import { Heading, Text, VStack, Button, Badge, Flex, Dialog } from '@chakra-ui/react';
import { Table } from '@chakra-ui/react';
import { Field, Input } from '@chakra-ui/react';
import { NativeSelect } from '@chakra-ui/react';
import { listUsers, createUser, updateUser, deleteUser } from '../../api/users';
import { listAreas } from '../../api/areas';
import { listStations } from '../../api/stations';
import { useNotificationStore } from '../../store/notification-store';
import type { UserRow, UserRole, AreaRow, StationRow } from '../../types';

const ROLES: { value: UserRole; label: string }[] = [
  { value: 'reception', label: 'Recepção' },
  { value: 'management', label: 'Gestão' },
  { value: 'display', label: 'Display' },
  { value: 'dispenser', label: 'Dispensador' },
];

export default function UserManagement() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [areas, setAreas] = useState<AreaRow[]>([]);
  const [stations, setStations] = useState<StationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', role: 'reception' as UserRole, areaId: '', stationId: '' });
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const notify = useNotificationStore();

  // Stations filtered by selected area (for reception role)
  const filteredStations = form.role === 'reception' && form.areaId
    ? stations.filter((s) => s.areaId === parseInt(form.areaId) && s.active)
    : [];

  useEffect(() => {
    loadUsers();
    loadAreas();
    loadStations();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await listUsers();
      setUsers(data.filter((u) => u.role !== 'root'));
    } catch {
      notify.addNotification({ type: 'error', title: 'Erro ao carregar utilizadores' });
    } finally {
      setLoading(false);
    }
  };

  const loadAreas = async () => {
    try {
      const data = await listAreas();
      setAreas(data.filter((a) => a.active));
    } catch {
      // Silencioso — área é opcional
    }
  };

  const loadStations = async () => {
    try {
      const data = await listStations();
      setStations(data);
    } catch {
      // Silencioso — estação é opcional
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      await createUser(
        form.username,
        form.password,
        form.role,
        form.areaId ? parseInt(form.areaId) : null,
        form.role === 'reception' && form.stationId ? parseInt(form.stationId) : null,
      );
      notify.addNotification({ type: 'success', title: 'Utilizador criado' });
      setCreateOpen(false);
      setForm({ username: '', password: '', role: 'reception', areaId: '', stationId: '' });
      loadUsers();
    } catch (err: any) {
      notify.addNotification({ type: 'error', title: err.response?.data?.error || 'Erro ao criar' });
    } finally {
      setCreating(false);
    }
  };

  // Reset stationId when area changes (stations are area-specific)
  const handleAreaChange = (value: string) => {
    setForm((f) => ({ ...f, areaId: value, stationId: '' }));
  };

  // Reset stationId when role changes away from reception
  const handleRoleChange = (value: UserRole) => {
    setForm((f) => ({ ...f, role: value, stationId: value === 'reception' ? f.stationId : '' }));
  };

  const handleToggleActive = async (user: UserRow) => {
    try {
      await updateUser(user.id, { active: !user.active });
      notify.addNotification({ type: 'success', title: `Utilizador ${user.active ? 'desactivado' : 'activado'}` });
      loadUsers();
    } catch (err: any) {
      notify.addNotification({ type: 'error', title: err.response?.data?.error || 'Erro ao actualizar' });
    }
  };

  const handleDeleteClick = (user: UserRow) => {
    setDeleteTarget(user);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteUser(deleteTarget.id);
      notify.addNotification({ type: 'success', title: 'Utilizador eliminado' });
      loadUsers();
    } catch (err: any) {
      notify.addNotification({ type: 'error', title: err.response?.data?.error || 'Erro ao eliminar' });
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    }
  };

  const roleLabel = (role: UserRole) => {
    const labels: Record<UserRole, string> = {
      root: 'Root', admin: 'Administrador', reception: 'Recepção',
      management: 'Gestão', display: 'Display', dispenser: 'Dispensador',
    };
    return labels[role];
  };

  const stationLabel = (user: UserRow) => {
    if (user.stationId === null) return '—';
    const station = stations.find((s) => s.id === user.stationId);
    return station ? station.name : `Estação ${user.stationId}`;
  };

  const areaLabel = (user: UserRow) => {
    if (user.areaId === null) return '—';
    const area = areas.find((a) => a.id === user.areaId);
    return area ? area.name : `Área ${user.areaId}`;
  };

  return (
    <VStack gap={6} align="stretch">
      <Flex justify="space-between" align="center">
        <Heading size="lg">Utilizadores</Heading>
        <Button colorPalette="teal" onClick={() => { setForm({ username: '', password: '', role: 'reception', areaId: '', stationId: '' }); setCreateOpen(true); }}>+ Utilizador</Button>
      </Flex>

      {loading ? (
        <Text>Carregando...</Text>
      ) : users.length === 0 ? (
        <Text color="gray.500">Nenhum utilizador — clique + para adicionar o primeiro utilizador.</Text>
      ) : (
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader>Utilizador</Table.ColumnHeader>
              <Table.ColumnHeader>Perfil</Table.ColumnHeader>
              <Table.ColumnHeader>Área</Table.ColumnHeader>
              <Table.ColumnHeader>Estação</Table.ColumnHeader>
              <Table.ColumnHeader>Estado</Table.ColumnHeader>
              <Table.ColumnHeader>Acções</Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {users.map((u) => (
              <Table.Row key={u.id}>
                <Table.Cell>{u.username}</Table.Cell>
                <Table.Cell><Badge colorPalette="teal">{roleLabel(u.role)}</Badge></Table.Cell>
                <Table.Cell>{areaLabel(u)}</Table.Cell>
                <Table.Cell>{u.role === 'reception' ? stationLabel(u) : '—'}</Table.Cell>
                <Table.Cell><Badge colorPalette={u.active ? 'green' : 'red'}>{u.active ? 'Activo' : 'Inactivo'}</Badge></Table.Cell>
                <Table.Cell>
                  <Flex gap={1}>
                    <Button size="sm" variant="ghost" onClick={() => handleToggleActive(u)}>
                      {u.active ? 'Desactivar' : 'Activar'}
                    </Button>
                    {u.role !== 'admin' && (
                      <Button size="sm" variant="ghost" colorPalette="red" onClick={() => handleDeleteClick(u)}>
                        Eliminar
                      </Button>
                    )}
                  </Flex>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      )}

      <Dialog.Root open={createOpen} onOpenChange={(e: { open: boolean }) => setCreateOpen(e.open)}>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header><Dialog.Title>Novo Utilizador</Dialog.Title></Dialog.Header>
            <Dialog.Body>
              <VStack gap={4}>
                <Field.Root>
                  <Field.Label>Utilizador</Field.Label>
                  <Input value={form.username} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, username: e.target.value }))} />
                </Field.Root>
                <Field.Root>
                  <Field.Label>Senha</Field.Label>
                  <Input type="password" value={form.password} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, password: e.target.value }))} />
                </Field.Root>
                <Field.Root>
                  <Field.Label>Perfil</Field.Label>
                  <NativeSelect.Root>
                    <NativeSelect.Field
                      value={form.role}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleRoleChange(e.target.value as UserRole)}
                    >
                      {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </NativeSelect.Field>
                  </NativeSelect.Root>
                </Field.Root>
                <Field.Root>
                  <Field.Label>Área</Field.Label>
                  <NativeSelect.Root>
                    <NativeSelect.Field
                      value={form.areaId}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleAreaChange(e.target.value)}
                    >
                      <option value="">Nenhuma</option>
                      {areas.map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </NativeSelect.Field>
                  </NativeSelect.Root>
                </Field.Root>
                {form.role === 'reception' && (
                  <Field.Root>
                    <Field.Label>Estação de Recepção</Field.Label>
                    <NativeSelect.Root>
                      <NativeSelect.Field
                        value={form.stationId}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm((f) => ({ ...f, stationId: e.target.value }))}
                      >
                        <option value="">Nenhuma</option>
                        {filteredStations.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </NativeSelect.Field>
                    </NativeSelect.Root>
                    {form.areaId && filteredStations.length === 0 && (
                      <Text fontSize="xs" color="orange.500" mt={1}>
                        Nenhuma estação activa nesta área. Crie estações primeiro.
                      </Text>
                    )}
                    {!form.areaId && (
                      <Text fontSize="xs" color="gray.500" mt={1}>
                        Selecione uma área para ver as estações disponíveis.
                      </Text>
                    )}
                  </Field.Root>
                )}
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
                Tem certeza que deseja eliminar o utilizador <strong>{deleteTarget?.username}</strong>? Esta acção não pode ser revertida.
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