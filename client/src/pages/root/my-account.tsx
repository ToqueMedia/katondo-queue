// Root/Admin — My Account page (change own password)

import { useState } from 'react';
import { Heading, VStack, Field, Input, Button, Text } from '@chakra-ui/react';
import { changePassword } from '../../api/users';
import { useAuthStore } from '../../store/auth-store';
import { useNotificationStore } from '../../store/notification-store';

export default function MyAccount() {
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const authStore = useAuthStore();
  const notify = useNotificationStore();

  const handleSubmit = async () => {
    if (newPassword.length < 6) {
      notify.addNotification({ type: 'error', title: 'Senha deve ter pelo menos 6 caracteres' });
      return;
    }
    setLoading(true);
    try {
      await changePassword(authStore.user!.id, newPassword);
      notify.addNotification({ type: 'success', title: 'Senha alterada com sucesso' });
      setNewPassword('');
      authStore.setDefaultPassword(false);
    } catch (err: any) {
      notify.addNotification({ type: 'error', title: err.response?.data?.error || 'Erro ao alterar senha' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <VStack gap={6} align="stretch" maxW="500px">
      <Heading size="lg">Minha Conta</Heading>
      <Text color="gray.600">Utilizador: {authStore.user?.username}</Text>
      <VStack gap={4}>
        <Field.Root>
          <Field.Label>Nova Senha</Field.Label>
          <Input
            type="password"
            value={newPassword}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewPassword(e.target.value)}
            placeholder="Nova senha (mínimo 6 caracteres)"
          />
        </Field.Root>
        <Button colorPalette="teal" loading={loading} onClick={handleSubmit}>
          Alterar Senha
        </Button>
      </VStack>
    </VStack>
  );
}