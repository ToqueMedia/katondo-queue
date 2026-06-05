// Admin — Station Management page with service assignments

import { useState, useEffect } from 'react';
import { Heading, Text, VStack, Button, Badge, Flex, Dialog, Portal } from '@chakra-ui/react';
import { Table } from '@chakra-ui/react';
import { Field, Input } from '@chakra-ui/react';
import { NativeSelect } from '@chakra-ui/react';
import { listStations, createStation, updateStation, deleteStation } from '../../api/stations';
import { listAreas } from '../../api/areas';
import { listUsers } from '../../api/users';
import { listServices } from '../../api/services';
import { useNotificationStore } from '../../store/notification-store';
import type { StationRow, AreaRow, UserRow, ServiceRow } from '../../types';

export default function StationManagement() {
  const [stations, setStations] = useState<StationRow[]>([]);
  const [areas, setAreas] = useState<AreaRow[]>([]);
  const [receptionists, setReceptionists] = useState<UserRow[]>([]);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<StationRow | null>(null);
  const [form, setForm] = useState<{
    name: string;
    description: string;
    areaId: string;
    receptionUserId: string;
    serviceIds: number[];
  }>({ name: '', description: '', areaId: '', receptionUserId: '', serviceIds: [] });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StationRow | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const notify = useNotificationStore();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [st, ar, us, sv] = await Promise.all([listStations(), listAreas(), listUsers(), listServices()]);
      setStations(st); setAreas(ar);
      setReceptionists(us.filter(u => u.role === 'reception'));
      setServices(sv);
    } catch {
      notify.addNotification({ type: 'error', title: 'Erro ao carregar dados' });
    } finally { setLoading(false); }
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      await createStation(form.name, parseInt(form.areaId), form.receptionUserId ? parseInt(form.receptionUserId) : undefined, form.description || undefined);
      notify.addNotification({ type: 'success', title: 'Estação criada' });
      setCreateOpen(false); setForm({ name: '', description: '', areaId: '', receptionUserId: '', serviceIds: [] }); loadData();
    } catch (err: any) {
      notify.addNotification({ type: 'error', title: err.response?.data?.error || 'Erro ao criar' });
    } finally { setSaving(false); }
  };

  const handleUpdate = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await updateStation(editing.id, {
        name: form.name,
        description: form.description || null,
        receptionUserId: form.receptionUserId ? parseInt(form.receptionUserId) : null,
        serviceIds: form.serviceIds,
      });
      notify.addNotification({ type: 'success', title: 'Estação actualizada' });
      setEditOpen(false); setEditing(null); loadData();
    } catch (err: any) {
      notify.addNotification({ type: 'error', title: err.response?.data?.error || 'Erro ao actualizar' });
    } finally { setSaving(false); }
  };

  const handleDeleteClick = (st: StationRow) => {
    setDeleteTarget(st);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteStation(deleteTarget.id);
      notify.addNotification({ type: 'success', title: 'Estação eliminada' });
      loadData();
    } catch (err: any) {
      notify.addNotification({ type: 'error', title: err.response?.data?.error || 'Erro ao eliminar' });
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    }
  };

  const openEdit = (st: StationRow) => {
    setEditing(st);
    setForm({
      name: st.name,
      description: st.description || '',
      areaId: String(st.areaId),
      receptionUserId: st.receptionUserId ? String(st.receptionUserId) : '',
      serviceIds: st.serviceIds || [],
    });
    setEditOpen(true);
  };

  const areaName = (id: number) => areas.find(a => a.id === id)?.name || '—';
  const receptionistName = (id: number | null) => id ? receptionists.find(u => u.id === id)?.username || '—' : '—';

  return (
    <VStack gap={6} align="stretch">
      <Flex justify="space-between" align="center">
        <Heading size="lg">Estações</Heading>
        <Button colorPalette="teal" onClick={() => { setForm({ name: '', description: '', areaId: '', receptionUserId: '', serviceIds: [] }); setCreateOpen(true); }}>+ Estação</Button>
      </Flex>

      {loading ? <Text>Carregando...</Text> : stations.length === 0 ? (
        <Text color="gray.500">Nenhuma estação — clique + para adicionar.</Text>
      ) : (
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader>Nome para chamar</Table.ColumnHeader>
              <Table.ColumnHeader>Nome da Estação</Table.ColumnHeader>
              <Table.ColumnHeader>Área</Table.ColumnHeader>
              <Table.ColumnHeader>Recepcionista</Table.ColumnHeader>
              <Table.ColumnHeader>Serviços</Table.ColumnHeader>
              <Table.ColumnHeader>Acções</Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {stations.map((st) => (
              <Table.Row key={st.id}>
                <Table.Cell fontWeight="medium">{st.name}</Table.Cell>
                <Table.Cell color="gray.600" fontSize="sm">{st.description || '—'}</Table.Cell>
                <Table.Cell>{areaName(st.areaId)}</Table.Cell>
                <Table.Cell>{receptionistName(st.receptionUserId)}</Table.Cell>
                <Table.Cell>
                  <Badge colorPalette="teal">
                    {st.serviceIds?.length || 0} serviço(s)
                  </Badge>
                </Table.Cell>
                <Table.Cell>
                  <Flex gap={1}>
                    <Button size="sm" variant="ghost" onClick={() => openEdit(st)}>Editar</Button>
                    <Button size="sm" variant="ghost" colorPalette="red" onClick={() => handleDeleteClick(st)}>Eliminar</Button>
                  </Flex>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      )}

      <Dialog.Root open={createOpen} onOpenChange={(e: { open: boolean }) => setCreateOpen(e.open)}>
        {createOpen && (
          <Portal>
            <Dialog.Backdrop bg="blackAlpha.600" backdropFilter="blur(4px)" />
            <Dialog.Positioner p={4} display="flex" alignItems="center" justifyContent="center">
              <Dialog.Content bg="white" borderRadius="16px" boxShadow="lg" maxW="520px" w="100%" p={6}>
                <Dialog.Header pb={3} borderBottom="1px solid" borderColor="blackAlpha.100">
                  <Dialog.Title fontSize="lg" fontWeight="bold" color="brand.700">Nova Estação</Dialog.Title>
                </Dialog.Header>
                <Dialog.Body py={4}>
                  <VStack gap={4}>
                    <Field.Root><Field.Label fontSize="sm" fontWeight="500" mb={1}>Nome para chamar</Field.Label><Input value={form.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Balcão 1" /></Field.Root>
                    <Field.Root><Field.Label fontSize="sm" fontWeight="500" mb={1}>Nome da Estação</Field.Label><Input value={form.description} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Ex: Balcão" /></Field.Root>
                    <Field.Root>
                      <Field.Label fontSize="sm" fontWeight="500" mb={1}>Área</Field.Label>
                      <NativeSelect.Root>
                        <NativeSelect.Field value={form.areaId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm(f => ({ ...f, areaId: e.target.value }))}>
                          <option value="">Seleccionar...</option>
                          {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </NativeSelect.Field>
                      </NativeSelect.Root>
                    </Field.Root>
                    <Field.Root>
                      <Field.Label fontSize="sm" fontWeight="500" mb={1}>Recepcionista (opcional)</Field.Label>
                      <NativeSelect.Root>
                        <NativeSelect.Field value={form.receptionUserId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm(f => ({ ...f, receptionUserId: e.target.value }))}>
                          <option value="">Nenhum</option>
                          {receptionists.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                        </NativeSelect.Field>
                      </NativeSelect.Root>
                    </Field.Root>
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
                  <Dialog.Title fontSize="lg" fontWeight="bold" color="brand.700">Editar Estação</Dialog.Title>
                </Dialog.Header>
                <Dialog.Body py={4}>
                  <VStack gap={4}>
                    <Field.Root><Field.Label fontSize="sm" fontWeight="500" mb={1}>Nome para chamar</Field.Label><Input value={form.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, name: e.target.value }))} /></Field.Root>
                    <Field.Root><Field.Label fontSize="sm" fontWeight="500" mb={1}>Nome da Estação</Field.Label><Input value={form.description} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Ex: Balcão" /></Field.Root>
                    <Field.Root>
                      <Field.Label fontSize="sm" fontWeight="500" mb={1}>Recepcionista</Field.Label>
                      <NativeSelect.Root>
                        <NativeSelect.Field value={form.receptionUserId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm(f => ({ ...f, receptionUserId: e.target.value }))}>
                          <option value="">Nenhum</option>
                          {receptionists.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                        </NativeSelect.Field>
                      </NativeSelect.Root>
                    </Field.Root>

                    <Field.Root>
                      <Field.Label fontSize="sm" fontWeight="500" mb={1}>Serviços Atribuídos</Field.Label>
                      <VStack align="start" width="100%" gap={2} maxH="150px" overflowY="auto" p={2} border="1px solid" borderColor="blackAlpha.100" borderRadius="md">
                        {services
                          .filter(s => String(s.areaId) === form.areaId)
                          .map(svc => {
                            const isChecked = form.serviceIds.includes(svc.id);
                            return (
                              <Flex key={svc.id} gap={2} align="center">
                                <input
                                  type="checkbox"
                                  id={`svc-${svc.id}`}
                                  checked={isChecked}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setForm(f => ({ ...f, serviceIds: [...f.serviceIds, svc.id] }));
                                    } else {
                                      setForm(f => ({ ...f, serviceIds: f.serviceIds.filter(id => id !== svc.id) }));
                                    }
                                  }}
                                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                />
                                <label htmlFor={`svc-${svc.id}`} style={{ cursor: 'pointer', fontSize: '13px' }}>
                                  {svc.name}
                                </label>
                              </Flex>
                            );
                          })}
                        {services.filter(s => String(s.areaId) === form.areaId).length === 0 && (
                          <Text fontSize="xs" color="gray.500">Nenhum serviço nesta área.</Text>
                        )}
                      </VStack>
                    </Field.Root>
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
                    Tem certeza que deseja eliminar a estação <strong>{deleteTarget?.name}</strong>? Esta acção não pode ser revertida.
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
