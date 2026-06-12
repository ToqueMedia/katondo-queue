// Admin — Service Management page with Priority toggle

import { useState, useEffect } from 'react';
import { Text, VStack, Button, Badge, Flex, Dialog, Portal } from '@chakra-ui/react';
import { Table } from '@chakra-ui/react';
import { Field, Input } from '@chakra-ui/react';
import { NativeSelect } from '@chakra-ui/react';
import { listServices, createService, updateService, deleteService } from '../../api/services';
import { listAreas } from '../../api/areas';
import { useNotificationStore } from '../../store/notification-store';
import { AdminPageHeader, AdminTableCard } from '../../components/admin/admin-page';
import type { ServiceRow, AreaRow, TicketFormat } from '../../types';

const FORMATS: { value: TicketFormat; label: string }[] = [
  { value: 'numeric', label: 'Numérico (001, 002)' },
  { value: 'alphanumeric', label: 'Alfanumérico (A001, A002)' },
  { value: 'custom', label: 'Personalizado (CONS001)' },
];

export default function ServiceManagement() {
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [areas, setAreas] = useState<AreaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceRow | null>(null);
  const [form, setForm] = useState({ name: '', areaId: '', ticketFormat: 'numeric' as TicketFormat, ticketPrefix: '', ticketDigitCount: '3', isPriority: false });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ServiceRow | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const notify = useNotificationStore();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [s, a] = await Promise.all([listServices(), listAreas()]);
      setServices(s); setAreas(a);
    } catch {
      notify.addNotification({ type: 'error', title: 'Erro ao carregar dados' });
    } finally { setLoading(false); }
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      await createService(form.name, parseInt(form.areaId), form.ticketFormat, form.ticketPrefix || undefined, parseInt(form.ticketDigitCount), form.isPriority);
      notify.addNotification({ type: 'success', title: 'Serviço criado' });
      setCreateOpen(false); setForm({ name: '', areaId: '', ticketFormat: 'numeric', ticketPrefix: '', ticketDigitCount: '3', isPriority: false }); loadData();
    } catch (err: any) {
      notify.addNotification({ type: 'error', title: err.response?.data?.error || 'Erro ao criar' });
    } finally { setSaving(false); }
  };

  const handleUpdate = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await updateService(editing.id, { name: form.name, ticketFormat: form.ticketFormat, ticketPrefix: form.ticketPrefix, ticketDigitCount: parseInt(form.ticketDigitCount), isPriority: form.isPriority });
      notify.addNotification({ type: 'success', title: 'Serviço actualizado' });
      setEditOpen(false); setEditing(null); loadData();
    } catch (err: any) {
      notify.addNotification({ type: 'error', title: err.response?.data?.error || 'Erro ao actualizar' });
    } finally { setSaving(false); }
  };

  const handleToggle = async (svc: ServiceRow) => {
    try { await updateService(svc.id, { active: !svc.active }); notify.addNotification({ type: 'success', title: 'Estado actualizado' }); loadData(); }
    catch (err: any) { notify.addNotification({ type: 'error', title: err.response?.data?.error || 'Erro' }); }
  };

  const handleDeleteClick = (svc: ServiceRow) => {
    setDeleteTarget(svc);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteService(deleteTarget.id);
      notify.addNotification({ type: 'success', title: 'Serviço eliminado' });
      loadData();
    } catch (err: any) {
      notify.addNotification({ type: 'error', title: err.response?.data?.error || 'Erro ao eliminar' });
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    }
  };

  const openEdit = (svc: ServiceRow) => {
    setEditing(svc);
    setForm({ name: svc.name, areaId: String(svc.areaId), ticketFormat: svc.ticketFormat, ticketPrefix: svc.ticketPrefix || '', ticketDigitCount: String(svc.ticketDigitCount), isPriority: svc.isPriority || false });
    setEditOpen(true);
  };

  const areaName = (id: number) => id === 0 ? 'Global (Todas as Áreas)' : (areas.find(a => a.id === id)?.name || '—');

  return (
    <VStack gap={6} align="stretch">
      <AdminPageHeader
        title="Serviços"
        description="Configure serviços, formatos de senha, prioridade e disponibilidade por área."
        action={<Button colorPalette="teal" onClick={() => { setForm({ name: '', areaId: '', ticketFormat: 'numeric', ticketPrefix: '', ticketDigitCount: '3', isPriority: false }); setCreateOpen(true); }}>+ Serviço</Button>}
      />

      {loading ? <Text>Carregando...</Text> : services.length === 0 ? (
        <Text color="gray.500">Nenhum serviço — clique + para adicionar.</Text>
      ) : (
        <AdminTableCard>
        <Table.Root>
          <Table.Header>
            <Table.Row bg="gray.50">
              <Table.ColumnHeader>Nome</Table.ColumnHeader>
              <Table.ColumnHeader>Área</Table.ColumnHeader>
              <Table.ColumnHeader>Formato</Table.ColumnHeader>
              <Table.ColumnHeader>Estado</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="right">Acções</Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {services.map((s) => (
              <Table.Row key={s.id}>
                <Table.Cell fontWeight="medium">
                  {s.name}
                  {s.isPriority && (
                    <Badge colorPalette="purple" ml={2} variant="solid">
                      Prioritário
                    </Badge>
                  )}
                </Table.Cell>
                <Table.Cell>{areaName(s.areaId)}</Table.Cell>
                <Table.Cell>{s.ticketFormat} {s.ticketPrefix ? `(${s.ticketPrefix})` : ''}</Table.Cell>
                <Table.Cell><Badge colorPalette={s.active ? 'green' : 'red'}>{s.active ? 'Activo' : 'Inactivo'}</Badge></Table.Cell>
                <Table.Cell>
                  <Flex gap={1} justify="flex-end" wrap="wrap">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(s)}>Editar</Button>
                    <Button size="sm" variant="ghost" onClick={() => handleToggle(s)}>{s.active ? 'Desactivar' : 'Activar'}</Button>
                    <Button size="sm" variant="ghost" colorPalette="red" onClick={() => handleDeleteClick(s)}>Eliminar</Button>
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
              <Dialog.Content bg="white" borderRadius="16px" boxShadow="lg" maxW="520px" w="100%" p={6}>
                <Dialog.Header pb={3} borderBottom="1px solid" borderColor="blackAlpha.100">
                  <Dialog.Title fontSize="lg" fontWeight="bold" color="brand.700">Novo Serviço</Dialog.Title>
                </Dialog.Header>
                <Dialog.Body py={4}>
                  <VStack gap={4}>
                    <Field.Root><Field.Label fontSize="sm" fontWeight="500" mb={1}>Nome</Field.Label><Input value={form.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Consulta de Pediatria" /></Field.Root>
                    <Field.Root>
                      <Field.Label fontSize="sm" fontWeight="500" mb={1}>Área</Field.Label>
                      <NativeSelect.Root>
                        <NativeSelect.Field value={form.areaId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm(f => ({ ...f, areaId: e.target.value }))}>
                          <option value="">Seleccionar...</option>
                          <option value="0">Disponível em Todas as Áreas (Global)</option>
                          {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </NativeSelect.Field>
                      </NativeSelect.Root>
                    </Field.Root>
                    <Field.Root>
                      <Field.Label fontSize="sm" fontWeight="500" mb={1}>Formato</Field.Label>
                      <NativeSelect.Root>
                        <NativeSelect.Field value={form.ticketFormat} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm(f => ({ ...f, ticketFormat: e.target.value as TicketFormat }))}>
                          {FORMATS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                        </NativeSelect.Field>
                      </NativeSelect.Root>
                    </Field.Root>
                    {(form.ticketFormat === 'alphanumeric' || form.ticketFormat === 'custom') && (
                      <Field.Root><Field.Label fontSize="sm" fontWeight="500" mb={1}>Prefixo</Field.Label><Input value={form.ticketPrefix} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, ticketPrefix: e.target.value }))} placeholder="Ex: CONS, A" /></Field.Root>
                    )}
                    <Field.Root><Field.Label fontSize="sm" fontWeight="500" mb={1}>Dígitos</Field.Label><Input value={form.ticketDigitCount} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, ticketDigitCount: e.target.value }))} /></Field.Root>
                    <Flex gap={2} align="center" width="100%" pt={2}>
                      <input
                        type="checkbox"
                        id="isPriority"
                        checked={form.isPriority}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, isPriority: e.target.checked }))}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                      <label htmlFor="isPriority" style={{ cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}>
                        Serviço Prioritário
                      </label>
                    </Flex>
                  </VStack>
                </Dialog.Body>
                <Dialog.Footer pt={3} borderTop="1px solid" borderColor="blackAlpha.100" display="flex" justifyContent="end" gap={3}>
                  <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancelar</Button>
                  <Button colorPalette="teal" loading={saving} onClick={handleCreate}>Criar</Button>
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
              <Dialog.Content bg="white" borderRadius="16px" boxShadow="lg" maxW="520px" w="100%" p={6}>
                <Dialog.Header pb={3} borderBottom="1px solid" borderColor="blackAlpha.100">
                  <Dialog.Title fontSize="lg" fontWeight="bold" color="brand.700">Editar Serviço</Dialog.Title>
                </Dialog.Header>
                <Dialog.Body py={4}>
                  <VStack gap={4}>
                    <Field.Root><Field.Label fontSize="sm" fontWeight="500" mb={1}>Nome</Field.Label><Input value={form.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, name: e.target.value }))} /></Field.Root>
                    <Field.Root>
                      <Field.Label fontSize="sm" fontWeight="500" mb={1}>Área</Field.Label>
                      <NativeSelect.Root>
                        <NativeSelect.Field value={form.areaId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm(f => ({ ...f, areaId: e.target.value }))}>
                          <option value="0">Disponível em Todas as Áreas (Global)</option>
                          {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </NativeSelect.Field>
                      </NativeSelect.Root>
                    </Field.Root>
                    <Field.Root>
                      <Field.Label fontSize="sm" fontWeight="500" mb={1}>Formato</Field.Label>
                      <NativeSelect.Root>
                        <NativeSelect.Field value={form.ticketFormat} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm(f => ({ ...f, ticketFormat: e.target.value as TicketFormat }))}>
                          {FORMATS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                        </NativeSelect.Field>
                      </NativeSelect.Root>
                    </Field.Root>
                    {(form.ticketFormat === 'alphanumeric' || form.ticketFormat === 'custom') && (
                      <Field.Root><Field.Label fontSize="sm" fontWeight="500" mb={1}>Prefixo</Field.Label><Input value={form.ticketPrefix} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, ticketPrefix: e.target.value }))} /></Field.Root>
                    )}
                    <Field.Root><Field.Label fontSize="sm" fontWeight="500" mb={1}>Dígitos</Field.Label><Input value={form.ticketDigitCount} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, ticketDigitCount: e.target.value }))} /></Field.Root>
                    <Flex gap={2} align="center" width="100%" pt={2}>
                      <input
                        type="checkbox"
                        id="isPriorityEdit"
                        checked={form.isPriority}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, isPriority: e.target.checked }))}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                      <label htmlFor="isPriorityEdit" style={{ cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}>
                        Serviço Prioritário
                      </label>
                    </Flex>
                  </VStack>
                </Dialog.Body>
                <Dialog.Footer pt={3} borderTop="1px solid" borderColor="blackAlpha.100" display="flex" justifyContent="end" gap={3}>
                  <Button variant="ghost" onClick={() => setEditOpen(false)}>Cancelar</Button>
                  <Button colorPalette="teal" loading={saving} onClick={handleUpdate}>Guardar</Button>
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
                    Tem certeza que deseja eliminar o serviço <strong>{deleteTarget?.name}</strong>? Esta acção não pode ser revertida.
                  </Text>
                </Dialog.Body>
                <Dialog.Footer pt={3} borderTop="1px solid" borderColor="blackAlpha.100" display="flex" justifyContent="end" gap={3}>
                  <Button variant="ghost" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
                    Cancelar
                  </Button>
                  <Button colorPalette="red" loading={deleting} onClick={handleDeleteConfirm}>
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
