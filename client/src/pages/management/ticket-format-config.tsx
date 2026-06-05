// Management — Ticket Format Configuration per Service

import { useState, useEffect } from 'react';
import { Heading, Text, VStack, Button, Badge, Card } from '@chakra-ui/react';
import { Table } from '@chakra-ui/react';
import { Dialog } from '@chakra-ui/react';
import { Field, Input } from '@chakra-ui/react';
import { NativeSelect } from '@chakra-ui/react';
import { listServices, updateService } from '../../api/services';
import { listAreas } from '../../api/areas';
import { useNotificationStore } from '../../store/notification-store';
import type { ServiceRow, AreaRow, TicketFormat } from '../../types';

const FORMATS: { value: TicketFormat; label: string }[] = [
  { value: 'numeric', label: 'Numérico (001, 002)' },
  { value: 'alphanumeric', label: 'Alfanumérico (A001, A002)' },
  { value: 'custom', label: 'Personalizado (CONS001)' },
];

export default function TicketFormatConfig() {
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [areas, setAreas] = useState<AreaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceRow | null>(null);
  const [form, setForm] = useState({ ticketFormat: 'numeric' as TicketFormat, ticketPrefix: '', ticketDigitCount: '3' });
  const [saving, setSaving] = useState(false);
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

  const handleUpdate = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await updateService(editing.id, { ticketFormat: form.ticketFormat, ticketPrefix: form.ticketPrefix, ticketDigitCount: parseInt(form.ticketDigitCount) });
      notify.addNotification({ type: 'success', title: 'Formato actualizado' });
      setEditOpen(false); setEditing(null); loadData();
    } catch (err: any) {
      notify.addNotification({ type: 'error', title: err.response?.data?.error || 'Erro ao actualizar' });
    } finally { setSaving(false); }
  };

  const openEdit = (svc: ServiceRow) => {
    setEditing(svc);
    setForm({ ticketFormat: svc.ticketFormat, ticketPrefix: svc.ticketPrefix || '', ticketDigitCount: String(svc.ticketDigitCount) });
    setEditOpen(true);
  };

  const areaName = (id: number) => areas.find(a => a.id === id)?.name || '—';
  const preview = (svc: ServiceRow) => {
    const num = '1'.padStart(svc.ticketDigitCount, '0');
    if (svc.ticketFormat === 'numeric') return num;
    return `${svc.ticketPrefix || ''}${num}`;
  };

  return (
    <VStack gap={6} align="stretch">
      <Heading size="lg">Configuração de Senhas</Heading>
      <Text color="gray.600">Configure o formato da senha para cada serviço.</Text>

      {loading ? <Text>Carregando...</Text> : services.length === 0 ? (
        <Text color="gray.500">Nenhum serviço configurado.</Text>
      ) : (
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader>Serviço</Table.ColumnHeader>
              <Table.ColumnHeader>Área</Table.ColumnHeader>
              <Table.ColumnHeader>Formato</Table.ColumnHeader>
              <Table.ColumnHeader>Prefixo</Table.ColumnHeader>
              <Table.ColumnHeader>Dígitos</Table.ColumnHeader>
              <Table.ColumnHeader>Pré-visualização</Table.ColumnHeader>
              <Table.ColumnHeader>Acções</Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {services.map((s) => (
              <Table.Row key={s.id}>
                <Table.Cell fontWeight="medium">{s.name}</Table.Cell>
                <Table.Cell>{areaName(s.areaId)}</Table.Cell>
                <Table.Cell>{s.ticketFormat}</Table.Cell>
                <Table.Cell>{s.ticketPrefix || '—'}</Table.Cell>
                <Table.Cell>{s.ticketDigitCount}</Table.Cell>
                <Table.Cell><Badge colorPalette="teal">{preview(s)}</Badge></Table.Cell>
                <Table.Cell>
                  <Button size="sm" variant="ghost" onClick={() => openEdit(s)}>Editar</Button>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      )}

      <Dialog.Root open={editOpen} onOpenChange={(e: { open: boolean }) => setEditOpen(e.open)}>
        <Dialog.Backdrop /><Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header><Dialog.Title>Editar Formato — {editing?.name}</Dialog.Title></Dialog.Header>
            <Dialog.Body>
              <VStack gap={4}>
                <Field.Root>
                  <Field.Label>Formato</Field.Label>
                  <NativeSelect.Root>
                    <NativeSelect.Field value={form.ticketFormat} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm(f => ({ ...f, ticketFormat: e.target.value as TicketFormat }))}>
                      {FORMATS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </NativeSelect.Field>
                  </NativeSelect.Root>
                </Field.Root>
                {(form.ticketFormat === 'alphanumeric' || form.ticketFormat === 'custom') && (
                  <Field.Root><Field.Label>Prefixo</Field.Label><Input value={form.ticketPrefix} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, ticketPrefix: e.target.value }))} /></Field.Root>
                )}
                <Field.Root><Field.Label>Dígitos</Field.Label><Input value={form.ticketDigitCount} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, ticketDigitCount: e.target.value }))} /></Field.Root>
                <Card.Root p={4}><Text fontSize="sm">Pré-visualização: <b>{
                  form.ticketFormat === 'numeric' ? '1'.padStart(parseInt(form.ticketDigitCount), '0') : `${form.ticketPrefix}${'1'.padStart(parseInt(form.ticketDigitCount), '0')}`
                }</b></Text></Card.Root>
              </VStack>
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="ghost" onClick={() => setEditOpen(false)}>Cancelar</Button>
              <Button colorPalette="teal" loading={saving} onClick={handleUpdate}>Guardar</Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </VStack>
  );
}
