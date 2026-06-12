// Admin — User Management page

import { useState, useEffect, useMemo } from 'react';
import { Heading, Text, VStack, Button, Badge, Flex, Dialog, Portal, Box, Card, HStack, SimpleGrid, Tabs } from '@chakra-ui/react';
import { Table } from '@chakra-ui/react';
import { Field, Input } from '@chakra-ui/react';
import { NativeSelect } from '@chakra-ui/react';
import { listUsers, createUser, updateUser, deleteUser, changePassword } from '../../api/users';
import { listAreas } from '../../api/areas';
import { listStations } from '../../api/stations';
import { useNotificationStore } from '../../store/notification-store';
import { AdminPageHeader } from '../../components/admin/admin-page';
import type { UserRow, UserRole, AreaRow, StationRow } from '../../types';

const ROLES: { value: UserRole; label: string }[] = [
  { value: 'reception', label: 'Recepção' },
  { value: 'management', label: 'Gestão' },
  { value: 'display', label: 'Display' },
  { value: 'dispenser', label: 'Dispensador' },
];

type UserTab = 'all' | UserRole | 'inactive';

const USER_TABS: { value: UserTab; label: string; description: string }[] = [
  { value: 'all', label: 'Todos', description: 'Visão geral' },
  { value: 'reception', label: 'Recepção', description: 'Operadores de atendimento' },
  { value: 'management', label: 'Gestão', description: 'Gestores operacionais' },
  { value: 'display', label: 'Displays', description: 'Ecrãs de chamada' },
  { value: 'dispenser', label: 'Dispensadores', description: 'Quiosques de emissão' },
  { value: 'inactive', label: 'Inactivos', description: 'Contas desactivadas — reactivar para voltar a usar' },
];

type UserForm = {
  username: string;
  password: string;
  name: string;
  role: UserRole;
  areaId: string;
  stationId: string;
};

const EMPTY_FORM: UserForm = {
  username: '',
  password: '',
  name: '',
  role: 'reception',
  areaId: '',
  stationId: '',
};

export default function UserManagement() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [areas, setAreas] = useState<AreaRow[]>([]);
  const [stations, setStations] = useState<StationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<UserTab>('all');
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<UserForm>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<UserRow | null>(null);
  const [editForm, setEditForm] = useState<UserForm>(EMPTY_FORM);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const notify = useNotificationStore();

  // Reset password states
  const [pwdOpen, setPwdOpen] = useState(false);
  const [pwdUser, setPwdUser] = useState<UserRow | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const openResetPassword = (user: UserRow) => {
    setPwdUser(user);
    setNewPassword('');
    setPwdOpen(true);
  };

  const handleResetPassword = async () => {
    if (!pwdUser) return;
    if (newPassword.length < 6) {
      notify.addNotification({ type: 'error', title: 'A senha deve ter no mínimo 6 caracteres' });
      return;
    }
    setSavingPassword(true);
    try {
      await changePassword(pwdUser.id, newPassword);
      notify.addNotification({ type: 'success', title: `Senha de ${pwdUser.username} alterada com sucesso!` });
      setPwdOpen(false); setPwdUser(null); setNewPassword('');
    } catch (err: any) {
      notify.addNotification({ type: 'error', title: err.response?.data?.error || 'Erro ao alterar senha' });
    } finally { setSavingPassword(false); }
  };



  useEffect(() => {
    loadUsers();
    loadAreas();
    loadStations();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await listUsers();
      setUsers(data.filter((u) => u.role !== 'root' && u.role !== 'admin'));
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
        (form.role === 'display' || form.role === 'dispenser') && form.areaId ? parseInt(form.areaId) : null,
        null,
        form.name || undefined
      );
      notify.addNotification({ type: 'success', title: 'Utilizador criado' });
      setCreateOpen(false);
      setForm(EMPTY_FORM);
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

  const handleEditRoleChange = (value: UserRole) => {
    setEditForm((f) => ({
      ...f,
      role: value,
      areaId: value === 'display' || value === 'dispenser' ? f.areaId : '',
      stationId: '',
    }));
  };

  const openEditUser = (user: UserRow) => {
    setEditTarget(user);
    setEditForm({
      username: user.username,
      password: '',
      name: user.name || '',
      role: user.role,
      areaId: user.areaId ? String(user.areaId) : '',
      stationId: user.stationId ? String(user.stationId) : '',
    });
    setEditOpen(true);
  };

  const handleEditSave = async () => {
    if (!editTarget) return;
    if (!editForm.username.trim()) {
      notify.addNotification({ type: 'error', title: 'Informe o utilizador' });
      return;
    }
    if ((editForm.role === 'display' || editForm.role === 'dispenser') && !editForm.areaId) {
      notify.addNotification({ type: 'error', title: 'Seleccione uma área para este perfil' });
      return;
    }

    setSavingEdit(true);
    try {
      const keepsReceptionWorkspace = editTarget.role === 'reception' && editForm.role === 'reception';
      await updateUser(editTarget.id, {
        username: editForm.username.trim(),
        name: editForm.name.trim() || null,
        role: editForm.role,
        areaId: editForm.role === 'display' || editForm.role === 'dispenser'
          ? parseInt(editForm.areaId, 10)
          : keepsReceptionWorkspace ? editTarget.areaId : null,
        stationId: keepsReceptionWorkspace ? editTarget.stationId : null,
      });
      notify.addNotification({ type: 'success', title: 'Utilizador actualizado' });
      setEditOpen(false);
      setEditTarget(null);
      setEditForm(EMPTY_FORM);
      loadUsers();
    } catch (err: any) {
      notify.addNotification({ type: 'error', title: err.response?.data?.error || 'Erro ao actualizar' });
    } finally {
      setSavingEdit(false);
    }
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

  const userCounts = useMemo(() => {
    return USER_TABS.reduce((acc, tab) => {
      if (tab.value === 'all') {
        acc[tab.value] = users.length;
      } else if (tab.value === 'inactive') {
        acc[tab.value] = users.filter((u) => !u.active).length;
      } else {
        acc[tab.value] = users.filter((u) => u.role === tab.value).length;
      }
      return acc;
    }, {} as Record<UserTab, number>);
  }, [users]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users.filter((u) => {
      const matchesTab = activeTab === 'all'
        ? true
        : activeTab === 'inactive'
          ? !u.active
          : u.role === activeTab;
      if (!matchesTab) return false;
      if (!query) return true;
      return [
        u.username,
        u.name || '',
        roleLabel(u.role),
        areaLabel(u),
        stationLabel(u),
      ].some((value) => value.toLowerCase().includes(query));
    });
  }, [activeTab, search, users, areas, stations]);

  const openCreateUser = () => {
    const role = activeTab !== 'all' && activeTab !== 'inactive' && activeTab !== 'root' && activeTab !== 'admin'
      ? activeTab
      : 'reception';
    setForm({ ...EMPTY_FORM, role });
    setCreateOpen(true);
  };

  return (
    <VStack gap={6} align="stretch">
      <AdminPageHeader
        title="Utilizadores"
        description="Organize contas por perfil, área, estação e estado operacional."
        action={<Button colorPalette="teal" onClick={openCreateUser}>+ Utilizador</Button>}
      />

      <SimpleGrid columns={{ base: 1, sm: 2, md: 3, lg: 6 }} gap={4}>
        <Card.Root p={5} bg="white" borderRadius="10px" border="1px solid" borderColor="blackAlpha.100" shadow="sm">
          <Text fontSize="xs" color="gray.500" fontWeight="600">Total</Text>
          <Heading size="2xl" color="brand.700">{users.length}</Heading>
        </Card.Root>
        <Card.Root p={5} bg="white" borderRadius="10px" border="1px solid" borderColor="blackAlpha.100" shadow="sm">
          <Text fontSize="xs" color="gray.500" fontWeight="600">Recepção</Text>
          <Heading size="2xl" color="teal.600">{userCounts.reception || 0}</Heading>
        </Card.Root>
        <Card.Root p={5} bg="white" borderRadius="10px" border="1px solid" borderColor="blackAlpha.100" shadow="sm">
          <Text fontSize="xs" color="gray.500" fontWeight="600">Gestão</Text>
          <Heading size="2xl" color="blue.600">{userCounts.management || 0}</Heading>
        </Card.Root>
        <Card.Root p={5} bg="white" borderRadius="10px" border="1px solid" borderColor="blackAlpha.100" shadow="sm">
          <Text fontSize="xs" color="gray.500" fontWeight="600">Displays</Text>
          <Heading size="2xl" color="gray.700">{userCounts.display || 0}</Heading>
        </Card.Root>
        <Card.Root p={5} bg="white" borderRadius="10px" border="1px solid" borderColor="blackAlpha.100" shadow="sm">
          <Text fontSize="xs" color="gray.500" fontWeight="600">Dispensadores</Text>
          <Heading size="2xl" color="cyan.700">{userCounts.dispenser || 0}</Heading>
        </Card.Root>
        <Card.Root
          p={5}
          bg={(userCounts.inactive || 0) > 0 ? 'orange.50' : 'white'}
          borderRadius="10px"
          border="1px solid"
          borderColor={(userCounts.inactive || 0) > 0 ? 'orange.200' : 'blackAlpha.100'}
          shadow="sm"
        >
          <HStack justify="space-between" align="start">
            <Box>
              <Text fontSize="xs" color="gray.500" fontWeight="600">Inactivos</Text>
              <Heading size="2xl" color={(userCounts.inactive || 0) > 0 ? 'orange.700' : 'gray.400'}>
                {userCounts.inactive || 0}
              </Heading>
            </Box>
            {(userCounts.inactive || 0) > 0 && (
              <Badge colorPalette="orange" variant="surface" borderRadius="6px">
                Desactivados
              </Badge>
            )}
          </HStack>
        </Card.Root>
      </SimpleGrid>

      <Card.Root bg="white" borderRadius="10px" border="1px solid" borderColor="blackAlpha.100" shadow="sm" overflow="hidden">
        <Card.Body p={0}>
          <Tabs.Root value={activeTab} onValueChange={(e) => setActiveTab(e.value as UserTab)}>
            <Flex
              px={5}
              py={4}
              gap={4}
              align={{ base: 'stretch', lg: 'center' }}
              justify="space-between"
              direction={{ base: 'column', lg: 'row' }}
              borderBottom="1px solid"
              borderColor="blackAlpha.100"
            >
              <Box overflowX="auto">
                <Tabs.List bg="gray.50" p={1} borderRadius="8px" minW="max-content">
                  {USER_TABS.map((tab) => (
                    <Tabs.Trigger
                      key={tab.value}
                      value={tab.value}
                      px={3}
                      py={2}
                      borderRadius="6px"
                      fontSize="sm"
                      fontWeight="600"
                      color="gray.600"
                      _selected={
                        tab.value === 'inactive'
                          ? { bg: 'white', color: 'orange.700', shadow: 'xs' }
                          : { bg: 'white', color: 'brand.700', shadow: 'xs' }
                      }
                    >
                      <HStack gap={2}>
                        <Text>{tab.label}</Text>
                        <Badge
                          colorPalette={
                            tab.value === 'all' ? 'gray' :
                            tab.value === 'inactive' ? 'orange' :
                            'teal'
                          }
                          borderRadius="6px"
                        >
                          {userCounts[tab.value] || 0}
                        </Badge>
                      </HStack>
                    </Tabs.Trigger>
                  ))}
                </Tabs.List>
              </Box>
              <Input
                value={search}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                placeholder="Pesquisar por nome, utilizador, área ou estação"
                maxW={{ base: '100%', lg: '360px' }}
                bg="white"
              />
            </Flex>

            {USER_TABS.map((tab) => (
              <Tabs.Content key={tab.value} value={tab.value} m={0}>
                <Flex px={5} py={3} justify="space-between" align="center" bg="gray.50" borderBottom="1px solid" borderColor="blackAlpha.100">
                  <Box>
                    <Text fontWeight="700" color="gray.800">{tab.label}</Text>
                    <Text fontSize="xs" color="gray.500">{tab.description}</Text>
                  </Box>
                  <Badge colorPalette="blue" borderRadius="6px">{filteredUsers.length} na lista</Badge>
                </Flex>

                {loading ? (
                  <Box p={6}>
                    <Text>Carregando...</Text>
                  </Box>
                ) : users.length === 0 ? (
                  <Box p={6}>
                    <Text color="gray.500">Nenhum utilizador — clique + para adicionar o primeiro utilizador.</Text>
                  </Box>
                ) : filteredUsers.length === 0 ? (
                  <Box p={6}>
                    <Text color="gray.500">Nenhum utilizador encontrado neste filtro.</Text>
                  </Box>
                ) : (
                  <Box overflowX="auto">
                    <Table.Root>
                      <Table.Header>
                        <Table.Row bg="gray.50">
                          <Table.ColumnHeader>Utilizador</Table.ColumnHeader>
                          <Table.ColumnHeader>Perfil</Table.ColumnHeader>
                          <Table.ColumnHeader>Área</Table.ColumnHeader>
                          <Table.ColumnHeader>Estação</Table.ColumnHeader>
                          <Table.ColumnHeader>Estado</Table.ColumnHeader>
                          <Table.ColumnHeader textAlign="right">Acções</Table.ColumnHeader>
                        </Table.Row>
                      </Table.Header>
                      <Table.Body>
                        {filteredUsers.map((u) => (
                          <Table.Row key={u.id} bg={u.active ? undefined : 'gray.50'} opacity={u.active ? 1 : 0.75}>
                            <Table.Cell>
                              <VStack gap={0} align="start">
                                <Text fontWeight="600" color="gray.900" textDecoration={u.active ? undefined : 'line-through'}>
                                  {u.username}
                                </Text>
                                {u.name && <Text fontSize="xs" color="gray.500">{u.name}</Text>}
                              </VStack>
                            </Table.Cell>
                            <Table.Cell><Badge colorPalette="teal">{roleLabel(u.role)}</Badge></Table.Cell>
                            <Table.Cell>{areaLabel(u)}</Table.Cell>
                            <Table.Cell>{u.role === 'reception' ? stationLabel(u) : '—'}</Table.Cell>
                            <Table.Cell><Badge colorPalette={u.active ? 'green' : 'red'}>{u.active ? 'Activo' : 'Inactivo'}</Badge></Table.Cell>
                            <Table.Cell>
                              <Flex gap={1} justify="flex-end" wrap="wrap">
                                <Button size="sm" variant="ghost" colorPalette="blue" onClick={() => openEditUser(u)}>Editar</Button>
                                <Button size="sm" variant="ghost" colorPalette="teal" onClick={() => openResetPassword(u)}>Senha</Button>
                                {u.active ? (
                                  <Button size="sm" variant="ghost" onClick={() => handleToggleActive(u)}>
                                    Desactivar
                                  </Button>
                                ) : (
                                  <Button size="sm" variant="solid" colorPalette="green" onClick={() => handleToggleActive(u)}>
                                    Activar
                                  </Button>
                                )}
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
                  </Box>
                )}
              </Tabs.Content>
            ))}
          </Tabs.Root>
        </Card.Body>
      </Card.Root>

      <Dialog.Root open={createOpen} onOpenChange={(e: { open: boolean }) => setCreateOpen(e.open)}>
        {createOpen && (
          <Portal>
            <Dialog.Backdrop bg="blackAlpha.600" backdropFilter="blur(4px)" />
            <Dialog.Positioner p={4} display="flex" alignItems="center" justifyContent="center">
              <Dialog.Content bg="white" borderRadius="16px" boxShadow="lg" maxW="500px" w="100%" p={6}>
                <Dialog.Header pb={3} borderBottom="1px solid" borderColor="blackAlpha.100">
                  <Dialog.Title fontSize="lg" fontWeight="bold" color="brand.700">Novo Utilizador</Dialog.Title>
                </Dialog.Header>
                <Dialog.Body py={4}>
                  <VStack gap={4}>
                    <Field.Root>
                      <Field.Label fontSize="sm" fontWeight="500" mb={1}>Utilizador</Field.Label>
                      <Input value={form.username} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, username: e.target.value }))} placeholder="Ex: recepcao_sul" />
                    </Field.Root>
                    <Field.Root>
                      <Field.Label fontSize="sm" fontWeight="500" mb={1}>Senha</Field.Label>
                      <Input type="password" value={form.password} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="Mínimo 6 caracteres" />
                    </Field.Root>
                    <Field.Root>
                      <Field.Label fontSize="sm" fontWeight="500" mb={1}>Perfil</Field.Label>
                      <NativeSelect.Root>
                        <NativeSelect.Field
                          value={form.role}
                          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleRoleChange(e.target.value as UserRole)}
                        >
                          {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </NativeSelect.Field>
                      </NativeSelect.Root>
                    </Field.Root>

                    {/* Full Name for Receptionists only */}
                    {form.role === 'reception' && (
                      <Field.Root>
                        <Field.Label fontSize="sm" fontWeight="500" mb={1}>Nome do Recepcionista</Field.Label>
                        <Input value={form.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ex: Maria João" />
                      </Field.Root>
                    )}

                    {/* Area binding for displays and dispensers only */}
                    {(form.role === 'display' || form.role === 'dispenser') && (
                      <Field.Root>
                        <Field.Label fontSize="sm" fontWeight="500" mb={1}>Área</Field.Label>
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
                    )}
                  </VStack>
                </Dialog.Body>
                <Dialog.Footer pt={3} borderTop="1px solid" borderColor="blackAlpha.100" display="flex" justifyContent="end" gap={3}>
                  <Button variant="ghost" size="sm" onClick={() => setCreateOpen(false)}>Cancelar</Button>
                  <Button colorPalette="teal" size="sm" loading={creating} onClick={handleCreate}>Criar</Button>
                </Dialog.Footer>
              </Dialog.Content>
            </Dialog.Positioner>
          </Portal>
        )}
      </Dialog.Root>

      <Dialog.Root open={editOpen} onOpenChange={(e: { open: boolean }) => setEditOpen(e.open)}>
        {editOpen && editTarget && (
          <Portal>
            <Dialog.Backdrop bg="blackAlpha.600" backdropFilter="blur(4px)" />
            <Dialog.Positioner p={4} display="flex" alignItems="center" justifyContent="center">
              <Dialog.Content bg="white" borderRadius="16px" boxShadow="lg" maxW="500px" w="100%" p={6}>
                <Dialog.Header pb={3} borderBottom="1px solid" borderColor="blackAlpha.100">
                  <Dialog.Title fontSize="lg" fontWeight="bold" color="brand.700">Editar Utilizador</Dialog.Title>
                </Dialog.Header>
                <Dialog.Body py={4}>
                  <VStack gap={4}>
                    <Field.Root>
                      <Field.Label fontSize="sm" fontWeight="500" mb={1}>Utilizador</Field.Label>
                      <Input value={editForm.username} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditForm((f) => ({ ...f, username: e.target.value }))} placeholder="Ex: recepcao_sul" />
                    </Field.Root>
                    <Field.Root>
                      <Field.Label fontSize="sm" fontWeight="500" mb={1}>Nome</Field.Label>
                      <Input value={editForm.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditForm((f) => ({ ...f, name: e.target.value }))} placeholder="Nome completo" />
                    </Field.Root>
                    <Field.Root>
                      <Field.Label fontSize="sm" fontWeight="500" mb={1}>Perfil</Field.Label>
                      <NativeSelect.Root>
                        <NativeSelect.Field
                          value={editForm.role}
                          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleEditRoleChange(e.target.value as UserRole)}
                        >
                          {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </NativeSelect.Field>
                      </NativeSelect.Root>
                    </Field.Root>

                    {(editForm.role === 'display' || editForm.role === 'dispenser') && (
                      <Field.Root>
                        <Field.Label fontSize="sm" fontWeight="500" mb={1}>Área</Field.Label>
                        <NativeSelect.Root>
                          <NativeSelect.Field
                            value={editForm.areaId}
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEditForm((f) => ({ ...f, areaId: e.target.value }))}
                          >
                            <option value="">Seleccione a área...</option>
                            {areas.map((a) => (
                              <option key={a.id} value={a.id}>{a.name}</option>
                            ))}
                          </NativeSelect.Field>
                        </NativeSelect.Root>
                      </Field.Root>
                    )}

                    <Field.Root>
                      <Field.Label fontSize="sm" fontWeight="500" mb={1}>Estado</Field.Label>
                      <Badge alignSelf="start" colorPalette={editTarget.active ? 'green' : 'red'}>
                        {editTarget.active ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </Field.Root>
                  </VStack>
                </Dialog.Body>
                <Dialog.Footer pt={3} borderTop="1px solid" borderColor="blackAlpha.100" display="flex" justifyContent="end" gap={3}>
                  <Button variant="ghost" size="sm" onClick={() => { setEditOpen(false); setEditTarget(null); }}>Cancelar</Button>
                  <Button colorPalette="teal" size="sm" loading={savingEdit} onClick={handleEditSave}>Guardar</Button>
                </Dialog.Footer>
              </Dialog.Content>
            </Dialog.Positioner>
          </Portal>
        )}
      </Dialog.Root>

      <Dialog.Root open={pwdOpen} onOpenChange={(e: { open: boolean }) => setPwdOpen(e.open)}>
        {pwdOpen && pwdUser && (
          <Portal>
            <Dialog.Backdrop bg="blackAlpha.600" backdropFilter="blur(4px)" />
            <Dialog.Positioner p={4} display="flex" alignItems="center" justifyContent="center">
              <Dialog.Content bg="white" borderRadius="16px" boxShadow="lg" maxW="440px" w="100%" p={6}>
                <Dialog.Header pb={3} borderBottom="1px solid" borderColor="blackAlpha.100">
                  <Dialog.Title fontSize="lg" fontWeight="bold" color="brand.700">Alterar Senha — {pwdUser.username}</Dialog.Title>
                </Dialog.Header>
                <Dialog.Body py={4}>
                  <VStack gap={4}>
                    <Field.Root>
                      <Field.Label fontSize="sm" fontWeight="500" mb={1}>Nova Senha</Field.Label>
                      <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
                    </Field.Root>
                  </VStack>
                </Dialog.Body>
                <Dialog.Footer pt={3} borderTop="1px solid" borderColor="blackAlpha.100" display="flex" justifyContent="end" gap={3}>
                  <Button variant="ghost" size="sm" onClick={() => { setPwdOpen(false); setPwdUser(null); }}>Cancelar</Button>
                  <Button colorPalette="teal" size="sm" loading={savingPassword} onClick={handleResetPassword}>Alterar Senha</Button>
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
                    Tem certeza que deseja eliminar o utilizador <strong>{deleteTarget?.username}</strong>? Esta acção não pode ser revertida.
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
