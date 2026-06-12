// Admin — Area Management page

import { useState, useEffect } from 'react';
import { Text, VStack, Button, Badge, Flex, Dialog } from '@chakra-ui/react';
import { Table } from '@chakra-ui/react';
import { Field, Input } from '@chakra-ui/react';
import { listAreas, createArea, updateArea, deleteArea } from '../../api/areas';
import { useNotificationStore } from '../../store/notification-store';
import { AdminPageHeader, AdminTableCard } from '../../components/admin/admin-page';
import type { AreaRow } from '../../types';

export default function AreaManagement() {
  const [areas, setAreas] = useState<AreaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<AreaRow | null>(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AreaRow | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const notify = useNotificationStore();

  useEffect(() => { loadAreas(); }, []);

  const loadAreas = async () => {
    setLoading(true);
    try {
      const data = await listAreas();
      setAreas(data);
    } catch {
      notify.addNotification({ type: 'error', title: 'Erro ao carregar áreas' });
    } finally { setLoading(false); }
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      await createArea(form.name, form.description || undefined);
      notify.addNotification({ type: 'success', title: 'Área criada' });
      setCreateOpen(false); setForm({ name: '', description: '' }); loadAreas();
    } catch (err: any) {
      notify.addNotification({ type: 'error', title: err.response?.data?.error || 'Erro ao criar' });
    } finally { setSaving(false); }
  };

  const handleUpdate = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await updateArea(editing.id, { name: form.name, description: form.description });
      notify.addNotification({ type: 'success', title: 'Área actualizada' });
      setEditOpen(false); setEditing(null); loadAreas();
    } catch (err: any) {
      notify.addNotification({ type: 'error', title: err.response?.data?.error || 'Erro ao actualizar' });
    } finally { setSaving(false); }
  };

  const handleToggle = async (area: AreaRow) => {
    try {
      await updateArea(area.id, { active: !area.active });
      notify.addNotification({ type: 'success', title: `Área ${area.active ? 'desactivada' : 'activada'}` });
      loadAreas();
    } catch (err: any) {
      notify.addNotification({ type: 'error', title: err.response?.data?.error || 'Erro' });
    }
  };

  const handleDeleteClick = (area: AreaRow) => {
    setDeleteTarget(area);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteArea(deleteTarget.id);
      notify.addNotification({ type: 'success', title: 'Área eliminada' });
      loadAreas();
    } catch (err: any) {
      notify.addNotification({ type: 'error', title: err.response?.data?.error || 'Erro ao eliminar' });
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    }
  };

  const openEdit = (area: AreaRow) => {
    setEditing(area);
    setForm({ name: area.name, description: area.description || '' });
    setEditOpen(true);
  };

  return (
    <VStack gap={6} align="stretch">
      <AdminPageHeader
        title="Áreas"
        description="Organize os espaços da clínica onde serviços, estações e equipamentos operam."
        action={<Button colorPalette="teal" onClick={() => { setForm({ name: '', description: '' }); setCreateOpen(true); }}>+ Área</Button>}
      />

      {loading ? <Text>Carregando...</Text> : areas.length === 0 ? (
        <Text color="gray.500">Nenhuma área — clique + para adicionar a primeira área.</Text>
      ) : (
        <AdminTableCard>
        <Table.Root>
          <Table.Header>
            <Table.Row bg="gray.50">
              <Table.ColumnHeader>Nome</Table.ColumnHeader>
              <Table.ColumnHeader>Descrição</Table.ColumnHeader>
              <Table.ColumnHeader>Estado</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="right">Acções</Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {areas.map((a) => (
              <Table.Row key={a.id}>
                <Table.Cell fontWeight="medium">{a.name}</Table.Cell>
                <Table.Cell>{a.description || '—'}</Table.Cell>
                <Table.Cell><Badge colorPalette={a.active ? 'green' : 'red'}>{a.active ? 'Activa' : 'Inactiva'}</Badge></Table.Cell>
                <Table.Cell>
                  <Flex gap={1} justify="flex-end" wrap="wrap">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(a)}>Editar</Button>
                    <Button size="sm" variant="ghost" onClick={() => handleToggle(a)}>{a.active ? 'Desactivar' : 'Activar'}</Button>
                    <Button size="sm" variant="ghost" colorPalette="red" onClick={() => handleDeleteClick(a)}>Eliminar</Button>
                  </Flex>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
        </AdminTableCard>
      )}

      <Dialog.Root open={createOpen} onOpenChange={(e: { open: boolean }) => setCreateOpen(e.open)}>
        <Dialog.Backdrop /><Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header><Dialog.Title>Nova Área</Dialog.Title></Dialog.Header>
            <Dialog.Body>
              <VStack gap={4}>
                <Field.Root><Field.Label>Nome</Field.Label><Input value={form.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, name: e.target.value }))} /></Field.Root>
                <Field.Root><Field.Label>Descrição</Field.Label><Input value={form.description} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, description: e.target.value }))} /></Field.Root>
              </VStack>
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancelar</Button>
              <Button colorPalette="teal" loading={saving} onClick={handleCreate}>Criar</Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>

      <Dialog.Root open={editOpen} onOpenChange={(e: { open: boolean }) => setEditOpen(e.open)}>
        <Dialog.Backdrop /><Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header><Dialog.Title>Editar Área</Dialog.Title></Dialog.Header>
            <Dialog.Body>
              <VStack gap={4}>
                <Field.Root><Field.Label>Nome</Field.Label><Input value={form.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, name: e.target.value }))} /></Field.Root>
                <Field.Root><Field.Label>Descrição</Field.Label><Input value={form.description} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, description: e.target.value }))} /></Field.Root>
              </VStack>
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="ghost" onClick={() => setEditOpen(false)}>Cancelar</Button>
              <Button colorPalette="teal" loading={saving} onClick={handleUpdate}>Guardar</Button>
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
                Tem certeza que deseja eliminar a área <strong>{deleteTarget?.name}</strong>? Esta acção não pode ser revertida.
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
