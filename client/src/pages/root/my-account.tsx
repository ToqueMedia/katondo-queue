// Root/Admin — My Account page (change own password)

import { useState } from 'react';
import { Badge, Box, Field, Flex, Grid, Heading, HStack, Input, Separator, Text, VStack, Button } from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { changePassword } from '../../api/users';
import { useAuthStore } from '../../store/auth-store';
import { useNotificationStore } from '../../store/notification-store';
import { AdminPageHeader, AdminSectionCard } from '../../components/admin/admin-page';

const ROLE_LABELS: Record<string, string> = {
  root: 'Super Admin',
  admin: 'Administrador',
  reception: 'Recepção',
  management: 'Marketing',
  display: 'Display',
  dispenser: 'Dispensador',
};

export default function MyAccount() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const authStore = useAuthStore();
  const notify = useNotificationStore();
  const user = authStore.user;
  const passwordIsValid = newPassword.length >= 6;
  const passwordsMatch = confirmPassword.length > 0 && newPassword === confirmPassword;

  const handleSubmit = async () => {
    if (!currentPassword) {
      notify.addNotification({ type: 'error', title: 'Informe a senha actual' });
      return;
    }
    if (newPassword.length < 6) {
      notify.addNotification({ type: 'error', title: 'Senha deve ter pelo menos 6 caracteres' });
      return;
    }
    if (newPassword !== confirmPassword) {
      notify.addNotification({ type: 'error', title: 'As senhas não coincidem' });
      return;
    }
    setLoading(true);
    try {
      await changePassword(authStore.user!.id, newPassword, currentPassword);
      notify.addNotification({ type: 'success', title: 'Senha alterada com sucesso' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      authStore.setDefaultPassword(false);
    } catch (err: any) {
      notify.addNotification({ type: 'error', title: err.response?.data?.error || 'Erro ao alterar senha' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <VStack gap={6} align="stretch">
      <AdminPageHeader
        title="Minha Conta"
        description="Actualize a sua senha e confirme os dados associados ao seu acesso."
      />

      <Grid templateColumns={{ base: '1fr', lg: '320px minmax(0, 560px)' }} gap={6} alignItems="start">
        <AdminSectionCard>
          <VStack align="stretch" gap={5} p={6}>
            <HStack gap={3} align="center">
              <Box
                w="48px"
                h="48px"
                borderRadius="10px"
                bg="brand.50"
                display="flex"
                alignItems="center"
                justifyContent="center"
              >
                <Text fontSize="xl" fontWeight="800" color="brand.700">
                  {user?.username?.charAt(0).toUpperCase() || 'U'}
                </Text>
              </Box>
              <VStack gap={0} align="start" minW={0}>
                <Text fontWeight="700" color="gray.900" truncate maxW="220px">
                  {user?.name || user?.username}
                </Text>
                <Text fontSize="sm" color="gray.500" truncate maxW="220px">
                  @{user?.username}
                </Text>
              </VStack>
            </HStack>

            <Separator />

            <VStack align="stretch" gap={3}>
              <Flex justify="space-between" align="center">
                <Text fontSize="sm" color="gray.500">Perfil</Text>
                <Badge colorPalette="teal" borderRadius="6px">{ROLE_LABELS[user?.role || ''] || user?.role}</Badge>
              </Flex>
              <Flex justify="space-between" align="center">
                <Text fontSize="sm" color="gray.500">Estado</Text>
                <Badge colorPalette={user?.active ? 'green' : 'red'} borderRadius="6px">
                  {user?.active ? 'Activo' : 'Inactivo'}
                </Badge>
              </Flex>
            </VStack>
          </VStack>
        </AdminSectionCard>

        <AdminSectionCard>
          <VStack gap={5} align="stretch" p={6}>
            <Box>
              <Heading size="md" color="gray.900">Alterar Senha</Heading>
              <Text fontSize="sm" color="gray.500" mt={1}>
                Use uma senha com pelo menos 6 caracteres. A senha actual é obrigatória.
              </Text>
            </Box>

            <VStack gap={4} align="stretch">
              <Field.Root>
                <Field.Label fontSize="sm" fontWeight="600">Senha Actual</Field.Label>
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCurrentPassword(e.target.value)}
                  placeholder="Informe a senha actual"
                  bg="white"
                />
              </Field.Root>
              <Field.Root>
                <Field.Label fontSize="sm" fontWeight="600">Nova Senha</Field.Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  bg="white"
                />
              </Field.Root>
              <Field.Root>
                <Field.Label fontSize="sm" fontWeight="600">Confirmar Nova Senha</Field.Label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a nova senha"
                  bg="white"
                />
              </Field.Root>
            </VStack>

            {(newPassword || confirmPassword) && (
              <HStack gap={2} wrap="wrap">
                <Badge colorPalette={passwordIsValid ? 'green' : 'orange'} borderRadius="6px">
                  {passwordIsValid ? 'Tamanho válido' : 'Mínimo 6 caracteres'}
                </Badge>
                <Badge colorPalette={passwordsMatch ? 'green' : 'orange'} borderRadius="6px">
                  {passwordsMatch ? 'Confirmação igual' : 'Confirmação pendente'}
                </Badge>
              </HStack>
            )}

            <Flex gap={3} justify="flex-start" wrap="wrap" pt={2}>
              <Button colorPalette="teal" loading={loading} onClick={handleSubmit}>
                Alterar Senha
              </Button>
              {user?.role === 'reception' && (
                <Button variant="outline" onClick={() => navigate('/reception/queue')}>
                  Voltar à Fila
                </Button>
              )}
            </Flex>
          </VStack>
        </AdminSectionCard>
      </Grid>
    </VStack>
  );
}
