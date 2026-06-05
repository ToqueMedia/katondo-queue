// Management — Advertisement Management page

import { useRef, useState, useEffect } from 'react';
import { Heading, Text, VStack, Button, Badge, Flex, HStack, Separator, Box, Dialog } from '@chakra-ui/react';
import { Table } from '@chakra-ui/react';
import { Field, Input, Textarea } from '@chakra-ui/react';
import { NativeSelect } from '@chakra-ui/react';
import { listAds, createAd, updateAd, deleteAd } from '../../api/advertisements';
import { listAreas } from '../../api/areas';
import { useNotificationStore } from '../../store/notification-store';
import type { AdvertisementRow, AreaRow, AdContentType } from '../../types';

const CONTENT_TYPES: { value: AdContentType; label: string }[] = [
  { value: 'image', label: 'Imagem' },
  { value: 'video', label: 'Vídeo' },
  { value: 'text', label: 'Texto' },
];

const DURATION_OPTIONS = Array.from({ length: 51 }, (_, i) => i + 10);

export default function AdManagement() {
  const [ads, setAds] = useState<AdvertisementRow[]>([]);
  const [areas, setAreas] = useState<AreaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<AdvertisementRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdvertisementRow | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [form, setForm] = useState({
    title: '',
    contentType: 'text' as AdContentType,
    contentText: '',
    contentUrl: '',
    areaId: '',
    durationSeconds: '20',
  });

  const notify = useNotificationStore();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [a, ar] = await Promise.all([listAds(), listAreas()]);
      setAds(a);
      setAreas(ar);
    } catch {
      notify.addNotification({ type: 'error', title: 'Erro ao carregar dados' });
    } finally {
      setLoading(false);
    }
  };

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const openCreate = () => {
    setEditing(null);
    setForm({
      title: '',
      contentType: 'text',
      contentText: '',
      contentUrl: '',
      areaId: '',
      durationSeconds: '20',
    });
    setCreateOpen(true);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const body = new FormData();
      body.append('file', file);

      const res = await fetch('/api/upload/ad-media', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
        },
        body,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || 'Falha no upload');
      }

      const data = (await res.json()) as { url: string };
      set({ contentUrl: data.url });
    } catch (err: any) {
      notify.addNotification({ type: 'error', title: err?.message || 'Erro no upload' });
    } finally {
      setUploading(false);
    }
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      await createAd(
        form.title,
        form.contentType,
        form.areaId ? parseInt(form.areaId) : null,
        form.contentUrl || undefined,
        form.contentText || undefined,
        parseInt(form.durationSeconds, 10),
      );
      notify.addNotification({ type: 'success', title: 'Anúncio criado' });
      setCreateOpen(false);
      loadData();
    } catch (err: any) {
      notify.addNotification({ type: 'error', title: err.response?.data?.error || 'Erro ao criar' });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await updateAd(editing.id, {
        title: form.title,
        contentType: form.contentType,
        contentText: form.contentText || null,
        contentUrl: form.contentUrl || null,
        areaId: form.areaId ? parseInt(form.areaId) : null,
        durationSeconds: parseInt(form.durationSeconds, 10),
      });
      notify.addNotification({ type: 'success', title: 'Anúncio actualizado' });
      setEditOpen(false);
      setEditing(null);
      loadData();
    } catch (err: any) {
      notify.addNotification({ type: 'error', title: err.response?.data?.error || 'Erro ao actualizar' });
    } finally { setSaving(false); }
  };

  const handleToggle = async (ad: AdvertisementRow) => {
    try {
      await updateAd(ad.id, { active: !ad.active });
      notify.addNotification({ type: 'success', title: 'Estado actualizado' });
      loadData();
    } catch (err: any) {
      notify.addNotification({ type: 'error', title: err.response?.data?.error || 'Erro' });
    }
  };

  const handleDeleteClick = (ad: AdvertisementRow) => {
    setDeleteTarget(ad);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteAd(deleteTarget.id);
      notify.addNotification({ type: 'success', title: 'Anúncio eliminado' });
      loadData();
    } catch (err: any) {
      notify.addNotification({ type: 'error', title: err.response?.data?.error || 'Erro ao eliminar' });
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    }
  };

  const openEdit = (ad: AdvertisementRow) => {
    setEditing(ad);
    setForm({
      title: ad.title,
      contentType: ad.contentType,
      contentText: ad.contentText || '',
      contentUrl: ad.contentUrl || '',
      areaId: ad.areaId ? String(ad.areaId) : '',
      durationSeconds: String(ad.durationSeconds),
    });
    setEditOpen(true);
  };

  const areaName = (id: number | null) => (id ? areas.find((a) => a.id === id)?.name || '—' : 'Todas as áreas');

  const renderPreview = () => {
    if (!form.title && !form.contentText && !form.contentUrl) {
      return <Text color="gray.500">Sem pré-visualização</Text>;
    }

    if (form.contentType === 'text') {
      return (
        <VStack gap={2} align="stretch">
          <Text fontWeight="bold">{form.title || 'Sem título'}</Text>
          <Text>{form.contentText || 'Sem texto'}</Text>
        </VStack>
      );
    }

    if (form.contentType === 'image' && form.contentUrl) {
      return (
        <img
          src={form.contentUrl}
          alt={form.title || 'Pré-visualização'}
          style={{ maxHeight: 280, width: '100%', objectFit: 'contain', borderRadius: 12 }}
        />
      );
    }

    if (form.contentType === 'video' && form.contentUrl) {
      return (
        <video
          src={form.contentUrl}
          controls
          style={{ maxHeight: 280, width: '100%', borderRadius: 12 }}
        />
      );
    }

    return <Text color="gray.500">Pré-visualização indisponível</Text>;
  };

  return (
    <VStack gap={6} align="stretch">
      <Flex justify="space-between" align="center">
        <Heading size="lg">Anúncios</Heading>
        <Button colorPalette="teal" onClick={openCreate}>
          + Anúncio
        </Button>
      </Flex>

      {loading ? (
        <Text>Carregando...</Text>
      ) : ads.length === 0 ? (
        <Text color="gray.500">Nenhum anúncio — clique + para adicionar.</Text>
      ) : (
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader>Título</Table.ColumnHeader>
              <Table.ColumnHeader>Tipo</Table.ColumnHeader>
              <Table.ColumnHeader>Área</Table.ColumnHeader>
              <Table.ColumnHeader>Duração</Table.ColumnHeader>
              <Table.ColumnHeader>Estado</Table.ColumnHeader>
              <Table.ColumnHeader>Acções</Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {ads.map((ad) => (
              <Table.Row key={ad.id}>
                <Table.Cell fontWeight="medium">{ad.title}</Table.Cell>
                <Table.Cell>{ad.contentType}</Table.Cell>
                <Table.Cell>{areaName(ad.areaId)}</Table.Cell>
                <Table.Cell>{ad.durationSeconds}s</Table.Cell>
                <Table.Cell>
                  <Badge colorPalette={ad.active ? 'green' : 'red'}>{ad.active ? 'Activo' : 'Inactivo'}</Badge>
                </Table.Cell>
                <Table.Cell>
                  <HStack gap={1}>
                    <Button size="sm" variant="ghost" onClick={() => openEdit(ad)}>
                      Editar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleToggle(ad)}>
                      {ad.active ? 'Desactivar' : 'Activar'}
                    </Button>
                    <Button size="sm" variant="ghost" colorPalette="red" onClick={() => handleDeleteClick(ad)}>
                      Eliminar
                    </Button>
                  </HStack>
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
            <Dialog.Header>
              <Dialog.Title>Novo Anúncio</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <VStack gap={4} align="stretch">
                <Field.Root>
                  <Field.Label>{form.contentType === 'text' ? 'Título (Destaque / Label)' : 'Título'}</Field.Label>
                  <Input value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder={form.contentType === 'text' ? 'Ex: BREAKING NEWS, AVISO' : ''} />
                </Field.Root>

                <Field.Root>
                  <Field.Label>Tipo</Field.Label>
                  <NativeSelect.Root>
                    <NativeSelect.Field
                      value={form.contentType}
                      onChange={(e) =>
                        set({
                          contentType: e.target.value as AdContentType,
                          contentText: e.target.value === 'text' ? form.contentText : '',
                          contentUrl: e.target.value === 'text' ? '' : form.contentUrl,
                        })
                      }
                    >
                      {CONTENT_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </NativeSelect.Field>
                  </NativeSelect.Root>
                </Field.Root>

                <Field.Root>
                  <Field.Label>Área (vazio = todas)</Field.Label>
                  <NativeSelect.Root>
                    <NativeSelect.Field
                      value={form.areaId}
                      onChange={(e) => set({ areaId: e.target.value })}
                    >
                      <option value="">Todas as áreas</option>
                      {areas.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </NativeSelect.Field>
                  </NativeSelect.Root>
                </Field.Root>

                {form.contentType === 'text' && (
                  <Field.Root>
                    <Field.Label>Texto</Field.Label>
                    <Textarea value={form.contentText} onChange={(e) => set({ contentText: e.target.value })} />
                  </Field.Root>
                )}

                {(form.contentType === 'image' || form.contentType === 'video') && (
                  <VStack gap={3} align="stretch">
                    <Field.Root>
                      <Field.Label>Ficheiro</Field.Label>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,video/*"
                        onChange={handleFileChange}
                        style={{ fontSize: 14 }}
                      />
                      {uploading && <Text fontSize="sm">A enviar...</Text>}
                    </Field.Root>

                    <Field.Root>
                      <Field.Label>URL</Field.Label>
                      <Input
                        value={form.contentUrl}
                        onChange={(e) => set({ contentUrl: e.target.value })}
                        placeholder="https://... ou utilize o upload"
                      />
                    </Field.Root>
                  </VStack>
                )}

                <Field.Root>
                  <Field.Label>Duração (segundos)</Field.Label>
                  <NativeSelect.Root>
                    <NativeSelect.Field
                      value={form.durationSeconds}
                      onChange={(e) => set({ durationSeconds: e.target.value })}
                    >
                      {DURATION_OPTIONS.map((seconds) => (
                        <option key={seconds} value={String(seconds)}>
                          {seconds}s
                        </option>
                      ))}
                    </NativeSelect.Field>
                  </NativeSelect.Root>
                </Field.Root>
              </VStack>

              <Separator my={4} />

              <VStack gap={2} align="stretch">
                <Text fontWeight="semibold">Pré-visualização</Text>
                <Box
                  p={4}
                  borderRadius="lg"
                  borderWidth="1px"
                  bg="blackAlpha.50"
                  minHeight="120px"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                >
                  {renderPreview()}
                </Box>
              </VStack>
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="ghost" onClick={() => setCreateOpen(false)}>
                Cancelar
              </Button>
              <Button colorPalette="teal" loading={saving} onClick={handleCreate}>
                Criar
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>

      <Dialog.Root open={editOpen} onOpenChange={(e: { open: boolean }) => setEditOpen(e.open)}>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Editar Anúncio</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <VStack gap={4} align="stretch">
                <Field.Root>
                  <Field.Label>{form.contentType === 'text' ? 'Título (Destaque / Label)' : 'Título'}</Field.Label>
                  <Input value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder={form.contentType === 'text' ? 'Ex: BREAKING NEWS, AVISO' : ''} />
                </Field.Root>

                <Field.Root>
                  <Field.Label>Tipo</Field.Label>
                  <NativeSelect.Root>
                    <NativeSelect.Field
                      value={form.contentType}
                      onChange={(e) =>
                        set({
                          contentType: e.target.value as AdContentType,
                          contentText: e.target.value === 'text' ? form.contentText : '',
                          contentUrl: e.target.value === 'text' ? '' : form.contentUrl,
                        })
                      }
                    >
                      {CONTENT_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </NativeSelect.Field>
                  </NativeSelect.Root>
                </Field.Root>

                <Field.Root>
                  <Field.Label>Área</Field.Label>
                  <NativeSelect.Root>
                    <NativeSelect.Field
                      value={form.areaId}
                      onChange={(e) => set({ areaId: e.target.value })}
                    >
                      <option value="">Todas as áreas</option>
                      {areas.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </NativeSelect.Field>
                  </NativeSelect.Root>
                </Field.Root>

                {form.contentType === 'text' && (
                  <Field.Root>
                    <Field.Label>Texto</Field.Label>
                    <Textarea value={form.contentText} onChange={(e) => set({ contentText: e.target.value })} />
                  </Field.Root>
                )}

                {(form.contentType === 'image' || form.contentType === 'video') && (
                  <VStack gap={3} align="stretch">
                    <Field.Root>
                      <Field.Label>Ficheiro</Field.Label>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,video/*"
                        onChange={handleFileChange}
                        style={{ fontSize: 14 }}
                      />
                      {uploading && <Text fontSize="sm">A enviar...</Text>}
                    </Field.Root>

                    <Field.Root>
                      <Field.Label>URL</Field.Label>
                      <Input
                        value={form.contentUrl}
                        onChange={(e) => set({ contentUrl: e.target.value })}
                      />
                    </Field.Root>
                  </VStack>
                )}

                <Field.Root>
                  <Field.Label>Duração (segundos)</Field.Label>
                  <NativeSelect.Root>
                    <NativeSelect.Field
                      value={form.durationSeconds}
                      onChange={(e) => set({ durationSeconds: e.target.value })}
                    >
                      {DURATION_OPTIONS.map((seconds) => (
                        <option key={seconds} value={String(seconds)}>
                          {seconds}s
                        </option>
                      ))}
                    </NativeSelect.Field>
                  </NativeSelect.Root>
                </Field.Root>
              </VStack>

              <Separator my={4} />

              <VStack gap={2} align="stretch">
                <Text fontWeight="semibold">Pré-visualização</Text>
                <Box
                  p={4}
                  borderRadius="lg"
                  borderWidth="1px"
                  bg="blackAlpha.50"
                  minHeight="120px"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                >
                  {renderPreview()}
                </Box>
              </VStack>
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="ghost" onClick={() => setEditOpen(false)}>
                Cancelar
              </Button>
              <Button colorPalette="teal" loading={saving} onClick={handleUpdate}>
                Guardar
              </Button>
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
                Tem certeza que deseja eliminar o anúncio <strong>{deleteTarget?.title}</strong>? Esta acção não pode ser revertida.
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
