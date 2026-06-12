// Admin — Dispenser Management page

import { useState, useEffect } from 'react';
import { Text, VStack, Button, Badge, Flex, Dialog, Portal } from '@chakra-ui/react';
import { Table } from '@chakra-ui/react';
import { Field, Input } from '@chakra-ui/react';
import { NativeSelect } from '@chakra-ui/react';
import { listDispensers, createDispenser, updateDispenser, deleteDispenser } from '../../api/dispensers';
import { listAreas } from '../../api/areas';
import { useNotificationStore } from '../../store/notification-store';
import { AdminPageHeader, AdminTableCard } from '../../components/admin/admin-page';
import type { DispenserConfigRow, AreaRow } from '../../types';

export default function DispenserManagement() {
  const [dispensers, setDispensers] = useState<DispenserConfigRow[]>([]);
  const [areas, setAreas] = useState<AreaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<DispenserConfigRow | null>(null);
  const [form, setForm] = useState({ name: '', areaId: '', username: '', password: '' });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DispenserConfigRow | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const notify = useNotificationStore();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [d, a] = await Promise.all([listDispensers(), listAreas()]);
      setDispensers(d); setAreas(a);
    } catch {
      notify.addNotification({ type: 'error', title: 'Erro ao carregar dados' });
    } finally { setLoading(false); }
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      await createDispenser({
        name: form.name,
        areaId: parseInt(form.areaId),
        username: form.username,
        password: form.password
      });
      notify.addNotification({ type: 'success', title: 'Dispensador criado' });
      setCreateOpen(false); setForm({ name: '', areaId: '', username: '', password: '' }); loadData();
    } catch (err: any) {
      notify.addNotification({ type: 'error', title: err.response?.data?.error || 'Erro ao criar' });
    } finally { setSaving(false); }
  };

  const openEdit = (d: DispenserConfigRow) => {
    setEditing(d);
    setForm({ name: d.name, areaId: String(d.areaId), username: '', password: '' });
    setEditOpen(true);
  };

  const handleUpdate = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const payload: any = {
        name: form.name,
        areaId: parseInt(form.areaId),
      };
      if (form.password) {
        payload.password = form.password;
      }
      await updateDispenser(editing.id, payload);
      notify.addNotification({ type: 'success', title: 'Dispensador actualizado' });
      setEditOpen(false); setEditing(null); loadData();
    } catch (err: any) {
      notify.addNotification({ type: 'error', title: err.response?.data?.error || 'Erro ao actualizar' });
    } finally { setSaving(false); }
  };

  const handleToggle = async (d: DispenserConfigRow) => {
    try { await updateDispenser(d.id, { active: !d.active }); notify.addNotification({ type: 'success', title: 'Estado actualizado' }); loadData(); }
    catch (err: any) { notify.addNotification({ type: 'error', title: err.response?.data?.error || 'Erro' }); }
  };

  const handleDeleteClick = (d: DispenserConfigRow) => {
    setDeleteTarget(d);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteDispenser(deleteTarget.id);
      notify.addNotification({ type: 'success', title: 'Dispensador eliminado' });
      loadData();
    } catch (err: any) {
      notify.addNotification({ type: 'error', title: err.response?.data?.error || 'Erro ao eliminar' });
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    }
  };

  const areaName = (id: number) => areas.find(a => a.id === id)?.name || '—';

  return (
    <VStack gap={6} align="stretch">
      <AdminPageHeader
        title="Dispensadores"
        description="Administre os quiosques de emissão de senhas e a ligação deles às áreas."
        action={<Button colorPalette="teal" onClick={() => { setForm({ name: '', areaId: '', username: '', password: '' }); setCreateOpen(true); }}>+ Dispensador</Button>}
      />

      {loading ? <Text>Carregando...</Text> : dispensers.length === 0 ? (
        <Text color="gray.500">Nenhum dispensador — clique + para adicionar.</Text>
      ) : (
        <AdminTableCard>
        <Table.Root>
          <Table.Header>
            <Table.Row bg="gray.50">
              <Table.ColumnHeader>Nome</Table.ColumnHeader>
              <Table.ColumnHeader>Utilizador</Table.ColumnHeader>
              <Table.ColumnHeader>Área</Table.ColumnHeader>
              <Table.ColumnHeader>Estado</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="right">Acções</Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {dispensers.map((d) => (
              <Table.Row key={d.id}>
                <Table.Cell fontWeight="medium">{d.name}</Table.Cell>
                <Table.Cell color="gray.600" fontSize="sm">{d.username}</Table.Cell>
                <Table.Cell>{areaName(d.areaId)}</Table.Cell>
                <Table.Cell><Badge colorPalette={d.active ? 'green' : 'red'}>{d.active ? 'Activo' : 'Inactivo'}</Badge></Table.Cell>
                <Table.Cell>
                  <Flex gap={1} justify="flex-end" wrap="wrap">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(d)}>Editar</Button>
                    <Button size="sm" variant="ghost" onClick={() => handleToggle(d)}>{d.active ? 'Desactivar' : 'Activar'}</Button>
                    <Button size="sm" variant="ghost" colorPalette="red" onClick={() => handleDeleteClick(d)}>Eliminar</Button>
                  </Flex>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
        </AdminTableCard>
      )}

      <Dialog.Root open={createOpen} onOpenChange={(e: { open: boolean }) => setCreateOpen(e.open)}>
        {createOpen && (
          <Portal>
            <Dialog.Backdrop bg="blackAlpha.600" backdropFilter="blur(4px)" />
            <Dialog.Positioner p={4} display="flex" alignItems="center" justifyContent="center">
              <Dialog.Content bg="white" borderRadius="16px" boxShadow="lg" maxW="500px" w="100%" p={6}>
                <Dialog.Header pb={3} borderBottom="1px solid" borderColor="blackAlpha.100">
                  <Dialog.Title fontSize="lg" fontWeight="bold" color="brand.700">Novo Dispensador</Dialog.Title>
                </Dialog.Header>
                <Dialog.Body py={4}>
                  <VStack gap={4}>
                    <Field.Root><Field.Label fontSize="sm" fontWeight="500" mb={1}>Nome</Field.Label><Input value={form.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Dispensador Entrada" /></Field.Root>
                    <Field.Root>
                      <Field.Label fontSize="sm" fontWeight="500" mb={1}>Área</Field.Label>
                      <NativeSelect.Root>
                        <NativeSelect.Field value={form.areaId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm(f => ({ ...f, areaId: e.target.value }))}>
                          <option value="">Seleccionar...</option>
                          {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </NativeSelect.Field>
                      </NativeSelect.Root>
                    </Field.Root>
                    <Field.Root><Field.Label fontSize="sm" fontWeight="500" mb={1}>Nome de Utilizador</Field.Label><Input value={form.username} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, username: e.target.value }))} placeholder="Ex: disp_entrada" /></Field.Root>
                    <Field.Root><Field.Label fontSize="sm" fontWeight="500" mb={1}>Senha</Field.Label><Input type="password" value={form.password} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Mínimo 6 caracteres" /></Field.Root>
                  </VStack>
                </Dialog.Body>
                <Dialog.Footer pt={3} borderTop="1px solid" borderColor="blackAlpha.100" display="flex" justifyContent="end" gap={3}>
                  <Button variant="ghost" size="sm" onClick={() => setCreateOpen(false)}>Cancelar</Button>
                  <Button colorPalette="teal" size="sm" loading={saving} onClick={handleCreate}>Criar</Button>
                </Dialog.Footer>
              </Dialog.Content>
            </Dialog.Positioner>
          </Portal>
        )}
      </Dialog.Root>

      <Dialog.Root open={editOpen} onOpenChange={(e: { open: boolean }) => setEditOpen(e.open)}>
        {editOpen && (
          <Portal>
            <Dialog.Backdrop bg="blackAlpha.600" backdropFilter="blur(4px)" />
            <Dialog.Positioner p={4} display="flex" alignItems="center" justifyContent="center">
              <Dialog.Content bg="white" borderRadius="16px" boxShadow="lg" maxW="500px" w="100%" p={6}>
                <Dialog.Header pb={3} borderBottom="1px solid" borderColor="blackAlpha.100">
                  <Dialog.Title fontSize="lg" fontWeight="bold" color="brand.700">Editar Dispensador</Dialog.Title>
                </Dialog.Header>
                <Dialog.Body py={4}>
                  <VStack gap={4}>
                    <Field.Root><Field.Label fontSize="sm" fontWeight="500" mb={1}>Nome</Field.Label><Input value={form.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, name: e.target.value }))} /></Field.Root>
                    <Field.Root><Field.Label fontSize="sm" fontWeight="500" mb={1}>Nome de Utilizador</Field.Label><Input value={editing?.username || ''} disabled bg="gray.50" /></Field.Root>
                    <Field.Root>
                      <Field.Label fontSize="sm" fontWeight="500" mb={1}>Área</Field.Label>
                      <NativeSelect.Root>
                        <NativeSelect.Field value={form.areaId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm(f => ({ ...f, areaId: e.target.value }))}>
                          <option value="">Seleccionar...</option>
                          {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </NativeSelect.Field>
                      </NativeSelect.Root>
                    </Field.Root>
                    <Field.Root><Field.Label fontSize="sm" fontWeight="500" mb={1}>Nova Senha (opcional)</Field.Label><Input type="password" value={form.password} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Deixe em branco para manter a actual" /></Field.Root>
                  </VStack>
                </Dialog.Body>
                <Dialog.Footer pt={3} borderTop="1px solid" borderColor="blackAlpha.100" display="flex" justifyContent="end" gap={3}>
                  <Button variant="ghost" size="sm" onClick={() => { setEditOpen(false); setEditing(null); }}>Cancelar</Button>
                  <Button colorPalette="teal" size="sm" loading={saving} onClick={handleUpdate}>Guardar</Button>
                </Dialog.Footer>
              </Dialog.Content>
            </Dialog.Positioner>
          </Portal>
        )}
      </Dialog.Root>

      <Dialog.Root
        open={deleteDialogOpen}
        onOpenChange={(e: { open: boolean }) => setDeleteDialogOpen(e.open)}
      >
        {deleteDialogOpen && (
          <Portal>
            <Dialog.Backdrop bg="blackAlpha.600" backdropFilter="blur(4px)" />
            <Dialog.Positioner p={4} display="flex" alignItems="center" justifyContent="center">
              <Dialog.Content bg="white" borderRadius="16px" boxShadow="lg" maxW="440px" w="100%" p={6}>
                <Dialog.Header pb={3} borderBottom="1px solid" borderColor="blackAlpha.100">
                  <Dialog.Title fontSize="lg" fontWeight="bold" color="brand.700">Confirmar eliminação</Dialog.Title>
                </Dialog.Header>
                <Dialog.Body py={4}>
                  <Text fontSize="sm" color="gray.700">
                    Tem certeza que deseja eliminar o dispensador <strong>{deleteTarget?.name}</strong>? Esta acção não pode ser revertida.
                  </Text>
                </Dialog.Body>
                <Dialog.Footer pt={3} borderTop="1px solid" borderColor="blackAlpha.100" display="flex" justifyContent="end" gap={3}>
                  <Button variant="ghost" size="sm" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
                    Cancelar
                  </Button>
                  <Button colorPalette="red" size="sm" loading={deleting} onClick={handleDeleteConfirm}>
                    Eliminar
                  </Button>
                </Dialog.Footer>
              </Dialog.Content>
            </Dialog.Positioner>
          </Portal>
        )}
      </Dialog.Root>
    </VStack>
  );
}
