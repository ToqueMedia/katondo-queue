// First login — force password change modal (redesigned)

import { useState } from 'react';
import { Dialog, Button, VStack, Field, Input, Text, Box } from '@chakra-ui/react';
import { useAuthStore } from '../store/auth-store';
import { changePassword } from '../api/users';
import { useNotificationStore } from '../store/notification-store';

export default function FirstLoginModal() {
  const authStore = useAuthStore();
  const notify = useNotificationStore();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const open = authStore.isDefaultPassword;

  const handleSubmit = async () => {
    setError('');
    if (newPassword.length < 6) {
      setError('A nova senha deve ter pelo menos 6 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }

    setLoading(true);
    try {
      await changePassword(authStore.user!.id, newPassword, currentPassword);
      authStore.setDefaultPassword(false);
      notify.addNotification({ type: 'success', title: 'Senha alterada com sucesso' });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao alterar senha');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <Dialog.Root open={open}>
      <Dialog.Backdrop bg="blackAlpha.600" backdropFilter="blur(4px)" />
      <Dialog.Positioner>
        <Dialog.Content borderRadius="20px" maxW="440px" p={0} overflow="hidden">
          {/* Header */}
          <Box bg="brand.700" p={6} textAlign="center">
            <VStack gap={2}>
              <Box
                w="44px"
                h="44px"
                bg="whiteAlpha.200"
                borderRadius="12px"
                display="flex"
                alignItems="center"
                justifyContent="center"
                mx="auto"
              >
                <Text fontSize="xl">🔒</Text>
              </Box>
              <Text fontFamily="heading" fontSize="xl" fontWeight="400" color="white">
                Alterar Senha
              </Text>
              <Text fontSize="sm" color="whiteAlpha.700">
                Por segurança, altere a sua senha de primeiro acesso
              </Text>
            </VStack>
          </Box>

          {/* Body */}
          <Box p={6}>
            <VStack gap={4} align="stretch">
              <Field.Root>
                <Field.Label fontSize="sm" fontWeight="500">Senha Actual</Field.Label>
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCurrentPassword(e.target.value)}
                  borderRadius="10px"
                  borderColor="blackAlpha.100"
                  _focus={{ borderColor: 'brand.500', boxShadow: '0 0 0 3px rgba(21,101,192,0.10)' }}
                />
              </Field.Root>
              <Field.Root>
                <Field.Label fontSize="sm" fontWeight="500">Nova Senha</Field.Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewPassword(e.target.value)}
                  borderRadius="10px"
                  borderColor="blackAlpha.100"
                  _focus={{ borderColor: 'brand.500', boxShadow: '0 0 0 3px rgba(21,101,192,0.10)' }}
                />
              </Field.Root>
              <Field.Root>
                <Field.Label fontSize="sm" fontWeight="500">Confirmar Nova Senha</Field.Label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
                  borderRadius="10px"
                  borderColor="blackAlpha.100"
                  _focus={{ borderColor: 'brand.500', boxShadow: '0 0 0 3px rgba(21,101,192,0.10)' }}
                />
              </Field.Root>

              {error && (
                <Box
                  bg="#FEF2F2"
                  border="1px solid"
                  borderColor="#FECACA"
                  borderRadius="10px"
                  px={4}
                  py={3}
                >
                  <Text fontSize="sm" color="#991B1B" fontWeight="500">{error}</Text>
                </Box>
              )}

              <Button
                colorPalette="brand"
                loading={loading}
                onClick={handleSubmit}
                borderRadius="10px"
                fontWeight="600"
                _hover={{ transform: 'translateY(-1px)', boxShadow: '0 4px 12px rgba(21,101,192,0.25)' }}
                transition="all 0.2s"
              >
                Guardar Nova Senha
              </Button>
            </VStack>
          </Box>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
